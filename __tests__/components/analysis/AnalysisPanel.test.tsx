import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel'
import { makeAnalysis, makeResearch } from '@/test-utils/analysis-fixture'

describe('AnalysisPanel', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else delete (navigator as unknown as Record<string, unknown>).clipboard
  })

  it('shows the priority badge, reason and accroche', () => {
    render(<AnalysisPanel analysis={makeAnalysis()} />)
    expect(screen.getByLabelText('Priorité Haute, 93')).toHaveTextContent('Haute · 93')
    expect(screen.getByText('Python couvert, Spark manquant.')).toBeInTheDocument()
    expect(screen.getByText(/Thales mise sur la confiance/)).toBeInTheDocument()
  })

  it('lists present skills with their CV proof and missing ones apart', () => {
    render(<AnalysisPanel analysis={makeAnalysis()} />)
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText(/API Flask du projet Fridgia/)).toBeInTheDocument()
    expect(screen.getByText('Spark')).toBeInTheDocument()
  })

  it('flags blocking missing requirements', () => {
    const analysis = makeAnalysis({
      exigences: [{ competence: 'Anglais C1', obligatoire: true, present: false, preuve_cv: null, bloquante: true }],
    })
    render(<AnalysisPanel analysis={analysis} />)
    expect(screen.getByText(/bloquante/i)).toBeInTheDocument()
  })

  it('copies the accroche to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<AnalysisPanel analysis={makeAnalysis()} />)
    await user.click(screen.getByRole('button', { name: /copier/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Thales mise sur'))
    expect(await screen.findByText('Copié')).toBeInTheDocument()
  })

  it('shows a failure message when the clipboard is unavailable', async () => {
    const user = userEvent.setup()
    const writeText = jest.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<AnalysisPanel analysis={makeAnalysis()} />)
    await user.click(screen.getByRole('button', { name: /copier/i }))
    expect(await screen.findByText('Échec de la copie')).toBeInTheDocument()
  })

  it('renders company sources as links', () => {
    render(<AnalysisPanel analysis={makeAnalysis()} />)
    expect(screen.getByRole('link', { name: /Confiance et intégrité/ })).toHaveAttribute('href', 'https://www.thalesgroup.com/fr/valeurs')
  })

  it('shows warnings and the insufficient-research note', () => {
    const analysis = makeAnalysis({
      entreprise_recherche: makeResearch({ statut: 'insuffisante', valeurs: [], actualites: [] }),
      avertissements: ['Recherche web indisponible'],
    })
    render(<AnalysisPanel analysis={analysis} />)
    expect(screen.getByText('Recherche web indisponible')).toBeInTheDocument()
    expect(screen.getByText(/aucune information fiable/i)).toBeInTheDocument()
  })

  it('hides the accroche for an expired offer', () => {
    const analysis = makeAnalysis({
      priorite: { niveau: 'expiree', score: 0, urgence: 0, raison: 'Date limite dépassée.' },
      accroche: { texte: '', valeur_citee: null, experience_cv_liee: null, avertissement: null },
    })
    render(<AnalysisPanel analysis={analysis} />)
    expect(screen.getByLabelText('Priorité Expirée')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copier/i })).not.toBeInTheDocument()
  })

  it('omits the suggested text for a "retirer" recommendation with empty text', () => {
    const analysis = makeAnalysis({
      recommandations_cv: [
        { section: 'Loisirs', action: 'retirer', texte_actuel: 'Photographie', texte_suggere: '', source_cv_maitre: null },
      ],
    })
    const { container } = render(<AnalysisPanel analysis={analysis} />)
    expect(screen.getByText(/Retirer · Loisirs/)).toBeInTheDocument()
    expect(screen.getByText(/Photographie/)).toBeInTheDocument()
    expect(container.querySelectorAll('li p:not(.italic)').length).toBe(0)
  })
})
