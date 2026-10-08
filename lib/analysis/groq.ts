import Groq from 'groq-sdk'

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries) {
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
}): Promise<string> {
  const completion = await callWithRetry(() => groq.chat.completions.create({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    response_format: { type: 'json_object' },
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens,
  }))
  const raw = completion.choices[0]?.message?.content
  if (!raw) throw new Error('Empty response from Groq')
  return raw
}
