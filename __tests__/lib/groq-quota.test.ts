/**
 * @jest-environment node
 */

const mockReserve = jest.fn()
jest.mock('@/lib/scrapers/quota', () => ({ checkAndReserveQuota: (...a: unknown[]) => mockReserve(...a) }))

import { reserveGroqCall, GroqQuotaError, DEFAULT_GROQ_MONTHLY_CAP } from '@/lib/groq-quota'

describe('reserveGroqCall', () => {
  const original = process.env.GROQ_MONTHLY_CAP
  beforeEach(() => {
    mockReserve.mockReset()
    delete process.env.GROQ_MONTHLY_CAP
  })
  afterAll(() => {
    if (original === undefined) delete process.env.GROQ_MONTHLY_CAP
    else process.env.GROQ_MONTHLY_CAP = original
  })

  it('resolves and counts against the groq source with the default cap', async () => {
    mockReserve.mockResolvedValue(true)
    await expect(reserveGroqCall()).resolves.toBeUndefined()
    expect(mockReserve).toHaveBeenCalledWith('groq', DEFAULT_GROQ_MONTHLY_CAP)
  })

  it('uses GROQ_MONTHLY_CAP when set, ignores invalid values', async () => {
    mockReserve.mockResolvedValue(true)
    process.env.GROQ_MONTHLY_CAP = '50'
    await reserveGroqCall()
    expect(mockReserve).toHaveBeenLastCalledWith('groq', 50)
    process.env.GROQ_MONTHLY_CAP = 'abc'
    await reserveGroqCall()
    expect(mockReserve).toHaveBeenLastCalledWith('groq', DEFAULT_GROQ_MONTHLY_CAP)
  })

  it('throws GroqQuotaError when the cap is reached (or the counter is unavailable)', async () => {
    mockReserve.mockResolvedValue(false)
    await expect(reserveGroqCall()).rejects.toBeInstanceOf(GroqQuotaError)
  })
})
