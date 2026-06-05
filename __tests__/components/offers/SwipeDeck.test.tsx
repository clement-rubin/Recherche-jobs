import { render, screen, act } from '@testing-library/react'
import { SwipeDeck } from '@/components/offers/SwipeDeck'
import type { Offer } from '@/lib/supabase/types'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

jest.mock('gsap', () => ({
  set: jest.fn(),
  to: jest.fn((_el: unknown, opts: { onComplete?: () => void }) => { opts?.onComplete?.() }),
  fromTo: jest.fn(),
  killTweensOf: jest.fn(),
  context: jest.fn(() => ({ revert: jest.fn() })),
  quickSetter: jest.fn(() => jest.fn()),
}))

const makeOffer = (id: string): Offer => ({
  id,
  user_id: 'u1',
  titre: `Offre ${id}`,
  entreprise: 'ACME',
  lien: null,
  salaire_min: null,
  salaire_max: null,
  localisation: 'Paris',
  source: 'jsearch',
  type_contrat: 'CDI',
  statut: 'non_traite',
  date_scraped: '2026-06-05',
  raw_data: null,
})

describe('SwipeDeck', () => {
  it('renders top card title', () => {
    const offers = [makeOffer('a'), makeOffer('b'), makeOffer('c')]
    render(<SwipeDeck offers={offers} onAction={jest.fn()} onNeedMore={jest.fn()} />)
    expect(screen.getByText('Offre a')).toBeInTheDocument()
  })

  it('shows empty state when offers array is empty', () => {
    render(<SwipeDeck offers={[]} onAction={jest.fn()} onNeedMore={jest.fn()} />)
    expect(screen.getByText(/plus d'offres/i)).toBeInTheDocument()
  })

  it('calls onNeedMore when 3 or fewer cards remain', () => {
    const onNeedMore = jest.fn()
    render(<SwipeDeck offers={[makeOffer('a'), makeOffer('b')]} onAction={jest.fn()} onNeedMore={onNeedMore} />)
    expect(onNeedMore).toHaveBeenCalled()
  })

  it('calls onAction and removes top card after action', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeDeck offers={[makeOffer('a'), makeOffer('b')]} onAction={onAction} onNeedMore={jest.fn()} />)
    const btn = screen.getByRole('button', { name: /postuler/i })
    await act(async () => { btn.click() })
    expect(onAction).toHaveBeenCalledWith('a', 'postule')
  })

  it('removes top card from DOM after action', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeDeck offers={[makeOffer('a'), makeOffer('b'), makeOffer('c')]} onAction={onAction} onNeedMore={jest.fn()} />)
    expect(screen.getByText('Offre a')).toBeInTheDocument()
    await act(async () => {
      screen.getByRole('button', { name: /postuler/i }).click()
    })
    expect(screen.queryByText('Offre a')).not.toBeInTheDocument()
    expect(screen.getByText('Offre b')).toBeInTheDocument()
  })
})
