import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineConfirm } from '@/components/ui/InlineConfirm'

jest.useFakeTimers()

describe('InlineConfirm', () => {
  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.clearAllTimers()
  })

  it('does not render when visible=false', () => {
    render(<InlineConfirm visible={false} message="Supprimer ?" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText('Supprimer ?')).not.toBeInTheDocument()
  })

  it('renders message and buttons when visible=true', () => {
    render(<InlineConfirm visible={true} message="Supprimer ?" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument()
    expect(screen.getByText('Confirmer')).toBeInTheDocument()
    expect(screen.getByText('Annuler')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm clicked', async () => {
    const onConfirm = jest.fn()
    const user = userEvent.setup({ delay: null })
    render(<InlineConfirm visible={true} message="Supprimer ?" onConfirm={onConfirm} onCancel={() => {}} />)
    await user.click(screen.getByText('Confirmer'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = jest.fn()
    const user = userEvent.setup({ delay: null })
    render(<InlineConfirm visible={true} message="Supprimer ?" onConfirm={() => {}} onCancel={onCancel} />)
    await user.click(screen.getByText('Annuler'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('auto-cancels after 5 seconds', () => {
    const onCancel = jest.fn()
    render(<InlineConfirm visible={true} message="Supprimer ?" onConfirm={() => {}} onCancel={onCancel} />)
    act(() => { jest.advanceTimersByTime(5000) })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
