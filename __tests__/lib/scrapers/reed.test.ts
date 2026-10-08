/**
 * @jest-environment node
 */

import { fetchReed } from '@/lib/scrapers/reed'

describe('fetchReed', () => {
  const originalFetch = global.fetch
  const originalKey = process.env.REED_API_KEY

  beforeEach(() => {
    process.env.REED_API_KEY = 'test-reed-key'
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.REED_API_KEY = originalKey
  })

  it('returns [] without calling fetch when REED_API_KEY is missing', async () => {
    delete process.env.REED_API_KEY

    const jobs = await fetchReed('developer', 'London')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sends the API key as Basic Auth username with an empty password', async () => {
    await fetchReed('developer', 'London')

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const expectedAuth = `Basic ${Buffer.from('test-reed-key:').toString('base64')}`
    expect(init.headers.Authorization).toBe(expectedAuth)
  })

  it('maps a real-shaped Reed response to ScrapedJob', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            jobId: 123,
            employerName: 'Acme Ltd',
            jobTitle: 'Graduate Software Engineer',
            locationName: 'London',
            jobUrl: 'https://www.reed.co.uk/jobs/123',
            minimumSalary: 28000,
            maximumSalary: 32000,
          },
        ],
      }),
    })

    const jobs = await fetchReed('developer', 'London')

    expect(jobs).toEqual([
      {
        titre: 'Graduate Software Engineer',
        entreprise: 'Acme Ltd',
        lien: 'https://www.reed.co.uk/jobs/123',
        localisation: 'London',
        source: 'reed',
        type_contrat: null,
        salaire_min: 28000,
        salaire_max: 32000,
        raw_data: expect.objectContaining({ jobId: 123 }),
      },
    ])
  })

  it('returns [] when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 })

    const jobs = await fetchReed('developer', 'London')

    expect(jobs).toEqual([])
  })

  it('returns [] when the network call rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    const jobs = await fetchReed('developer', 'London')

    expect(jobs).toEqual([])
  })
})
