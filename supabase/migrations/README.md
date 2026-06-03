# Supabase Migrations

## Apply migration

1. Go to your Supabase project dashboard
2. Open SQL Editor
3. Paste contents of `001_initial_schema.sql`
4. Run

Or via Supabase CLI:
```bash
npx supabase db push
```

## Tables

- `applications` — job applications you've sent
- `offers` — job offers to process (from email or scraping)
- `email_imports` — parsed emails from Gmail/Outlook
- `search_profiles` — job search criteria (keywords, location, contract type)
- `oauth_tokens` — Gmail/Outlook OAuth tokens
- `assistant_logs` — voice assistant interaction history
