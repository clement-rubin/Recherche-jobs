import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepVilles } from '@/components/search/steps/StepVilles'

describe('StepVilles', () => {
  it('renders one row per location with ville and rayon values', () => {
    render(
      <StepVilles
        value={[{ ville: 'Lille', rayon_km: 30 }, { ville: 'Paris', rayon_km: 20 }]}
        onChange={() => {}}
      />
    )
    expect(screen.getByDisplayValue('Lille')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Paris')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
  })

  it('adds a new empty row when "+ Ajouter une ville" is clicked', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30 }]} onChange={onChange} />)
    await userEvent.click(screen.getByText('+ Ajouter une ville'))
    expect(onChange).toHaveBeenCalledWith([
      { ville: 'Lille', rayon_km: 30 },
      { ville: '', rayon_km: 30, pays: 'FR' },
    ])
  })

  it('removes a row when its ✕ button is clicked', async () => {
    const onChange = jest.fn()
    render(
      <StepVilles
        value={[{ ville: 'Lille', rayon_km: 30 }, { ville: 'Paris', rayon_km: 20 }]}
        onChange={onChange}
      />
    )
    await userEvent.click(screen.getByLabelText('Supprimer la ville Paris'))
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Lille', rayon_km: 30 }])
  })

  it('updates the ville field of the right row on typing', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30 }]} onChange={onChange} />)
    await userEvent.type(screen.getByDisplayValue('Lille'), 'e')
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Lillee', rayon_km: 30 }])
  })

  it('renders the country select for each row, defaulting to France', () => {
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30 }]} onChange={() => {}} />)
    expect(screen.getByDisplayValue('France')).toBeInTheDocument()
  })

  it('updates pays when the country select changes', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Berlin', rayon_km: 30, pays: 'de' }]} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByDisplayValue('Allemagne'), 'FR')
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Berlin', rayon_km: 30, pays: 'FR' }])
  })

  it('adds a new row defaulting to France', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30, pays: 'FR' }]} onChange={onChange} />)
    await userEvent.click(screen.getByText('+ Ajouter une ville'))
    expect(onChange).toHaveBeenCalledWith([
      { ville: 'Lille', rayon_km: 30, pays: 'FR' },
      { ville: '', rayon_km: 30, pays: 'FR' },
    ])
  })

  it('renders city hub suggestion chips for the row\'s country', () => {
    render(<StepVilles value={[{ ville: '', rayon_km: 30, pays: 'DE' }]} onChange={() => {}} />)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.getByText('Munich')).toBeInTheDocument()
  })

  it('fills the row\'s ville when a city hub chip is clicked', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: '', rayon_km: 30, pays: 'DE' }]} onChange={onChange} />)
    await userEvent.click(screen.getByText('Berlin'))
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Berlin', rayon_km: 30, pays: 'DE' }])
  })

  it('shows different city chips after the row\'s country changes', () => {
    const { rerender } = render(
      <StepVilles value={[{ ville: '', rayon_km: 30, pays: 'FR' }]} onChange={() => {}} />
    )
    expect(screen.getByText('Paris')).toBeInTheDocument()

    rerender(<StepVilles value={[{ ville: '', rayon_km: 30, pays: 'DE' }]} onChange={() => {}} />)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.queryByText('Paris')).not.toBeInTheDocument()
  })
})
