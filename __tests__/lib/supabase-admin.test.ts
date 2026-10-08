/**
 * @jest-environment node
 */

describe('createAdminSupabase', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is not set', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    expect(() => createAdminSupabase()).toThrow('SUPABASE_SERVICE_ROLE_KEY is not set')
  })

  it('returns a client when SUPABASE_SERVICE_ROLE_KEY is set', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    const client = createAdminSupabase()
    expect(client).toBeDefined()
    expect(typeof client.from).toBe('function')
  })
})
