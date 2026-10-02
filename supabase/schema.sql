-- Launch Federation — core schema. Run this once in the Supabase SQL editor
-- (Project → SQL Editor → New query → paste → Run).

create extension if not exists "pgcrypto";

-- Public profile per user, so names can be shown without needing admin access to auth.users.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Listings (submitted products)
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tagline text not null,
  description text,
  url text not null,
  logo_url text,
  target_market text,
  tags text[] not null default '{}',
  plan text not null default 'free' check (plan in ('free', 'premium')),
  launch_week date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'rejected')),
  badge_status text not null default 'pending' check (badge_status in ('pending', 'verified', 'missing')),
  badge_checked_at timestamptz,
  dofollow boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists listings_launch_week_idx on listings (launch_week);
create index if not exists listings_plan_week_idx on listings (plan, launch_week);

-- Cap free listings at 10 per launch_week. Premium listings are not capped.
create or replace function check_free_slot_limit()
returns trigger as $$
begin
  if new.plan = 'free' then
    if (
      select count(*) from listings
      where launch_week = new.launch_week
        and plan = 'free'
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
    ) >= 10 then
      raise exception 'No free slots left for this week';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_free_slot_limit on listings;
create trigger trg_free_slot_limit
  before insert or update on listings
  for each row execute function check_free_slot_limit();

-- Votes (one per user per listing)
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, user_id)
);

create or replace view listing_votes as
  select listing_id, count(*)::int as votes
  from votes
  group by listing_id;

-- Comments
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table listings enable row level security;
alter table votes enable row level security;
alter table comments enable row level security;

drop policy if exists "profiles are publicly readable" on profiles;
create policy "profiles are publicly readable" on profiles for select using (true);
drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "listings are publicly readable" on listings;
create policy "listings are publicly readable" on listings for select using (true);
drop policy if exists "users can insert own listing" on listings;
create policy "users can insert own listing" on listings for insert with check (auth.uid() = user_id);
drop policy if exists "users can update own listing" on listings;
create policy "users can update own listing" on listings for update using (auth.uid() = user_id);

drop policy if exists "votes are publicly readable" on votes;
create policy "votes are publicly readable" on votes for select using (true);
drop policy if exists "users can vote as themselves" on votes;
create policy "users can vote as themselves" on votes for insert with check (auth.uid() = user_id);
drop policy if exists "users can remove own vote" on votes;
create policy "users can remove own vote" on votes for delete using (auth.uid() = user_id);

drop policy if exists "comments are publicly readable" on comments;
create policy "comments are publicly readable" on comments for select using (true);
drop policy if exists "users can comment as themselves" on comments;
create policy "users can comment as themselves" on comments for insert with check (auth.uid() = user_id);
drop policy if exists "users can delete own comment" on comments;
create policy "users can delete own comment" on comments for delete using (auth.uid() = user_id);
