import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { fetchJSearch } from '@/lib/scrapers/jsearch'
import { fetchAPEC } from '@/lib/scrapers/apec'
import { fetchHelloWork } from '@/lib/scrapers/hellowork'
import { fetchFranceTravail } from '@/lib/scrapers/france-travail'
import type { ScrapedJob } from '@/lib/scrapers/jsearch'
import type { SearchProfile } from '@/lib/supabase/types'

function isAuthorized(req: NextRequest, user: unknown): boolean {
  if (user) return true
  const auth = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  return !!(cronSecret && auth === `Bearer ${cronSecret}`)
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!isAuthorized(req, user)) {
    console.warn('[jobs/fetch] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user?.id
  console.log('[jobs/fetch] POST started', { userId: userId ?? 'cron' })

  // Rate limiting: check if any offer was scraped in the last 2 minutes for this user
  if (userId) {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: recentOffer } = await supabase
      .from('offers')
      .select('date_scraped')
      .eq('user_id', userId)
      .gte('date_scraped', twoMinutesAgo)
      .limit(1)
      .single()

    if (recentOffer) {
      console.warn('[jobs/fetch] Rate limited', { userId })
      return NextResponse.json(
        { error: 'Recherche déjà lancée récemment. Attendez 2 minutes.' },
        { status: 429 }
      )
    }
  }

  // Get active search profile for this user
  let profilesQuery = supabase
    .from('search_profiles')
    .select('*')
    .eq('actif', true)

  if (userId) {
    profilesQuery = profilesQuery.eq('user_id', userId)
  }

  const { data: profiles } = await profilesQuery

  if (!profiles || profiles.length === 0) {
    console.warn('[jobs/fetch] No active search profile', { userId })
    return NextResponse.json({ error: 'No active search profile found' }, { status: 400 })
  }
  console.log('[jobs/fetch] Profiles found', { count: profiles.length })

  const results = { inserted: 0, skipped: 0, errors: [] as string[] }

  for (const profile of profiles as SearchProfile[]) {
    const keywordsList = profile.mots_cles ?? ['emploi']
    const location = profile.localisation ?? 'Lille'
    const qualifications = profile.qualifications ?? []

    console.log('[jobs/fetch] Fetching', { keywords: keywordsList, location })

    // All sources: one call per keyword (OR behavior)
    // Qualifications are profile metadata only — not appended to queries
    const allPromises = keywordsList.flatMap(kw => [
      fetchJSearch(kw, location),
      fetchAPEC(kw, location),
      fetchHelloWork(kw, location),
      fetchFranceTravail(kw, location),
    ])

    const settled = await Promise.allSettled(allPromises)

    const allJobs: ScrapedJob[] = settled.flatMap((r, i) => {
      if (r.status === 'fulfilled') return r.value
      const source = ['jsearch', 'apec', 'hellowork', 'france_travail'][i % 4]
      if ((r as PromiseRejectedResult).reason) {
        results.errors.push(`${source}: ${(r as PromiseRejectedResult).reason}`)
      }
      return []
    })

    console.log('[jobs/fetch] Scrape results', {
      total: allJobs.length,
      bySource: allJobs.reduce((acc, j) => { acc[j.source] = (acc[j.source] ?? 0) + 1; return acc }, {} as Record<string, number>),
    })

    // Deduplicate by lien (URL)
    const seenLinks = new Set<string>()
    const uniqueJobs = allJobs.filter(job => {
      if (!job.lien) return true // Keep jobs without link
      if (seenLinks.has(job.lien)) return false
      seenLinks.add(job.lien)
      return true
    })

    // Batch insert, ignore duplicates (unique constraint on lien)
    for (const job of uniqueJobs) {
      const { error } = await supabase
        .from('offers')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({
          user_id: profile.user_id,
          titre: job.titre,
          entreprise: job.entreprise,
          lien: job.lien,
          localisation: job.localisation,
          source: job.source,
          type_contrat: job.type_contrat,
          salaire_min: job.salaire_min,
          salaire_max: job.salaire_max,
          statut: 'non_traite',
          raw_data: job.raw_data,
        // Supabase generated types may not include all fields; cast to any for insert
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

      if (error) {
        // Duplicate link (unique constraint) — expected, skip
        if (error.code !== '23505') results.errors.push(`insert: ${error.message}`)
        results.skipped++
      } else {
        results.inserted++
      }
    }
  }

  console.log('[jobs/fetch] Done', { ...results, totalMs: Date.now() - t0 })
  return NextResponse.json({ fetched: results })
}
