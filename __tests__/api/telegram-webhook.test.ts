/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockProcessIntent = jest.fn()
const mockExecuteIntent = jest.fn()
const mockSendTelegramMessage = jest.fn().mockResolvedValue(undefined)
const mockCreateAdminSupabase = jest.fn()

jest.mock('@/lib/assistant/groq', () => ({ processIntent: (...args: unknown[]) => mockProcessIntent(...args) }))
jest.mock('@/lib/assistant/executeIntent', () => ({ executeIntent: (...args: unknown[]) => mockExecuteIntent(...args) }))
jest.mock('@/lib/telegram', () => ({ sendTelegramMessage: (...args: unknown[]) => mockSendTelegramMessage(...args) }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: (...args: unknown[]) => mockCreateAdminSupabase(...args) }))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-webhook-secret'
const CHAT_ID = '999888'
const USER_ID = 'owner-user-id'

function makeAdminSupabaseMock(recentApps: unknown[] = []) {
  const limit = jest.fn().mockResolvedValue({ data: recentApps, error: null })
  const order = jest.fn().mockReturnValue({ limit })
  const eq = jest.fn().mockReturnValue({ order })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return { from }
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': SECRET, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function textUpdate(text: string, chatId = CHAT_ID) {
  return { message: { chat: { id: Number(chatId) }, text } }
}

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
    process.env.TELEGRAM_CHAT_ID = CHAT_ID
    process.env.TELEGRAM_OWNER_USER_ID = USER_ID
    mockCreateAdminSupabase.mockReturnValue(makeAdminSupabaseMock([
      { id: 'app-1', entreprise: 'Capgemini', poste: 'Développeur', statut: 'en_cours' },
    ]))
  })

  it('rejects a request with a missing or wrong secret header', async () => {
    const res = await POST(makeRequest(textUpdate('hello'), { 'x-telegram-bot-api-secret-token': 'wrong' }))
    expect(res.status).toBe(401)
    expect(mockProcessIntent).not.toHaveBeenCalled()
    expect(mockSendTelegramMessage).not.toHaveBeenCalled()
  })

  it('acks and ignores an update with no message.text', async () => {
    const res = await POST(makeRequest({ message: { chat: { id: Number(CHAT_ID) } } }))
    expect(res.status).toBe(200)
    expect(mockProcessIntent).not.toHaveBeenCalled()
  })

  it('acks and ignores a message from an unknown chat id', async () => {
    const res = await POST(makeRequest(textUpdate('hello', '111')))
    expect(res.status).toBe(200)
    expect(mockProcessIntent).not.toHaveBeenCalled()
    expect(mockSendTelegramMessage).not.toHaveBeenCalled()
  })

  it('adds an application and replies with a confirmation', async () => {
    mockProcessIntent.mockResolvedValue({
      intent: 'add_application',
      confidence: 0.9,
      action: { entreprise: 'Amazon', poste: 'Magasinier', type_contrat: 'interim' },
      message: '',
      requires_confirmation: false,
    })
    mockExecuteIntent.mockResolvedValue({ executed: true })

    const res = await POST(makeRequest(textUpdate('Entretien Amazon magasinier interim')))

    expect(res.status).toBe(200)
    expect(mockExecuteIntent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: USER_ID,
        source: 'telegram',
        intentResult: expect.objectContaining({ intent: 'add_application' }),
        recentApps: expect.any(Array),
      })
    )
    expect(mockSendTelegramMessage).toHaveBeenCalledWith('✅ Ajouté : Amazon — Magasinier (interim)')
  })

  it('replies that the candidature was not found when update_application finds no match', async () => {
    mockProcessIntent.mockResolvedValue({
      intent: 'update_application',
      confidence: 0.8,
      action: { entreprise: 'Inconnu SARL', statut: 'en_cours' },
      message: '',
      requires_confirmation: false,
    })
    mockExecuteIntent.mockResolvedValue({ executed: false })

    await POST(makeRequest(textUpdate('Inconnu SARL me recontacte')))

    expect(mockSendTelegramMessage).toHaveBeenCalledWith('🤔 Candidature "Inconnu SARL" introuvable dans les 10 dernières')
  })

  it('does not execute and warns on the refusal guard instead', async () => {
    mockProcessIntent.mockResolvedValue({
      intent: 'update_application',
      confidence: 0.95,
      action: { entreprise: 'Capgemini', statut: 'termine', resultat: 'refus' },
      message: '',
      requires_confirmation: true,
    })

    await POST(makeRequest(textUpdate('Capgemini a refusé ma candidature')))

    expect(mockExecuteIntent).not.toHaveBeenCalled()
    expect(mockSendTelegramMessage).toHaveBeenCalledWith("⚠️ Capgemini détecté comme refusé — confirme dans l'app pour valider")
  })

  it('replies with a fallback message for an unknown intent', async () => {
    mockProcessIntent.mockResolvedValue({
      intent: 'unknown', confidence: 0.2, action: {}, message: '', requires_confirmation: false,
    })

    await POST(makeRequest(textUpdate('blablabla')))

    expect(mockExecuteIntent).not.toHaveBeenCalled()
    expect(mockSendTelegramMessage).toHaveBeenCalledWith("🤔 Je n'ai pas compris, reformule ou utilise l'app")
  })

  it('replies with an unavailable message when Groq throws', async () => {
    mockProcessIntent.mockRejectedValue(new Error('groq down'))

    await POST(makeRequest(textUpdate('salut')))

    expect(mockSendTelegramMessage).toHaveBeenCalledWith('❌ Assistant indisponible, réessaie dans quelques secondes')
  })

  it('replies with an unavailable message when TELEGRAM_OWNER_USER_ID is unset', async () => {
    delete process.env.TELEGRAM_OWNER_USER_ID

    await POST(makeRequest(textUpdate('salut')))

    expect(mockProcessIntent).not.toHaveBeenCalled()
    expect(mockSendTelegramMessage).toHaveBeenCalledWith('❌ Assistant indisponible, réessaie dans quelques secondes')
  })
})
