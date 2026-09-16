/**
 * @jest-environment node
 */

import { executeIntent } from '@/lib/assistant/executeIntent'
import type { AssistantIntent } from '@/lib/assistant/groq'

type RecentApp = { id: string; entreprise: string; poste: string; statut: string }

function makeSupabaseMock(opts: {
  existingNotes?: string | null
  insertError?: unknown
  updateError?: unknown
} = {}) {
  const insert = jest.fn().mockResolvedValue({ error: opts.insertError ?? null })
  const single = jest.fn().mockResolvedValue({
    data: opts.existingNotes !== undefined ? { notes: opts.existingNotes } : { notes: null },
  })
  const selectEq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq: selectEq })
  const updateEq2 = jest.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const updateEq1 = jest.fn().mockReturnValue({ eq: updateEq2 })
  const update = jest.fn().mockReturnValue({ eq: updateEq1 })
  const from = jest.fn().mockReturnValue({ insert, select, update })
  return { from, insert, select, update, updateEq1, updateEq2, single }
}

const recentApps: RecentApp[] = [
  { id: 'app-1', entreprise: 'Capgemini', poste: 'Développeur', statut: 'en_cours' },
]

function makeIntent(overrides: Partial<AssistantIntent> = {}): AssistantIntent {
  return {
    intent: 'unknown',
    confidence: 0.9,
    action: {},
    message: '',
    requires_confirmation: false,
    ...overrides,
  }
}

describe('executeIntent', () => {
  it('inserts a new application for add_application', async () => {
    const supabase = makeSupabaseMock()
    const intent = makeIntent({
      intent: 'add_application',
      action: { entreprise: 'Amazon', poste: 'Magasinier', type_contrat: 'interim' },
    })

    const { executed } = await executeIntent(supabase as any, 'user-1', 'texte', intent, recentApps, 'telegram')

    expect(executed).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('applications')
    expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      entreprise: 'Amazon',
      poste: 'Magasinier',
      type_contrat: 'interim',
      source: 'telegram',
    }))
    expect(supabase.from).toHaveBeenCalledWith('assistant_logs')
  })

  it('does not insert for add_application with no entreprise', async () => {
    const supabase = makeSupabaseMock()
    const intent = makeIntent({ intent: 'add_application', action: {} })

    const { executed } = await executeIntent(supabase as any, 'user-1', 'texte', intent, recentApps, 'telegram')

    expect(executed).toBe(false)
    expect(supabase.insert).toHaveBeenCalledTimes(1) // only assistant_logs
  })

  it('updates statut/resultat for update_application when a fuzzy match is found', async () => {
    const supabase = makeSupabaseMock()
    const intent = makeIntent({
      intent: 'update_application',
      action: { entreprise: 'capgemini', statut: 'termine', resultat: 'accepte' },
    })

    const { executed } = await executeIntent(supabase as any, 'user-1', 'texte', intent, recentApps, 'telegram')

    expect(executed).toBe(true)
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ statut: 'termine', resultat: 'accepte' }))
    expect(supabase.updateEq1).toHaveBeenCalledWith('id', 'app-1')
    expect(supabase.updateEq2).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('appends a timestamped note on update_application when action.note is set', async () => {
    const supabase = makeSupabaseMock({ existingNotes: 'ancienne note' })
    const intent = makeIntent({
      intent: 'update_application',
      action: { entreprise: 'Capgemini', note: 'entretien passé' },
    })

    const { executed } = await executeIntent(supabase as any, 'user-1', 'texte', intent, recentApps, 'telegram')

    expect(executed).toBe(true)
    const updateArg = supabase.update.mock.calls[0][0]
    expect(updateArg.notes).toContain('ancienne note')
    expect(updateArg.notes).toContain('entretien passé')
  })

  it('does not execute update_application when no fuzzy match is found', async () => {
    const supabase = makeSupabaseMock()
    const intent = makeIntent({
      intent: 'update_application',
      action: { entreprise: 'Inconnu SARL', statut: 'termine' },
    })

    const { executed } = await executeIntent(supabase as any, 'user-1', 'texte', intent, recentApps, 'telegram')

    expect(executed).toBe(false)
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('appends a note for add_note when a fuzzy match is found', async () => {
    const supabase = makeSupabaseMock({ existingNotes: null })
    const intent = makeIntent({
      intent: 'add_note',
      action: { entreprise: 'Capgemini', note: 'a rappelé pour confirmer le poste' },
    })

    const { executed } = await executeIntent(supabase as any, 'user-1', 'texte', intent, recentApps, 'telegram')

    expect(executed).toBe(true)
    const updateArg = supabase.update.mock.calls[0][0]
    expect(updateArg.notes).toContain('a rappelé pour confirmer le poste')
  })

  it('does not execute add_note when no fuzzy match is found', async () => {
    const supabase = makeSupabaseMock()
    const intent = makeIntent({
      intent: 'add_note',
      action: { entreprise: 'Inconnu SARL', note: 'peu importe' },
    })

    const { executed } = await executeIntent(supabase as any, 'user-1', 'texte', intent, recentApps, 'telegram')

    expect(executed).toBe(false)
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('logs to assistant_logs even when nothing executes', async () => {
    const supabase = makeSupabaseMock()
    const intent = makeIntent({ intent: 'unknown', action: {} })

    const { executed } = await executeIntent(supabase as any, 'user-1', 'blabla', intent, recentApps, 'telegram')

    expect(executed).toBe(false)
    expect(supabase.from).toHaveBeenCalledWith('assistant_logs')
    expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      transcription: 'blabla',
      intent: 'unknown',
      success: false,
    }))
  })

  it('catches errors during execution and returns executed: false instead of throwing', async () => {
    const supabase = makeSupabaseMock({ insertError: new Error('db down') })
    supabase.insert.mockRejectedValueOnce(new Error('db down'))
    const intent = makeIntent({
      intent: 'add_application',
      action: { entreprise: 'Amazon', poste: 'Magasinier' },
    })

    await expect(
      executeIntent(supabase as any, 'user-1', 'texte', intent, recentApps, 'telegram')
    ).resolves.toEqual({ executed: false })
  })
})
