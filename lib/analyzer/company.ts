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

async function findOfficialSite(company: string): Promise<string | null> {
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

async function fetchNewsHeadlines(company: string): Promise<NewsItem[]> {
  const q = encodeURIComponent(`${company} actualités`)
  const html = await safeFetch(`https://www.google.com/search?q=${q}&tbm=nws&hl=fr`)
  if (!html) return []

  const $ = cheerio.load(html)
  const results: NewsItem[] = []

  $('div.SoaBEf, div[data-hveid], .g').slice(0, 5).each((_, el) => {
    const titre = $(el).find('div.n0jPhd, .mCBkyc, h3').first().text().trim()
    const date = $(el).find('.OSrXXb, .LfVVr, span').filter((_, s) => /\d{4}/.test($(s).text())).first().text().trim()
    const href = $(el).find('a').attr('href') || ''
    if (titre) results.push({ titre, date, source_url: href })
  })

  return results.slice(0, 3)
}

export async function researchCompany(company: string): Promise<CompanyData> {
  const result: CompanyData = {
    secteur: '', taille: '', culture: '', tech_stack: [],
    actualites: [], sources: [], incertitudes: [], conseils_investigation: [],
  }

  if (!company) {
    result.incertitudes.push('Nom entreprise inconnu — impossible de faire la recherche')
    return result
  }

  const officialSite = await findOfficialSite(company)

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

  let allText = ''
  for (const pageUrl of pagesToVisit.slice(0, 3)) {
    const text = await safeFetch(pageUrl)
    if (text) {
      const $ = cheerio.load(text)
      $('script, style').remove()
      const cleaned = $('body').text().replace(/\s+/g, ' ').slice(0, 2000)
      allText += '\n' + cleaned
      result.sources.push(pageUrl)
    }
  }

  if (allText) {
    result.secteur = extractPattern(allText, [
      /(?:secteur|industry|domaine)\s*[:\-]\s*([^\n.]{5,60})/i,
      /spécialisé[e]?\s+(?:dans|en)\s+([^\n.]{5,60})/i,
    ]) || HYPOTHESE

    result.taille = extractPattern(allText, [
      /(\d[\d\s]+\s*(?:employés?|salariés?|collaborateurs?|employees?))/i,
      /(\d+[\-–]\d+\s*(?:employés?|employees?))/i,
    ]) || HYPOTHESE

    result.culture = extractPattern(allText, [
      /(?:valeurs?|mission|vision)\s*[:\-]\s*([^\n.]{10,120})/i,
      /(?:notre mission|our mission)\s*:?\s*([^\n.]{10,120})/i,
    ]) || HYPOTHESE

    result.tech_stack = extractTechFromText(allText)
  } else {
    result.secteur = HYPOTHESE
    result.taille = HYPOTHESE
    result.culture = HYPOTHESE
    result.incertitudes.push(`Contenu site inaccessible — ${HYPOTHESE}`)
  }

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
