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
      { ville: '', rayon_km: 30 },
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
})
