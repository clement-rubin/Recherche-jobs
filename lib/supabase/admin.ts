import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Service-role client: bypasses RLS, must only ever be used server-side for
// operations that can't go through the public anon-key client — currently
// just the quota RPC in lib/scrapers/quota.ts. Never import this from
// client-side ('use client') code.
export const createAdminSupabase = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
