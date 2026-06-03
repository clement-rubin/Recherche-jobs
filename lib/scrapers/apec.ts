import type { ScrapedJob } from './jsearch'

export async function fetchAPEC(keywords: string, location: string): Promise<ScrapedJob[]> {
  try {
    const res = await fetch(
      'https://www.apec.fr/cms/webservices/rechercheOffre/rechercherOffre',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          motsCles: keywords,
          lieuTravail: location,
          nombreResultatsMaximum: 20,
          typeContrat: [],
        }),
      }
    )

    if (!res.ok) return []

    const json = await res.json()
    const resultats = json.resultats ?? json.listeOffres ?? []

    return resultats.map((j: Record<string, unknown>) => ({
      titre: (j.intitule as string) ?? (j.libelleTitre as string) ?? 'Poste inconnu',
      entreprise: (j.nomSociete as string) ?? null,
      lien: j.numeroOffre
        ? `https://www.apec.fr/candidat/recherche-emploi.html/emploi/${j.numeroOffre}`
        : null,
      localisation: (j.lieuTravail as string) ?? location,
      source: 'apec',
      type_contrat: (j.libelleTypeContrat as string) ?? null,
      salaire_min: null,
      salaire_max: null,
      raw_data: j,
    }))
  } catch {
    return []
  }
}
