-- Early-access leads for the ATLAS marketing site. Run once in the Supabase SQL editor.
create table if not exists public.early_access_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  email         text not null unique, -- stored lowercase by the API
  first_name    text not null,
  portfolio_size text not null,
  asset_types   text[] not null,
  investor_type text,
  consent_at    timestamptz not null,
  consent_text  text not null,
  source        text
);

-- Only the server (service-role key) writes; nobody reads or writes from the browser.
alter table public.early_access_leads enable row level security;
