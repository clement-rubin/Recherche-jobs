import { render, screen } from '@testing-library/react'
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

  it('renders as a button and fires onClick when interactive', async () => {
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
})
