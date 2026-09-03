import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from '@/components/ui/TagInput'

describe('TagInput', () => {
  it('renders existing tags', () => {
    render(<TagInput value={['logistique', 'entrepôt']} onChange={() => {}} />)
    expect(screen.getByText('logistique')).toBeInTheDocument()
    expect(screen.getByText('entrepôt')).toBeInTheDocument()
  })

  it('adds tag on Enter key', async () => {
    const onChange = jest.fn()
    render(<TagInput value={[]} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'cariste{enter}')
    expect(onChange).toHaveBeenCalledWith(['cariste'])
  })

  it('adds tag on comma key', async () => {
    const onChange = jest.fn()
    render(<TagInput value={[]} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'cariste,')
    expect(onChange).toHaveBeenCalledWith(['cariste'])
  })

  it('removes tag when × clicked', async () => {
    const onChange = jest.fn()
    render(<TagInput value={['logistique']} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Supprimer logistique'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('does not add empty or duplicate tags', async () => {
    const onChange = jest.fn()
    render(<TagInput value={['logistique']} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '{enter}')
    await userEvent.type(input, 'logistique{enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('adds suggestion tag when clicked', async () => {
    const onChange = jest.fn()
    render(
      <TagInput
        value={[]}
        onChange={onChange}
        suggestions={['magasinier', 'cariste']}
      />
    )
    await userEvent.click(screen.getByText('magasinier'))
    expect(onChange).toHaveBeenCalledWith(['magasinier'])
  })

  it('rejects an add when validateAdd returns false, without clearing input or calling onChange', async () => {
    const onChange = jest.fn()
    const onRejected = jest.fn()
    render(
      <TagInput
        value={[]}
        onChange={onChange}
        validateAdd={tag => tag !== 'senior'}
        onRejected={onRejected}
      />
    )
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'senior{enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(onRejected).toHaveBeenCalledWith('senior')
    expect(input).toHaveValue('senior')
  })
})
