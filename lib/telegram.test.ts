/**
 * @jest-environment node
 */

const originalEnv = process.env
const originalFetch = global.fetch

describe('sendTelegramMessage', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '12345' }
    global.fetch = jest.fn()
  })

  afterAll(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it('POSTs to the Telegram sendMessage API with the configured chat id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '' })
    const { sendTelegramMessage } = await import('@/lib/telegram')

    await sendTelegramMessage('hello')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '12345',
          text: 'hello',
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      })
    )
  })

  it('throws on a non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' })
    const { sendTelegramMessage } = await import('@/lib/telegram')

    await expect(sendTelegramMessage('hello')).rejects.toThrow('Telegram send failed: 400 — Bad Request')
  })

  it('no-ops with a warning when TELEGRAM_BOT_TOKEN is unset', async () => {
    process.env.TELEGRAM_BOT_TOKEN = ''
    const { sendTelegramMessage } = await import('@/lib/telegram')
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await sendTelegramMessage('hello')

    expect(global.fetch).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
