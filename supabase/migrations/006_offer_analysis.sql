-- 006_offer_analysis.sql
-- Candidate profile (CVs as text), company research cache, analysis stored on offers.

create table candidate_profile (
  user_id uuid primary key references auth.users,
  cv_maitre text not null,
  cv_fr text,
  cv_en text,
  projet_pro text,
  updated_at timestamptz not null default now()
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

alter table candidate_profile enable row level security;
alter table company_research enable row level security;

create policy "own data" on candidate_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on company_research for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
