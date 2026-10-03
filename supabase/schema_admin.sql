-- Admin role: one flag on profiles, plus access to review ad slot claims.

alter table profiles add column if not exists is_admin boolean not null default false;

-- Run this again any time after the account has signed in at least once
-- (the profiles row is created by the on_auth_user_created trigger on first sign-in).
update profiles set is_admin = true
where id = (select id from auth.users where email = 'carlosmartinezhold@gmail.com');

-- Ad slots aren't publicly readable (only the owner can see their own row), so
-- admins need their own policy to review every claimed slot, not just active ones.
drop policy if exists "admins can read all ad_slots" on ad_slots;
create policy "admins can read all ad_slots" on ad_slots
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
