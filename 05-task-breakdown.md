# Task Breakdown — Urutan Pengerjaan

Kerjakan **berurutan dari atas ke bawah**. Jangan lompat ke task berikutnya sebelum task sebelumnya lolos "Definition of Done". Setiap task idealnya 1 sesi kerja/1 commit.

Referensi dokumen lain:
- Detail requirement per fitur → `02-requirements-prd.md`
- Schema database → `03-database-migration.sql`
- Aturan koding → `04-coding-standards.md`
- Arsitektur & folder structure → `rancangan-arsitektur-kas-platform.md`

---

## TASK 0 — Setup Proyek
**Dependency:** tidak ada (task pertama)

- [x] Init Next.js project (App Router, TypeScript, Tailwind) di dalam repo GitHub yang sudah dibuat
- [x] Install & setup shadcn/ui
- [x] Install `@supabase/supabase-js`, `@supabase/ssr`, `react-hook-form`, `zod`
- [x] Buat project Supabase baru, jalankan seluruh isi `03-database-migration.sql` di SQL Editor
- [x] Setup `.env.local` dengan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] Buat `lib/supabase/client.ts` dan `lib/supabase/server.ts` sesuai dokumentasi resmi `@supabase/ssr`
- [x] Connect repo ke Vercel, deploy versi kosong untuk pastikan pipeline jalan
- [x] Set environment variables yang sama di Vercel

**Definition of Done:** project bisa di-deploy ke Vercel tanpa error, walau belum ada fitur apa-apa.

---

## TASK 1 — Autentikasi Dasar
**Dependency:** Task 0
**Requirement terkait:** US-1.1, US-1.2, US-1.3, US-1.4

- [x] Halaman `/login` dan `/register`
- [x] Proxy (`proxy.ts`, Next 16 pengganti `middleware.ts`) yang redirect ke `/login` kalau akses `/org/*` tanpa session
- [x] Tombol logout
- [x] Halaman reset password

**Definition of Done:** bisa register, login, logout, reset password end-to-end di local dev. Session bertahan setelah refresh.

---

## TASK 2 — Onboarding & Buat Organisasi
**Dependency:** Task 1
**Requirement terkait:** US-2.1

- [x] Halaman onboarding untuk user yang belum punya organisasi
- [x] Form buat organisasi (nama, auto-slug)
- [x] Setelah submit, verifikasi trigger database (`trg_add_creator_as_owner`, `trg_create_default_categories`) jalan dengan benar

**Definition of Done:** user baru register → diarahkan ke onboarding → buat organisasi → otomatis jadi owner → kategori default sudah ada.

---

## TASK 3 — Layout Dashboard & Organization Switcher
**Dependency:** Task 2
**Requirement terkait:** US-2.2, US-2.3

- [x] Layout dashboard dengan navbar (desktop) dan bottom nav (mobile)
- [x] Organization switcher di navbar
- [x] Route `/org/[slug]/...` dengan layout yang cek membership user ke organisasi tsb (403 kalau bukan anggota)
- [x] Tombol "buat organisasi baru" dari switcher

**Definition of Done:** user dengan 2+ organisasi bisa pindah-pindah lewat switcher, URL selalu sinkron dengan organisasi aktif. Akses ke slug organisasi yang bukan miliknya menghasilkan 403, bukan crash.

**Test wajib sebelum lanjut:** buat 2 akun uji, masing-masing bikin organisasi sendiri, pastikan tidak bisa akses slug organisasi akun lain lewat URL manual.

---

## TASK 4 — CRUD Transaksi
**Dependency:** Task 3
**Requirement terkait:** US-3.1, US-3.2, US-3.3

- [x] Form tambah transaksi (dropdown kategori dari organisasi aktif)
- [x] List transaksi + filter (tanggal, kategori, jenis)
- [x] Edit & hapus transaksi (dengan konfirmasi dialog)
- [x] Role check: sembunyikan tombol tambah/edit/hapus untuk role `viewer`

**Definition of Done:** owner/treasurer bisa CRUD penuh, viewer hanya bisa lihat (dicoba lewat UI maupun langsung manipulasi request — keduanya harus ketolak).

**Test wajib sebelum lanjut:** login sebagai viewer, coba akses form tambah transaksi langsung via URL, pastikan tidak bisa submit (RLS harus menolak di level database, bukan cuma disembunyikan di UI).

