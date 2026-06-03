export interface ScrapedJob {
  titre: string
  entreprise: string | null
  lien: string | null
  localisation: string | null
  source: string
  type_contrat: string | null
  salaire_min: number | null
  salaire_max: number | null
  raw_data: Record<string, unknown>
}

export async function fetchJSearch(keywords: string, location: string): Promise<ScrapedJob[]> {
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('RAPIDAPI_KEY not set, skipping JSearch')
    return []
  }

  const query = `${keywords} ${location}`
  const res = await fetch(
    `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&country=fr&num_pages=2`,
    {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    }
  )

  if (!res.ok) {
    throw new Error(`JSearch failed: ${res.status}`)
  }

  const { data = [] } = await res.json()
  return data.map((j: Record<string, unknown>) => ({
    titre: (j.job_title as string) ?? 'Poste inconnu',
    entreprise: (j.employer_name as string) ?? null,
    lien: (j.job_apply_link as string) ?? null,
    localisation: (j.job_city as string) ?? location,
    source: 'jsearch',
    type_contrat: (j.job_employment_type as string) ?? null,
    salaire_min: (j.job_min_salary as number) ?? null,
    salaire_max: (j.job_max_salary as number) ?? null,
    raw_data: j,
  }))
}
