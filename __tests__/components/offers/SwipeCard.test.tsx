import { render, screen, fireEvent } from '@testing-library/react'
import { SwipeCard } from '@/components/offers/SwipeCard'
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
  killTweensOf: jest.fn(),
}))

const offer: Offer = {
  id: 'o1',
  user_id: 'u1',
  titre: 'Ingénieur Full Stack',
  entreprise: 'Airbus',
  lien: 'https://example.com',
  salaire_min: null,
  salaire_max: null,
  localisation: 'Toulouse',
  source: 'jsearch',
  type_contrat: 'CDI',
  statut: 'non_traite',
  date_scraped: '2026-06-05',
  raw_data: { duree: '18 mois', description: 'Développement applications web temps réel pour systèmes embarqués.' },
}

describe('SwipeCard', () => {
  it('renders title, company and location', () => {
    render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={0} />)
    expect(screen.getByText('Ingénieur Full Stack')).toBeInTheDocument()
    expect(screen.getByText(/Airbus/)).toBeInTheDocument()
    expect(screen.getByText(/Toulouse/)).toBeInTheDocument()
  })

  it('renders contract type', () => {
    render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={0} />)
    expect(screen.getByText('CDI')).toBeInTheDocument()
  })

  it('renders duration from raw_data', () => {
    render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={0} />)
    expect(screen.getByText(/18 mois/)).toBeInTheDocument()
  })

  it('renders description from raw_data', () => {
    render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={0} />)
    expect(screen.getByText(/Développement applications web/)).toBeInTheDocument()
  })

  it('calls onAction("postule") when Postuler button clicked', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeCard offer={offer} onAction={onAction} stackIndex={0} />)
    fireEvent.click(screen.getByRole('button', { name: /postuler/i }))
    expect(onAction).toHaveBeenCalledWith('o1', 'postule')
  })

  it('calls onAction("ignore") when Ignorer button clicked', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeCard offer={offer} onAction={onAction} stackIndex={0} />)
    fireEvent.click(screen.getByRole('button', { name: /ignorer/i }))
    expect(onAction).toHaveBeenCalledWith('o1', 'ignore')
  })

  it('calls onAction("sauvegarde") when Sauvegarder button clicked', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeCard offer={offer} onAction={onAction} stackIndex={0} />)
    fireEvent.click(screen.getByRole('button', { name: /sauvegarder/i }))
    expect(onAction).toHaveBeenCalledWith('o1', 'sauvegarde')
  })

  it('stacks card -1 with rotation 3deg style', () => {
    const { container } = render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={1} />)
    const card = container.firstChild as HTMLElement
    expect(card.style.transform).toContain('rotate(3deg)')
  })

  it('stacks card -2 with rotation 6deg style', () => {
    const { container } = render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={2} />)
    const card = container.firstChild as HTMLElement
    expect(card.style.transform).toContain('rotate(6deg)')
  })
})
