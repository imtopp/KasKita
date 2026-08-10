# Task Breakdown — Urutan Pengerjaan

Kerjakan **berurutan dari atas ke bawah**. Jangan lompat ke task berikutnya sebelum task sebelumnya lolos "Definition of Done". Setiap task idealnya 1 sesi kerja/1 commit.

Referensi dokumen lain:
- Detail requirement per fitur → `02-requirements-prd.md`
- Schema database → `03-database-migration.sql`
- Aturan koding → `04-coding-standards.md`
- Arsitektur & folder structure → `01-rancangan-arsitektur-kas-platform.md`

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
- [x] Fix mobile: **konten paling bawah tertutup bottom nav** — `<main>` di org layout kini punya padding bawah `pb-[calc(5rem+env(safe-area-inset-bottom))]` (mobile) sehingga card/tombol terakhir bisa discroll melewati nav, dan `BottomNav` diberi `env(safe-area-inset-bottom)` agar ikon tidak tertutup home indicator iPhone.
- [x] Fix laporan (akuntansi kumulatif): **laporan bulanan tidak boleh terkesan "reset ke nol" per bulan** — sebelumnya card "Saldo akhir bulan" menampilkan `income - expense` bulan itu saja (mislabel). Sekarang `MonthTotals` punya `openingBalance` & `closingBalance` (`lib/types.ts`); `reports/page.tsx` menghitung saldo awal = kumulatif semua transaksi sebelum tanggal 1 bulan terpilih, lalu saldo akhir = saldo awal + selisih bulan itu; `reports-view.tsx` menampilkan urutan: Saldo awal bulan → pemasukan → pengeluaran → selisih bulan ini → Saldo akhir bulan. Dokumen PRD US-4.2 di-update (saldo awal/akhir kumulatif, menyambung antar bulan).
- [x] Konsistensi saldo kumulatif: **dashboard "Bulan ini" kini sejalan dengan laporan** — `dashboard/page.tsx` menambah saldo awal bulan (kumulatif sebelum tanggal 1 bulan berjalan) dan saldo akhir bulan (= saldo saat ini, kumulatif), label "Selisih" diubah jadi "Selisih bulan ini". Struktur card bulan berjalan di dashboard identik dengan laporan bulanan (Saldo awal → Pemasukan → Pengeluaran → Selisih → Saldo akhir). PRD US-4.1, arsitektur (komentar struktur folder), README di-update. Tidak ada tempat lain yang menampilkan saldo (transaksi/kategori/anggota hanya list tanpa saldo, tidak perlu diubah).
- [x] Fix akses role (UX): **menu Anggota & Pengaturan disembunyikan untuk non-owner** — sebelumnya nav (`BottomNav`/`DesktopNav`) menampilkan semua menu padahal halaman members sudah memblokir non-owner (`Forbidden`), dan halaman settings belum punya role check sama sekali (placeholder). Sekarang: layout `org/[slug]` membaca role dari `organization_members` dan mengirimnya ke nav; item `members` & `settings` difilter (hanya `owner`); grid `BottomNav` menyesuaikan jumlah kolom dinamis; halaman `settings/page.tsx` kini juga memblokir non-owner (konsisten dengan members). Defense-in-depth: menu disembunyikan DAN route tetap ditolak di server. PRD US-5.3 + arsitektur (deskripsi role) di-update.
- [x] Fix UX ganti password: **pesan error jelas saat password baru sama dengan password sementara** — `update-password/page.tsx` mendeteksi error GoTrue ("different from old password") dan menampilkan "Password baru tidak boleh sama dengan password yang sedang dipakai (password sementara). Pilih password yang berbeda." alih-alih pesan gagal generik.
- [x] Fitur: **kelola akun anggota oleh owner** — tombol "Kelola" per anggota bendahara/viewer membuka `member-manage-dialog.tsx` berisi 3 aksi: (1) **atur ulang password sementara** — `admin.updateUserById` dengan `user_metadata.must_change_password=true` sehingga anggota diminta ganti password saat login berikutnya, password baru ditampilkan untuk disampaikan aman; (2) **ganti email** — `admin.updateUserById` dengan `email` + `email_confirm=true`, deteksi 409 jika email sudah dipakai akun lain; (3) **nonaktifkan/aktifkan akun** — ban via `ban_duration: '876000h'` / unban `'none'`, badge "Nonaktif" muncul di daftar anggota. Semua aksi lewat POST `/api/members` (`resetPassword`/`changeEmail`/`setActive`), hanya untuk role bendahara/viewer & bukan diri sendiri (server-check via helper `findManageableMember` + `getRequester` owner-only). `MemberRow` kini punya `banned_until`. README, PRD (Fitur Tambahan), arsitektur (komentar API route) di-update.
- [x] Fitur: **putuskan semua sesi (kick session)** — section ke-4 di dialog Kelola. `POST /api/members` mode `revokeSessions` menghapus semua baris `auth.sessions` milik user via service client (`admin.from("auth.sessions").delete().eq("user_id", ...)`), sehingga seluruh refresh token tidak berlaku seketika (access token JWT lama kedaluwarsa otomatis maks. ±1 jam). UI menampilkan konfirmasi + note bahwa refresh token langsung mati & access token lama ±1 jam, hasil "Semua sesi X diputus". Dipasangkan dengan atur ulang password untuk prosedur akun kena hack. Perlu diperhatikan: ban (`setActive`) TIDAK mencabut sesi aktif (perilaku Supabase), jadi kick session adalah langkah terpisah. README, PRD (Fitur Tambahan), arsitektur (komentar API route) di-update.
- [x] Fix UX desktop: **org switcher & tombol keluar** — dropdown `SelectContent` memakai `w-(--anchor-width)` sehingga selebar trigger (176px) dan nama org panjang ketimpa ikon centang; trigger kini `sm:max-w-64` (nama org di PC tidak kepotong) dan content `min-w-64`, nama org dibungkus `min-w-0 flex-1 truncate` (nama panjang terpotong elipsis rapi, bukan ketimpa centang). Tombol Keluar di header PC: basis `w-full` tidak di-override sehingga lebar aneh — kini `w-auto shrink-0` di layout.
- [x] Fix UX mobile transaksi: **list item & filter tanggal** — nominal di kanan kini `whitespace-nowrap` + kolom kanan `shrink-0` (Rp + angka selalu satu baris), sementara catatan (`description`) tidak lagi `truncate` tapi `break-words` sehingga turun ke baris bawah bila panjang. Filter tanggal diberi label terlihat "Dari tanggal" & "Sampai tanggal" (+ label "Jenis"/"Kategori" untuk konsistensi grid md:grid-cols-4), menggantikan `aria-label` yang tak terlihat di mobile.
- [x] Fitur: **export PDF laporan bulanan** (US-4.2, owner/bendahara) — tombol "Export PDF" di halaman Laporan (`reports-view.tsx`) mengunduh PDF berisi ringkasan (saldo awal bulan, pemasukan, pengeluaran, selisih, saldo akhir), rincian per kategori, dan daftar transaksi detail per tanggal (tanggal, kategori, keterangan, pemasukan/pengeluaran) untuk dibagikan via WhatsApp. Dihasilkan server-side di `GET /api/reports?orgId&month&year` memakai **pdfmake 0.3.11** (dependency baru): font Roboto di-embed dari base64 `pdfmake/build/vfs_fonts` ke `virtualfs` lalu `setFonts` (`lib/pdf/fonts.ts`), docDefinition + `generateReportPdf()` di `lib/pdf/report.ts`, file `laporan-kas-<slug>-<tahun>-<bulan>.pdf` dengan `Content-Type: application/pdf` + `Cache-Control: no-store`. **Otorisasi**: `getRequester(orgId, ["owner","treasurer"])` — `getRequester` di `lib/api-helpers.ts` kini menerima daftar role (default owner, backward compatible). Data dibaca lewat client RLS user (bukan service_role) sebagai defense-in-depth; agregasi saldo/breakdown dipindah ke `lib/reports-data.ts` (`summarizeMonth`) agar page & API tidak menduplikasi logika. Gotcha teknis: `import * as pdfmake` dari modul CJS gagal saat build (Turbopack membekukan namespace → `this.fonts` tak bisa di-assign); solusi default-import CJS + augmentasi tipe `types/pdfmake.d.ts` (types resmi @types/pdfmake 0.3.3 untuk API 0.3.x). README, PRD (US-4.2 + Fitur Tambahan), arsitektur (struktur API/lib) di-update.
- [x] Fitur lanjutan PDF: **logo KasKita di header laporan** — `lib/pdf/logo.png` (copy dari `public/logo.png`, 614×614) dibaca server-side via `readFileSync(new URL("./logo.png", import.meta.url))` lalu di-base64 jadi data URL (`LOGO_DATA_URL` di `lib/pdf/fonts.ts`); docDefinition kini punya `images.logo` + baris header `columns` (logo 64×64 di kiri, judul/org/periode/tanggal di kanan). `new URL` di-trace Turbopack ke `.next/server/assets/logo.<hash>.png` (terbundle otomatis, aman untuk Vercel; diverifikasi build + produksi). Gotcha: registrasi logo langsung ke `virtualfs.storage` (pola font) GAGAL — `readFileSync` pdfmake memanggil `normalizeFilename` pada key non-string sehingga buffer logo dibaca ulang sebagai path; solusi final data URL karena di-decode `Buffer.from` internal pdfmake. Terverifikasi: PDF valid `%PDF-1.3` 132KB (sebelumnya 21KB) dengan XObject FlateDecode PNG.
- [x] Fix UX mobile: **input tanggal kosong di HP** — di browser mobile (iOS/Android) `<input type="date">` tidak menampilkan placeholder native sehingga field tampak kosong; di PC tampil `dd/mm/yyyy` native. Solusi komponen baru `components/date-input.tsx` (`DateInput`): membungkus Input + overlay hint `dd/mm/yyyy` (pointer-events-none, hanya muncul saat nilai kosong, posisi kiri tengah) dan menyembunyikan placeholder webkit via `[&::-webkit-datetime-edit]:text-transparent` agar tidak dobel teks di Chrome/Edge/Safari desktop. Dipakai di filter transaksi "Dari tanggal"/"Sampai tanggal" (`transactions-view.tsx`) dan field Tanggal form transaksi (`transaction-form-dialog.tsx`, nilai via `watch("transaction_date")`).
- [x] Fix UX loading: **indikator skeleton saat filter dipilih** — sebelumnya saat ganti filter/pagination (transaksi) atau bulan/tahun (laporan) `router.push` berubah URL tanpa umpan balik visual (halaman server tidak re-render seketika). Solusi `useTransition` + `startTransition` membungkus `router.push`: `isPending` true selama RSC data baru diambil. Transaksi: daftar diganti `TransactionListSkeleton` (4 kartu skeleton, pagination disembunyikan, `aria-busy`), filter/tombol tetap terlihat. Laporan: dua card ringkasan diganti `ReportsSkeleton` (header + baris angka), select bulan/tahun + tombol Export PDF tetap terlihat. Anggota: teks "Memuat anggota..." diganti skeleton list (header + 4 baris kartu) dan `loadMembers()` kini set loading juga saat reload setelah ubah peran/hapus/undang. Dashboard & Kategori tidak pakai searchParams (hanya skeleton `loading.tsx` saat pindah menu — sudah cukup); Settings statis. Lint 0 error, build sukses.
- [x] Fitur: **export PDF untuk SEMUA role** (owner/co-owner/bendahara/viewer) — tombol "Export PDF" di halaman Laporan tidak lagi disembunyikan untuk viewer (laporan memang bisa dilihat semua role; export hanya unduhan read-only). `GET /api/reports` otorisasi diperluas ke `["owner","co_owner","treasurer","viewer"]`; prop `canManage` dihapus dari `ReportsView` dan halaman `reports`. Logika `summarizeMonth` tidak berubah.
- [x] Fitur: **role co-owner** — role baru (nilai DB `co_owner`, label "Co-owner") yang berperilaku seperti owner di organisasinya, kecuali **tidak bisa membuat organisasi baru** dan **tidak bisa menghapus organisasi**. Cakupan:
  - Migration `supabase/migrations/202608090001_co_owner_role_and_org_creation.sql` (file BARU — file `03-database-migration.sql` yang sudah dijalankan tidak diubah): perluas check constraint `organization_members_role_check` → +`'co_owner'`; tambah fungsi `can_create_organization()`; ubah policy `insert_org` → `created_by = auth.uid() AND can_create_organization()` (hanya owner / user tanpa org yang bisa buat); ubah policy update org, kelola member, undangan, transaksi, & kategori agar menerima `co_owner`; policy delete org tetap owner-only.
  - API `/api/members`: `getRequester` untuk GET/POST/PATCH/DELETE kini `["owner","co_owner"]`; PATCH/DELETE menolak co-owner yang mengubah/menghapus anggota berperan owner (`getMemberRole` — hanya owner asli yang bisa); `findManageableMember` tetap melarang aksi kelola pada member owner; `ROLE_VALUES` + pesan error diperbarui. `/api/invitations` juga `["owner","co_owner"]`.
  - Halaman `members` & `settings` menerima owner/co-owner; `BottomNav`/`DesktopNav` menampilkan menu Anggota & Pengaturan untuk owner/co-owner; `canManage` transaksi & kategori ikut menyertakan `co_owner`.
  - UI halaman Anggota: opsi role "Co-owner" di select; opsi "Owner" hanya tampil untuk owner asli; select & tombol Hapus dinonaktifkan untuk member owner bila user bukan owner (`currentRole` dikirim dari server).
  - Undangan via email TETAP bendahara/viewer (co-owner diangkat via ubah peran) — konsisten dengan constraint tabel `invitations`.
