-- Owned Map v6.1: sign-up through Stripe checkout. Safe to run more than once. Run after the billing migration.
-- A visitor pays (starts the trial) on Stripe's page first; the server then creates their account from the email they typed there.
-- Only the server (service role) touches these two things.

-- 1) The account of an email, if there is one (Supabase's admin API cannot look an email up directly).
create or replace function public.user_id_by_email(mail text) returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(mail) limit 1;
$$;
revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- 2) One row per checkout that created an account. The page shown after paying lets the payer choose a password ONCE, and only for
--    an account that this very checkout created (`claimable`). An email that already had an account is never claimable this way.
create table if not exists public.checkout_claims (
  session_id text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  claimable  boolean not null default false,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
alter table public.checkout_claims enable row level security;   -- no policies: nobody but the server reads or writes it
revoke all on public.checkout_claims from anon, authenticated;
