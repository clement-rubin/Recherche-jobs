import { groqJson } from './groq'
import { EXTRACTION_SYSTEM, buildExtractionUser } from './prompt'
import type { CompanyNews, CompanyResearch, CompanyValue, ResearchStatut } from './types'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export interface TavilyResult {
  url: string
  title: string
  content: string
  published_date?: string
}

export interface ResearchDeps {
  search: (query: string, opts?: { news?: boolean }) => Promise<TavilyResult[]>
  extract: (system: string, user: string) => Promise<string>
}

export interface ResearchOutcome {
  research: CompanyResearch
  cacheable: boolean
  warning?: string
}

export async function tavilySearch(query: string, opts: { news?: boolean } = {}): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) throw new Error('TAVILY_API_KEY missing')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      max_results: 5,
      topic: opts.news ? 'news' : 'general',
      ...(opts.news && { days: 365 }),
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Tavily ${res.status}`)
  const data = await res.json()
  return ((Array.isArray(data.results) ? data.results : []) as Record<string, unknown>[])
    .filter(r => r && typeof r.url === 'string' && r.url.trim() !== '')
    .map(r => ({
      url: r.url as string,
      title: String(r.title ?? ''),
      content: String(r.content ?? '').slice(0, 800),
      ...(typeof r.published_date === 'string' && { published_date: r.published_date }),
    }))
}

const defaultDeps: ResearchDeps = {
  search: tavilySearch,
  extract: (system, user) => groqJson({ model: 'llama-3.1-8b-instant', system, user, maxTokens: 900, temperature: 0.1 }),
}

const LEGAL_FORMS = /\b(sas|sasu|sa|sarl|gmbh|ag|ltd|inc|llc|bv|nv|spa|srl|group|groupe)\b/g

export function normalizeCompanyName(name: string): string {
  const normalized = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(LEGAL_FORMS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Names made only of legal forms or non-Latin characters would otherwise collapse to "".
  return normalized || name.trim().toLowerCase()
}

export function computeStatut(valeurs: CompanyValue[], actualites: CompanyNews[]): ResearchStatut {
  if (valeurs.length > 0 && actualites.length > 0) return 'suffisante'
  if (valeurs.length > 0 || actualites.length > 0) return 'partielle'
  return 'insuffisante'
}

const MAX_VALUE_LENGTH = 150
const MAX_SUMMARY_LENGTH = 300
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])/

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

const emptyResearch =(today: string): CompanyResearch => ({
  statut: 'insuffisante', date_recherche: today, perimetre: null, valeurs: [], actualites: [],
})

export async function researchCompany(
  name: string | null,
  today: string,
  deps: ResearchDeps = defaultDeps,
): Promise<ResearchOutcome> {
  if (!name?.trim()) {
    return { research: emptyResearch(today), cacheable: false, warning: "Nom d'entreprise absent de l'offre : recherche impossible" }
  }

  const [siteRes, newsRes] = await Promise.allSettled([
    deps.search(`${name} à propos valeurs mission carrières site officiel`),
    deps.search(`${name} actualités`, { news: true }),
  ])
  if (siteRes.status === 'rejected' && newsRes.status === 'rejected') {
    console.warn('[research] search failed', siteRes.reason, newsRes.reason)
    return { research: emptyResearch(today), cacheable: false, warning: 'Recherche web indisponible' }
  }
  const partial = siteRes.status === 'rejected' || newsRes.status === 'rejected'
  if (partial) console.warn('[research] one search failed', siteRes.status === 'rejected' ? siteRes.reason : (newsRes as PromiseRejectedResult).reason)
  const site = siteRes.status === 'fulfilled' ? siteRes.value : []
  const news = newsRes.status === 'fulfilled' ? newsRes.value : []

  let parsed: Record<string, unknown>
  try {
    const json: unknown = JSON.parse(await deps.extract(EXTRACTION_SYSTEM, buildExtractionUser(name, site, news)))
    if (!isRecord(json)) throw new Error('extraction is not an object')
    parsed = json
  } catch (err) {
    console.warn('[research] extraction failed', err)
    return { research: emptyResearch(today), cacheable: false, warning: "Extraction de la recherche entreprise impossible" }
  }

  const siteUrls = new Set(site.map(r => r.url))
  const allUrls = new Set([...siteUrls, ...news.map(r => r.url)])

  const seen = new Set<string>()
  const valeurs: CompanyValue[] = []
  for (const v of Array.isArray(parsed.valeurs) ? parsed.valeurs : []) {
    if (!isRecord(v) || typeof v.valeur !== 'string' || !v.valeur.trim()) continue
    if (typeof v.source_url !== 'string' || !siteUrls.has(v.source_url)) continue
    const valeur = v.valeur.trim().slice(0, MAX_VALUE_LENGTH).trim()
    const key = fold(valeur)
    if (seen.has(key)) continue
    seen.add(key)
    valeurs.push({ valeur, source_url: v.source_url })
    if (valeurs.length === 5) break
  }

  const actualites: CompanyNews[] = []
  for (const a of Array.isArray(parsed.actualites) ? parsed.actualites : []) {
    if (!isRecord(a) || typeof a.resume !== 'string' || !a.resume.trim()) continue
    if (typeof a.source_url !== 'string' || !allUrls.has(a.source_url)) continue
    actualites.push({
      resume: a.resume.trim().slice(0, MAX_SUMMARY_LENGTH).trim(),
      date: typeof a.date === 'string' && MONTH_RE.test(a.date) ? a.date.slice(0, 7) : null,
      source_url: a.source_url,
    })
    if (actualites.length === 4) break
  }

  const statut = computeStatut(valeurs, actualites)
  const perimetre = typeof parsed.perimetre === 'string' && parsed.perimetre.trim() ? parsed.perimetre.trim() : null

  return {
    research: { statut, date_recherche: today, perimetre, valeurs, actualites },
    // A partial result must not be cached for months: the missing half may only be a transient failure.
    cacheable: statut !== 'insuffisante' && !partial,
    ...(partial && { warning: 'Recherche web partielle' }),
  }
}
