import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/ui/Modal'

describe('Modal', () => {
  it('renders its title and children', () => {
    render(<Modal title="Détails" onClose={() => {}}>contenu</Modal>)
    expect(screen.getByText('Détails')).toBeInTheDocument()
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn()
    render(<Modal title="Détails" onClose={onClose}>contenu</Modal>)
    fireEvent.click(screen.getByLabelText('Fermer'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the overlay is clicked', () => {
    const onClose = jest.fn()
    render(<Modal title="Détails" onClose={onClose}>contenu</Modal>)
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the card itself is clicked', () => {
    const onClose = jest.fn()
    render(<Modal title="Détails" onClose={onClose}>contenu</Modal>)
    fireEvent.click(screen.getByText('contenu'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on Escape', () => {
    const onClose = jest.fn()
    render(<Modal title="Détails" onClose={onClose}>contenu</Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders a footer when given one', () => {
    render(<Modal title="Détails" onClose={() => {}} footer={<span>pied</span>}>contenu</Modal>)
    expect(screen.getByText('pied')).toBeInTheDocument()
  })

  it('renders the mobile bottom-sheet shape by default', () => {
    render(<Modal title="Détails" onClose={() => {}}>contenu</Modal>)
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('rounded-t-[var(--r-2xl)]')
  })

  it('renders a centered card when sheetOnMobile is false', () => {
    render(<Modal title="Détails" onClose={() => {}} sheetOnMobile={false}>contenu</Modal>)
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).not.toContain('rounded-t-[var(--r-2xl)]')
    expect(dialog.className).toContain('self-center')
  })

  it('moves focus into the dialog on mount', () => {
    render(<Modal title="Détails" onClose={() => {}}>contenu</Modal>)
    expect(document.activeElement).toBe(screen.getByLabelText('Fermer'))
  })

  it('restores focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'ouvrir'
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(<Modal title="Détails" onClose={() => {}}>contenu</Modal>)
    expect(document.activeElement).not.toBe(trigger)
    unmount()
    expect(document.activeElement).toBe(trigger)

    document.body.removeChild(trigger)
  })

  it('locks and restores body scroll', () => {
    const { unmount } = render(<Modal title="Détails" onClose={() => {}}>contenu</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
