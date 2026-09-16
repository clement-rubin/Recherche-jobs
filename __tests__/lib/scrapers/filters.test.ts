import {
  isExpiredOrStale,
  matchesContractType,
  matchesSalary,
  filterMatchingProfile,
} from '@/lib/scrapers/filters'
import type { ScrapedJob } from '@/lib/scrapers/jsearch'
import type { SearchProfile } from '@/lib/supabase/types'

function job(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    titre: 'Data Analyst',
    entreprise: 'Acme',
    lien: 'https://example.com/job/1',
    localisation: 'Lille',
    source: 'jsearch',
    type_contrat: null,
    salaire_min: null,
    salaire_max: null,
    raw_data: {},
    ...overrides,
  }
}

function profile(overrides: Partial<SearchProfile> = {}): SearchProfile {
  return {
    id: 'p1',
    user_id: 'u1',
    nom: 'Data',
    actif: true,
    domaine: null,
    type_contrat: [],
    mots_cles: ['data'],
    mots_cles_exclus: [],
    qualifications: [],
    duree_contrat: 'peu_importe',
    localisations: [],
    salaire_min: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('isExpiredOrStale', () => {
  const now = new Date('2026-09-16T00:00:00Z')

  it('flags a job whose JSearch expiration date is in the past', () => {
    const j = job({ raw_data: { job_offer_expiration_datetime_utc: '2026-08-01T00:00:00Z' } })
    expect(isExpiredOrStale(j, now)).toBe(true)
  })

  it('keeps a job whose JSearch expiration date is in the future', () => {
    const j = job({ raw_data: { job_offer_expiration_datetime_utc: '2026-12-01T00:00:00Z' } })
    expect(isExpiredOrStale(j, now)).toBe(false)
  })

  it('flags a job posted more than 60 days ago (JSearch)', () => {
    const j = job({ raw_data: { job_posted_at_datetime_utc: '2026-06-01T00:00:00Z' } })
    expect(isExpiredOrStale(j, now)).toBe(true)
  })

  it('flags a job with a stale France Travail dateActualisation', () => {
    const j = job({ raw_data: { dateActualisation: '2026-05-01T00:00:00Z' } })
    expect(isExpiredOrStale(j, now)).toBe(true)
  })

  it('keeps a recently posted job', () => {
    const j = job({ raw_data: { job_posted_at_datetime_utc: '2026-09-10T00:00:00Z' } })
    expect(isExpiredOrStale(j, now)).toBe(false)
  })

  it('keeps a job with no date fields at all (unknown, cannot judge)', () => {
    const j = job({ raw_data: {} })
    expect(isExpiredOrStale(j, now)).toBe(false)
  })
})

describe('matchesContractType', () => {
  it('keeps everything when profile has no contract restriction', () => {
    expect(matchesContractType(job({ type_contrat: 'CDI' }), [])).toBe(true)
  })

  it('keeps a job with unknown contract type (cannot judge)', () => {
    expect(matchesContractType(job({ type_contrat: null }), ['stage'])).toBe(true)
  })

  it('keeps a stage job when profile wants stage', () => {
    expect(matchesContractType(job({ type_contrat: 'Stagiaire' }), ['stage'])).toBe(true)
  })

  it('drops a CDI job when profile only wants stage', () => {
    expect(matchesContractType(job({ type_contrat: 'CDI' }), ['stage'])).toBe(false)
  })
})

describe('matchesSalary', () => {
  it('keeps everything when profile has no salary floor', () => {
    expect(matchesSalary(job({ salaire_max: 100 }), null)).toBe(true)
  })

  it('keeps a job with unknown salary (cannot judge)', () => {
    expect(matchesSalary(job({ salaire_max: null }), 30000)).toBe(true)
  })

  it('drops a job paying below the profile floor', () => {
    expect(matchesSalary(job({ salaire_max: 20000 }), 30000)).toBe(false)
  })

  it('keeps a job paying at or above the profile floor', () => {
    expect(matchesSalary(job({ salaire_max: 30000 }), 30000)).toBe(true)
  })
})

describe('filterMatchingProfile', () => {
  const now = new Date('2026-09-16T00:00:00Z')

  it('drops expired, mismatched-contract, and underpaid jobs; keeps the rest', () => {
    const jobs = [
      job({ lien: 'a', raw_data: { job_offer_expiration_datetime_utc: '2026-01-01T00:00:00Z' } }),
      job({ lien: 'b', type_contrat: 'CDI' }),
      job({ lien: 'c', salaire_max: 10000 }),
      job({ lien: 'd', type_contrat: 'Stage', salaire_max: 25000 }),
    ]
    const p = profile({ type_contrat: ['stage'], salaire_min: 20000 })

    const result = filterMatchingProfile(jobs, p, now)
    expect(result.map(j => j.lien)).toEqual(['d'])
  })
})
