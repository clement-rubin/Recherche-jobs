import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OfferDetailModal } from '@/components/offers/OfferDetailModal'
import { makeAnalysis } from '@/test-utils/analysis-fixture'
import type { Offer } from '@/lib/supabase/types'

const offer: Offer = {
  id: 'o1', user_id: 'u1', titre: 'Stage Data', entreprise: 'Thales', lien: null,
  salaire_min: null, salaire_max: null, localisation: 'Lille', source: 'jsearch',
  type_contrat: 'stage', statut: 'non_traite', date_scraped: '2026-10-01', raw_data: null,
}

const mockFetch = (body: object, ok = true) =>
  (global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch)

const setup = (o: Offer = offer, onAnalyzed = jest.fn()) => {
  render(<OfferDetailModal offer={o} onAction={jest.fn()} onClose={jest.fn()} onAnalyzed={onAnalyzed} />)
  return { onAnalyzed, user: userEvent.setup() }
}

describe('OfferDetailModal analysis', () => {
  it('analyses on click and shows the panel', async () => {
    mockFetch({ analysis: makeAnalysis(), persisted: true })
    const { user, onAnalyzed } = setup()
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(await screen.findByLabelText('Priorité Haute, 78')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/offers/o1/analyze', expect.objectContaining({ method: 'POST' }))
    expect(onAnalyzed).toHaveBeenCalledWith('o1', expect.objectContaining({ cv_utilise: 'fr' }))
    expect(screen.getByRole('button', { name: 'Réanalyser' })).toBeInTheDocument()
    expect(screen.queryByText(/non enregistrée/i)).not.toBeInTheDocument()
  })

  it('shows a stored analysis immediately', () => {
    setup({ ...offer, analysis: makeAnalysis() })
    expect(screen.getByLabelText('Priorité Haute, 78')).toBeInTheDocument()
  })

  it('asks for the text when the description is missing, then re-sends it', async () => {
    mockFetch({ needsText: true })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    const box = await screen.findByPlaceholderText(/colle ici le texte/i)
    mockFetch({ analysis: makeAnalysis(), persisted: true })
    await user.type(box, 'Texte complet de l offre')
    await user.click(screen.getByRole('button', { name: /analyser ce texte/i }))
    await waitFor(() => expect(screen.getByLabelText('Priorité Haute, 78')).toBeInTheDocument())
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ text: 'Texte complet de l offre' })
  })

  it('shows the API error message', async () => {
    mockFetch({ error: 'Profil candidat non configuré' }, false)
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(await screen.findByText('Profil candidat non configuré')).toBeInTheDocument()
  })

  it('shows a fallback message when the response is not JSON (e.g. gateway timeout)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new SyntaxError('x') },
    }) as unknown as typeof fetch
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("L'analyse a échoué (délai dépassé ?)")
  })

  it('tells the user when the pasted text is still too short', async () => {
    mockFetch({ needsText: true })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    await user.type(await screen.findByLabelText("Texte de l'offre"), 'court')
    await user.click(screen.getByRole('button', { name: /analyser ce texte/i }))
    expect(await screen.findByText("Texte trop court : colle l'offre complète.")).toBeInTheDocument()
  })

  it('clears the not-persisted warning on the next run', async () => {
    mockFetch({ analysis: makeAnalysis(), persisted: false })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(await screen.findByText(/non enregistrée/i)).toBeInTheDocument()
    mockFetch({ error: 'boom' }, false)
    await user.click(screen.getByRole('button', { name: 'Réanalyser' }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.queryByText(/non enregistrée/i)).not.toBeInTheDocument()
  })

  it('still shows the analysis but warns when it was not persisted', async () => {
    mockFetch({ analysis: makeAnalysis(), persisted: false })
    const { user, onAnalyzed } = setup()
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(await screen.findByLabelText('Priorité Haute, 78')).toBeInTheDocument()
    expect(onAnalyzed).toHaveBeenCalledWith('o1', expect.objectContaining({ cv_utilise: 'fr' }))
    expect(
      screen.getByText('Analyse affichée mais non enregistrée (vérifie que la migration 006 est appliquée).')
    ).toBeInTheDocument()
  })
})
