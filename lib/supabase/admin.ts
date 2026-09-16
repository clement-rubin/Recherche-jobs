import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Service-role client: bypasses RLS, must only ever be used server-side for
// operations that can't go through the public anon-key client — currently
// just the Telegram webhook, which has no user session to authenticate with.
// Never import this from client-side ('use client') code.
export const createAdminSupabase = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
