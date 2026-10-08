/**
 * @jest-environment node
 */

jest.mock('@/lib/scrapers/quota', () => ({ checkAndReserveQuota: jest.fn() }))

import { fetchAdzuna } from '@/lib/scrapers/adzuna'
import { checkAndReserveQuota } from '@/lib/scrapers/quota'

describe('fetchAdzuna', () => {
  const originalFetch = global.fetch
  const originalAppId = process.env.ADZUNA_APP_ID
  const originalAppKey = process.env.ADZUNA_APP_KEY

  beforeEach(() => {
    process.env.ADZUNA_APP_ID = 'test-id'
    process.env.ADZUNA_APP_KEY = 'test-key'
    ;(checkAndReserveQuota as jest.Mock).mockResolvedValue(true)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.ADZUNA_APP_ID = originalAppId
    process.env.ADZUNA_APP_KEY = originalAppKey
    jest.clearAllMocks()
  })

  it('returns [] without calling fetch when ADZUNA_APP_ID is missing', async () => {
    delete process.env.ADZUNA_APP_ID

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns [] without calling fetch when the quota check denies the call', async () => {
    ;(checkAndReserveQuota as jest.Mock).mockResolvedValue(false)

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("maps the uk country code to Adzuna's gb slug", async () => {
    await fetchAdzuna('intern', 'London', 'uk')

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('/v1/api/jobs/gb/search/1')
  })

  it('maps a real-shaped Adzuna response to ScrapedJob', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            title: 'Ingénieur logiciel',
            company: { display_name: 'Acme' },
            location: { display_name: 'Lille, France' },
            redirect_url: 'https://adzuna.fr/job/123',
            contract_type: 'permanent',
            salary_min: 35000,
            salary_max: 42000,
          },
        ],
      }),
    })

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([
      {
        titre: 'Ingénieur logiciel',
        entreprise: 'Acme',
        lien: 'https://adzuna.fr/job/123',
        localisation: 'Lille, France',
        source: 'adzuna',
        type_contrat: 'permanent',
        salaire_min: 35000,
        salaire_max: 42000,
        raw_data: expect.objectContaining({ title: 'Ingénieur logiciel' }),
      },
    ])
  })

  it('returns [] when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([])
  })

  it('returns [] when the network call rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([])
  })
})
