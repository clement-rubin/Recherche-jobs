import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '@/components/ui/Card'

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>contenu</Card>)
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })

  it('merges an extra className', () => {
    render(<Card className="p-8">contenu</Card>)
    expect(screen.getByText('contenu')).toHaveClass('p-8')
  })

  it('renders as a button role and fires onClick when interactive', async () => {
    const onClick = jest.fn()
    render(<Card onClick={onClick}>cliquable</Card>)
    const el = screen.getByRole('button', { name: 'cliquable' })
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders as a plain div when not interactive', () => {
    render(<Card>statique</Card>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('fires onClick when Enter is pressed on the interactive card', () => {
    const onClick = jest.fn()
    render(<Card onClick={onClick}>cliquable</Card>)
    const el = screen.getByRole('button', { name: 'cliquable' })
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('fires onClick when Space is pressed on the interactive card', () => {
    const onClick = jest.fn()
    render(<Card onClick={onClick}>cliquable</Card>)
    const el = screen.getByRole('button', { name: 'cliquable' })
    fireEvent.keyDown(el, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('merges an extra className on the interactive variant', () => {
    const onClick = jest.fn()
    render(<Card onClick={onClick} className="p-8">cliquable</Card>)
    expect(screen.getByRole('button', { name: 'cliquable' })).toHaveClass('p-8')
  })
})
