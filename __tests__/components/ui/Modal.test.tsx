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
})
