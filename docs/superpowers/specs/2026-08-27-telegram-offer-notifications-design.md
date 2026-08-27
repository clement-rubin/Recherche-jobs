# Telegram Offer Notifications — Design

## Purpose

Send a daily Telegram digest of the offers most likely to match the user, so they don't have to browse the full offers list to spot the good ones.

## Scope

- Twice-daily automated check (8am and 7pm) that scores unsent offers against each active search profile and sends a digest message for the ones above a threshold.
- No new UI. No per-offer manual "send to Telegram" action. No multi-channel/multi-bot support.

## Data model

New migration `supabase/migrations/006_add_telegram_sent_at.sql`:

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS telegram_sent_at timestamptz;
```

`Offer` type in `lib/supabase/types.ts` gains `telegram_sent_at: string | null`.

## Scoring

New `lib/scoring.ts`, pure function, no I/O:

```ts
export function computeOfferScore(offer: Offer, profile: SearchProfile): number
```

- **Qualification ratio** (weight 0.7): fraction of `profile.qualifications` found as a case-insensitive, accent-insensitive substring match anywhere in `titre + ' ' + entreprise + ' ' + JSON.stringify(raw_data)`. If `qualifications` is empty, this term contributes 0 (not 1 — an empty qualifications list should not inflate the score).
- **Contract match** (weight 0.3): 1 if the offer's normalized `type_contrat` contains any of the profile's `type_contrat` entries mapped through the existing `HW_CONTRACT_MAP`-style uppercase labels (CDI/CDD/INTERIM/STAGE/ALTERNANCE), else 0. If `profile.type_contrat` is empty, this term contributes 0.
- `score = qualifRatio * 0.7 + contractMatch * 0.3`, range 0–1.

Accent/case normalization: lowercase + strip diacritics (`normalize('NFD').replace(/[̀-ͯ]/g, '')`) on both sides of the substring check.

## Telegram sending

New `lib/telegram.ts`:

```ts
export async function sendTelegramMessage(text: string): Promise<void>
```

- POSTs to `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` with `chat_id: TELEGRAM_CHAT_ID`, `parse_mode: 'Markdown'`, `disable_web_page_preview: true`.
- Throws on non-ok response; caller logs and continues (a Telegram failure must not crash the notify route or lose track of which offers were scored).
- No-ops with a console warning if `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is unset (same pattern as scrapers checking `RAPIDAPI_KEY`).

## Notify route

New `app/api/telegram/notify/route.ts`, POST handler:

1. Auth: identical pattern to `app/api/jobs/fetch/route.ts` — session user OR `Authorization: Bearer ${CRON_SECRET}`.
2. Load active search profiles (`actif = true`), scoped to `user_id` when a session user is present, else all (cron path).
3. For each profile, query offers: `user_id` match, `telegram_sent_at IS NULL`, `statut = 'non_traite'`.
4. Score each offer via `computeOfferScore`; keep those with `score >= threshold` where `threshold = Number(process.env.TELEGRAM_SCORE_THRESHOLD) || 0.5`.
5. Sort kept offers by score descending.
6. If the kept list is empty for a profile, skip (no message sent, nothing marked).
7. Otherwise build one digest message:
   ```
   🎯 *N offres à fort potentiel*

   1. *<titre>* — <entreprise>
      <score%> match · <lien>

   2. ...
   ```
8. Call `sendTelegramMessage(digest)`.
9. On send success, update `telegram_sent_at = now()` for exactly the offers included in that digest (so a Telegram failure leaves them eligible for the next run instead of being silently dropped).
10. Response: `{ sent: <total offers marked>, profiles: <count processed> }`.

Errors from scoring/sending for one profile are caught and pushed to an `errors` array in the response, without aborting processing of other profiles (same resilience pattern as `jobs/fetch`).

## Cron trigger

New `netlify/functions/telegram-notify.ts`, modeled directly on `netlify/functions/fetch-jobs.ts`:

```ts
export const handler: Handler = schedule('0 8,19 * * *', async () => {
  // POST to `${NEXT_PUBLIC_APP_URL}/api/telegram/notify` with Bearer CRON_SECRET
})
```

Runs every day (not just weekdays) at 8am and 7pm.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | yes | Target chat to send digests to |
| `TELEGRAM_SCORE_THRESHOLD` | no (default `0.5`) | Minimum score to include an offer in the digest |

Document these in `CLAUDE.md`'s environment variable table and in `.env.local.example`.

## Testing

- `lib/scoring.test.ts`: qualification ratio matching (case/accent insensitivity, empty qualifications, empty raw_data), contract matching (mapped labels, no profile contract types), combined weighting, boundary at threshold.
- `app/api/telegram/notify/route.test.ts`: auth rejection (no session, no cron secret), empty-eligible-offers skip path (no send, nothing marked), successful digest marks only included offers, Telegram send failure leaves `telegram_sent_at` untouched for that batch.
- `lib/telegram.ts` mocked in route tests; no real network calls in test suite.

## Out of scope / explicitly not doing

- No UI toggle for the threshold or for enabling/disabling notifications — env var only.
- No retry/backoff on Telegram API failures beyond the next scheduled run.
- No per-offer "already seen in a previous digest" distinction beyond the `telegram_sent_at` flag — once marked, an offer is never re-sent even if its score would change (it won't, since qualifications/contract text don't change after scraping).
