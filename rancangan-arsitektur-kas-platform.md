# Rancangan Arsitektur — Platform Kas Organisasi (Multi-Tenant)

**Versi:** 1.0
**Tujuan:** Dokumen ini jadi acuan teknis lengkap untuk membangun platform pencatatan kas (RT, organisasi, dll) yang multi-tenant, mobile-friendly, dan gratis untuk dioperasikan. Bisa dikerjakan langsung dari sini sampai selesai (MVP → production).

---

## 1. Ringkasan Produk

Aplikasi web untuk mencatat transaksi keuangan (kas masuk/keluar) yang bisa dipakai oleh **banyak organisasi berbeda** dalam satu aplikasi yang sama, dengan data yang **terisolasi penuh** antar organisasi.

Contoh pemakaian:
- User A adalah bendahara RT 05 → punya "organisasi" bernama "RT 05 Kelurahan X"
- User B (istri) adalah bendahara organisasi arisan/PKK → punya organisasi lain
- User C (teman) bendahara organisasi lain lagi
- Semua login ke aplikasi yang sama, tapi masing-masing hanya melihat data organisasinya sendiri
- Satu user bisa juga jadi anggota di lebih dari satu organisasi (role-based)

### Fitur MVP (harus ada)
1. Auth (register, login, logout, reset password)
2. Buat organisasi baru + undang anggota (bendahara/admin/viewer)
3. Catat transaksi (pemasukan/pengeluaran) dengan kategori, tanggal, nominal, catatan, bukti foto (opsional)
4. Lihat saldo kas real-time
5. Riwayat transaksi (filter by tanggal, kategori, jenis)
6. Laporan bulanan (ringkasan saldo awal, masuk/keluar/saldo akhir — kumulatif antar bulan)
7. Multi-organisasi switcher (pindah antar organisasi tanpa logout)
8. Mobile-friendly (responsive, terasa seperti app di HP)

> **Status saat ini:** seluruh fitur MVP sudah selesai dan live di production.

### Fitur lanjutan (fase 2+)
- Export laporan ke PDF/Excel
- Approval flow (misal: pengeluaran > nominal tertentu perlu approval ketua)
- Grafik tren kas (chart)
- Notifikasi (email/push) saat ada transaksi besar
- Multi-currency (kalau perlu)

### Tambahan yang sudah dikerjakan (di luar MVP, atas permintaan user)
- **PWA installable** (manifest + service worker, Add to Home Screen)
- **Tema per-akun**: 5 tema (Klasik, Kawaii, Ocean, Forest, Sunrise), pilihan tersimpan di `auth.users.user_metadata.theme` dan ikut user di semua perangkat
- **Navigasi desktop** (`DesktopNav`, baris kedua header) sebagai pelengkap `BottomNav` mobile
- **Logo brand** KasKita (dari file logo user) untuk header, auth, dan ikon PWA/favicon

---

## 2. Tech Stack

| Layer | Teknologi | Fungsi |
|---|---|---|
| Database | **Supabase (Postgres)** | Simpan semua data, dengan Row Level Security (RLS) untuk isolasi tenant |
| Auth | **Supabase Auth** | Login/register/session management |
| File storage | **Supabase Storage** | Simpan bukti foto transaksi |
| Backend/API | **Next.js (App Router) Route Handlers** | Business logic, validasi, komunikasi ke Supabase |
| Frontend | **Next.js + React + Tailwind CSS** | UI, mobile-first responsive |
| Hosting | **Vercel** | Deploy frontend + backend sekaligus |
| Version control | **GitHub** | Source code, CI/CD trigger ke Vercel |
| Komponen UI | **shadcn/ui** | Komponen siap pakai, ringan, gampang di-custom |

Kenapa kombinasi ini: semuanya gratis di skala kecil-menengah, Postgres relasional cocok untuk data keuangan, RLS Supabase membuat isolasi tenant terjamin di level database (bukan cuma di kode), dan Next.js + Vercel deploy-nya satu langkah dari push ke GitHub.

---

## 3. Konsep Multi-Tenancy

Pola yang dipakai: **shared database, isolasi via `organization_id` + Row Level Security (RLS)**.

Artinya:
- Satu database Postgres dipakai bersama oleh semua organisasi
- Setiap tabel data (transaksi, kategori, dll) punya kolom `organization_id`
- Supabase RLS policy memastikan: query apa pun yang dijalankan user, otomatis difilter hanya menampilkan baris yang `organization_id`-nya sesuai dengan organisasi yang sedang diakses user tersebut
- Ini di-enforce di level database, jadi walaupun ada bug di kode frontend/backend, user tidak akan bisa "tembus" lihat data organisasi lain

