-- Adds screenshot support to listings (up to 5, stored in Supabase Storage).

alter table listings add column if not exists screenshots text[] not null default '{}';

-- Storage bucket for logo + screenshot uploads, public read.
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists "public read listing-images" on storage.objects;
create policy "public read listing-images" on storage.objects
  for select using (bucket_id = 'listing-images');

drop policy if exists "authenticated upload listing-images" on storage.objects;
create policy "authenticated upload listing-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'listing-images');
