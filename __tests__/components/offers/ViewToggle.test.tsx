import { render, screen, fireEvent } from '@testing-library/react'
import { ViewToggle } from '@/components/offers/ViewToggle'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

beforeEach(() => localStorageMock.clear())

describe('ViewToggle', () => {
  it('renders Liste and Swipe buttons', () => {
    render(<ViewToggle mode="list" onChange={jest.fn()} />)
    expect(screen.getByText('Liste')).toBeInTheDocument()
    expect(screen.getByText('Swipe')).toBeInTheDocument()
  })

  it('calls onChange with "swipe" when Swipe clicked', () => {
    const onChange = jest.fn()
    render(<ViewToggle mode="list" onChange={onChange} />)
    fireEvent.click(screen.getByText('Swipe'))
    expect(onChange).toHaveBeenCalledWith('swipe')
  })

  it('calls onChange with "list" when Liste clicked', () => {
    const onChange = jest.fn()
    render(<ViewToggle mode="swipe" onChange={onChange} />)
    fireEvent.click(screen.getByText('Liste'))
    expect(onChange).toHaveBeenCalledWith('list')
  })

  it('active button has aria-pressed true', () => {
    render(<ViewToggle mode="swipe" onChange={jest.fn()} />)
    expect(screen.getByText('Swipe').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Liste').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })
})
