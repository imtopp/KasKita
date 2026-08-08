# PRD — Platform Kas Organisasi (Multi-Tenant)

Dokumen ini melengkapi `rancangan-arsitektur-kas-platform.md`. Berisi definisi "selesai" per fitur supaya AI coding assistant tidak menebak scope sendiri.

**Aturan umum untuk AI assistant:**
- Jangan menambah fitur di luar yang tertulis di sini tanpa konfirmasi eksplisit dari user.
- Jangan mengubah skema database yang sudah didefinisikan di `03-database-migration.sql` tanpa alasan kuat — kalau perlu ubah, tulis migration baru, jangan edit migration lama yang sudah dijalankan.
- Setiap fitur harus lolos RLS test (lihat acceptance criteria "isolasi data") sebelum dianggap selesai.

---

## EPIC 1 — Autentikasi

### US-1.1 Register akun baru
**Sebagai** calon pengguna, **saya ingin** mendaftar dengan email & password, **supaya** bisa mulai pakai aplikasi.

Acceptance criteria:
- [ ] Form register: email, password, konfirmasi password
- [ ] Validasi: email format valid, password minimal 8 karakter
- [ ] Setelah register sukses → redirect ke halaman onboarding (belum punya organisasi)
- [ ] Error state ditampilkan jelas (email sudah terdaftar, password terlalu pendek, dll)

### US-1.2 Login
Acceptance criteria:
- [ ] Form login: email + password
- [ ] Salah kredensial → pesan error jelas, tidak expose apakah email terdaftar atau tidak (security)
- [ ] Setelah login sukses → redirect ke dashboard organisasi pertama (urut berdasarkan tanggal dibuat), atau ke onboarding kalau belum punya organisasi sama sekali; user dengan >1 organisasi bisa pindah via org switcher (URL `/org/[slug]/...`)

### US-1.3 Logout & session persistence
Acceptance criteria:
- [ ] Tombol logout di semua halaman dashboard (accessible dari mobile nav)
- [ ] Session tetap login setelah refresh browser (pakai Supabase session handling)
- [ ] Middleware redirect ke `/login` kalau akses route dashboard tanpa session valid

### US-1.4 Reset password
Acceptance criteria:
- [ ] Form "lupa password" kirim email reset (via Supabase Auth default)
- [ ] Link reset valid, expired setelah dipakai atau lewat waktu tertentu

---

## EPIC 2 — Organisasi & Onboarding

### US-2.1 Buat organisasi pertama
**Sebagai** user baru, **saya ingin** membuat organisasi (misal "RT 05"), **supaya** bisa mulai catat kas.

Acceptance criteria:
- [ ] Form: nama organisasi (wajib), slug auto-generate dari nama (bisa diedit manual, harus unik)
- [ ] User yang membuat otomatis jadi anggota dengan role `owner`
- [ ] Setelah dibuat → redirect ke dashboard organisasi tersebut
- [ ] Slug tidak boleh duplikat — validasi sebelum submit

### US-2.2 Organization switcher
**Sebagai** user dengan >1 organisasi, **saya ingin** pindah antar organisasi dengan cepat.

Acceptance criteria:
- [ ] Dropdown/menu di navbar menampilkan semua organisasi user jadi anggota
- [ ] Klik organisasi lain → ganti context, redirect ke dashboard organisasi itu
- [ ] Organisasi aktif tersimpan di URL (`/org/[slug]/...`), bukan cuma di state — supaya bisa di-bookmark/share/refresh tanpa hilang context
- [ ] Kalau user akses slug organisasi yang dia bukan anggota → 403 / redirect, BUKAN error database mentah

### US-2.3 Buat/tambah organisasi baru dari user yang sudah punya organisasi lain
Acceptance criteria:
- [ ] Ada tombol "Buat organisasi baru" di org switcher
- [ ] Flow sama seperti US-2.1

---

## EPIC 3 — Transaksi Kas

