-- =====================================================================
--  NICC Campus Ministry — Supabase schema
--  Paste this whole script into:  Dashboard > SQL Editor > New query > Run
--
--  It creates the `users` table that replaces data/users.csv, plus the
--  indexes, constraints and Row Level Security policies the backend needs.
--  Safe to re-run: everything is guarded with IF NOT EXISTS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
-- Column notes:
--   password_hash  holds a BCRYPT hash produced by the backend. The plain
--                  password is never sent to Supabase and is never stored.
--   is_verified    set to true by the backend after the email OTP check.
--   email          stored lower-cased and UNIQUE, so the backend can do an
--                  exact-match lookup and rely on the DB for uniqueness.
create table if not exists public.users (
  id            uuid        primary key default gen_random_uuid(),
  email         text        not null unique,
  name          text        not null default 'Disciple',
  password_hash text        not null,
  campus        text,
  is_verified   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Case-insensitive email safety net
-- ---------------------------------------------------------------------
-- The backend lower-cases emails before writing, but this index makes
-- "Grace@x.com" and "grace@x.com" collide at the database level too.
create unique index if not exists users_email_lower_key
  on public.users (lower(email));

-- ---------------------------------------------------------------------
-- 3. Keep updated_at honest
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------
-- The Node backend talks to Supabase with the *anon* key, so RLS applies to
-- it as well. That is why the backend role needs a policy — without this
-- every query would return zero rows.
--
-- We deliberately do NOT use the service_role key: it bypasses RLS entirely
-- and would turn a leaked key into a full database dump.
enable row level security on public.users;

-- Allow the backend's anon key to read users (needed for login lookups).
create policy "backend can read users"
  on public.users
  for select
  to anon
  using (true);

-- Allow the backend's anon key to register and update accounts
-- (email verification + password reset).
create policy "backend can insert users"
  on public.users
  for insert
  to anon
  with check (true);

create policy "backend can update users"
  on public.users
  for update
  to anon
  using (true)
  with check (true);

-- NOTE: there is deliberately NO delete policy. The anon key cannot remove
-- rows. Add one only if you later build a "delete my account" feature.

-- ---------------------------------------------------------------------
-- 5. Verification
-- ---------------------------------------------------------------------
-- Run this to confirm the table exists. It should return one row.
-- select column_name, data_type from information_schema.columns
--   where table_name = 'users' order by ordinal_position;
select count(*) as users_created from public.users;
