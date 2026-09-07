import type { ScrapedJob } from './jsearch'

const EURES_SEARCH_URL = 'https://europa.eu/eures/api/jv-searchengine/public/jv-search/search'

interface EuresJobVacancy {
  title: string
  id: string
  locationMap: Record<string, string[]>
  positionOfferingCode: string | null
  employer: { name: string | null } | null
  availableLanguages: string[]
}

interface EuresSearchResponse {
  numberRecords: number
  jvs: EuresJobVacancy[]
}

export async function fetchEures(keywords: string, country: string): Promise<ScrapedJob[]> {
  let res: Response
  try {
    res = await fetch(EURES_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resultsPerPage: 25,
        page: 1,
        sortSearch: 'MOST_RECENT',
        keywords: [{ keyword: keywords, specificSearchCode: 'EVERYWHERE' }],
        publicationPeriod: null,
        occupationUris: [],
        skillUris: [],
        requiredExperienceCodes: [],
        positionScheduleCodes: [],
        sectorCodes: [],
        educationAndQualificationLevelCodes: [],
        positionOfferingCodes: ['internship'],
        locationCodes: [country.toUpperCase()],
        euresFlagCodes: [],
        otherBenefitsCodes: [],
        requiredLanguages: [],
        minNumberPost: null,
        userPreferredLanguage: null,
        requestLanguage: 'en',
        sessionId: `jobtrackeria-${Date.now()}`,
      }),
    })
  } catch (err) {
    console.warn('EURES fetch failed', err)
    return []
  }

  if (!res.ok) {
    console.warn(`EURES search failed: ${res.status}`)
    return []
  }

  let data: EuresSearchResponse
  try {
    data = await res.json()
  } catch (err) {
    console.warn('EURES response was not valid JSON', err)
    return []
  }

  if (!Array.isArray(data.jvs)) return []

  return data.jvs.map(jv => ({
    titre: jv.title ?? 'Poste inconnu',
    entreprise: jv.employer?.name ?? null,
    lien: `https://europa.eu/eures/portal/jv-se/jv-details/${jv.id}?jvDisplayLanguage=${jv.availableLanguages?.[0] ?? 'en'}`,
    localisation: Object.keys(jv.locationMap ?? {})[0] ?? country.toUpperCase(),
    source: 'eures',
    type_contrat: jv.positionOfferingCode ?? null,
    salaire_min: null,
    salaire_max: null,
    raw_data: jv as unknown as Record<string, unknown>,
  }))
}
