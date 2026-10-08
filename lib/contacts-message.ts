import Groq from 'groq-sdk'
import { PROFILE } from '@/lib/analyzer/profile'

const MODEL = 'llama-3.3-70b-versatile'
const MAX_PROFILE_CHARS = 12000

/** Error whose message is safe to show to the user. */
export class OutreachError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function toOutreachError(err: unknown): OutreachError {
  const status = (err as { status?: number })?.status
  if (status === 401 || status === 403) return new OutreachError('Clé GROQ_API_KEY invalide ou refusée', 502)
  if (status === 429) return new OutreachError('Limite Groq atteinte, réessaie dans une minute', 429)
  if (status === 413) return new OutreachError('Profil collé trop long, raccourcis-le', 413)
  if (err instanceof OutreachError) return err
  // Unknown failure: surface Groq's own error (status + message, no secrets) so it can be diagnosed from the UI.
  const e = err as { name?: string; message?: string }
  const detail = [e?.name, status, e?.message].filter(Boolean).join(' ').slice(0, 300)
  return new OutreachError(`Génération du message impossible (${detail || 'erreur inconnue'})`, 502)
}

import { MAX_MESSAGE_LENGTH } from '@/lib/contacts-limits'

export interface OutreachInput {
  nom: string
  poste: string | null
  entreprise: string | null
  profil_texte: string
}

export async function generateOutreachMessage(contact: OutreachInput): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('[contacts-message] GROQ_API_KEY missing from environment')
    throw new OutreachError('GROQ_API_KEY non configurée sur le serveur', 500)
  }
  const groq = new Groq({ apiKey })
  const t0 = Date.now()
  try {
    const message = await run(groq, contact)
    console.log('[contacts-message] done', { ms: Date.now() - t0, messageLength: message.length, overLimit: message.length > MAX_MESSAGE_LENGTH })
    return message
  } catch (err) {
    const e = err as { status?: number; name?: string; message?: string; error?: unknown }
    console.error('[contacts-message] failed', {
      ms: Date.now() - t0,
      name: e?.name,
      status: e?.status,
      message: e?.message,
      // Groq API error body (e.g. rate-limit type, request too large) — no secrets in it
      body: e?.error,
    })
    throw toOutreachError(err)
  }
}

async function run(groq: Groq, contact: OutreachInput): Promise<string> {
  const profil = contact.profil_texte.slice(0, MAX_PROFILE_CHARS)
  console.log('[contacts-message] start', {
    model: MODEL,
    profileChars: contact.profil_texte.length,
    profileCharsSent: profil.length,
    truncated: profil.length < contact.profil_texte.length,
  })
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `Tu rédiges des messages d'accroche LinkedIn en français pour un étudiant en recherche de stage.
Candidat : ${PROFILE.niveau}, compétences : ${PROFILE.competences.join(', ')}. Période de stage : ${PROFILE.periode_debut} à ${PROFILE.periode_fin}.

Règles :
- Maximum ${MAX_MESSAGE_LENGTH} caractères, message complet (pas de tronquage).
- Le profil est un copier-coller brut de la page LinkedIn : ignore le bruit (menus, boutons, "Autres profils consultés", publicités, suggestions) et ne garde que le parcours de la personne.
- Appuie-toi sur UNE ou DEUX expériences précises tirées du profil fourni (entreprise, mission, techno) et fais le lien avec le parcours du candidat. N'invente rien qui n'est pas dans le profil.
- Ton naturel et poli, vouvoiement, pas de flatterie creuse, pas de formule "j'espère que vous allez bien".
- Termine par une demande simple (échange de 15 minutes ou conseil), pas par une demande directe de stage.
- Pas d'emoji, pas de hashtag, pas de placeholder entre crochets. Signe sans nom (le nom est déjà dans LinkedIn).
Retourne UNIQUEMENT du JSON : {"message": "<texte>"}`,
      },
      {
        role: 'user',
        content: `Personne à contacter : ${contact.nom}${contact.poste ? `, ${contact.poste}` : ''}${contact.entreprise ? ` chez ${contact.entreprise}` : ''}

Profil LinkedIn (texte copié) :
${profil}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_tokens: 400,
  })

  const choice = completion.choices[0]
  const raw = choice?.message?.content
  console.log('[contacts-message] groq response', {
    model: completion.model,
    finishReason: choice?.finish_reason,
    usage: completion.usage,
    rawLength: raw?.length ?? 0,
  })
  if (!raw) throw new OutreachError('Réponse vide du modèle, réessaie', 502)
  let message: unknown
  try {
    message = JSON.parse(raw).message
  } catch {
    console.error('[contacts-message] JSON parse failed, raw:', raw.slice(0, 200))
    throw new OutreachError('Réponse invalide du modèle, réessaie', 502)
  }
  if (typeof message !== 'string' || !message.trim()) {
    console.error('[contacts-message] missing "message" field, raw:', raw.slice(0, 200))
    throw new OutreachError('Réponse invalide du modèle, réessaie', 502)
  }
  return message.trim()
}
