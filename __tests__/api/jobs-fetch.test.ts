/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  nom: 'Data/IA',
  actif: true,
  domaine: 'data_ia',
  type_contrat: [] as string[],
  mots_cles: ['data scientist', 'data engineer'],
  mots_cles_exclus: [] as string[],
  qualifications: [] as string[],
  duree_contrat: 'peu_importe',
  localisations: [
    { ville: 'Lille', rayon_km: 30 },
    { ville: 'Paris', rayon_km: 20 },
  ],
  salaire_min: null,
  created_at: '2026-08-01T00:00:00Z',
}

const rateLimitChainOnce = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}

const profilesChainOnce = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  then: (resolve: (v: { data: typeof mockProfile[]; error: null }) => void) =>
    resolve({ data: [mockProfile], error: null }),
}

const mockSupabase = {
  auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  from: jest.fn()
    .mockReturnValueOnce(rateLimitChainOnce)
    .mockReturnValueOnce(profilesChainOnce),
}

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue(mockSupabase),
}))

jest.mock('@/lib/scrapers/jsearch', () => ({ fetchJSearch: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/eures', () => ({ fetchEures: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/france-travail', () => ({ fetchFranceTravail: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/adzuna', () => ({ fetchAdzuna: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/jooble', () => ({ fetchJooble: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/reed', () => ({ fetchReed: jest.fn().mockResolvedValue([]) }))

import { POST } from '@/app/api/jobs/fetch/route'
import { fetchJSearch } from '@/lib/scrapers/jsearch'
import { fetchEures } from '@/lib/scrapers/eures'
import { fetchFranceTravail } from '@/lib/scrapers/france-travail'
import { fetchAdzuna } from '@/lib/scrapers/adzuna'
import { fetchJooble } from '@/lib/scrapers/jooble'
import { fetchReed } from '@/lib/scrapers/reed'

describe('POST /api/jobs/fetch — multi-city loop', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce(profilesChainOnce)
  })

  it('calls jsearch/eures/adzuna/france-travail once per city × keyword for French locations, skipping jooble/reed', async () => {
    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(4)
    expect(fetchEures).toHaveBeenCalledTimes(4)
    expect(fetchAdzuna).toHaveBeenCalledTimes(4)
    expect(fetchFranceTravail).toHaveBeenCalledTimes(4)
    expect(fetchJooble).not.toHaveBeenCalled()
    expect(fetchReed).not.toHaveBeenCalled()

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Lille', [], 'fr')
    expect(fetchAdzuna).toHaveBeenNthCalledWith(1, 'data scientist', 'Lille', 'fr')
    expect(fetchEures).toHaveBeenNthCalledWith(1, 'data scientist', 'fr')
  })

  it('for a German location, calls JSearch/EURES/Adzuna/Jooble but skips France Travail/Reed', async () => {
    const deProfile = {
      ...mockProfile,
      localisations: [{ ville: 'Berlin', rayon_km: 30, pays: 'de' }],
    }
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve: (v: { data: typeof deProfile[]; error: null }) => void) =>
          resolve({ data: [deProfile], error: null }),
      })

    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(2) // 2 keywords × 1 city
    expect(fetchEures).toHaveBeenCalledTimes(2)
    expect(fetchAdzuna).toHaveBeenCalledTimes(2)
    expect(fetchJooble).toHaveBeenCalledTimes(2)
    expect(fetchFranceTravail).not.toHaveBeenCalled()
    expect(fetchReed).not.toHaveBeenCalled()

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Berlin', [], 'de')
    expect(fetchJooble).toHaveBeenNthCalledWith(1, 'data scientist', 'Berlin', 'de')
  })

  it('for a UK location, calls JSearch/EURES/Adzuna/Jooble/Reed but skips France Travail', async () => {
    const ukProfile = {
      ...mockProfile,
      mots_cles: ['software engineering intern'],
      localisations: [{ ville: 'London', rayon_km: 30, pays: 'uk' }],
    }
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve: (v: { data: typeof ukProfile[]; error: null }) => void) =>
          resolve({ data: [ukProfile], error: null }),
      })

    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchAdzuna).toHaveBeenCalledTimes(1)
    expect(fetchJooble).toHaveBeenCalledTimes(1)
    expect(fetchReed).toHaveBeenCalledTimes(1)
    expect(fetchFranceTravail).not.toHaveBeenCalled()

    expect(fetchReed).toHaveBeenNthCalledWith(1, 'software engineering intern', 'London')
  })

  it('scopes country-gated sources per-location in a mixed French/German profile', async () => {
    const mixedProfile = {
      ...mockProfile,
      mots_cles: ['data scientist'],
      localisations: [
        { ville: 'Paris', rayon_km: 30, pays: 'fr' },
        { ville: 'Berlin', rayon_km: 30, pays: 'de' },
      ],
    }
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve: (v: { data: typeof mixedProfile[]; error: null }) => void) =>
          resolve({ data: [mixedProfile], error: null }),
      })

    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(2) // 1 keyword × 2 locations
    expect(fetchEures).toHaveBeenCalledTimes(2)
    expect(fetchAdzuna).toHaveBeenCalledTimes(2) // fires for both fr and de
    expect(fetchFranceTravail).toHaveBeenCalledTimes(1) // only Paris (French location)
    expect(fetchJooble).toHaveBeenCalledTimes(1) // only Berlin (de is jooble-gated)
    expect(fetchReed).not.toHaveBeenCalled() // no uk location

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Paris', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(2, 'data scientist', 'Berlin', [], 'de')
    expect(fetchJooble).toHaveBeenNthCalledWith(1, 'data scientist', 'Berlin', 'de')
  })
})
