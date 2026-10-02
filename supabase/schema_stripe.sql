-- Run after schema.sql. Adds ad_slots and a "pending_payment" listing status for premium checkout.

alter table listings drop constraint if exists listings_status_check;
alter table listings add constraint listings_status_check
  check (status in ('scheduled', 'pending_payment', 'live', 'rejected'));

create table if not exists ad_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text not null default 'active' check (status in ('active', 'canceled')),
  created_at timestamptz not null default now()
);

alter table ad_slots enable row level security;

drop policy if exists "ad slots are publicly readable" on ad_slots;
create policy "ad slots are publicly readable" on ad_slots for select using (true);
-- No insert/update policy for regular users: only the service_role key (used by the
-- Stripe webhook) can write here, which bypasses RLS entirely.
