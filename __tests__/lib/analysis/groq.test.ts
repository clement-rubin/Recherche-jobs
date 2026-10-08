/**
 * @jest-environment node
 */
const mockCreate = jest.fn()

jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })),
}))

import { groqJson } from '@/lib/analysis/groq'

const reply = (content: string | null) => ({ choices: [{ message: { content } }] })

describe('groqJson', () => {
  beforeEach(() => { mockCreate.mockReset(); jest.useRealTimers() })

  it('returns the message content and requests JSON mode', async () => {
    mockCreate.mockResolvedValueOnce(reply('{"ok":true}'))
    const out = await groqJson({ model: 'm', system: 's', user: 'u', maxTokens: 100 })
    expect(out).toBe('{"ok":true}')
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'm',
      response_format: { type: 'json_object' },
      max_tokens: 100,
    }), expect.objectContaining({ maxRetries: 0, timeout: 20000 }))
  })

  it('passes a custom timeout and disables SDK retries', async () => {
    mockCreate.mockResolvedValueOnce(reply('{}'))
    await groqJson({ model: 'm', system: 's', user: 'u', maxTokens: 10, timeoutMs: 8000 })
    expect(mockCreate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ maxRetries: 0, timeout: 8000 }))
  })

  it('throws on empty content', async () => {
    mockCreate.mockResolvedValueOnce(reply(null))
    await expect(groqJson({ model: 'm', system: 's', user: 'u', maxTokens: 10 })).rejects.toThrow('Empty response')
  })

  it('retries once after a 429', async () => {
    jest.useFakeTimers()
    mockCreate.mockRejectedValueOnce({ status: 429 }).mockResolvedValueOnce(reply('{"a":1}'))
    const p = groqJson({ model: 'm', system: 's', user: 'u', maxTokens: 10 })
    await jest.advanceTimersByTimeAsync(2000)
    await expect(p).resolves.toBe('{"a":1}')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('rethrows a non-429 error immediately', async () => {
    mockCreate.mockRejectedValueOnce({ status: 500 })
    await expect(groqJson({ model: 'm', system: 's', user: 'u', maxTokens: 10 })).rejects.toEqual({ status: 500 })
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })
})
