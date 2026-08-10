# PRD — Platform Kas Organisasi (Multi-Tenant)

Dokumen ini melengkapi `01-rancangan-arsitektur-kas-platform.md`. Berisi definisi "selesai" per fitur supaya AI coding assistant tidak menebak scope sendiri.

**Aturan umum untuk AI assistant:**
- Jangan menambah fitur di luar yang tertulis di sini tanpa konfirmasi eksplisit dari user.
- Jangan mengubah skema database yang sudah didefinisikan di `03-database-migration.sql` tanpa alasan kuat — kalau perlu ubah, tulis migration baru, jangan edit migration lama yang sudah dijalankan.
- Setiap fitur harus lolos RLS test (lihat acceptance criteria "isolasi data") sebelum dianggap selesai.

---

## EPIC 1 — Autentikasi

### US-1.1 Register akun baru
**Sebagai** calon pengguna, **saya ingin** mendaftar dengan email & password, **supaya** bisa mulai pakai aplikasi.

Acceptance criteria:
- [x] Form register: email, password, konfirmasi password
- [x] Validasi: email format valid, password minimal 8 karakter
- [x] Setelah register sukses → redirect ke halaman onboarding (belum punya organisasi)
- [x] Error state ditampilkan jelas (email sudah terdaftar, password terlalu pendek, dll)

### US-1.2 Login
Acceptance criteria:
- [x] Form login: email + password
- [x] Salah kredensial → pesan error jelas, tidak expose apakah email terdaftar atau tidak (security)
- [x] Setelah login sukses → redirect ke dashboard organisasi pertama (urut berdasarkan tanggal dibuat), atau ke onboarding kalau belum punya organisasi sama sekali; user dengan >1 organisasi bisa pindah via org switcher (URL `/org/[slug]/...`)

### US-1.3 Logout & session persistence
Acceptance criteria:
- [x] Tombol logout di semua halaman dashboard (accessible dari mobile nav)
- [x] Session tetap login setelah refresh browser (pakai Supabase session handling)
- [x] Middleware redirect ke `/login` kalau akses route dashboard tanpa session valid

### US-1.4 Reset password
Acceptance criteria:
- [x] Form "lupa password" kirim email reset (via Supabase Auth default)
- [x] Link reset valid, expired setelah dipakai atau lewat waktu tertentu

---

## EPIC 2 — Organisasi & Onboarding

### US-2.1 Buat organisasi pertama
**Sebagai** user baru, **saya ingin** membuat organisasi (misal "RT 05"), **supaya** bisa mulai catat kas.

Acceptance criteria:
- [x] Form: nama organisasi (wajib), slug auto-generate dari nama (bisa diedit manual, harus unik)
- [x] User yang membuat otomatis jadi anggota dengan role `owner`
- [x] Setelah dibuat → redirect ke dashboard organisasi tersebut
- [x] Slug tidak boleh duplikat — validasi sebelum submit

### US-2.2 Organization switcher
**Sebagai** user dengan >1 organisasi, **saya ingin** pindah antar organisasi dengan cepat.

Acceptance criteria:
- [x] Dropdown/menu di navbar menampilkan semua organisasi user jadi anggota
- [x] Klik organisasi lain → ganti context, redirect ke dashboard organisasi itu
- [x] Organisasi aktif tersimpan di URL (`/org/[slug]/...`), bukan cuma di state — supaya bisa di-bookmark/share/refresh tanpa hilang context
- [x] Kalau user akses slug organisasi yang dia bukan anggota → 403 / redirect, BUKAN error database mentah

### US-2.3 Buat/tambah organisasi baru dari user yang sudah punya organisasi lain
Acceptance criteria:
- [x] Ada tombol "Buat organisasi baru" di org switcher
- [x] Flow sama seperti US-2.1
- [x] **Hanya owner yang bisa membuat organisasi baru** — tombol "Buat organisasi baru" di org switcher hanya tampil untuk user yang berperan owner; halaman `/onboarding` juga memblokir non-owner (`Forbidden`) dan RLS `insert_org` menolak insert lewat API langsung. Pengecualian: user baru yang belum tergabung di organisasi mana pun tetap boleh membuat organisasi pertamanya (onboarding).

---

## EPIC 3 — Transaksi Kas

