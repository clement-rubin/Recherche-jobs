/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockCreate = jest.fn()
const mockReserve = jest.fn()
jest.mock('@/lib/groq-quota', () => {
  class GroqQuotaError extends Error {}
  return { GroqQuotaError, reserveGroqCall: (...a: unknown[]) => mockReserve(...a) }
})
jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } })),
}))

const contact = { id: 'c-1', user_id: 'user-1', nom: 'Marie', poste: 'Data lead', entreprise: 'Decathlon', profil_texte: 'Data engineer chez Doctolib, migration vers dbt.' }
const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn(),
}
jest.mock('@/lib/supabase/server', () => ({ createServerSupabase: jest.fn().mockResolvedValue(mockSupabase) }))

import { POST } from '@/app/api/contacts/[id]/message/route'

const call = () =>
  POST(new NextRequest('http://localhost/api/contacts/c-1/message', { method: 'POST' }), { params: Promise.resolve({ id: 'c-1' }) })

const withContact = (data: unknown, error: unknown = null) =>
  mockSupabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
  })

describe('POST /api/contacts/[id]/message', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    mockReserve.mockReset().mockResolvedValue(undefined)
    process.env.GROQ_API_KEY = 'test-key'
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect((await call()).status).toBe(401)
  })

  it('404 when contact not found', async () => {
    withContact(null, { message: 'nope' })
    expect((await call()).status).toBe(404)
  })

  it('400 when no profile text', async () => {
    withContact({ ...contact, profil_texte: '  ' })
    expect((await call()).status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns generated message grounded in the profile', async () => {
    withContact(contact)
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ message: 'Bonjour Marie, ...dbt...' }) } }] })
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).message).toContain('dbt')
    expect(mockCreate.mock.calls[0][0].messages[1].content).toContain('Doctolib')
  })

  it.each([
    [429, 429, 'Limite Groq'],
    [413, 413, 'trop long'],
    [401, 502, 'GROQ_API_KEY'],
  ])('maps groq status %s to a readable %s error', async (groqStatus, httpStatus, text) => {
    withContact(contact)
    mockCreate.mockRejectedValue(Object.assign(new Error('x'), { status: groqStatus }))
    const res = await call()
    expect(res.status).toBe(httpStatus)
    expect((await res.json()).error).toContain(text)
  })

  it('429 and no Groq call when the monthly cap is reached', async () => {
    withContact(contact)
    const { GroqQuotaError } = jest.requireMock('@/lib/groq-quota')
    mockReserve.mockRejectedValue(new GroqQuotaError('Plafond mensuel Groq atteint (300 appels)'))
    const res = await call()
    expect(res.status).toBe(429)
    expect((await res.json()).error).toContain('Plafond mensuel')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('500 with clear message when GROQ_API_KEY is missing', async () => {
    withContact(contact)
    const key = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    const res = await call()
    process.env.GROQ_API_KEY = key
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('GROQ_API_KEY')
  })

  it('502 when the model fails, with the cause in the message', async () => {
    withContact(contact)
    mockCreate.mockRejectedValue(Object.assign(new Error('model not found'), { status: 404 }))
    const res = await call()
    expect(res.status).toBe(502)
    expect((await res.json()).error).toContain('404 model not found')
  })
})
