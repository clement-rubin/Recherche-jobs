# Job Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack job search tracker with application management, email parsing, multi-source job scraping, and an AI voice assistant "Alex".

**Architecture:** Next.js 14 App Router at repo root, Supabase for DB + auth, Netlify for hosting + scheduled functions, Groq API for NLP intent parsing.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase, Groq (Llama 3.3 70B), Web Speech API, Cheerio, Netlify Scheduled Functions

---

## File Structure

```
/
├── app/
│   ├── layout.tsx                    # Root layout + nav + AssistantBubble
│   ├── page.tsx                      # Dashboard
│   ├── applications/page.tsx         # Candidatures tableau + kanban
│   ├── offers/page.tsx               # Offres à traiter
│   ├── search/page.tsx               # Profils de recherche
│   ├── settings/page.tsx             # OAuth + API keys
│   └── api/
│       ├── auth/gmail/connect/route.ts
│       ├── auth/gmail/callback/route.ts
│       ├── auth/outlook/connect/route.ts
│       ├── auth/outlook/callback/route.ts
│       ├── emails/sync/route.ts
│       ├── jobs/fetch/route.ts
│       ├── applications/route.ts
│       ├── applications/[id]/route.ts
│       ├── offers/route.ts
│       ├── offers/[id]/route.ts
│       └── assistant/process/route.ts
├── components/
│   ├── layout/Nav.tsx
│   ├── applications/ApplicationsTable.tsx
│   ├── applications/ApplicationForm.tsx
│   ├── applications/KanbanBoard.tsx
│   ├── offers/OfferCard.tsx
│   ├── assistant/AssistantBubble.tsx
│   └── ui/Badge.tsx
├── lib/
│   ├── supabase/client.ts            # Browser client
│   ├── supabase/server.ts            # Server client
│   ├── supabase/types.ts             # Generated DB types
│   ├── scrapers/jsearch.ts
│   ├── scrapers/apec.ts
│   ├── scrapers/hellowork.ts
│   ├── scrapers/france-travail.ts
│   ├── email/gmail.ts
│   ├── email/outlook.ts
│   ├── email/parser.ts
│   └── assistant/groq.ts
├── netlify/functions/
│   ├── sync-emails.ts                # Cron 8h + 20h
│   └── fetch-jobs.ts                 # Cron 7h lun-ven
├── supabase/migrations/
│   └── 001_initial_schema.sql
├── netlify.toml
├── next.config.ts
├── tailwind.config.ts
└── jest.config.ts
```

---

## Phase 1 — Foundation

### Task 1: Scaffold Next.js project

- [ ] Run `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"`
- [ ] Install dependencies:
```bash
npm install @supabase/supabase-js @supabase/ssr groq-sdk cheerio
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest ts-jest
```
- [ ] Create `jest.config.ts`:
```ts
import type { Config } from 'jest'
const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.tsx?$': 'ts-jest' },
}
export default config
```
- [ ] Create `jest.setup.ts`: `import '@testing-library/jest-dom'`
- [ ] Create `.env.local` with all keys from spec section 13 (placeholders)
- [ ] `git add . && git commit -m "feat: scaffold next.js project"`

---

### Task 2: Supabase schema

