# Additional Job Sources — Adzuna, Jooble, Reed.co.uk

## Context

Current scraping pipeline (`/api/jobs/fetch`) fans out across 5 sources: `jsearch`, `eures` (multi-country), and `apec`/`hellowork`/`france_travail` (France-only). An audit of legality and relevance found two of the existing sources (`apec`, `hellowork`) rely on unofficial/undocumented endpoints — that risk is out of scope for this spec and left as-is.

This spec adds three **free, officially documented** job-search APIs to broaden coverage into a handful of European markets without touching the existing sources or their risk profile.

## Sources selected

| Source | Why | Free tier |
|---|---|---|
| Adzuna | Official API, self-serve key, covers 16-20 countries incl. `fr`/`gb`/`de`/`be` (verify `es` support at implementation time) | 1000 calls/month |
| Jooble | Official REST API, but **one API key per country domain** (e.g. `uk.jooble.org`, `de.jooble.org`) | Free on request, no published call cap |
| Reed.co.uk | Official API, UK-only job board | Free key, Basic Auth |

Explicitly excluded: Careerjet (pay-per-result, not free), LinkedIn/Welcome to the Jungle/JobTeaser/ErasmusIntern (no public API — scraping-only or requires manual institutional access, out of scope for this spec).

## Fan-out rules

Extends the existing per-location, per-keyword loop in `app/api/jobs/fetch/route.ts`:

- **Adzuna** — fires for every `(keyword, location)` pair regardless of country, same tier as `jsearch`/`eures`. Requires a country-code → Adzuna-slug mapping (`uk` → `gb`, others pass through).
- **Jooble** — fires only when `location.pays` ∈ `{uk, de, es, be}`. **Not** for `fr` (already covered by `apec`/`hellowork`/`france_travail`). Each supported country needs its own env var holding that country's API key; missing key for a given country → skip that country silently (`[]`), do not throw.
- **Reed** — fires only when `location.pays === 'uk'`.

All three follow the existing scraper contract: return `ScrapedJob[]`, never throw except where the existing pattern already does (`jsearch.ts` throws on non-OK response — new scrapers do **not** replicate that; they catch and return `[]`, matching `apec.ts`/`hellowork.ts`).

## Quota handling

Adzuna's 1000 calls/month free tier is not actively rationed — the existing fan-out (keyword × location) can exhaust it quickly. Accepted trade-off: if the quota is exceeded, Adzuna's API returns an error response, which is caught and treated like any other scraper failure (`console.warn` + `[]`, logged into `results.errors`). No request batching or call-capping logic is added. Before shipping, confirm in Adzuna's dashboard/docs that exceeding the free tier returns an error rather than silently billing a payment method — no payment method should be attached to the account regardless.

## New files

- `lib/scrapers/adzuna.ts` — `fetchAdzuna(keywords: string, location: string, country: string): Promise<ScrapedJob[]>`. GET `https://api.adzuna.com/v1/api/jobs/{slug}/search/1?app_id=&app_key=&what=&where=`. Missing `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` → `console.warn` + return `[]` (pattern: `jsearch.ts:19-22`).
- `lib/scrapers/jooble.ts` — `fetchJooble(keywords: string, location: string, country: string): Promise<ScrapedJob[]>`. POST to the regional domain `https://{cc}.jooble.org/api/{key}`. Country → env var lookup map (`uk` → `JOOBLE_API_KEY_UK`, `de` → `JOOBLE_API_KEY_DE`, `es` → `JOOBLE_API_KEY_ES`, `be` → `JOOBLE_API_KEY_BE`). Country not in the map, or its key unset → return `[]` immediately.
- `lib/scrapers/reed.ts` — `fetchReed(keywords: string, location: string): Promise<ScrapedJob[]>`. GET `https://www.reed.co.uk/api/1.0/search`, Basic Auth with `REED_API_KEY` as username and empty password — the only Basic Auth source in the pipeline, worth a one-line comment in the file since it differs from every other scraper's header style.

All three map their response shape into the shared `ScrapedJob` interface (`lib/scrapers/jsearch.ts:1-11`) and tag `source` as `'adzuna'`, `'jooble'`, `'reed'` respectively — these values flow straight into the `offers.source` column, no DB migration needed.

## Wiring into route.ts

In `app/api/jobs/fetch/route.ts`, inside the `taggedPromises` builder (currently `route.ts:94-111`):

- Add `['adzuna', withTimeout(fetchAdzuna(kw, loc.ville, country), 7000)]` unconditionally, alongside `jsearch`/`eures`.
- Add a new conditional block (separate from the existing `isFrance` block) checking `['uk','de','es','be'].includes(country)` to push `['jooble', withTimeout(fetchJooble(kw, loc.ville, country), 7000)]`.
- Add `if (country === 'uk')` to push `['reed', withTimeout(fetchReed(kw, loc.ville), 7000)]`.

No changes to dedup (by `lien`), exclusion filtering, or the upsert/insert logic — new sources flow through the existing `allJobs` → `excluded` → `uniqueJobs` → `rows` pipeline unchanged.

## Env vars

Add to the Environment Variables table in `CLAUDE.md`:

| Variable | Used by |
|---|---|
| `ADZUNA_APP_ID` | adzuna.ts |
| `ADZUNA_APP_KEY` | adzuna.ts |
| `JOOBLE_API_KEY_UK` | jooble.ts |
| `JOOBLE_API_KEY_DE` | jooble.ts |
| `JOOBLE_API_KEY_ES` | jooble.ts |
| `JOOBLE_API_KEY_BE` | jooble.ts |
| `REED_API_KEY` | reed.ts |

## Testing

No existing unit tests cover the current scrapers (`apec.ts`, `hellowork.ts`, `jsearch.ts`, `france-travail.ts`, `eures.ts` all untested) — the new scrapers follow that same convention and are not unit-tested either, for consistency. Verification is `npx tsc --noEmit` plus a manual `/api/jobs/fetch` run with real keys, checking `results.errors` and the `bySource` breakdown logged at `route.ts:124-127`.

## Out of scope

- Fixing the `apec`/`hellowork` unofficial-endpoint legal risk (separate concern, not touched here).
- Careerjet, JobTeaser, LinkedIn, Welcome to the Jungle, ErasmusIntern — no free/official API path, left for a future spec if the user wants to pursue institutional access (JobTeaser) or accept scraping risk.
- Adjusting Adzuna call volume/batching — accepted as-is per user decision.
