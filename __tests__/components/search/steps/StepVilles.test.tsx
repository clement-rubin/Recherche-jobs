import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepVilles } from '@/components/search/steps/StepVilles'
import { reverseGeocode, searchCity } from '@/lib/geo/nominatim'
import type { LocationMapProps } from '@/components/search/map/LocationMap'

// Leaflet can't run in jsdom: replace the dynamically-imported map with buttons
// that trigger each of its callbacks.
jest.mock('next/dynamic', () => () => {
  function MockLocationMap(props: LocationMapProps) {
    return (
      <div>
        <button type="button" onClick={() => props.onPick({ ville: 'Berlin', pays: 'DE', lat: 52.52, lng: 13.405 })}>pick-hub</button>
        <button type="button" onClick={() => props.onPickPoint(50.63, 3.06)}>pick-point</button>
        <button type="button" onClick={() => props.onUnsupported()}>pick-outside</button>
      </div>
    )
  }
  return MockLocationMap
})

jest.mock('@/lib/geo/nominatim', () => ({ reverseGeocode: jest.fn(), searchCity: jest.fn() }))
const mockReverse = reverseGeocode as jest.MockedFunction<typeof reverseGeocode>
const mockSearch = searchCity as jest.MockedFunction<typeof searchCity>

const lille = { ville: 'Lille', pays: 'FR', lat: 50.63, lng: 3.06, rayon_km: 30 }
const berlin = { ville: 'Berlin', pays: 'DE', lat: 52.52, lng: 13.405, rayon_km: 20 }

beforeEach(() => {
  mockReverse.mockReset()
  mockSearch.mockReset()
  mockSearch.mockResolvedValue([])
})

