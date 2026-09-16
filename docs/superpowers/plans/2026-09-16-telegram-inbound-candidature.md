# Telegram Inbound Candidature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user text the Telegram bot after a call and have it create or update a candidature directly in JobTrackeria, reusing the existing Groq intent-parser from the voice assistant.

**Architecture:** A new `app/api/telegram/webhook/route.ts` receives Telegram updates, validates a secret header + chat-id allowlist, calls the existing `processIntent` (Groq) with recent applications for context, then executes the action through a new shared `lib/assistant/executeIntent.ts` helper extracted from the voice-assistant route (also gains `add_note` support, which the voice assistant never actually implemented despite Groq returning that intent). Replies are sent back via a new `lib/telegram.ts`. All DB access uses a new service-role admin client since there's no user session in a webhook.

**Tech Stack:** Next.js 16 App Router route handler, `@supabase/supabase-js` (service-role client), existing `groq-sdk` integration, Jest + ts-jest (node environment) for tests.

Spec: `docs/superpowers/specs/2026-09-16-telegram-inbound-candidature-design.md`

---

### Task 1: Admin Supabase client

**Files:**
- Create: `lib/supabase/admin.ts`
- Test: `__tests__/lib/supabase-admin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */

describe('createAdminSupabase', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is not set', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    expect(() => createAdminSupabase()).toThrow('SUPABASE_SERVICE_ROLE_KEY is not set')
  })

  it('returns a client when SUPABASE_SERVICE_ROLE_KEY is set', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    const client = createAdminSupabase()
    expect(client).toBeDefined()
    expect(typeof client.from).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/supabase-admin.test.ts -v`
Expected: FAIL with "Cannot find module '@/lib/supabase/admin'"

- [ ] **Step 3: Write minimal implementation**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Service-role client: bypasses RLS, must only ever be used server-side for
// operations that can't go through the public anon-key client — currently
// just the Telegram webhook, which has no user session to authenticate with.
// Never import this from client-side ('use client') code.
export const createAdminSupabase = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/lib/supabase-admin.test.ts -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/admin.ts __tests__/lib/supabase-admin.test.ts
git commit -m "feat: add service-role admin Supabase client"
```

---

### Task 2: Extract shared `executeIntent` helper (+ implement `add_note`)

The current `app/api/assistant/process/route.ts` (lines 61-125) only executes `update_application` and `add_application` — `add_note` is a valid intent Groq can return (see `lib/assistant/groq.ts` system prompt) but nothing in the route ever acts on it; it silently falls through and gets logged as `success: false`. This task extracts the execution logic into a standalone, testable helper and fixes that gap, since the Telegram webhook needs `add_note` to work.

**Files:**
- Create: `lib/assistant/executeIntent.ts`
- Test: `lib/assistant/executeIntent.test.ts`
- Modify: `app/api/assistant/process/route.ts:61-125`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage lib/assistant/executeIntent.test.ts -v`
Expected: FAIL with "Cannot find module '@/lib/assistant/executeIntent'"

- [ ] **Step 3: Write minimal implementation**

```ts
import type { AssistantIntent } from './groq'

type RecentApp = { id: string; entreprise: string; poste: string; statut: string }

function findFuzzyMatch(recentApps: RecentApp[], entreprise: string): RecentApp | undefined {
  const needle = entreprise.toLowerCase()
  return recentApps.find(
    a => a.entreprise.toLowerCase().includes(needle) || needle.includes(a.entreprise.toLowerCase())
  )
}

function appendTimestampedNote(existingNotes: string | null, note: string): string {
  const timestamp = new Date().toLocaleDateString('fr-FR')
  return existingNotes
    ? `${existingNotes}\n[${timestamp}] ${note}`
    : `[${timestamp}] ${note}`
}

// supabase is typed loosely (matches the rest of the codebase's pragmatic
// `as any` usage around Insert/Update — see lib/supabase/types.ts, whose
// hand-written Omit/Partial types don't conform cleanly to the generated
// PostgrestClient generics).
export async function executeIntent(
  supabase: any,
  userId: string,
  transcription: string,
  intentResult: AssistantIntent,
  recentApps: RecentApp[],
  source: string
): Promise<{ executed: boolean }> {
  const { intent, action } = intentResult
  let executed = false

  try {
    if (intent === 'update_application' && action.entreprise) {
      const match = findFuzzyMatch(recentApps, action.entreprise as string)

      if (match) {
        const VALID_STATUTS = ['en_cours', 'relance', 'termine'] as const
        const VALID_RESULTATS = ['accepte', 'refus'] as const
        const update: Record<string, unknown> = {}
        if (action.statut && VALID_STATUTS.includes(action.statut as any)) update.statut = action.statut
        if (action.resultat && VALID_RESULTATS.includes(action.resultat as any)) update.resultat = action.resultat
        if (action.note) {
          const { data: current } = await supabase.from('applications').select('notes').eq('id', match.id).single()
          update.notes = appendTimestampedNote((current as { notes: string | null } | null)?.notes ?? null, action.note as string)
        }

        if (Object.keys(update).length > 0) {
          await supabase.from('applications').update(update).eq('id', match.id).eq('user_id', userId)
          executed = true
        }
      }
    } else if (intent === 'add_application' && action.entreprise) {
      await supabase.from('applications').insert({
        user_id: userId,
        entreprise: action.entreprise as string,
        poste: (action.poste as string) ?? 'Poste à préciser',
        type_contrat: (action.type_contrat as any) ?? 'interim',
        source,
      })
      executed = true
    } else if (intent === 'add_note' && action.entreprise && action.note) {
      const match = findFuzzyMatch(recentApps, action.entreprise as string)

      if (match) {
        const { data: current } = await supabase.from('applications').select('notes').eq('id', match.id).single()
        const notes = appendTimestampedNote((current as { notes: string | null } | null)?.notes ?? null, action.note as string)
        await supabase.from('applications').update({ notes }).eq('id', match.id).eq('user_id', userId)
        executed = true
      }
    }

    await supabase.from('assistant_logs').insert({
      user_id: userId,
      transcription,
      intent,
      action_taken: JSON.stringify(action),
      success: executed,
    })
  } catch (err) {
    console.error('[executeIntent] Action execution failed', err)
  }

  return { executed }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage lib/assistant/executeIntent.test.ts -v`
