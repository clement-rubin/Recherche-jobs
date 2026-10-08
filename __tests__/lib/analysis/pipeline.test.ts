/**
 * @jest-environment node
 */
import { runAnalysis, type Db } from '@/lib/analysis/pipeline'
import { analysisErrorResponse } from '@/lib/analysis/http'
import { ProfileMissingError, InvalidAnalysisError } from '@/lib/analysis/errors'
import { makeAnalysis, makeResearch } from '@/test-utils/analysis-fixture'

const TODAY = '2026-10-08'
const profileRow = { user_id: 'u1', cv_maitre: 'M', cv_fr: 'F', cv_en: 'E', projet_pro: 'P' }

function makeDb(opts: { profile?: object | null; cached?: object | null }) {
  const upsert = jest.fn().mockResolvedValue({ error: null })
  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'candidate_profile') {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.profile ?? null, error: null }) }) }) }
    }
    return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.cached ?? null, error: null }) }) }) }),
      upsert,
    }
  })
  return { db: { from }, upsert }
}

const base = (db: Db) => ({
  supabase: db, userId: 'u1', company: 'Thales', offerText: 'Titre : X', description: 'Nous recherchons un stagiaire pour notre équipe data avec des projets dans la banque et des clients exigeants.', today: TODAY,
})

const makeDeps = (over: Partial<{ outcome: object }> = {}) => ({
  researchCompany: jest.fn().mockResolvedValue({ research: makeResearch(), cacheable: true, ...over.outcome }),
  analyzeOffer: jest.fn().mockResolvedValue(makeAnalysis()),
})

describe('runAnalysis', () => {
  it('throws ProfileMissingError without a candidate profile', async () => {
    const { db } = makeDb({ profile: null })
    await expect(runAnalysis(base(db), makeDeps())).rejects.toBeInstanceOf(ProfileMissingError)
  })

  it('researches, caches and analyses on a cache miss', async () => {
    const { db, upsert } = makeDb({ profile: profileRow })
    const deps = makeDeps()
    const out = await runAnalysis(base(db), deps)
    expect(deps.researchCompany).toHaveBeenCalledWith('Thales', TODAY)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', nom_normalise: 'thales', date_recherche: TODAY }),
      { onConflict: 'user_id,nom_normalise' },
    )
    expect(deps.analyzeOffer).toHaveBeenCalledWith(expect.objectContaining({ lang: 'fr', today: TODAY, warnings: [] }))
    expect(out).toEqual(makeAnalysis())
  })

  it('skips research when a fresh cache entry exists', async () => {
    const cached = { data: makeResearch(), date_recherche: '2026-08-20' } // 49 days old
    const { db, upsert } = makeDb({ profile: profileRow, cached })
    const deps = makeDeps()
    await runAnalysis(base(db), deps)
    expect(deps.researchCompany).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
    expect(deps.analyzeOffer).toHaveBeenCalledWith(expect.objectContaining({ research: cached.data }))
  })

  it('re-researches when the cache entry is older than 90 days', async () => {
    const cached = { data: makeResearch(), date_recherche: '2026-06-01' } // 129 days old
    const { db } = makeDb({ profile: profileRow, cached })
    const deps = makeDeps()
    await runAnalysis(base(db), deps)
    expect(deps.researchCompany).toHaveBeenCalled()
  })

  it('does not write the cache when the research is not cacheable, and forwards its warning', async () => {
    const { db, upsert } = makeDb({ profile: profileRow })
    const deps = makeDeps({ outcome: { cacheable: false, warning: 'Recherche web indisponible' } })
    await runAnalysis(base(db), deps)
    expect(upsert).not.toHaveBeenCalled()
    expect(deps.analyzeOffer).toHaveBeenCalledWith(expect.objectContaining({ warnings: ['Recherche web indisponible'] }))
  })
})

describe('analysisErrorResponse', () => {
  it('maps errors to HTTP statuses', async () => {
    expect((await analysisErrorResponse(new ProfileMissingError())).status).toBe(400)
    expect((await analysisErrorResponse({ status: 429 })).status).toBe(429)
    expect((await analysisErrorResponse(new InvalidAnalysisError())).status).toBe(502)
    expect((await analysisErrorResponse(new Error('boom'))).status).toBe(500)
  })
})
