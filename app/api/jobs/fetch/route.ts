export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { fetchJSearch } from '@/lib/scrapers/jsearch'
import { fetchEures } from '@/lib/scrapers/eures'
import { fetchFranceTravail } from '@/lib/scrapers/france-travail'
import { fetchAdzuna } from '@/lib/scrapers/adzuna'
import { fetchJooble } from '@/lib/scrapers/jooble'
import { fetchReed } from '@/lib/scrapers/reed'
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
    const exclusions = (profile.mots_cles_exclus ?? []).map(k => k.toLowerCase())
    const locations = profile.localisations?.length ? profile.localisations : [{ ville: 'Lille', rayon_km: 30, pays: 'fr' }]
    const typeContrats = profile.type_contrat ?? []

    // Detect work-time preference from exclusions → passed to FT API as tempsPlein filter
    const excludesTempsPlein = exclusions.some(e => e.includes('temps plein'))
    const excludesTempsPartiel = exclusions.some(e => e.includes('temps partiel'))
    const tempsPleinFilter: boolean | undefined =
      excludesTempsPlein ? false : excludesTempsPartiel ? true : undefined

    console.log('[jobs/fetch] Fetching', { keywords: keywordsList, locations, typeContrats, tempsPleinFilter })

    // Wrap each scraper in a 7s timeout to prevent slow sources from blocking
    const withTimeout = <T>(p: Promise<T>, ms = 7000): Promise<T> =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

    const JOOBLE_COUNTRIES = ['uk', 'de', 'es', 'be']

    // JSearch, EURES, and Adzuna fire for every location (multi-country);
    // France Travail is a French-market-only API and only fires when the
    // location's country is France. Jooble fires only for its 4 supported
    // non-French countries (separate API key per country). Reed fires only
    // for uk (UK-only job board).
    // Qualifications are profile metadata only — not appended to queries
    const taggedPromises = locations.flatMap(loc => {
      const country = (loc.pays ?? 'fr').toLowerCase()
      const isFrance = country === 'fr'
      return keywordsList.flatMap(kw => {
        const entries: [string, Promise<ScrapedJob[]>][] = [
          ['jsearch', withTimeout(fetchJSearch(kw, loc.ville, [], country), 15000)],
          ['eures', withTimeout(fetchEures(kw, country), 10000)],
          ['adzuna', withTimeout(fetchAdzuna(kw, loc.ville, country), 7000)],
        ]
        if (isFrance) {
          entries.push(
            ['france_travail', withTimeout(fetchFranceTravail(kw, loc.ville, typeContrats, tempsPleinFilter), 7000)],
          )
        }
        if (JOOBLE_COUNTRIES.includes(country)) {
          entries.push(['jooble', withTimeout(fetchJooble(kw, loc.ville, country), 7000)])
        }
        if (country === 'uk') {
          entries.push(['reed', withTimeout(fetchReed(kw, loc.ville), 7000)])
        }
        return entries
      })
    })

    const settled = await Promise.allSettled(taggedPromises.map(([, p]) => p))

    const allJobs: ScrapedJob[] = settled.flatMap((r, i) => {
      if (r.status === 'fulfilled') return r.value
      const [source] = taggedPromises[i]
      if ((r as PromiseRejectedResult).reason) {
        results.errors.push(`${source}: ${(r as PromiseRejectedResult).reason}`)
      }
      return []
    })

    console.log('[jobs/fetch] Scrape results', {
      total: allJobs.length,
      bySource: allJobs.reduce((acc, j) => { acc[j.source] = (acc[j.source] ?? 0) + 1; return acc }, {} as Record<string, number>),
    })

    // Apply exclusion filter — checks title, company, contract type, and work-time fields
    const excluded = exclusions.length > 0
      ? allJobs.filter(job => {
          const rawData = job.raw_data as Record<string, unknown> | undefined
          const workTime = [
            rawData?.dureeTravailLibelleConverti,
            rawData?.dureeTravailLibelle,
            rawData?.employment_type,
          ].filter(Boolean).join(' ')
          const text = [job.titre, job.entreprise, job.type_contrat, workTime]
            .filter(Boolean).join(' ').toLowerCase()
          return !exclusions.some(ex => text.includes(ex))
        })
      : allJobs

    // Deduplicate by lien (URL)
    const seenLinks = new Set<string>()
    const uniqueJobs = excluded.filter(job => {
      if (!job.lien) return true
      if (seenLinks.has(job.lien)) return false
      seenLinks.add(job.lien)
      return true
    })

    // Batch upsert in chunks of 100 — ignore duplicates on lien unique constraint
    const rows = uniqueJobs.map(job => ({
      user_id: profile.user_id,
      titre: job.titre,
      entreprise: job.entreprise,
      lien: job.lien,
      localisation: job.localisation,
      source: job.source,
      type_contrat: job.type_contrat,
      salaire_min: job.salaire_min,
      salaire_max: job.salaire_max,
      statut: 'non_traite' as const,
      raw_data: job.raw_data,
    }))

    const CHUNK = 100
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { error, data } = await (supabase as any)
        .from('offers')
        .upsert(chunk, { onConflict: 'lien', ignoreDuplicates: true })
        .select('id')

      // 42P10 = no unique constraint on lien — fall back to manual dedup + insert
      if (error?.code === '42P10') {
        const liens = chunk.map((r: { lien: string | null }) => r.lien).filter(Boolean) as string[]
        const { data: existing } = await supabase.from('offers').select('lien').in('lien', liens)
        const existingSet = new Set((existing ?? []).map((r: { lien: string }) => r.lien))
        const fresh = chunk.filter((r: { lien: string | null }) => !r.lien || !existingSet.has(r.lien))
        if (fresh.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await (supabase as any).from('offers').insert(fresh).select('id')
          error = res.error
          data = res.data
        } else {
          error = null
          data = []
        }
      }

      if (error) {
        results.errors.push(`upsert: ${error.message}`)
      } else {
        const inserted = (data as { id: string }[] | null)?.length ?? 0
        results.inserted += inserted
        results.skipped += chunk.length - inserted
      }
    }
  }

  console.log('[jobs/fetch] Done', { ...results, totalMs: Date.now() - t0 })
  return NextResponse.json({ fetched: results })
}
