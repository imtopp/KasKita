# AGENTS.md

Platform Kas Organisasi (multi-tenant) — Next.js + Supabase. Seluruh keputusan teknis sudah dituangkan di dokumen; jangan mengarang sendiri. Baca dokumen di bawah sebelum mengerjakan fitur apa pun.

## Dokumen sumber (urut prioritas)

- `rancangan-arsitektur-kas-platform.md` — arsitektur, skema DB, RLS, struktur folder, env vars
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
- Server Component sebagai default; `'use client'` hanya kalau butuh interaktivitas (form, state, event handler).
- Supabase client: Server Component → `lib/supabase/server.ts`, Client Component → `lib/supabase/client.ts`. Jangan tertukar.
- Form: react-hook-form + zod; definisi skema zod SEKALI di `lib/types.ts` (atau file schema terpisah), dipakai ulang di form & API — jangan duplikasi.
- Mobile-first: cek semua halaman di viewport 375px; touch target minimal 44x44px; `inputMode="numeric"` untuk nominal; nominal format Rupiah `Rp 1.500.000`. Default style = mobile, baru `sm:`/`md:`/`lg:` untuk layar besar.
- File komponen `kebab-case.tsx`, nama komponen `PascalCase`.

## Env vars

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only
```

Salin `.env.local.example` → `.env.local`; jangan commit `.env.local` atau kredensial apa pun.

## DB & migrasi

- `03-database-migration.sql` dijalankan sekali di Supabase SQL Editor. JANGAN edit migration yang sudah dijalankan — buat migration file baru.
- JANGAN ubah skema / RLS policy / trigger yang sudah ada tanpa konfirmasi user.
- Storage bucket `receipts` dibuat manual di Supabase Dashboard.
- Setiap fitur wajib lolos uji isolasi data (2 akun di 2 organisasi berbeda, tidak boleh saling lihat).

## Yang TIDAK boleh dilakukan tanpa konfirmasi user

Mengubah skema DB yang sudah dijalankan, menambah dependency baru, mengubah RLS policy, menambah fitur di luar PRD, ganti provider (Supabase/Vercel).

## Struktur folder (sesuai arsitektur section 7)

- `app/(auth)/` — login, register, reset-password
- `app/(dashboard)/` — onboarding + `org/[slug]/` (dashboard, transactions, reports, members, settings)
- `app/api/` — hanya untuk undangan/report/logic ber-privilege
- `components/ui/` — shadcn; `lib/supabase/` — client.ts/server.ts/middleware.ts
- `proxy.ts` (Next 16: pengganti `middleware.ts`) — proteksi route/refresh session; `lib/supabase/middleware.ts` — helper `updateSession`; `supabase/migrations/` — SQL migration

## Dependencies lokal

`.npmrc` di root mengarahkan cache npm ke dalam workspace (`./.npm-cache`); `node_modules` juga lokal ke workspace. Jangan install dependency global di luar workspace. Catatan: `prefix` tidak bisa di-set lewat project `.npmrc` (npm menolaknya).
