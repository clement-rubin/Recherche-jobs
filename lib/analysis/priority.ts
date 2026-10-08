import type { AnalysisResult, Niveau, Priorite, Requirement } from './types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

const toUtc = (d: string) => Date.parse(`${d}T00:00:00Z`)

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-31, 2026-13-01). */
export function isValidIsoDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false
  const t = toUtc(d)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d
}

/** Calendar days from `from` to `to` (both YYYY-MM-DD). Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

export function computeMatchScore(exigences: Requirement[], domaineCoherent: boolean): number {
  const oblig = exigences.filter(e => e.obligatoire)
  const souh = exigences.filter(e => !e.obligatoire)
  const part = (list: Requirement[], weight: number) =>
    list.length === 0 ? weight : (weight * list.filter(e => e.present).length) / list.length

  let score = Math.round(part(oblig, 70) + part(souh, 20) + (domaineCoherent ? 10 : 0))
  if (exigences.some(e => e.bloquante && !e.present)) score = Math.min(score, 40)
  return Math.max(0, Math.min(100, score))
}

export function computeUrgency(dateLimite: string | null, today: string): number {
  if (!dateLimite || !isValidIsoDate(dateLimite)) return 50
  const days = daysBetween(today, dateLimite)
  if (days <= 7) return 100
  if (days <= 14) return 85
  if (days <= 30) return 60
  return 30
}

export function computePriority(
  scoreGlobal: number,
  dateLimite: string | null,
  today: string,
): { niveau: Niveau; score: number; urgence: number } {
  if (dateLimite && isValidIsoDate(dateLimite) && daysBetween(today, dateLimite) < 0) {
    return { niveau: 'expiree', score: 0, urgence: 0 }
  }
  const urgence = computeUrgency(dateLimite, today)
  const score = Math.round(0.7 * scoreGlobal + 0.3 * urgence)
  const niveau: Niveau = score >= 70 ? 'haute' : score >= 45 ? 'moyenne' : 'basse'
  return { niveau, score, urgence }
}

/** Local date (YYYY-MM-DD) in Europe/Paris. Pure and client-safe. */
export const todayIso = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

/**
 * Priority as of `today`: the stored one is frozen at analysis time, so a deadline that has
 * since passed (or got closer) must be reflected when displaying and sorting.
 */
export function currentPriority(analysis: AnalysisResult, today: string): Priorite {
  const { niveau, score, urgence } = computePriority(
    analysis.correspondance.score_global, analysis.offre.date_limite, today,
  )
  return {
    niveau, score, urgence,
    raison: niveau === 'expiree' ? 'Date limite dépassée.' : analysis.priorite.raison,
  }
}
