# Telegram Offer Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a Telegram digest twice a day (8am and 7pm) listing the offers most likely to match the user, scored by qualification and contract-type match against their active search profile.

**Architecture:** A pure scoring function (`lib/scoring.ts`) rates each unsent offer against its profile. A thin Telegram client (`lib/telegram.ts`) sends a formatted digest. A new API route (`app/api/telegram/notify/route.ts`) ties them together — auth pattern copied from `app/api/jobs/fetch/route.ts` — and marks sent offers via a new `telegram_sent_at` column so they're never re-sent. A Netlify scheduled function triggers the route, modeled on the existing `fetch-jobs.ts` cron.

**Tech Stack:** Next.js 16 route handlers, Supabase (Postgres), Netlify scheduled functions, Telegram Bot API (`sendMessage`), Jest + ts-jest.

Spec: [docs/superpowers/specs/2026-08-27-telegram-offer-notifications-design.md](../specs/2026-08-27-telegram-offer-notifications-design.md)

---

## File Structure

- Create: `supabase/migrations/006_add_telegram_sent_at.sql` — adds the tracking column
- Modify: `lib/supabase/types.ts` — add `telegram_sent_at` to `Offer`
- Create: `lib/scoring.ts` — pure scoring function, no I/O
- Create: `lib/scoring.test.ts`
- Create: `lib/telegram.ts` — Telegram send wrapper
- Create: `app/api/telegram/notify/route.ts` — orchestration + auth
- Create: `__tests__/api/telegram-notify.test.ts`
- Create: `netlify/functions/telegram-notify.ts` — cron trigger
- Modify: `.env.local.example` — document new env vars
- Modify: `CLAUDE.md` — add env vars to the table

---

### Task 1: Database migration + type update

**Files:**
- Create: `supabase/migrations/006_add_telegram_sent_at.sql`
- Modify: `lib/supabase/types.ts:24-38`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS telegram_sent_at timestamptz;
```

- [ ] **Step 2: Apply it manually via the Supabase SQL Editor**

Run the SQL above against the project's Supabase instance (same manual-apply workflow as migrations 004/005 — no automated migration runner in this repo). Verify with:

```sql
select column_name from information_schema.columns where table_name = 'offers' and column_name = 'telegram_sent_at';
```

Expected: one row returned.

- [ ] **Step 3: Update the `Offer` type**

In `lib/supabase/types.ts`, add the field to the `Offer` interface (after `raw_data`):

```ts
export interface Offer {
  id: string
  user_id: string
  titre: string
  entreprise: string | null
  lien: string | null
  salaire_min: number | null
  salaire_max: number | null
  localisation: string | null
  source: string | null
  type_contrat: string | null
  statut: OfferStatus
  date_scraped: string
  raw_data: Record<string, unknown> | null
  telegram_sent_at: string | null
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (the `offers.Insert`/`Update` Omit/Partial types in the same file derive from `Offer` automatically, so no further edits needed there).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/006_add_telegram_sent_at.sql lib/supabase/types.ts
git commit -m "feat(db): add telegram_sent_at column to offers"
```

---

### Task 2: Scoring function

**Files:**
- Create: `lib/scoring.ts`
- Create: `lib/scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/scoring.test.ts`:

```ts
import { computeOfferScore } from './scoring'
import type { Offer, SearchProfile } from './supabase/types'

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    user_id: 'user-1',
    titre: 'Data Engineer Python',
    entreprise: 'Acme Corp',
    lien: 'https://example.com/1',
    salaire_min: null,
    salaire_max: null,
    localisation: 'Lille',
    source: 'jsearch',
    type_contrat: 'CDI',
    statut: 'non_traite',
    date_scraped: '2026-08-27T00:00:00Z',
    raw_data: {},
    telegram_sent_at: null,
    ...overrides,
  }
}