- [ ] Create `supabase/migrations/001_initial_schema.sql`:
```sql
create extension if not exists "pgcrypto";

create type application_status as enum ('en_cours', 'termine', 'relance');
create type application_result as enum ('accepte', 'refus', 'sans_reponse');
create type contract_type as enum ('interim', 'stage', 'cdi', 'cdd', 'alternance');
create type offer_status as enum ('non_traite', 'ignore', 'postule', 'sauvegarde');
create type email_type as enum ('offre', 'reponse', 'relance', 'autre');
create type oauth_provider as enum ('gmail', 'outlook');

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  entreprise text not null,
  poste text not null,
  lien_offre text,
  statut application_status default 'en_cours',
  resultat application_result,
  type_contrat contract_type,
  date_postulation date default current_date,
  notes text,
  source text default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titre text not null,
  entreprise text,
  lien text,
  salaire_min int,
  salaire_max int,
  localisation text,
  source text,
  type_contrat text,
  statut offer_status default 'non_traite',
  date_scraped timestamptz default now(),
  raw_data jsonb
);

create table email_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  provider oauth_provider,
  email_id text unique,
  expediteur text,
  sujet text,
  date_reception timestamptz,
  type_detecte email_type,
  application_id uuid references applications(id),
  offer_id uuid references offers(id),
  parsed_data jsonb,
  traite boolean default false
);

create table search_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nom text,
  actif boolean default false,
  type_contrat text[],
  mots_cles text[],
  localisation text,
  rayon_km int default 30,
  salaire_min int,
  created_at timestamptz default now()
);

create table oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  provider oauth_provider,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[]
);

create table assistant_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  transcription text,
  intent text,
  action_taken text,
  success boolean,
  created_at timestamptz default now()
);

-- RLS
alter table applications enable row level security;
alter table offers enable row level security;
alter table email_imports enable row level security;
alter table search_profiles enable row level security;
alter table oauth_tokens enable row level security;
alter table assistant_logs enable row level security;

create policy "own data" on applications for all using (auth.uid() = user_id);
create policy "own data" on offers for all using (auth.uid() = user_id);
create policy "own data" on email_imports for all using (auth.uid() = user_id);
create policy "own data" on search_profiles for all using (auth.uid() = user_id);
create policy "own data" on oauth_tokens for all using (auth.uid() = user_id);
create policy "own data" on assistant_logs for all using (auth.uid() = user_id);
```
- [ ] Run migration on Supabase dashboard (SQL Editor) or via `npx supabase db push`
- [ ] `git commit -m "feat: supabase schema migration"`

---

### Task 3: Supabase client + types

- [ ] Create `lib/supabase/types.ts` with Database interface matching schema (generate via `npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts`)
- [ ] Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```
- [ ] Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export const createServerSupabase = () => {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  )
}
```
- [ ] `git commit -m "feat: supabase client setup"`

---

### Task 4: Auth + layout

