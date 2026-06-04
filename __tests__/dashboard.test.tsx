import { render, screen } from '@testing-library/react'

// Mock server supabase
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))

// Mock Next.js
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}))

import DashboardPage from '@/app/page'

describe('DashboardPage', () => {
  it('renders stat cards', async () => {
    const page = await DashboardPage()
    render(page)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
    expect(screen.getByText('Relances')).toBeInTheDocument()
    expect(screen.getByText('Terminées')).toBeInTheDocument()
  })

  it('shows empty state when no applications', async () => {
    const page = await DashboardPage()
    render(page)
    expect(screen.getByText(/Aucune candidature/)).toBeInTheDocument()
  })
})
