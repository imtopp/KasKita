-- ---------------------------------------------------------
-- Role "co_owner" + pembatasan pembuatan organisasi
-- (hanya owner asli / user yang belum tergabung yang bisa buat org)
--
-- Dijalankan SEKALI di Supabase SQL Editor setelah 03-database-migration.sql.
-- Jangan ubah migration yang sudah dijalankan; kalau perlu penyesuaian,
-- buat file migration baru.
-- ---------------------------------------------------------

-- 1) Perluas nilai role yang sah di organization_members.
alter table organization_members drop constraint organization_members_role_check;
alter table organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'co_owner', 'treasurer', 'viewer'));

-- 2) Helper: bolehkah user membuat organisasi baru?
--    Ya bila belum tergabung di organisasi mana pun (onboarding user baru)
--    atau berperan owner di minimal satu organisasi.
create or replace function can_create_organization()
returns boolean as $$
  select (
    not exists (
      select 1 from organization_members where user_id = auth.uid()
    )
    or exists (
      select 1 from organization_members where user_id = auth.uid() and role = 'owner'
    )
  );
$$ language sql security definer stable;

-- 3) Pembuatan organisasi dibatasi lewat RLS.
drop policy "insert_org" on organizations;
create policy "insert_org" on organizations
  for insert with check (created_by = auth.uid() and can_create_organization());

-- 4) co_owner berwenang seperti owner di dalam organisasi,
--    kecuali menghapus organisasi (tetap owner only).
drop policy "update_org_owner_only" on organizations;
create policy "update_org_manage" on organizations
  for update using (get_org_role(id) in ('owner', 'co_owner'));

drop policy "insert_member_owner_only" on organization_members;
create policy "insert_member_manage" on organization_members
  for insert with check (get_org_role(organization_id) in ('owner', 'co_owner'));

drop policy "update_member_owner_only" on organization_members;
create policy "update_member_manage" on organization_members
  for update using (get_org_role(organization_id) in ('owner', 'co_owner'));

drop policy "delete_member_owner_only" on organization_members;
create policy "delete_member_manage" on organization_members
  for delete using (get_org_role(organization_id) in ('owner', 'co_owner'));

drop policy "manage_invitations" on invitations;
create policy "manage_invitations" on invitations
  for all using (get_org_role(organization_id) in ('owner', 'co_owner'));

-- 5) co_owner juga bisa kelola transaksi & kategori (seperti bendahara).
drop policy "insert_categories" on categories;
create policy "insert_categories" on categories
  for insert with check (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));
drop policy "update_categories" on categories;
create policy "update_categories" on categories
  for update using (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));
drop policy "delete_categories" on categories;
create policy "delete_categories" on categories
  for delete using (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));

drop policy "insert_transactions" on transactions;
create policy "insert_transactions" on transactions
  for insert with check (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));
drop policy "update_transactions" on transactions;
create policy "update_transactions" on transactions
  for update using (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));
drop policy "delete_transactions" on transactions;
create policy "delete_transactions" on transactions
  for delete using (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));
