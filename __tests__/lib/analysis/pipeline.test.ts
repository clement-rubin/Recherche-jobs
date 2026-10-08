/**
 * @jest-environment node
 */
import { runAnalysis, type Db } from '@/lib/analysis/pipeline'
import { analysisErrorResponse } from '@/lib/analysis/http'
import { ProfileMissingError, InvalidAnalysisError, SetupError } from '@/lib/analysis/errors'
import { makeAnalysis, makeResearch } from '@/test-utils/analysis-fixture'

const TODAY = '2026-10-08'
const profileRow = { user_id: 'u1', cv_maitre: 'M', cv_fr: 'F', cv_en: 'E', projet_pro: 'P' }

function makeDb(opts: { profile?: object | null; cached?: unknown; cacheError?: { message: string }; profileError?: { message: string; code?: string } }) {
  const upsert = jest.fn().mockResolvedValue({ error: null })
  const cacheSelect = jest.fn()
  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'candidate_profile') {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.profile ?? null, error: opts.profileError ?? null }) }) }) }
    }
    return {
      select: () => {
        cacheSelect()
        return { eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.cached ?? null, error: opts.cacheError ?? null }) }) }) }
      },
      upsert,
    }
  })
  return { db: { from }, upsert, cacheSelect }
}

const base = (db: Db) => ({
  supabase: db, userId: 'u1', company: 'Thales', offerText: 'Titre : X', description: 'Nous recherchons un stagiaire pour notre équipe data avec des projets dans la banque et des clients exigeants.', today: TODAY,
})

const makeDeps = (over: Partial<{ outcome: object }> = {}) => ({
  researchCompany: jest.fn().mockResolvedValue({ research: makeResearch(), cacheable: true, ...over.outcome }),
  analyzeOffer: jest.fn().mockResolvedValue(makeAnalysis()),
})

describe('runAnalysis', () => {
  const realKey = process.env.GROQ_API_KEY
  beforeEach(() => { process.env.GROQ_API_KEY = 'test-key' })
  afterEach(() => {
    if (realKey === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = realKey
  })

  it('throws SetupError before any research when GROQ_API_KEY is missing', async () => {
    delete process.env.GROQ_API_KEY
    const { db, cacheSelect } = makeDb({ profile: profileRow })
    const deps = makeDeps()
    await expect(runAnalysis(base(db), deps)).rejects.toThrow(new SetupError('GROQ_API_KEY manquante'))
    expect(deps.researchCompany).not.toHaveBeenCalled()
    expect(cacheSelect).not.toHaveBeenCalled()
  })

  it.each([
    [{ code: '42P01', message: 'relation does not exist' }],
    [{ code: 'PGRST205', message: 'not found in schema cache' }],
    [{ message: "Could not find the table 'public.candidate_profile'" }],
  ])('throws SetupError when the candidate_profile table is missing (%j)', async (profileError) => {
    const { db } = makeDb({ profileError })
    const deps = makeDeps()
    await expect(runAnalysis(base(db), deps)).rejects.toThrow(new SetupError('Migration 006 non appliquée dans Supabase'))
    expect(deps.researchCompany).not.toHaveBeenCalled()
  })

  it('keeps a plain error for other profile query failures', async () => {
    const { db } = makeDb({ profileError: { message: 'boom' } })
    const err = await runAnalysis(base(db), makeDeps()).catch(e => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(SetupError)
  })

  it('forwards a known deadline to the analysis', async () => {
    const { db } = makeDb({ profile: profileRow })
    const deps = makeDeps()
    await runAnalysis({ ...base(db), dateLimite: '2026-10-30' }, deps)
    expect(deps.analyzeOffer).toHaveBeenCalledWith(expect.objectContaining({ dateLimite: '2026-10-30' }))
  })

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

describe('runAnalysis cache robustness', () => {
  const realKey = process.env.GROQ_API_KEY
  beforeEach(() => { process.env.GROQ_API_KEY = 'test-key' })
  afterEach(() => {
    if (realKey === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = realKey
  })

  it('treats a cache query error as a miss', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { db } = makeDb({ profile: profileRow, cacheError: { message: 'boom' } })
    const deps = makeDeps()
    await runAnalysis(base(db), deps)
    expect(deps.researchCompany).toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('treats malformed cached data as a miss', async () => {
    const { db } = makeDb({ profile: profileRow, cached: { data: 'oops', date_recherche: '2026-10-01' } })
    const deps = makeDeps()
    await runAnalysis(base(db), deps)
    expect(deps.researchCompany).toHaveBeenCalled()
  })

  it('does not look up the cache when the company is null', async () => {
    const { db, cacheSelect, upsert } = makeDb({ profile: profileRow })
    const deps = makeDeps()
    await runAnalysis({ ...base(db), company: null }, deps)
    expect(cacheSelect).not.toHaveBeenCalled()
    expect(deps.researchCompany).toHaveBeenCalledWith(null, TODAY)
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('analysisErrorResponse', () => {
  it('maps errors to HTTP statuses', async () => {
    expect((await analysisErrorResponse(new ProfileMissingError())).status).toBe(400)
    expect((await analysisErrorResponse({ status: 429 })).status).toBe(429)
    expect((await analysisErrorResponse(new InvalidAnalysisError())).status).toBe(502)
    expect((await analysisErrorResponse(new Error('boom'))).status).toBe(500)
    const setup = await analysisErrorResponse(new SetupError('GROQ_API_KEY manquante'))
    expect(setup.status).toBe(503)
    expect(await setup.json()).toEqual({ error: 'GROQ_API_KEY manquante' })
  })
})
