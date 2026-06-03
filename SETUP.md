# Job Tracker — Setup Guide

## Prerequisites

- Node.js 20+
- Supabase account (free)
- Netlify account (free)
- Groq API key (free) from https://console.groq.com
- RapidAPI account with JSearch subscription

## 1. Supabase Setup

1. Create a new project at https://supabase.com
2. Go to SQL Editor and run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/migrations/002_oauth_unique.sql`
4. Get your project URL and anon key from Settings > API
5. Get your service role key from Settings > API (keep secret!)

## 2. Google OAuth (Gmail)

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Enable the Gmail API
4. Go to OAuth consent screen → External → Add scopes: `gmail.readonly`
5. Create credentials → OAuth 2.0 client ID → Web application
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/gmail/callback` (development)
   - `https://YOUR-APP.netlify.app/api/auth/gmail/callback` (production)
7. Copy Client ID and Client Secret

## 3. Microsoft OAuth (Outlook)

1. Go to https://portal.azure.com > App registrations
2. New registration → Accounts in any organizational directory + personal accounts
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/outlook/callback` (development)
   - `https://YOUR-APP.netlify.app/api/auth/outlook/callback` (production)
4. Go to Certificates & secrets → New client secret
5. Go to API permissions → Add: `Mail.Read` (Microsoft Graph, Delegated)
6. Copy Application (client) ID and secret value

## 4. France Travail API (optional)

1. Register at https://francetravail.io/
2. Create an application and subscribe to "Offres d'emploi v2"
3. Copy Client ID and Client Secret

## 5. Local Development

```bash
# Install dependencies
npm install

# Copy and fill environment variables
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

## 6. Deploy to Netlify

1. Push this repo to GitHub
2. Go to https://netlify.com → New site from Git
3. Connect your GitHub repo
4. Build settings (auto-detected from netlify.toml):
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Add all environment variables from `.env.local` to Netlify:
   - Site settings → Environment variables
   - Add each variable (replace localhost URLs with your Netlify domain)
6. Set `NEXT_PUBLIC_APP_URL` = `https://YOUR-APP.netlify.app`
7. Set `GOOGLE_REDIRECT_URI` = `https://YOUR-APP.netlify.app/api/auth/gmail/callback`
8. Set `MICROSOFT_REDIRECT_URI` = `https://YOUR-APP.netlify.app/api/auth/outlook/callback`
9. Deploy!

## 7. After Deployment

1. Update OAuth redirect URIs in Google Cloud Console and Azure to use your Netlify URL
2. Test Gmail OAuth: Settings → Connect Gmail
3. Test Outlook OAuth: Settings → Connect Outlook
4. Create a search profile in Recherche page
5. Trigger manual job fetch: Recherche → Lancer maintenant

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | ✓ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key | ✓ |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role | ✓ |
| GOOGLE_CLIENT_ID | Google OAuth client ID | For Gmail |
| GOOGLE_CLIENT_SECRET | Google OAuth secret | For Gmail |
| GOOGLE_REDIRECT_URI | Gmail callback URL | For Gmail |
| MICROSOFT_CLIENT_ID | Azure app client ID | For Outlook |
| MICROSOFT_CLIENT_SECRET | Azure app secret | For Outlook |
| MICROSOFT_REDIRECT_URI | Outlook callback URL | For Outlook |
| RAPIDAPI_KEY | JSearch RapidAPI key | ✓ |
| FRANCE_TRAVAIL_CLIENT_ID | France Travail API ID | Optional |
| FRANCE_TRAVAIL_CLIENT_SECRET | France Travail secret | Optional |
| GROQ_API_KEY | Groq API key (assistant) | ✓ |
| NEXT_PUBLIC_APP_URL | Your app URL | ✓ |
| CRON_SECRET | Secret for cron auth | ✓ |
