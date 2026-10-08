import Groq from 'groq-sdk'
import { PROFILE } from '@/lib/analyzer/profile'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

import { MAX_MESSAGE_LENGTH } from '@/lib/contacts-limits'

export interface OutreachInput {
  nom: string
  poste: string | null
  entreprise: string | null
  profil_texte: string
}

export async function generateOutreachMessage(contact: OutreachInput): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
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
${contact.profil_texte.slice(0, 12000)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_tokens: 400,
  })

  const raw = completion.choices[0].message.content
  if (!raw) throw new Error('Réponse vide du modèle')
  let message: unknown
  try {
    message = JSON.parse(raw).message
  } catch {
    throw new Error('Réponse invalide du modèle')
  }
  if (typeof message !== 'string' || !message.trim()) throw new Error('Réponse invalide du modèle')
  return message.trim()
}
