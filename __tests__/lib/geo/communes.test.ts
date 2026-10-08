/**
 * @jest-environment node
 */

const mockFetch = jest.fn()
const ok = (body: unknown) => ({ ok: true, json: async () => body })

// Fresh module per test so the in-memory cache doesn't leak between cases
let resolveCommuneCode: typeof import('@/lib/geo/communes').resolveCommuneCode
beforeEach(async () => {
  jest.resetModules()
  mockFetch.mockReset()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  global.fetch = mockFetch as unknown as typeof fetch
  ;({ resolveCommuneCode } = await import('@/lib/geo/communes'))
})

describe('resolveCommuneCode', () => {
  it('looks up by coordinates when lat/lng are present', async () => {
    mockFetch.mockResolvedValue(ok([{ code: '59350', nom: 'Lille' }]))
    await expect(resolveCommuneCode({ ville: 'Lille', lat: 50.629, lng: 3.057 })).resolves.toBe('59350')
    const url = String(mockFetch.mock.calls[0][0])
    expect(url).toContain('https://geo.api.gouv.fr/communes?')
    expect(url).toContain('lat=50.629')
    expect(url).toContain('lon=3.057')
    expect(url).not.toContain('nom=')
  })

  it('looks up by name when coordinates are missing', async () => {
    mockFetch.mockResolvedValue(ok([{ code: '59183', nom: 'Dunkerque' }]))
    await expect(resolveCommuneCode({ ville: 'Dunkerque' })).resolves.toBe('59183')
    const url = String(mockFetch.mock.calls[0][0])
    expect(url).toContain('nom=Dunkerque')
    expect(url).toContain('boost=population')
    expect(url).toContain('limit=1')
    expect(url).not.toContain('lat=')
  })

  it.each([
    ['75056', '75101'],
    ['69123', '69381'],
    ['13055', '13201'],
  ])('maps Paris/Lyon/Marseille city code %s to arrondissement %s', async (code, expected) => {
    mockFetch.mockResolvedValue(ok([{ code, nom: 'X' }]))
    await expect(resolveCommuneCode({ ville: 'X', lat: 1, lng: 2 })).resolves.toBe(expected)
  })

  it('returns null on a non-2xx response', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) })
    await expect(resolveCommuneCode({ ville: 'Lille' })).resolves.toBeNull()
  })

  it('returns null when no commune matches', async () => {
    mockFetch.mockResolvedValue(ok([]))
    await expect(resolveCommuneCode({ ville: 'Nowhere' })).resolves.toBeNull()
  })

  it('returns null when the request throws', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    await expect(resolveCommuneCode({ ville: 'Lille', lat: 1, lng: 2 })).resolves.toBeNull()
  })

  it('passes an abort signal to fetch', async () => {
    mockFetch.mockResolvedValue(ok([{ code: '59350', nom: 'Lille' }]))
    await resolveCommuneCode({ ville: 'Lille' })
    expect(mockFetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('caches successful lookups (name key is case-insensitive)', async () => {
    mockFetch.mockResolvedValue(ok([{ code: '59350', nom: 'Lille' }]))
    await resolveCommuneCode({ ville: 'Lille' })
    await expect(resolveCommuneCode({ ville: 'LILLE' })).resolves.toBe('59350')
    await resolveCommuneCode({ ville: 'x', lat: 50.629, lng: 3.057 })
    await resolveCommuneCode({ ville: 'y', lat: 50.629, lng: 3.057 })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'))
    await expect(resolveCommuneCode({ ville: 'Lille' })).resolves.toBeNull()
    mockFetch.mockResolvedValueOnce(ok([{ code: '59350', nom: 'Lille' }]))
    await expect(resolveCommuneCode({ ville: 'Lille' })).resolves.toBe('59350')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
