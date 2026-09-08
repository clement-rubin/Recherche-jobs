# City Hub Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a user picks a country on a `StepVilles` row, show clickable chips for that country's known recruiting hubs so they don't have to already know which cities to target.

**Architecture:** One new static data file (`components/search/cityHubSuggestions.ts`, one city list per country — domain-agnostic, per the design spec's scope decision) consumed by `StepVilles.tsx`, which renders the list as a chip row under each city row. Clicking a chip replaces that row's `ville` field via the existing `updateRow` helper. No other files change — no data model, backend, or scraper impact.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-city-hub-suggestions-design.md`

---

### Task 1: City hub data file

**Files:**
- Create: `components/search/cityHubSuggestions.ts`

- [x] **Step 1: Write the file**

```ts
// Domain-agnostic: the cities that concentrate office/tech hiring in a
// country are largely the same regardless of role (data, dev, security...).
export const CITY_HUB_SUGGESTIONS: Record<string, string[]> = {
  FR: ['Paris', 'Lyon', 'Toulouse', 'Lille', 'Nantes'],
  DE: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'],
  AT: ['Vienna', 'Graz', 'Linz'],
  BE: ['Brussels', 'Antwerp', 'Ghent'],
  BG: ['Sofia', 'Plovdiv'],
  CY: ['Nicosia', 'Limassol'],
  HR: ['Zagreb', 'Split'],
  DK: ['Copenhagen', 'Aarhus'],
  ES: ['Madrid', 'Barcelona', 'Valencia', 'Bilbao'],
  EE: ['Tallinn', 'Tartu'],
  FI: ['Helsinki', 'Tampere', 'Espoo'],
  GR: ['Athens', 'Thessaloniki'],
  HU: ['Budapest', 'Debrecen'],
  IE: ['Dublin', 'Cork'],
  IS: ['Reykjavik'],
  IT: ['Milan', 'Rome', 'Turin', 'Bologna'],
  LV: ['Riga'],
  LI: ['Vaduz'],
  LT: ['Vilnius', 'Kaunas'],
  LU: ['Luxembourg'],
  MT: ['Valletta'],
  NO: ['Oslo', 'Bergen', 'Trondheim'],
  NL: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven'],
  PL: ['Warsaw', 'Krakow', 'Wroclaw', 'Poznan'],
  PT: ['Lisbon', 'Porto'],
  CZ: ['Prague', 'Brno'],
  RO: ['Bucharest', 'Cluj-Napoca'],
  GB: ['London', 'Manchester', 'Edinburgh', 'Bristol'],
  SK: ['Bratislava', 'Kosice'],
  SI: ['Ljubljana'],
  SE: ['Stockholm', 'Gothenburg', 'Malmo'],
  CH: ['Zurich', 'Geneva', 'Basel', 'Zug'],
}
```

- [x] **Step 2: Verify every key matches a country in `EUROPE_COUNTRIES`**

Verified: same 32 codes as `components/search/countries.ts`'s `EUROPE_COUNTRIES`.

- [x] **Step 3: Commit**

Committed as `8bc15b2` — "feat: add per-country city hub suggestions data".

---

### Task 2: Chip suggestions in `StepVilles`

**Files:**
- Modify: `components/search/steps/StepVilles.tsx`
- Modify: `__tests__/components/search/steps/StepVilles.test.tsx`

- [x] **Step 1: Write the failing tests**

Three tests added: chips render for the row's country; clicking a chip fills that row's `ville`; chips change when the row's country changes.

- [x] **Step 2: Run tests to verify the new ones fail** — confirmed FAIL before implementation.

- [x] **Step 3: Implement** — `StepVilles.tsx` now imports `CITY_HUB_SUGGESTIONS`, computes `cityHubs = CITY_HUB_SUGGESTIONS[(row.pays ?? 'FR').toUpperCase()] ?? []` per row, and renders a conditional chip row (`cityHubs.length > 0 && ...`) below each row's grid, each chip calling `updateRow(index, { ville: city })` on click.

- [x] **Step 4: Run tests to verify they pass** — 10/10 pass (7 pre-existing + 3 new).

- [x] **Step 5: Run the full suite and type-check** — `npx tsc --noEmit` clean, `npx jest --no-coverage` 21 suites / 97 tests pass, no regressions.

- [x] **Step 6: Commit**

Committed as `e664dff` — "feat: suggest city hubs as clickable chips per country row".

---

## Self-review notes

- **Spec coverage:** Data file (Task 1) ✅, chip rendering + click-to-fill (Task 2 Step 3) ✅, per-row country-scoped suggestions (Task 2 Step 3, keyed off `row.pays`) ✅, graceful empty case (`cityHubs.length > 0 &&` guard) ✅, no domain/backend/data-model changes (confirmed) ✅. All spec sections covered.
- **Placeholder scan:** none.
- **Type consistency:** `CITY_HUB_SUGGESTIONS` keys are uppercase ISO2 strings, matching how `StepVilles.tsx` normalizes `row.pays` via `.toUpperCase()` for the country `<select>` — the chip lookup reuses the exact same expression.

## Execution record

Both tasks implemented, spec-reviewed, and code-quality-reviewed via `superpowers:subagent-driven-development` — all reviews passed with no blocking issues. Final full-implementation review: ready to merge.
