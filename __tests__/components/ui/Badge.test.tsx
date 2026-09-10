import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('renders the French label for a known status', () => {
    render(<Badge status="en_cours" />)
    expect(screen.getByText('En cours')).toBeInTheDocument()
  })

  it('falls back to the raw status when unknown', () => {
    render(<Badge status="statut_inconnu" />)
    expect(screen.getByText('statut_inconnu')).toBeInTheDocument()
  })

  it('uses semantic tokens rather than dark-mode Tailwind classes', () => {
    const { container } = render(<Badge status="accepte" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).not.toMatch(/\/(20|30)\b/)
    expect(el.getAttribute('style')).toContain('var(--success')
  })

  it('renders every known status with a non-empty label', () => {
    const statuses = [
      'en_cours', 'relance', 'termine', 'accepte', 'refus',
      'sans_reponse', 'non_traite', 'ignore', 'postule', 'sauvegarde',
    ]
    for (const status of statuses) {
      const { container, unmount } = render(<Badge status={status} />)
      expect(container.textContent?.trim().length).toBeGreaterThan(0)
      unmount()
    }
  })
})
