-- Owned Map v6: plans and billing. Safe to run more than once. Run after the earlier migrations.
-- Stripe is the source of truth; the server (api/stripe-webhook.js, service role) writes this table. A user can only READ their own row.
-- Limits are enforced HERE, in the database, so no browser trick can add assets beyond the plan. They stay OFF until you switch them on (see the end).

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text not null default 'none' check (status in ('none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'comped')),
  assets_allowed         int  not null default 0 check (assets_allowed >= 0),
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean not null default false,
  last_event_at          bigint not null default 0,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own" on public.subscriptions for select to authenticated using (user_id = auth.uid());
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- The switch. While `enforce` is false nobody is limited, whatever their subscription says.
create table if not exists public.billing_switch (
  id      int primary key default 1 check (id = 1),
  enforce boolean not null default false
);
insert into public.billing_switch (id, enforce) values (1, false) on conflict (id) do nothing;
alter table public.billing_switch enable row level security;   -- no policies: only the functions below read it
revoke all on public.billing_switch from anon, authenticated;

-- Does this owner's plan have room? `adding` = how many more assets are about to exist (0 = just check the current count).
-- Sample rows never count. A subscription in trial, active, or being retried after a failed payment gives access.
create or replace function public.can_add_assets(owner_uid uuid, adding int default 0) returns boolean language plpgsql stable security definer set search_path = public as $$
declare enforced boolean; sub record; used int; mail text;
begin
  select enforce into enforced from public.billing_switch where id = 1;
  if not coalesce(enforced, false) then return true; end if;
  select lower(email) into mail from auth.users where id = owner_uid;
  if mail = any (array['carlosmartinezhold@gmail.com']) then return true; end if;   -- the super admin: unlimited
  select status, assets_allowed into sub from public.subscriptions where user_id = owner_uid;
  if not found then return false; end if;
  if sub.status = 'comped' then return true; end if;                                 -- given free access on purpose
  if sub.status not in ('trialing', 'active', 'past_due') then return false; end if;
  select count(*) into used from public.assets where user_id = owner_uid and not is_sample;
  return used + adding <= sub.assets_allowed;
end $$;
revoke execute on function public.can_add_assets(uuid, int) from public, anon;
grant execute on function public.can_add_assets(uuid, int) to authenticated, service_role;

-- After any insert into assets, every owner who got new real assets must be within their plan. Checked per statement, over all the new
-- rows at once, so a CSV import of ten rows cannot slip through one row at a time. Raising rolls the whole insert back.
create or replace function public.assets_plan_limit() returns trigger language plpgsql as $$
declare r record;
begin
  for r in select user_id from newrows where not is_sample group by user_id loop
    if not public.can_add_assets(r.user_id, 0) then
      raise exception 'plan_limit' using errcode = 'P0001', hint = 'Your plan does not include more assets.';
    end if;
  end loop;
  return null;
end $$;
revoke execute on function public.assets_plan_limit() from public, anon;
drop trigger if exists assets_plan_limit on public.assets;
create trigger assets_plan_limit after insert on public.assets referencing new table as newrows for each statement execute function public.assets_plan_limit();

-- TO TURN THE LIMITS ON (when you are ready to charge):   update public.billing_switch set enforce = true;
-- TO TURN THEM OFF AGAIN:                                  update public.billing_switch set enforce = false;
-- TO GIVE SOMEONE FREE, UNLIMITED ACCESS:                  insert into public.subscriptions (user_id, status) select id, 'comped' from auth.users where email = 'person@example.com'
--                                                           on conflict (user_id) do update set status = 'comped';
