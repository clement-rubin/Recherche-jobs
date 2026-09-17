import { createAdminSupabase } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'

type ReserveApiUsageArgs = Database['public']['Functions']['reserve_api_usage']['Args']

export async function checkAndReserveQuota(source: string, cap: number): Promise<boolean> {
  const supabase = createAdminSupabase()
  const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM, UTC

  const args: ReserveApiUsageArgs = {
    p_source: source,
    p_month: monthKey,
    p_cap: cap,
  }

  // Cast required: lib/supabase/types.ts's table Row/Insert/Update fields are
  // built from hand-written `interface`s (and Omit<> over them), which don't
  // carry the implicit string index signature postgrest-js's Schema generic
  // constraint requires. That makes `Database['public']` fail the library's
  // internal `extends GenericSchema` check, so supabase-js falls back to
  // typing this call's second parameter as `undefined` — unrelated to
  // whether our args are correct. `args` above is still checked against the
  // real RPC signature before this cast, so a mismatch there still fails tsc.
  const { data, error } = await supabase.rpc('reserve_api_usage', args as never)

  if (error) {
    console.warn(`[quota] reserve_api_usage failed for ${source}`, error)
    return false
  }

  return data === true
}
