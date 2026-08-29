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

-- The `state` column carries an ENVELOPE, not a bare document:
--   { "v": 1, "alg": "none", "payload": { ...the wardrobe document... } }
-- docs/35 commits Almari to end-to-end encrypted sync. Nothing here is
-- encrypted yet — alg 'none' means the payload is the document in the clear —
-- but the discriminator exists now so that the day encryption lands is a new
-- `alg` value rather than a migration run across live rows. Rows written
-- before the envelope carry the document bare; the client reads those as the
-- alg 'none' they always were, so no backfill is needed and none is done. No
-- CHECK constraint enforces the shape, precisely because those older rows are
-- valid and must stay valid.
comment on column public.wardrobes.state is
  'Envelope: {v, alg, payload}. alg ''none'' for alpha (plaintext payload). Rows predating the envelope hold the document bare and read as alg ''none''.';

-- Look up "my wardrobes" without scanning anyone else's.
create index if not exists wardrobes_user_id_idx on public.wardrobes (user_id);

-- ----------------------------------------------------------------------------
-- updated_at — stamped by the DATABASE on every write, whichever client wrote.
--
-- THE TRIGGER STAYS, and it now covers insert as well as update. The conflict
-- rule ("newer wins") is only as good as the clock on the row, and a clock
-- that any client could set is not a guarantee — a device whose system time
-- runs fast would stamp a row into the future and win every comparison until
-- real time caught up. One clock, in one place, settles that: whatever a
-- client proposes, this is what the row carries.
--
-- The client's half of the bargain (src/lib/sync.ts): it reads the stamp back
-- off the returned row and records THAT in its sync meta, rather than filing
-- away the time it proposed. Before, the two disagreed by construction — the
-- trigger overwrote what the client had already written down — and the sync
-- meta held a time no row had ever carried.
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
  before insert or update on public.wardrobes
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

-- ============================================================================
-- USAGE_EVENTS — the alpha usage record's one table.
--
-- PLAN.md non-negotiable #1 ("no telemetry") was amended by owner direction
-- on 2026-08-28 to admit exactly this, for the alpha and only for the alpha:
-- an OPT-IN record of a closed, numbers-and-enums vocabulary of product
-- events, never wardrobe content. src/lib/usage.ts is the contract this
-- table exists to receive, and supabase/functions/usage/index.ts is the only
-- thing that is ever allowed to write to it — every row here has already
-- passed that function's vocabulary allowlist and per-event property-shape
-- check, so a row's mere existence is itself evidence it was validated.
--
-- THIS TABLE IS NOT PART OF THE LOSSLESS-EXPORT PROMISE. Non-negotiable #7
-- ("lossless export, permanently") is a promise about the WARDROBE — pieces,
-- outfits, wear logs, the wishlist, settings — the record a person built.
-- Nothing here is that. A row in usage_events describes an app's behaviour on
-- one device, not a garment anyone owns, and it is written down under an
-- install id specifically because it does not need to survive the way a
-- wardrobe does: a tester who withdraws consent can have every row naming
-- their install id deleted on request (eraseUsage() in src/lib/usage.ts,
-- called from Settings on revoke), no export, no backup, no appeal — and
-- that is by design, not an oversight. Losing this table costs nobody a
-- single worn garment.
-- ============================================================================
create table if not exists public.usage_events (
  id bigserial primary key,
  -- Text, not uuid: the client mints crypto.randomUUID() where the browser
  -- offers it, but usage.ts's mintInstallId() falls back to a hand-built
  -- opaque string on old browsers and insecure origins, and that fallback is
  -- not valid uuid syntax. A uuid column would reject exactly the devices
  -- this fallback exists to still serve.
  install_id text not null,
  name text not null,
  -- THE VOCABULARY, AGAIN, A THIRD TIME. src/lib/usage.ts's EVENT_NAMES
  -- union is the source of truth; supabase/functions/usage/index.ts keeps
  -- its own hand-synced copy and is the only writer this table has; this
  -- CHECK is the belt to that function's braces — the same redundancy the
  -- relay's clamps and this project's RLS already practice everywhere else,
  -- so that a bug in the function's logic (not a malicious request — the
  -- function is the only writer, RLS blocks every other route to INSERT)
  -- still cannot land a row this table itself does not recognise. Extending
  -- the vocabulary means updating THREE places — this constraint,
  -- EVENT_NAMES in usage.ts, and EVENT_NAMES in the edge function — and
  -- scripts/test-usage.mjs is what notices if any one of them is missed.
  constraint usage_events_name_known check (name in (
    'app_opened', 'wardrobe_created', 'piece_added', 'wear_logged',
    'outfit_created', 'screen_viewed', 'intake_run', 'cutout_run',
    'export_taken', 'tutorial_step', 'write_refused', 'error_raised',
    'sync_attempted', 'session_ended'
  )),
  -- The device's own clock, ms since epoch on the client, stored here as the
  -- moment it actually happened rather than the moment it was flushed —
  -- `received_at` below is that second clock, and the two can differ by as
  -- much as the buffer's dwell time (a batch flushed on visibilitychange
  -- after a long session can be minutes to hours behind the request itself).
  at timestamptz not null,
  -- Never null in practice (every EVENT_SCHEMAS entry has at least one key),
  -- but nullable in the schema rather than constrained, because the shape of
  -- what may be IN here is the edge function's job, checked once per field
  -- against a schema that varies by event name — not something one CHECK on
  -- this column could express, and duplicating it here in SQL would be a
  -- fourth copy of the same rules with its own chance to drift.
  props jsonb,
  -- The app's own version string, so a report can be tied to a build. Free
  -- text in SHAPE, but not user-authored: see the matching comment beside
  -- RawPayload in supabase/functions/usage/index.ts for why this one string
  -- is allowed to be a string at all.
  build text,
  received_at timestamptz not null default now()
);