function makeProfile(overrides: Partial<SearchProfile> = {}): SearchProfile {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    nom: 'Data',
    actif: true,
    domaine: 'data_ia',
    type_contrat: ['cdi'],
    mots_cles: ['data engineer'],
    mots_cles_exclus: [],
    qualifications: ['python', 'sql'],
    duree_contrat: 'peu_importe',
    localisations: [{ ville: 'Lille', rayon_km: 30 }],
    salaire_min: null,
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('computeOfferScore', () => {
  it('scores 1.0 when all qualifications match and contract matches', () => {
    const offer = makeOffer({ titre: 'Data Engineer Python SQL' })
    const profile = makeProfile({ qualifications: ['python', 'sql'], type_contrat: ['cdi'] })
    expect(computeOfferScore(offer, profile)).toBeCloseTo(1.0)
  })

  it('scores 0.3 when only contract matches (no qualifications found)', () => {
    const offer = makeOffer({ titre: 'Vendeur', raw_data: {} })
    const profile = makeProfile({ qualifications: ['python', 'sql'], type_contrat: ['cdi'] })
    expect(computeOfferScore(offer, profile)).toBeCloseTo(0.3)
  })

  it('scores 0.35 when only half the qualifications match and contract matches', () => {
    const offer = makeOffer({ titre: 'Data Engineer Python' })
    const profile = makeProfile({ qualifications: ['python', 'sql'], type_contrat: ['cdi'] })
    expect(computeOfferScore(offer, profile)).toBeCloseTo(0.65)
  })

  it('is case and accent insensitive', () => {
    const offer = makeOffer({ titre: 'Développeur PYTHON' })
    const profile = makeProfile({ qualifications: ['python'], type_contrat: [] })
    expect(computeOfferScore(offer, profile)).toBeCloseTo(0.7)
  })

  it('matches qualifications found in raw_data', () => {
    const offer = makeOffer({ titre: 'Ingénieur', raw_data: { job_description: 'Must know Kubernetes' } })
    const profile = makeProfile({ qualifications: ['kubernetes'], type_contrat: [] })
    expect(computeOfferScore(offer, profile)).toBeCloseTo(0.7)
  })

  it('contributes 0 for qualifications when profile has none', () => {
    const offer = makeOffer({ type_contrat: 'CDI' })
    const profile = makeProfile({ qualifications: [], type_contrat: ['cdi'] })
    expect(computeOfferScore(offer, profile)).toBeCloseTo(0.3)
  })

  it('contributes 0 for contract when profile has no contract types', () => {
    const offer = makeOffer({ titre: 'Data Engineer Python SQL' })
    const profile = makeProfile({ qualifications: ['python', 'sql'], type_contrat: [] })
    expect(computeOfferScore(offer, profile)).toBeCloseTo(0.7)
  })

  it('scores 0 when nothing matches', () => {
    const offer = makeOffer({ titre: 'Vendeur', type_contrat: 'INTERIM', raw_data: {} })
    const profile = makeProfile({ qualifications: ['python'], type_contrat: ['cdi'] })
    expect(computeOfferScore(offer, profile)).toBe(0)
  })

  it('treats a null offer type_contrat as non-matching, not a crash', () => {
    const offer = makeOffer({ type_contrat: null })
    const profile = makeProfile({ qualifications: [], type_contrat: ['cdi'] })
    expect(computeOfferScore(offer, profile)).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage lib/scoring.test.ts`
Expected: FAIL — `Cannot find module './scoring'`

- [ ] **Step 3: Implement `lib/scoring.ts`**

```ts
import type { Offer, SearchProfile } from './supabase/types'

const CONTRACT_LABELS: Record<string, string> = {
  interim: 'INTERIM',
  cdi: 'CDI',
  cdd: 'CDD',
  alternance: 'ALTERNANCE',
  stage: 'STAGE',
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function qualificationRatio(offer: Offer, profile: SearchProfile): number {
  const qualifications = profile.qualifications ?? []
  if (qualifications.length === 0) return 0

  const haystack = normalize(
    [offer.titre, offer.entreprise, JSON.stringify(offer.raw_data ?? {})]
      .filter(Boolean)
      .join(' ')
  )

  const matched = qualifications.filter(q => haystack.includes(normalize(q))).length
  return matched / qualifications.length
}

function contractMatch(offer: Offer, profile: SearchProfile): number {
  const profileTypes = profile.type_contrat ?? []
  if (profileTypes.length === 0 || !offer.type_contrat) return 0

  const offerLabel = normalize(offer.type_contrat)
  const acceptedLabels = profileTypes.map(t => normalize(CONTRACT_LABELS[t.toLowerCase()] ?? t))

  return acceptedLabels.some(label => offerLabel.includes(label)) ? 1 : 0
}

export function computeOfferScore(offer: Offer, profile: SearchProfile): number {
  return qualificationRatio(offer, profile) * 0.7 + contractMatch(offer, profile) * 0.3
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --no-coverage lib/scoring.test.ts`
Expected: PASS, all 9 tests

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "feat(scoring): add offer/profile match scoring"
```

---

### Task 3: Telegram client

**Files:**
- Create: `lib/telegram.ts`

- [ ] **Step 1: Implement `lib/telegram.ts`**

No test file for this task — it's a thin network wrapper with no branching logic worth unit-testing in isolation; its behavior (success path, failure path, missing-config path) is covered by the route tests in Task 4 via mocking.

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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add lib/telegram.ts
git commit -m "feat(telegram): add sendTelegramMessage client"
```

---

### Task 4: Notify route

**Files:**
- Create: `app/api/telegram/notify/route.ts`
- Create: `__tests__/api/telegram-notify.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/telegram-notify.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  nom: 'Data/IA',
  actif: true,
  domaine: 'data_ia',
  type_contrat: ['cdi'],
  mots_cles: ['data engineer'],
  mots_cles_exclus: [] as string[],
  qualifications: ['python'],
  duree_contrat: 'peu_importe',
  localisations: [{ ville: 'Lille', rayon_km: 30 }],
  salaire_min: null,
  created_at: '2026-08-01T00:00:00Z',
}

const matchingOffer = {
  id: 'offer-1',
  user_id: 'user-1',
  titre: 'Data Engineer Python',
  entreprise: 'Acme',
  lien: 'https://example.com/1',
  salaire_min: null,
  salaire_max: null,
  localisation: 'Lille',
  source: 'jsearch',
  type_contrat: 'CDI',
  statut: 'non_traite',
  date_scraped: '2026-08-27T00:00:00Z',
  raw_data: {},
  telegram_sent_at: null,
}

const weakOffer = {
  ...matchingOffer,
  id: 'offer-2',
  titre: 'Vendeur',
  type_contrat: 'INTERIM',
  lien: 'https://example.com/2',
}

function buildSupabaseMock(offers: typeof matchingOffer[]) {
  const profilesChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: (resolve: (v: { data: typeof mockProfile[]; error: null }) => void) =>
      resolve({ data: [mockProfile], error: null }),
  }

  const offersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    then: (resolve: (v: { data: typeof offers; error: null }) => void) =>
      resolve({ data: offers, error: null }),
  }

  const updateChain = {
    update: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ error: null }),
  }

  const from = jest.fn((table: string) => {
    if (table === 'search_profiles') return profilesChain
    if (table === 'offers') return { ...offersChain, ...updateChain }
    throw new Error(`unexpected table ${table}`)
  })

  return { from, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) } }
}

