/**
 * @jest-environment node
 */

import { fetchJooble } from '@/lib/scrapers/jooble'

describe('fetchJooble', () => {
  const originalFetch = global.fetch
  const envKeys = ['JOOBLE_API_KEY_UK', 'JOOBLE_API_KEY_DE', 'JOOBLE_API_KEY_ES', 'JOOBLE_API_KEY_BE'] as const
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    envKeys.forEach(k => { originalEnv[k] = process.env[k] })
    process.env.JOOBLE_API_KEY_UK = 'uk-key'
    process.env.JOOBLE_API_KEY_DE = 'de-key'
    delete process.env.JOOBLE_API_KEY_ES
    delete process.env.JOOBLE_API_KEY_BE
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ jobs: [] }) })
  })

  afterEach(() => {
    global.fetch = originalFetch
    envKeys.forEach(k => { process.env[k] = originalEnv[k] })
  })

  it('returns [] without calling fetch for a country outside the supported set', async () => {
    const jobs = await fetchJooble('stage', 'Rome', 'it')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns [] without calling fetch when the country has no key configured', async () => {
    const jobs = await fetchJooble('stage', 'Madrid', 'es')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('posts to the correct regional domain with the correct key for a configured country', async () => {
    await fetchJooble('internship', 'Berlin', 'de')

    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('https://de.jooble.org/api/de-key')
  })

  it('maps a real-shaped Jooble response to ScrapedJob', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalCount: 1,
        jobs: [
          {
            title: 'Software Engineering Intern',
            company: 'Acme Ltd',
            location: 'London, UK',
            link: 'https://jooble.org/jdp/123',
            type: 'Internship',
          },
        ],
      }),
    })

    const jobs = await fetchJooble('internship', 'London', 'uk')

    expect(jobs).toEqual([
      {
        titre: 'Software Engineering Intern',
        entreprise: 'Acme Ltd',
        lien: 'https://jooble.org/jdp/123',
        localisation: 'London, UK',
        source: 'jooble',
        type_contrat: 'Internship',
        salaire_min: null,
        salaire_max: null,
        raw_data: expect.objectContaining({ title: 'Software Engineering Intern' }),
      },
    ])
  })

  it('returns [] when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    const jobs = await fetchJooble('internship', 'London', 'uk')

    expect(jobs).toEqual([])
  })

  it('returns [] when the network call rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    const jobs = await fetchJooble('internship', 'London', 'uk')

    expect(jobs).toEqual([])
  })
})
