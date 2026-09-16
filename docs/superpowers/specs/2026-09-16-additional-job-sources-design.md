# Additional Job Sources — Adzuna, Jooble, Reed.co.uk

## Context

Current scraping pipeline (`/api/jobs/fetch`) fans out across 5 sources: `jsearch`, `eures` (multi-country), and `apec`/`hellowork`/`france_travail` (France-only). An audit of legality and relevance found two of the existing sources (`apec`, `hellowork`) rely on unofficial/undocumented endpoints — that risk is out of scope for this spec and left as-is.

This spec adds three **free, officially documented** job-search APIs to broaden coverage into a handful of European markets. It also **removes** `apec` and `hellowork` entirely: the earlier audit found both rely on unofficial/undocumented endpoints (a scraped internal REST endpoint for APEC, HTML scraping with a spoofed User-Agent for HelloWork), and the user decided — after reviewing the audit — to drop them rather than accept that risk going forward. This is a scope change from the original draft of this spec, which had left that risk untouched; it's folded in here since both changes touch the same fan-out code in `route.ts`.

## Sources selected

| Source | Why | Free tier |
|---|---|---|
| Adzuna | Official API, self-serve key, covers 16-20 countries incl. `fr`/`gb`/`de`/`be` (verify `es` support at implementation time) | 1000 calls/month |
| Jooble | Official REST API, but **one API key per country domain** (e.g. `uk.jooble.org`, `de.jooble.org`) | Free on request, no published call cap |
| Reed.co.uk | Official API, UK-only job board | Free key, Basic Auth |

Explicitly excluded: Careerjet (pay-per-result, not free), LinkedIn/Welcome to the Jungle/JobTeaser/ErasmusIntern (no public API — scraping-only or requires manual institutional access, out of scope for this spec).

## Sources removed: apec, hellowork

Deleted entirely, not just unwired — `lib/scrapers/apec.ts` and `lib/scrapers/hellowork.ts` are removed along with every reference to them:

- `app/api/jobs/fetch/route.ts` — imports and fan-out entries removed
- `__tests__/api/jobs-fetch.test.ts` — mocks and assertions removed
- `components/offers/OfferCard.tsx`, `components/offers/OfferDetailModal.tsx` — `apec`/`hellowork` entries removed from `SOURCE_LABELS`
- `components/offers/SwipeCard.tsx` — `apec`/`hellowork` entries removed from `SOURCE_BADGE` and `SOURCE_LABELS`
- `app/offers/page.tsx` — `apec`/`hellowork` options removed from `SOURCE_FILTERS`
- `app/about/page.tsx` — marketing copy line naming APEC/HelloWork rewritten to reflect the actual active source list
- `CLAUDE.md` — scraping-pipeline bullets and the APEC/FT/HW note updated

Existing `offers` rows already in the database with `source = 'apec'` or `source = 'hellowork'` are left as-is (no migration/backfill) — the UI's source-label lookups already fall back to rendering the raw string when a source isn't in the label map, so old rows keep displaying (just without a pretty label) rather than breaking. `lib/analyzer/profile.ts`'s domain list (used for a different purpose — recognizing known job-board URLs, not for firing scrapers) is **not** touched; `apec.fr`/`hellowork.com` staying in that list is unrelated to this removal.

## Fan-out rules

Extends the existing per-location, per-keyword loop in `app/api/jobs/fetch/route.ts`:

- **Adzuna** — fires for every `(keyword, location)` pair regardless of country, same tier as `jsearch`/`eures`. Requires a country-code → Adzuna-slug mapping (`uk` → `gb`, others pass through).
- **Jooble** — fires only when `location.pays` ∈ `{uk, de, es, be}`. **Not** for `fr` (already covered by `apec`/`hellowork`/`france_travail`). Each supported country needs its own env var holding that country's API key; missing key for a given country → skip that country silently (`[]`), do not throw.
- **Reed** — fires only when `location.pays === 'uk'`.

All three follow the existing scraper contract: return `ScrapedJob[]`, never throw except where the existing pattern already does (`jsearch.ts` throws on non-OK response — new scrapers do **not** replicate that; they catch and return `[]`, matching `apec.ts`/`hellowork.ts`).

## Quota handling — hard cutoff before billing risk

Adzuna's 1000 calls/month free tier is not actively rationed by the existing fan-out (keyword × location), which can exhaust it quickly. Because the app runs on Netlify (stateless serverless functions), an in-memory counter would not survive between invocations — usage is tracked in Supabase instead, with a hard cutoff below the free limit so no call is ever made once the cap is reached.