- [ ] Create `app/login/page.tsx` with Supabase Auth UI (magic link + Google):
```tsx
'use client'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const handleLogin = async (email: string) => {
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/` } })
  }
  // render form
}
```
- [ ] Create `app/layout.tsx` with dark theme, nav, auth guard (redirect to /login if no session)
- [ ] Create `components/layout/Nav.tsx` — 5 tabs: Dashboard / Candidatures / Offres / Recherche / Paramètres
- [ ] Create `components/ui/Badge.tsx`:
```tsx
const colors = { en_cours: 'bg-indigo-500', relance: 'bg-amber-500', termine: 'bg-red-500', accepte: 'bg-green-500' }
export function Badge({ status }: { status: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs text-white ${colors[status] ?? 'bg-gray-500'}`}>{status}</span>
}
```
- [ ] Add `tailwind.config.ts` with palette from spec (dark background, indigo accent)
- [ ] `git commit -m "feat: auth + layout + nav"`

---

### Task 5: Dashboard page

- [ ] Write test `__tests__/dashboard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/page'
// mock supabase
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }) }) }))
test('renders stats cards', () => {
  render(<DashboardPage />)
  expect(screen.getByText(/candidatures/i)).toBeInTheDocument()
})
```
- [ ] Run: `npx jest __tests__/dashboard.test.tsx` — expect FAIL
- [ ] Create `app/page.tsx` — fetch counts from `applications`, render 4 stat cards (Total / En cours / Relances / Terminées), recent activity list (last 5 applications)
- [ ] Run test — expect PASS
- [ ] `git commit -m "feat: dashboard page"`

---

## Phase 2 — Applications CRUD

### Task 6: Applications API

- [ ] Write test `__tests__/api/applications.test.ts`:
```ts
import { POST } from '@/app/api/applications/route'
import { NextRequest } from 'next/server'
jest.mock('@/lib/supabase/server', () => ({ createServerSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: '1', entreprise: 'Test' }, error: null }) }) }) }) }) }))
test('POST creates application', async () => {
  const req = new NextRequest('http://localhost/api/applications', { method: 'POST', body: JSON.stringify({ entreprise: 'Test', poste: 'Dev' }) })
  const res = await POST(req)
  expect(res.status).toBe(201)
})
```
- [ ] Run — FAIL
- [ ] Create `app/api/applications/route.ts` (GET list + POST create):
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  let query = supabase.from('applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (statut) query = query.eq('statut', statut)
  const { data, error } = await query
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await supabase.from('applications').insert({ ...body, user_id: user.id }).select().single()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```
- [ ] Create `app/api/applications/[id]/route.ts` (PATCH + DELETE)
- [ ] Run test — PASS
- [ ] `git commit -m "feat: applications API routes"`

---

### Task 7: Applications UI

- [ ] Create `components/applications/ApplicationsTable.tsx` — colonnes: Entreprise / Poste / Statut (Badge) / Date / Actions (Edit, Delete). Filtres inline par statut et type contrat.
- [ ] Create `components/applications/ApplicationForm.tsx` — modal avec champs: entreprise, poste, lien, type_contrat, date_postulation, notes. Submit → POST /api/applications
- [ ] Create `components/applications/KanbanBoard.tsx` — 3 colonnes (en_cours / relance / terminé), cartes draggables via `@hello-pangea/dnd` (`npm install @hello-pangea/dnd`)
- [ ] Create `app/applications/page.tsx` — toggle Table/Kanban, bouton "Nouvelle candidature"
- [ ] `git commit -m "feat: applications UI table + kanban"`

---

### Task 8: Offers API + UI

- [ ] Create `app/api/offers/route.ts` (GET avec filtres statut/source) et `app/api/offers/[id]/route.ts` (PATCH statut)
- [ ] Create `components/offers/OfferCard.tsx`:
```tsx
export function OfferCard({ offer, onAction }: { offer: Offer, onAction: (id: string, action: 'postule'|'ignore'|'sauvegarde') => void }) {
  return (
    <div className="bg-[#1A1D27] rounded-lg p-4 border border-[#2D3148]">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-white">{offer.titre}</h3>
          <p className="text-[#94A3B8] text-sm">{offer.entreprise} · {offer.localisation}</p>
          {offer.salaire_min && <p className="text-green-400 text-sm">{offer.salaire_min}€{offer.salaire_max ? `–${offer.salaire_max}€` : '+'}</p>}
        </div>
        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">{offer.source}</span>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onAction(offer.id, 'postule')} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded">Postuler</button>
        <button onClick={() => onAction(offer.id, 'sauvegarde')} className="text-xs border border-[#2D3148] text-[#94A3B8] hover:text-white px-3 py-1 rounded">Sauvegarder</button>
        <button onClick={() => onAction(offer.id, 'ignore')} className="text-xs text-[#94A3B8] hover:text-red-400 px-3 py-1 rounded">Ignorer</button>
      </div>
    </div>
  )
}
```
- [ ] `app/offers/page.tsx` — feed de OfferCard, filtre source + statut, "Postuler" crée automatiquement une application via POST /api/applications
- [ ] `git commit -m "feat: offers API + UI"`

---

## Phase 3 — Intégrations

### Task 9: Gmail OAuth

- [ ] Créer Google Cloud project, activer Gmail API, obtenir client_id + client_secret, ajouter redirect URI `http://localhost:3000/api/auth/gmail/callback`
- [ ] Create `app/api/auth/gmail/connect/route.ts`:
```ts
import { NextResponse } from 'next/server'

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
  })
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
```
- [ ] Create `app/api/auth/gmail/callback/route.ts` — échange code → tokens, stocke dans `oauth_tokens` via supabase server client
- [ ] Create `lib/email/gmail.ts`:
```ts
export async function fetchGmailMessages(accessToken: string, since: Date): Promise<GmailMessage[]> {
  const query = `after:${Math.floor(since.getTime() / 1000)} (subject:emploi OR subject:candidature OR subject:offre OR subject:entretien)`
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const { messages = [] } = await listRes.json()
  return Promise.all(messages.slice(0, 50).map(async ({ id }: { id: string }) => {
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    return msgRes.json()
  }))
}
```
- [ ] `git commit -m "feat: gmail oauth integration"`

---

### Task 10: Outlook OAuth

- [ ] Enregistrer app Azure AD (portal.azure.com), obtenir client_id + secret, scope `Mail.Read`
- [ ] Create `app/api/auth/outlook/connect/route.ts` — redirect vers `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- [ ] Create `app/api/auth/outlook/callback/route.ts` — échange code → tokens → `oauth_tokens`
- [ ] Create `lib/email/outlook.ts`:
```ts
export async function fetchOutlookMessages(accessToken: string, since: Date): Promise<OutlookMessage[]> {
  const filter = `receivedDateTime ge ${since.toISOString()}`
  const search = `"emploi" OR "candidature" OR "offre" OR "entretien"`
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$search=${encodeURIComponent(search)}&$top=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const { value = [] } = await res.json()
  return value
}
```
- [ ] `git commit -m "feat: outlook oauth integration"`

---

### Task 11: Email parser

- [ ] Write test `__tests__/email-parser.test.ts`:
```ts
import { parseEmailIntent } from '@/lib/email/parser'
test('detects refus', async () => {
  const result = await parseEmailIntent({ sujet: 'Suite à votre candidature', corps: 'Nous avons le regret de vous informer que votre candidature n'a pas été retenue.' })
  expect(result.type).toBe('reponse')
  expect(result.resultat).toBe('refus')
})
```
- [ ] Run — FAIL
- [ ] Create `lib/email/parser.ts` — utilise Groq pour classifier email:
```ts
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function parseEmailIntent(email: { sujet: string; corps: string }) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'system',
      content: `Analyse cet email de recherche d'emploi. Retourne UNIQUEMENT du JSON:
{"type":"offre"|"reponse"|"relance"|"autre","resultat":"accepte"|"refus"|"sans_reponse"|null,"entreprise":string|null,"poste":string|null,"lien":string|null}`
    }, {
      role: 'user',
      content: `Sujet: ${email.sujet}\nCorps: ${email.corps.slice(0, 1000)}`
    }],
    response_format: { type: 'json_object' }
  })
  return JSON.parse(completion.choices[0].message.content!)
}
```
- [ ] Create `app/api/emails/sync/route.ts` — fetch tokens Gmail + Outlook → fetchMessages → parseEmailIntent → upsert `email_imports` → si offre → créer `offers`, si réponse → fuzzy match `applications`
- [ ] Run test — PASS
- [ ] `git commit -m "feat: email parser + sync API"`

---

### Task 12: Job scrapers

- [ ] Create `lib/scrapers/jsearch.ts`:
```ts
export async function fetchJSearch(query: string, location: string): Promise<ScrapedJob[]> {
  const res = await fetch(`https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query + ' ' + location)}&country=fr&num_pages=2`, {
    headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }
  })
  const { data = [] } = await res.json()
  return data.map((j: any) => ({ titre: j.job_title, entreprise: j.employer_name, lien: j.job_apply_link, localisation: j.job_city, source: 'jsearch', type_contrat: j.job_employment_type, raw_data: j }))
}
```
- [ ] Create `lib/scrapers/apec.ts`:
```ts
export async function fetchAPEC(keywords: string[], location: string): Promise<ScrapedJob[]> {
  const res = await fetch('https://www.apec.fr/cms/webservices/rechercheOffre/rechercherOffre', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motsCles: keywords.join(' '), lieuTravail: location, nombreResultatsMaximum: 20 })
  })
  const { resultats = [] } = await res.json()
  return resultats.map((j: any) => ({ titre: j.intitule, entreprise: j.nomSociete, lien: `https://www.apec.fr/candidat/recherche-emploi.html/emploi/${j.numeroOffre}`, localisation: location, source: 'apec', raw_data: j }))
}
```
- [ ] Create `lib/scrapers/hellowork.ts` — Cheerio scraping:
```ts
import * as cheerio from 'cheerio'
export async function fetchHelloWork(query: string, location: string): Promise<ScrapedJob[]> {
  const url = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const html = await res.text()
  const $ = cheerio.load(html)
  const jobs: ScrapedJob[] = []
  $('[data-id-job]').each((_, el) => {
    jobs.push({
      titre: $(el).find('[data-cy="jobTitle"]').text().trim(),
      entreprise: $(el).find('[data-cy="company"]').text().trim(),
      lien: 'https://www.hellowork.com' + $(el).find('a').attr('href'),
      localisation: location,
      source: 'hellowork',
      raw_data: {}
    })
  })
  return jobs.slice(0, 20)
}
```
- [ ] Create `lib/scrapers/france-travail.ts` — API officielle OAuth client_credentials:
```ts
let ftToken: { token: string; expires: number } | null = null

