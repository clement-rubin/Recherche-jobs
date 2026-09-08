import * as cheerio from 'cheerio'
import { DIRECTORY_DOMAINS } from './profile'

export interface NewsItem {
  titre: string
  date: string
  source_url: string
}

export interface CompanyData {
  secteur: string
  taille: string
  culture: string
  tech_stack: string[]
  actualites: NewsItem[]
  sources: string[]
  incertitudes: string[]
  conseils_investigation: string[]
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
}

const HYPOTHESE = 'hypothèse IA — non trouvé sur internet'
const TECH_LIST = ['python', 'java', 'scala', 'spark', 'sql', 'aws', 'gcp', 'azure', 'docker',
  'kubernetes', 'react', 'node', 'typescript', 'tensorflow', 'pytorch', 'databricks',
  'snowflake', 'kafka', 'airflow', 'dbt', 'powerbi', 'tableau', 'looker']

function isDirectory(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return DIRECTORY_DOMAINS.some(d => host.includes(d))
  } catch { return false }
}

async function safeFetch(url: string): Promise<string> {
  try {
    const resp = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(6000) })
    if (!resp.ok) return ''
    return await resp.text()
  } catch { return '' }
}

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const resp = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(6000) })
    if (!resp.ok) return null
    return await resp.json() as T
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Source reconnue n°1 : Wikipedia / Wikidata (API dédiée, usage automatisé
// explicitement prévu — bien plus fiable et légitime que scraper une page
// de résultats Google).
// ---------------------------------------------------------------------------

interface WikiSummary {
  extract?: string
  description?: string
  type?: string
  content_urls?: { desktop?: { page?: string } }
}

interface WikiSearchResult {
  query?: { search?: Array<{ title: string }> }
}

interface WikiPagePropsResult {
  query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> }
}

interface WikidataEntityResult {
  entities?: Record<string, {
    claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>
  }>
}

async function fetchWikipediaSummary(company: string, lang: 'fr' | 'en'): Promise<{
  extract: string
  pageUrl: string
  pageTitle: string
} | null> {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(company)}&format=json&origin=*`
  const searchData = await safeFetchJson<WikiSearchResult>(searchUrl)
  const title = searchData?.query?.search?.[0]?.title
  if (!title) return null

  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const summary = await safeFetchJson<WikiSummary>(summaryUrl)
  if (!summary?.extract) return null

  return {
    extract: summary.extract,
    pageUrl: summary.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    pageTitle: title,
  }
}

async function fetchWikidataOfficialSite(pageTitle: string, lang: 'fr' | 'en'): Promise<string | null> {
  const propsUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageprops&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`
  const propsData = await safeFetchJson<WikiPagePropsResult>(propsUrl)
  const pages = propsData?.query?.pages
  const qid = pages ? Object.values(pages)[0]?.pageprops?.wikibase_item : undefined
  if (!qid) return null

  const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
  const entityData = await safeFetchJson<WikidataEntityResult>(entityUrl)
  const website = entityData?.entities?.[qid]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value
  return typeof website === 'string' ? website : null
}

// ---------------------------------------------------------------------------
// Repli : recherche du site officiel via Google Search (comportement
// pré-existant, conservé uniquement quand Wikipedia n'a rien trouvé).
// ---------------------------------------------------------------------------

async function findOfficialSiteViaGoogle(company: string): Promise<string | null> {
  const q = encodeURIComponent(`${company} site officiel`)
  const html = await safeFetch(`https://www.google.com/search?q=${q}&hl=fr`)
  if (!html) return null

  const $ = cheerio.load(html)
  const candidates: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/\/url\?q=([^&]+)/)
    if (match) {
      try {
        const u = decodeURIComponent(match[1])
        if (u.startsWith('http') && !u.includes('google.') && !isDirectory(u)) {
          candidates.push(u)
        }
      } catch { /* ignore */ }
    }
  })
  return candidates[0] ?? null
}

function extractPattern(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return (m[1] ?? m[0]).trim()
  }
  return ''
}

function extractTechFromText(text: string): string[] {
  const lower = text.toLowerCase()
  return TECH_LIST.filter(t => lower.includes(t))
}

// ---------------------------------------------------------------------------
// Actualités : flux RSS Google News (format prévu pour la consommation
// automatisée — bien plus stable qu'un scraping de la page HTML de résultats).
// ---------------------------------------------------------------------------

