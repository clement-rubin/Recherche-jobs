/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { makeAnalysis } from '@/test-utils/analysis-fixture'
import { ProfileMissingError, SetupError } from '@/lib/analysis/errors'

const LONG = 'Mission de stage data. '.repeat(30)
const offerRow = {
  id: 'o1', user_id: 'u1', titre: 'Data', entreprise: 'Thales', localisation: 'Lille', type_contrat: 'stage',
  raw_data: { job_description: LONG },
}

const updateEq1 = jest.fn()
const updateEq2 = jest.fn()
const update = jest.fn()
let offerResult: { data: unknown; error?: { message: string } } = { data: offerRow }

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn().mockImplementation(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => offerResult }) }) }),
    update,
  })),
}

jest.mock('@/lib/supabase/server', () => ({ createServerSupabase: jest.fn().mockResolvedValue(mockSupabase) }))
const mockRun = jest.fn()
jest.mock('@/lib/analysis/pipeline', () => ({ runAnalysis: (...a: unknown[]) => mockRun(...a) }))

import { POST } from '@/app/api/offers/[id]/analyze/route'

const call = (body: object = {}) =>
  POST(new NextRequest('http://x/api/offers/o1/analyze', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'o1' }),
  })

describe('POST /api/offers/[id]/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    updateEq2.mockResolvedValue({ error: null })
    updateEq1.mockReturnValue({ eq: updateEq2 })
    update.mockReturnValue({ eq: updateEq1 })
    offerResult = { data: offerRow }
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRun.mockResolvedValue(makeAnalysis())
  })

  it('401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect((await call()).status).toBe(401)
  })

  it('404 when the offer does not exist', async () => {
    offerResult = { data: null }
    expect((await call()).status).toBe(404)
  })

  it('500 when reading the offer fails, without leaking details', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    offerResult = { data: null, error: { message: 'secret db detail' } }
    const res = await call()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Erreur de lecture de l'offre" })
    expect(spy).toHaveBeenCalled()
    expect(mockRun).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('passes the JSearch deadline to the pipeline', async () => {
    offerResult = { data: { ...offerRow, raw_data: { job_description: LONG, job_offer_expiration_datetime_utc: '2026-11-01T00:00:00Z' } } }
    await call()
    expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ dateLimite: '2026-11-01' }))
  })

  it('maps a SetupError to 503', async () => {
    mockRun.mockRejectedValue(new SetupError('GROQ_API_KEY manquante'))
    const res = await call()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'GROQ_API_KEY manquante' })
  })

  it('returns needsText when the description is too short', async () => {
    offerResult = { data: { ...offerRow, raw_data: { job_description: 'Court.' } } }
    const res = await call()
    expect(await res.json()).toEqual({ needsText: true })
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('uses pasted text when provided', async () => {
    offerResult = { data: { ...offerRow, raw_data: null } }
    const res = await call({ text: LONG })
    expect(res.status).toBe(200)
    expect(mockRun).toHaveBeenCalled()
  })

  it('runs the analysis and persists analysis + priority_score', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).analysis.priorite.score).toBe(78)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      analysis: expect.objectContaining({ cv_utilise: 'fr' }),
      priority_score: 78,
      analyzed_at: expect.any(String),
    }))
  })

  it('filters the update by id and user_id', async () => {
    await call()
    expect(updateEq1).toHaveBeenCalledWith('id', 'o1')
    expect(updateEq2).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('returns persisted: true on success', async () => {
    const body = await (await call()).json()
    expect(body.persisted).toBe(true)
  })

  it('still returns the analysis with persisted: false when the update fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    updateEq2.mockResolvedValue({ error: { message: 'secret db detail' } })
    const res = await call()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.persisted).toBe(false)
    expect(body.analysis.priorite.score).toBe(78)
    expect(JSON.stringify(body)).not.toContain('secret db detail')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('maps a Groq 429 to 429', async () => {
    mockRun.mockRejectedValue({ status: 429 })
    expect((await call()).status).toBe(429)
  })

  it('ignores a non-string text in the body', async () => {
    offerResult = { data: { ...offerRow, raw_data: { job_description: 'Court.' } } }
    const res = await call({ text: 123 })
    expect(await res.json()).toEqual({ needsText: true })
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('maps a missing profile to 400', async () => {
    mockRun.mockRejectedValue(new ProfileMissingError())
    const res = await call()
    expect(res.status).toBe(400)
  })
})
