# Additional Job Sources (Adzuna, Jooble, Reed.co.uk) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three free, officially-documented job-search APIs (Adzuna, Jooble, Reed.co.uk) to the existing scraping pipeline, with a DB-backed hard cutoff that stops Adzuna calls before the app could ever approach a paid tier — and remove `apec`/`hellowork` entirely, since both rely on unofficial/undocumented endpoints the user decided not to keep using after reviewing the source-legality audit.

**Architecture:** Three new scraper modules (`lib/scrapers/{adzuna,jooble,reed}.ts`) follow the exact contract of the existing `jsearch.ts`/`eures.ts` (return `ScrapedJob[]`, never throw, `console.warn` + `[]` on any failure). A new `lib/scrapers/quota.ts` wraps a single atomic Postgres RPC (`reserve_api_usage`) that Adzuna calls before every request. `app/api/jobs/fetch/route.ts` wires the three new sources into its existing per-location, per-keyword fan-out, gated by country the same way `france_travail` is already gated by `isFrance` — and drops the `apec`/`hellowork` entries from that same fan-out, along with every UI/doc reference to them.

**Tech Stack:** Next.js 16 route handlers, `@supabase/ssr` server client, `fetch`, Jest + ts-jest (existing test infra — see `__tests__/lib/scrapers/{jsearch,eures}.test.ts` for the established mocking pattern this plan follows).

**Spec:** `docs/superpowers/specs/2026-09-16-additional-job-sources-design.md`

---

### Task 1: Database migration — quota tracking table + atomic RPC

**Files:**
- Create: `supabase/migrations/006_api_usage_tracking.sql`
- Modify: `CLAUDE.md:1-80` (add a note under "Key Design Decisions", same style as the 004/005 migration note)

This migration is applied manually via the Supabase SQL Editor (same convention as every prior migration in this repo — there is no automated migration runner). There is nothing to unit-test here; the RPC's behavior is exercised indirectly by Task 2's tests via a mocked Supabase client.

- [ ] **Step 1: Write the migration file**

```sql
-- 006_api_usage_tracking.sql
-- Tracks monthly call counts per external API source, so scrapers can stop
-- calling a paid-tier-risk API (e.g. Adzuna) before ever exceeding its free quota.

create table if not exists api_usage (
  source text not null,
  month_key text not null,
  calls integer not null default 0,
  primary key (source, month_key)
);

-- RLS enabled with NO policies: direct table access via PostgREST is denied
-- entirely. The only way in is the security-definer function below, which
-- runs with the privileges of its owner regardless of the caller's role.
alter table api_usage enable row level security;

-- Atomically checks the cap and increments in one statement, so concurrent
-- calls (multiple locations firing Adzuna in parallel within one
-- /api/jobs/fetch run) cannot race past the cap — the row-level UPDATE lock
-- makes each caller either succeed or fail with the same guarantee a
-- sequential caller would get.
create or replace function reserve_api_usage(p_source text, p_month text, p_cap int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calls int;
begin
  insert into api_usage (source, month_key, calls)
  values (p_source, p_month, 0)
  on conflict (source, month_key) do nothing;

  update api_usage
  set calls = calls + 1
  where source = p_source and month_key = p_month and calls < p_cap
  returning calls into v_calls;

  return v_calls is not null;
end;
$$;

grant execute on function reserve_api_usage(text, text, int) to anon, authenticated;
```

- [ ] **Step 2: Apply the migration manually**

Open the Supabase SQL Editor for this project and run the contents of `006_api_usage_tracking.sql`. Verify it applied cleanly:

```sql
select reserve_api_usage('adzuna', '2026-09', 900);
```

Expected: returns `true` (first call, count goes from 0 to 1, which is `< 900`).

- [ ] **Step 3: Add a doc note to CLAUDE.md**

In `CLAUDE.md`, under "Key Design Decisions" (near the existing `SearchProfile.domaine`/migration 004/005 bullet), add:

```markdown
- **`api_usage` table** (migration `006_api_usage_tracking.sql`): tracks monthly call counts per external API source (currently only `adzuna`) via the `reserve_api_usage(source, month, cap)` RPC — a single atomic `UPDATE ... WHERE calls < cap` that both checks and increments, so concurrent calls can't race past the cap. RLS is enabled with no policies; the function is `security definer` and is the only access path. Apply manually via the Supabase SQL Editor like migrations 004/005.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/006_api_usage_tracking.sql CLAUDE.md
git commit -m "feat: add api_usage table and reserve_api_usage RPC for quota cutoff"
```

---

### Task 2: `lib/scrapers/quota.ts` — quota check wrapper

