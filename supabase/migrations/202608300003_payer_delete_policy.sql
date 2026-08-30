-- ---------------------------------------------------------
-- FITUR: Hapus warga di "Kelola Warga"
--
-- Menutup lubang "salah tambah tapi tak bisa dihapus". Hapus
-- HANYA aman untuk warga TANPA transaksi iuran (mis. salah tambah):
--   - jika ada riwayat transaksi, Postgres otomatis menolak lewat
--     check constraint transactions_dues_pair_check (FK dues_payer_id
--     on delete set null membuat dues_payer_id null sementara
--     dues_period tetap terisi -> constraint dilanggar). Sehingga warga
--     ber-riwayat cukup di-nonaktifkan.
--   - tautan akun (organization_members.payer_id) ikut terlepas
--     (FK on delete set null sudah ada).
--
-- Migration BARU, dijalankan SEKALI via scripts/run-sql.ps1
-- setelah 202608300002_dues_tracking.sql.
-- Jangan ubah migration yang sudah dijalankan.
-- ---------------------------------------------------------

create policy "delete_dues_payers" on dues_payers
  for delete using (get_org_role(organization_id) in ('owner', 'co_owner', 'treasurer'));

-- Data API (PostgREST / supabase-js) butuh grant DELETE.
grant delete on dues_payers to authenticated, service_role;