Expected: PASS (9 tests)

- [ ] **Step 5: Update the voice-assistant route to use the shared helper**

Replace `app/api/assistant/process/route.ts` lines 61-125 (the `try { ... } catch (err) { ... }` execution block) with:

```ts
  const { executed } = await executeIntent(
    supabase,
    user.id,
    transcription,
    intentResult,
    recentApps,
    'assistant'
  )
```

Add the import near the top of the file:

```ts
import { executeIntent } from '@/lib/assistant/executeIntent'
```

Remove the now-unused inline logic — the file should go from defining `let executed = false` and a large `try/catch` to just the single `executeIntent(...)` call above, keeping everything before it (auth check, transcription validation, recent-apps fetch, `processIntent` call, `requires_confirmation`/`isRefusal` check) unchanged.

The removed block also deleted `const { intent, action } = intentResult` (old line 63), but the final log line after it still reads `intent` — update that line (old line 127) to read from `intentResult` directly:

```ts
  console.log('[assistant/process] Done', { intent: intentResult.intent, executed, totalMs: Date.now() - t0 })
  return NextResponse.json({ ...intentResult, executed })
}
```

- [ ] **Step 6: Run the full test suite to check for regressions**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: PASS, no TypeScript errors, `__tests__/assistant.test.ts` (processIntent tests) still green

- [ ] **Step 7: Commit**

```bash
git add lib/assistant/executeIntent.ts lib/assistant/executeIntent.test.ts app/api/assistant/process/route.ts
git commit -m "refactor: extract executeIntent helper, implement add_note execution"
```

---

### Task 3: Telegram send helper

**Files:**
- Create: `lib/telegram.ts`
- Test: `lib/telegram.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage lib/telegram.test.ts -v`
Expected: FAIL with "Cannot find module '@/lib/telegram'"

- [ ] **Step 3: Write minimal implementation**