comment on table public.usage_events is
  'The alpha usage record. NOT covered by the lossless-export promise (that is the wardrobe''s promise, not this table''s) — a tester can have every row naming their install id dropped on request, no export, no appeal.';

-- Look up "every row for this install id" — the read a revoke's DELETE runs,
-- and the only read this table is ever asked to answer.
create index if not exists usage_events_install_id_idx on public.usage_events (install_id);

-- ============================================================================
-- ROW-LEVEL SECURITY — usage_events. NO POLICIES AT ALL, and that is the point.
--
-- THIS TABLE HAD AN `anon INSERT ... with check (true)` POLICY AND IT WAS A
-- HOLE. The reasoning that produced it was sound in isolation — the app posts
-- events, so the app's key must be able to insert them — and it was wrong about
-- one fact: the app does NOT post events with the anon key. It posts them to
-- the edge function (supabase/functions/usage/index.ts), which builds its
-- client with SUPABASE_SERVICE_ROLE_KEY and therefore bypasses RLS entirely.
-- Nothing in this system has ever needed an anon policy here.
--
-- What the policy DID do: the publishable anon key is compiled into the app
-- bundle (src/lib/supabase.ts) because that is what a publishable key is for.
-- With `with check (true)` anyone holding it — which is anyone who opens the
-- site and views source — could INSERT rows directly, bypassing all six of the
-- function's clamps: the body cap, the event cap, the vocabulary allowlist, the
-- per-event property-shape check, the origin check and the rate limit. `props`
-- is unconstrained jsonb, so arbitrary free text could be written into the one
-- table this whole feature promises contains no free text. The CHECK constraint
-- on `name` was the only surviving guard.
--
-- The comment that used to stand here claimed "the function is the only writer,
-- RLS blocks every other route to INSERT" — three lines above the policy that
-- was the other route. It is a good illustration of why a comment asserting a
-- security property is worth less than the property being true: the sentence
-- was written in good faith and was false the moment it was saved.
--
-- So: RLS is enabled and NO policy is created. With RLS on and no permissive
-- policy for an operation, that operation is refused outright for anon and for
-- authenticated, on every operation. The service role, which is the only writer
-- and the only reader, is unaffected because it bypasses RLS by definition.
-- ============================================================================
alter table public.usage_events enable row level security;

-- Dropped, never re-created. If a later change genuinely needs an anon writer,
-- it needs a `with check` that constrains the row — not `true`.
drop policy if exists usage_events_insert_anon on public.usage_events;

-- No select/update/delete policy is created for anon or authenticated at
-- all — with RLS enabled and no permissive policy for an operation, that
-- operation is refused outright. The portal (and this table's only DELETE
-- path, the edge function) reads and deletes through the service role,
-- which RLS never restricts.

-- ============================================================================
-- Done. To verify usage_events, as the ANON role in the SQL editor — every one
-- of these must be REFUSED, and a success is the hole reopening:
--
--   insert into public.usage_events (install_id, name, at, props)
--     values ('test', 'app_opened', now(), '{"cold":true,"standalone":false}');
--   -- refused: "new row violates row-level security policy"
--   select * from public.usage_events;
--   -- refused: no policy grants anon a read
--   delete from public.usage_events;
--   -- refused: no policy grants anon a delete
--
-- The real end-to-end check is the FUNCTION, which holds the service role and
-- is the only writer. See step 6 of supabase/README-SETUP.md: POST an honest
-- event and expect {stored:1}, then DELETE it back out and expect {erased:1}.
-- ============================================================================