### US-3.1 Tambah transaksi
**Sebagai** owner/co-owner/treasurer, **saya ingin** mencatat transaksi masuk/keluar.

Acceptance criteria:
- [x] Form: jenis (income/expense), kategori (dropdown dari `categories` organisasi aktif), nominal, tanggal (default hari ini), deskripsi (opsional)
- [ ] Upload foto bukti (opsional) — belum dikerjakan; kolom `receipt_url` menganggur
- [x] Nominal harus > 0, validasi di frontend DAN mengandalkan `check` constraint di database sebagai lapisan kedua
- [x] Setelah submit sukses → transaksi muncul di list, saldo di dashboard ter-update
- [x] **Role `viewer` TIDAK BOLEH bisa akses form ini** — tombol "tambah transaksi" disembunyikan/disabled untuk viewer, DAN backend/RLS harus menolak insert kalau tetap dicoba lewat API langsung

### US-3.2 Lihat daftar transaksi
Acceptance criteria:
- [x] List transaksi organisasi aktif, urut tanggal terbaru dulu
- [x] Filter: rentang tanggal, kategori, jenis (income/expense/semua)
- [x] Pagination atau infinite scroll (jangan load semua transaksi sekaligus kalau data sudah banyak)
- [x] Tampilan card di mobile (bukan tabel yang perlu scroll horizontal)

### US-3.3 Edit & hapus transaksi
Acceptance criteria:
- [x] Hanya owner/co-owner/treasurer yang bisa edit/hapus (viewer tidak bisa)
- [x] Konfirmasi dialog sebelum hapus (mencegah kehapus tidak sengaja)
- [x] Setelah edit/hapus → saldo & list ter-update otomatis

### US-3.4 Kelola kategori
Acceptance criteria:
- [x] Owner/co-owner/treasurer bisa tambah/edit/hapus kategori kustom per organisasi
- [x] Kategori default disediakan saat organisasi baru dibuat (misal: "Iuran Warga", "Kebersihan", "Keamanan", "Lain-lain" untuk income & expense)
- [x] Tidak bisa hapus kategori yang masih dipakai transaksi (atau soft-handle: transaksi tetap ada, kategori ditandai "dihapus")

---

## EPIC 4 — Dashboard & Laporan

### US-4.1 Dashboard ringkasan
Acceptance criteria:
- [x] Kartu saldo saat ini (total income - total expense sepanjang waktu)
- [x] Ringkasan bulan berjalan (saldo awal bulan, income, expense, net, saldo akhir bulan) — konsisten dengan laporan
- [x] 5 transaksi terbaru
- [x] Semua data terscope ke organisasi aktif saja

### US-4.2 Laporan bulanan
Acceptance criteria:
- [x] Pilih bulan & tahun → tampilkan saldo awal bulan (kumulatif sejak awal organisasi), total income, expense, selisih, dan saldo akhir bulan (kumulatif — menyambung antar bulan, bukan reset ke nol)
- [x] Breakdown per kategori
- [x] Export ke PDF (semua role) — PDF detail: ringkasan saldo awal/akhir, rincian per kategori, dan daftar transaksi per tanggal untuk dibagikan via WhatsApp

---

## EPIC 5 — Kelola Anggota

### US-5.1 Undang anggota baru
**Sebagai** owner, **saya ingin** mengundang orang lain via email untuk gabung organisasi dengan role tertentu.

Acceptance criteria:
- [x] Form: email + pilih role (treasurer/viewer — tidak bisa langsung invite sebagai owner)
- [x] Kirim email undangan via Supabase Auth `inviteUserByEmail` (lihat section 6.5 di dokumen arsitektur)
- [x] Row baru di tabel `invitations` dengan status `pending`
- [x] Link undangan berisi token, expired setelah 7 hari
- [x] Kalau limit 2 email/jam kena — tampilkan pesan jelas ke user ("terlalu banyak undangan, coba lagi nanti"), JANGAN silent fail

### US-5.2 Terima undangan
Acceptance criteria:
- [x] User klik link undangan → kalau belum punya akun, diarahkan register dulu, lalu otomatis jadi anggota organisasi dengan role sesuai undangan
- [x] Kalau sudah punya akun → langsung ditambahkan sebagai anggota setelah login
- [x] Status invitation berubah jadi `accepted`

