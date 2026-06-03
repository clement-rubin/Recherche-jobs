/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockApplication = {
  id: 'app-1',
  user_id: 'user-1',
  entreprise: 'Decathlon',
  poste: 'Magasinier',
  lien_offre: null,
  statut: 'en_cours',
  resultat: null,
  type_contrat: 'interim',
  date_postulation: '2026-06-03',
  notes: null,
  source: 'manual',
  created_at: '2026-06-03T10:00:00Z',
  updated_at: '2026-06-03T10:00:00Z',
}

const mockSupabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
  },
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [mockApplication], error: null }),
    single: jest.fn().mockResolvedValue({ data: mockApplication, error: null }),
  }),
}

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue(mockSupabase),
}))

import { GET, POST } from '@/app/api/applications/route'
import { PATCH, DELETE } from '@/app/api/applications/[id]/route'

describe('Applications API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const chainMock = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [mockApplication], error: null }),
      single: jest.fn().mockResolvedValue({ data: mockApplication, error: null }),
    }
    mockSupabase.from.mockReturnValue(chainMock)
  })

  describe('GET /api/applications', () => {
    it('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
      const req = new NextRequest('http://localhost/api/applications')
      const res = await GET(req)
      expect(res.status).toBe(401)
    })

    it('returns applications list for authenticated user', async () => {
      const req = new NextRequest('http://localhost/api/applications')
      const res = await GET(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
    })
  })

  describe('POST /api/applications', () => {
    it('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
      const req = new NextRequest('http://localhost/api/applications', {
        method: 'POST',
        body: JSON.stringify({ entreprise: 'Test', poste: 'Dev' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('creates application and returns 201', async () => {
      const req = new NextRequest('http://localhost/api/applications', {
        method: 'POST',
        body: JSON.stringify({ entreprise: 'Decathlon', poste: 'Magasinier' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await POST(req)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.entreprise).toBe('Decathlon')
    })
  })

  describe('PATCH /api/applications/[id]', () => {
    it('updates application status', async () => {
      const req = new NextRequest('http://localhost/api/applications/app-1', {
        method: 'PATCH',
        body: JSON.stringify({ statut: 'relance' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await PATCH(req, { params: Promise.resolve({ id: 'app-1' }) })
      expect(res.status).toBe(200)
    })
  })

  describe('DELETE /api/applications/[id]', () => {
    it('deletes application', async () => {
      const chainMock = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        match: jest.fn().mockResolvedValue({ error: null }),
      }
      mockSupabase.from.mockReturnValueOnce(chainMock)
      const req = new NextRequest('http://localhost/api/applications/app-1', {
        method: 'DELETE',
      })
      const res = await DELETE(req, { params: Promise.resolve({ id: 'app-1' }) })
      expect(res.status).toBe(204)
    })
  })
})