async function getFTToken() {
  if (ftToken && ftToken.expires > Date.now()) return ftToken.token
  const res = await fetch('https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=partenaire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.FRANCE_TRAVAIL_CLIENT_ID!, client_secret: process.env.FRANCE_TRAVAIL_CLIENT_SECRET!, scope: 'api_offresdemploiv2 o2dsoffre' })
  })
  const { access_token, expires_in } = await res.json()
  ftToken = { token: access_token, expires: Date.now() + expires_in * 1000 - 5000 }
  return access_token
}

export async function fetchFranceTravail(keywords: string, commune: string): Promise<ScrapedJob[]> {
  const token = await getFTToken()
  const res = await fetch(`https://api.emploi-store.fr/partenaire/offresdemploi/v2/offres/search?motsCles=${encodeURIComponent(keywords)}&commune=${commune}&distance=30`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const { resultats = [] } = await res.json()
  return resultats.map((j: any) => ({ titre: j.intitule, entreprise: j.entreprise?.nom, lien: j.origineOffre?.urlOrigine, localisation: j.lieuTravail?.libelle, source: 'france_travail', type_contrat: j.typeContrat, raw_data: j }))
}
```
- [ ] Create `app/api/jobs/fetch/route.ts` — lit `search_profiles` actif → appelle les 4 scrapers en parallel → upsert `offers` (dédup sur lien)
- [ ] `git commit -m "feat: multi-source job scrapers"`

---

## Phase 4 — Assistant Alex

### Task 13: Groq intent API

- [ ] Write test `__tests__/assistant.test.ts`:
```ts
import { processIntent } from '@/lib/assistant/groq'
jest.mock('groq-sdk', () => ({ default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ intent: 'update_application', confidence: 0.95, action: { entreprise: 'Decathlon', statut: 'en_cours', note: 'entretien hier' }, message: 'Candidature Decathlon mise à jour.', requires_confirmation: false }) }}] }) } } })) }))
test('processes voice intent', async () => {
  const result = await processIntent("J'ai eu un entretien chez Decathlon hier", [])
  expect(result.intent).toBe('update_application')
  expect(result.action.entreprise).toBe('Decathlon')
})
```
- [ ] Run — FAIL
- [ ] Create `lib/assistant/groq.ts`:
```ts
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function processIntent(transcription: string, recentApplications: { entreprise: string; poste: string; statut: string }[]) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'system',
      content: `Tu es Alex, coach RH professionnel. Analyse la transcription et retourne UNIQUEMENT du JSON:
{"intent":"update_application"|"add_application"|"add_note"|"query"|"unknown","confidence":number,"action":object,"message":string,"requires_confirmation":boolean}
Candidatures récentes: ${JSON.stringify(recentApplications)}`
    }, { role: 'user', content: transcription }],
    response_format: { type: 'json_object' }
  })
  return JSON.parse(completion.choices[0].message.content!)
}
```
- [ ] Create `app/api/assistant/process/route.ts` — reçoit `{ transcription, context }` → `processIntent` → si `requires_confirmation: false` → applique l'action (update/insert DB) → retourne réponse
- [ ] Run test — PASS
- [ ] `git commit -m "feat: groq intent processing API"`

---

### Task 14: Assistant bubble UI

- [ ] Create `components/assistant/AssistantBubble.tsx`:
```tsx
'use client'
import { useState, useRef } from 'react'

