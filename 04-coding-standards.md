# Coding Standards & Konvensi

Dokumen ini untuk dipegang AI coding assistant supaya hasil kerja konsisten walau dikerjakan bertahap/multi-sesi, dan tidak ada dua pendekatan berbeda untuk hal yang sama.

## Stack & Versi
- Next.js App Router (bukan Pages Router) — semua route baru masuk ke folder `app/`
- TypeScript wajib di semua file `.ts`/`.tsx`, hindari `any` kecuali benar-benar tidak terhindarkan
- Tailwind CSS untuk semua styling — jangan campur dengan CSS modules atau styled-components
- shadcn/ui untuk komponen dasar (button, input, dialog, dll) — jangan bikin komponen custom untuk hal yang sudah tersedia di shadcn/ui

## Struktur & Penamaan
- Nama file komponen: `kebab-case.tsx` (contoh: `transaction-form.tsx`), nama komponen di dalamnya `PascalCase` (contoh: `TransactionForm`)
- Nama folder route: sesuai struktur di dokumen arsitektur section 7 — jangan bikin struktur folder baru tanpa update dokumen arsitektur dulu
- Server Component sebagai default; tambahkan `'use client'` HANYA kalau butuh interaktivitas (form, state, event handler)
- Query ke Supabase di Server Component pakai `lib/supabase/server.ts`; di Client Component pakai `lib/supabase/client.ts` — jangan pernah tertukar

## Data Access Pattern
- **Selalu andalkan RLS**, jangan tulis manual filter `organization_id` di query sebagai satu-satunya lapisan keamanan (RLS = lapisan utama, filter manual di kode = defense-in-depth tambahan, bukan pengganti)
- Untuk operasi CRUD standar (transaksi, kategori) → langsung pakai Supabase client, TIDAK perlu bikin API route terpisah
- Bikin API route (`app/api/...`) HANYA untuk: kirim email undangan, generate laporan/PDF, atau operasi yang butuh `service_role` key
- `service_role` key HANYA boleh dipakai di server-side code (API routes, Server Actions) — jangan pernah di komponen yang punya `'use client'`

## State Management
- Organisasi aktif disimpan via URL param (`/org/[slug]/...`), bukan global state terpisah yang bisa out-of-sync dengan URL
- Pakai React Context hanya untuk data yang benar-benar perlu diakses di banyak komponen tanpa prop-drilling (contoh: user session, daftar organisasi user). Jangan bikin context untuk semua hal.
- Untuk form, pakai `react-hook-form` + validasi `zod` — konsisten di semua form, jangan campur dengan pendekatan lain

## Validasi Data
- Setiap input yang masuk ke database harus divalidasi di **dua tempat**: frontend (UX cepat) dan constraint database (safety net) — jangan andalkan salah satu saja
- Skema validasi (`zod`) untuk satu entity (misal `Transaction`) ditulis SEKALI di `lib/types.ts` atau file schema terpisah, dipakai ulang di form dan di API route — jangan duplikasi definisi validasi

## Error Handling
- Semua pemanggilan Supabase (`await supabase.from(...)`) harus cek `error` sebelum lanjut — jangan asumsikan selalu sukses
- Tampilkan pesan error yang manusiawi ke user (bukan raw error object dari Postgres/Supabase)
- Loading state wajib ada di semua tombol submit / operasi async (disable tombol + spinner/text "Menyimpan...")

## Mobile-First
- Semua komponen baru HARUS di-render dan dicek dulu di lebar 375px sebelum dianggap selesai
- Gunakan Tailwind breakpoint mobile-first: style default = mobile, tambahkan `sm:`/`md:`/`lg:` untuk layar lebih besar — jangan sebaliknya (desktop-first lalu override ke mobile)

## Git & Commit
- Satu commit = satu perubahan logis (jangan gabung "tambah fitur X" dengan "fix bug Y" dalam satu commit)
- Commit message pakai format: `feat: tambah form transaksi`, `fix: perbaiki validasi role viewer`, `refactor: ...`
- Jangan commit file `.env.local` atau kredensial apa pun

## Yang TIDAK BOLEH Dilakukan Tanpa Konfirmasi User
- Mengubah skema database yang sudah dijalankan (`03-database-migration.sql`) — buat migration file baru sebagai gantinya
- Menambah dependency/library baru di luar yang sudah disebut di dokumen arsitektur
- Mengubah RLS policy yang sudah ada
- Menambah fitur di luar scope yang tertulis di `02-requirements-prd.md`
- Mengganti provider (misal ganti dari Supabase ke Firebase, atau dari Vercel ke provider lain)

## Kalau AI assistant menemukan ambiguitas
Kalau ada instruksi yang tidak jelas atau berpotensi konflik dengan dokumen ini, **tanyakan ke user dulu sebelum eksekusi**, terutama untuk: perubahan skema database, penambahan dependency baru, atau perubahan yang mempengaruhi keamanan/isolasi data antar organisasi.
