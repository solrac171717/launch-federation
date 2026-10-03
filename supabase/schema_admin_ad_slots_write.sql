-- Let admins insert, update, and delete ad_slots rows directly (so the super admin
-- can add free ad slots from /admin.html without going through Stripe checkout).

grant insert, update, delete on ad_slots to authenticated;

drop policy if exists "admin insert ad_slots" on ad_slots;
create policy "admin insert ad_slots" on ad_slots
for insert
with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "admin update ad_slots" on ad_slots;
create policy "admin update ad_slots" on ad_slots
for update
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "admin delete ad_slots" on ad_slots;
create policy "admin delete ad_slots" on ad_slots
for delete
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);
