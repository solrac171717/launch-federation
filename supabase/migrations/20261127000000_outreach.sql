-- Outreach: LinkedIn accounts connected through the provider (Unipile), and the messages sent from them. Run once in the Supabase SQL editor
-- after 20261126000000_leads.sql. Same rule as every table here: Row Level Security, each user reads and writes only their own rows.
-- Sending is done by the server (service role) from /api/tick; the browser only edits and approves drafts.

-- the business: who to watch, how fast to send, and when the person is at work
alter table public.business_profiles add column if not exists watch      text[]   not null default '{}';        -- LinkedIn pages and profiles whose audience is worth watching (competitors, creators)
alter table public.business_profiles add column if not exists auto_send  boolean  not null default false;       -- false: every message waits for the person to approve it
alter table public.business_profiles add column if not exists invite_cap smallint not null default 15 check (invite_cap between 1 and 20);
alter table public.business_profiles add column if not exists last_scan  timestamptz;                           -- the last time new people were looked for (every six hours)
alter table public.business_profiles add column if not exists tz        text     not null default 'UTC' check (char_length(tz) <= 60);

-- the leads: the LinkedIn member id the provider needs, and when they accepted the invitation
alter table public.leads add column if not exists provider_id  text check (provider_id is null or char_length(provider_id) <= 120);
alter table public.leads add column if not exists connected_at timestamptz;
alter table public.leads add column if not exists signal_kind  text check (signal_kind is null or signal_kind in ('post','comment','like','follow','job'));

-- LinkedIn accounts the person connected (only the provider's account id is kept, never a password or a cookie)
create table if not exists public.linkedin_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider_account_id text not null unique check (char_length(provider_account_id) between 1 and 120),
  name                text check (name is null or char_length(name) <= 120),
  status              text not null default 'connected' check (status in ('connected','needs_attention')),
  last_poll           timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- one row per message of a sequence: an invitation note, then two follow-ups once the person accepts
create table if not exists public.outreach (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id    uuid not null references public.leads (id) on delete cascade,
  account_id uuid references public.linkedin_accounts (id) on delete set null,
  step       text not null check (step in ('invite','follow1','follow2')),
  text       text not null check (char_length(text) between 1 and 2000),
  status     text not null default 'draft' check (status in ('draft','approved','sent','skipped','failed','stopped')),
  due_at     timestamptz,                       -- when it may go out; empty for a follow-up until the invitation is accepted
  sent_at    timestamptz,
  error      text check (error is null or char_length(error) <= 200),
  created_at timestamptz not null default now(),
  unique (lead_id, step)
);
create index if not exists outreach_due_idx on public.outreach (status, due_at);
create index if not exists outreach_user_idx on public.outreach (user_id, created_at desc);

alter table public.linkedin_accounts enable row level security;
alter table public.outreach enable row level security;
do $$ begin
  drop policy if exists "li_select_own" on public.linkedin_accounts;
  drop policy if exists "li_delete_own" on public.linkedin_accounts;
  drop policy if exists "outreach_own" on public.outreach;
end $$;
create policy "li_select_own" on public.linkedin_accounts for select to authenticated using (user_id = auth.uid());
create policy "li_delete_own" on public.linkedin_accounts for delete to authenticated using (user_id = auth.uid());   -- accounts are created by the server when the provider confirms the connection
create policy "outreach_own" on public.outreach for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.linkedin_accounts, public.outreach from anon;
grant select, delete on public.linkedin_accounts to authenticated;
grant select, insert, update, delete on public.outreach to authenticated;

-- the browser extension is gone: its pairing tokens are not needed
drop table if exists public.ingest_tokens;

-- The scheduler. Vercel's free plan has no frequent cron, so Supabase calls the site every 10 minutes (needs the pg_cron and pg_net extensions,
-- enabled in Dashboard > Database > Extensions). Put the same long random value in Vercel as CRON_SECRET and here, then run:
--   select cron.schedule('owned-map-tick', '*/10 * * * *', $$ select net.http_post(
--     url := 'https://ownedmap.com/api/tick', headers := '{"content-type":"application/json","x-cron-secret":"PASTE_THE_SECRET"}'::jsonb, body := '{}'::jsonb) $$);
