import * as cheerio from 'cheerio'
import { BLOCKED_DOMAINS, ALLOWED_DOMAINS, TECH_KEYWORDS } from './profile'

export interface OfferData {
  titre: string
  entreprise: string
  localisation: string
  type_contrat: string
  description_brute: string
  competences_extraites: string[]
  url_source: string
  source: 'wttj' | 'france-travail' | 'autre' | 'manuel'
}

export interface BlockedResult {
  blocked: true
  domain: string
  reason: string
}

export interface RobotsCheckResult {
  requiresConfirmation: true
  domain: string
  reason: string
}

export type ExtractResult = OfferData | BlockedResult | RobotsCheckResult

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.toLowerCase() } catch { return '' }
}

function isBlocked(domain: string): boolean {
  return BLOCKED_DOMAINS.some(b => domain.includes(b))
}

function isAllowed(domain: string): boolean {
  return ALLOWED_DOMAINS.some(a => domain.includes(a))
}

async function checkRobots(url: string): Promise<{ verdict: 'allowed' | 'blocked' | 'unknown'; reason: string }> {
  try {
    const parsed = new URL(url)
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`
    const resp = await fetch(robotsUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return { verdict: 'unknown', reason: 'robots.txt inaccessible' }

    const text = await resp.text()
    const urlPath = parsed.pathname

    // Parse robots.txt: collect Disallow rules for * and Mozilla agents
    const disallowed: string[] = []
    let capture = false
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (line.startsWith('#') || !line) continue
      const [key, ...rest] = line.split(':')
      const val = rest.join(':').trim()
      if (key.toLowerCase() === 'user-agent') {
        capture = val === '*' || val.toLowerCase().includes('mozilla')
      } else if (key.toLowerCase() === 'disallow' && capture && val) {
        disallowed.push(val)
      }
    }

    const blocked = disallowed.some(p => p === '/' || urlPath.startsWith(p))
    return blocked
      ? { verdict: 'blocked', reason: `robots.txt interdit l'accès à ${urlPath}` }
      : { verdict: 'allowed', reason: "robots.txt autorise l'accès" }
  } catch (e) {
    return { verdict: 'unknown', reason: `robots.txt inaccessible : ${e}` }
  }
}

export function extractTech(text: string): string[] {
  const lower = text.toLowerCase()
  return TECH_KEYWORDS.filter(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`).test(lower)
  })
}

function guessContract(text: string): string {
  const lower = text.toLowerCase()
  if (['stage', 'stagiaire', 'internship', 'intern', 'trainee'].some(w => lower.includes(w))) return 'Stage'
  if (['alternance', 'apprentissage'].some(w => lower.includes(w))) return 'Alternance'
  if (lower.includes('cdi')) return 'CDI'
  if (lower.includes('cdd')) return 'CDD'
  return ''
}

function parseWTTJ($: ReturnType<typeof cheerio.load>, url: string): OfferData {
  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || ''
  let company = $('meta[property="og:site_name"]').attr('content') || ''
  const compTag = $('[data-testid="job-employer-name"], [class*="company-name"]').first()
  if (compTag.length) company = compTag.text().trim()
  const location = $('[data-testid="job-location"], [class*="location"]').first().text().trim()
  const contract = $('[data-testid="job-contract-type"], [class*="contract-type"]').first().text().trim()
  const descTag = $('[data-testid="job-description"], .job-description, [class*="jobDescription"]').first()
  const desc = descTag.length ? descTag.text() : $('main').text()
  return { titre: title.trim(), entreprise: company.trim(), localisation: location, type_contrat: contract, description_brute: desc, competences_extraites: extractTech(desc), url_source: url, source: 'wttj' }
}

function parseFranceTravail($: ReturnType<typeof cheerio.load>, url: string): OfferData {
  const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || ''
  const company = $('.entreprise-name, [class*="company"]').first().text().trim()
  const location = $('.lieu-travail, [class*="location"]').first().text().trim()
  const contract = $('.contrat, [class*="contract"]').first().text().trim()
  const descTag = $('.description-offre, [class*="description"], main').first()
  const desc = descTag.text()
  return { titre: title.trim(), entreprise: company.trim(), localisation: location.trim(), type_contrat: contract.trim(), description_brute: desc, competences_extraites: extractTech(desc), url_source: url, source: 'france-travail' }
}

function parseGeneric($: ReturnType<typeof cheerio.load>, url: string): OfferData {
  const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || $('h2').first().text().trim() || ''
  let company = ''
  for (const sel of ['[class*="company"]', '[class*="employer"]', '[itemprop="hiringOrganization"]', '[data-company]']) {
    const t = $(sel).first().text().trim()
    if (t) { company = t; break }
  }
  let location = ''
  for (const sel of ['[class*="location"]', '[class*="localisation"]', '[class*="city"]', '[itemprop="jobLocation"]']) {
    const t = $(sel).first().text().trim()
    if (t) { location = t; break }
  }
  let contract = ''
  for (const sel of ['[class*="contract"]', '[class*="contrat"]', '[class*="employment"]']) {
    const t = $(sel).first().text().trim()
    if (t) { contract = t; break }
  }
  const desc = $('main, article, body').first().text()
  return { titre: title.trim(), entreprise: company.trim(), localisation: location.trim(), type_contrat: contract.trim(), description_brute: desc, competences_extraites: extractTech(desc), url_source: url, source: 'autre' }
}

export async function extractOffer(
  url: string,
  options: { manualText?: string; force?: boolean } = {}
): Promise<ExtractResult> {
  const { manualText, force = false } = options
  const domain = getDomain(url)

  if (isBlocked(domain)) {
    return { blocked: true, domain, reason: 'CGU interdit le scraping automatisé' }
  }

  if (manualText) {
    const firstLine = manualText.split('\n').filter(l => l.trim())[0] || ''
    return {
      titre: firstLine,
      entreprise: '',
      localisation: '',
      type_contrat: guessContract(manualText),
      description_brute: manualText,
      competences_extraites: extractTech(manualText),
      url_source: url,
      source: 'manuel',
    }
  }

  if (!isAllowed(domain) && !force) {
    const { verdict, reason } = await checkRobots(url)
    if (verdict === 'blocked') {
      return { blocked: true, domain, reason: `robots.txt interdit l'accès (${reason})` }
    }
    if (verdict === 'unknown') {
      return { requiresConfirmation: true, domain, reason }
    }
  }

  try {
    const resp = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) {
      if ([401, 403, 429].includes(resp.status)) {
        return { blocked: true, domain, reason: `Accès bloqué par le serveur (${resp.status})` }
      }
      return { blocked: true, domain, reason: `HTTP ${resp.status}` }
    }

    const html = await resp.text()
    const $ = cheerio.load(html)
    $('script, style').remove()

    if (domain.includes('welcometothejungle.com')) return parseWTTJ($, url)
    if (domain.includes('francetravail.fr') || domain.includes('pole-emploi.fr')) return parseFranceTravail($, url)
    return parseGeneric($, url)
  } catch (e) {
    return { blocked: true, domain, reason: `Impossible d'accéder à l'URL : ${e}` }
  }
}
