# Europe-wide internship search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a search profile target internships ("stages") anywhere in Europe, not just France, by adding a country field to each search location and a new EURES source alongside JSearch (both already/newly multi-country), while keeping the three France-only sources (APEC, France Travail, HelloWork) scoped to French locations.

**Architecture:** `SearchLocation` gains an optional `pays` (ISO2 country code, default `'fr'`). The onboarding city step gets a country `<select>` per row. `fetchJSearch` drops its hardcoded `country=fr` in favor of a parameter. A new `lib/scrapers/eures.ts` hits the EURES public job-search API (verified live against `https://europa.eu/eures/api/jv-searchengine/public/jv-search/search`, no auth required). The fetch route calls JSearch + EURES for every location, and additionally calls APEC/HelloWork/France Travail only when `pays === 'fr'`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Jest + ts-jest + jsdom + Testing Library, Supabase (jsonb `localisations` column, no migration needed).

---

## Verified EURES API contract

Captured live from the real EURES frontend (browser XHR interception) and re-verified with a plain unauthenticated `curl` — no cookies/session required:

**Endpoint:** `POST https://europa.eu/eures/api/jv-searchengine/public/jv-search/search`

**Request body (all fields required — the server 500s if any are missing, even as `null`/`[]`):**
```json
{
  "resultsPerPage": 25,
  "page": 1,
  "sortSearch": "MOST_RECENT",
  "keywords": [{ "keyword": "stage", "specificSearchCode": "EVERYWHERE" }],
  "publicationPeriod": null,
  "occupationUris": [],
  "skillUris": [],
  "requiredExperienceCodes": [],
  "positionScheduleCodes": [],
  "sectorCodes": [],
  "educationAndQualificationLevelCodes": [],
  "positionOfferingCodes": ["internship"],
  "locationCodes": ["DE"],
  "euresFlagCodes": [],
  "otherBenefitsCodes": [],
  "requiredLanguages": [],
  "minNumberPost": null,
  "userPreferredLanguage": null,
  "requestLanguage": "en",
  "sessionId": "any-arbitrary-string"
}
```
- `positionOfferingCodes: ["internship"]` is the confirmed filter for stages (seen live: `"positionOfferingCode":"internship"` on real internship postings, `"directhire"` on permanent ones).
- `locationCodes` takes uppercase ISO2 country codes (confirmed: `"DE"`, `"BE"`, `"SE"` all returned matching results).
- `sessionId` can be any string — verified with an arbitrary probe value, still 200s.

**Response body:**
```json
{
  "numberRecords": 542,
  "jvs": [
    {
      "title": "Sales Trainee (m/w/d) (Verkaufstrainer/in)",
      "description": "<p>...</p>",
      "id": "MTIyNjUtNTE1MjYwX0pCNTIzNTA5Ny1TIDE",
      "creationDate": 1788211374245,
      "locationMap": { "DE": ["DE300"] },
      "positionOfferingCode": "internship",
      "employer": { "name": "FERCHAU Contract GmbH Berlin CONTRACT" },
      "availableLanguages": ["de"]
    }
  ]
}
```