### US-3.1 Tambah transaksi
**Sebagai** owner/treasurer, **saya ingin** mencatat transaksi masuk/keluar.

Acceptance criteria:
- [ ] Form: jenis (income/expense), kategori (dropdown dari `categories` organisasi aktif), nominal, tanggal (default hari ini), deskripsi (opsional), upload foto bukti (opsional)
- [ ] Nominal harus > 0, validasi di frontend DAN mengandalkan `check` constraint di database sebagai lapisan kedua
- [ ] Setelah submit sukses → transaksi muncul di list, saldo di dashboard ter-update
- [ ] **Role `viewer` TIDAK BOLEH bisa akses form ini** — tombol "tambah transaksi" disembunyikan/disabled untuk viewer, DAN backend/RLS harus menolak insert kalau tetap dicoba lewat API langsung

### US-3.2 Lihat daftar transaksi
Acceptance criteria:
- [ ] List transaksi organisasi aktif, urut tanggal terbaru dulu
- [ ] Filter: rentang tanggal, kategori, jenis (income/expense/semua)
- [ ] Pagination atau infinite scroll (jangan load semua transaksi sekaligus kalau data sudah banyak)
- [ ] Tampilan card di mobile (bukan tabel yang perlu scroll horizontal)

### US-3.3 Edit & hapus transaksi
Acceptance criteria:
- [ ] Hanya owner/treasurer yang bisa edit/hapus (viewer tidak bisa)
- [ ] Konfirmasi dialog sebelum hapus (mencegah kehapus tidak sengaja)
- [ ] Setelah edit/hapus → saldo & list ter-update otomatis

### US-3.4 Kelola kategori
Acceptance criteria:
- [ ] Owner/treasurer bisa tambah/edit/hapus kategori kustom per organisasi
- [ ] Kategori default disediakan saat organisasi baru dibuat (misal: "Iuran Warga", "Kebersihan", "Keamanan", "Lain-lain" untuk income & expense)
- [ ] Tidak bisa hapus kategori yang masih dipakai transaksi (atau soft-handle: transaksi tetap ada, kategori ditandai "dihapus")

---

## EPIC 4 — Dashboard & Laporan

### US-4.1 Dashboard ringkasan
Acceptance criteria:
- [ ] Kartu saldo saat ini (total income - total expense sepanjang waktu)
- [ ] Ringkasan bulan berjalan (income, expense, net)
- [ ] 5 transaksi terbaru
- [ ] Semua data terscope ke organisasi aktif saja

### US-4.2 Laporan bulanan
Acceptance criteria:
- [ ] Pilih bulan & tahun → tampilkan total income, expense, saldo akhir bulan itu
- [ ] Breakdown per kategori
- [ ] (Fase 2) Export ke PDF

---

## EPIC 5 — Kelola Anggota

### US-5.1 Undang anggota baru
**Sebagai** owner, **saya ingin** mengundang orang lain via email untuk gabung organisasi dengan role tertentu.

Acceptance criteria:
- [ ] Form: email + pilih role (treasurer/viewer — tidak bisa langsung invite sebagai owner)
- [ ] Kirim email undangan via Supabase Auth `inviteUserByEmail` (lihat section 6.5 di dokumen arsitektur)
- [ ] Row baru di tabel `invitations` dengan status `pending`
- [ ] Link undangan berisi token, expired setelah 7 hari
- [ ] Kalau limit 2 email/jam kena — tampilkan pesan jelas ke user ("terlalu banyak undangan, coba lagi nanti"), JANGAN silent fail

### US-5.2 Terima undangan
Acceptance criteria:
- [ ] User klik link undangan → kalau belum punya akun, diarahkan register dulu, lalu otomatis jadi anggota organisasi dengan role sesuai undangan
- [ ] Kalau sudah punya akun → langsung ditambahkan sebagai anggota setelah login
- [ ] Status invitation berubah jadi `accepted`