async function fetchNewsHeadlines(company: string): Promise<NewsItem[]> {
  const q = encodeURIComponent(company)
  const xml = await safeFetch(`https://news.google.com/rss/search?q=${q}&hl=fr&gl=FR&ceid=FR:fr`)
  if (!xml) return []

  try {
    const $ = cheerio.load(xml, { xmlMode: true })
    const results: NewsItem[] = []
    $('item').each((_, el) => {
      const rawTitle = $(el).find('title').first().text().trim()
      const link = $(el).find('link').first().text().trim()
      const pubDate = $(el).find('pubDate').first().text().trim()
      if (!rawTitle) return
      // Google News formate les titres "Titre - Source" : on garde le titre tel quel
      let date = pubDate
      const parsed = pubDate ? new Date(pubDate) : null
      if (parsed && !isNaN(parsed.getTime())) {
        date = parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      }
      results.push({ titre: rawTitle, date, source_url: link })
    })
    return results.slice(0, 5)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function researchCompany(company: string): Promise<CompanyData> {
  const result: CompanyData = {
    secteur: '', taille: '', culture: '', tech_stack: [],
    actualites: [], sources: [], incertitudes: [], conseils_investigation: [],
  }

  if (!company) {
    result.incertitudes.push('Nom entreprise inconnu — impossible de faire la recherche')
    return result
  }

  // --- Étape 1 : Wikipedia en priorité (source reconnue et légale) ---
  let officialSite: string | null = null
  let usedWikipedia = false

  for (const lang of ['fr', 'en'] as const) {
    const wiki = await fetchWikipediaSummary(company, lang)
    if (wiki) {
      result.culture = wiki.extract
      result.secteur = wiki.extract
      result.sources.push(wiki.pageUrl)
      usedWikipedia = true

      const website = await fetchWikidataOfficialSite(wiki.pageTitle, lang)
      if (website) officialSite = website
      break
    }
  }

  // --- Étape 2 : repli Google Search si Wikipedia n'a rien donné ---
  if (!officialSite) {
    officialSite = await findOfficialSiteViaGoogle(company)
  }

  // --- Étape 3 : scraper le site officiel trouvé (peu importe la source) ---
  const pagesToVisit: string[] = []
  if (officialSite) {
    pagesToVisit.push(officialSite)
    try {
      const base = new URL(officialSite)
      for (const path of ['/about', '/a-propos', '/careers']) {
        pagesToVisit.push(`${base.protocol}//${base.host}${path}`)
      }
    } catch { /* ignore */ }
  }

  let siteText = ''
  for (const pageUrl of pagesToVisit.slice(0, 3)) {
    const text = await safeFetch(pageUrl)
    if (text) {
      const $ = cheerio.load(text)
      $('script, style').remove()
      const cleaned = $('body').text().replace(/\s+/g, ' ').slice(0, 2000)
      siteText += '\n' + cleaned
      result.sources.push(pageUrl)
    }
  }

  if (siteText) {
    result.tech_stack = extractTechFromText(siteText)
  }

  // Secteur/taille/culture depuis le site officiel seulement si Wikipedia
  // n'a rien donné (Wikipedia est prioritaire et déjà plus fiable)
  if (!usedWikipedia) {
    if (siteText) {
      result.secteur = extractPattern(siteText, [
        /(?:secteur|industry|domaine)\s*[:\-]\s*([^\n.]{5,60})/i,
        /spécialisé[e]?\s+(?:dans|en)\s+([^\n.]{5,60})/i,
      ]) || HYPOTHESE

      result.culture = extractPattern(siteText, [
        /(?:valeurs?|mission|vision)\s*[:\-]\s*([^\n.]{10,120})/i,
        /(?:notre mission|our mission)\s*:?\s*([^\n.]{10,120})/i,
      ]) || HYPOTHESE
    } else {
      result.secteur = HYPOTHESE
      result.culture = HYPOTHESE
      result.incertitudes.push(`Contenu site inaccessible — ${HYPOTHESE}`)
    }
  }

  // Taille : ni Wikipedia (l'extrait ne la donne pas de façon fiable) ni le
  // scraping heuristique du site officiel ne la trouvent systématiquement
  result.taille = siteText
    ? extractPattern(siteText, [
        /(\d[\d\s]+\s*(?:employés?|salariés?|collaborateurs?|employees?))/i,
        /(\d+[\-–]\d+\s*(?:employés?|employees?))/i,
      ]) || HYPOTHESE
    : HYPOTHESE

  // --- Étape 4 : actualités (RSS, dans tous les cas) ---
  result.actualites = await fetchNewsHeadlines(company)

  if (result.secteur === HYPOTHESE) result.incertitudes.push(`Secteur — ${HYPOTHESE}`)
  if (result.taille === HYPOTHESE) {
    result.incertitudes.push(`Taille — ${HYPOTHESE}`)
    result.conseils_investigation.push(`Cherche "${company} nombre employés" sur LinkedIn ou Glassdoor`)
  }
  if (result.tech_stack.length === 0) {
    result.incertitudes.push(`Stack technique — ${HYPOTHESE}`)
    result.conseils_investigation.push(`Consulte les offres tech de ${company} sur WTTJ ou leur page careers`)
  }
  if (!officialSite) {
    result.incertitudes.push(`Site officiel — ${HYPOTHESE}`)
  }

  return result
}
