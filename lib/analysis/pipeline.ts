import { analyzeOffer } from './analyze'
import { ProfileMissingError } from './errors'
import { detectLang } from './lang'
import { daysBetween } from './priority'
import { normalizeCompanyName, researchCompany } from './research'
import type { AnalysisResult, CandidateProfile, CompanyResearch } from './types'

const CACHE_DAYS = 90

/** Minimal structural type: the real Supabase client satisfies it, tests pass a plain object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = { from: (table: string) => any }

export interface PipelineInput {
  supabase: Db
  userId: string
  company: string | null
  offerText: string
  description: string
  today?: string
}

export interface PipelineDeps {
  researchCompany: typeof researchCompany
  analyzeOffer: typeof analyzeOffer
}

const defaultDeps: PipelineDeps = { researchCompany, analyzeOffer }

export const todayParis = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

export async function runAnalysis(input: PipelineInput, deps: PipelineDeps = defaultDeps): Promise<AnalysisResult> {
  const today = input.today ?? todayParis()

  const { data: profile, error: profileError } = await input.supabase
    .from('candidate_profile').select('*').eq('user_id', input.userId).maybeSingle()
  if (profileError) throw new Error(profileError.message)
  if (!profile) throw new ProfileMissingError()

  const key = input.company ? normalizeCompanyName(input.company) : ''
  const warnings: string[] = []
  let research: CompanyResearch | null = null

  if (key) {
    const { data: cached } = await input.supabase
      .from('company_research').select('data, date_recherche')
      .eq('user_id', input.userId).eq('nom_normalise', key).maybeSingle()
    if (cached && daysBetween(cached.date_recherche, today) <= CACHE_DAYS) research = cached.data
  }

  if (!research) {
    const outcome = await deps.researchCompany(input.company, today)
    research = outcome.research
    if (outcome.warning) warnings.push(outcome.warning)
    if (outcome.cacheable && key) {
      const { error } = await input.supabase.from('company_research').upsert(
        { user_id: input.userId, nom_normalise: key, data: research, date_recherche: today },
        { onConflict: 'user_id,nom_normalise' },
      )
      if (error) console.warn('[analysis] company_research upsert failed', error.message)
    }
  }

  const candidate: CandidateProfile = {
    cv_maitre: profile.cv_maitre, cv_fr: profile.cv_fr, cv_en: profile.cv_en, projet_pro: profile.projet_pro,
  }
  return deps.analyzeOffer({
    profile: candidate,
    offerText: input.offerText,
    lang: detectLang(input.description),
    research,
    today,
    warnings,
  })
}
