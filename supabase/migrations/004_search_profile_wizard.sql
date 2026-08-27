-- Add domain field and multi-city support to search_profiles
alter table search_profiles
  add column if not exists domaine text,
  add column if not exists localisations jsonb default '[]';

-- Migrate existing single-city data into the new jsonb array
update search_profiles
set localisations = jsonb_build_array(jsonb_build_object('ville', localisation, 'rayon_km', rayon_km))
where localisation is not null and localisation <> '' and (localisations is null or localisations = '[]');
