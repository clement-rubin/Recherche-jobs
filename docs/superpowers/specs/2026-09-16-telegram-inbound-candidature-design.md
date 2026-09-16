# Telegram Inbound Candidature — Design

## Purpose

Let the user text the Telegram bot after a call ("Entretien avec Capgemini, poste dev stage 6 mois") and have it create or update a candidature directly, without opening the app. Reuses the existing Groq intent-parser from the voice assistant (`lib/assistant/groq.ts`) instead of building a new one.

## Scope

- Single-user only. The bot is mapped to one Supabase account via env var — no chat-to-account linking table, no login flow.
- Free-text French messages, parsed by Groq (same `processIntent` used today by the voice assistant).
- Supports all three existing intents: `add_application`, `update_application`, `add_note` (not just adds — a message like "Capgemini a refusé" should also work).
- Direct execution + a reply summarizing what happened — no multi-turn Telegram confirmation flow.
- Out of scope: multi-user chat linking, inline keyboard buttons, editing/undoing a previous message, anything beyond the existing intent set.

## Data flow

```
Telegram → POST /api/telegram/webhook
  → verify X-Telegram-Bot-Api-Secret-Token header (TELEGRAM_WEBHOOK_SECRET)
  → verify message.chat.id === TELEGRAM_CHAT_ID
  → extract message.text
  → admin Supabase client (service role) scoped to TELEGRAM_OWNER_USER_ID
  → fetch last 10 applications for that user (same context processIntent expects)
  → processIntent(text, recentApps)   [existing lib/assistant/groq.ts, unchanged]
  → executeIntent(...)                [NEW shared helper]
  → sendTelegramMessage(replyText)    [NEW lib/telegram.ts]
```

## Shared action-execution helper

Extract the intent-execution logic currently inline in `app/api/assistant/process/route.ts` (lines ~61-125) into `lib/assistant/executeIntent.ts`:

```ts
export async function executeIntent(
  supabase: SupabaseClient,
  userId: string,
  intentResult: AssistantIntent,
  recentApps: Array<{ id: string; entreprise: string; poste: string; statut: string }>
): Promise<{ executed: boolean }>
```

Both `app/api/assistant/process/route.ts` and the new webhook route call this — same matching/update/note logic, no duplication. Behavior is unchanged from what exists today:

- `add_application`: insert with `user_id`, `entreprise`, `poste` (fallback `'Poste à préciser'`), `type_contrat` (fallback `'interim'`), `source` — voice assistant passes `'assistant'`, the webhook passes `'telegram'` (only difference between callers, passed as a parameter).
- `update_application`: fuzzy substring match against `recentApps` by `entreprise`, applies `statut`/`resultat`/appends a timestamped `note`.
- `add_note`: same fuzzy match, appends timestamped note only.
- Every call still writes to `assistant_logs` (`transcription`, `intent`, `action_taken`, `success`).

## Refusal guard (unchanged, reused)

The existing server-side guard in `assistant/process` — `statut=termine` + `resultat=refus` forces `requires_confirmation=true` and skips execution — stays exactly as is. The webhook route checks the same flag:

- If `requires_confirmation` (refusal detected): do **not** execute. Reply telling the user to confirm in the app.
- No Telegram-side multi-turn confirmation flow is built — the existing "requires confirmation → UI shows a confirm button" pattern only exists in the web assistant UI; Telegram just declines and defers to the app for that one case.

## Telegram helper