### Role per organisasi
Setiap user yang jadi anggota organisasi punya salah satu role:
- **owner** — pembuat organisasi, akses penuh, bisa hapus organisasi, kelola anggota
- **treasurer** (bendahara) — bisa catat/edit/hapus transaksi, lihat laporan
- **viewer** — hanya bisa lihat laporan & riwayat, tidak bisa edit apa-apa

---

## 4. Skema Database (Postgres / Supabase)

> **Catatan:** blok SQL di bawah dan section 5 adalah ringkasan/ilustrasi. **Sumber kebenaran (source of truth) skema, RLS policy, dan trigger yang sudah dijalankan adalah `03-database-migration.sql`** — jangan mengedit file itu; perubahan di masa depan memakai migration file baru.

```sql
-- =========================================
-- 1. ORGANIZATIONS
-- =========================================
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- "RT 05 Kelurahan Sukamaju"
  slug text unique not null,             -- "rt-05-sukamaju" (untuk URL)
  description text,
  currency text default 'IDR',
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================
-- 2. ORGANIZATION MEMBERS (relasi user <-> org + role)
-- =========================================
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'treasurer', 'viewer')),
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  unique (organization_id, user_id)
);

-- =========================================
-- 3. CATEGORIES (kategori transaksi, per organisasi biar fleksibel)
-- =========================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,                    -- "Iuran Warga", "Kebersihan", "Keamanan"
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz default now()
);

-- =========================================
-- 4. TRANSACTIONS
-- =========================================
create table transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  category_id uuid references categories(id),
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  transaction_date date not null default current_date,
  receipt_url text,                      -- link ke foto bukti di Supabase Storage
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================
-- 5. INVITATIONS (undang anggota baru via email)
-- =========================================
create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('owner', 'treasurer', 'viewer')),
  invited_by uuid references auth.users(id) not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  token uuid default gen_random_uuid(),
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

-- Index untuk performa query yang sering dipakai
create index idx_transactions_org_date on transactions(organization_id, transaction_date desc);
create index idx_members_user on organization_members(user_id);
create index idx_members_org on organization_members(organization_id);
```

---

## 5. Row Level Security (RLS) Policies

Aktifkan RLS di semua tabel data, lalu buat policy berbasis keanggotaan organisasi.

```sql
-- Aktifkan RLS
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table invitations enable row level security;

-- Helper function: cek apakah user adalah anggota organisasi tertentu
create or replace function is_org_member(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Helper function: cek role user di organisasi tertentu
create or replace function get_org_role(org_id uuid)
returns text as $$
  select role from organization_members
  where organization_id = org_id and user_id = auth.uid()
  limit 1;
$$ language sql security definer stable;

-- ORGANIZATIONS: user hanya lihat org yang dia anggotai
create policy "select_own_orgs" on organizations
  for select using (is_org_member(id));

create policy "insert_org" on organizations
  for insert with check (created_by = auth.uid());

create policy "update_org_owner_only" on organizations
  for update using (get_org_role(id) = 'owner');

-- ORGANIZATION_MEMBERS: hanya bisa lihat anggota di org yang sama
create policy "select_members_same_org" on organization_members
  for select using (is_org_member(organization_id));

create policy "insert_member_owner_only" on organization_members
  for insert with check (get_org_role(organization_id) = 'owner');

-- CATEGORIES: semua anggota bisa lihat, owner/treasurer bisa edit
create policy "select_categories" on categories
  for select using (is_org_member(organization_id));

create policy "insert_categories" on categories
  for insert with check (get_org_role(organization_id) in ('owner', 'treasurer'));

-- TRANSACTIONS: semua anggota bisa lihat, owner/treasurer bisa CRUD
create policy "select_transactions" on transactions
  for select using (is_org_member(organization_id));

create policy "insert_transactions" on transactions
  for insert with check (get_org_role(organization_id) in ('owner', 'treasurer'));

create policy "update_transactions" on transactions
  for update using (get_org_role(organization_id) in ('owner', 'treasurer'));

create policy "delete_transactions" on transactions
  for delete using (get_org_role(organization_id) in ('owner', 'treasurer'));

-- INVITATIONS: hanya owner yang bisa kelola undangan
create policy "manage_invitations" on invitations
  for all using (get_org_role(organization_id) = 'owner');
```

