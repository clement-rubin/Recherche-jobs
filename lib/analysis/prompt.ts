import type { TavilyResult } from './research'

export const EXTRACTION_SYSTEM = `Tu extrais des faits sur une entreprise à partir de résultats de recherche web. Réponds uniquement avec un objet JSON valide.

Format :
{
  "perimetre": "string | null",
  "valeurs": [{"valeur": "string", "source_url": "string"}],
  "actualites": [{"resume": "string", "date": "YYYY-MM | null", "source_url": "string"}]
}

Règles :
- "valeurs" : une valeur n'est retenue que si l'entreprise la formule elle-même sur une page de son propre site officiel (le domaine doit clairement appartenir à l'entreprise). N'en déduis jamais par intuition ("innovation", "esprit d'équipe"). Recopie la formulation de l'entreprise, 120 caractères maximum.
- "actualites" : projets, lancements, contrats, partenariats, levées de fonds, prix des 12 derniers mois. Un résumé factuel d'une phrase. "date" au format YYYY-MM si connue, sinon null.
- "source_url" doit être exactement une des URL fournies. N'en écris jamais d'autre.
- "perimetre" : si les résultats parlent du groupe et non de la filiale ou entité visée, indique "Groupe X" ; sinon null.
- Si rien de fiable : listes vides. N'invente rien. Ne cite aucun nom de personne.`

const formatResults = (label: string, results: TavilyResult[]) =>
  `<${label}>\n${results.map(r => `url: ${r.url}\ntitre: ${r.title}${r.published_date ? `\ndate: ${r.published_date}` : ''}\ncontenu: ${r.content}`).join('\n---\n')}\n</${label}>`

export function buildExtractionUser(company: string, site: TavilyResult[], news: TavilyResult[]): string {
  return `Entreprise : ${company}\n\n${formatResults('resultats_site', site)}\n\n${formatResults('resultats_actualites', news)}`
}
