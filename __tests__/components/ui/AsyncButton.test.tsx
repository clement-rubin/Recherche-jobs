import { render, screen, fireEvent, act } from '@testing-library/react'
import { AsyncButton } from '@/components/ui/AsyncButton'

jest.useFakeTimers()

describe('AsyncButton', () => {
  it('renders idle label', () => {
    render(<AsyncButton onClick={async () => {}}>Lancer</AsyncButton>)
    expect(screen.getByText('Lancer')).toBeInTheDocument()
  })

  it('shows loading state during async operation', async () => {
    let resolve: () => void
    const promise = new Promise<void>(r => { resolve = r })
    render(
      <AsyncButton onClick={() => promise} loadingLabel="Chargement...">
        Lancer
      </AsyncButton>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Chargement...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    await act(async () => { resolve!() })
  })

  it('shows success state after resolve, resets after 3s', async () => {
    render(
      <AsyncButton onClick={async () => {}} successLabel="✓ Fait">
        Lancer
      </AsyncButton>
    )
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    expect(screen.getByText('✓ Fait')).toBeInTheDocument()
    act(() => { jest.advanceTimersByTime(3000) })
    expect(screen.getByText('Lancer')).toBeInTheDocument()
  })

  it('shows error state after reject, resets after 3s', async () => {
    render(
      <AsyncButton onClick={async () => { throw new Error('API down') }} errorLabel="✕ Erreur">
        Lancer
      </AsyncButton>
    )
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    expect(screen.getByText('✕ Erreur')).toBeInTheDocument()
    act(() => { jest.advanceTimersByTime(3000) })
    expect(screen.getByText('Lancer')).toBeInTheDocument()
  })

  it('uses the accent token for the primary variant, not hardcoded indigo', () => {
    render(<AsyncButton onClick={async () => {}}>Lancer</AsyncButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).not.toMatch(/bg-indigo-/)
    expect(btn.getAttribute('style')).toContain('var(--accent)')
  })

  it('renders a danger variant on the danger token', () => {
    render(<AsyncButton onClick={async () => {}} variant="danger">Supprimer</AsyncButton>)
    expect(screen.getByRole('button').getAttribute('style')).toContain('var(--danger')
  })

  it('renders a ghost variant with no background fill', () => {
    render(<AsyncButton onClick={async () => {}} variant="ghost">Annuler</AsyncButton>)
    const style = screen.getByRole('button').getAttribute('style') ?? ''
    expect(style).not.toContain('var(--accent)')
  })
})
