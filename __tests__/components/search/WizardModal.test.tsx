import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardModal } from '@/components/search/WizardModal'
import type { SearchProfile } from '@/lib/supabase/types'

describe('WizardModal', () => {
  it('disables "Suivant" on step 1 until a name is entered', async () => {
    render(<WizardModal onSave={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByText('Suivant')).toBeDisabled()
    await userEvent.type(screen.getByPlaceholderText(/Data\/IA Lille/i), 'Mon profil')
    expect(screen.getByText('Suivant')).toBeEnabled()
  })

  it('advances to step 2 (villes) after clicking "Suivant"', async () => {
    render(<WizardModal onSave={jest.fn()} onClose={jest.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/Data\/IA Lille/i), 'Mon profil')
    await userEvent.click(screen.getByText('Suivant'))
    expect(screen.getByText('Villes recherchées')).toBeInTheDocument()
  })

  it('does not allow jumping to an unvisited step via the progress bar', async () => {
    render(<WizardModal onSave={jest.fn()} onClose={jest.fn()} />)
    const step3Dot = screen.getByLabelText('Étape 3 : Mots-clés inclus')
    expect(step3Dot).toBeDisabled()
  })

  it('pre-fills fields and marks all steps visited when editing an existing profile', async () => {
    const profile: SearchProfile = {
      id: 'p1',
      user_id: 'u1',
      nom: 'Existant',
      actif: true,
      domaine: 'data_ia',
      type_contrat: [],
      mots_cles: ['data scientist'],
      mots_cles_exclus: [],
      qualifications: [],
      duree_contrat: 'peu_importe',
      localisations: [{ ville: 'Lille', rayon_km: 30 }],
      salaire_min: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    render(<WizardModal profile={profile} onSave={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByDisplayValue('Existant')).toBeInTheDocument()
    const step6Dot = screen.getByLabelText('Étape 6 : Contrat')
    expect(step6Dot).toBeEnabled()
  })

  it('calls onSave with the resolved domaine and filtered localisations on the last step', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    const profile: SearchProfile = {
      id: 'p1',
      user_id: 'u1',
      nom: 'Existant',
      actif: true,
      domaine: 'data_ia',
      type_contrat: [],
      mots_cles: [],
      mots_cles_exclus: [],
      qualifications: [],
      duree_contrat: 'peu_importe',
      localisations: [{ ville: 'Lille', rayon_km: 30 }],
      salaire_min: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    render(<WizardModal profile={profile} onSave={onSave} onClose={jest.fn()} />)
    await userEvent.click(screen.getByLabelText('Étape 6 : Contrat'))
    await userEvent.click(screen.getByText('Enregistrer'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Existant',
        domaine: 'data_ia',
        localisations: [{ ville: 'Lille', rayon_km: 30 }],
      })
    )
  })

  it('disables Enregistrer if the name is cleared after being marked valid', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    const profile: SearchProfile = {
      id: 'p1',
      user_id: 'u1',
      nom: 'Existant',
      actif: true,
      domaine: 'data_ia',
      type_contrat: [],
      mots_cles: [],
      mots_cles_exclus: [],
      qualifications: [],
      duree_contrat: 'peu_importe',
      localisations: [{ ville: 'Lille', rayon_km: 30 }],
      salaire_min: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    render(<WizardModal profile={profile} onSave={onSave} onClose={jest.fn()} />)
    const nomInput = screen.getByDisplayValue('Existant')
    await userEvent.clear(nomInput)
    await userEvent.click(screen.getByLabelText('Étape 6 : Contrat'))
    expect(screen.getByText('Enregistrer')).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