> Prinsip pentingnya: **jangan pernah filter `organization_id` hanya di kode frontend/backend**. RLS di atas jadi jaring pengaman terakhir — walau ada bug di aplikasi, database tetap menolak akses data lintas-organisasi.

---

## 6. Alur Autentikasi & Multi-Tenant Switching

1. User register/login via Supabase Auth (email + password, atau magic link)
2. Setelah login, aplikasi query `organization_members` untuk ambil daftar organisasi milik user
3. Jika user cuma punya 1 organisasi → langsung masuk ke dashboard organisasi itu
4. Jika punya lebih dari 1 → tampilkan **organization switcher** (dropdown di navbar) untuk pilih organisasi aktif
5. Organisasi aktif disimpan di **state aplikasi** (React context) + query param URL, misal: `/org/rt-05-sukamaju/dashboard`
6. Setiap request ke Supabase otomatis dibatasi oleh RLS berdasarkan token auth user, jadi walau organisasi aktif ganti-ganti, data tetap aman

---

## 6.5 Strategi Email (Undangan Anggota)

Tidak butuh domain sendiri untuk mulai. Pendekatan bertahap:

**Tahap 1 (MVP, mulai sekarang):** pakai SMTP bawaan Supabase Auth (`supabase.auth.admin.inviteUserByEmail()`), tanpa konfigurasi tambahan. Limit: 2 email/jam — cukup untuk skala awal (undang istri, teman, beberapa anggota organisasi).

**Tahap 2 (kalau limit mulai kerasa):** aktifkan custom SMTP di Supabase Dashboard → Authentication → Email Settings, arahkan ke **Brevo** (free tier 300 email/hari, permanen gratis, tidak wajib domain sendiri untuk mulai). Ini murni ganti konfigurasi, tidak ada perubahan kode di aplikasi.

**Tahap 3 (opsional, kalau sudah mapan):** beli domain kecil, verifikasi di provider SMTP (Brevo/Resend) supaya email datang dari alamat sendiri (`noreply@namaplatform.com`), bukan alamat generik provider.

> Keputusan ini tidak mengunci arsitektur — kode aplikasi tidak perlu tahu provider SMTP apa yang dipakai, karena semua diatur di level konfigurasi Supabase Auth.

---

## 7. Arsitektur Aplikasi (Next.js App Router)

```
kaskita/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                  # logo + theme picker (fixed kanan atas)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── update-password/page.tsx    # wajib ganti password (akun manual)
│   │   └── auth-code-error/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # wrapper dasar (min-h-dvh)
│   │   ├── onboarding/page.tsx         # buat organisasi pertama
│   │   └── org/[slug]/
│   │       ├── layout.tsx              # header (logo, nama org, org switcher, theme picker, logout)
│   │       │                           # + DesktopNav (md+) + BottomNav (mobile); cek membership → 403
│   │       ├── loading.tsx             # skeleton loading saat pindah menu (Suspense)
│   │       ├── dashboard/page.tsx      # ringkasan saldo saat ini, bulan berjalan (saldo awal/akhir), transaksi terbaru
│   │       ├── transactions/page.tsx   # list + filter + form dialog
│   │       ├── categories/page.tsx     # kelola kategori (dialog)
│   │       ├── reports/page.tsx        # laporan bulanan (filter bulan/tahun + per kategori)
│   │       ├── members/page.tsx        # kelola anggota (owner only)
│   │       └── settings/page.tsx       # pengaturan organisasi
│   ├── invite/accept/page.tsx          # landing terima undangan
│   ├── api/                            # HANYA untuk logic ber-privilege (service_role)
│   │   ├── invitations/route.ts        # undang via email + daftarkan anggota manual
│   │   ├── invitations/accept/route.ts # validasi token + expires_at
│   │   └── members/route.ts            # ubah role / hapus anggota
│   ├── layout.tsx                      # font Baloo 2, theme-init script, PWA manifest, theme color
│   └── page.tsx                        # redirect: login / org pertama / onboarding
├── components/
│   ├── ui/                             # shadcn/ui components
│   ├── bottom-nav.tsx                  # navigasi bawah (mobile)
│   ├── desktop-nav.tsx                 # navigasi atas (desktop, md+)
│   ├── nav-link-icon.tsx               # spinner loading link nav (useLinkStatus)
│   ├── org-switcher.tsx                # pindah antar organisasi
│   ├── brand-logo.tsx                  # logo dari public/logo.png
│   ├── theme-picker.tsx                # dropdown 5 tema (simpan ke user_metadata)
│   ├── theme-setter.tsx                # sinkron data-theme dari server ke <html>
│   ├── transactions-view.tsx / transaction-form-dialog.tsx
│   ├── categories-view.tsx / category-form-dialog.tsx
│   ├── reports-view.tsx
│   ├── members-view.tsx / create-member-dialog.tsx / invite-member-dialog.tsx
│   ├── create-organization-form.tsx
│   ├── logout-button.tsx / forbidden.tsx / service-worker-register.tsx
│   └── invite-accept-view.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # supabase client (browser)
│   │   ├── server.ts                   # supabase client (server component)
│   │   └── middleware.ts               # helper updateSession
│   ├── types.ts                        # TypeScript types + zod schema dari DB
│   ├── utils.ts / api-helpers.ts / auth-errors.ts
├── proxy.ts                            # Next 16: pengganti middleware.ts — proteksi route, refresh session
└── supabase/
    └── migrations/                     # SQL migration files (03-database-migration.sql)
```

