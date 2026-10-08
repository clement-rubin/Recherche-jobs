import Groq from 'groq-sdk'
import { PROFILE } from '@/lib/analyzer/profile'
import { groqModelParams } from '@/lib/groq-model'
import { GroqQuotaError, reserveGroqCall } from '@/lib/groq-quota'
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'
import { MAX_MESSAGE_LENGTH } from '@/lib/contacts-limits'

const MAX_PROFILE_CHARS = 12000

/**
 * Returns the profile line mentioning the candidate's school (JUNIA / ISEN), or null.
 * Done in code rather than left to the model: "same school" decides the tone, so it must be reliable.
 */
export function detectSameSchool(profil: string): string | null {
  const line = profil.split('\n').find(l => /\b(junia|isen)\b/i.test(l))
  return line ? line.trim().slice(0, 160) : null
}

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
  if (err instanceof GroqQuotaError) return new OutreachError(err.message, 429)
  // Unknown failure: surface Groq's own error (status + message, no secrets) so it can be diagnosed from the UI.
  const e = err as { name?: string; message?: string }
  const detail = [e?.name, status, e?.message].filter(Boolean).join(' ').slice(0, 300)
  return new OutreachError(`Génération du message impossible (${detail || 'erreur inconnue'})`, 502)
}


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
    await reserveGroqCall()
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

function buildSystemPrompt(sameSchoolLine: string | null): string {
  const ecoleBloc = sameSchoolLine
    ? `Cette personne est passée par la même école que le candidat (${PROFILE.ecole}) : ligne du profil « ${sameSchoolLine} ». Dis-le dès le début, simplement (ex. « je suis moi aussi passé par JUNIA ISEN »), et prends un ton plus chaleureux, comme entre anciens de la même école, tout en restant respectueux.`
    : 'Ton chaleureux mais respectueux. Ne mentionne pas d\'école commune (il n\'y en a pas).'

  return `Tu écris l'accroche LinkedIn d'un étudiant (${PROFILE.niveau} à ${PROFILE.ecole}) qui veut comprendre, en vrai, comment se passe un métier. Le message doit sonner comme écrit par un étudiant sérieux et sympathique, pas par une IA ni par un rapport universitaire.

Contenu, dans cet ordre :
1. « Bonjour <prénom>, » (vouvoiement partout, jamais « Monsieur/Madame »).
2. ${ecoleBloc}
3. UNE accroche précise sur son parcours (une mission, un projet, un changement de poste du profil), en une demi-phrase. Ne recopie ni ses technologies ni ses compétences, ne résume pas son CV, pas de liste.
4. UNE question concrète (deux au maximum) sur la réalité du poste, au choix selon son profil :
   - ce qu'on attend concrètement d'un jeune ingénieur sur ce poste, le niveau d'exigence ;
   - comment ses compétences et ses outils sont mis en place au quotidien ;
   - les outils et méthodes réellement utilisés, pas ceux des offres d'emploi.
Le message se termine sur la question, rien après.

Règles strictes :
- Maximum ${MAX_MESSAGE_LENGTH} caractères au total, message complet.
- Ne propose aucun échange, appel, café ni rendez-vous, et ne demande pas de temps : pas de « auriez-vous 15 minutes », pas de « seriez-vous disponible ».
- Ne parle jamais de stage, de recherche d'emploi, de candidature ni de dates.
- Ne cite aucune compétence du candidat : seulement « M1 Big Data IA ».
- N'invente rien qui ne soit pas dans le profil. Le profil est un copier-coller brut de la page : ignore menus, boutons, « Autres profils consultés ».
- Le message doit couler d'une seule traite, comme un message qu'on écrit vraiment : deux ou trois phrases qui s'enchaînent avec des liens naturels (« et », « du coup », « justement », « en voyant »), l'accroche amenant la question. Pas de phrases hachées ni de style télégraphique, mais pas non plus de phrase à rallonge. Mots simples. Interdits : « je me permets », « n'hésitez pas », « dans le cadre de », « je souhaiterais », « inspirent », « enrichissant », « approfondir », « bonnes pratiques », « parcours impressionnant », « ravi », « cordialement », « j'espère que vous allez bien », tirets longs (—), listes, emoji, hashtags, crochets, plus d'un point d'exclamation, signature.

Exemple de TON uniquement, pour une autre personne, ne le recopie pas :
« Bonjour Camille, je suis moi aussi passé par JUNIA ISEN et je suis aujourd'hui en M1 Big Data IA. Votre refonte du data warehouse chez Veolia m'intrigue : concrètement, qu'est-ce qu'on attend d'un jeune ingénieur sur ce genre de poste, et quels outils utilisez-vous vraiment au quotidien ? »

Retourne UNIQUEMENT du JSON : {"message": "<texte>"}`
}

async function complete(groq: Groq, messages: ChatCompletionMessageParam[]): Promise<string> {
  const completion = await groq.chat.completions.create({
    ...groqModelParams(),
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_completion_tokens: 1500,
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

async function run(groq: Groq, contact: OutreachInput): Promise<string> {
  const profil = contact.profil_texte.slice(0, MAX_PROFILE_CHARS)
  const sameSchoolLine = detectSameSchool(profil)
  console.log('[contacts-message] start', {
    ...groqModelParams(),
    sameSchool: sameSchoolLine !== null,
    profileChars: contact.profil_texte.length,
    profileCharsSent: profil.length,
    truncated: profil.length < contact.profil_texte.length,
  })

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(sameSchoolLine) },
    {
      role: 'user',
      content: `Personne à contacter : ${contact.nom}${contact.poste ? `, ${contact.poste}` : ''}${contact.entreprise ? ` chez ${contact.entreprise}` : ''}

Profil LinkedIn (texte copié) :
${profil}`,
    },
  ]

  const message = await complete(groq, messages)
  if (message.length <= MAX_MESSAGE_LENGTH) return message

  // Models are unreliable at hard length limits and LinkedIn rejects invitation notes over 300 chars: one rewrite pass.
  console.warn('[contacts-message] too long, asking for a shorter rewrite', { length: message.length, max: MAX_MESSAGE_LENGTH })
  messages.push(
    { role: 'assistant', content: JSON.stringify({ message }) },
    { role: 'user', content: `Trop long (${message.length} caractères). Réécris-le en ${MAX_MESSAGE_LENGTH} caractères maximum, même ton, en gardant la question. Retourne le même JSON.` }
  )
  return complete(groq, messages)
}
