-- Owned Map v5.1: a trusted person who can open the emergency sheet if the owner has not signed in for a chosen time (or if the owner releases it).
-- Safe to run more than once. Run after the earlier migrations.
-- The trusted person has no account: they hold a private link. Only a SHA-256 hash of its secret is stored here, and the server
-- (api/heir.js, service role) is the only thing that reads it. It decides at the moment of each visit whether the sheet is open.

create table if not exists public.emergency_access (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  contact_name  text not null check (char_length(contact_name) between 1 and 80),
  contact_email text check (contact_email is null or char_length(contact_email) between 3 and 254),
  inactive_days int  not null default 90 check (inactive_days in (30, 60, 90, 180, 365)),
  enabled       boolean not null default true,
  token_hash    text not null unique check (char_length(token_hash) = 64),
  last_seen_at  timestamptz not null default now(),   -- the owner's last visit to the app: every visit closes the sheet again
  warned_at     timestamptz,                          -- the owner was warned by email that it is about to open (server)
  released_at   timestamptz,                          -- the owner opened it on purpose
  notified_at   timestamptz,                          -- the trusted person was told it is open (server)
  opened_at     timestamptz,                          -- first time the trusted person opened it (server)
  opened_count  int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.emergency_access enable row level security;
drop policy if exists "heir_select_own" on public.emergency_access;
drop policy if exists "heir_insert_own" on public.emergency_access;
drop policy if exists "heir_update_own" on public.emergency_access;
drop policy if exists "heir_delete_own" on public.emergency_access;
create policy "heir_select_own" on public.emergency_access for select to authenticated using (user_id = auth.uid());
create policy "heir_insert_own" on public.emergency_access for insert to authenticated with check (user_id = auth.uid());
create policy "heir_update_own" on public.emergency_access for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "heir_delete_own" on public.emergency_access for delete to authenticated using (user_id = auth.uid());

revoke all on public.emergency_access from anon;
grant select, insert, update, delete on public.emergency_access to authenticated;