export function AssistantBubble() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return alert('Speech Recognition non supporté')
    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.lang = 'fr-FR'
    recognitionRef.current.continuous = false
    recognitionRef.current.onresult = async (e) => {
      const text = e.results[0][0].transcript
      setTranscript(text)
      setListening(false)
      const res = await fetch('/api/assistant/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcription: text }) })
      const data = await res.json()
      setResponse(data.message)
    }
    recognitionRef.current.start()
    setListening(true)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {response && (
        <div className="bg-[#1A1D27] border border-[#2D3148] rounded-lg p-3 max-w-xs text-sm text-white shadow-lg">
          <p className="text-indigo-400 font-semibold text-xs mb-1">Alex</p>
          <p>{response}</p>
        </div>
      )}
      <button
        onClick={startListening}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${listening ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        title="Parler à Alex"
      >
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
        </svg>
      </button>
    </div>
  )
}
```
- [ ] Ajouter `<AssistantBubble />` dans `app/layout.tsx` (après auth check)
- [ ] `git commit -m "feat: assistant alex voice bubble"`

---

## Phase 5 — Automation + Deploy

### Task 15: Netlify cron

- [ ] Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[scheduled-functions]]
  name = "sync-emails"
  schedule = "0 8,20 * * *"

[[scheduled-functions]]
  name = "fetch-jobs"
  schedule = "0 7 * * 1-5"
```
- [ ] `npm install -D @netlify/plugin-nextjs`
- [ ] Create `netlify/functions/sync-emails.ts`:
```ts
import { schedule } from '@netlify/functions'
export const handler = schedule('0 8,20 * * *', async () => {
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/emails/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  })
  return { statusCode: 200 }
})
```
- [ ] Create `netlify/functions/fetch-jobs.ts` — même pattern vers `/api/jobs/fetch`
- [ ] Ajouter `CRON_SECRET` vérification dans `/api/emails/sync` et `/api/jobs/fetch` pour bloquer appels non-cron
- [ ] `git commit -m "feat: netlify scheduled functions"`

