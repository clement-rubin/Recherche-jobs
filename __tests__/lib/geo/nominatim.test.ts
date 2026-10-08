import { reverseGeocode, searchCity } from '@/lib/geo/nominatim'

const mockFetch = jest.fn()
beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

const ok = (body: unknown) => ({ ok: true, json: async () => body })

describe('reverseGeocode', () => {
  it('returns the city name, uppercase country and numeric coords', async () => {
    mockFetch.mockResolvedValue(ok({ lat: '50.6365', lon: '3.0635', address: { city: 'Lille', country_code: 'fr' } }))
    await expect(reverseGeocode(50.63, 3.06)).resolves.toEqual({ ville: 'Lille', pays: 'FR', lat: 50.6365, lng: 3.0635 })
    const url = String(mockFetch.mock.calls[0][0])
    expect(url).toContain('/reverse?')
    expect(url).toContain('lat=50.63')
    expect(url).toContain('lon=3.06')
  })

  it('falls back to town then village', async () => {
    mockFetch.mockResolvedValue(ok({ lat: '1', lon: '2', address: { village: 'Bondues', country_code: 'fr' } }))
    await expect(reverseGeocode(1, 2)).resolves.toMatchObject({ ville: 'Bondues' })
  })

  it('returns null on a Nominatim error payload', async () => {
    mockFetch.mockResolvedValue(ok({ error: 'Unable to geocode' }))
    await expect(reverseGeocode(0, 0)).resolves.toBeNull()
  })

  it('returns null when the request fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    await expect(reverseGeocode(0, 0)).resolves.toBeNull()
  })
})

describe('searchCity', () => {
  it('restricts to the given countries and maps results', async () => {
    mockFetch.mockResolvedValue(ok([
      { lat: '45.76', lon: '4.83', name: 'Lyon', address: { city: 'Lyon', country_code: 'fr' } },
      { lat: '0', lon: '0', name: 'Nowhere', address: {} },
    ]))
    await expect(searchCity('Lyo', ['FR', 'DE'])).resolves.toEqual([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83 }])
    const url = String(mockFetch.mock.calls[0][0])
    expect(url).toContain('/search?')
    expect(url).toContain('q=Lyo')
    expect(url).toContain('countrycodes=fr%2Cde')
  })

  it('dedupes results with the same city and country', async () => {
    const lyon = { lat: '45.76', lon: '4.83', name: 'Lyon', address: { city: 'Lyon', country_code: 'fr' } }
    mockFetch.mockResolvedValue(ok([lyon, { ...lyon, lat: '45.7' }]))
    await expect(searchCity('Lyon', ['FR'])).resolves.toHaveLength(1)
  })

  it('returns [] when the request fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) })
    await expect(searchCity('Lyon', ['FR'])).resolves.toEqual([])
  })
})
