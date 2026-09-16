import type { ScrapedJob } from './jsearch'

const JOOBLE_DOMAINS: Record<string, string> = {
  uk: 'uk.jooble.org',
  de: 'de.jooble.org',
  es: 'es.jooble.org',
  be: 'be.jooble.org',
}

function joobleKeyFor(country: string): string | undefined {
  switch (country) {
    case 'uk': return process.env.JOOBLE_API_KEY_UK
    case 'de': return process.env.JOOBLE_API_KEY_DE
    case 'es': return process.env.JOOBLE_API_KEY_ES
    case 'be': return process.env.JOOBLE_API_KEY_BE
    default: return undefined
  }
}

export async function fetchJooble(
  keywords: string,
  location: string,
  country: string
): Promise<ScrapedJob[]> {
  const cc = country.toLowerCase()
  const domain = JOOBLE_DOMAINS[cc]
  const key = joobleKeyFor(cc)

  if (!domain || !key) {
    return []
  }

  try {
    const res = await fetch(`https://${domain}/api/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, location }),
    })

    if (!res.ok) return []

    const { jobs = [] } = await res.json()
    return jobs.map((j: Record<string, unknown>) => ({
      titre: (j.title as string) ?? 'Poste inconnu',
      entreprise: (j.company as string) ?? null,
      lien: (j.link as string) ?? null,
      localisation: (j.location as string) ?? location,
      source: 'jooble',
      type_contrat: (j.type as string) ?? null,
      salaire_min: null,
      salaire_max: null,
      raw_data: j,
    }))
  } catch (err) {
    console.warn('[jooble] fetch error', err)
    return []
  }
}