### US-5.4 Daftarkan anggota manual (tanpa email)
**Sebagai** owner, **saya ingin** langsung membuatkan akun untuk anggota baru tanpa mengirim email undangan, **supaya** tidak terkendala limit email dan bisa langsung kasih kredensial secara manual (WA, chat, tatap muka).

Acceptance criteria:
- [x] Form terpisah dari "Undang via email": nama, email, password sementara (bisa auto-generate random atau diisi manual oleh owner), pilih role (treasurer/viewer)
- [x] Backend pakai `supabase.auth.admin.createUser()` dengan `email_confirm: true`, dijalankan di API route server-side memakai `service_role` key — **tidak boleh dipanggil dari client-side**
- [x] Setelah user dibuat, langsung insert row ke `organization_members` dengan role yang dipilih (tanpa lewat flow invitation/token)
- [x] Password sementara ditampilkan SEKALI ke owner setelah submit sukses (di layar, bukan dikirim email), dengan pesan jelas untuk segera disampaikan ke orangnya lewat kanal aman
- [x] User yang baru dibuat, saat pertama kali login, diarahkan ke halaman "ganti password" sebelum bisa akses dashboard (paksa ganti dari password sementara)
- [x] Validasi: email belum terdaftar sebelumnya di sistem (kalau sudah ada, arahkan owner untuk pakai fitur "tambah anggota existing" alih-alih daftar baru)
- [x] Fitur "tambah anggota existing": owner bisa menambahkan email yang sudah punya akun KasKita langsung sebagai anggota (pilih role, tanpa password baru) — diakses lewat mode "Tambah anggota existing" di dialog "Daftarkan anggota" atau tombol konfirmasi saat email sudah terdaftar

### US-5.3 Kelola anggota existing
Acceptance criteria:
- [x] Owner bisa lihat daftar anggota + role masing-masing
- [x] Owner bisa ubah role anggota (kecuali dirinya sendiri jadi non-owner kalau dia satu-satunya owner)
- [x] Owner bisa hapus anggota dari organisasi
- [x] Menu **Anggota** & **Pengaturan** hanya tampil untuk owner/co-owner — viewer/treasurer tidak melihat menu tersebut di nav, dan membuka URL-nya langsung ditolak (`Forbidden`)

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
- **Kelola akun anggota oleh owner/co-owner** (tombol "Kelola" pada tiap anggota selain owner — bendahara/viewer/co-owner — di halaman Anggota):
  - [x] Atur ulang password sementara — anggota diminta ganti password saat login berikutnya (sama seperti akun yang baru didaftarkan)
  - [x] Ganti email anggota (jika dia lupa akses email / minta tolong diganti)
  - [x] Nonaktifkan / aktifkan kembali akun anggota (anggota tidak bisa login selama nonaktif)
  - [x] Putuskan semua sesi anggota (kick session) — semua refresh token langsung tidak berlaku (access token lama kedaluwarsa otomatis maks. ±1 jam); dipakai untuk prosedur akun kena hack bersama atur ulang password
  - [x] Pesan error di halaman ganti password dibuat jelas saat user memakai password yang sama dengan password sementara ("password baru tidak boleh sama dengan password yang sedang dipakai") — bukan sekadar "gagal" generik
