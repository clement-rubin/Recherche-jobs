# LLM offer analysis (Groq + Tavily) — design

Date: 2026-10-08
Status: approved in brainstorming, pending spec review

## Goal

Replace the keyword-based analyzer (`lib/analyzer/fit.ts`, `lib/analyzer/company.ts`) with an LLM analysis driven by `prompts/analyse-offre.md`: for one offer, research the hiring company with sourced URLs, compare the offer to the candidate's CVs, produce a personalised hook ("accroche"), CV recommendations and a priority score.

Triggered on demand from an offer's detail modal ("Analyser"), result stored on the offer. The `/analyze` page (URL or pasted text) uses the same engine without storing.

## Constraints

- **Groq free tier**: `llama-3.3-70b-versatile` ≈ 12k tokens/min. One analysis ≈ 8k tokens → roughly one analysis per minute. No background/bulk analysis.
- **Netlify**: synchronous functions are cut at ~26 s. Route uses `maxDuration = 26`.
- **Tavily free tier**: 1000 credits/month. Company research is cached 90 days, so it is paid once per company.
- **Personal data**: CV text (phone, address) never goes in the repo. It lives in Supabase only.

## Architecture (approach A: two-stage pipeline driven by code)

```
OfferDetailModal ── "Analyser" ──► POST /api/offers/[id]/analyze
                                      │
  candidate_profile ◄─────────────────┤ 1. load profile (400 if missing)
  offerToText(offer) ─────────────────┤ 2. build offer text (needsText if < 300 chars)
  company_research (90 d cache) ◄─────┤ 3. cache hit? else Tavily + Groq extraction → upsert
  Groq analysis (JSON mode) ──────────┤ 4. analysis
  lib/analysis/priority.ts (pure) ────┤ 5. score_global, urgence, score, niveau computed in code
  offers.analysis / priority_score ◄──┘ 6. persist and return

POST /api/analyze (URL or text) ─► same lib, nothing persisted
```

### Modules — `lib/analysis/`

| File | Responsibility | Depends on |
|---|---|---|
| `types.ts` | `AnalysisResult`, `CompanyResearch`, `CandidateProfile` types | — |
| `offer-text.ts` | `offerToText(offer)`: title/company/location/contract + description read from known `raw_data` keys (`job_description`, `description`, …). Returns `{ text, sufficient }` (`sufficient` = text ≥ 300 chars) | `Offer` type |
| `lang.ts` | `detectLang(text)`: `'fr' \| 'en' \| 'autre'` by stopword counts. Picks which CV variant is sent (only one, to save tokens) | — |
| `research.ts` | `researchCompany(name, { tavily, groq })`: 2 Tavily searches (official site values/careers; news last 12 months), Groq extraction with `llama-3.1-8b-instant`, then **drops every `source_url` not in the Tavily result set**, recomputes `statut`. `normalizeCompanyName(name)` for the cache key | Tavily HTTP API, Groq |
| `analyze.ts` | `analyzeOffer({ profile, offerText, lang, research, today })`: builds the prompt, calls Groq `llama-3.3-70b-versatile` with `response_format: json_object`, validates, one retry on invalid JSON, flags banned words / > 60 words | Groq, `prompt.ts`, `priority.ts` |
| `prompt.ts` | Analysis prompt and research-extraction prompt as TS string builders (content derived from `prompts/analyse-offre.md`) | — |
| `priority.ts` | Pure functions: `computeMatchScore`, `computeUrgency`, `computePriority` | — |
| `groq.ts` | Shared Groq client + `callWithRetry` (moved from `lib/assistant/groq.ts`, which then imports it) | `groq-sdk` |

`lib/analyzer/fit.ts` and `lib/analyzer/company.ts` are deleted. `lib/analyzer/scraper.ts` stays (URL extraction with ToS/robots checks for `/analyze`). `lib/analyzer/profile.ts` keeps only the domain lists still used by `scraper.ts`; `PROFILE` is deleted.

### Prompt changes vs `prompts/analyse-offre.md`

`prompts/analyse-offre.md` stays the human-readable reference and is updated to match:

- Step 2 (research) is split out: code does the searching; the extraction prompt receives Tavily results (`url`, `title`, `content` trimmed) and may only cite those URLs.
- Step 3: the model no longer computes `score_global`. It outputs each requirement with `obligatoire: boolean`, the present ones with `preuve_cv`, plus `domaine_coherent: boolean`. Code computes the score.
- Step 5 is removed from the prompt: code computes urgency and priority from `date_limite`.
- Only one CV variant is sent (`cv_envoye`, chosen by `detectLang`), plus `cv_maitre` and `projet_pro`.

### Scoring (in code, `priority.ts`)

