-- ============================================================================
-- ALMARI — one-time database setup for the optional account + sync.
--
-- What this builds:
--   public.profiles   one row per signed-in person (display name, handle)
--   public.wardrobes  one row per SYNCED wardrobe, holding its whole state
--
-- The protection model, in one paragraph: the app ships with the project's
-- publishable anon key in its code, which is what that key is FOR. The lock
-- is row-level security: every policy below says a person can only ever
-- read, write, or delete rows they own (auth.uid() = the row's owner).
--
-- This file is IDEMPOTENT — run it as many times as you like. Paste it into
-- the Supabase SQL editor and run it once per project.
-- ============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+; on Supabase nothing needs
-- enabling. No extensions are required for this schema.

-- ----------------------------------------------------------------------------
-- PROFILES — the little the account knows about a person.
-- id IS the auth user id: one profile per user, gone when the user is gone.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  handle text unique,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per signed-in person. Kept minimal on purpose: the app is a wardrobe record, not a social graph.';

-- ----------------------------------------------------------------------------
-- WARDROBES — one row per wardrobe whose owner chose "synced to my account".
-- `state` is the whole wardrobe document as JSONB: pieces, outfits, wear
-- logs, wishlist, settings. Alpha sync is last-writer-wins at this row's
-- granularity; `updated_at` is the clock it is judged by.
-- ----------------------------------------------------------------------------
create table if not exists public.wardrobes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.wardrobes is
  'Whole-wardrobe sync documents. The local record on the device is the original; this is the copy that makes a second device possible.';

-- Look up "my wardrobes" without scanning anyone else's.
create index if not exists wardrobes_user_id_idx on public.wardrobes (user_id);

-- ----------------------------------------------------------------------------
-- updated_at — stamped on every write, no matter which client wrote it.
-- The app stamps it too; the trigger is the guarantee that no writer can
-- forget, because the conflict rule ("newer wins") is only as good as the
-- clock on the row.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wardrobes_set_updated_at on public.wardrobes;
create trigger wardrobes_set_updated_at
  before update on public.wardrobes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW-LEVEL SECURITY — the actual lock. Owner-only, every operation.
-- Policies are dropped before creation so re-running this file never errors.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.wardrobes enable row level security;

-- ---- profiles: you can only ever see and change your own row ----

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete using (auth.uid() = id);

-- ---- wardrobes: you can only ever touch rows your user_id owns ----

drop policy if exists wardrobes_select_own on public.wardrobes;
create policy wardrobes_select_own on public.wardrobes
  for select using (auth.uid() = user_id);

drop policy if exists wardrobes_insert_own on public.wardrobes;
create policy wardrobes_insert_own on public.wardrobes
  for insert with check (auth.uid() = user_id);

drop policy if exists wardrobes_update_own on public.wardrobes;
create policy wardrobes_update_own on public.wardrobes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists wardrobes_delete_own on public.wardrobes;
create policy wardrobes_delete_own on public.wardrobes
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- Done. To verify: with a signed-in session from the app,
--   select * from public.wardrobes;   -- shows only your own rows
-- and in the SQL editor as the anon role, everything is refused.
-- ============================================================================
