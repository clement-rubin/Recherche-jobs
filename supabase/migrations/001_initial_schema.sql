create extension if not exists "pgcrypto";

-- Enums
create type application_status as enum ('en_cours', 'termine', 'relance');
create type application_result as enum ('accepte', 'refus', 'sans_reponse');
create type contract_type as enum ('interim', 'stage', 'cdi', 'cdd', 'alternance');
create type offer_status as enum ('non_traite', 'ignore', 'postule', 'sauvegarde');
create type email_type as enum ('offre', 'reponse', 'relance', 'autre');
create type oauth_provider as enum ('gmail', 'outlook');

-- Tables
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
  application_id uuid references applications(id) on delete set null,
  offer_id uuid references offers(id) on delete set null,
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

-- Indexes for common queries
create index on applications(user_id, statut);
create index on applications(user_id, created_at desc);
create index on offers(user_id, statut);
create index on offers(user_id, date_scraped desc);
create index on email_imports(user_id, traite);
create index on email_imports(email_id);

-- updated_at trigger for applications
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger applications_updated_at
  before update on applications
  for each row execute function update_updated_at();

-- Row Level Security
alter table applications enable row level security;
alter table offers enable row level security;
alter table email_imports enable row level security;
alter table search_profiles enable row level security;
alter table oauth_tokens enable row level security;
alter table assistant_logs enable row level security;

create policy "own data" on applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on offers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on email_imports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on search_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on oauth_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data" on assistant_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
