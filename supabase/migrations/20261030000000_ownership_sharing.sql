-- ATLAS v3: shared ownership, legal owner and read-only share links. Safe to run more than once. Run after the earlier migrations.

-- 1) Ownership: the share of an asset that is yours (default all of it) and who holds it
alter table public.assets add column if not exists ownership numeric not null default 100 check (ownership > 0 and ownership <= 100);
alter table public.assets add column if not exists owner text check (owner is null or char_length(owner) <= 60);

-- 2) Share links. Only a SHA-256 hash of the secret is stored, so a leaked table does not expose working links.
create table if not exists public.asset_shares (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label          text not null check (char_length(label) between 1 and 60),
  token_hash     text not null unique check (char_length(token_hash) = 64),
  include_debt   boolean not null default true,
  expires_at     timestamptz,
  revoked        boolean not null default false,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists asset_shares_user_idx on public.asset_shares (user_id, created_at);

alter table public.asset_shares enable row level security;
drop policy if exists "shares_select_own" on public.asset_shares;
drop policy if exists "shares_insert_own" on public.asset_shares;
drop policy if exists "shares_update_own" on public.asset_shares;
drop policy if exists "shares_delete_own" on public.asset_shares;
create policy "shares_select_own" on public.asset_shares for select to authenticated using (user_id = auth.uid());
create policy "shares_insert_own" on public.asset_shares for insert to authenticated with check (user_id = auth.uid());
create policy "shares_update_own" on public.asset_shares for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shares_delete_own" on public.asset_shares for delete to authenticated using (user_id = auth.uid());

-- Visitors never touch this table directly: the server function reads it with the service role.
revoke all on public.asset_shares from anon;
grant select, insert, update, delete on public.asset_shares to authenticated;
