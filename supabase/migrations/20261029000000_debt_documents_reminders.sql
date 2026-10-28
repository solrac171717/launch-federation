-- ATLAS v2: debt on assets, documents per asset (private file storage) and due-date reminders.
-- Safe to run more than once. Run after assets.sql.

-- 1) Debt (mortgage or loan secured on the asset)
alter table public.assets add column if not exists debt numeric not null default 0 check (debt >= 0);
alter table public.assets add column if not exists debt_payment numeric not null default 0 check (debt_payment >= 0);

-- 2) Documents: one row per file; the file itself lives in the private "asset-docs" bucket
create table if not exists public.asset_documents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id   uuid not null references public.assets (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 200),
  kind       text not null default 'other' check (kind in ('deed','insurance','registration','invoice','photo','other')),
  path       text not null,
  size       bigint not null check (size >= 0 and size <= 10485760),
  mime       text,
  created_at timestamptz not null default now()
);
create index if not exists asset_documents_asset_idx on public.asset_documents (asset_id);
create index if not exists asset_documents_user_idx on public.asset_documents (user_id, created_at);

-- 3) Reminders
create table if not exists public.asset_reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id         uuid not null references public.assets (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 120),
  kind             text not null default 'other' check (kind in ('insurance','tax','inspection','registration','maintenance','other')),
  due_on           date not null,
  repeat           text not null default 'none' check (repeat in ('none','monthly','quarterly','yearly')),
  notify_days      int  not null default 14 check (notify_days between 0 and 90),
  done             boolean not null default false,
  last_notified_on date,
  created_at       timestamptz not null default now()
);
create index if not exists asset_reminders_user_due_idx on public.asset_reminders (user_id, due_on);
create index if not exists asset_reminders_open_idx on public.asset_reminders (due_on) where done = false;

-- Row Level Security: a user only touches their own rows, and only for assets they own
alter table public.asset_documents enable row level security;
alter table public.asset_reminders enable row level security;

drop policy if exists "docs_select_own" on public.asset_documents;
drop policy if exists "docs_insert_own" on public.asset_documents;
drop policy if exists "docs_update_own" on public.asset_documents;
drop policy if exists "docs_delete_own" on public.asset_documents;
create policy "docs_select_own" on public.asset_documents for select to authenticated using (user_id = auth.uid());
create policy "docs_insert_own" on public.asset_documents for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()));
create policy "docs_update_own" on public.asset_documents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "docs_delete_own" on public.asset_documents for delete to authenticated using (user_id = auth.uid());

drop policy if exists "rem_select_own" on public.asset_reminders;
drop policy if exists "rem_insert_own" on public.asset_reminders;
drop policy if exists "rem_update_own" on public.asset_reminders;
drop policy if exists "rem_delete_own" on public.asset_reminders;
create policy "rem_select_own" on public.asset_reminders for select to authenticated using (user_id = auth.uid());
create policy "rem_insert_own" on public.asset_reminders for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid()));
create policy "rem_update_own" on public.asset_reminders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rem_delete_own" on public.asset_reminders for delete to authenticated using (user_id = auth.uid());

revoke all on public.asset_documents, public.asset_reminders from anon;
grant select, insert, update, delete on public.asset_documents, public.asset_reminders to authenticated;

-- 4) Private file bucket. Every file lives under "<user id>/<asset id>/..." and only that user can touch it.
insert into storage.buckets (id, name, public, file_size_limit)
values ('asset-docs', 'asset-docs', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "asset_docs_select_own" on storage.objects;
drop policy if exists "asset_docs_insert_own" on storage.objects;
drop policy if exists "asset_docs_delete_own" on storage.objects;
create policy "asset_docs_select_own" on storage.objects for select to authenticated using (bucket_id = 'asset-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "asset_docs_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'asset-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "asset_docs_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'asset-docs' and (storage.foldername(name))[1] = auth.uid()::text);
