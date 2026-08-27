import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepQualifications } from '@/components/search/steps/StepQualifications'

describe('StepQualifications', () => {
  it('adds a qualification via the TagInput', async () => {
    const onChange = jest.fn()
    render(<StepQualifications value={[]} onChange={onChange} domaineKey="data_ia" />)
    await userEvent.type(screen.getByRole('textbox'), 'AWS{enter}')
    expect(onChange).toHaveBeenCalledWith(['AWS'])
  })

  it('shows domain suggestions for the selected domaineKey', () => {
    render(<StepQualifications value={[]} onChange={() => {}} domaineKey="data_ia" />)
    expect(screen.getByText('TensorFlow')).toBeInTheDocument()
  })

  it('shows no suggestions for a domain with no entry', () => {
    render(<StepQualifications value={[]} onChange={() => {}} domaineKey="autre" />)
    expect(screen.queryByText(/Suggestions/i)).not.toBeInTheDocument()
  })
})
