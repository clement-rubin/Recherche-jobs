import type { ScrapedJob } from './jsearch'
import { checkAndReserveQuota } from './quota'

const ADZUNA_COUNTRY_SLUGS: Record<string, string> = {
  fr: 'fr',
  uk: 'gb',
  de: 'de',
  es: 'es',
  be: 'be',
}

export async function fetchAdzuna(
  keywords: string,
  location: string,
  country: string
): Promise<ScrapedJob[]> {
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
    console.warn('ADZUNA_APP_ID/ADZUNA_APP_KEY not set, skipping Adzuna')
    return []
  }

  const cap = Number(process.env.ADZUNA_MONTHLY_CAP ?? '900')
  const allowed = await checkAndReserveQuota('adzuna', cap)
  if (!allowed) {
    console.warn('[adzuna] monthly quota cap reached, skipping call')
    return []
  }

  const slug = ADZUNA_COUNTRY_SLUGS[country.toLowerCase()] ?? country.toLowerCase()

  try {
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/${slug}/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_APP_KEY}&results_per_page=20&what=${encodeURIComponent(keywords)}&where=${encodeURIComponent(location)}`
    )

    if (!res.ok) return []

    const { results = [] } = await res.json()
    return results.map((j: Record<string, unknown>) => {
      const company = j.company as Record<string, unknown> | undefined
      const jobLocation = j.location as Record<string, unknown> | undefined
      return {
        titre: (j.title as string) ?? 'Poste inconnu',
        entreprise: (company?.display_name as string) ?? null,
        lien: (j.redirect_url as string) ?? null,
        localisation: (jobLocation?.display_name as string) ?? location,
        source: 'adzuna',
        type_contrat: (j.contract_type as string) ?? null,
        salaire_min: (j.salary_min as number) ?? null,
        salaire_max: (j.salary_max as number) ?? null,
        raw_data: j,
      }
    })
  } catch (err) {
    console.warn('[adzuna] fetch error', err)
    return []
  }
}
