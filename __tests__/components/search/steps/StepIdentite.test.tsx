import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepIdentite } from '@/components/search/steps/StepIdentite'

describe('StepIdentite', () => {
  it('calls onChange with nom when typing in the name field', async () => {
    const onChange = jest.fn()
    render(<StepIdentite nom="" domaineKey="data_ia" domaineAutre="" onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText(/Data\/IA Lille/i), 'X')
    expect(onChange).toHaveBeenCalledWith({ nom: 'X' })
  })

  it('calls onChange with domaineKey when selecting a domain', async () => {
    const onChange = jest.fn()
    render(<StepIdentite nom="Test" domaineKey="data_ia" domaineAutre="" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'dev_logiciel')
    expect(onChange).toHaveBeenCalledWith({ domaineKey: 'dev_logiciel' })
  })

  it('shows a free-text field only when domaineKey is "autre"', () => {
    const { rerender } = render(<StepIdentite nom="Test" domaineKey="data_ia" domaineAutre="" onChange={() => {}} />)
    expect(screen.queryByPlaceholderText(/Community management/i)).not.toBeInTheDocument()
    rerender(<StepIdentite nom="Test" domaineKey="autre" domaineAutre="" onChange={() => {}} />)
    expect(screen.getByPlaceholderText(/Community management/i)).toBeInTheDocument()
  })
})
