/**
 * @jest-environment node
 */

const mockGroqResponse = (content: object) => ({
  choices: [{ message: { content: JSON.stringify(content) } }]
})

jest.mock('groq-sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(
            mockGroqResponse({
              type: 'reponse',
              resultat: 'refus',
              entreprise: 'Decathlon',
              poste: null,
              lien: null,
            })
          ),
        },
      },
    })),
  }
})

import { parseEmailIntent } from '@/lib/email/parser'

describe('parseEmailIntent', () => {
  it('detects refus from email content', async () => {
    const result = await parseEmailIntent({
      sujet: 'Suite à votre candidature',
      corps: 'Nous avons le regret de vous informer que votre candidature n\'a pas été retenue.',
    })
    expect(result.type).toBe('reponse')
    expect(result.resultat).toBe('refus')
  })

  it('extracts entreprise from parsed email', async () => {
    const result = await parseEmailIntent({
      sujet: 'Candidature Decathlon',
      corps: 'Bonjour, merci de votre intérêt pour Decathlon.',
    })
    expect(result.entreprise).toBe('Decathlon')
  })
})
