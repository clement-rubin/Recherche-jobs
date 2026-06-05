import type { ScrapedJob } from './jsearch'

let ftTokenCache: { token: string; expires: number } | null = null

async function getFranceTravailToken(): Promise<string | null> {
  if (ftTokenCache && ftTokenCache.expires > Date.now()) {
    return ftTokenCache.token
  }

  if (!process.env.FRANCE_TRAVAIL_CLIENT_ID || !process.env.FRANCE_TRAVAIL_CLIENT_SECRET) {
    console.warn('France Travail credentials not set')
    return null
  }

  try {
    const res = await fetch(
      'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=partenaire',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.FRANCE_TRAVAIL_CLIENT_ID,
          client_secret: process.env.FRANCE_TRAVAIL_CLIENT_SECRET,
          scope: 'api_offresdemploiv2 o2dsoffre',
        }),
      }
    )

    if (!res.ok) return null

    const { access_token, expires_in } = await res.json()
    ftTokenCache = {
      token: access_token,
      expires: Date.now() + expires_in * 1000 - 5000,
    }
    return access_token
  } catch {
    return null
  }
}

// Maps app contract types to France Travail typeContrat codes
const CONTRACT_TYPE_MAP: Record<string, string> = {
  interim: 'MIS',
  cdi: 'CDI',
  cdd: 'CDD',
  alternance: 'CNA',
  stage: 'PRO',
}

// Maps common French cities to their department code (used as fallback when no INSEE commune code)
const CITY_TO_DEPT: Record<string, string> = {
  lille: '59',
  paris: '75',
  lyon: '69',
  marseille: '13',
  toulouse: '31',
  bordeaux: '33',
  nantes: '44',
  strasbourg: '67',
  rennes: '35',
  grenoble: '38',
  montpellier: '34',
  nice: '06',
  rouen: '76',
  toulon: '83',
  douai: '59',
  valenciennes: '59',
  roubaix: '59',
  tourcoing: '59',
  amiens: '80',
  reims: '51',
  metz: '57',
  nancy: '54',
  dijon: '21',
  clermont: '63',
  'clermont-ferrand': '63',
  brest: '29',
  le: '72', // Le Mans
  caen: '14',
  limoges: '87',
  besancon: '25',
  tours: '37',
  angers: '49',
  perpignan: '66',
  orléans: '45',
  orleans: '45',
}

function cityToDept(city: string): string | null {
  const normalized = city.toLowerCase().trim().replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a')
  return CITY_TO_DEPT[normalized] ?? null
}

export async function fetchFranceTravail(
  keywords: string,
  location: string,
  typeContrats?: string[]
): Promise<ScrapedJob[]> {
  const token = await getFranceTravailToken()
  if (!token) return []

  try {
    const params: Record<string, string> = {
      motsCles: keywords,
      distance: '30',
      nbMaxResultats: '20',
    }

    const dept = cityToDept(location)
    if (dept) {
      params.departement = dept
    }

    if (typeContrats && typeContrats.length > 0) {
      const ftCodes = typeContrats
        .map(t => CONTRACT_TYPE_MAP[t.toLowerCase()])
        .filter(Boolean)
      if (ftCodes.length > 0) {
        params.typeContrat = ftCodes.join(',')
      }
    }

    const res = await fetch(
      `https://api.emploi-store.fr/partenaire/offresdemploi/v2/offres/search?${new URLSearchParams(params)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    )

    if (!res.ok) return []

    const { resultats = [] } = await res.json()
    return resultats.map((j: Record<string, unknown>) => {
      const lieu = j.lieuTravail as Record<string, unknown> | undefined
      const entreprise = j.entreprise as Record<string, unknown> | undefined
      const origine = j.origineOffre as Record<string, unknown> | undefined

      return {
        titre: (j.intitule as string) ?? 'Poste inconnu',
        entreprise: (entreprise?.nom as string) ?? null,
        lien: (origine?.urlOrigine as string) ?? null,
        localisation: (lieu?.libelle as string) ?? location,
        source: 'france_travail',
        type_contrat: (j.typeContratLibelle as string) ?? (j.typeContrat as string) ?? null,
        salaire_min: null,
        salaire_max: null,
        raw_data: j,
      }
    })
  } catch {
    return []
  }
}