**Catatan penting:** karena RLS sudah menangani keamanan data di level database, sebagian besar operasi CRUD **bisa langsung dari client-side** memakai Supabase JS client tanpa perlu bikin API route sendiri. API route (`app/api/...`) dipakai untuk logic yang butuh privilege khusus, misal generate PDF, kirim email undangan, atau proses yang melibatkan Supabase service role key.

---

## 8. Desain Mobile-Friendly

Karena target pengguna (bendahara RT, ibu-ibu PKK, dll) kemungkinan besar akses dari HP, prioritaskan **mobile-first**, bukan cuma "responsive belakangan".

### Prinsip UI
- Layout mobile-first: desain dari lebar 375px dulu, baru scale up ke tablet/desktop pakai Tailwind breakpoint (`sm:`, `md:`, `lg:`)
- **Bottom navigation bar di mobile** (bukan sidebar) — tab: Dashboard, Transaksi, Kategori, Laporan, Anggota, Pengaturan, **Keluar**. Di desktop (`md+`), nav yang sama tampil sebagai **baris kedua di header** (`DesktopNav`). Bottom nav fixed di bawah: konten `<main>` wajib punya padding bawah `pb-[calc(5rem+env(safe-area-inset-bottom))]` (desktop `md:pb-6`) supaya card/tombol terakhir tidak tertutup; nav sendiri pakai `pb-[env(safe-area-inset-bottom)]` agar tidak tertutup home indicator iPhone
- **Tema per-akun**: 5 tema (`data-theme` = `klasik`, `kawaii`, `ocean`, `forest`, `sunrise`) didefinisikan sebagai CSS variables di `app/globals.css`; pilihan user disimpan di `auth.users.user_metadata.theme` dan disinkronkan ke `<html data-theme>` via `ThemeSetter` (dari server) / `ThemePicker` (saat user ganti); head script anti-flash membaca localStorage
- Form input besar & mudah di-tap (minimum touch target 44x44px)
- Angka nominal pakai keyboard numerik otomatis (`inputMode="numeric"`)
- Card-based layout untuk list transaksi (bukan tabel sempit yang harus di-scroll horizontal)
- Font minimal 16px di form (supaya tidak auto-zoom di Safari iOS)
- **Feedback loading**: semua aksi menampilkan indikator — spinner tombol (`Loader2` + `disabled`), skeleton konten (`loading.tsx`), spinner di link nav (`useLinkStatus`) — supaya tidak ada jeda tanpa tanda; tombol login/register bertahan loading sampai halaman tujuan siap

### PWA
Sudah terpasang: `manifest` (Next.js) + service worker (`public/sw.js`) + ikon 192/512 — bisa di-"Add to Home Screen". Tidak perlu publish ke Play Store/App Store; tetap gratis di Vercel.

**Strategi cache SW (penting, jangan diubah tanpa alasan kuat):** hanya aset statis ber-hash (`/_next/static/`) yang di-cache-first; request navigasi network-first (fallback ke cache offline); request **data/API/RSC HARUS network-only** (jangan cache-first) — pernah ada bug data basi (anggota/kategori tak muncul setelah refresh) karena semua GET di-cache. GET API yang mengembalikan data wajib set header `Cache-Control: no-store`.

---

## 9. Tahapan Pengerjaan (Roadmap)

### Fase 0 — Setup (1 hari)
- [x] Buat project Supabase, catat URL + anon key
- [x] Buat repo GitHub
- [x] Init Next.js project + Tailwind + shadcn/ui
- [x] Connect repo ke Vercel (auto-deploy dari branch `main`)
- [x] Jalankan SQL schema + RLS policies di Supabase SQL editor

