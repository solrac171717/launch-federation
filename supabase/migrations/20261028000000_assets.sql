-- ATLAS app data. Run once in the Supabase SQL editor (after early_access.sql, if you use it).
-- Every row belongs to one user and Row Level Security guarantees nobody can read or change another user's assets,
-- even though the browser talks to the database directly with the public anon key.
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  type        text not null check (type in ('house','office','warehouse','parking','land','car','truck','motorcycle','rv','yacht','sailboat','jetski','aircraft','equipment')),
  place       text not null,
  country     text not null check (char_length(country) = 2),
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  value       numeric not null check (value >= 0),
  cost        numeric not null check (cost > 0),
  gross       numeric not null default 0 check (gross >= 0),
  expenses    numeric not null default 0 check (expenses >= 0),
  status      text not null default 'Held',
  acquired_on date,
  notes       text check (notes is null or char_length(notes) <= 500),
  history     jsonb not null default '[]'::jsonb,   -- [{ "d": "2026-03-01", "v": 685000 }, ...]
  is_sample   boolean not null default false,       -- rows created by "Load sample data", removable in one click
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists assets_user_idx on public.assets (user_id, created_at);

alter table public.assets enable row level security;

drop policy if exists "assets_select_own" on public.assets;
drop policy if exists "assets_insert_own" on public.assets;
drop policy if exists "assets_update_own" on public.assets;
drop policy if exists "assets_delete_own" on public.assets;
create policy "assets_select_own" on public.assets for select to authenticated using (user_id = auth.uid());
create policy "assets_insert_own" on public.assets for insert to authenticated with check (user_id = auth.uid());
create policy "assets_update_own" on public.assets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "assets_delete_own" on public.assets for delete to authenticated using (user_id = auth.uid());

-- Anonymous visitors get nothing.
revoke all on public.assets from anon;
grant select, insert, update, delete on public.assets to authenticated;
