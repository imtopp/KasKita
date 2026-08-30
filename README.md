# KasKita

Platform kas organisasi (multi-tenant) — catat pemasukan/pengeluaran untuk RT, arisan, komunitas, dll. Dibangun dengan **Next.js (App Router)** + **Supabase** (Auth + Postgres + RLS) + **Tailwind CSS** + **shadcn/ui**.

**Production:** <https://kas-kita-delta.vercel.app>

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase: Postgres + Row Level Security (isolasi data per organisasi), Auth, Storage
- react-hook-form + zod (validasi form)
- shadcn/ui (Base UI)
- Deploy: Vercel (auto-deploy dari branch `main`)

## Fitur

- Auth: register, login, logout, reset password, wajib ganti password untuk akun yang dibuat manual
- Organisasi: buat organisasi (**hanya owner**), switcher multi-organisasi, isolasi data penuh via RLS; role **co-owner** (kuasa seperti owner di organisasinya, tapi tidak bisa buat/hapus organisasi baru)
- Transaksi: catat masuk/keluar, kategori per organisasi, filter, edit, hapus
- Dashboard (saldo saat ini + ringkasan bulan berjalan dengan saldo awal/akhir) & laporan bulanan (saldo awal/akhir kumulatif + ringkasan per kategori) + **export PDF laporan bulanan ber-logo KasKita** (semua role)
- Kelola anggota: undang via email, daftarkan manual (password sementara), **tambah anggota yang sudah punya akun**, ubah role, **atur ulang password**, **ganti email**, **nonaktifkan/aktifkan akun**, **putuskan semua sesi**, hapus
- Pengaturan organisasi (owner/co-owner): ubah nama, ubah slug/URL, hapus organisasi (owner only), ringkasan anggota per role
- **Perilaku navigasi native mobile**: Back menutup dialog lebih dulu (tanpa "bounce" ke halaman sebelumnya — entry history dialog dibuat salinan entry asli agar Next router menganggapnya no-op; dropdown tidak lagi menangkap Back — pernah membuat filter/select tidak bisa di-set); ganti tab dengan dashboard sebagai root (Back selalu kembali ke Dashboard); header menampilkan nama aplikasi + org switcher berikon + tema ikon
- **Empty state di semua list** + **toast notifikasi dengan Undo hapus transaksi** (item yang dihapus langsung hilang dari daftar begitu server mengonfirmasi, tidak menunggu refresh) + **pull-to-refresh list transaksi** (semua tanpa dependency tambahan)
- **Quick date filter** transaksi (Hari ini/7 hari/Bulan ini/30 hari), **file PDF bernama `laporan-kas-<org>-<bulan>-<tahun>`**, **prefetch tab** agar pindah menu instan, **kirim ulang undangan** yang belum diterima, dan **banner update PWA** ("Versi baru tersedia" + Muat ulang)
- **Toast kontras tinggi** (chip gelap `bg-foreground`) + **halaman Kategori tetap di tempatnya saat tambah/edit/hapus kategori** (daftar kategori dikelola di state client, tanpa `router.refresh()` yang sempat membalikkan navigasi ke halaman Transaksi)
- **Tema per-akun**: 5 tema (Klasik, Kawaii, Ocean, Forest, Sunrise) — pilihan tersimpan di akun
- **Pelacakan iuran per warga/unit**: halaman Iuran (status Belum/Cicil/Lunas dirinci per kategori iuran + ikon status kesimpulan tiap warga), form transaksi iuran "isi total, dipecah otomatis jadi N bulan + cicilan sisa" dengan periode backdated & anti dobel-catat, kelola warga (tambah/rename/nonaktif/**hapus** hanya tanpa transaksi, link akun → warga dengan badge "Kamu"), label entitas bisa diubah (default "Warga"), dan **export PDF laporan iuran tahunan** (matriks warga × 12 bulan per kategori, daftar belum lunas) — semua role
- Indikator loading di semua aksi (spinner tombol/form) + skeleton & spinner saat pindah menu, serta **skeleton saat ganti filter/pagination (transaksi) & bulan/tahun (laporan)**
- Input tanggal menampilkan petunjuk format `dd/mm/yyyy` di Android/desktop; di iPhone memakai placeholder tanggal bawaan (overlap dihindari via CSS)
- Mobile-first + PWA (Add to Home Screen)

## Menjalankan di lokal

```bash
npm install
npm run dev
```

> Di Windows, bila `npm.ps1` diblokir execution policy, pakai `npm.cmd`.

## Environment variables

Salin `.env.local.example` → `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only, JANGAN pernah di client
SUPABASE_ACCESS_TOKEN=...       # opsional, untuk tooling (Management API / scripts\run-sql.ps1)
```

## Struktur folder

- `app/(auth)/` — login, register, reset-password, update-password
- `app/(dashboard)/` — onboarding + `org/[slug]/` (dashboard, transactions, categories, dues, reports, members, settings)
- `app/api/` — undangan, kelola anggota (butuh `service_role`), & laporan PDF (bulanan + iuran tahunan)
- `components/ui/` — shadcn; `lib/supabase/` — client/server/middleware
- `proxy.ts` — proteksi route & refresh session (Next 16, pengganti `middleware.ts`)

Dokumen acuan: `01-rancangan-arsitektur-kas-platform.md`, `02-requirements-prd.md`, `03-database-migration.sql`, `04-coding-standards.md`, `05-task-breakdown.md`, `AGENTS.md`.