- `score_global` = round(70 × obligatoires présentes / obligatoires totales + 20 × souhaitées présentes / souhaitées totales + (domaine_coherent ? 10 : 0)). No obligatoire → 70; no souhaitée → 20. Any missing `bloquante` requirement → cap at 40. Clamped 0–100.
- `urgence`: days = `date_limite − today` (calendar days). ≤ 7 → 100, 8–14 → 85, 15–30 → 60, > 30 → 30, absent → 50.
- `date_limite < today` → `niveau = 'expiree'`, `score = 0`, accroche cleared.
- Else `score = round(0.7 × score_global + 0.3 × urgence)`; `haute` ≥ 70, `moyenne` 45–69, `basse` < 45.

### Data — migration `006_offer_analysis.sql`

```sql
create table candidate_profile (
  user_id uuid primary key references auth.users,
  cv_maitre text not null,
  cv_fr text,
  cv_en text,
  projet_pro text,
  updated_at timestamptz default now()
);

create table company_research (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nom_normalise text not null,
  data jsonb not null,
  date_recherche date not null,
  unique (user_id, nom_normalise)
);

alter table offers
  add column if not exists analysis jsonb,
  add column if not exists priority_score int,
  add column if not exists analyzed_at timestamptz;
```

RLS on both new tables: `auth.uid() = user_id` for all operations (same pattern as `001`). Types added by hand to `lib/supabase/types.ts`.

`candidate_profile` is filled once with a SQL insert generated from the CVs given in the brainstorming conversation, kept outside the repo and run manually in the Supabase SQL Editor. `cv_maitre` = union of the two French CVs (`CV_Clément_RUBIN.pdf`, Thales-targeted, has the DevOps year-3 line; `CV_2026-10-02_Clément_RUBIN.pdf`, general, has the extra BDP line), nothing added. User validates it before insert.

### Environment

| Variable | Used by |
|---|---|
| `GROQ_API_KEY` (existing) | `lib/analysis/groq.ts` |
| `TAVILY_API_KEY` (new) | `lib/analysis/research.ts`. Missing → research `insuffisante`, analysis still runs |

## Error handling

| Case | Behaviour |
|---|---|
| No `candidate_profile` | 400 « Profil candidat non configuré » |
| Offer text < 300 chars | 200 `{ needsText: true }`; modal shows a textarea, re-POST with `{ text }` |
| Groq 429 | 2 retries (2 s, 4 s), then 429 « Limite Groq atteinte, réessaie dans 1 min » |
| Tavily error / no key | research `insuffisante` + `avertissement`; **not cached** |
| Groq invalid / incomplete JSON | 1 retry, then 502 « Analyse invalide » |
| Unknown `source_url` | dropped; `statut` recomputed (≥ 1 valeur and ≥ 1 actualité → suffisante; one of the two → partielle; none → insuffisante) |
| Banned word or > 60 words in accroche | kept, warning appended to `accroche.avertissement` |
| Timeouts | Tavily 8 s per call; route `maxDuration = 26` |

The model's own priority/score fields, if present, are ignored.

## UI

- `components/analysis/AnalysisPanel.tsx` (shared): priority badge (haute/moyenne/basse/expirée + score), accroche with "Copier", present skills with `preuve_cv`, missing skills (bloquante highlighted), CV recommendations, company values/news with links, warnings.
- `OfferDetailModal`: "Analyser" button → loading state (10–20 s) → `AnalysisPanel`; "Réanalyser" once analysed; textarea when `needsText`.
- `OfferCard`: small priority badge when `priority_score` is set.
- Offers list: sort "Priorité" next to date (`priority_score desc nulls last`).
- `/analyze`: same engine via `POST /api/analyze`, renders `AnalysisPanel`, nothing stored.

Styling follows `globals.css` tokens (light zinc), no hardcoded dark hex.

## Tests (Jest, Groq and Tavily mocked)

- `__tests__/lib/analysis/priority.test.ts`: urgency boundaries (7, 8, 14, 15, 30, 31 days, absent), expired, level thresholds, cap at 40, empty requirement lists.
- `__tests__/lib/analysis/research.test.ts`: invented URLs dropped, statut recomputed, no cache write on Tavily error, `normalizeCompanyName`.
- `__tests__/lib/analysis/analyze.test.ts`: retry on invalid JSON, banned-word / length warnings, model priority ignored.
- `__tests__/lib/analysis/offer-text.test.ts`: each source shape, `sufficient` threshold.
- `__tests__/lib/analysis/lang.test.ts`: fr / en / other.
- `__tests__/api/offer-analyze.test.ts`: 400 without profile, `needsText`, cache hit skips Tavily, persists `analysis` + `priority_score`.
- `__tests__/components/analysis/AnalysisPanel.test.tsx`: states (each niveau, insuffisante warning, copy button).

## Out of scope

CV editing UI, background/bulk analysis, full cover-letter generation, PDF upload.
