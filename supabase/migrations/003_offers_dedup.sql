-- Unique constraint on (user_id, lien) to prevent duplicate job listings
-- lien can be NULL so we use a partial unique index
create unique index if not exists offers_user_lien_unique
  on offers (user_id, lien)
  where lien is not null;
