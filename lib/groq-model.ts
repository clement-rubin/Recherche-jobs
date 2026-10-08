/**
 * Single source of truth for the Groq chat model.
 * llama-3.3-70b-versatile was retired by Groq on 2026-08-16 (free/developer tiers) —
 * override with GROQ_MODEL when Groq deprecates the next one, no code change needed.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'

/**
 * Model params for chat.completions.create. gpt-oss models are reasoning models:
 * keep reasoning low so it doesn't eat the completion-token budget (max_completion_tokens
 * includes reasoning tokens). The param is rejected by non-reasoning models, so only set it for gpt-oss.
 */
export function groqModelParams(): { model: string; reasoning_effort?: 'low' } {
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
  return model.startsWith('openai/gpt-oss') ? { model, reasoning_effort: 'low' } : { model }
}