### Fase 1 — Auth & Onboarding (2-3 hari)
- [x] Halaman login/register pakai Supabase Auth
- [x] Proxy (middleware) proteksi route (redirect ke login kalau belum auth)
- [x] Flow buat organisasi pertama kali (onboarding)
- [x] Organization switcher

### Fase 2 — Core Feature: Transaksi (3-4 hari)
- [x] Form tambah transaksi (income/expense) + kategori
- [x] List transaksi dengan filter (tanggal, kategori, jenis)
- [x] Edit & hapus transaksi
- [ ] Upload bukti foto ke Supabase Storage  *(belum dikerjakan — opsional)*
- [x] Kartu ringkasan saldo di dashboard

### Fase 3 — Laporan (2-3 hari)
- [x] Laporan bulanan (saldo awal kumulatif, total masuk, keluar, saldo akhir kumulatif)
- [ ] Grafik tren sederhana (pakai Recharts)  *(belum dikerjakan)*
- [ ] Export laporan (PDF/Excel) — fase 2+  *(belum dikerjakan)*

### Fase 4 — Kelola Anggota (2 hari)
- [x] Undang anggota via email (invitation table + Supabase Auth built-in invite, lihat strategi email di section 6.5)
- [x] Kelola role anggota (owner only)

### Fase 5 — Mobile Polish & PWA (2 hari)
- [x] Audit semua halaman di viewport mobile
- [x] Bottom nav, touch target, numeric keyboard
- [x] Setup manifest.json + service worker dasar

### Fase 6 — Testing & Deploy Production
- [x] Test isolasi data antar organisasi (bikin 2 akun uji, pastikan tidak bisa saling lihat)
- [x] Test role-based access (viewer tidak bisa edit, dll)
- [x] Deploy final ke Vercel production
- [ ] Setup custom domain (opsional, kalau punya domain sendiri)

**Estimasi total: ~2-3 minggu kerja santai (di luar jam kerja utama), atau ~1 minggu kalau fokus penuh.**

---

## 10. Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx...   # hanya dipakai di server-side, JANGAN expose ke client
```

Set variabel yang sama di **Vercel → Project Settings → Environment Variables** untuk production.

---

## 11. Checklist Keamanan

- [x] RLS aktif di **semua** tabel yang menyimpan data organisasi
- [x] `service_role` key Supabase **tidak pernah** dipakai di client-side/browser
- [x] Validasi input di form (nominal harus > 0, tanggal valid, dll) - baik di frontend maupun via constraint database (`check` di SQL sudah membantu)
- [x] Test manual: login sebagai 2 user berbeda di 2 organisasi berbeda, pastikan tidak bisa saling akses data
- [x] Invitation token punya masa berlaku (`expires_at` + 7 hari; divalidasi di `app/api/invitations/accept/route.ts`)
- [ ] Rate limiting dasar untuk endpoint sensitif (Vercel/Supabase biasanya sudah handle di level infra, tapi bisa ditambah kalau perlu)

---

## 12. Estimasi Biaya Jangka Panjang

Untuk skala pemakaian: beberapa organisasi kecil (RT, arisan, komunitas), total user aktif di bawah ratusan, transaksi ribuan per tahun — **seluruh stack ini tetap berada di free tier** (Supabase Free, Vercel Hobby, GitHub Free). Kalau suatu saat berkembang jadi puluhan organisasi dengan ratusan user aktif tiap hari, baru perlu evaluasi upgrade ke Supabase Pro (~$25/bulan).

---

## 13. Status Eksekusi

Dokumen ini awalnya dipakai sebagai acuan build dari nol; saat ini **seluruh MVP sudah selesai dan live di production** (Vercel). Item yang belum dikerjakan dan sengaja dibiarkan (opsional): export laporan PDF/Excel, grafik tren (Recharts), upload bukti foto, custom domain, approval flow, notifikasi otomatis, multi-currency.

Perubahan yang sudah disetujui user setelah MVP tercatat di section 1 (PWA, tema per-akun, DesktopNav, logo brand). Skema & RLS yang benar-benar berjalan ada di `03-database-migration.sql` — file itu sudah dijalankan dan **tidak boleh diedit**; perubahan skema berikutnya memakai migration file baru.

> Estimasi pengerjaan awal: ~2-3 minggu kerja santai / ~1 minggu fokus penuh.
