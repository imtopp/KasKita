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
- Organisasi: buat organisasi, switcher multi-organisasi, isolasi data penuh via RLS
- Transaksi: catat masuk/keluar, kategori per organisasi, filter, edit, hapus
- Dashboard (saldo saat ini + ringkasan bulan berjalan dengan saldo awal/akhir) & laporan bulanan (saldo awal/akhir kumulatif + ringkasan per kategori) + **export PDF laporan bulanan ber-logo KasKita** (owner/bendahara)
- Kelola anggota: undang via email, daftarkan manual (password sementara), **tambah anggota yang sudah punya akun**, ubah role, **atur ulang password**, **ganti email**, **nonaktifkan/aktifkan akun**, **putuskan semua sesi**, hapus
- **Tema per-akun**: 5 tema (Klasik, Kawaii, Ocean, Forest, Sunrise) — pilihan tersimpan di akun
- Indikator loading di semua aksi (spinner tombol/form) + skeleton & spinner saat pindah menu, serta **skeleton saat ganti filter/pagination (transaksi) & bulan/tahun (laporan)**
- Input tanggal menampilkan petunjuk format `dd/mm/yyyy` di semua perangkat (placeholder native tak muncul di HP)
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
```

## Struktur folder

- `app/(auth)/` — login, register, reset-password, update-password
- `app/(dashboard)/` — onboarding + `org/[slug]/` (dashboard, transactions, categories, reports, members, settings)
- `app/api/` — undangan, kelola anggota (butuh `service_role`), & laporan PDF bulanan
- `components/ui/` — shadcn; `lib/supabase/` — client/server/middleware
- `proxy.ts` — proteksi route & refresh session (Next 16, pengganti `middleware.ts`)

Dokumen acuan: `rancangan-arsitektur-kas-platform.md`, `02-requirements-prd.md`, `03-database-migration.sql`, `04-coding-standards.md`, `05-task-breakdown.md`, `AGENTS.md`.
