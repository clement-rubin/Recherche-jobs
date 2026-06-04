import Groq from 'groq-sdk'

let _groq: Groq | null = null
function getGroq(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

export interface ParsedEmail {
  type: 'offre' | 'reponse' | 'relance' | 'autre'
  resultat: 'accepte' | 'refus' | 'sans_reponse' | null
  entreprise: string | null
  poste: string | null
  lien: string | null
}

async function callGroqWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2000
        console.warn(`[parser] Groq 429, retry in ${waitMs}ms (attempt ${attempt + 1})`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

export async function parseEmailIntent(email: { sujet: string; corps: string }): Promise<ParsedEmail> {
  const completion = await callGroqWithRetry(() =>
    getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Analyse cet email dans le contexte d'une recherche d'emploi.
Retourne UNIQUEMENT du JSON valide avec exactement ces champs:
{
  "type": "offre" | "reponse" | "relance" | "autre",
  "resultat": "accepte" | "refus" | "sans_reponse" | null,
  "entreprise": string | null,
  "poste": string | null,
  "lien": string | null
}

Règles:
- type "offre": email proposant un poste ou une opportunité
- type "reponse": réponse à une candidature (positive ou négative)
- type "relance": relance pour candidature sans réponse
- type "autre": tout autre email (newsletter, spam, etc.)
- resultat uniquement pour type "reponse": "accepte" si entretien/positif, "refus" si négatif, "sans_reponse" sinon
- entreprise: nom de l'entreprise si détectable
- lien: URL de l'offre si présente dans le corps`,
        },
        {
          role: 'user',
          content: `Sujet: ${email.sujet}\n\nCorps: ${email.corps.slice(0, 3000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })
  )

  const raw = completion.choices[0].message.content
  if (!raw) throw new Error('Empty response from Groq')

  const parsed = JSON.parse(raw) as ParsedEmail
  if (parsed.type !== 'reponse') parsed.resultat = null
  return parsed
}
