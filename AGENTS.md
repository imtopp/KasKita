# AGENTS.md

Platform Kas Organisasi (multi-tenant) — Next.js + Supabase. Seluruh keputusan teknis sudah dituangkan di dokumen; jangan mengarang sendiri. Baca dokumen di bawah sebelum mengerjakan fitur apa pun.

## Dokumen sumber (urut prioritas)

- `01-rancangan-arsitektur-kas-platform.md` — arsitektur, skema DB, RLS, struktur folder, env vars
- `02-requirements-prd.md` — scope fitur + acceptance criteria (jangan tambah fitur di luar ini)
- `03-database-migration.sql` — source of truth skema DB + RLS + trigger
- `04-coding-standards.md` — konvensi koding + hal yang dilarang tanpa konfirmasi
- `05-task-breakdown.md` — urutan pengerjaan; kerjakan berurutan, jangan lompat task

## Stack

Next.js **App Router** + TypeScript + Tailwind (satu-satunya cara styling) + shadcn/ui + react-hook-form + zod + Supabase (Postgres/Auth/Storage). Deploy ke Vercel.

## Commands

- `npm run dev` — dev server
- `npm run build` — verifikasi wajib sebelum tugas dianggap selesai
- `npm run lint` — run bila tersedia
- Di komputer ini `npm.ps1` diblokir execution policy — pakai `npm.cmd` (atau `npx.cmd`).

## Konvensi yang WAJIB dipatuhi

- **RLS = lapisan isolasi data utama.** Jangan pernah andalkan filter `organization_id` manual di kode sebagai satu-satunya keamanan (defense-in-depth, bukan pengganti).
- CRUD standar langsung via Supabase client. Bikin API route (`app/api/*`) HANYA untuk: undangan email, generate laporan/PDF, atau operasi yang butuh `service_role` key.
- `service_role` key HANYA di server-side (API route / Server Action). **Tidak pernah** di komponen `'use client'`.
- Setiap `await supabase...` wajib cek `error`; jangan asumsikan sukses. Tampilkan pesan error yang manusiawi, bukan raw error object.
- Data harus selalu fresh: di service worker `public/sw.js`, request data/API/RSC HARUS network-only (jangan cache-first — pernah menyebabkan data basi: anggota/kategori tak muncul setelah refresh). Cache-first HANYA untuk aset statis ber-hash (`/_next/static/`). GET API data juga wajib `Cache-Control: no-store`.
- Server Component sebagai default; `'use client'` hanya kalau butuh interaktivitas (form, state, event handler).
- Supabase client: Server Component → `lib/supabase/server.ts`, Client Component → `lib/supabase/client.ts`. Jangan tertukar.
- Tema di-set via atribut `data-theme` pada `<html>`; 5 tema terdaftar di `components/theme-picker.tsx` (`THEMES`) + whitelist head script `app/layout.tsx`. Menambah tema = ubah 3 tempat: blok CSS `[data-theme=...]` di `app/globals.css`, array `THEMES`, dan whitelist script.
- Preferensi tema per-akun disimpan di `auth.users.user_metadata.theme` (via `supabase.auth.updateUser`); server membacanya di layout dan menyinkronkan ke `data-theme` lewat `ThemeSetter`.
- Form: react-hook-form + zod; definisi skema zod SEKALI di `lib/types.ts` (atau file schema terpisah), dipakai ulang di form & API — jangan duplikasi.
- Loading state: semua tombol aksi wajib spinner + `disabled`; indikator bertahan sampai proses selesai (mis. tombol login/register tetap loading sampai halaman tujuan siap). Saat pindah menu: skeleton konten via `loading.tsx` (`components/ui/skeleton.tsx`) + spinner link via `useLinkStatus` (`components/nav-link-icon.tsx`) — ikuti pola ini.
- Mobile-first: cek semua halaman di viewport 375px; touch target minimal 44x44px; `inputMode="numeric"` untuk nominal; nominal format Rupiah `Rp 1.500.000`. Default style = mobile, baru `sm:`/`md:`/`lg:` untuk layar besar.
- Bottom nav (mobile) fixed di bawah: konten `<main>` wajib punya padding bawah `pb-[calc(5rem+env(safe-area-inset-bottom))]` (desktop `md:pb-6`) supaya card/tombol terakhir tidak tertutup nav; nav sendiri pakai `pb-[env(safe-area-inset-bottom)]` agar tidak tertutup home indicator iPhone.
- File komponen `kebab-case.tsx`, nama komponen `PascalCase`.

## Env vars

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only
SUPABASE_ACCESS_TOKEN=...       # opsional, untuk tooling: Management API / supabase CLI (bukan dipakai aplikasi)
```

Salin `.env.local.example` → `.env.local`; jangan commit `.env.local` atau kredensial apa pun.

## Menjalankan migration ke Supabase (dari lokal)

Pakai `scripts/run-sql.ps1` — membaca `SUPABASE_ACCESS_TOKEN` dari `.env.local` lalu eksekusi via Management API (`POST /v1/projects/{ref}/database/query`), SQL dibungkus `BEGIN/COMMIT` jadi atomic:

```
powershell -ExecutionPolicy Bypass -File scripts\run-sql.ps1 supabase\migrations\<file>.sql
```

Exit code 0 + output `HTTP 201` = sukses. Contoh yang sudah dijalankan lewat cara ini: `supabase/migrations/202608090001_co_owner_role_and_org_creation.sql`.

## DB & migrasi

- `03-database-migration.sql` dijalankan sekali di Supabase SQL Editor. JANGAN edit migration yang sudah dijalankan — buat migration file baru.
- JANGAN ubah skema / RLS policy / trigger yang sudah ada tanpa konfirmasi user.
- Storage bucket `receipts` dibuat manual di Supabase Dashboard.
- Setiap fitur wajib lolos uji isolasi data (2 akun di 2 organisasi berbeda, tidak boleh saling lihat).
- GOTCHA RLS: `INSERT ... RETURNING` (yaitu `.insert(...).select(...)` di supabase-js) dievaluasi ulang terhadap policy SELECT, dan snapshot command TIDAK melihat baris yang baru dibuat trigger AFTER (mis. membership creator). Akibatnya insert yang pakai `.select()` bisa ditolak RLS walau `with check` lolos. Untuk baris yang baru dibuat, gunakan insert tanpa `.select()` lalu baca ulang / pakai nilai yang sudah diketahui client.

## Yang TIDAK boleh dilakukan tanpa konfirmasi user

Mengubah skema DB yang sudah dijalankan, menambah dependency baru, mengubah RLS policy, menambah fitur di luar PRD, ganti provider (Supabase/Vercel).

## Struktur folder (sesuai arsitektur section 7)

- `app/(auth)/` — login, register, reset-password
- `app/(dashboard)/` — onboarding + `org/[slug]/` (dashboard, transactions, categories, reports, members, settings) + `loading.tsx` (skeleton pindah menu)
- `app/api/` — hanya untuk undangan/report/logic ber-privilege
- `components/ui/` — shadcn; `lib/supabase/` — client.ts/server.ts/middleware.ts
- `proxy.ts` (Next 16: pengganti `middleware.ts`) — proteksi route/refresh session; `lib/supabase/middleware.ts` — helper `updateSession`; `supabase/migrations/` — SQL migration

## Dependencies lokal

`.npmrc` di root mengarahkan cache npm ke dalam workspace (`./.npm-cache`); `node_modules` juga lokal ke workspace. Jangan install dependency global di luar workspace. Catatan: `prefix` tidak bisa di-set lewat project `.npmrc` (npm menolaknya).