---

## TASK 5 — Kelola Kategori
**Dependency:** Task 4
**Requirement terkait:** US-3.4

- [x] Halaman kelola kategori (tambah/edit/hapus, khusus owner/treasurer)
- [x] Handling kategori yang masih dipakai transaksi (soft delete via `is_deleted`)

**Definition of Done:** kategori custom bisa ditambah, kategori yang sudah dipakai transaksi tidak bisa dihapus permanen (pakai soft delete).

---

## TASK 6 — Dashboard & Laporan
**Dependency:** Task 4
**Requirement terkait:** US-4.1, US-4.2

- [x] Kartu ringkasan saldo di dashboard
- [x] Ringkasan bulan berjalan
- [x] Halaman laporan bulanan dengan filter bulan/tahun + breakdown per kategori

**Definition of Done:** angka di dashboard sesuai dengan data transaksi aktual organisasi aktif, ter-update real-time setelah tambah/edit/hapus transaksi.

---

## TASK 7 — Undangan & Kelola Anggota
**Dependency:** Task 3
**Requirement terkait:** US-5.1, US-5.2, US-5.3, US-5.4

- [x] Form undang anggota via email (email + role) khusus owner
- [x] Integrasi `supabase.auth.admin.inviteUserByEmail()` (server-side, pakai service role key)
- [x] Halaman terima undangan (accept invite flow)
- [x] Form daftarkan anggota manual (nama, email, password sementara, role) — pakai `supabase.auth.admin.createUser()` di API route server-side, TIDAK boleh dipanggil dari client
- [x] Tampilkan password sementara sekali ke owner setelah user manual dibuat sukses
- [x] Halaman "ganti password wajib" untuk user yang login pertama kali dari akun yang dibuat manual
- [x] Halaman kelola anggota (list, ubah role, hapus anggota) khusus owner — tampilkan juga asal akun (diundang via email / didaftarkan manual)

**Definition of Done:** owner punya 2 cara tambah anggota — via email (US-5.1/5.2) dan manual tanpa email (US-5.4) — keduanya menghasilkan anggota dengan role benar di `organization_members`. Rate limit 2/jam untuk jalur email ditangani dengan pesan error jelas, bukan silent fail. Jalur manual sama sekali tidak terpengaruh limit email karena tidak mengirim email.

---

## TASK 8 — Mobile Polish & PWA
**Dependency:** semua task di atas selesai
**Requirement terkait:** Non-Functional Requirements (mobile-first)

- [x] Audit ulang SEMUA halaman di viewport 375px
- [x] Pastikan touch target minimal 44x44px di semua tombol/link
- [x] `inputMode="numeric"` di semua field nominal
- [x] Setup `manifest.json` + service worker dasar untuk PWA (add to home screen)

**Definition of Done:** aplikasi terasa nyaman dipakai di HP sungguhan (bukan cuma responsive di DevTools), bisa di-"Add to Home Screen".

---

## TASK 9 — Testing Isolasi Data & Security Final Check
**Dependency:** semua task di atas selesai

- [x] Buat 3 akun uji: masing-masing di organisasi berbeda, lalu 1 akun jadi anggota di 2 organisasi
- [x] Pastikan tidak ada kebocoran data antar organisasi di SEMUA fitur (dashboard, transaksi, kategori, laporan, anggota)
- [x] Cek tidak ada `service_role` key yang ke-expose di client-side (inspect network tab & bundle)
- [x] Cek semua route dashboard butuh auth (tidak bisa diakses tanpa login)

**Definition of Done:** checklist keamanan di section 11 dokumen arsitektur semua tercentang.

---

## TASK 10 — Deploy Production
**Dependency:** Task 9

- [x] Final deploy ke Vercel production
- [x] Smoke test semua fitur di production (bukan cuma local dev)
- [ ] (Opsional) setup custom domain kalau sudah tersedia

**Definition of Done:** aplikasi bisa diakses publik, siap dipakai user sungguhan (kamu, istri, teman).

---

## Pasca-TASK 10 (post-deploy — tambahan yang sudah selesai)

Perubahan berikut dikerjakan setelah production live, sebagai maintenance/fitur tambahan yang disetujui user:

- [x] Fix bug: navigasi desktop hilang di layar besar (`BottomNav` awalnya `md:hidden`) → buat `components/desktop-nav.tsx` (baris kedua header)
- [x] Fitur: tema kawaii pastel untuk user tertentu (istri) vs netral untuk warga komplek → multi-tema
- [x] Fitur: **tema per-akun (5 tema: Klasik, Kawaii, Ocean, Forest, Sunrise)** — pilihan tersimpan di `auth.users.user_metadata.theme`, sinkron lintas perangkat (`components/theme-picker.tsx` + `components/theme-setter.tsx`)
- [x] Fix UI: dot warna dropdown tema terpotong lengkungan → padding `p-2` di `SelectContent`
- [x] Fix UI: dropdown Select menampilkan label alih-alih value mentah (`items` auto-derive dari children di `components/ui/select.tsx`) + padding dropdown agar opsi tidak terpotong sudut membulat
- [x] Fitur: indikator loading (spinner `Loader2` + `disabled`) di semua tombol aksi form (login, register, reset password, update password, transaksi, kategori, anggota, undangan, organisasi, logout, tema)
- [x] Fix UX: tombol login/register tetap tampil loading sampai halaman tujuan siap (state `redirecting`) — hilangkan kesan "proses selesai tapi belum kelempar"
- [x] Fitur: indikator loading saat pindah menu — skeleton konten (`org/[slug]/loading.tsx` + `components/ui/skeleton.tsx`) dan spinner di link navigasi (`components/nav-link-icon.tsx` via `useLinkStatus`)
- [x] Doc sync: README + dokumen arsitektur/PRD/coding standards/task breakdown di-update agar konsisten dengan kondisi sekarang
- [x] Fitur: **tambah anggota existing** (US-5.4) — email yang sudah punya akun KasKita bisa langsung ditambahkan sebagai anggota (pilih role, tanpa password baru) lewat mode "Tambah anggota existing" di dialog "Daftarkan anggota", atau tombol konfirmasi saat daftar manual kena error "email sudah terdaftar"; API `/api/members` punya mode `existing` (cari user by email via service client, cek sudah-anggota → 409, lalu insert `organization_members`); pesan 409 undangan diarahkan ke fitur ini
- [x] Fix US-1.3: **logout accessible dari mobile** — item "Keluar" (ikon + spinner saat proses) ditambahkan sebagai item ke-6 di `BottomNav` (sebelumnya tombol logout hanya muncul di `md:` ke atas, user mobile tidak bisa logout dari dashboard)
- [x] Doc sync: **semua checklist acceptance criteria di `02-requirements-prd.md` di-centang sesuai kondisi nyata** — diverifikasi ulang ke kode satu per satu (register, login, logout, reset, organisasi, switcher, transaksi, filter, pagination, kategori, dashboard, laporan, undangan, kelola anggota). Tersisa 2 item yang memang belum dibuat: (1) US-3.1 upload foto bukti transaksi — opsional, belum dikerjakan, kolom `receipt_url` menganggur; (2) US-4.2 export PDF — memang fase 2.
- [x] Fix bug: **data basi di HP setelah refresh (anggota/kategori "ilang" padahal sudah tersimpan di Supabase)** — penyebab: service worker `public/sw.js` memakai strategi cache-first untuk SEMUA GET same-origin non-navigasi, termasuk `/api/members` dan payload RSC, sehingga refresh di-serve dari cache lama (logout + hard refresh terlihat "memperbaiki" karena mem-bypass SW). Perbaikan: `sw.js` v2 hanya cache-first untuk aset statis ber-hash (`/_next/static/`), navigasi network-first (fallback cache hanya saat offline), dan API/RSC/data **selalu dari jaringan (tidak pernah di-cache)** + `Cache-Control: no-store` pada GET `/api/members` dan `/api/invitations/accept`. Cache lama (`kaskita-v1`) dihapus saat activate.
- [x] Audit menyeluruh: **tidak ada pola "data masuk tapi UI tampak error/basi" lain** — semua mutasi sudah tanpa `.insert().select()` (hindari RLS RETURNING gotcha), semua flow sukses memanggil `router.refresh()` (server components) atau reload via API (halaman anggota), semua POST tak pernah di-cache, 2 GET data sudah no-store. Satu penguatan kecil: tombol "Hapus" di dialog konfirmasi transaksi & kategori kini punya state loading (spinner + disabled) untuk mencegah double-tap yang terkesan error.

Catatan: perubahan ini tidak mengubah skema DB / RLS policy / trigger.