### US-5.4 Daftarkan anggota manual (tanpa email)
**Sebagai** owner, **saya ingin** langsung membuatkan akun untuk anggota baru tanpa mengirim email undangan, **supaya** tidak terkendala limit email dan bisa langsung kasih kredensial secara manual (WA, chat, tatap muka).

Acceptance criteria:
- [ ] Form terpisah dari "Undang via email": nama, email, password sementara (bisa auto-generate random atau diisi manual oleh owner), pilih role (treasurer/viewer)
- [ ] Backend pakai `supabase.auth.admin.createUser()` dengan `email_confirm: true`, dijalankan di API route server-side memakai `service_role` key — **tidak boleh dipanggil dari client-side**
- [ ] Setelah user dibuat, langsung insert row ke `organization_members` dengan role yang dipilih (tanpa lewat flow invitation/token)
- [ ] Password sementara ditampilkan SEKALI ke owner setelah submit sukses (di layar, bukan dikirim email), dengan pesan jelas untuk segera disampaikan ke orangnya lewat kanal aman
- [ ] User yang baru dibuat, saat pertama kali login, diarahkan ke halaman "ganti password" sebelum bisa akses dashboard (paksa ganti dari password sementara)
- [x] Validasi: email belum terdaftar sebelumnya di sistem (kalau sudah ada, arahkan owner untuk pakai fitur "tambah anggota existing" alih-alih daftar baru)
- [x] Fitur "tambah anggota existing": owner bisa menambahkan email yang sudah punya akun KasKita langsung sebagai anggota (pilih role, tanpa password baru) — diakses lewat mode "Tambah anggota existing" di dialog "Daftarkan anggota" atau tombol konfirmasi saat email sudah terdaftar

### US-5.3 Kelola anggota existing
Acceptance criteria:
- [ ] Owner bisa lihat daftar anggota + role masing-masing
- [ ] Owner bisa ubah role anggota (kecuali dirinya sendiri jadi non-owner kalau dia satu-satunya owner)
- [ ] Owner bisa hapus anggota dari organisasi

---

## Non-Functional Requirements

- [x] **Mobile-first**: semua halaman sudah dites di viewport 375px lebar
- [x] **Isolasi data**: setiap fitur ditest dengan 3 akun uji di organisasi berbeda — tidak ada data organisasi lain yang bocor
- [x] **Tidak ada service role key di client-side** — dicek di bundle & network
- [x] Semua form punya loading state & error state (jangan silent fail)
- [x] Semua angka nominal ditampilkan format Rupiah (`Rp 1.500.000`)

---

## Fitur Tambahan yang Disetujui User (di luar MVP awal)

Fitur berikut sudah dikerjakan atas permintaan eksplisit user dan menjadi bagian dari scope:

- **Tema per-akun**: 5 tema (Klasik, Kawaii, Ocean, Forest, Sunrise). Pilihan tersimpan di `auth.users.user_metadata.theme` (via `supabase.auth.updateUser`), disinkronkan dari server lewat `ThemeSetter`, dan anti-flash via head script (`localStorage`). Default = klasik.
- **Navigasi desktop** (`DesktopNav`) sebagai baris kedua header di `md+` — mengatasi BottomNav yang `md:hidden`.
- **PWA installable** (manifest + service worker + ikon 192/512).
- **Logo brand** KasKita dari file logo user.
- **Indikator loading**: spinner + `disabled` di semua tombol aksi; tombol login/register tetap loading sampai redirect ke halaman tujuan; saat pindah menu muncul skeleton konten (`loading.tsx`) + spinner di link navigasi (`useLinkStatus`).



## Di Luar Scope MVP (jangan dikerjakan kecuali diminta eksplisit)
- Approval flow multi-level
- Notifikasi push/email otomatis selain undangan
- Multi-currency
- Export Excel
- Grafik tren kompleks (chart dasar boleh, tapi bukan prioritas MVP)
