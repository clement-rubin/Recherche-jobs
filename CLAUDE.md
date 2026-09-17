# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # type-check only
npx jest --no-coverage                        # run all tests
npx jest --no-coverage __tests__/path/to.test.tsx  # single test file
```

## Architecture

**JobTrackeria** — Next.js 16 App Router + Supabase + Netlify. Two distinct subsystems coexist in the same repo:

1. **Web app** (`app/`, `components/`, `lib/`) — full-stack Next.js job-tracking UI
2. **GitHub Actions scraper** (`.github/workflows/search-jobs.yml`) — standalone Python script, scrapes JSearch RapidAPI daily, outputs CSV + Discord webhook. Unrelated to the web app.

### Web App Data Flow

```
middleware.ts          → auth guard (redirects to /login if no session)
app/layout.tsx         → AppShell (checks auth server-side, renders Nav or login wrapper)
app/page.tsx           → server component, fetches all applications for dashboard stats
app/(client pages)     → 'use client', fetch data via /api/* routes
app/api/**             → Next.js route handlers (auth via createServerSupabase)
lib/supabase/server.ts → createServerSupabase() — cookie-based SSR client
lib/supabase/client.ts → createClient() — browser client (used in Nav for signOut)
lib/supabase/types.ts  → all DB types (Application, Offer, SearchProfile, etc.)
```

### Scraping Pipeline (`/api/jobs/fetch` POST)

Called from UI "Lancer maintenant" or via cron. For each active `search_profile`:
- Iterates **per city** (`localisations[]`) **then per keyword** (OR behavior on both axes) across 4 sources in parallel
- `lib/scrapers/jsearch.ts` — JSearch RapidAPI (requires `RAPIDAPI_KEY`)
- `lib/scrapers/apec.ts` — APEC REST API (cadre jobs, often 0 for manual work)
- `lib/scrapers/hellowork.ts` — cheerio HTML scraping
- `lib/scrapers/france-travail.ts` — France Travail OAuth2 API (requires `FRANCE_TRAVAIL_CLIENT_ID` + `FRANCE_TRAVAIL_CLIENT_SECRET`)
- Deduplicates by `lien` URL, inserts into `offers` table

**Critical**: qualifications from profile are NOT appended to search queries — they are metadata only. Keywords must be searched one at a time (spaces = AND on APEC/FT/HW).

### Key Design Decisions

- **AppShell** (`components/layout/AppShell.tsx`) renders desktop sidebar (`hidden lg:flex`) + `MobileHeader` (hamburger + GSAP drawer). Main content gets `lg:ml-56 pt-20 lg:pt-0`.
- **Auth** is checked twice: middleware (redirect) + layout (AppShell prop). The middleware excludes `/api/*` routes so API handlers do their own `getUser()` check.
- **Supabase types** in `lib/supabase/types.ts` are hand-maintained (not generated). `SearchProfile` has `qualifications text[]` and `duree_contrat` added via migration — run if not present:
  ```sql
  ALTER TABLE search_profiles
    ADD COLUMN IF NOT EXISTS qualifications text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS duree_contrat text DEFAULT 'peu_importe';
  ```
- **`SearchProfile.domaine`/`localisations`**: added by `supabase/migrations/004_search_profile_wizard.sql` (adds `domaine text`, `localisations jsonb`, backfills old `localisation`/`rayon_km` into `localisations`) then `005_drop_old_location_columns.sql` (drops the old columns). Apply manually via the Supabase SQL Editor, **004 first**, verify the backfill (`select domaine, localisations from search_profiles limit 5;`), then **005**. The old `localisation`/`rayon_km` scalar columns/fields no longer exist anywhere in the codebase after this — a project not yet migrated will 500 on every search-profile save.
- **Fonts**: `Outfit` (body) + `JetBrains Mono` (numbers) loaded via `next/font/google` in `layout.tsx`, exposed as CSS vars `--font-outfit` / `--font-mono`.
- **Theme**: light zinc — CSS vars defined in `globals.css` `:root`. Never use hardcoded dark hex colors like `#101220` or `#1a1d32`.
- **GSAP**: used for nav stagger, modal scale-in, mobile drawer slide. Guard against missing `requestAnimationFrame` in tests — TagInput does this already.
- **Telegram inbound bot** (`app/api/telegram/webhook/route.ts`): single-user only — no chat-to-account linking. Free-text French messages are parsed by the same Groq `processIntent` the voice assistant uses (`lib/assistant/groq.ts`), and executed through the shared `lib/assistant/executeIntent.ts` helper (also used by `app/api/assistant/process/route.ts`). Requires registering the webhook once after deploy:
  ```bash
  curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
    -d url="https://YOUR-APP.netlify.app/api/telegram/webhook" \
    -d secret_token="$TELEGRAM_WEBHOOK_SECRET"
  ```

### Environment Variables

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all Supabase clients |
| `RAPIDAPI_KEY` | jsearch.ts scraper |
| `FRANCE_TRAVAIL_CLIENT_ID` | france-travail.ts scraper |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | france-travail.ts scraper |
| `CRON_SECRET` | /api/jobs/fetch (Bearer auth for cron calls) |
| `GROQ_API_KEY` | assistant/groq.ts (voice assistant) |
| `TELEGRAM_BOT_TOKEN` | telegram.ts / telegram webhook |
| `TELEGRAM_CHAT_ID` | telegram.ts / telegram webhook (sender allowlist) |
| `TELEGRAM_WEBHOOK_SECRET` | telegram webhook (validates calls are really from Telegram) |
| `TELEGRAM_OWNER_USER_ID` | telegram webhook (Supabase user UUID every insert/update is scoped to) |

### Testing

Tests live in `__tests__/`. Jest + ts-jest + jsdom. `userEvent.setup({ delay: null })` required when using `jest.useFakeTimers()`. GSAP does not need mocking (TagInput guards `requestAnimationFrame`). Run `npx tsc --noEmit && npx jest --no-coverage` before committing.
