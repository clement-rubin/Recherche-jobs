import type { ScrapedJob } from './jsearch'
import type { SearchProfile } from '../supabase/types'

// Aggregators (JSearch/APEC/EURES) sometimes surface listings whose posting
// has since closed. If the source gives us a date, we use it to drop those
// before they reach the user.
const STALE_DAYS = 60

const POSTED_DATE_FIELDS = [
  'job_posted_at_datetime_utc', // jsearch
  'dateActualisation', // france_travail / apec
  'dateCreation', // france_travail / apec
  'datePublication', // apec
]

function parseDate(raw: Record<string, unknown> | undefined, field: string): Date | null {
  const v = raw?.[field]
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export function isExpiredOrStale(job: ScrapedJob, now: Date = new Date()): boolean {
  const raw = job.raw_data as Record<string, unknown> | undefined

  const expiration = parseDate(raw, 'job_offer_expiration_datetime_utc')
  if (expiration && expiration.getTime() < now.getTime()) return true

  for (const field of POSTED_DATE_FIELDS) {
    const posted = parseDate(raw, field)
    if (posted) {
      return now.getTime() - posted.getTime() > STALE_DAYS * 24 * 60 * 60 * 1000
    }
  }

  return false // no date info available — can't judge, keep it
}

const CONTRACT_KEYWORDS: Record<string, string[]> = {
  stage: ['stage', 'stagiaire', 'internship', 'intern'],
  cdi: ['cdi', 'permanent', 'indéterminée', 'indeterminee'],
  cdd: ['cdd', 'déterminée', 'determinee', 'temporary', 'fixed-term'],
  alternance: ['alternance', 'apprentissage', 'apprenticeship'],
  interim: ['intérim', 'interim', 'temp'],
}

export function matchesContractType(job: ScrapedJob, allowedTypes: string[]): boolean {
  if (allowedTypes.length === 0) return true
  const jobType = job.type_contrat?.toLowerCase()
  if (!jobType) return true // unknown — can't judge, keep it

  return allowedTypes.some(allowed => {
    const keywords = CONTRACT_KEYWORDS[allowed.toLowerCase()] ?? [allowed.toLowerCase()]
    return keywords.some(kw => jobType.includes(kw))
  })
}

export function matchesSalary(job: ScrapedJob, minSalary: number | null): boolean {
  if (!minSalary) return true
  if (job.salaire_max == null) return true // unknown — can't judge, keep it
  return job.salaire_max >= minSalary
}

export function filterMatchingProfile(
  jobs: ScrapedJob[],
  profile: SearchProfile,
  now: Date = new Date()
): ScrapedJob[] {
  const allowedTypes = profile.type_contrat ?? []
  return jobs.filter(job =>
    !isExpiredOrStale(job, now) &&
    matchesContractType(job, allowedTypes) &&
    matchesSalary(job, profile.salaire_min)
  )
}
