-- 008_linkedin_contacts_profile.sql
-- Pasted text of the person's LinkedIn profile (experiences), used to suggest an outreach message.

alter table linkedin_contacts add column if not exists profil_texte text;
