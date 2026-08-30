-- ---------------------------------------------------------
-- FITUR: Pelacakan iuran per unit/warga (dues tracking)
--
-- Migration BARU, dijalankan SEKALI via scripts/run-sql.ps1
-- setelah 03-database-migration.sql + migration co_owner.
-- Jangan ubah migration yang sudah dijalankan.
-- ---------------------------------------------------------

-- 1) Tabel unit pembayar iuran (entitas terpisah dari akun —
--    memberi: bendahara = warga juga, istri-satu-rumah, jika rumah
--    pindah/meninggal unit bisa di-nonaktifkan tanpa kehilangan riwayat).
create table dues_payers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index idx_dues_payers_org on dues_payers(organization_id);

-- 2) Kategori: penanda "kategori iuran" + nominal standar per bulan.
--    Nominal dibiarkan null saat org tak mengaktifkan iuran; flag is_dues
--    dipakai form transaksi untuk menampilkan field "dibayar oleh + periode".
alter table categories
  add column is_dues boolean not null default false;
alter table categories
  add column dues_default_amount numeric(14,2)
    check (dues_default_amount > 0);

-- 3) Transaksi: atribut iuran. SATU transaksi = SATU bulan iuran
--    (dues_period adalah tanggal hari-1 bulan; multi-bulan dipecah jadi
--    beberapa transaksi saat input). transaction_date tetap = tanggal bayar.
alter table transactions
  add column dues_payer_id uuid references dues_payers(id) on delete set null;
alter table transactions
  add column dues_period date;
create index idx_transactions_org_dues
  on transactions(organization_id, dues_payer_id, dues_period);
alter table transactions
  add constraint transactions_dues_pair_check
  check ((dues_payer_id is null) = (dues_period is null));
alter table transactions
  add constraint transactions_dues_income_check
  check (dues_payer_id is null or type = 'income');

-- 4) Akun anggota (opsional) terhubung ke unit pembayar — banyak akun bisa
--    menunjuk ke satu unit (mis. istri & suami satu rumah). Akun tanpa link
--    tidak ikut dalam status "rumah saya".
alter table organization_members
  add column payer_id uuid references dues_payers(id) on delete set null;

-- 5) Label UI untuk unit pembayar per organisasi (default "Warga"; bisa
--    "Rumah", "Anggota", "Karyawan", "Siswa" dll.) — biar tak terkunci ke
--    komplek. Dikelola owner/co_owner di halaman Pengaturan.
alter table organizations
  add column dues_entity_label text not null default 'Warga';

-- 6) RLS — dues_payers. Semua anggota bisa lihat; owner/co_owner/treasurer
--    yang mengelola. Tidak ada policy DELETE (unit cukup di-nonaktifkan).
alter table dues_payers enable row level security;

create policy "select_dues_payers" on dues_payers
  for select using (is_org_member(organization_id));

create policy "insert_dues_payers" on dues_payers
  for insert with check (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));

create policy "update_dues_payers" on dues_payers
  for update using (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));

-- 7) Trigger default kategori: tandai "Iuran Warga" sebagai iuran supaya
--    org baru langsung punya kategori iuran.
create or replace function create_default_categories()
returns trigger as $$
begin
  insert into categories (organization_id, name, type, is_dues) values
    (new.id, 'Iuran Warga', 'income', true),
    (new.id, 'Donasi', 'income', false),
    (new.id, 'Lain-lain (Masuk)', 'income', false),
    (new.id, 'Kebersihan', 'expense', false),
    (new.id, 'Keamanan', 'expense', false),
    (new.id, 'Perbaikan Fasilitas', 'expense', false),
    (new.id, 'Lain-lain (Keluar)', 'expense', false);
  return new;
end;
$$ language plpgsql security definer;

-- 8) Org existing: flag kategori "Iuran Warga" yang pernah dibuat trigger lama.
update categories set is_dues = true
where name = 'Iuran Warga' and is_deleted = false;

-- 9) Grants — akses Data API (PostgREST / supabase-js).
--    Kolom baru pada tabel lama sudah ter-grant via grant tabel existing;
--    dues_payers adalah tabel baru sehingga perlu grant tersendiri.
--    `authenticated` = user login; `service_role` = server-side (API route).
grant select, insert, update on dues_payers to authenticated, service_role;