- **Saldo kumulatif**: dashboard bulan berjalan & laporan bulanan menampilkan saldo awal/akhir yang menyambung antar bulan (bukan reset ke nol).
- **Export PDF laporan bulanan** (semua role): tombol "Export PDF" di halaman Laporan mengunduh PDF berisi ringkasan (saldo awal bulan, pemasukan, pengeluaran, selisih, saldo akhir), rincian per kategori, dan daftar transaksi detail per tanggal (tanggal, kategori, keterangan, pemasukan/pengeluaran) — untuk dibagikan ke grup WhatsApp. Dihasilkan server-side via `GET /api/reports?orgId&month&year` (pdfmake, font Roboto di-embed), `Cache-Control: no-store`. **PDF kini memuat logo KasKita** di header (gambar 64×64 di kiri, judul/org/periode di kanan).
- **Input tanggal dengan petunjuk format**: field tanggal (filter transaksi + form transaksi) menampilkan teks petunjuk `dd/mm/yyyy` saat kosong di Android/desktop (di browser mobile placeholder native tidak muncul sehingga field tampak kosong/putih); di iOS overlay petunjuk disembunyikan karena iOS sudah menampilkan placeholder tanggal native — menghindari dobel/overlap (lihat entri fix iPhone di bawah).
- **Skeleton saat ganti filter/periode**: di halaman Transaksi (filter jenis/kategori/tanggal & pagination) dan Laporan (bulan/tahun), daftar/card diganti skeleton saat `router.push` mengambil data baru (`useTransition`), sedangkan kontrol filter tetap terlihat. Halaman Anggota: list skeleton menggantikan teks "Memuat anggota..." (termasuk saat reload setelah ubah peran/hapus/undang).
- **Role co-owner**: role baru yang berperilaku seperti owner di organisasinya sendiri — bisa kelola anggota (daftarkan/undang, ubah peran, atur ulang password, ganti email, nonaktifkan, putuskan sesi, hapus), akses halaman Anggota & Pengaturan, dan kelola transaksi/kategori. Perbedaan dengan owner: **tidak bisa membuat organisasi baru** dan **tidak bisa menghapus organisasi** (tetap hanya owner asli). Co-owner diangkat via ubah peran di halaman Anggota, atau dipilih langsung saat daftar manual / tambah anggota existing. Undangan via email tetap hanya bendahara/viewer (konsisten dengan constraint tabel `invitations`). Owner tetap satu-satunya yang bisa mengangkat/menurunkan/menghapus owner; co-owner tidak bisa menyentuh peran owner.
- **Fix tata letak mobile (iPhone)**: overlay petunjuk tanggal di `DateInput` disembunyikan di iOS (iOS sudah menampilkan placeholder tanggal native) agar tidak dobel teks, `min-w-0` ditambahkan pada sel filter transaksi agar grid tidak meluap di layar sempit, dan wrapper layout org diberi `overflow-x-clip` agar konten tak bikin scroll horizontal.
- **Pengaturan organisasi** (halaman `org/[slug]/settings`, owner/co-owner — menyusul placeholder "Pengaturan organisasi menyusul"):
  - [x] Ubah nama organisasi (update `organizations.name`, slug tidak berubah)
  - [x] Ubah alamat (slug) organisasi dengan cek ketersediaan (`is_slug_available`); URL lama ikut berubah
  - [x] Hapus organisasi permanen — **hanya owner** (co-owner ditolak RLS `delete_org_owner_only`), konfirmasi wajib mengetik ulang nama organisasi; seluruh data terhapus (cascade)
  - [x] Ringkasan anggota read-only (jumlah per role)
- **Polish animasi (tanpa dependency)**: dialog/dropdown lebih lembut (durasi + slide), skeleton shimmer, feedback item list & bottom nav, fade-in daftar transaksi, count-up saldo dashboard, transisi warna saat ganti tema — semua murni CSS/Tailwind (`tw-animate-css` + keyframe) & JS ringan (requestAnimationFrame).
- **Redesain header**: nama aplikasi **KasKita** tampil di sebelah logo (sebelumnya nama org yang tampil) dengan ukuran menonjol `text-lg`/`md:text-xl` seperti header app native; org switcher menampilkan ikon gedung + label nama org + chevron (spinner "Memuat…" + `disabled` saat ganti organisasi); ThemePicker jadi **ikon palet saja** (spinner saat menyimpan, label tersedia untuk screen reader) di semua ukuran layar.
- **Perilaku navigasi seperti app native mobile**:
  - Ganti tab antar menu memakai aturan **dashboard sebagai root** (`push` dari dashboard ke tab lain, `replace` antar tab non-dashboard dan kembali ke dashboard) sehingga Back dari tab mana pun kembali ke Dashboard, bukan ke tab sebelumnya; Back dari Dashboard keluar aplikasi
  - Tombol Back **menutup dialog lebih dulu** (semua `Dialog`) dan **menutup dropdown lebih dulu** (semua `Select`/org switcher/tema), baru Back berikutnya berpindah halaman — meniru perilaku app native; tumpukan dialog + dropdown di dalamnya ditutup berurutan



## Di Luar Scope MVP (jangan dikerjakan kecuali diminta eksplisit)
- Approval flow multi-level
- Notifikasi push/email otomatis selain undangan
- Multi-currency
- Export Excel
- Grafik tren kompleks (chart dasar boleh, tapi bukan prioritas MVP)
