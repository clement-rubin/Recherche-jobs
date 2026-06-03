/**
 * @jest-environment node
 */

const mockGroqCreate = jest.fn()

jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockGroqCreate,
      },
    },
  })),
}))

import { processIntent } from '@/lib/assistant/groq'

const mockIntentResponse = (intent: object) => ({
  choices: [{ message: { content: JSON.stringify(intent) } }],
})

describe('processIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns update_application intent for interview announcement', async () => {
    mockGroqCreate.mockResolvedValueOnce(
      mockIntentResponse({
        intent: 'update_application',
        confidence: 0.95,
        action: { entreprise: 'Decathlon', statut: 'en_cours', note: 'entretien hier' },
        message: "Candidature Decathlon mise à jour avec la note d'entretien.",
        requires_confirmation: false,
      })
    )

    const result = await processIntent(
      "J'ai eu un entretien chez Decathlon hier",
      []
    )

    expect(result.intent).toBe('update_application')
    expect(result.action.entreprise).toBe('Decathlon')
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it('returns add_application intent for new application', async () => {
    mockGroqCreate.mockResolvedValueOnce(
      mockIntentResponse({
        intent: 'add_application',
        confidence: 0.9,
        action: { entreprise: 'Amazon', poste: 'Magasinier', type_contrat: 'interim' },
        message: 'Nouvelle candidature Amazon ajoutée.',
        requires_confirmation: false,
      })
    )

    const result = await processIntent(
      "J'ai postulé chez Amazon pour un poste de magasinier",
      []
    )

    expect(result.intent).toBe('add_application')
    expect(result.action.entreprise).toBe('Amazon')
  })

  it('handles unknown intent gracefully', async () => {
    mockGroqCreate.mockResolvedValueOnce(
      mockIntentResponse({
        intent: 'unknown',
        confidence: 0.3,
        action: {},
        message: "Je n'ai pas compris votre demande.",
        requires_confirmation: false,
      })
    )

    const result = await processIntent('blablabla incompréhensible', [])
    expect(result.intent).toBe('unknown')
  })
})
