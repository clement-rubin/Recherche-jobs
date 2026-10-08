import { groqJson } from './groq'
import { EXTRACTION_SYSTEM, buildExtractionUser } from './prompt'
import type { CompanyNews, CompanyResearch, CompanyValue, ResearchStatut } from './types'

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
  return ((data.results ?? []) as Record<string, unknown>[]).map(r => ({
    url: String(r.url),
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
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(LEGAL_FORMS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function computeStatut(valeurs: CompanyValue[], actualites: CompanyNews[]): ResearchStatut {
  if (valeurs.length > 0 && actualites.length > 0) return 'suffisante'
  if (valeurs.length > 0 || actualites.length > 0) return 'partielle'
  return 'insuffisante'
}

const emptyResearch = (today: string): CompanyResearch => ({
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

  let site: TavilyResult[]
  let news: TavilyResult[]
  try {
    ;[site, news] = await Promise.all([
      deps.search(`${name} à propos valeurs mission carrières site officiel`),
      deps.search(`${name} actualités`, { news: true }),
    ])
  } catch (err) {
    console.warn('[research] search failed', err)
    return { research: emptyResearch(today), cacheable: false, warning: 'Recherche web indisponible' }
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(await deps.extract(EXTRACTION_SYSTEM, buildExtractionUser(name, site, news)))
    if (!parsed || typeof parsed !== 'object') throw new Error('extraction is not an object')
  } catch (err) {
    console.warn('[research] extraction failed', err)
    return { research: emptyResearch(today), cacheable: false, warning: "Extraction de la recherche entreprise impossible" }
  }

  const siteUrls = new Set(site.map(r => r.url))
  const allUrls = new Set([...siteUrls, ...news.map(r => r.url)])

  const valeurs: CompanyValue[] = (Array.isArray(parsed.valeurs) ? parsed.valeurs : [])
    .filter((v: any) => typeof v?.valeur === 'string' && v.valeur.trim() && siteUrls.has(v?.source_url))
    .slice(0, 5)
    .map((v: any) => ({ valeur: v.valeur.trim(), source_url: v.source_url }))

  const actualites: CompanyNews[] = (Array.isArray(parsed.actualites) ? parsed.actualites : [])
    .filter((a: any) => typeof a?.resume === 'string' && a.resume.trim() && allUrls.has(a?.source_url))
    .slice(0, 4)
    .map((a: any) => ({
      resume: a.resume.trim(),
      date: typeof a.date === 'string' && /^\d{4}-\d{2}/.test(a.date) ? a.date.slice(0, 7) : null,
      source_url: a.source_url,
    }))

  const statut = computeStatut(valeurs, actualites)
  const perimetre = typeof parsed.perimetre === 'string' && parsed.perimetre.trim() ? parsed.perimetre.trim() : null

  return {
    research: { statut, date_recherche: today, perimetre, valeurs, actualites },
    cacheable: statut !== 'insuffisante',
  }
}
