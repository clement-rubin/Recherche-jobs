import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Count offers by source for this month and all time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allOffers } = await (supabase as any)
    .from('offers')
    .select('source, date_scraped')
    .eq('user_id', user.id) as { data: Array<{ source: string; date_scraped: string }> | null }

  const sources = ['jsearch', 'apec', 'hellowork', 'france_travail']
  const stats: Record<string, { total: number; this_month: number; this_week: number }> = {}

  for (const src of sources) {
    const rows = (allOffers ?? []).filter(o => o.source === src)
    stats[src] = {
      total: rows.length,
      this_month: rows.filter(o => o.date_scraped >= monthStart).length,
      this_week: rows.filter(o => o.date_scraped >= weekStart).length,
    }
  }

  // Estimate JSearch API calls: each offer comes from 1 API call,
  // but each call returns multiple results. We track by distinct scrape days instead.
  const jsearchDays = new Set(
    (allOffers ?? [])
      .filter(o => o.source === 'jsearch')
      .map(o => o.date_scraped?.slice(0, 10))
      .filter(Boolean)
  )
  const jsearchDaysMonth = new Set(
    (allOffers ?? [])
      .filter(o => o.source === 'jsearch' && o.date_scraped >= monthStart)
      .map(o => o.date_scraped?.slice(0, 10))
      .filter(Boolean)
  )

  // Get active profile keyword count for call estimate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (supabase as any)
    .from('search_profiles')
    .select('mots_cles')
    .eq('user_id', user.id)
    .eq('actif', true) as { data: Array<{ mots_cles: string[] | null }> | null }

  const avgKeywords = profiles?.reduce((s, p) => s + (p.mots_cles?.length ?? 1), 0) ?? 1
  const activeProfiles = profiles?.length ?? 0

  return NextResponse.json({
    sources: stats,
    jsearch_meta: {
      distinct_days_total: jsearchDays.size,
      distinct_days_month: jsearchDaysMonth.size,
      // Each "Lancer" = activeProfiles × avgKeywords calls to JSearch
      calls_per_run: activeProfiles * Math.max(1, avgKeywords),
      estimated_calls_month: jsearchDaysMonth.size * activeProfiles * Math.max(1, avgKeywords),
      free_quota_month: 200,
    },
    env: {
      rapidapi_key: !!process.env.RAPIDAPI_KEY,
      france_travail: !!(process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET),
      groq: !!process.env.GROQ_API_KEY,
    },
  })
}