**Detail page URL** (confirmed via a real result's anchor href): `https://europa.eu/eures/portal/jv-se/jv-details/{id}?jvDisplayLanguage={lang}`

---

### Task 1: `SearchLocation.pays` field

**Files:**
- Modify: `lib/supabase/types.ts:55-58`

- [ ] **Step 1: Add the field**

```ts
export interface SearchLocation {
  ville: string
  rayon_km: number
  pays?: string // ISO2 country code, e.g. 'fr', 'de', 'gb'. Missing/undefined means 'fr' (pre-existing rows).
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (field is optional, so every existing `{ ville, rayon_km }` literal across the codebase and test fixtures still satisfies the type).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add optional pays field to SearchLocation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Country list for onboarding

**Files:**
- Create: `components/search/countries.ts`

- [ ] **Step 1: Write the file**

```ts
export interface EuropeCountry {
  code: string // ISO2, uppercase
  label: string
}

// EU/EEA + UK + Switzerland — matches JSearch's and EURES's country coverage.
export const EUROPE_COUNTRIES: EuropeCountry[] = [
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Allemagne' },
  { code: 'AT', label: 'Autriche' },
  { code: 'BE', label: 'Belgique' },
  { code: 'BG', label: 'Bulgarie' },
  { code: 'CY', label: 'Chypre' },
  { code: 'HR', label: 'Croatie' },
  { code: 'DK', label: 'Danemark' },
  { code: 'ES', label: 'Espagne' },
  { code: 'EE', label: 'Estonie' },
  { code: 'FI', label: 'Finlande' },
  { code: 'GR', label: 'Grèce' },
  { code: 'HU', label: 'Hongrie' },
  { code: 'IE', label: 'Irlande' },
  { code: 'IS', label: 'Islande' },
  { code: 'IT', label: 'Italie' },
  { code: 'LV', label: 'Lettonie' },
  { code: 'LI', label: 'Liechtenstein' },
  { code: 'LT', label: 'Lituanie' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'MT', label: 'Malte' },
  { code: 'NO', label: 'Norvège' },
  { code: 'NL', label: 'Pays-Bas' },
  { code: 'PL', label: 'Pologne' },
  { code: 'PT', label: 'Portugal' },
  { code: 'CZ', label: 'République tchèque' },
  { code: 'RO', label: 'Roumanie' },
  { code: 'GB', label: 'Royaume-Uni' },
  { code: 'SK', label: 'Slovaquie' },
  { code: 'SI', label: 'Slovénie' },
  { code: 'SE', label: 'Suède' },
  { code: 'CH', label: 'Suisse' },
]
```

- [ ] **Step 2: Commit**

```bash
git add components/search/countries.ts
git commit -m "feat: add Europe country list for onboarding

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(No test file — this is a static data constant, nothing to assert beyond what TypeScript already checks.)

---

### Task 3: `fetchJSearch` accepts a country parameter

**Files:**
- Modify: `lib/scrapers/jsearch.ts:13-22`
- Test: `__tests__/lib/scrapers/jsearch.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */

import { fetchJSearch } from '@/lib/scrapers/jsearch'

describe('fetchJSearch', () => {
  const originalFetch = global.fetch
  const originalKey = process.env.RAPIDAPI_KEY

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.RAPIDAPI_KEY = originalKey
  })

  it('defaults to country=fr when no country is passed', async () => {
    await fetchJSearch('développeur', 'Lille')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('country=fr')
  })

  it('passes a custom country through to the request URL', async () => {
    await fetchJSearch('praktikum', 'Berlin', [], 'de')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('country=de')
    expect(url).not.toContain('country=fr')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/scrapers/jsearch.test.ts`
Expected: FAIL — second test fails because `fetchJSearch` doesn't accept a 4th argument and always sends `country=fr`.

- [ ] **Step 3: Implement**

```ts
export async function fetchJSearch(
  keywords: string,
  location: string,
  qualifications: string[] = [],
  country: string = 'fr'
): Promise<ScrapedJob[]> {
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('RAPIDAPI_KEY not set, skipping JSearch')
    return []
  }

  const qualStr = qualifications.length > 0 ? ' ' + qualifications.join(' ') : ''
  const query = `${keywords}${qualStr} ${location}`
  const res = await fetch(
    `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&country=${country.toLowerCase()}&num_pages=2`,
    {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    }
  )
  // ...(rest of function body unchanged — response mapping stays as-is)
```

(Only the function signature and the `country=` query segment change; the `if (!res.ok) throw`, `data.map(...)` body below stays exactly as it is today.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/lib/scrapers/jsearch.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/jsearch.ts __tests__/lib/scrapers/jsearch.test.ts
git commit -m "feat: parametrize JSearch country instead of hardcoding fr

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `fetchEures` — new EURES scraper

**Files:**
- Create: `lib/scrapers/eures.ts`
- Test: `__tests__/lib/scrapers/eures.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */

import { fetchEures } from '@/lib/scrapers/eures'

describe('fetchEures', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('maps a real-shaped EURES response to ScrapedJob', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        numberRecords: 1,
        jvs: [
          {
            title: 'Sales Trainee (m/w/d)',
            description: 'desc',
            id: 'MTIyNjUtNTE1MjYwX0pCNTIzNTA5Ny1TIDE',
            creationDate: 1788211374245,
            locationMap: { DE: ['DE300'] },
            positionOfferingCode: 'internship',
            employer: { name: 'FERCHAU Contract GmbH' },
            availableLanguages: ['de'],
          },
        ],
      }),
    })

    const jobs = await fetchEures('praktikum', 'de')

    expect(jobs).toEqual([
      {
        titre: 'Sales Trainee (m/w/d)',
        entreprise: 'FERCHAU Contract GmbH',
        lien: 'https://europa.eu/eures/portal/jv-se/jv-details/MTIyNjUtNTE1MjYwX0pCNTIzNTA5Ny1TIDE?jvDisplayLanguage=de',
        localisation: 'DE',
        source: 'eures',
        type_contrat: 'internship',
        salaire_min: null,
        salaire_max: null,
        raw_data: expect.objectContaining({ id: 'MTIyNjUtNTE1MjYwX0pCNTIzNTA5Ny1TIDE' }),
      },
    ])

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('https://europa.eu/eures/api/jv-searchengine/public/jv-search/search')
    const body = JSON.parse(init.body)
    expect(body.locationCodes).toEqual(['DE'])
    expect(body.positionOfferingCodes).toEqual(['internship'])
    expect(body.keywords).toEqual([{ keyword: 'praktikum', specificSearchCode: 'EVERYWHERE' }])
  })

  it('returns [] on a non-2xx response instead of throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })
    const jobs = await fetchEures('stage', 'fr')
    expect(jobs).toEqual([])
  })

  it('returns [] when the network call itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))
    const jobs = await fetchEures('stage', 'fr')
    expect(jobs).toEqual([])
  })

  it('returns [] when the response body is not the expected shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: true }) })
    const jobs = await fetchEures('stage', 'fr')
    expect(jobs).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/scrapers/eures.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scrapers/eures'`

- [ ] **Step 3: Implement**

```ts
import type { ScrapedJob } from './jsearch'

const EURES_SEARCH_URL = 'https://europa.eu/eures/api/jv-searchengine/public/jv-search/search'

interface EuresJobVacancy {
  title: string
  id: string
  locationMap: Record<string, string[]>
  positionOfferingCode: string | null
  employer: { name: string | null } | null
  availableLanguages: string[]
}

interface EuresSearchResponse {
  numberRecords: number
  jvs: EuresJobVacancy[]
}

export async function fetchEures(keywords: string, country: string): Promise<ScrapedJob[]> {
  let res: Response
  try {
    res = await fetch(EURES_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resultsPerPage: 25,
        page: 1,
        sortSearch: 'MOST_RECENT',
        keywords: [{ keyword: keywords, specificSearchCode: 'EVERYWHERE' }],
        publicationPeriod: null,
        occupationUris: [],
        skillUris: [],
        requiredExperienceCodes: [],
        positionScheduleCodes: [],
        sectorCodes: [],
        educationAndQualificationLevelCodes: [],
        positionOfferingCodes: ['internship'],
        locationCodes: [country.toUpperCase()],
        euresFlagCodes: [],
        otherBenefitsCodes: [],
        requiredLanguages: [],
        minNumberPost: null,
        userPreferredLanguage: null,
        requestLanguage: 'en',
        sessionId: `jobtrackeria-${Date.now()}`,
      }),
    })
  } catch (err) {
    console.warn('EURES fetch failed', err)
    return []
  }

  if (!res.ok) {
    console.warn(`EURES search failed: ${res.status}`)
    return []
  }

  let data: EuresSearchResponse
  try {
    data = await res.json()
  } catch (err) {
    console.warn('EURES response was not valid JSON', err)
    return []
  }

  if (!Array.isArray(data.jvs)) return []

  return data.jvs.map(jv => ({
    titre: jv.title ?? 'Poste inconnu',
    entreprise: jv.employer?.name ?? null,
    lien: `https://europa.eu/eures/portal/jv-se/jv-details/${jv.id}?jvDisplayLanguage=${jv.availableLanguages?.[0] ?? 'en'}`,
    localisation: Object.keys(jv.locationMap ?? {})[0] ?? country.toUpperCase(),
    source: 'eures',
    type_contrat: jv.positionOfferingCode ?? null,
    salaire_min: null,
    salaire_max: null,
    raw_data: jv as unknown as Record<string, unknown>,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/lib/scrapers/eures.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/eures.ts __tests__/lib/scrapers/eures.test.ts
git commit -m "feat: add EURES scraper for Europe-wide internship listings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Country select in `StepVilles`

**Files:**
- Modify: `components/search/steps/StepVilles.tsx`
- Modify: `__tests__/components/search/steps/StepVilles.test.tsx`

- [ ] **Step 1: Add failing test cases**

Add to the existing `describe('StepVilles', ...)` block:

```ts
  it('renders the country select for each row, defaulting to France', () => {
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30 }]} onChange={() => {}} />)
    expect(screen.getByDisplayValue('France')).toBeInTheDocument()
  })

  it('updates pays when the country select changes', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Berlin', rayon_km: 30, pays: 'de' }]} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByDisplayValue('Allemagne'), 'FR')
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Berlin', rayon_km: 30, pays: 'FR' }])
  })

  it('adds a new row defaulting to France', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30, pays: 'FR' }]} onChange={onChange} />)
    await userEvent.click(screen.getByText('+ Ajouter une ville'))
    expect(onChange).toHaveBeenCalledWith([
      { ville: 'Lille', rayon_km: 30, pays: 'FR' },
      { ville: '', rayon_km: 30, pays: 'FR' },
    ])
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepVilles.test.tsx`
Expected: FAIL — no country select exists yet, `addRow` doesn't set `pays`.

- [ ] **Step 3: Implement**

```tsx
'use client'

import { useState } from 'react'
import type { SearchLocation } from '@/lib/supabase/types'
import { inputClass } from '../wizardStyles'
import { EUROPE_COUNTRIES } from '../countries'

interface StepVillesProps {
  value: SearchLocation[]
  onChange: (value: SearchLocation[]) => void
}

export function StepVilles({ value, onChange }: StepVillesProps) {
  const [ids, setIds] = useState<string[]>(() => value.map(() => crypto.randomUUID()))

  const updateRow = (index: number, patch: Partial<SearchLocation>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    setIds(prev => prev.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...value, { ville: '', rayon_km: 30, pays: 'FR' }])
    setIds(prev => [...prev, crypto.randomUUID()])
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium" style={{ color: 'var(--muted)' }}>Villes recherchées</label>
      {value.map((row, index) => (
        <div key={ids[index] ?? index} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted-light)' }}>Ville</label>
            <input
              value={row.ville}
              onChange={e => updateRow(index, { ville: e.target.value })}
              placeholder="Lille"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted-light)' }}>Pays</label>
            <select
              value={row.pays ?? 'FR'}
              onChange={e => updateRow(index, { pays: e.target.value })}
              className={`${inputClass} w-40`}
            >
              {EUROPE_COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted-light)' }}>Rayon (km)</label>
            <input
              type="number" min="0" max="100"
              value={row.rayon_km}
              onChange={e => updateRow(index, { rayon_km: Math.min(100, Math.max(0, Number(e.target.value))) })}
              className={`${inputClass} w-24`}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(index)}
            aria-label={`Supprimer la ville ${row.ville || index + 1}`}
            className="text-xs px-2 py-2 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
            style={{ color: 'var(--muted)' }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
      >
        + Ajouter une ville
      </button>
      <p className="text-xs" style={{ color: 'var(--muted-light)' }}>
        Le rayon ne s&apos;applique qu&apos;aux offres françaises (APEC, France Travail, HelloWork) ; pour les autres pays, la recherche couvre tout le pays via JSearch et EURES.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepVilles.test.tsx`
Expected: PASS (7 tests — 4 pre-existing + 3 new)

- [ ] **Step 5: Commit**

```bash
git add components/search/steps/StepVilles.tsx __tests__/components/search/steps/StepVilles.test.tsx
git commit -m "feat: add country select to StepVilles onboarding step

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Default new profiles to `pays: 'FR'` in `WizardModal`

**Files:**
- Modify: `components/search/WizardModal.tsx:42`

- [ ] **Step 1: Update the default row**

Find:
```ts
    localisations: profile?.localisations?.length ? profile.localisations : [{ ville: 'Lille', rayon_km: 30 } as SearchLocation],
```
Replace with:
```ts
    localisations: profile?.localisations?.length ? profile.localisations : [{ ville: 'Lille', rayon_km: 30, pays: 'FR' } as SearchLocation],
```

- [ ] **Step 2: Run the existing WizardModal test suite**

Run: `npx jest --no-coverage __tests__/components/search/WizardModal.test.tsx`
Expected: PASS — existing test fixtures pass `localisations` explicitly (without `pays`), which is still valid since the field is optional; this default only affects a *brand new* profile with no `profile` prop, which none of the current tests exercise.

- [ ] **Step 3: Commit**

```bash
git add components/search/WizardModal.tsx
git commit -m "feat: default new search profiles to France

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Wire EURES into the fetch route, scope French sources to `pays === 'fr'`

**Files:**
- Modify: `app/api/jobs/fetch/route.ts`
- Modify: `__tests__/api/jobs-fetch.test.ts`

- [ ] **Step 1: Update the existing test's mocks and expectations, add a non-FR case**

Add the EURES mock next to the others:
```ts
jest.mock('@/lib/scrapers/eures', () => ({ fetchEures: jest.fn().mockResolvedValue([]) }))
```
and the import:
```ts
import { fetchEures } from '@/lib/scrapers/eures'
```

Update the first test (French locations still fire all 5 sources) — replace the body of `'calls each scraper once per city × keyword combination'` with:

```ts
  it('calls all 5 sources once per city × keyword combination for French locations', async () => {
    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(4)
    expect(fetchEures).toHaveBeenCalledTimes(4)
    expect(fetchAPEC).toHaveBeenCalledTimes(4)
    expect(fetchHelloWork).toHaveBeenCalledTimes(4)
    expect(fetchFranceTravail).toHaveBeenCalledTimes(4)

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Lille', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(2, 'data engineer', 'Lille', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(3, 'data scientist', 'Paris', [], 'fr')
    expect(fetchJSearch).toHaveBeenNthCalledWith(4, 'data engineer', 'Paris', [], 'fr')

    expect(fetchEures).toHaveBeenNthCalledWith(1, 'data scientist', 'fr')
  })

  it('only calls JSearch and EURES for a non-French location, skipping APEC/HelloWork/France Travail', async () => {
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
    expect(fetchAPEC).not.toHaveBeenCalled()
    expect(fetchHelloWork).not.toHaveBeenCalled()
    expect(fetchFranceTravail).not.toHaveBeenCalled()

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Berlin', [], 'de')
    expect(fetchEures).toHaveBeenNthCalledWith(1, 'data scientist', 'de')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/api/jobs-fetch.test.ts`
Expected: FAIL — `fetchEures` mock is never called (route doesn't import it yet), `fetchJSearch` is called with 2 args not 4, and APEC/HelloWork/FT still fire for the German location.

- [ ] **Step 3: Implement the route changes**

Add the import (next to the other scraper imports):
```ts
import { fetchEures } from '@/lib/scrapers/eures'
```

Change the default-location fallback (line 75):
```ts
    const locations = profile.localisations?.length ? profile.localisations : [{ ville: 'Lille', rayon_km: 30, pays: 'fr' }]
```

Replace the `allPromises` construction (lines 92-97):
```ts
    const allPromises = locations.flatMap(loc => {
      const country = (loc.pays ?? 'fr').toLowerCase()
      const isFrance = country === 'fr'
      return keywordsList.flatMap(kw => [
        withTimeout(fetchJSearch(kw, loc.ville, [], country), 15000),
        withTimeout(fetchEures(kw, country), 10000),
        ...(isFrance
          ? [
              withTimeout(fetchAPEC(kw, loc.ville), 7000),
              withTimeout(fetchHelloWork(kw, loc.ville, typeContrats), 7000),
              withTimeout(fetchFranceTravail(kw, loc.ville, typeContrats, tempsPleinFilter), 7000),
            ]
          : []),
      ])
    })
```

Update the error-source-name lookup (line 103) — it can no longer assume a fixed stride of 4, since non-French locations only produce 2 promises per keyword instead of 5. Replace the whole `settled`/`allJobs` block (lines 99-108) with one that tags each promise with its source name up front instead of relying on index math:

```ts
    const taggedPromises = locations.flatMap(loc => {
      const country = (loc.pays ?? 'fr').toLowerCase()
      const isFrance = country === 'fr'
      return keywordsList.flatMap(kw => {
        const entries: [string, Promise<ScrapedJob[]>][] = [
          ['jsearch', withTimeout(fetchJSearch(kw, loc.ville, [], country), 15000)],
          ['eures', withTimeout(fetchEures(kw, country), 10000)],
        ]
        if (isFrance) {
          entries.push(
            ['apec', withTimeout(fetchAPEC(kw, loc.ville), 7000)],
            ['hellowork', withTimeout(fetchHelloWork(kw, loc.ville, typeContrats), 7000)],
            ['france_travail', withTimeout(fetchFranceTravail(kw, loc.ville, typeContrats, tempsPleinFilter), 7000)],
          )
        }
        return entries
      })
    })

    const settled = await Promise.allSettled(taggedPromises.map(([, p]) => p))

    const allJobs: ScrapedJob[] = settled.flatMap((r, i) => {
      if (r.status === 'fulfilled') return r.value
      const [source] = taggedPromises[i]
      if ((r as PromiseRejectedResult).reason) {
        results.errors.push(`${source}: ${(r as PromiseRejectedResult).reason}`)
      }
      return []
    })
```

This replaces the old `allPromises` block entirely — delete the earlier `allPromises` snippet from this step, it's superseded by `taggedPromises`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/api/jobs-fetch.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite and type-check**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add app/api/jobs/fetch/route.ts __tests__/api/jobs-fetch.test.ts
git commit -m "feat: fetch JSearch+EURES for every location, scope French sources to pays=fr

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Country field in onboarding, per city → Task 5 (+ Task 1 for the type, Task 2 for the list).
- Unlock JSearch multi-country → Task 3.
- Add EURES → Task 4, wired in Task 7.
- Route French-only sources by location → Task 7.
- Backward compatibility (no migration) → `pays` is optional throughout (Task 1), defaulted at every read site (`loc.pays ?? 'fr'` in the route, `row.pays ?? 'FR'` in `StepVilles`).

**Placeholder scan:** no TBDs; every step has literal code. The EURES contract that was flagged as an "open risk" in the spec has been resolved by live verification, not left as a guess.

**Type consistency:** `SearchLocation.pays` (Task 1) is read the same way in `StepVilles.tsx` (Task 5), `WizardModal.tsx` (Task 6), and `route.ts` (Task 7) — always `?? 'fr'`/`'FR'` with lowercase used for API calls and uppercase for display/storage, matching how EURES's own `locationMap` and the country list already key by uppercase ISO2.

**Out of scope (per spec, phase 2):** country-specific local job boards (Germany, Belgium, Netherlands, Spain, Italy, UK) — not part of this plan.