**Schema** — new migration `supabase/migrations/006_api_usage_tracking.sql`. RLS is enabled on the table with **no policies** (denies all direct PostgREST access); a single `security definer` function is the only way in, so the cap check is a real atomic row-level operation, not a separate read-then-write pair of calls:

```sql
create table if not exists api_usage (
  source text not null,
  month_key text not null,
  calls integer not null default 0,
  primary key (source, month_key)
);

alter table api_usage enable row level security;

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

**Behavior**: a new small module `lib/scrapers/quota.ts` exports `checkAndReserveQuota(source: string, cap: number): Promise<boolean>`, which builds a Supabase client via `createServerSupabase()` and calls the `reserve_api_usage` RPC with the current UTC month (`YYYY-MM`). Because the check-and-increment happens in a single `UPDATE ... WHERE calls < cap` statement, Postgres's row lock makes it race-free even when multiple locations fire Adzuna calls concurrently within one `/api/jobs/fetch` run — no overshoot is possible, unlike a separate read-then-write pair. `adzuna.ts` calls this **before** making its HTTP request; if it returns `false` (cap reached, or the RPC itself errored — fail closed on any DB error, never risk an ambiguous state), `console.warn` + return `[]`, **no HTTP request is sent**. The `ADZUNA_MONTHLY_CAP` env var (code default `900`) still leaves a 100-call margin below Adzuna's 1000 free limit, as a buffer against any usage outside the app (e.g. manual testing against the same Adzuna account) — not because the counter itself can drift.

Jooble and Reed do not get this mechanism: neither publishes a call cap or a paid-overage model for their free API keys. If either introduces one later, the same table/RPC/pattern applies to them too.

## New files

- `lib/scrapers/quota.ts` — `checkAndReserveQuota(source: string, cap: number): Promise<boolean>` (see Quota handling section).
- `lib/scrapers/adzuna.ts` — `fetchAdzuna(keywords: string, location: string, country: string): Promise<ScrapedJob[]>`. GET `https://api.adzuna.com/v1/api/jobs/{slug}/search/1?app_id=&app_key=&what=&where=`. Missing `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` → `console.warn` + return `[]` (pattern: `jsearch.ts:19-22`). Calls `checkAndReserveQuota('adzuna', cap)` before firing the request.
- `supabase/migrations/006_api_usage_tracking.sql` — `api_usage` table (RLS enabled, no policies) + `reserve_api_usage` RPC (see Quota handling section). Applied manually via Supabase SQL Editor, same convention as migrations 004/005.
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
| `ADZUNA_MONTHLY_CAP` | adzuna.ts (default `900` if unset) |
| `JOOBLE_API_KEY_UK` | jooble.ts |
| `JOOBLE_API_KEY_DE` | jooble.ts |
| `JOOBLE_API_KEY_ES` | jooble.ts |
| `JOOBLE_API_KEY_BE` | jooble.ts |
| `REED_API_KEY` | reed.ts |

## Testing

Correction from an earlier draft of this spec: `jsearch.ts` and `eures.ts` **do** have unit tests (`__tests__/lib/scrapers/jsearch.test.ts`, `eures.test.ts` — mocking `global.fetch`, asserting URL/body construction and `[]`-on-failure behavior), and `__tests__/api/jobs-fetch.test.ts` asserts which sources fire for which country by mocking every scraper module and checking call counts. `apec.ts`/`hellowork.ts`/`france-travail.ts` are the untested ones. The new sources follow the **tested** convention (`jsearch`/`eures`-style), not the untested one: each new scraper gets its own test file mocking `global.fetch`, and `jobs-fetch.test.ts` gets new assertions for the country-gated fan-out rules above. Verification is `npx tsc --noEmit && npx jest --no-coverage`, plus a manual `/api/jobs/fetch` run with real keys checking `results.errors` and the `bySource` breakdown logged at `route.ts:124-127`.

## Out of scope

- Fixing the `apec`/`hellowork` unofficial-endpoint legal risk (separate concern, not touched here).
- Careerjet, JobTeaser, LinkedIn, Welcome to the Jungle, ErasmusIntern — no free/official API path, left for a future spec if the user wants to pursue institutional access (JobTeaser) or accept scraping risk.
- Adjusting Adzuna call volume/batching — accepted as-is per user decision.
