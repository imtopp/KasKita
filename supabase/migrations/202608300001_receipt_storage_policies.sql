-- ---------------------------------------------------------
-- Upload bukti foto transaksi (US-3.1): policy RLS Storage
-- + batas ukuran file di bucket `receipts`.
--
-- Bucket `receipts` (private) sudah dibuat manual di Dashboard.
-- Migration ini hanya menambah policy `storage.objects` dan
-- tuning konfigurasi bucket. TIDAK mengubah tabel public/
-- policy yang sudah ada.
-- ---------------------------------------------------------

-- Batas maks 5 MB per file + hanya gambar yang boleh di-upload
-- (pengaman server-side; client juga memvalidasi & mengompres).
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'receipts';

-- Path objek: receipts/<organization_id>/<uuid>.jpg
-- Lapisan isolasi data:
--   - SELECT : semua anggota org (viewer ikut bisa lihat bukti)
--   - INSERT : owner/co_owner/treasurer (golongan pengelola kas)
--   - DELETE : owner/co_owner/treasurer (sinkron dengan transaksi)
create policy "receipts_select_org_member"
on storage.objects for select
using (
  bucket_id = 'receipts'
  and is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "receipts_insert_org_manage"
on storage.objects for insert
with check (
  bucket_id = 'receipts'
  and get_org_role((storage.foldername(name))[1]::uuid) in ('owner', 'co_owner', 'treasurer')
);

create policy "receipts_delete_org_manage"
on storage.objects for delete
using (
  bucket_id = 'receipts'
  and get_org_role((storage.foldername(name))[1]::uuid) in ('owner', 'co_owner', 'treasurer')
);