**Files:**
- Create: `lib/scrapers/quota.ts`
- Test: `__tests__/lib/scrapers/quota.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @jest-environment node
 */

const mockRpc = jest.fn()
const mockSupabase = { rpc: mockRpc }

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue(mockSupabase),
}))

import { checkAndReserveQuota } from '@/lib/scrapers/quota'

describe('checkAndReserveQuota', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns true and calls reserve_api_usage with the current UTC month when quota is available', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const result = await checkAndReserveQuota('adzuna', 900)

    expect(result).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('reserve_api_usage', {
      p_source: 'adzuna',
      p_month: expect.stringMatching(/^\d{4}-\d{2}$/),
      p_cap: 900,
    })
  })

  it('returns false when the cap has already been reached', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })

    const result = await checkAndReserveQuota('adzuna', 900)

    expect(result).toBe(false)
  })

  it('fails closed (returns false) when the RPC call errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection failed' } })

    const result = await checkAndReserveQuota('adzuna', 900)

    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/scrapers/quota.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scrapers/quota'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/scrapers/quota.ts
import { createServerSupabase } from '@/lib/supabase/server'

export async function checkAndReserveQuota(source: string, cap: number): Promise<boolean> {
  const supabase = await createServerSupabase()
  const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM, UTC

  const { data, error } = await supabase.rpc('reserve_api_usage', {
    p_source: source,
    p_month: monthKey,
    p_cap: cap,
  })

  if (error) {
    console.warn(`[quota] reserve_api_usage failed for ${source}`, error)
    return false
  }

  return data === true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/lib/scrapers/quota.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/quota.ts __tests__/lib/scrapers/quota.test.ts
git commit -m "feat: add checkAndReserveQuota wrapper around reserve_api_usage RPC"
```

---

### Task 3: `lib/scrapers/adzuna.ts`

