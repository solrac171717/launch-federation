-- Owned Map v5: household access. The owner invites a partner or family member by email, as "view" (read only) or "edit".
-- Safe to run more than once. Run after the earlier migrations.
-- The rules live here, in Row Level Security, so a read-only member cannot write even by calling the database directly.

-- 1) Who has access to whose account. The invite secret is stored only as a SHA-256 hash.
create table if not exists public.account_members (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  owner_email       text not null default '',
  email             text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role              text not null default 'view' check (role in ('view', 'edit')),
  status            text not null default 'invited' check (status in ('invited', 'active')),
  member_id         uuid references auth.users (id) on delete cascade,
  invite_hash       text unique check (invite_hash is null or char_length(invite_hash) = 64),
  invite_expires_at timestamptz,
  created_at        timestamptz not null default now(),
  unique (owner_id, email)
);
create index if not exists account_members_member_idx on public.account_members (member_id) where member_id is not null;

-- What the browser sends is not trusted for these fields: the sender's email, the status and the member always start clean.
create or replace function public.account_members_before_insert() returns trigger language plpgsql as $$
begin
  new.owner_id := auth.uid();
  new.owner_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  new.email := lower(trim(new.email));
  new.status := 'invited';
  new.member_id := null;
  if new.email = new.owner_email then raise exception 'You cannot invite yourself'; end if;
  return new;
end $$;
drop trigger if exists account_members_before_insert on public.account_members;
create trigger account_members_before_insert before insert on public.account_members for each row execute function public.account_members_before_insert();

-- 2) The two questions every policy asks. SECURITY DEFINER so they can read account_members whatever its own policies say.
create or replace function public.can_read(owner_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select owner_uid = auth.uid() or exists (select 1 from public.account_members m where m.owner_id = owner_uid and m.member_id = auth.uid() and m.status = 'active');
$$;
create or replace function public.can_edit(owner_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select owner_uid = auth.uid() or exists (select 1 from public.account_members m where m.owner_id = owner_uid and m.member_id = auth.uid() and m.status = 'active' and m.role = 'edit');
$$;
-- storage folders are plain text ("<owner id>/<asset id>/file"), so these two cast safely
create or replace function public.can_read_folder(folder text) returns boolean language sql stable as $$
  select case when folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.can_read(folder::uuid) else false end;
$$;
create or replace function public.can_edit_folder(folder text) returns boolean language sql stable as $$
  select case when folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.can_edit(folder::uuid) else false end;
$$;

-- 3) Policies of account_members itself
alter table public.account_members enable row level security;
drop policy if exists "members_select" on public.account_members;
drop policy if exists "members_insert" on public.account_members;
drop policy if exists "members_update" on public.account_members;
drop policy if exists "members_delete" on public.account_members;
create policy "members_select" on public.account_members for select to authenticated using (owner_id = auth.uid() or member_id = auth.uid());
create policy "members_insert" on public.account_members for insert to authenticated with check (owner_id = auth.uid());
create policy "members_update" on public.account_members for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "members_delete" on public.account_members for delete to authenticated using (owner_id = auth.uid() or member_id = auth.uid());
revoke all on public.account_members from anon;
revoke all on public.account_members from authenticated;
grant select, delete on public.account_members to authenticated;
grant insert (email, role, invite_hash, invite_expires_at) on public.account_members to authenticated;
grant update (role) on public.account_members to authenticated;   -- the owner can change the role; accepting an invite happens on the server

-- 4) Assets, documents and reminders: the owner, and active members according to their role
drop policy if exists "assets_select_own" on public.assets;
drop policy if exists "assets_insert_own" on public.assets;
drop policy if exists "assets_update_own" on public.assets;
drop policy if exists "assets_delete_own" on public.assets;
create policy "assets_select_own" on public.assets for select to authenticated using (public.can_read(user_id));
create policy "assets_insert_own" on public.assets for insert to authenticated with check (public.can_edit(user_id));
create policy "assets_update_own" on public.assets for update to authenticated using (public.can_edit(user_id)) with check (public.can_edit(user_id));
create policy "assets_delete_own" on public.assets for delete to authenticated using (public.can_edit(user_id));

drop policy if exists "docs_select_own" on public.asset_documents;
drop policy if exists "docs_insert_own" on public.asset_documents;
drop policy if exists "docs_update_own" on public.asset_documents;
drop policy if exists "docs_delete_own" on public.asset_documents;
create policy "docs_select_own" on public.asset_documents for select to authenticated using (public.can_read(user_id));
create policy "docs_insert_own" on public.asset_documents for insert to authenticated with check (public.can_edit(user_id) and exists (select 1 from public.assets a where a.id = asset_id and a.user_id = asset_documents.user_id));
create policy "docs_update_own" on public.asset_documents for update to authenticated using (public.can_edit(user_id)) with check (public.can_edit(user_id));
create policy "docs_delete_own" on public.asset_documents for delete to authenticated using (public.can_edit(user_id));

drop policy if exists "rem_select_own" on public.asset_reminders;
drop policy if exists "rem_insert_own" on public.asset_reminders;
drop policy if exists "rem_update_own" on public.asset_reminders;
drop policy if exists "rem_delete_own" on public.asset_reminders;
create policy "rem_select_own" on public.asset_reminders for select to authenticated using (public.can_read(user_id));
create policy "rem_insert_own" on public.asset_reminders for insert to authenticated with check (public.can_edit(user_id) and exists (select 1 from public.assets a where a.id = asset_id and a.user_id = asset_reminders.user_id));
create policy "rem_update_own" on public.asset_reminders for update to authenticated using (public.can_edit(user_id)) with check (public.can_edit(user_id));
create policy "rem_delete_own" on public.asset_reminders for delete to authenticated using (public.can_edit(user_id));

-- 5) The private file bucket: the folder name is the owner's id
drop policy if exists "asset_docs_select_own" on storage.objects;
drop policy if exists "asset_docs_insert_own" on storage.objects;
drop policy if exists "asset_docs_delete_own" on storage.objects;
create policy "asset_docs_select_own" on storage.objects for select to authenticated using (bucket_id = 'asset-docs' and public.can_read_folder((storage.foldername(name))[1]));
create policy "asset_docs_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'asset-docs' and public.can_edit_folder((storage.foldername(name))[1]));
create policy "asset_docs_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'asset-docs' and public.can_edit_folder((storage.foldername(name))[1]));

-- Share links and personal settings stay with their owner on purpose: members cannot create links or see someone else's settings.

-- 6) Postgres lets everyone run a new function by default. These only ever answer true for a signed-in user (they compare with auth.uid()),
-- but they should not be callable without a session, so execution is limited to signed-in users (and the server).
revoke execute on function public.can_read(uuid), public.can_edit(uuid), public.can_read_folder(text), public.can_edit_folder(text), public.account_members_before_insert() from public, anon;
grant execute on function public.can_read(uuid), public.can_edit(uuid), public.can_read_folder(text), public.can_edit_folder(text) to authenticated, service_role;
