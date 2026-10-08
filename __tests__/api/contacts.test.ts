/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { normalizeLinkedInUrl } from '@/lib/contacts'

const row = { id: 'c-1', user_id: 'user-1', nom: 'Marie', linkedin_url: 'https://www.linkedin.com/in/marie', statut: 'a_contacter' }
const insert = jest.fn().mockReturnThis()
const mockSupabase = {
  auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  from: jest.fn(),
}
jest.mock('@/lib/supabase/server', () => ({ createServerSupabase: jest.fn().mockResolvedValue(mockSupabase) }))

import { POST } from '@/app/api/contacts/route'

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/contacts', { method: 'POST', body: JSON.stringify(body) })

describe('normalizeLinkedInUrl', () => {
  it('accepts linkedin urls and adds https', () => {
    expect(normalizeLinkedInUrl('linkedin.com/in/marie')).toBe('https://linkedin.com/in/marie')
    expect(normalizeLinkedInUrl('http://fr.linkedin.com/in/x')).toBe('https://fr.linkedin.com/in/x')
  })
  it('rejects other hosts and junk', () => {
    expect(normalizeLinkedInUrl('https://evil.com/linkedin.com')).toBeNull()
    expect(normalizeLinkedInUrl('https://notlinkedin.com/in/x')).toBeNull()
    expect(normalizeLinkedInUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeLinkedInUrl('')).toBeNull()
  })
})

describe('Contacts API POST', () => {
  beforeEach(() => {
    insert.mockClear()
    mockSupabase.from.mockReturnValue({
      insert,
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: row, error: null }),
    })
  })

  it('401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    expect((await POST(req({}))).status).toBe(401)
  })

  it('400 on invalid linkedin url', async () => {
    expect((await POST(req({ nom: 'Marie', linkedin_url: 'https://example.com' }))).status).toBe(400)
  })

  it('creates a contact scoped to the user', async () => {
    const res = await POST(req({ nom: 'Marie', linkedin_url: 'linkedin.com/in/marie' }))
    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', statut: 'a_contacter', date_contact: null }))
  })
})