- [x] Fitur: **pembatasan pembuatan organisasi (hanya owner)** — org switcher: item "Buat organisasi baru" hanya dirender bila user owner di salah satu org (`canCreateOrg` dihitung di `app/(dashboard)/org/[slug]/layout.tsx`); halaman `/onboarding`: user yang sudah tergabung tapi bukan owner di org mana pun ditolak `Forbidden` ("Hanya owner yang bisa membuat organisasi baru."); `create-organization-form.tsx` menampilkan pesan sama bila RLS menolak (defense-in-depth). User baru tanpa org tetap bisa buat org pertama (onboarding).
- [x] Fix PDF: **jarak & kesejajaran logo di header** — perjalanan: margin logo 64×64 mula-mula `[0,0,12,0]`, lalu `[0,8,16,0]` dan `[0,8,28,0]` — tapi tetap terlihat menempel. **GOTCHA pdfmake: `margin` pada node `image` di dalam `columns` DIABAIKAN** (khususnya margin kiri/kanan), jadi jarak yang diset di logo tidak pernah muncul. Solusi: jarak dipindah ke margin kiri kolom teks (`stack`) → `[16,0,0,0]`, dan logo diberi `margin-top 3` agar bagian atas gambar sejajar dengan huruf "L" di "Laporan" (margin-top 8 sebelumnya membuat logo terlihat lebih rendah dari teks). Hasil final di `lib/pdf/report.ts`: logo `{ image, width: 64, height: 64, margin: [0,3,0,0] }` + kolom teks `margin: [16,0,0,0]`.
- [x] Fix layout mobile (iPhone): **overlap & horizontal scroll** — (1) overlay petunjuk `dd/mm/yyyy` di `DateInput` kini disembunyikan di iOS via `supports-[-webkit-touch-callout:none]:hidden` (iOS memang menampilkan placeholder tanggal native; overlap terjadi karena overlay + teks native tampil bersamaan) + selector `::-webkit-datetime-edit-fields-wrapper` ikut di-`text-transparent`; (2) sel grid filter transaksi diberi `min-w-0` agar select/date input tidak meluap di layar sempit; (3) wrapper layout org diberi `overflow-x-clip` agar konten yang lebih lebar dari viewport tidak bikin scroll horizontal.

