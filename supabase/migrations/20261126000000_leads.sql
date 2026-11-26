-- Leads: people who showed they may buy, found for the user's business. Run once in the Supabase SQL editor (after the earlier migrations).
-- Same rule as every other table here: Row Level Security, so each user reads and writes only their own rows with the public anon key.
-- The old `assets` tables are left alone; nothing in this file drops or changes them.

-- 1. the business the leads are searched for (one per user)
create table if not exists public.business_profiles (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  url         text check (url is null or char_length(url) <= 300),
  name        text check (name is null or char_length(name) <= 80),
  niche       text check (niche is null or char_length(niche) <= 200),
  audience    text check (audience is null or char_length(audience) <= 200),
  problem     text check (problem is null or char_length(problem) <= 240),
  tone        text check (tone is null or char_length(tone) <= 60),
  competitors text[] not null default '{}',
  queries     text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. the leads
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source         text not null check (source in ('hn','linkedin')),
  external_id    text not null check (char_length(external_id) between 1 and 120),
  intent         text not null default 'problem' check (intent in ('recommendation','complaint','pricing','alternative','problem')),
  score          smallint not null check (score between 0 and 100),
  status         text not null default 'new' check (status in ('new','contacted','replied','customer')),
  signal_text    text not null check (char_length(signal_text) between 1 and 1500),
  url            text check (url is null or char_length(url) <= 500),
  author_name    text check (author_name is null or char_length(author_name) <= 120),
  author_role    text check (author_role is null or char_length(author_role) <= 160),
  author_company text check (author_company is null or char_length(author_company) <= 120),
  author_url     text check (author_url is null or char_length(author_url) <= 300),
  place          text check (place is null or char_length(place) <= 120),
  country        text check (country is null or char_length(country) = 2),
  lat            double precision check (lat is null or lat between -90 and 90),
  lon            double precision check (lon is null or lon between -180 and 180),
  signal_at      timestamptz not null default now(),
  draft          text check (draft is null or char_length(draft) <= 2000),
  history        jsonb not null default '[]'::jsonb,       -- [{ "d": "2026-11-26", "e": "found" }, ...]
  is_sample      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, source, external_id)                     -- searching again never duplicates a signal
);
create index if not exists leads_user_idx on public.leads (user_id, signal_at desc);
create index if not exists leads_author_idx on public.leads (user_id, author_url);

-- 3. pairing tokens for the browser extension (only the SHA-256 hash is stored, as with share links)
create table if not exists public.ingest_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  label      text check (label is null or char_length(label) <= 60),
  revoked    boolean not null default false,
  last_used  timestamptz,
  created_at timestamptz not null default now()
);

alter table public.business_profiles enable row level security;
alter table public.leads enable row level security;
alter table public.ingest_tokens enable row level security;

do $$ begin
  -- policies are recreated so the file can be run again
  drop policy if exists "bp_own" on public.business_profiles;
  drop policy if exists "leads_own" on public.leads;
  drop policy if exists "tokens_select_own" on public.ingest_tokens;
  drop policy if exists "tokens_insert_own" on public.ingest_tokens;
  drop policy if exists "tokens_update_own" on public.ingest_tokens;
  drop policy if exists "tokens_delete_own" on public.ingest_tokens;
end $$;
create policy "bp_own" on public.business_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leads_own" on public.leads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tokens_select_own" on public.ingest_tokens for select to authenticated using (user_id = auth.uid());
create policy "tokens_insert_own" on public.ingest_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "tokens_update_own" on public.ingest_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tokens_delete_own" on public.ingest_tokens for delete to authenticated using (user_id = auth.uid());

revoke all on public.business_profiles, public.leads, public.ingest_tokens from anon;
grant select, insert, update, delete on public.business_profiles, public.leads, public.ingest_tokens to authenticated;
