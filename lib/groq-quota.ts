import { checkAndReserveQuota } from '@/lib/scrapers/quota'

const SOURCE = 'groq'
export const DEFAULT_GROQ_MONTHLY_CAP = 300

export class GroqQuotaError extends Error {
  constructor(readonly cap: number) {
    super(`Plafond mensuel Groq atteint (${cap} appels). Il se réinitialise le mois prochain, ou augmente GROQ_MONTHLY_CAP.`)
    this.name = 'GroqQuotaError'
  }
}

function monthlyCap(): number {
  const parsed = Number.parseInt(process.env.GROQ_MONTHLY_CAP ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GROQ_MONTHLY_CAP
}

/**
 * Atomically counts one Groq call against the monthly cap (shared `api_usage` table,
 * same mechanism as Adzuna). Call once per logical request, before any retry loop.
 * Fails closed: if the counter can't be reached the call is refused, so usage can never
 * silently run past the cap. Throws GroqQuotaError.
 */
export async function reserveGroqCall(): Promise<void> {
  const cap = monthlyCap()
  const allowed = await checkAndReserveQuota(SOURCE, cap)
  if (!allowed) {
    console.warn('[groq-quota] call refused (cap reached or counter unavailable)', { cap })
    throw new GroqQuotaError(cap)
  }
}
