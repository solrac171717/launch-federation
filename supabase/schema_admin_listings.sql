-- Lets admins approve/reject/unpublish any listing from the admin panel,
-- not just their own (the existing policy only allows auth.uid() = user_id).

drop policy if exists "admins can update any listing" on listings;
create policy "admins can update any listing" on listings
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
