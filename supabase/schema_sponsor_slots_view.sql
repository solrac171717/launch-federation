-- Ad blockers commonly hide/block anything with "ad_slot"/"ads" in the name (both the
-- DOM element and the network request). This adds a neutrally-named view so the
-- sponsor cards actually render for visitors running an ad blocker.

create or replace view sponsor_slots_public as
  select id, name, tagline, logo_url, target_url, created_at
  from ad_slots
  where status = 'active';

grant select on sponsor_slots_public to anon, authenticated;
