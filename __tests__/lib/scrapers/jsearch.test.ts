/**
 * @jest-environment node
 */

import { fetchJSearch } from '@/lib/scrapers/jsearch'

describe('fetchJSearch', () => {
  const originalFetch = global.fetch
  const originalKey = process.env.RAPIDAPI_KEY

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.RAPIDAPI_KEY = originalKey
  })

  it('defaults to country=fr when no country is passed', async () => {
    await fetchJSearch('développeur', 'Lille')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('country=fr')
  })

  it('passes a custom country through to the request URL', async () => {
    await fetchJSearch('praktikum', 'Berlin', [], 'de')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('country=de')
    expect(url).not.toContain('country=fr')
  })
})
