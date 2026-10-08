/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { makeAnalysis } from '@/test-utils/analysis-fixture'

const mockSupabase = { auth: { getUser: jest.fn() } }
jest.mock('@/lib/supabase/server', () => ({ createServerSupabase: jest.fn().mockResolvedValue(mockSupabase) }))

const mockExtract = jest.fn()
jest.mock('@/lib/analyzer/scraper', () => ({ extractOffer: (...a: unknown[]) => mockExtract(...a) }))

const mockRun = jest.fn()
jest.mock('@/lib/analysis/pipeline', () => ({ runAnalysis: (...a: unknown[]) => mockRun(...a) }))

import { POST } from '@/app/api/analyze/route'

const LONG = 'Mission de stage data. '.repeat(30)
const scraped = (over: object = {}) => ({
  titre: 'Data', entreprise: 'Thales', localisation: 'Lille', type_contrat: 'stage',
  description_brute: LONG, competences_extraites: [], url_source: 'https://x.com/job', source: 'autre', ...over,
})

const call = (body: unknown) =>
  POST(new NextRequest('http://x/api/analyze', { method: 'POST', body: JSON.stringify(body) }))

describe('POST /api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockExtract.mockResolvedValue(scraped())
    mockRun.mockResolvedValue(makeAnalysis())
  })

  it('401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect((await call({ url: 'https://x.com' })).status).toBe(401)
  })

  it('400 when url is missing', async () => {
    const res = await call({})
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('URL manquante')
  })

  it('400 when url is not a string or is blank', async () => {
    expect((await call({ url: 42 })).status).toBe(400)
    expect((await call({ url: '   ' })).status).toBe(400)
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('passes a blocked result through', async () => {
    mockExtract.mockResolvedValue({ blocked: true, domain: 'linkedin.com', reason: 'CGU' })
    const res = await call({ url: 'https://linkedin.com/jobs/1' })
    expect(await res.json()).toEqual({ blocked: true, domain: 'linkedin.com', reason: 'CGU' })
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('passes requiresConfirmation through', async () => {
    mockExtract.mockResolvedValue({ requiresConfirmation: true, domain: 'x.com', reason: 'robots' })
    const res = await call({ url: 'https://x.com/job' })
    expect(await res.json()).toEqual({ requiresConfirmation: true, domain: 'x.com', reason: 'robots' })
  })

  it('returns 400 when the manual text is still too short', async () => {
    mockExtract.mockResolvedValue(scraped({ description_brute: 'Court.' }))
    const res = await call({ url: 'https://x.com/job', manualText: 'Court.' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Texte trop court : colle l'offre complète (au moins quelques paragraphes).")
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('uses the manually entered company and returns it on the offer', async () => {
    mockExtract.mockResolvedValue(scraped({ entreprise: '' }))
    const res = await call({ url: 'https://x.com/job', manualText: LONG, company: 'Thales' })
    expect(res.status).toBe(200)
    expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ company: 'Thales', userId: 'u1' }))
    const body = await res.json()
    expect(body.offer.entreprise).toBe('Thales')
    expect(body.analysis).toBeDefined()
  })

  it('ignores non-string manualText/company and non-true force', async () => {
    await call({ url: 'https://x.com/job', manualText: 5, company: {}, force: 'yes' })
    expect(mockExtract).toHaveBeenCalledWith('https://x.com/job', { manualText: undefined, force: false })
  })

  it('does not throw on a non-URL string with short scraped text', async () => {
    mockExtract.mockResolvedValue(scraped({ description_brute: 'Court.' }))
    const res = await call({ url: 'not a url' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({ blocked: true, domain: '' }))
  })
})