Catatan: perubahan role co-owner & pembatasan buat organisasi **mengubah skema/RLS** — dijalankan via migration baru `supabase/migrations/202608090001_co_owner_role_and_org_creation.sql` (file `03-database-migration.sql` yang sudah dijalankan TIDAK diubah).

## Operasional & Doc Sync (9 Agustus 2026)

- [x] **Migration co_owner dieksekusi ke Supabase production** — `supabase/migrations/202608090001_co_owner_role_and_org_creation.sql` dijalankan via Management API (`POST /v1/projects/snixmtiahvfuqxnokhkf/database/query`, dibungkus `BEGIN/COMMIT`, HTTP 201). Diverifikasi di DB: fungsi `can_create_organization()` ada; constraint `organization_members_role_check` = `('owner','co_owner','treasurer','viewer')`; policy `update_org_manage`, `insert/update/delete_member_manage`, `manage_invitations` aktif; `insert_org` = `created_by = auth.uid() AND can_create_organization()`; kategori & transaksi = `('owner','co_owner','treasurer')`; `delete_org_owner_only` tetap owner-only.
- [x] **Tooling: `scripts/run-sql.ps1`** — script untuk menjalankan migration/SQL dari lokal ke project Supabase: membaca `SUPABASE_ACCESS_TOKEN` dari `.env.local`, eksekusi via Management API, SQL dibungkus `BEGIN/COMMIT` (atomic). Pakai: `powershell -ExecutionPolicy Bypass -File scripts\run-sql.ps1 supabase\migrations\<file>.sql` (exit 0 + `HTTP 201` = sukses). `SUPABASE_ACCESS_TOKEN` dicatat di AGENTS.md, README, dan `.env.local.example`.
- [x] **Doc sync konsistensi role & export PDF** — perbaikan istilah yang tersisa di seluruh file md: (1) `01-rancangan-arsitektur-kas-platform.md`: poin MVP hapus istilah "admin" yang bukan role; skema `invitations` dikoreksi ke `('treasurer','viewer')` (undangan tidak menerima owner/co-owner); komentar RLS kategori/transaksi & halaman `members` jadi owner/co-owner/treasurer; komentar route `reports` jadi "semua role"; roadmap export PDF dicentang (Excel masih belum); (2) `02-requirements-prd.md`: acceptance criteria US-3.1/3.3/3.4/4.2 disesuaikan dengan owner/co-owner/treasurer & export semua role; (3) `README.md`: akurasi hint tanggal (iOS pakai placeholder native) + `SUPABASE_ACCESS_TOKEN` di daftar env vars. Entri changelog lama (yang menyebut owner/bendahara) sengaja dibiarkan sebagai catatan historis — ekspansi role tercatat di entri sesi ini.
- [x] **Rapikan penamaan dokumen** — `rancangan-arsitektur-kas-platform.md` di-`git mv` menjadi **`01-rancangan-arsitektur-kas-platform.md`** agar urutan nomor konsisten dengan `02`/`03`/`04`/`05` (arsitektur = dokumen sumber nomor 1). Seluruh referensi nama file di AGENTS.md, README.md, `02-requirements-prd.md`, dan entri changelog `05-task-breakdown.md` diperbarui.
- [x] **Audit akhir konsistensi semua referensi md** — pemeriksaan ulang seluruh dokumen; temuan & perbaikan di `01-rancangan-arsitektur-kas-platform.md`: (1) ilustrasi RLS section 5 disinkronkan dengan DB yang sudah berjalan — role `('owner','co_owner','treasurer')` untuk insert/update/delete kategori & transaksi, `insert_org` = `created_by = auth.uid() AND can_create_organization()`, `manage_invitations`/kelola member = `('owner','co_owner')`, `delete_org_owner_only` = owner only; (2) lengkapi policy yang belum ditampilkan: `update_categories`/`delete_categories`, `update_member_manage`/`delete_member_manage`, `delete_org_owner_only`, serta helper `can_create_organization()` dan RPC `is_slug_available`; (3) perbaiki konflik "organisasi aktif di React context + URL" → murni URL param (tidak ada React context di kode, konsisten 04-coding-standards); (4) hapus sebutan "magic link" (tidak diimplementasikan); (5) tambah `member-manage-dialog.tsx` di struktur komponen. Di `02-requirements-prd.md`: US-3.1 dipisah — form dicentang selesai, upload foto tetap `[ ]` (belum dikerjakan, `receipt_url` menganggur); heading "Kelola akun oleh owner" → owner/co-owner dengan target bendahara/viewer/co-owner; deskripsi hint tanggal diperbarui akurat (overlay hanya Android/desktop, iOS pakai placeholder native).
- [x] **Fitur: co-owner bisa dipilih langsung saat daftar anggota** (per konfirmasi user) — dropdown Peran di dialog "Daftarkan anggota manual" & "Tambah anggota existing" kini menampilkan Co-owner/Bendahara/Viewer; `createMemberSchema` & `addExistingMemberSchema` di `lib/types.ts` menerima `co_owner` (API POST `/api/members` tidak perlu berubah karena memakai role dari skema). Undangan via email TETAP bendahara/viewer (constraint tabel `invitations`). PRD & komentar skema `invitations` di arsitektur diperbarui (sebelumnya: "co-owner hanya via ubah peran").
- [x] **Fix horizontal scroll di popup "Daftarkan anggota manual"** — baris input "Password sementara" di dalam `flex gap-2` tanpa `min-w-0` sehingga input tidak bisa menyusut di bawah lebar intrinsiknya (input HTML `min-width: auto`) dan mendorong konten melebihi lebar popup di layar sempit → horizontal scroll. Solusi: `min-w-0 flex-1` pada input password (pola sama dengan fix sel filter transaksi sebelumnya).
- [x] **Fix lanjutan horizontal scroll di popup tambah anggota** — penyebab tersisa: `Button` punya `whitespace-nowrap`, sehingga dua tombol bertulisan panjang ("Email sudah punya akun? Tambahkan sebagai anggota existing" dan "Email sudah terdaftar — tambahkan sebagai anggota") tidak bisa wrap → mendorong konten melebihi lebar popup; karena popup `overflow-y-auto`, overflow horizontal ter-compute jadi scrollable. Solusi: kedua tombol diberi `whitespace-normal text-wrap` (link juga `text-left`, tombol emailExists `h-auto min-h-11`), dan kedua `DialogContent` diberi `overflow-x-clip` sebagai jaring pengaman.
- [x] **Fix label "Owner" tampil huruf kecil di dropdown peran (login co-owner)** — `SelectItem value="owner"` sebelumnya hanya dirender saat `isOwner`; saat login sebagai co-owner item itu tidak ada sehingga `SelectValue` base-ui menampilkan nilai mentah `member.role` (`"owner"` kecil) karena tidak ada label yang cocok. Solusi: item "Owner" selalu dirender tapi `disabled={!isOwner}` — label tampil kapital benar, dan co-owner tetap tidak bisa mengangkat owner lewat UI (API juga menolak). Verifikasi: aksi untuk member owner saat co-owner login memang sudah tidak ada — dropdown peran disabled, tombol Kelola & Hapus tidak dirender.
- [x] **Fix loading tombol berhenti terlalu cepat** di "Atur password baru" (`update-password`) dan "Buat organisasi" (`CreateOrganizationForm`) — `isSubmitting` dari react-hook-form berhenti begitu `onSubmit` selesai (langsung setelah `router.push` dipanggil), padahal navigasi ke halaman tujuan masih berjalan. Solusi: tambah state `redirecting` di-set `true` sebelum `router.push` (pola yang sudah dipakai di halaman login & register), tombol `disabled={isSubmitting || redirecting}` dan spinner/label bertahan sampai halaman tujuan dimuat.
- [x] **Fix overlap filter tanggal transaksi di iPhone** — di grid `grid-cols-2` mobile, "Dari tanggal" & "Sampai tanggal" berdampingan di sel sempit (~165px) sedangkan `input type="date"` iOS menampilkan segmen tanggal native (bulan/hari/tahun) dengan min-width besar sehingga konten meluap dan kedua input saling menimpa. Solusi: dua sel tanggal diberi `col-span-2` (full-width, satu baris penuh) di mobile dan `md:col-span-1` di desktop — layout desktop tidak berubah (tetap 4 kolom).
- [x] **Spacing field password di halaman login** — `CardContent` diberi `pb-2` supaya jarak bawah field password ke garis pembatas lebih lega; `pt-8` pada `CardFooter` sempat dicoba untuk menyamakan jarak atas tombol tapi akhirnya dihapus atas permintaan user — padding atas footer kembali ke default.

