/**
 * @jest-environment node
 */

import { fetchFranceTravail } from '@/lib/scrapers/france-travail'

const mockFetch = jest.fn()
const originalFetch = global.fetch

// Routes the OAuth token request and the search request to canned responses
beforeEach(() => {
  process.env.FRANCE_TRAVAIL_CLIENT_ID = 'id'
  process.env.FRANCE_TRAVAIL_CLIENT_SECRET = 'secret'
  mockFetch.mockReset().mockImplementation(async (url: string) =>
    url.includes('access_token')
      ? { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
      : { ok: true, json: async () => ({ resultats: [] }) }
  )
  global.fetch = mockFetch as unknown as typeof fetch
})

afterAll(() => {
  global.fetch = originalFetch
})

function searchParams(): URLSearchParams {
  const call = mockFetch.mock.calls.find(([url]) => String(url).includes('/offres/search'))
  return new URL(String(call![0])).searchParams
}

describe('fetchFranceTravail', () => {
  it('searches by commune + distance when an area is given, without departement', async () => {
    await fetchFranceTravail('soudeur', 'Lille', [], undefined, { commune: '59350', distanceKm: 45 })
    const p = searchParams()
    expect(p.get('commune')).toBe('59350')
    expect(p.get('distance')).toBe('45')
    expect(p.has('departement')).toBe(false)
    expect(p.get('motsCles')).toBe('soudeur')
  })

  it.each([
    [150, '100'],
    [-5, '0'],
    [0, '0'],
    [12.7, '13'],
  ])('clamps and rounds distanceKm %p to %s', async (km, expected) => {
    await fetchFranceTravail('soudeur', 'Lille', [], undefined, { commune: '59350', distanceKm: km })
    expect(searchParams().get('distance')).toBe(expected)
  })

  it('falls back to departement from the city name without an area, and sends no distance', async () => {
    await fetchFranceTravail('soudeur', 'Lille')
    const p = searchParams()
    expect(p.get('departement')).toBe('59')
    expect(p.has('commune')).toBe(false)
    expect(p.has('distance')).toBe(false)
  })

  it('keeps contract type and work-time filters', async () => {
    await fetchFranceTravail('soudeur', 'Lille', ['cdi', 'interim'], true, { commune: '59350', distanceKm: 30 })
    const p = searchParams()
    expect(p.get('typeContrat')).toBe('CDI,MIS')
    expect(p.get('tempsPlein')).toBe('true')
  })
})