**Files:**
- Create: `lib/scrapers/adzuna.ts`
- Test: `__tests__/lib/scrapers/adzuna.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/scrapers/quota', () => ({ checkAndReserveQuota: jest.fn() }))

import { fetchAdzuna } from '@/lib/scrapers/adzuna'
import { checkAndReserveQuota } from '@/lib/scrapers/quota'

describe('fetchAdzuna', () => {
  const originalFetch = global.fetch
  const originalAppId = process.env.ADZUNA_APP_ID
  const originalAppKey = process.env.ADZUNA_APP_KEY

  beforeEach(() => {
    process.env.ADZUNA_APP_ID = 'test-id'
    process.env.ADZUNA_APP_KEY = 'test-key'
    ;(checkAndReserveQuota as jest.Mock).mockResolvedValue(true)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.ADZUNA_APP_ID = originalAppId
    process.env.ADZUNA_APP_KEY = originalAppKey
    jest.clearAllMocks()
  })

  it('returns [] without calling fetch when ADZUNA_APP_ID is missing', async () => {
    delete process.env.ADZUNA_APP_ID

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns [] without calling fetch when the quota check denies the call', async () => {
    ;(checkAndReserveQuota as jest.Mock).mockResolvedValue(false)

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("maps the uk country code to Adzuna's gb slug", async () => {
    await fetchAdzuna('intern', 'London', 'uk')

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('/v1/api/jobs/gb/search/1')
  })

  it('maps a real-shaped Adzuna response to ScrapedJob', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            title: 'Ingénieur logiciel',
            company: { display_name: 'Acme' },
            location: { display_name: 'Lille, France' },
            redirect_url: 'https://adzuna.fr/job/123',
            contract_type: 'permanent',
            salary_min: 35000,
            salary_max: 42000,
          },
        ],
      }),
    })

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([
      {
        titre: 'Ingénieur logiciel',
        entreprise: 'Acme',
        lien: 'https://adzuna.fr/job/123',
        localisation: 'Lille, France',
        source: 'adzuna',
        type_contrat: 'permanent',
        salaire_min: 35000,
        salaire_max: 42000,
        raw_data: expect.objectContaining({ title: 'Ingénieur logiciel' }),
      },
    ])
  })

  it('returns [] when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([])
  })

  it('returns [] when the network call rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    const jobs = await fetchAdzuna('développeur', 'Lille', 'fr')

    expect(jobs).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/scrapers/adzuna.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scrapers/adzuna'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/scrapers/adzuna.ts
import type { ScrapedJob } from './jsearch'
import { checkAndReserveQuota } from './quota'

const ADZUNA_COUNTRY_SLUGS: Record<string, string> = {
  fr: 'fr',
  uk: 'gb',
  de: 'de',
  es: 'es',
  be: 'be',
}

export async function fetchAdzuna(
  keywords: string,
  location: string,
  country: string
): Promise<ScrapedJob[]> {
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
    console.warn('ADZUNA_APP_ID/ADZUNA_APP_KEY not set, skipping Adzuna')
    return []
  }

  const cap = Number(process.env.ADZUNA_MONTHLY_CAP ?? '900')
  const allowed = await checkAndReserveQuota('adzuna', cap)
  if (!allowed) {
    console.warn('[adzuna] monthly quota cap reached, skipping call')
    return []
  }

  const slug = ADZUNA_COUNTRY_SLUGS[country.toLowerCase()] ?? country.toLowerCase()

  try {
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/${slug}/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_APP_KEY}&results_per_page=20&what=${encodeURIComponent(keywords)}&where=${encodeURIComponent(location)}`
    )

    if (!res.ok) return []

    const { results = [] } = await res.json()
    return results.map((j: Record<string, unknown>) => {
      const company = j.company as Record<string, unknown> | undefined
      const jobLocation = j.location as Record<string, unknown> | undefined
      return {
        titre: (j.title as string) ?? 'Poste inconnu',
        entreprise: (company?.display_name as string) ?? null,
        lien: (j.redirect_url as string) ?? null,
        localisation: (jobLocation?.display_name as string) ?? location,
        source: 'adzuna',
        type_contrat: (j.contract_type as string) ?? null,
        salaire_min: (j.salary_min as number) ?? null,
        salaire_max: (j.salary_max as number) ?? null,
        raw_data: j,
      }
    })
  } catch (err) {
    console.warn('[adzuna] fetch error', err)
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/lib/scrapers/adzuna.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/adzuna.ts __tests__/lib/scrapers/adzuna.test.ts
git commit -m "feat: add Adzuna scraper with quota cutoff before every call"
```

---

### Task 4: `lib/scrapers/jooble.ts`

**Files:**
- Create: `lib/scrapers/jooble.ts`
- Test: `__tests__/lib/scrapers/jooble.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @jest-environment node
 */

import { fetchJooble } from '@/lib/scrapers/jooble'

describe('fetchJooble', () => {
  const originalFetch = global.fetch
  const envKeys = ['JOOBLE_API_KEY_UK', 'JOOBLE_API_KEY_DE', 'JOOBLE_API_KEY_ES', 'JOOBLE_API_KEY_BE'] as const
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    envKeys.forEach(k => { originalEnv[k] = process.env[k] })
    process.env.JOOBLE_API_KEY_UK = 'uk-key'
    process.env.JOOBLE_API_KEY_DE = 'de-key'
    delete process.env.JOOBLE_API_KEY_ES
    delete process.env.JOOBLE_API_KEY_BE
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ jobs: [] }) })
  })

  afterEach(() => {
    global.fetch = originalFetch
    envKeys.forEach(k => { process.env[k] = originalEnv[k] })
  })

  it('returns [] without calling fetch for a country outside the supported set', async () => {
    const jobs = await fetchJooble('stage', 'Rome', 'it')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns [] without calling fetch when the country has no key configured', async () => {
    const jobs = await fetchJooble('stage', 'Madrid', 'es')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('posts to the correct regional domain with the correct key for a configured country', async () => {
    await fetchJooble('internship', 'Berlin', 'de')

    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('https://de.jooble.org/api/de-key')
  })

  it('maps a real-shaped Jooble response to ScrapedJob', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalCount: 1,
        jobs: [
          {
            title: 'Software Engineering Intern',
            company: 'Acme Ltd',
            location: 'London, UK',
            link: 'https://jooble.org/jdp/123',
            type: 'Internship',
          },
        ],
      }),
    })

    const jobs = await fetchJooble('internship', 'London', 'uk')

    expect(jobs).toEqual([
      {
        titre: 'Software Engineering Intern',
        entreprise: 'Acme Ltd',
        lien: 'https://jooble.org/jdp/123',
        localisation: 'London, UK',
        source: 'jooble',
        type_contrat: 'Internship',
        salaire_min: null,
        salaire_max: null,
        raw_data: expect.objectContaining({ title: 'Software Engineering Intern' }),
      },
    ])
  })

  it('returns [] when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    const jobs = await fetchJooble('internship', 'London', 'uk')

    expect(jobs).toEqual([])
  })

  it('returns [] when the network call rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    const jobs = await fetchJooble('internship', 'London', 'uk')

    expect(jobs).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/scrapers/jooble.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scrapers/jooble'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/scrapers/jooble.ts
import type { ScrapedJob } from './jsearch'

const JOOBLE_DOMAINS: Record<string, string> = {
  uk: 'uk.jooble.org',
  de: 'de.jooble.org',
  es: 'es.jooble.org',
  be: 'be.jooble.org',
}

function joobleKeyFor(country: string): string | undefined {
  switch (country) {
    case 'uk': return process.env.JOOBLE_API_KEY_UK
    case 'de': return process.env.JOOBLE_API_KEY_DE
    case 'es': return process.env.JOOBLE_API_KEY_ES
    case 'be': return process.env.JOOBLE_API_KEY_BE
    default: return undefined
  }
}

export async function fetchJooble(
  keywords: string,
  location: string,
  country: string
): Promise<ScrapedJob[]> {
  const cc = country.toLowerCase()
  const domain = JOOBLE_DOMAINS[cc]
  const key = joobleKeyFor(cc)

  if (!domain || !key) {
    return []
  }

  try {
    const res = await fetch(`https://${domain}/api/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, location }),
    })

    if (!res.ok) return []

    const { jobs = [] } = await res.json()
    return jobs.map((j: Record<string, unknown>) => ({
      titre: (j.title as string) ?? 'Poste inconnu',
      entreprise: (j.company as string) ?? null,
      lien: (j.link as string) ?? null,
      localisation: (j.location as string) ?? location,
      source: 'jooble',
      type_contrat: (j.type as string) ?? null,
      salaire_min: null,
      salaire_max: null,
      raw_data: j,
    }))
  } catch (err) {
    console.warn('[jooble] fetch error', err)
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/lib/scrapers/jooble.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/jooble.ts __tests__/lib/scrapers/jooble.test.ts
git commit -m "feat: add Jooble scraper for uk/de/es/be (per-country API keys)"
```

---

### Task 5: `lib/scrapers/reed.ts`

**Files:**
- Create: `lib/scrapers/reed.ts`
- Test: `__tests__/lib/scrapers/reed.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @jest-environment node
 */

import { fetchReed } from '@/lib/scrapers/reed'

describe('fetchReed', () => {
  const originalFetch = global.fetch
  const originalKey = process.env.REED_API_KEY

  beforeEach(() => {
    process.env.REED_API_KEY = 'test-reed-key'
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.REED_API_KEY = originalKey
  })

  it('returns [] without calling fetch when REED_API_KEY is missing', async () => {
    delete process.env.REED_API_KEY

    const jobs = await fetchReed('developer', 'London')

    expect(jobs).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sends the API key as Basic Auth username with an empty password', async () => {
    await fetchReed('developer', 'London')

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const expectedAuth = `Basic ${Buffer.from('test-reed-key:').toString('base64')}`
    expect(init.headers.Authorization).toBe(expectedAuth)
  })

  it('maps a real-shaped Reed response to ScrapedJob', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            jobId: 123,
            employerName: 'Acme Ltd',
            jobTitle: 'Graduate Software Engineer',
            locationName: 'London',
            jobUrl: 'https://www.reed.co.uk/jobs/123',
            minimumSalary: 28000,
            maximumSalary: 32000,
          },
        ],
      }),
    })

    const jobs = await fetchReed('developer', 'London')

    expect(jobs).toEqual([
      {
        titre: 'Graduate Software Engineer',
        entreprise: 'Acme Ltd',
        lien: 'https://www.reed.co.uk/jobs/123',
        localisation: 'London',
        source: 'reed',
        type_contrat: null,
        salaire_min: 28000,
        salaire_max: 32000,
        raw_data: expect.objectContaining({ jobId: 123 }),
      },
    ])
  })

  it('returns [] when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 })

    const jobs = await fetchReed('developer', 'London')

    expect(jobs).toEqual([])
  })

  it('returns [] when the network call rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    const jobs = await fetchReed('developer', 'London')

    expect(jobs).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/scrapers/reed.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scrapers/reed'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/scrapers/reed.ts
import type { ScrapedJob } from './jsearch'

export async function fetchReed(keywords: string, location: string): Promise<ScrapedJob[]> {
  if (!process.env.REED_API_KEY) {
    console.warn('REED_API_KEY not set, skipping Reed')
    return []
  }

  try {
    // Reed uses HTTP Basic Auth with the API key as username and an empty
    // password — the only source in this pipeline that isn't a bearer token
    // or query-param key.
    const auth = Buffer.from(`${process.env.REED_API_KEY}:`).toString('base64')
    const url = `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(keywords)}&locationName=${encodeURIComponent(location)}`

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    })

    if (!res.ok) return []

    const { results = [] } = await res.json()
    return results.map((j: Record<string, unknown>) => ({
      titre: (j.jobTitle as string) ?? 'Poste inconnu',
      entreprise: (j.employerName as string) ?? null,
      lien: (j.jobUrl as string) ?? null,
      localisation: (j.locationName as string) ?? location,
      source: 'reed',
      type_contrat: null,
      salaire_min: (j.minimumSalary as number) ?? null,
      salaire_max: (j.maximumSalary as number) ?? null,
      raw_data: j,
    }))
  } catch (err) {
    console.warn('[reed] fetch error', err)
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/lib/scrapers/reed.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/reed.ts __tests__/lib/scrapers/reed.test.ts
git commit -m "feat: add Reed.co.uk scraper (UK-only, Basic Auth)"
```

---

### Task 6: Wire Adzuna/Jooble/Reed into `app/api/jobs/fetch/route.ts`, remove apec/hellowork

**Files:**
- Modify: `app/api/jobs/fetch/route.ts:1-11` (imports), `route.ts:91-111` (fan-out block)
- Modify: `__tests__/api/jobs-fetch.test.ts` (full rewrite of mocks + assertions)

This is route-level wiring, not a new unit — its correctness is verified through the existing `jobs-fetch.test.ts` integration-style test (mocks every scraper module, asserts call counts per country). Following TDD here means updating that test file **first** to describe the new behavior, watching it fail against the current unmodified route, then updating the route to match. This single task does both changes together since they touch the exact same lines: add `adzuna`/`jooble`/`reed` to the fan-out, and delete the `apec`/`hellowork` entries from it (the scraper files themselves are deleted in Task 7).

- [ ] **Step 1: Rewrite the failing test**

Replace the full contents of `__tests__/api/jobs-fetch.test.ts` with:

```typescript
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
  type_contrat: [] as string[],
  mots_cles: ['data scientist', 'data engineer'],
  mots_cles_exclus: [] as string[],
  qualifications: [] as string[],
  duree_contrat: 'peu_importe',
  localisations: [
    { ville: 'Lille', rayon_km: 30 },
    { ville: 'Paris', rayon_km: 20 },
  ],
  salaire_min: null,
  created_at: '2026-08-01T00:00:00Z',
}

const rateLimitChainOnce = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}

const profilesChainOnce = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  then: (resolve: (v: { data: typeof mockProfile[]; error: null }) => void) =>
    resolve({ data: [mockProfile], error: null }),
}

const mockSupabase = {
  auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  from: jest.fn()
    .mockReturnValueOnce(rateLimitChainOnce)
    .mockReturnValueOnce(profilesChainOnce),
}

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue(mockSupabase),
}))

jest.mock('@/lib/scrapers/jsearch', () => ({ fetchJSearch: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/eures', () => ({ fetchEures: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/france-travail', () => ({ fetchFranceTravail: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/adzuna', () => ({ fetchAdzuna: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/jooble', () => ({ fetchJooble: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/reed', () => ({ fetchReed: jest.fn().mockResolvedValue([]) }))

import { POST } from '@/app/api/jobs/fetch/route'
import { fetchJSearch } from '@/lib/scrapers/jsearch'
import { fetchEures } from '@/lib/scrapers/eures'
import { fetchFranceTravail } from '@/lib/scrapers/france-travail'
import { fetchAdzuna } from '@/lib/scrapers/adzuna'
import { fetchJooble } from '@/lib/scrapers/jooble'
import { fetchReed } from '@/lib/scrapers/reed'

describe('POST /api/jobs/fetch — multi-city loop', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce(profilesChainOnce)
  })

  it('calls jsearch/eures/adzuna/france-travail once per city × keyword for French locations, skipping jooble/reed', async () => {
    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(4)
    expect(fetchEures).toHaveBeenCalledTimes(4)
    expect(fetchAdzuna).toHaveBeenCalledTimes(4)
    expect(fetchFranceTravail).toHaveBeenCalledTimes(4)
    expect(fetchJooble).not.toHaveBeenCalled()
    expect(fetchReed).not.toHaveBeenCalled()

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Lille', [], 'fr')
    expect(fetchAdzuna).toHaveBeenNthCalledWith(1, 'data scientist', 'Lille', 'fr')
    expect(fetchEures).toHaveBeenNthCalledWith(1, 'data scientist', 'fr')
  })

  it('for a German location, calls JSearch/EURES/Adzuna/Jooble but skips France Travail/Reed', async () => {
    const deProfile = {
      ...mockProfile,
      localisations: [{ ville: 'Berlin', rayon_km: 30, pays: 'de' }],
    }
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve: (v: { data: typeof deProfile[]; error: null }) => void) =>
          resolve({ data: [deProfile], error: null }),
      })

    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(2) // 2 keywords × 1 city
    expect(fetchEures).toHaveBeenCalledTimes(2)
    expect(fetchAdzuna).toHaveBeenCalledTimes(2)
    expect(fetchJooble).toHaveBeenCalledTimes(2)
    expect(fetchFranceTravail).not.toHaveBeenCalled()
    expect(fetchReed).not.toHaveBeenCalled()

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Berlin', [], 'de')
    expect(fetchJooble).toHaveBeenNthCalledWith(1, 'data scientist', 'Berlin', 'de')
  })

  it('for a UK location, calls JSearch/EURES/Adzuna/Jooble/Reed but skips France Travail', async () => {
    const ukProfile = {
      ...mockProfile,
      mots_cles: ['software engineering intern'],
      localisations: [{ ville: 'London', rayon_km: 30, pays: 'uk' }],
    }
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve: (v: { data: typeof ukProfile[]; error: null }) => void) =>
          resolve({ data: [ukProfile], error: null }),
      })

    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchAdzuna).toHaveBeenCalledTimes(1)
    expect(fetchJooble).toHaveBeenCalledTimes(1)
    expect(fetchReed).toHaveBeenCalledTimes(1)
    expect(fetchFranceTravail).not.toHaveBeenCalled()

    expect(fetchReed).toHaveBeenNthCalledWith(1, 'software engineering intern', 'London')
  })

  it('scopes country-gated sources per-location in a mixed French/German profile', async () => {
    const mixedProfile = {
      ...mockProfile,
      mots_cles: ['data scientist'],
      localisations: [
        { ville: 'Paris', rayon_km: 30, pays: 'fr' },
        { ville: 'Berlin', rayon_km: 30, pays: 'de' },
      ],
    }
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve: (v: { data: typeof mixedProfile[]; error: null }) => void) =>
          resolve({ data: [mixedProfile], error: null }),
      })

    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(2) // 1 keyword × 2 locations
    expect(fetchEures).toHaveBeenCalledTimes(2)
    expect(fetchAdzuna).toHaveBeenCalledTimes(2) // fires for both fr and de
    expect(fetchFranceTravail).toHaveBeenCalledTimes(1) // only Paris (French location)
    expect(fetchJooble).toHaveBeenCalledTimes(1) // only Berlin (de is jooble-gated)
    expect(fetchReed).not.toHaveBeenCalled() // no uk location

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Paris', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(2, 'data scientist', 'Berlin', [], 'de')
    expect(fetchJooble).toHaveBeenNthCalledWith(1, 'data scientist', 'Berlin', 'de')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/api/jobs-fetch.test.ts`
Expected: FAIL — `fetchAdzuna`/`fetchJooble`/`fetchReed` are never called (route doesn't wire them yet), and the mocked modules `@/lib/scrapers/adzuna`, `@/lib/scrapers/jooble`, `@/lib/scrapers/reed` don't exist yet as real files for Jest to resolve the mock against — Jest will report module-not-found for the `jest.mock` calls.

- [ ] **Step 3: Wire the three new scrapers in, remove apec/hellowork**

In `app/api/jobs/fetch/route.ts`, replace the scraper imports (currently `route.ts:5-9`):

```typescript
import { fetchJSearch } from '@/lib/scrapers/jsearch'
import { fetchEures } from '@/lib/scrapers/eures'
import { fetchFranceTravail } from '@/lib/scrapers/france-travail'
import { fetchAdzuna } from '@/lib/scrapers/adzuna'
import { fetchJooble } from '@/lib/scrapers/jooble'
import { fetchReed } from '@/lib/scrapers/reed'
```

(This drops the `fetchAPEC`/`fetchHelloWork` imports entirely — those two files are deleted in Task 7.)

Replace the `taggedPromises` block (currently `route.ts:91-111`) with:

```typescript
    const JOOBLE_COUNTRIES = ['uk', 'de', 'es', 'be']

    // JSearch, EURES, and Adzuna fire for every location (multi-country);
    // France Travail is a French-market-only API and only fires when the
    // location's country is France. Jooble fires only for its 4 supported
    // non-French countries (separate API key per country). Reed fires only
    // for uk (UK-only job board).
    // Qualifications are profile metadata only — not appended to queries
    const taggedPromises = locations.flatMap(loc => {
      const country = (loc.pays ?? 'fr').toLowerCase()
      const isFrance = country === 'fr'
      return keywordsList.flatMap(kw => {
        const entries: [string, Promise<ScrapedJob[]>][] = [
          ['jsearch', withTimeout(fetchJSearch(kw, loc.ville, [], country), 15000)],
          ['eures', withTimeout(fetchEures(kw, country), 10000)],
          ['adzuna', withTimeout(fetchAdzuna(kw, loc.ville, country), 7000)],
        ]
        if (isFrance) {
          entries.push(
            ['france_travail', withTimeout(fetchFranceTravail(kw, loc.ville, typeContrats, tempsPleinFilter), 7000)],
          )
        }
        if (JOOBLE_COUNTRIES.includes(country)) {
          entries.push(['jooble', withTimeout(fetchJooble(kw, loc.ville, country), 7000)])
        }
        if (country === 'uk') {
          entries.push(['reed', withTimeout(fetchReed(kw, loc.ville), 7000)])
        }
        return entries
      })
    })
```

Note `typeContrats` is still used (passed to `fetchFranceTravail`) — only its `fetchHelloWork(kw, loc.ville, typeContrats)` usage is gone, the variable itself stays.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/api/jobs-fetch.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: PASS — all suites. Note this will still show TypeScript/Jest errors from Task 7 not having run yet if `apec.ts`/`hellowork.ts` are gone but something else still imports them — but at this point in the plan those files still exist on disk (Task 7 deletes them), so no dangling-import errors are expected here.

- [ ] **Step 6: Commit**

```bash
git add app/api/jobs/fetch/route.ts __tests__/api/jobs-fetch.test.ts
git commit -m "feat: wire Adzuna/Jooble/Reed into job-fetch fan-out, drop apec/hellowork"
```

---

### Task 7: Delete apec/hellowork scrapers and every UI/doc reference

**Files:**
- Delete: `lib/scrapers/apec.ts`, `lib/scrapers/hellowork.ts`
- Modify: `components/offers/OfferCard.tsx:8-14`, `components/offers/OfferDetailModal.tsx:9-15`, `components/offers/SwipeCard.tsx:7-16`, `app/offers/page.tsx:18-25`, `app/about/page.tsx:13-17`, `CLAUDE.md`

No test file targets `apec.ts`/`hellowork.ts` directly (confirmed — only `jsearch.test.ts` and `eures.test.ts` exist under `__tests__/lib/scrapers/`), so there's nothing to delete there. Verification for this task is `npx tsc --noEmit` (catches any remaining import of the deleted files) plus the full Jest run.

- [ ] **Step 1: Delete the two scraper files**

```bash
git rm lib/scrapers/apec.ts lib/scrapers/hellowork.ts
```

- [ ] **Step 2: Remove `apec`/`hellowork` from `OfferCard.tsx`**

In `components/offers/OfferCard.tsx`, change:

```typescript
const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  apec: 'APEC',
  hellowork: 'HelloWork',
  france_travail: 'France Travail',
  email: 'Email',
}
```

to:

```typescript
const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  france_travail: 'France Travail',
  email: 'Email',
}
```

- [ ] **Step 3: Remove `apec`/`hellowork` from `OfferDetailModal.tsx`**

Same change as Step 2, applied to the identical `SOURCE_LABELS` block in `components/offers/OfferDetailModal.tsx:9-15`.

- [ ] **Step 4: Remove `apec`/`hellowork` from `SwipeCard.tsx`**

In `components/offers/SwipeCard.tsx`, change:

```typescript
const SOURCE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  jsearch:       { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-200' },
  france_travail:{ bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200'   },
  hellowork:     { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200'},
  email:         { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200'  },
}
const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch', apec: 'APEC', hellowork: 'HelloWork',
  france_travail: 'France Travail', email: 'Email',
}
```

to:

```typescript
const SOURCE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  jsearch:       { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-200' },
  france_travail:{ bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200'   },
  email:         { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200'  },
}
const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  france_travail: 'France Travail', email: 'Email',
}
```

(The `?? { bg: 'bg-zinc-50', ... }` fallback in `SwipeCard.tsx:176` and the `?? offer.source ?? 'Inconnu'` fallback in all three components already handle any historical `offer.source === 'apec' | 'hellowork'` row gracefully — verified before writing this task — so no further change is needed there.)

- [ ] **Step 5: Remove `apec`/`hellowork` filter options from the offers page**

In `app/offers/page.tsx`, change:

```typescript
const SOURCE_FILTERS = [
  { value: '', label: 'Toutes sources' },
  { value: 'jsearch', label: 'JSearch' },
  { value: 'apec', label: 'APEC' },
  { value: 'hellowork', label: 'HelloWork' },
  { value: 'france_travail', label: 'France Travail' },
  { value: 'email', label: 'Email' },
]
```

to:

```typescript
const SOURCE_FILTERS = [
  { value: '', label: 'Toutes sources' },
  { value: 'jsearch', label: 'JSearch' },
  { value: 'france_travail', label: 'France Travail' },
  { value: 'email', label: 'Email' },
]
```

- [ ] **Step 6: Update the marketing copy on the about page**

In `app/about/page.tsx`, change:

```typescript
  {
    icon: Search,
    title: 'Scraping automatique',
    desc: "Recherche quotidienne sur JSearch, APEC, France Travail et HelloWork selon vos profils.",
  },
```

to:

```typescript
  {
    icon: Search,
    title: 'Scraping automatique',
    desc: "Recherche quotidienne sur JSearch, EURES, Adzuna, France Travail, Jooble et Reed selon vos profils.",
  },
```

- [ ] **Step 7: Update `CLAUDE.md`'s scraping pipeline section**

In `CLAUDE.md`, change:

```markdown
- `lib/scrapers/jsearch.ts` — JSearch RapidAPI (requires `RAPIDAPI_KEY`)
- `lib/scrapers/apec.ts` — APEC REST API (cadre jobs, often 0 for manual work)
- `lib/scrapers/hellowork.ts` — cheerio HTML scraping
- `lib/scrapers/france-travail.ts` — France Travail OAuth2 API (requires `FRANCE_TRAVAIL_CLIENT_ID` + `FRANCE_TRAVAIL_CLIENT_SECRET`)
```

to:

```markdown
- `lib/scrapers/jsearch.ts` — JSearch RapidAPI (requires `RAPIDAPI_KEY`)
- `lib/scrapers/france-travail.ts` — France Travail OAuth2 API (requires `FRANCE_TRAVAIL_CLIENT_ID` + `FRANCE_TRAVAIL_CLIENT_SECRET`)
- `lib/scrapers/eures.ts` — EURES public API (EU-wide, internships)
- `lib/scrapers/adzuna.ts` — Adzuna REST API (requires `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`, quota-capped via `lib/scrapers/quota.ts`)
- `lib/scrapers/jooble.ts` — Jooble REST API, uk/de/es/be only (one API key per country)
- `lib/scrapers/reed.ts` — Reed.co.uk REST API, UK only (requires `REED_API_KEY`)
```

And change the "Critical" note:

```markdown
**Critical**: qualifications from profile are NOT appended to search queries — they are metadata only. Keywords must be searched one at a time (spaces = AND on APEC/FT/HW).
```

to:

```markdown
**Critical**: qualifications from profile are NOT appended to search queries — they are metadata only. Keywords must be searched one at a time (spaces = AND on France Travail).
```

`apec.ts` and `hellowork.ts` relied on unofficial/undocumented endpoints (flagged in a source-legality audit) and were removed entirely rather than kept behind a flag.

- [ ] **Step 8: Verify no dangling references remain**

Run: `npx tsc --noEmit`
Expected: no errors (confirms nothing still imports the deleted files)

Run: `npx jest --no-coverage`
Expected: all suites PASS

- [ ] **Step 9: Commit**

```bash
git add components/offers/OfferCard.tsx components/offers/OfferDetailModal.tsx components/offers/SwipeCard.tsx app/offers/page.tsx app/about/page.tsx CLAUDE.md
git commit -m "refactor: remove apec/hellowork scrapers (unofficial-endpoint legal risk)"
```

(`lib/scrapers/apec.ts`/`hellowork.ts` don't need `git add` — `git rm` in Step 1 already staged their removal.)

---

### Task 8: Document the new environment variables

**Files:**
- Modify: `CLAUDE.md` (Environment Variables table)

- [ ] **Step 1: Add the new rows**

In `CLAUDE.md`, extend the Environment Variables table:

```markdown
| `ADZUNA_APP_ID` | adzuna.ts |
| `ADZUNA_APP_KEY` | adzuna.ts |
| `ADZUNA_MONTHLY_CAP` | adzuna.ts (default `900` if unset) |
| `JOOBLE_API_KEY_UK` | jooble.ts |
| `JOOBLE_API_KEY_DE` | jooble.ts |
| `JOOBLE_API_KEY_ES` | jooble.ts |
| `JOOBLE_API_KEY_BE` | jooble.ts |
| `REED_API_KEY` | reed.ts |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Adzuna/Jooble/Reed environment variables"
```

---

## Post-implementation checklist (manual, not code)

These require the user's own accounts/keys — not part of any task's automated verification:

1. Register for Adzuna (`developer.adzuna.com`) → get `app_id`/`app_key` → set `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` in Netlify env vars.
2. Register on `uk.jooble.org/api/about`, `de.jooble.org/api/about`, `es.jooble.org/api/about`, `be.jooble.org/api/about` (one form per domain) → set the 4 `JOOBLE_API_KEY_*` vars.
3. Register at `reed.co.uk/developers` → set `REED_API_KEY`.
4. Apply `006_api_usage_tracking.sql` in the Supabase SQL Editor (Task 1, Step 2) before deploying — without it, `checkAndReserveQuota` fails closed and Adzuna silently never fires (safe, but not useful).
5. Trigger `/api/jobs/fetch` once with real keys and check `results.errors` / the `bySource` log line for each new source.
