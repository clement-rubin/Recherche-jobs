/**
 * @jest-environment node
 */

const mockRpc = jest.fn()
const mockSupabase = { rpc: mockRpc }

jest.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: jest.fn().mockReturnValue(mockSupabase),
}))

import { checkAndReserveQuota } from '@/lib/scrapers/quota'

describe('checkAndReserveQuota', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns true and calls reserve_api_usage with the current UTC month when quota is available', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const result = await checkAndReserveQuota('adzuna', 900)

    expect(result).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('reserve_api_usage', {
      p_source: 'adzuna',
      p_month: expect.stringMatching(/^\d{4}-\d{2}$/),
      p_cap: 900,
    })
  })

  it('returns false when the cap has already been reached', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })

    const result = await checkAndReserveQuota('adzuna', 900)

    expect(result).toBe(false)
  })

  it('fails closed (returns false) when the RPC call errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection failed' } })

    const result = await checkAndReserveQuota('adzuna', 900)

    expect(result).toBe(false)
  })
})