---

### Task 16: Search profiles + Settings

- [ ] Create `app/search/page.tsx` — CRUD profils de recherche (nom, mots-clés, localisation, type_contrat, rayon), bouton "Lancer recherche maintenant" → POST /api/jobs/fetch, aperçu résultats
- [ ] Create `app/settings/page.tsx` — 3 sections:
  - **Emails** : boutons "Connecter Gmail" (→ /api/auth/gmail/connect) et "Connecter Outlook", statut connexion
  - **API Keys** : input Groq API key (stocké localStorage), bouton test
  - **Préférences** : toggle dark/light mode
- [ ] `git commit -m "feat: search profiles + settings page"`

---

### Task 17: Deploy to Netlify

- [ ] Créer nouveau repo GitHub `job-tracker` et push
- [ ] Sur netlify.com : "New site from Git" → connecter repo → build command `npm run build`, publish `.next`
- [ ] Ajouter toutes les env vars depuis spec section 13 dans Netlify dashboard
- [ ] Vérifier deploy preview fonctionne
- [ ] Ajouter URL Netlify dans `NEXT_PUBLIC_APP_URL`
- [ ] Mettre à jour redirect URIs OAuth Google + Azure avec URL Netlify
- [ ] `git commit -m "chore: netlify deployment config"`

---

## Checklist de vérification finale

- [ ] Auth : login/logout fonctionne, RLS bloque accès cross-user
- [ ] Applications : CRUD complet, statuts corrects, kanban drag & drop
- [ ] Offres : scraping 4 sources, "Postuler" crée candidature
- [ ] Emails : sync Gmail + Outlook, parsing correct, email_id unique (pas de doublons)
- [ ] Assistant : dictée fr-FR reconnue, intent compris, DB mis à jour sans confirmation pour actions claires
- [ ] Cron : fonctions Netlify déclenchées aux bons horaires
- [ ] Mobile : navigation lisible, tableaux scrollables

---

## Variables d'environnement requises

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://<app>.netlify.app/api/auth/gmail/callback
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=https://<app>.netlify.app/api/auth/outlook/callback
RAPIDAPI_KEY=<your_rapidapi_key>
FRANCE_TRAVAIL_CLIENT_ID=
FRANCE_TRAVAIL_CLIENT_SECRET=
GROQ_API_KEY=<your_groq_key>
NEXT_PUBLIC_APP_URL=https://<app>.netlify.app
CRON_SECRET=<random_secret>
```
