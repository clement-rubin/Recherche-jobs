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
jest.mock('@/lib/scrapers/apec', () => ({ fetchAPEC: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/hellowork', () => ({ fetchHelloWork: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/france-travail', () => ({ fetchFranceTravail: jest.fn().mockResolvedValue([]) }))

import { POST } from '@/app/api/jobs/fetch/route'
import { fetchJSearch } from '@/lib/scrapers/jsearch'
import { fetchEures } from '@/lib/scrapers/eures'
import { fetchAPEC } from '@/lib/scrapers/apec'
import { fetchHelloWork } from '@/lib/scrapers/hellowork'
import { fetchFranceTravail } from '@/lib/scrapers/france-travail'

describe('POST /api/jobs/fetch — multi-city loop', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce(profilesChainOnce)
  })

  it('calls all 5 sources once per city × keyword combination for French locations', async () => {
    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(4)
    expect(fetchEures).toHaveBeenCalledTimes(4)
    expect(fetchAPEC).toHaveBeenCalledTimes(4)
    expect(fetchHelloWork).toHaveBeenCalledTimes(4)
    expect(fetchFranceTravail).toHaveBeenCalledTimes(4)

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Lille', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(2, 'data engineer', 'Lille', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(3, 'data scientist', 'Paris', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(4, 'data engineer', 'Paris', [], 'fr')

    expect(fetchEures).toHaveBeenNthCalledWith(1, 'data scientist', 'fr')
  })

  it('only calls JSearch and EURES for a non-French location, skipping APEC/HelloWork/France Travail', async () => {
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
    expect(fetchAPEC).not.toHaveBeenCalled()
    expect(fetchHelloWork).not.toHaveBeenCalled()
    expect(fetchFranceTravail).not.toHaveBeenCalled()

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Berlin', [], 'de')
    expect(fetchEures).toHaveBeenNthCalledWith(1, 'data scientist', 'de')
  })

  it('scopes French-only sources per-location in a mixed-country profile', async () => {
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
    expect(fetchAPEC).toHaveBeenCalledTimes(1) // only Paris (French location)
    expect(fetchHelloWork).toHaveBeenCalledTimes(1)
    expect(fetchFranceTravail).toHaveBeenCalledTimes(1)

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Paris', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(2, 'data scientist', 'Berlin', [], 'de')
    expect(fetchEures).toHaveBeenNthCalledWith(1, 'data scientist', 'fr')
    expect(fetchEures).toHaveBeenNthCalledWith(2, 'data scientist', 'de')
  })
})