describe('StepVilles', () => {
  it('renders one row per location with country label and slider value', () => {
    render(<StepVilles value={[lille, berlin]} onChange={() => {}} />)
    expect(screen.getByText('Lille')).toBeInTheDocument()
    expect(screen.getByText('Allemagne')).toBeInTheDocument()
    expect(screen.getByLabelText('Rayon autour de Lille')).toHaveValue('30')
    expect(screen.getByText('20 km')).toBeInTheDocument()
  })

  it('updates rayon_km when the slider moves', () => {
    const onChange = jest.fn()
    render(<StepVilles value={[lille, berlin]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Rayon autour de Berlin'), { target: { value: '55' } })
    expect(onChange).toHaveBeenCalledWith([lille, { ...berlin, rayon_km: 55 }])
  })

  it('removes a row when its ✕ button is clicked', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[lille, berlin]} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Supprimer la ville Berlin'))
    expect(onChange).toHaveBeenCalledWith([lille])
  })

  it('adds a hub picked on the map with the default 30 km radius', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[lille]} onChange={onChange} />)
    await userEvent.click(screen.getByText('pick-hub'))
    expect(onChange).toHaveBeenCalledWith([lille, { ville: 'Berlin', pays: 'DE', lat: 52.52, lng: 13.405, rayon_km: 30 }])
  })

  it('ignores a city that is already selected', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[berlin]} onChange={onChange} />)
    await userEvent.click(screen.getByText('pick-hub'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reverse-geocodes a free click and adds the city', async () => {
    mockReverse.mockResolvedValue({ ville: 'Lille', pays: 'FR', lat: 50.63, lng: 3.06 })
    const onChange = jest.fn()
    render(<StepVilles value={[]} onChange={onChange} />)
    await userEvent.click(screen.getByText('pick-point'))
    expect(mockReverse).toHaveBeenCalledWith(50.63, 3.06)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([lille]))
  })

  it('shows a message when no city is found at the clicked point', async () => {
    mockReverse.mockResolvedValue(null)
    render(<StepVilles value={[]} onChange={() => {}} />)
    await userEvent.click(screen.getByText('pick-point'))
    expect(await screen.findByText('Ville introuvable à cet endroit')).toBeInTheDocument()
  })

  it('rejects a reverse-geocoded city in an unsupported country', async () => {
    mockReverse.mockResolvedValue({ ville: 'Belgrade', pays: 'RS', lat: 44.8, lng: 20.4 })
    const onChange = jest.fn()
    render(<StepVilles value={[]} onChange={onChange} />)
    await userEvent.click(screen.getByText('pick-point'))
    expect(await screen.findByText('Pays non couvert par la recherche')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows a message when clicking outside supported countries', async () => {
    render(<StepVilles value={[]} onChange={() => {}} />)
    await userEvent.click(screen.getByText('pick-outside'))
    expect(screen.getByText('Pays non couvert par la recherche')).toBeInTheDocument()
  })

  it('adds a city from the text search results (search on Enter)', async () => {
    mockSearch.mockResolvedValue([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83 }])
    const onChange = jest.fn()
    render(<StepVilles value={[]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('Rechercher une ville…'), 'Lyon{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: /Lyon/ }))
    expect(mockSearch).toHaveBeenCalledTimes(1)
    expect(mockSearch).toHaveBeenCalledWith('Lyon', expect.arrayContaining(['FR', 'DE']))
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83, rayon_km: 30 }])
  })

  it('does not search while typing, only on explicit request', async () => {
    render(<StepVilles value={[]} onChange={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText('Rechercher une ville…'), 'Lyon')
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('does not search for a query shorter than 2 characters', async () => {
    render(<StepVilles value={[]} onChange={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText('Rechercher une ville…'), 'L{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('searches when the "Rechercher" button is clicked', async () => {
    mockSearch.mockResolvedValue([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83 }])
    render(<StepVilles value={[]} onChange={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText('Rechercher une ville…'), 'Lyon')
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
    expect(mockSearch).toHaveBeenCalledWith('Lyon', expect.arrayContaining(['FR', 'DE']))
    expect(await screen.findByRole('button', { name: /Lyon/ })).toBeInTheDocument()
  })

  it('clears the results when the query changes after a search', async () => {
    mockSearch.mockResolvedValue([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83 }])
    render(<StepVilles value={[]} onChange={() => {}} />)
    const input = screen.getByPlaceholderText('Rechercher une ville…')
    await userEvent.type(input, 'Lyon{Enter}')
    expect(await screen.findByRole('button', { name: /Lyon/ })).toBeInTheDocument()
    await userEvent.type(input, 's')
    expect(screen.queryByRole('button', { name: /Lyon/ })).not.toBeInTheDocument()
  })

  it('drops results of a search that was in flight when the query changed', async () => {
    let resolve!: (places: Awaited<ReturnType<typeof searchCity>>) => void
    mockSearch.mockReturnValue(new Promise(r => { resolve = r }))
    render(<StepVilles value={[]} onChange={() => {}} />)
    const input = screen.getByPlaceholderText('Rechercher une ville…')
    await userEvent.type(input, 'Lyon{Enter}')
    await userEvent.type(input, 's')
    resolve([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83 }])
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1))
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByRole('button', { name: /Lyon/ })).not.toBeInTheDocument()
  })

  it('backfills coordinates for legacy locations without lat/lng', async () => {
    mockSearch.mockResolvedValue([{ ville: 'Lille', pays: 'FR', lat: 50.63, lng: 3.06 }])
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30 }]} onChange={onChange} />)
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([{ ville: 'Lille', rayon_km: 30, lat: 50.63, lng: 3.06 }])
    )
    expect(mockSearch).toHaveBeenCalledWith('Lille', ['FR'])
  })

  describe('legacy backfill throttling', () => {
    const legacy = [{ ville: 'Lille', rayon_km: 30 }, { ville: 'Lyon', rayon_km: 20 }]

    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('spaces geocoding requests at least 1100 ms apart', async () => {
      mockSearch
        .mockResolvedValueOnce([{ ville: 'Lille', pays: 'FR', lat: 50.63, lng: 3.06 }])
        .mockResolvedValueOnce([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83 }])
      const onChange = jest.fn()
      render(<StepVilles value={legacy} onChange={onChange} />)
      await act(async () => {})
      expect(mockSearch).toHaveBeenCalledTimes(1)
      expect(mockSearch).toHaveBeenLastCalledWith('Lille', ['FR'])

      await act(async () => { await jest.advanceTimersByTimeAsync(1099) })
      expect(mockSearch).toHaveBeenCalledTimes(1)

      await act(async () => { await jest.advanceTimersByTimeAsync(1) })
      expect(mockSearch).toHaveBeenCalledTimes(2)
      expect(mockSearch).toHaveBeenLastCalledWith('Lyon', ['FR'])
      expect(onChange).toHaveBeenCalledWith([
        { ville: 'Lille', rayon_km: 30, lat: 50.63, lng: 3.06 },
        { ville: 'Lyon', rayon_km: 20, lat: 45.76, lng: 4.83 },
      ])
    })

    it('stops issuing requests once unmounted', async () => {
      mockSearch.mockResolvedValue([{ ville: 'Lille', pays: 'FR', lat: 50.63, lng: 3.06 }])
      const onChange = jest.fn()
      const { unmount } = render(<StepVilles value={legacy} onChange={onChange} />)
      await act(async () => {})
      expect(mockSearch).toHaveBeenCalledTimes(1)
      unmount()
      await act(async () => { await jest.advanceTimersByTimeAsync(5000) })
      expect(mockSearch).toHaveBeenCalledTimes(1)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it('clamps an out-of-range legacy radius for display without rewriting it', () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ...lille, rayon_km: 150 }, { ...berlin, rayon_km: -10 }]} onChange={onChange} />)
    expect(screen.getByLabelText('Rayon autour de Lille')).toHaveValue('100')
    expect(screen.getByText('100 km')).toBeInTheDocument()
    expect(screen.getByLabelText('Rayon autour de Berlin')).toHaveValue('0')
    expect(screen.getByText('0 km')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('explains that the radius applies to France Travail only', () => {
    render(<StepVilles value={[lille]} onChange={() => {}} />)
    expect(screen.getByText(
      "Le rayon s'applique aux offres France Travail autour de la ville. Les autres sources cherchent dans la ville (France) ou dans tout le pays (hors France)."
    )).toBeInTheDocument()
  })
})
