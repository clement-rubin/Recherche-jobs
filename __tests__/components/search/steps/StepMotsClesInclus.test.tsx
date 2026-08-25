import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepMotsClesInclus } from '@/components/search/steps/StepMotsClesInclus'

describe('StepMotsClesInclus', () => {
  it('adds a keyword via the TagInput', async () => {
    const onChange = jest.fn()
    render(<StepMotsClesInclus value={[]} onChange={onChange} domaineKey="data_ia" conflictsWith={[]} />)
    await userEvent.type(screen.getByRole('textbox'), 'data scientist{enter}')
    expect(onChange).toHaveBeenCalledWith(['data scientist'])
  })

  it('shows domain suggestions for the selected domaineKey', () => {
    render(<StepMotsClesInclus value={[]} onChange={() => {}} domaineKey="data_ia" conflictsWith={[]} />)
    expect(screen.getByText('data scientist')).toBeInTheDocument()
  })

  it('blocks adding a keyword already present in the exclude list', async () => {
    const onChange = jest.fn()
    render(
      <StepMotsClesInclus
        value={[]}
        onChange={onChange}
        domaineKey="data_ia"
        conflictsWith={['senior']}
      />
    )
    await userEvent.type(screen.getByRole('textbox'), 'senior{enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/déjà dans les mots-clés à exclure/i)).toBeInTheDocument()
  })
})
