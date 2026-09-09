/**
 * @jest-environment node
 */

import { fetchEures } from '@/lib/scrapers/eures'

describe('fetchEures', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('maps a real-shaped EURES response to ScrapedJob', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        numberRecords: 1,
        jvs: [
          {
            title: 'Sales Trainee (m/w/d)',
            description: 'desc',
            id: 'MTIyNjUtNTE1MjYwX0pCNTIzNTA5Ny1TIDE',
            creationDate: 1788211374245,
            locationMap: { DE: ['DE300'] },
            positionOfferingCode: 'internship',
            employer: { name: 'FERCHAU Contract GmbH' },
            availableLanguages: ['de'],
          },
        ],
      }),
    })

    const jobs = await fetchEures('praktikum', 'de')

    expect(jobs).toEqual([
      {
        titre: 'Sales Trainee (m/w/d)',
        entreprise: 'FERCHAU Contract GmbH',
        lien: 'https://europa.eu/eures/portal/jv-se/jv-details/MTIyNjUtNTE1MjYwX0pCNTIzNTA5Ny1TIDE?jvDisplayLanguage=de',
        localisation: 'DE',
        source: 'eures',
        type_contrat: 'internship',
        salaire_min: null,
        salaire_max: null,
        raw_data: expect.objectContaining({ id: 'MTIyNjUtNTE1MjYwX0pCNTIzNTA5Ny1TIDE' }),
      },
    ])

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('https://europa.eu/eures/api/jv-searchengine/public/jv-search/search')
    const body = JSON.parse(init.body)
    expect(body.locationCodes).toEqual(['DE'])
    expect(body.positionOfferingCodes).toEqual(['internship'])
    expect(body.keywords).toEqual([{ keyword: 'praktikum', specificSearchCode: 'TITLE' }])
  })

  it('returns [] on a non-2xx response instead of throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })
    const jobs = await fetchEures('stage', 'fr')
    expect(jobs).toEqual([])
  })

  it('returns [] when the network call itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))
    const jobs = await fetchEures('stage', 'fr')
    expect(jobs).toEqual([])
  })

  it('returns [] when the response body is not the expected shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: true }) })
    const jobs = await fetchEures('stage', 'fr')
    expect(jobs).toEqual([])
  })

  it('maps entreprise to null when employer is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        numberRecords: 1,
        jvs: [
          {
            title: 'Sales Trainee (m/w/d)',
            id: 'MTIyNjUtNTE1MjYwX0pCNTIzNTA5Ny1TIDE',
            locationMap: { DE: ['DE300'] },
            positionOfferingCode: 'internship',
            employer: null,
            availableLanguages: ['de'],
          },
        ],
      }),
    })

    const jobs = await fetchEures('praktikum', 'de')

    expect(jobs).toHaveLength(1)
    expect(jobs[0].entreprise).toBeNull()
  })

  it('returns [] when res.json() rejects', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('bad json')),
    })
    const jobs = await fetchEures('stage', 'fr')
    expect(jobs).toEqual([])
  })
})