```ts
export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping Telegram send')
    return
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Telegram send failed: ${res.status} — ${body}`)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage lib/telegram.test.ts -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/telegram.ts lib/telegram.test.ts
git commit -m "feat: add sendTelegramMessage helper"
```

---

### Task 4: Telegram webhook route

**Files:**
- Create: `app/api/telegram/webhook/route.ts`
- Test: `__tests__/api/telegram-webhook.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
      expect.anything(), USER_ID, expect.any(String),
      expect.objectContaining({ intent: 'add_application' }),
      expect.any(Array), 'telegram'
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/api/telegram-webhook.test.ts -v`
Expected: FAIL with "Cannot find module '@/app/api/telegram/webhook/route'"

- [ ] **Step 3: Write minimal implementation**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { processIntent } from '@/lib/assistant/groq'
import { executeIntent } from '@/lib/assistant/executeIntent'
import { sendTelegramMessage } from '@/lib/telegram'
import type { Application } from '@/lib/supabase/types'

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn('[telegram/webhook] Invalid secret token')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update: TelegramUpdate = await req.json()
  const message = update.message
  if (!message?.text) {
    return NextResponse.json({ ok: true })
  }

  if (message.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
    console.warn('[telegram/webhook] Message from unknown chat', { chatId: message.chat.id })
    return NextResponse.json({ ok: true })
  }

  const userId = process.env.TELEGRAM_OWNER_USER_ID
  if (!userId) {
    console.error('[telegram/webhook] TELEGRAM_OWNER_USER_ID not set')
    await sendTelegramMessage('❌ Assistant indisponible, réessaie dans quelques secondes')
    return NextResponse.json({ ok: true })
  }

  const supabase = createAdminSupabase()
  const { data: applications } = await supabase
    .from('applications')
    .select('id, entreprise, poste, statut')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(10)

  const recentApps = ((applications ?? []) as Partial<Application>[]).map(a => ({
    id: a.id ?? '',
    entreprise: a.entreprise ?? '',
    poste: a.poste ?? '',
    statut: a.statut ?? 'en_cours',
  }))

  let intentResult
  try {
    intentResult = await processIntent(message.text, recentApps)
  } catch (err) {
    console.error('[telegram/webhook] Groq error', err)
    await sendTelegramMessage('❌ Assistant indisponible, réessaie dans quelques secondes')
    return NextResponse.json({ ok: true })
  }

  const { intent, action } = intentResult
  const entreprise = (action?.entreprise as string) ?? ''

  const isRefusal = intent === 'update_application' &&
    action?.statut === 'termine' &&
    action?.resultat === 'refus'

  if (intentResult.requires_confirmation || isRefusal) {
    await sendTelegramMessage(`⚠️ ${entreprise} détecté comme refusé — confirme dans l'app pour valider`)
    return NextResponse.json({ ok: true })
  }

  if (intent === 'unknown') {
    await sendTelegramMessage("🤔 Je n'ai pas compris, reformule ou utilise l'app")
    return NextResponse.json({ ok: true })
  }

  const { executed } = await executeIntent(supabase, userId, message.text, intentResult, recentApps, 'telegram')

  let reply: string
  if (intent === 'add_application' && executed) {
    reply = `✅ Ajouté : ${entreprise} — ${(action?.poste as string) ?? 'Poste à préciser'} (${(action?.type_contrat as string) ?? 'interim'})`
  } else if (intent === 'update_application' && executed) {
    reply = `✅ Mis à jour : ${entreprise} → ${(action?.resultat as string) ?? (action?.statut as string) ?? ''}`
  } else if (intent === 'add_note' && executed) {
    reply = `✅ Note ajoutée à ${entreprise}`
  } else if ((intent === 'update_application' || intent === 'add_note') && !executed) {
    reply = `🤔 Candidature "${entreprise}" introuvable dans les 10 dernières`
  } else {
    reply = "🤔 Je n'ai pas compris, reformule ou utilise l'app"
  }

  await sendTelegramMessage(reply)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/api/telegram-webhook.test.ts -v`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/telegram/webhook/route.ts __tests__/api/telegram-webhook.test.ts
git commit -m "feat: add Telegram inbound webhook for candidature updates"
```

---

### Task 5: Environment variables & setup docs

**Files:**
- Modify: `CLAUDE.md` (environment variable table + a new Key Design Decisions bullet)
- Modify: `.env.local.example`

- [ ] **Step 1: Add the four Telegram env vars to `CLAUDE.md`'s environment variable table**

Add these rows to the table (after the `GROQ_API_KEY` row):

```markdown
| `TELEGRAM_BOT_TOKEN` | telegram.ts / telegram webhook |
| `TELEGRAM_CHAT_ID` | telegram.ts / telegram webhook (sender allowlist) |
| `TELEGRAM_WEBHOOK_SECRET` | telegram webhook (validates calls are really from Telegram) |
| `TELEGRAM_OWNER_USER_ID` | telegram webhook (Supabase user UUID every insert/update is scoped to) |
```

- [ ] **Step 2: Add a Key Design Decisions bullet to `CLAUDE.md`**

Add after the GSAP bullet:

```markdown
- **Telegram inbound bot** (`app/api/telegram/webhook/route.ts`): single-user only — no chat-to-account linking. Free-text French messages are parsed by the same Groq `processIntent` the voice assistant uses (`lib/assistant/groq.ts`), and executed through the shared `lib/assistant/executeIntent.ts` helper (also used by `app/api/assistant/process/route.ts`). Requires registering the webhook once after deploy:
  ```bash
  curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
    -d url="https://YOUR-APP.netlify.app/api/telegram/webhook" \
    -d secret_token="$TELEGRAM_WEBHOOK_SECRET"
  ```
```

- [ ] **Step 3: Add the four env vars to `.env.local.example`**

Append after the `# Assistant` section:

```
# Telegram inbound bot
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_CHAT_ID=your-telegram-chat-id
TELEGRAM_WEBHOOK_SECRET=generate-with-openssl-rand-hex-32
TELEGRAM_OWNER_USER_ID=your-supabase-user-uuid
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .env.local.example
git commit -m "docs: document Telegram inbound bot env vars and webhook setup"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run the full type-check and test suite**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: PASS, zero TypeScript errors, all test suites green (including the pre-existing `__tests__/assistant.test.ts`, `__tests__/api/applications.test.ts`, `__tests__/api/jobs-fetch.test.ts`)

- [ ] **Step 2: Manual sanity check of the design's out-of-scope list**

Confirm no code was added for: chat-to-account linking, Telegram inline buttons/multi-turn confirmation, editing/undoing a previous message, voice/image Telegram content. (Nothing to do here if the tasks above were followed — this is a final read-through of the diff against the spec's "Out of scope" section.)

Run: `git log --oneline -6` and skim `git diff master~6..master --stat` (adjust the count to however many commits Tasks 1-5 produced) to confirm the changed files match exactly: `lib/supabase/admin.ts`, `lib/assistant/executeIntent.ts`, `app/api/assistant/process/route.ts`, `lib/telegram.ts`, `app/api/telegram/webhook/route.ts`, `CLAUDE.md`, `.env.local.example`, plus their test files.
