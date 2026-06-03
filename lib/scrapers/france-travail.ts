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

export async function fetchFranceTravail(keywords: string, commune: string): Promise<ScrapedJob[]> {
  const token = await getFranceTravailToken()
  if (!token) return []

  try {
    const params = new URLSearchParams({
      motsCles: keywords,
      lieuTravail: commune,
      distance: '30',
      nbMaxResultats: '20',
    })

    const res = await fetch(
      `https://api.emploi-store.fr/partenaire/offresdemploi/v2/offres/search?${params}`,
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
        localisation: (lieu?.libelle as string) ?? commune,
        source: 'france_travail',
        type_contrat: (j.typeContrat as string) ?? null,
        salaire_min: null,
        salaire_max: null,
        raw_data: j,
      }
    })
  } catch {
    return []
  }
}
