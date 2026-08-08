-- =========================================================
-- MIGRATION: Initial schema — Platform Kas Organisasi
-- Jalankan file ini SEKALI di Supabase SQL Editor (project baru)
-- Urutan eksekusi penting: tabel -> index -> function -> RLS policy
-- =========================================================

-- ---------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  currency text default 'IDR',
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'treasurer', 'viewer')),
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  unique (organization_id, user_id)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  is_deleted boolean default false,
  created_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  category_id uuid references categories(id),
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  transaction_date date not null default current_date,
  receipt_url text,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('treasurer', 'viewer')),  -- owner tidak bisa diundang langsung
  invited_by uuid references auth.users(id) not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  token uuid default gen_random_uuid(),
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

-- ---------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------

create index idx_transactions_org_date on transactions(organization_id, transaction_date desc);
create index idx_transactions_org_category on transactions(organization_id, category_id);
create index idx_members_user on organization_members(user_id);
create index idx_members_org on organization_members(organization_id);
create index idx_categories_org on categories(organization_id);
create index idx_invitations_org on invitations(organization_id);
create index idx_invitations_token on invitations(token);

-- ---------------------------------------------------------
-- 3. HELPER FUNCTIONS (dipakai di RLS policy)
-- ---------------------------------------------------------

create or replace function is_org_member(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function get_org_role(org_id uuid)
returns text as $$
  select role from organization_members
  where organization_id = org_id and user_id = auth.uid()
  limit 1;
$$ language sql security definer stable;

-- ---------------------------------------------------------
-- 4. ENABLE RLS
-- ---------------------------------------------------------

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table invitations enable row level security;

-- ---------------------------------------------------------
-- 5. RLS POLICIES — ORGANIZATIONS
-- ---------------------------------------------------------

create policy "select_own_orgs" on organizations
  for select using (is_org_member(id));

create policy "insert_org" on organizations
  for insert with check (created_by = auth.uid());

create policy "update_org_owner_only" on organizations
  for update using (get_org_role(id) = 'owner');

create policy "delete_org_owner_only" on organizations
  for delete using (get_org_role(id) = 'owner');

-- ---------------------------------------------------------
-- 6. RLS POLICIES — ORGANIZATION_MEMBERS
-- ---------------------------------------------------------

create policy "select_members_same_org" on organization_members
  for select using (is_org_member(organization_id));

create policy "insert_member_owner_only" on organization_members
  for insert with check (get_org_role(organization_id) = 'owner');

create policy "update_member_owner_only" on organization_members
  for update using (get_org_role(organization_id) = 'owner');

create policy "delete_member_owner_only" on organization_members
  for delete using (get_org_role(organization_id) = 'owner');

-- ---------------------------------------------------------
-- 7. RLS POLICIES — CATEGORIES
-- ---------------------------------------------------------

create policy "select_categories" on categories
  for select using (is_org_member(organization_id));

create policy "insert_categories" on categories
  for insert with check (get_org_role(organization_id) in ('owner', 'treasurer'));

create policy "update_categories" on categories
  for update using (get_org_role(organization_id) in ('owner', 'treasurer'));

create policy "delete_categories" on categories
  for delete using (get_org_role(organization_id) in ('owner', 'treasurer'));

-- ---------------------------------------------------------
-- 8. RLS POLICIES — TRANSACTIONS
-- ---------------------------------------------------------

create policy "select_transactions" on transactions
  for select using (is_org_member(organization_id));

create policy "insert_transactions" on transactions
  for insert with check (get_org_role(organization_id) in ('owner', 'treasurer'));

create policy "update_transactions" on transactions
  for update using (get_org_role(organization_id) in ('owner', 'treasurer'));

create policy "delete_transactions" on transactions
  for delete using (get_org_role(organization_id) in ('owner', 'treasurer'));

-- ---------------------------------------------------------
-- 9. RLS POLICIES — INVITATIONS
-- ---------------------------------------------------------

create policy "manage_invitations" on invitations
  for all using (get_org_role(organization_id) = 'owner');

-- ---------------------------------------------------------
-- 10. TRIGGER: auto-create default categories saat organisasi baru dibuat
-- ---------------------------------------------------------

create or replace function create_default_categories()
returns trigger as $$
begin
  insert into categories (organization_id, name, type) values
    (new.id, 'Iuran Warga', 'income'),
    (new.id, 'Donasi', 'income'),
    (new.id, 'Lain-lain (Masuk)', 'income'),
    (new.id, 'Kebersihan', 'expense'),
    (new.id, 'Keamanan', 'expense'),
    (new.id, 'Perbaikan Fasilitas', 'expense'),
    (new.id, 'Lain-lain (Keluar)', 'expense');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_create_default_categories
  after insert on organizations
  for each row execute function create_default_categories();

-- ---------------------------------------------------------
-- 11. TRIGGER: auto-add creator sebagai owner saat organisasi baru dibuat
-- ---------------------------------------------------------

create or replace function add_creator_as_owner()
returns trigger as $$
begin
  insert into organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_add_creator_as_owner
  after insert on organizations
  for each row execute function add_creator_as_owner();

-- =========================================================
-- SELESAI. Setelah ini, buat Storage bucket "receipts" secara manual
-- di Supabase Dashboard > Storage, set public read atau signed URL
-- sesuai kebutuhan privasi bukti transaksi.
-- =========================================================
