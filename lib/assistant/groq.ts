import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export interface AssistantIntent {
  intent: 'update_application' | 'add_application' | 'add_note' | 'query' | 'unknown'
  confidence: number
  action: Record<string, unknown>
  message: string
  requires_confirmation: boolean
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2000
        console.warn(`[groq] 429 rate limit, retry in ${waitMs}ms`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

export async function processIntent(
  transcription: string,
  recentApplications: Array<{ id: string; entreprise: string; poste: string; statut: string }>
): Promise<AssistantIntent> {
  const completion = await callWithRetry(() => groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `Tu es Alex, coach RH professionnel. Tu aides l'utilisateur à gérer sa recherche d'emploi en France.
Tu analyses des transcriptions vocales en français et tu retournes UNIQUEMENT du JSON valide.

Format de réponse STRICT:
{
  "intent": "update_application" | "add_application" | "add_note" | "query" | "unknown",
  "confidence": <nombre entre 0 et 1>,
  "action": <objet avec les données pour exécuter l'action>,
  "message": <phrase courte de confirmation en français (1-2 phrases max)>,
  "requires_confirmation": <true si action irréversible ou ambiguë, false sinon>
}

Intents et format de action:
- update_application: { "entreprise": string, "statut"?: "en_cours"|"relance"|"termine", "resultat"?: "accepte"|"refus", "note"?: string }
- add_application: { "entreprise": string, "poste": string, "type_contrat"?: string }
- add_note: { "entreprise": string, "note": string }
- query: { "question": string }
- unknown: {}

Candidatures récentes de l'utilisateur (pour correspondance):
${JSON.stringify(recentApplications, null, 2)}

Règles importantes:
- Si une entreprise est mentionnée et correspond à une candidature récente, utilise le même nom exact
- Sois concis dans le message (pas de "Bien sûr, je vais...")
- requires_confirmation = true uniquement pour "termine" avec "resultat=refus"`,
      },
      {
        role: 'user',
        content: transcription,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 512,
  }))

  const raw = completion.choices[0].message.content
  if (!raw) throw new Error('Empty response from Groq assistant')

  let parsed: AssistantIntent
  try {
    parsed = JSON.parse(raw) as AssistantIntent
  } catch {
    throw new Error(`Invalid JSON from Groq assistant: ${raw.slice(0, 100)}`)
  }
  return parsed
}
