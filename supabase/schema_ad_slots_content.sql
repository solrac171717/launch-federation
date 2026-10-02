-- Adds the ad content fields, and a public view that exposes only the safe columns
-- (never stripe_customer_id / stripe_subscription_id) so the sidebar can show active ads
-- to every visitor, not just the ad's owner.

alter table ad_slots add column if not exists name text;
alter table ad_slots add column if not exists tagline text;
alter table ad_slots add column if not exists logo_url text;
alter table ad_slots add column if not exists target_url text;

create or replace view ad_slots_public as
  select id, name, tagline, logo_url, target_url, created_at
  from ad_slots
  where status = 'active';

grant select on ad_slots_public to anon, authenticated;
