-- 007_linkedin_contacts.sql
-- LinkedIn outreach tracking: people already contacted and people to contact.

create type contact_status as enum ('a_contacter', 'contacte', 'repondu');

create table linkedin_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nom text not null,
  poste text,
  entreprise text,
  linkedin_url text not null,
  statut contact_status not null default 'a_contacter',
  date_contact date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on linkedin_contacts(user_id, statut);
create index on linkedin_contacts(user_id, created_at desc);

create trigger linkedin_contacts_updated_at
  before update on linkedin_contacts
  for each row execute function update_updated_at();

alter table linkedin_contacts enable row level security;
create policy "own data" on linkedin_contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
