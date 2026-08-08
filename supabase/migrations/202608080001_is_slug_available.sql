-- Migration: is_slug_available()
-- RPC untuk mengecek ketersediaan slug organisasi sebelum submit form.
-- Security definer: bisa baca semua organizations tanpa terbatas RLS
-- (RLS organizations hanya menampilkan org milik user yang login).
-- Eksekusi hanya untuk role authenticated.

create or replace function is_slug_available(slug text)
returns boolean
language sql
security definer
stable
as $$
  select not exists (
    select 1 from organizations
    where organizations.slug = is_slug_available.slug
  );
$$;

-- Supabase default privileges memberi EXECUTE langsung ke anon/authenticated/
-- service_role, jadi revoke dari PUBLIC saja tidak cukup.
revoke execute on function is_slug_available(text) from anon, public;
grant execute on function is_slug_available(text) to authenticated;
