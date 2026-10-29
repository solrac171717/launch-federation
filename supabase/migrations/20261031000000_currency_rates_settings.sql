-- ATLAS v4: currency per asset, loan interest rate, yearly value change, and per-user settings. Safe to run more than once. Run after the earlier migrations.

-- 1) Per-asset columns. Figures stay in the asset's own currency; ATLAS converts to US dollars when it adds things up.
alter table public.assets add column if not exists currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$');
alter table public.assets add column if not exists debt_rate numeric not null default 0 check (debt_rate >= 0 and debt_rate <= 100);
alter table public.assets add column if not exists annual_change numeric not null default 0 check (annual_change >= -90 and annual_change <= 100);

-- 2) Settings: one small JSON document per user (goal, concentration warning level, sale assumptions, emergency contacts).
create table if not exists public.user_settings (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 20000),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
drop policy if exists "settings_select_own" on public.user_settings;
drop policy if exists "settings_insert_own" on public.user_settings;
drop policy if exists "settings_update_own" on public.user_settings;
drop policy if exists "settings_delete_own" on public.user_settings;
create policy "settings_select_own" on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy "settings_insert_own" on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy "settings_update_own" on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "settings_delete_own" on public.user_settings for delete to authenticated using (user_id = auth.uid());

revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.user_settings to authenticated;
