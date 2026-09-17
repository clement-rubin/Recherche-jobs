import type { ScrapedJob } from './jsearch'

export async function fetchReed(keywords: string, location: string): Promise<ScrapedJob[]> {
  if (!process.env.REED_API_KEY) {
    console.warn('REED_API_KEY not set, skipping Reed')
    return []
  }

  try {
    // Reed uses HTTP Basic Auth with the API key as username and an empty
    // password — the only source in this pipeline that isn't a bearer token
    // or query-param key.
    const auth = Buffer.from(`${process.env.REED_API_KEY}:`).toString('base64')
    const url = `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(keywords)}&locationName=${encodeURIComponent(location)}`

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    })

    if (!res.ok) return []

    const { results = [] } = await res.json()
    return results.map((j: Record<string, unknown>) => ({
      titre: (j.jobTitle as string) ?? 'Poste inconnu',
      entreprise: (j.employerName as string) ?? null,
      lien: (j.jobUrl as string) ?? null,
      localisation: (j.locationName as string) ?? location,
      source: 'reed',
      type_contrat: null,
      salaire_min: (j.minimumSalary as number) ?? null,
      salaire_max: (j.maximumSalary as number) ?? null,
      raw_data: j,
    }))
  } catch (err) {
    console.warn('[reed] fetch error', err)
    return []
  }
}