New `lib/telegram.ts` (master doesn't have this yet — the earlier outbound-notifications spec that introduced it lives in an unmerged worktree branch and is unrelated to this feature):

```ts
export async function sendTelegramMessage(text: string): Promise<void>
```

Same shape as the existing worktree version: POSTs to `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` with `chat_id: TELEGRAM_CHAT_ID`, throws on non-ok response, no-ops with a console warning if the token/chat id env vars are unset.

## Webhook route

New `app/api/telegram/webhook/route.ts`, POST handler:

1. Read `X-Telegram-Bot-Api-Secret-Token` header; compare to `TELEGRAM_WEBHOOK_SECRET`. Mismatch or unset → `401`, do not parse body.
2. Parse Telegram `Update` JSON. If no `message.text`, return `200` (ack, nothing to do — avoids Telegram retry storms on non-text updates like edits/stickers).
3. Verify `message.chat.id.toString() === process.env.TELEGRAM_CHAT_ID`. Mismatch → `200` ack, no processing, no reply sent (don't leak bot behavior to strangers who find the URL).
4. Build admin Supabase client via new `createAdminSupabase()` (`lib/supabase/admin.ts`, uses `SUPABASE_SERVICE_ROLE_KEY`).
5. `userId = process.env.TELEGRAM_OWNER_USER_ID` (required; if unset, log error and reply with the "assistant unavailable" message rather than crash).
6. Fetch last 10 applications for `userId` (mirrors `assistant/process`).
7. `processIntent(message.text, recentApps)`. On Groq error, reply `❌ Assistant indisponible, réessaie dans quelques secondes` and return `200`.
8. If refusal guard triggers: reply `⚠️ <entreprise> détecté comme refusé — confirme dans l'app pour valider`, return `200`.
9. Otherwise `executeIntent(...)`, then reply based on outcome (see Reply messages), return `200`.
10. Always return `200` to Telegram once the update is parsed (Telegram retries aggressively on non-2xx) — failures are communicated via the chat reply, not the HTTP status.

## Reply messages

- `add_application` success: `✅ Ajouté : <entreprise> — <poste> (<type_contrat>)`
- `update_application` success: `✅ Mis à jour : <entreprise> → <statut/resultat>`
- `add_note` success: `✅ Note ajoutée à <entreprise>`
- No match found for update/note (executed=false): `🤔 Candidature "<entreprise>" introuvable dans les 10 dernières`
- `unknown` intent / low confidence: `🤔 Je n'ai pas compris, reformule ou utilise l'app`
- Refusal guard: `⚠️ <entreprise> détecté comme refusé — confirme dans l'app pour valider`
- Groq error: `❌ Assistant indisponible, réessaie dans quelques secondes`

## Security

- `TELEGRAM_WEBHOOK_SECRET`: Telegram echoes this header on every webhook call once set via `setWebhook`'s `secret_token` param. First gate, checked before any body parsing.
- `TELEGRAM_CHAT_ID` allowlist: second gate — even someone who discovers the webhook URL and guesses the secret can't act unless they're messaging from the allowlisted chat (belt-and-suspenders; the secret token alone is already unguessable, but this also protects against the token leaking).
- Route uses the service-role client, bypassing RLS — deliberate, since there's no user session in a webhook context. Every query is manually scoped to the single `TELEGRAM_OWNER_USER_ID`, never derived from request input, so a compromised secret can only ever affect that one account's data — not an arbitrary `user_id`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | yes | Sender allowlist + reply target |
| `TELEGRAM_WEBHOOK_SECRET` | yes | Validates incoming webhook calls are really from Telegram |
| `TELEGRAM_OWNER_USER_ID` | yes | Supabase user UUID that every insert/update is scoped to |

Document in `CLAUDE.md`'s environment variable table and `.env.local.example`.

## One-time manual setup (not code — run once after deploy)

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d url="https://YOUR-APP.netlify.app/api/telegram/webhook" \
  -d secret_token="$TELEGRAM_WEBHOOK_SECRET"
```

Document this command (with a placeholder token/URL) in `CLAUDE.md` or a short setup note, since it's a required activation step that isn't part of the codebase.

## Testing

- `lib/assistant/executeIntent.test.ts`: add/update/note paths, fuzzy entreprise matching, no-match case, `assistant_logs` write — adapted from whatever inline coverage `assistant/process` currently has for this logic.
- `app/api/assistant/process/route.test.ts`: updated to call through the extracted helper (behavior unchanged, so existing assertions should still hold).
- `app/api/telegram/webhook/route.test.ts`: secret-token rejection (missing/wrong header → 401), wrong `chat_id` → 200 no-op, missing `message.text` → 200 no-op, happy path for each intent, refusal-guard non-execution + correct reply text, Groq error path, missing `TELEGRAM_OWNER_USER_ID` path.
- `lib/telegram.ts` mocked in route tests — no real network calls in the test suite.

## Out of scope / explicitly not doing

- No chat-to-account linking table or login flow (single-user).
- No Telegram-side confirm/cancel buttons or multi-turn state for the refusal case.
- No editing or undoing a previously-sent message from Telegram — corrections happen in the app.
- No support for voice messages, images, or any non-text Telegram content.
