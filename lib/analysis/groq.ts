import Groq from 'groq-sdk'
import { SetupError } from './errors'

let _groq: Groq | null = null

export function getGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new SetupError('GROQ_API_KEY manquante')
  if (!_groq) _groq = new Groq({ apiKey })
  return _groq
}

export async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      if ((err as { status?: number } | null)?.status === 429 && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2000
        console.warn(`[groq] 429 rate limit, retry in ${waitMs}ms`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

export async function groqJson(opts: {
  model: string
  system: string
  user: string
  maxTokens: number
  temperature?: number
  timeoutMs?: number
}): Promise<string> {
  // groq-sdk retries 429/5xx on its own; callWithRetry owns retries here, so disable the SDK's.
  const completion = await callWithRetry(() => getGroq().chat.completions.create({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    response_format: { type: 'json_object' },
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens,
  }, { maxRetries: 0, timeout: opts.timeoutMs ?? 20000 }))
  const raw = completion.choices[0]?.message?.content
  if (!raw) throw new Error('Empty response from Groq')
  return raw
}
