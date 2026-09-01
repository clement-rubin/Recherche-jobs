# Europe-wide internship search — design spec

Date: 2026-09-01

## Problem

The scraping pipeline (`/api/jobs/fetch`) and the search-profile onboarding wizard are hardcoded to France. Three of the four sources are French-government/French-market APIs (APEC, France Travail, HelloWork), and the fourth (JSearch) hardcodes `country=fr` even though the underlying API supports ~40 country codes. The onboarding wizard's city step (`StepVilles`) has no country concept — `SearchLocation` is `{ ville, rayon_km }` only.

Goal: let a user search for internships ("stages") across Europe, not just France.

## Scope

**In scope (this spec, phase 1):**
- Country field in onboarding, per city.
- Unlock JSearch's existing multi-country support.
- Add EURES (official EU/EEA job & traineeship portal) as a new source.
- Route French-only sources (APEC/France Travail/HelloWork) to fire only for French locations.

**Explicitly out of scope (phase 2, separate future spec/plan):**
- Country-specific local job boards (Stepstone/Indeed.de for Germany, InfoJobs for Spain, tirocinio boards for Italy, StepStone.be/Actiris for Belgium, studentjob.nl for Netherlands, UK boards). Priority order when tackled: Germany, Belgium, Netherlands, Spain, Italy, UK.

**Geographic coverage:** EU/EEA + UK + Switzerland + Norway (the "wider Europe" zone), not strict EU-27.

## Data model

`lib/supabase/types.ts` — `SearchLocation` gains a country field:

```ts
export interface SearchLocation {
  ville: string
  rayon_km: number
  pays: string // ISO2 country code, e.g. 'fr', 'de', 'uk'. Defaults to 'fr'.
}
```

No DB migration needed — `localisations` is stored as `jsonb`, existing rows without `pays` are treated as `'fr'` at read time (backward compatible).

## Onboarding UI

`components/search/steps/StepVilles.tsx`:
- Each city row gets a country `<select>` next to the ville input, defaulting to `'fr'`.
- Option list: FR + EU/EEA member states + UK + CH + NO (~30 entries), grouped or flat alphabetical by French country name.
- `addRow()` initializes new rows with `pays: 'fr'`.
- Add a short helper line under the section: radius (`rayon_km`) only affects the France-native sources (APEC/France Travail/HelloWork); it's ignored for JSearch/EURES.

## Scrapers

### `lib/scrapers/jsearch.ts`
- Remove the hardcoded `country=fr` query param.
- `fetchJSearch(keywords, location, qualifications, country = 'fr')` — pass `country` straight into the RapidAPI query string.
- No new dependency; JSearch already accepts the country codes we need.

### `lib/scrapers/eures.ts` (new)
- `POST https://europa.eu/eures/api/jv-searchengine/public/jv-search/search`
- No authentication required (per community-reverse-engineered docs — no official contract exists, treat as best-effort).
- Request body: `keywords: [{ keyword, specificSearchCode: 'EVERYWHERE' }]`, `locationCodes: [country]`, `page`, `resultsPerPage`, `sortSearch: 'MOST_RECENT'`.
- **Open implementation risk**: exact response field names are undocumented. First implementation step must be a live probe call to inspect the real response shape before writing the `ScrapedJob` mapper — do not guess field names ahead of time.
- Maps results to the shared `ScrapedJob` interface (same shape as `jsearch.ts` exports), `source: 'eures'`.
- Wrapped in try/catch like other scrapers; a malformed/changed response should degrade to `[]`, not throw, so one flaky source doesn't sink the whole fetch.

## Orchestration (`app/api/jobs/fetch/route.ts`)

Current loop (line ~92) fires all 4 scrapers for every location. New behavior per location:

- **Always**: `fetchJSearch(kw, loc.ville, [], loc.pays)`, `fetchEures(kw, loc.ville, loc.pays)`.
- **Only when `loc.pays === 'fr'`**: `fetchAPEC`, `fetchHelloWork`, `fetchFranceTravail` (unchanged calls).
- Same `withTimeout` + `Promise.allSettled` pattern; EURES timeout/failure is non-fatal like the existing sources.
- Fallback default location (line 75, used when a profile has no `localisations`) becomes `{ ville: 'Lille', rayon_km: 30, pays: 'fr' }`.
- Error-source-name array (line 103) needs an entry for `'eures'` at the matching index in the flatMap ordering.

## Error handling

- Unsupported/typo'd country codes: no server-side whitelist validation needed beyond the onboarding dropdown restricting input — if a bad code somehow reaches JSearch/EURES, the existing `allSettled` + error-collection path already absorbs a non-2xx response as a per-source failure.
- EURES being an unofficial/undocumented API is the main risk: if EU changes the endpoint or response shape, `fetchEures` should fail closed (return `[]`, log a warning) rather than break the whole pipeline.

## Testing

- `jsearch.test`: country param is passed through instead of hardcoded `'fr'`.
- `eures.test`: mocked fetch → response correctly mapped to `ScrapedJob[]`; malformed response → `[]`, no throw.
- `route.test`: FR location triggers all 5 sources (jsearch, eures, apec, hellowork, france_travail); non-FR location triggers only jsearch + eures.
- `StepVilles.test`: country select renders per row, changing it updates `pays` via `onChange`.

## Summary of touched files

| File | Change |
|---|---|
| `lib/supabase/types.ts` | `SearchLocation.pays: string` |
| `components/search/steps/StepVilles.tsx` | country `<select>` per row |
| `lib/scrapers/jsearch.ts` | drop hardcoded `country=fr`, accept param |
| `lib/scrapers/eures.ts` | new file |
| `app/api/jobs/fetch/route.ts` | per-location source branching by `pays` |
