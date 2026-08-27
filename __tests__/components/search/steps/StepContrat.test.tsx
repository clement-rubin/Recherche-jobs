import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepContrat } from '@/components/search/steps/StepContrat'

describe('StepContrat', () => {
  it('toggles a contract type button', async () => {
    const onChange = jest.fn()
    render(
      <StepContrat typeContrat={[]} dureeContrat="peu_importe" salaireMin="" onChange={onChange} />
    )
    await userEvent.click(screen.getByText('cdi'))
    expect(onChange).toHaveBeenCalledWith({ type_contrat: ['cdi'] })
  })

  it('un-toggles an active contract type button', async () => {
    const onChange = jest.fn()
    render(
      <StepContrat typeContrat={['cdi']} dureeContrat="peu_importe" salaireMin="" onChange={onChange} />
    )
    await userEvent.click(screen.getByText('cdi'))
    expect(onChange).toHaveBeenCalledWith({ type_contrat: [] })
  })

  it('changes duree_contrat on select', async () => {
    const onChange = jest.fn()
    render(
      <StepContrat typeContrat={[]} dureeContrat="peu_importe" salaireMin="" onChange={onChange} />
    )
    await userEvent.selectOptions(screen.getByRole('combobox'), '1_semaine')
    expect(onChange).toHaveBeenCalledWith({ duree_contrat: '1_semaine' })
  })

  it('changes salaire_min on typing a number', async () => {
    const onChange = jest.fn()
    render(
      <StepContrat typeContrat={[]} dureeContrat="peu_importe" salaireMin="" onChange={onChange} />
    )
    await userEvent.type(screen.getByPlaceholderText('1500'), '9')
    expect(onChange).toHaveBeenCalledWith({ salaire_min: 9 })
  })
})
