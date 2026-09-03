-- Drop old single-city location columns, now replaced by localisations (see 004)
-- Apply this only after verifying 004's backfill: select domaine, localisations from search_profiles limit 5;
alter table search_profiles
  drop column if exists localisation,
  drop column if exists rayon_km;
