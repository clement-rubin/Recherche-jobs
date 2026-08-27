import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepMotsClesExclus } from '@/components/search/steps/StepMotsClesExclus'

describe('StepMotsClesExclus', () => {
  it('adds a keyword via the TagInput', async () => {
    const onChange = jest.fn()
    render(<StepMotsClesExclus value={[]} onChange={onChange} domaineKey="data_ia" conflictsWith={[]} />)
    await userEvent.type(screen.getByRole('textbox'), 'senior{enter}')
    expect(onChange).toHaveBeenCalledWith(['senior'])
  })

  it('toggles a contract-type preset button', async () => {
    const onChange = jest.fn()
    render(<StepMotsClesExclus value={[]} onChange={onChange} domaineKey="data_ia" conflictsWith={[]} />)
    await userEvent.click(screen.getByText('+ CDI'))
    expect(onChange).toHaveBeenCalledWith(['cdi'])
  })

  it('blocks adding a keyword already present in the include list', async () => {
    const onChange = jest.fn()
    render(
      <StepMotsClesExclus
        value={[]}
        onChange={onChange}
        domaineKey="data_ia"
        conflictsWith={['data scientist']}
      />
    )
    await userEvent.type(screen.getByRole('textbox'), 'data scientist{enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/déjà dans les mots-clés à inclure/i)).toBeInTheDocument()
  })

  it('blocks a preset click that conflicts with the include list', async () => {
    const onChange = jest.fn()
    render(
      <StepMotsClesExclus
        value={[]}
        onChange={onChange}
        domaineKey="data_ia"
        conflictsWith={['cdi']}
      />
    )
    await userEvent.click(screen.getByText('+ CDI'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/déjà dans les mots-clés à inclure/i)).toBeInTheDocument()
  })

  it('clears the error after a valid change following a blocked add', async () => {
    const onChange = jest.fn()
    render(
      <StepMotsClesExclus
        value={[]}
        onChange={onChange}
        domaineKey="data_ia"
        conflictsWith={['data scientist']}
      />
    )
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'data scientist{enter}')
    expect(screen.getByText(/déjà dans les mots-clés à inclure/i)).toBeInTheDocument()
    await userEvent.clear(input)
    await userEvent.type(input, 'senior{enter}')
    expect(onChange).toHaveBeenCalledWith(['senior'])
    expect(screen.queryByText(/déjà dans les mots-clés à inclure/i)).not.toBeInTheDocument()
  })
})
