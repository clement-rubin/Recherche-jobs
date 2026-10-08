/**
 * @jest-environment node
 */
import { offerToText, buildOfferText } from '@/lib/analysis/offer-text'
import type { Offer } from '@/lib/supabase/types'

const LONG = 'Mission de stage data. '.repeat(30) // ~690 chars

const makeOffer = (raw: Record<string, unknown> | null, over: Partial<Offer> = {}): Offer => ({
  id: 'o1', user_id: 'u1', titre: 'Data Analyst', entreprise: 'Thales', lien: null,
  salaire_min: null, salaire_max: null, localisation: 'Lille', source: 'jsearch',
  type_contrat: 'stage', statut: 'non_traite', date_scraped: '2026-10-01', raw_data: raw, ...over,
})

describe('offerToText', () => {
  it('reads JSearch job_description and expiration date', () => {
    const r = offerToText(makeOffer({ job_description: LONG, job_offer_expiration_datetime_utc: '2026-11-01T00:00:00.000Z' }))
    expect(r.sufficient).toBe(true)
    expect(r.text).toContain('Titre : Data Analyst')
    expect(r.text).toContain('Entreprise : Thales')
    expect(r.text).toContain('Date limite : 2026-11-01')
    expect(r.description).toContain('Mission de stage data.')
  })

  it('drops a malformed expiration date', () => {
    const r = offerToText(makeOffer({ job_description: LONG, job_offer_expiration_datetime_utc: '2026-02-31T00:00:00Z' }))
    expect(r.text).not.toContain('Date limite')
  })

  it('reads France Travail description', () => {
    const r = offerToText(makeOffer({ description: LONG }, { source: 'france_travail' }))
    expect(r.sufficient).toBe(true)
  })

  it('is insufficient when the description is short or missing', () => {
    expect(offerToText(makeOffer({ job_description: 'Court.' })).sufficient).toBe(false)
    expect(offerToText(makeOffer(null)).sufficient).toBe(false)
  })

  it('prefers manually pasted text', () => {
    const r = offerToText(makeOffer({ job_description: 'Court.' }), LONG)
    expect(r.sufficient).toBe(true)
    expect(r.description).toContain('Mission de stage data.')
  })
})

describe('buildOfferText', () => {
  it('truncates the description to 6000 chars', () => {
    const r = buildOfferText({ titre: 'T', description: 'x'.repeat(9000) })
    expect(r.description).toHaveLength(6000)
  })
})