## Polish Animasi & Pengaturan Organisasi (9 Agustus 2026)

### Polish animasi (tanpa dependency baru, murni CSS/Tailwind + JS ringan)
- [x] **Polish 1: dialog & dropdown lebih lembut** — `duration-100` → `duration-200 ease-out` (overlay, `DialogContent`, `SelectContent`); popup dialog ditambah `slide-in-from-bottom-2` saat buka & `slide-out-to-bottom-2` saat tutup (feel naik turun halus).
- [x] **Polish 2: skeleton shimmer** — utility `.skeleton-shimmer` di `app/globals.css` (keyframe `skeleton-shimmer` + highlight `color-mix(var(--muted-foreground) 12%)` menyesuaikan tema terang/gelap); `components/ui/skeleton.tsx` beralih dari `animate-pulse` polos ke shimmer halus 1.8s.
- [x] **Polish 3: bottom nav feedback** — `transition-colors duration-200` pada item nav & tombol Keluar; ikon membesar halus saat aktif (`[&_svg]:scale-110`) dan mengecil saat ditekan pada tombol Keluar.
- [x] **Polish 4: item list feedback sentuh** — item list transaksi, kategori, & anggota diberi `transition-colors duration-200` + `active:bg-muted/40` (umpan balik tekan ringan, tidak mengubah perilaku klik).
- [x] **Polish 5: fade-in daftar transaksi** — daftar transaksi & empty state muncul dengan `animate-in fade-in-0 duration-300` setelah skeleton (ganti filter/halaman tidak lagi muncul mendadak).
- [x] **Polish 6: angka saldo count-up** — komponen client baru `components/animated-number.tsx` (requestAnimationFrame, 0 dependency, ease-out cubic 650ms) dipakai untuk saldo saat ini di dashboard; angka ter-update mengikuti nilai baru dari server tanpa animasi pada render pertama.
- [x] **Polish 7: transisi warna ganti tema** — utility `.theme-transitioning` di `globals.css` (transition `background-color`/`border-color`/`color` 300ms); `theme-picker.tsx` menambah class ini ke `<html>` saat ganti tema dan menghapusnya setelah 400ms — transisi hanya terjadi saat ganti tema, bukan saat interaksi lain.

