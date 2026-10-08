import type { Offer } from '@/lib/supabase/types'
import { isValidIsoDate } from './priority'

const DESCRIPTION_KEYS = ['job_description', 'description', 'descriptif', 'summary'] as const
const MIN_DESCRIPTION_CHARS = 300
const MAX_DESCRIPTION_CHARS = 6000

export interface OfferTextParts {
  titre: string
  entreprise?: string | null
  lieu?: string | null
  contrat?: string | null
  dateLimite?: string | null
  description: string
}

export interface OfferText {
  text: string
  description: string
  sufficient: boolean
}

export function buildOfferText(p: OfferTextParts): OfferText {
  const description = p.description.replace(/[ \t]+\n/g, '\n').trim().slice(0, MAX_DESCRIPTION_CHARS)
  const header = [
    `Titre : ${p.titre}`,
    p.entreprise && `Entreprise : ${p.entreprise}`,
    p.lieu && `Lieu : ${p.lieu}`,
    p.contrat && `Contrat : ${p.contrat}`,
    p.dateLimite && `Date limite : ${p.dateLimite}`,
  ].filter(Boolean).join('\n')
  return {
    text: `${header}\n\n${description}`,
    description,
    sufficient: description.length >= MIN_DESCRIPTION_CHARS,
  }
}

export function offerToText(offer: Offer, manualText?: string): OfferText {
  const raw = (offer.raw_data ?? {}) as Record<string, unknown>
  let description = manualText?.trim() ?? ''
  if (!description) {
    for (const key of DESCRIPTION_KEYS) {
      const v = raw[key]
      if (typeof v === 'string' && v.trim()) { description = v; break }
    }
  }
  const exp = raw.job_offer_expiration_datetime_utc
  const expDay = typeof exp === 'string' ? exp.slice(0, 10) : null
  const dateLimite = expDay && isValidIsoDate(expDay) ? expDay : null
  return buildOfferText({
    titre: offer.titre,
    entreprise: offer.entreprise,
    lieu: offer.localisation,
    contrat: offer.type_contrat,
    dateLimite,
    description,
  })
}