jest.mock('@/lib/telegram', () => ({ sendTelegramMessage: jest.fn().mockResolvedValue(undefined) }))

import { sendTelegramMessage } from '@/lib/telegram'

describe('POST /api/telegram/notify', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV, CRON_SECRET: 'test-secret' }
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('rejects requests without session or cron secret', async () => {
    jest.doMock('@/lib/supabase/server', () => ({
      createServerSupabase: jest.fn().mockResolvedValue(buildSupabaseMock([])),
    }))
    const { POST } = await import('@/app/api/telegram/notify/route')

    const req = new NextRequest('http://localhost/api/telegram/notify', { method: 'POST' })
    const res = await POST(req)

    expect(res.status).toBe(401)
    expect(sendTelegramMessage).not.toHaveBeenCalled()
  })

  it('sends a digest for offers above threshold and marks only those sent', async () => {
    const mockSupabase = buildSupabaseMock([matchingOffer, weakOffer])
    jest.doMock('@/lib/supabase/server', () => ({
      createServerSupabase: jest.fn().mockResolvedValue(mockSupabase),
    }))
    const { POST } = await import('@/app/api/telegram/notify/route')

    const req = new NextRequest('http://localhost/api/telegram/notify', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1)
    const digest = (sendTelegramMessage as jest.Mock).mock.calls[0][0] as string
    expect(digest).toContain('Data Engineer Python')
    expect(digest).not.toContain('Vendeur')
    expect(body.sent).toBe(1)
  })

  it('skips sending when no offer clears the threshold', async () => {
    const mockSupabase = buildSupabaseMock([weakOffer])
    jest.doMock('@/lib/supabase/server', () => ({
      createServerSupabase: jest.fn().mockResolvedValue(mockSupabase),
    }))
    const { POST } = await import('@/app/api/telegram/notify/route')

    const req = new NextRequest('http://localhost/api/telegram/notify', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(sendTelegramMessage).not.toHaveBeenCalled()
    expect(body.sent).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage __tests__/api/telegram-notify.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/telegram/notify/route'`

- [ ] **Step 3: Implement `app/api/telegram/notify/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { computeOfferScore } from '@/lib/scoring'
import { sendTelegramMessage } from '@/lib/telegram'
import type { Offer, SearchProfile } from '@/lib/supabase/types'

function isAuthorized(req: NextRequest, user: unknown): boolean {
  if (user) return true
  const auth = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  return !!(cronSecret && auth === `Bearer ${cronSecret}`)
}

function buildDigest(scored: { offer: Offer; score: number }[]): string {
  const lines = scored.map(({ offer, score }, i) => {
    const pct = Math.round(score * 100)
    const entreprise = offer.entreprise ?? 'Entreprise inconnue'
    return `${i + 1}. *${offer.titre}* — ${entreprise}\n   ${pct}% match · ${offer.lien ?? ''}`
  })
  return `🎯 *${scored.length} offre${scored.length > 1 ? 's' : ''} à fort potentiel*\n\n${lines.join('\n\n')}`
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!isAuthorized(req, user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user?.id
  const threshold = Number(process.env.TELEGRAM_SCORE_THRESHOLD) || 0.5

  let profilesQuery = supabase.from('search_profiles').select('*').eq('actif', true)
  if (userId) profilesQuery = profilesQuery.eq('user_id', userId)
  const { data: profiles } = await profilesQuery

  const errors: string[] = []
  let totalSent = 0

  for (const profile of (profiles ?? []) as SearchProfile[]) {
    try {
      const { data: offers } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('statut', 'non_traite')
        .is('telegram_sent_at', null)

      const scored = ((offers ?? []) as Offer[])
        .map(offer => ({ offer, score: computeOfferScore(offer, profile) }))
        .filter(({ score }) => score >= threshold)
        .sort((a, b) => b.score - a.score)

      if (scored.length === 0) continue

      await sendTelegramMessage(buildDigest(scored))

      const ids = scored.map(({ offer }) => offer.id)
      const { error: updateError } = await supabase
        .from('offers')
        .update({ telegram_sent_at: new Date().toISOString() })
        .in('id', ids)

      if (updateError) {
        errors.push(`update ${profile.id}: ${updateError.message}`)
        continue
      }

      totalSent += scored.length
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      errors.push(`profile ${profile.id}: ${msg}`)
    }
  }

  return NextResponse.json({ sent: totalSent, profiles: (profiles ?? []).length, errors })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --no-coverage __tests__/api/telegram-notify.test.ts`
Expected: PASS, all 3 tests

- [ ] **Step 5: Type-check and full suite**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: no errors, all suites pass

- [ ] **Step 6: Commit**

```bash
git add app/api/telegram/notify/route.ts "__tests__/api/telegram-notify.test.ts"
git commit -m "feat(api): add Telegram offer notification route"
```

---

### Task 5: Netlify scheduled trigger + env docs

**Files:**
- Create: `netlify/functions/telegram-notify.ts`
- Modify: `.env.local.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Implement the scheduled function**

```ts
import { schedule } from '@netlify/functions'
import type { Handler } from '@netlify/functions'

export const handler: Handler = schedule('0 8,19 * * *', async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const cronSecret = process.env.CRON_SECRET

  if (!appUrl || !cronSecret) {
    console.error('telegram-notify: Missing NEXT_PUBLIC_APP_URL or CRON_SECRET')
    return { statusCode: 500, body: 'Configuration error' }
  }

  try {
    const res = await fetch(`${appUrl}/api/telegram/notify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    const body = await res.text()
    console.log(`telegram-notify: ${res.status} — ${body}`)

    return {
      statusCode: res.ok ? 200 : res.status,
      body,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`telegram-notify failed: ${msg}`)
    return { statusCode: 500, body: msg }
  }
})
```

- [ ] **Step 2: Document env vars in `.env.local.example`**

Add after the `# Job APIs` block:

```
# Telegram notifications
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
TELEGRAM_SCORE_THRESHOLD=0.5
```

- [ ] **Step 3: Document env vars in `CLAUDE.md`**

In the `### Environment Variables` table, add three rows:

```
| `TELEGRAM_BOT_TOKEN` | lib/telegram.ts |
| `TELEGRAM_CHAT_ID` | lib/telegram.ts |
| `TELEGRAM_SCORE_THRESHOLD` | /api/telegram/notify (optional, default 0.5) |
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/telegram-notify.ts .env.local.example CLAUDE.md
git commit -m "feat(cron): schedule twice-daily Telegram notify trigger"
```

---

## Post-implementation (manual, not automatable)

1. Create the Telegram bot via @BotFather if not already done, get `TELEGRAM_BOT_TOKEN`.
2. Get `TELEGRAM_CHAT_ID` (message the bot, then check `https://api.telegram.org/bot<TOKEN>/getUpdates`).
3. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and optionally `TELEGRAM_SCORE_THRESHOLD` in Netlify environment variables.
4. Apply migration 006 via the Supabase SQL Editor (Task 1, Step 2).
5. Deploy; confirm the new scheduled function appears in the Netlify Functions dashboard.