### Fitur halaman Pengaturan organisasi (`org/[slug]/settings`)
- [x] **Ubah nama organisasi** (owner/co-owner) — form baru `components/org-name-form.tsx` (react-hook-form + `orgNameSchema` di `lib/types.ts`, pola manual `safeParse` seperti form lain); update `organizations.name` via client (RLS `update_org_manage`), `router.refresh()` agar header & org switcher ikut ter-update; notice sukses + pesan error manusiawi (termasuk tolak RLS).
- [x] **Ubah alamat (slug)** (owner/co-owner) — form baru `components/org-slug-form.tsx` (`orgSlugSchema`); cek ketersediaan via RPC `is_slug_available` (skip cek bila slug sama), tangani duplicate key, lalu `router.replace(/org/<slugbaru>/settings)` + refresh karena URL lama tidak berlaku. Hint memberitahu bahwa semua tautan lama ikut berubah.
- [x] **Hapus organisasi (owner only)** — `components/org-delete-button.tsx`: tombol merah "Hapus organisasi" + dialog konfirmasi wajib **mengetik ulang nama organisasi** (tombol hapus aktif hanya jika nama cocok); delete via client (RLS `delete_org_owner_only` menolak co-owner sebagai defense-in-depth), lalu `router.push("/")`. Tombol hanya dirender untuk role `owner`.
- [x] **Ringkasan anggota read-only** — card "Informasi organisasi" menampilkan nama, slug, tanggal dibuat, total anggota, dan jumlah per role (owner/co-owner/bendahara/viewer) yang dihitung di server (`organization_members` group by role).
- [x] **Halaman settings diperbarui** — tidak lagi placeholder: `app/(dashboard)/org/[slug]/settings/page.tsx` membaca `id, name, slug, created_at` + ringkasan anggota, tetap memblokir non owner/co-owner (`Forbidden`). Tidak ada perubahan skema/RLS (semua policy sudah ada).
- [x] **Perkuat intensitas animasi** (umpan balik user: "animasinya ga terlalu kerasa", diuji di prod) — durasi & jarak dinaikkan agar terlihat jelas tanpa terasa lambat: dialog overlay/popup `200→250ms` + slide `bottom-2→bottom-4` (32px); select `150→200ms`; skeleton shimmer kontras `12%→22%` + durasi `1.8→1.5s` + dikombinasi `animate-pulse` (breathing); bottom nav scale ikon aktif `110→125%` & durasi `200→300ms`; fade-in daftar transaksi ditambah `slide-in-from-bottom-2` & durasi `300→400ms`; count-up saldo `650→900ms`; transisi ganti tema `300→400ms`. Semua durasi non-standar memakai arbitrary value (`duration-[250ms]`/`duration-[400ms]`) karena bukan skala default Tailwind.
- [x] **Fix count-up saldo dashboard tidak terlihat saat buka halaman** (umpan balik user) — sebelumnya animasi hanya berjalan saat prop `value` berubah (mis. setelah tambah transaksi & kembali via navigasi client-side); saat page load penuh angka langsung tampil nilai akhir. Perbaikan di `components/animated-number.tsx`: tambah flag `startedRef` — pada mount pertama animasi berjalan dari 0 ke nilai akhir (900ms ease-out), pada perubahan nilai berikutnya animasi dari nilai sebelumnya ke nilai baru (perilaku lama tetap). Nilai 0 tidak beranimasi (langsung tampil).
- [x] **Fix header mobile: nama organisasi terpotong** (umpan balik user) — di HP header satu baris (logo + nama + org switcher + tema) melebihi lebar 375px sehingga nama org terpotong parah. Iterasi: (1) sempat dibuat **header 2 baris** (nama full-width di baris 1, switcher full-width di baris 2) tapi user menilai aneh karena nama org muncul 2× (baris 1 + di dalam switcher); (2) solusi pertama: **header 1 baris + org switcher jadi ikon `Building2` di mobile** (`SelectValue` di-`hidden md:block`, ikon `md:hidden`) — ternyata **gagal**: teks nama org masih tampil di trigger karena class `hidden` kalah dengan CSS trigger `*:data-[slot=select-value]:flex` (sama-sama set `display`, `flex` menang — elemen tetap terlihat, memakan ruang); (3) solusi final: `SelectValue` di-ganti **`max-md:sr-only`** — `sr-only` menyembunyikan via `clip`/1px (tidak bergantung `display`), jadi tak mungkin kalah oleh `*:data-...:flex`. Hasil: di mobile trigger hanya ikon gedung + chevron (kompak), nama org hanya tampil sekali di header full-width (`flex-1` truncate); desktop tetap menampilkan nama org di switcher.
