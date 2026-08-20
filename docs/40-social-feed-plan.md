# 40 — The social feed: plan of record

> **Status:** plan of record · **Written:** 2026-08-19 · **Squad:** SYNTHESIS,
> reconciling four squad files from the 2026-08-19 wave (architecture, UI/UX,
> marketing, research; the advisor-wave file was not produced — noted in §9).
> **Binding on everything below:** `.claude/skills/toile-social/SKILL.md`,
> `.claude/skills/wardrobe-brand/SKILL.md`, `PLAN.md` as amended 2026-08-18,
> the owner decisions of 2026-08-19 (`docs/35`), and the lossless-export law.
> **Companions:** `docs/38` (the Look Book, design of record for `/feed`),
> `docs/39` (the Index, the friend graph, the N-phases).
>
> **The override, recorded plainly.** On 2026-08-19 the owner overrode
> `docs/39`'s Part A direction: where docs/39 recommended against a global
> Explore of public accounts and against story mechanics, the owner has
> directed an Instagram-familiar feed — home feed, global explore, stories —
> built inside the house's laws. docs/39 is not erased: its analysis of what
> that surface costs (contracts, moderation, hosting, encryption) remains the
> evidence base of this plan, its graph and directory designs are adopted
> whole, and its recommendation stands in the record as the road not taken.
> The override itself still needs its countersignature — Decision D3 below.

---

## 0. Verdict

**Build the Instagram-familiar surface out of grammar, not metrics.** The
familiarity people recognize in Instagram is a stories rail, a card feed, a
browsable grid, a tap-through viewer — none of which is a like count. Almari
ships all of that grammar and none of the counting: no likes, no followers
counts, no view counts, no "seen by", no ranking. The current alpha ships
entirely local — a beautified feed, a view-only stories rail, `/explore` over
the device's own shared store plus bundled buffer content — for zero dollars
and zero new permissions beyond two owner calls on naming and buffer imagery.
The backend phases (F1 real network, F2 story uploads, F3 ranking-and-scale)
are designed in full below, each behind a written gate, because a gate needs a
real design behind it for the owner to accept or refuse.

The numbered decisions:

1. **Home feed stays reverse-chronological, entire.** Friends and followed
   accounts only, never strangers, never suggestions. That is toile-social 3
   complied with, not worked around.
2. **`/explore` ships now, local-only.** Same visibility set as the feed
   (`postVisibleTo`), rearranged as a grid with search and chips. The global
   version (public accounts) is F1, behind the D3 amendment.
3. **Stories ship now as a view-only rail** computed from fresh posts —
   nothing written, nothing expiring from storage, no seen-state, no
   migration. Uploaded 24-hour stories are F2, behind the F1 gate held.
4. **Buffer content stays local forever.** Personas are bundled, labelled
   `sample wardrobe`, and never uploaded. The CC0 commons set is admitted as
   labelled interludes on Explore only, behind Decision D7.
5. **No public counts, at any phase.** Several are made impossible to compute
   by the select policies, which is the stronger guarantee than unrendered.
6. **Ranking does not ship.** The explainable boost formula is documented in
   §5 as ordered, priced, and left OFF with the squad's recommendation to
   refuse it standing (D1).
7. **Moderation is designed before the first stranger's photograph**, not
   after: report enum, takedown tombstones, a named person, statutory duties
   acknowledged in the gate text (D5).
8. **Costs:** current alpha $0; F1 $25/mo; 5,000 users ~$40–80/mo
   infrastructure plus a human moderation cost that is the real line (§7).

**Phase letters, disambiguated.** `docs/38` owns F1–F4 for the Look Book
build (shipped). The phases below are this document's; a cross-reference
should write **docs/40 F1**. The architecture squad's S-series maps as:
current alpha ≈ S0, F1 ≈ S1+S2 (photos, graph, follows, global explore),
F2 ≈ S3 (stories), F3 = the gated ranking plus moderation at scale.

---

## 1. The reconciled design

### 1.1 The three planes (unchanged)

A byte lives on exactly one plane, and the line never moves:

| Plane | Contents | Where |
|---|---|---|
| **Private** | pieces, wear log, costs, CPW, ledger, calendar, wishlist, taxonomy, notes, closet photographs, saved posts, search queries | device localStorage only |
| **Synced** | the wardrobe document, whole | `public.wardrobes`, owner-only RLS; E2E encryption the committed target (docs/35 decision 2) |
| **Shared** | posts, stories, the listing, graph edges — each the product of an explicit publish action | the tables and buckets of §2 |

A byte crosses from private to shared only inside a publish action, always as
a **snapshot copy** (toile-social 4), never a reference; its audience is fixed
at write time by the row's `scope`. No foreign key, join, or trigger connects
`posts`/`stories` to `wardrobes` — the shared plane cannot reach the synced
plane even in SQL. Sample wardrobes never list, never post, never upload.
Nothing about reading ever leaves the device: no view events, no query
logging, no impression counters.

### 1.2 Home feed — following + friends, nothing else

- **Membership:** `mine ∪ friends(accepted) ∪ followed(listed, public posts
  only) − blocked-pairs`. Never strangers, never "because you looked at".
- **Order:** reverse-chronological, `(created_at desc, id desc)`. That is the
  whole algorithm. Even under a ranking amendment a friend-boost is a no-op
  here — everyone in the room is already a friend — which is the quiet
  argument that home stays pure reverse-chron forever.
- **The feed ends.** A finite feed with an explicit caught-up line (the
  BeReal pattern, §8 citations 1 and 5). Buffer content is never paginated
  infinitely to simulate abundance.
- **Query shape:** fan-out-on-read. Fetch my edge ids (a handful of rows,
  RLS-scoped), then one keyset page over `posts_author_created_idx`, limit
  30, cursor `(created_at, id)` via a `security invoker` RPC so RLS applies.
  Holds to hundreds of friends per viewer and thousands of users total;
  fan-out-on-write earns its complexity around 100k users, not 5k.
- **Client cache:** IndexedDB (`almari-feed`) for rows — never localStorage,
  whose 5MB belongs to the wardrobe and community blobs; service-worker Cache
  Storage for images with **cache key = URL pathname, signature query
  stripped** (signed URLs rotate per mint; the object path is the identity);
  LRU cap 50MB; outbox drained on `online` for offline publishes, the proven
  `enqueuePush`/`drainQueue` shape reimplemented, not shared.
- **The UI** is the UI/UX squad's build-ready spec (scratchpad
  `feed-uiux.md`, adopted whole as the implementing spec): `PostCard`
  extracted to `src/components/social.tsx`, verbs row (Ask after it ·
  Attach — the four verbs placed where they can be true, Lend staying in the
  conversation), en-IN dates, no counts anywhere, one primary button per
  view. Its three doctrine rulings are ratified here: story openings are
  eyelets holding monograms (never a photo cropped into a circle), no
  seen/unseen ring state exists, and Explore is a grid with `items-start`,
  not true masonry, so rows still read newest-first.

### 1.3 Global `/explore` — public accounts (F1, gated)

- The grid over posts whose `scope = 'public'` by authors whose profile is
  `listed`. Both flags are separate opt-ins, off by default, **conjoined in
  the select policy**: listing yourself does not publish your posts; a public
  post from an unlisted author shows nowhere. Unlisting is a real withdrawal.
- **Order:** the day's shuffle — a deterministic permutation seeded by
  `date + viewerId` using the FNV/mulberry family already in
  `src/lib/feedEngine.ts:25-36`, hero (newest post) pinned, chip rail as the
  whole personalization story. No ranking. Search returns standing order.
- **What Explore is not:** no suggested accounts, no "people you may know",
  no trending, no counts of any kind. The friendship and follow select
  policies make follower counts impossible to compute from the client.
- **In the current alpha,** `/explore` ships local-only: the exact same
  resolved `entries` as the feed (`resolveFeedEntries`, shared helper so the
  two pages cannot drift), searched and chip-filtered per the UI/UX spec.
  Consent stays structural — Explore is a rearrangement of the feed, not a
  wider aperture.

### 1.4 Stories — including the upload path

**Current alpha (view-only rail).** A post joins the rail iff it passes the
same validity + `postVisibleTo` filter the feed runs and is under 24 hours
old. One slot per author, "Yours" first, then authors by newest qualifying
post; within an author the viewer plays oldest to newest. Rail slots are
eyelets with monograms; every eyelet wears the same hairline (no unread
state); the viewer is a full-screen route (`/story/:accountId`) with progress
hairlines, tap zones, 5s auto-advance, reduced-motion honored. Nothing is
written, nothing is recorded, nothing expires from storage — after 24 hours
only the rail forgets; the feed remembers. **Zero AppState/CommunityState
change, therefore zero migration.** If seen-state is ever wanted, the
migration case lands in `scripts/test-migrate.mjs` FIRST.

**F2 (uploaded stories, 24h).** One image per story — no video at any phase
this document covers; video multiplies egress by ~20x and moderation by
more — optional 140-char caption, scope `friends` or `public`, born with
`expires_at = created_at + interval '24 hours'`.

The upload path, both for story media and (at F1) post photos:

1. The person picks the photograph inside the publish flow — never a
   background sync of closet photos; publish is the only door.
2. The client re-encodes on-canvas to WebP, long edge ≤ 2048px, quality
   ~0.82 — which strips EXIF whole, GPS included. Target ≈ 200–400KB; hard
   client cap 1.5MB, mirrored by the bucket's `file_size_limit` so the client
   cap is a courtesy, not the lock.
3. Upload to the private bucket at `<auth.uid()>/<uuid>.webp` — the insert
   policy refuses any path outside the uploader's own folder.
4. Then, and only then, insert the row referencing the path. A row pointing
   at a missing object renders the `GarmentPlate` fallback; an orphaned
   object is swept monthly.
5. Offline: the publish queues in an IndexedDB outbox, drained on `online`.

Expiry is enforced three ways, in order of authority: (1) **RLS** — the
select policy carries `expires_at > now()`, so an expired story is unreadable
the second it expires; (2) **signed-URL TTL** — story media URLs are minted
for `min(60 minutes, seconds until expires_at)`; (3) **the sweeper** —
hourly hygiene deleting expired rows and objects; if it misses a run, rule 1
already held the line. The honest sentence the UI must carry: expiry deletes
the copy on the account; it cannot recall a screenshot. The promise is "gone
from here after a day", which is true.

Banned and staying banned, named so a ticket cannot add them: "seen by"
lists, view counts, story reply streaks, unread-ring counts. The way to keep
"seen by" banned is for the `story_views` table not to exist. Replies, if
ever wanted, route into the existing conversation plane as an ordinary
message — no new mechanic.

### 1.5 Buffer content — bundled, local, labelled

- **Personas (live today).** `src/lib/feedEngine.ts` derives each installed
  persona's posting schedule deterministically; `mergeSchedule` keeps the
  store warm, idempotent, and pruned. Bundled in the build, merged
  client-side, interleaved reverse-chron, every card labelled **sample
  wardrobe** (docs/35 decision 3). **Never uploaded** — a server row asserts
  a person; personas are not people, and mixing sample bytes into the shared
  plane would make every later count, quota, and moderation decision partly
  fictional. Zero storage, zero egress, zero moderation, works offline.
- **The CC0 commons set (Decision D7).** The researcher verified 43 CC0
  images (animals, plants) and 2 short CC0 videos, licenses confirmed
  per-file (§8, Job 1). If admitted, they ship as **labelled interludes on
  Explore only**: downloaded and re-encoded to WebP at build time into
  `public/commons/` (never hotlinked — a runtime request to a third-party
  host is a usage beacon, and the offline-first assertion in
  `scripts/test-demo.mjs` must keep holding), total build weight ≤ 1.5MB,
  each card carrying a quiet `from the commons` label and its credit,
  ratio-capped at 1-in-6 with never two non-real cards adjacent while real
  cards remain (research rules 3–4). Never fake social proof, never counts,
  never in the home Look Book — the home feed is wardrobes only. Attribution
  is not legally required for CC0; ship the credits anyway — house manners.
- **Persona stories** (a deterministic "today's look" ring per persona, same
  hash family) are a cheap optional garnish once the rail exists — one
  evaluation line, not a commitment.

### 1.6 The graph (adopted from docs/39 §A5, unchanged)

Friendships are mutual, by knock and answer: knock / let them in / staying
home / remove / block, one row per pair via the `least/greatest` unique
index, `security definer` helpers, block as one transaction
(`block_account`). No friends-of-friends traversal exists — the select policy
shows only edges you stand in, so "N mutual friends" and every
people-you-may-know derivative are impossible to compute, not merely
unrendered. Follows (F1) are one-directional and quiet: toward listed
profiles only, never across a block, granting visibility of public posts in
the home feed and nothing else; either end may sever; no count is ever
rendered. Pre-acceptance, a knock shows tag-with-monogram, name, handle, one
line, city if given — and the sentence "Nothing of yours is shown until you
let them in", which is true of the implementation because the posts policy
resolves through accepted edges alone.

---

## 2. The Supabase backend

Idempotent style throughout, matching `supabase/setup.sql` (drop policy
before create). Nothing here has been applied; every block is a proposal that
lands in `supabase/setup.sql` only at its phase's gate. §2.1–§2.3 restate
docs/39 §A4–§A5 so this file stands alone.

### 2.1 profiles — the directory (Decision D4)

```sql
alter table public.profiles
  add column if not exists listed     boolean not null default false,
  add column if not exists city       text,
  add column if not exists tagline    text,
  add column if not exists monogram   text,
  add column if not exists mark_color text;

drop policy if exists profiles_select_listed on public.profiles;
create policy profiles_select_listed on public.profiles
  for select to authenticated          -- `to authenticated` is load-bearing:
  using (listed or auth.uid() = id);   -- the anon key must not walk the directory

create index if not exists profiles_handle_prefix_idx
  on public.profiles (lower(handle) text_pattern_ops) where listed;
```

Existing owner-only insert/update/delete policies stand unchanged. A listed
profile is **published** — every field on it is public to any signed-in
person, the toggle copy says so, and there is no "searchable but private"
tier (docs/39 §A11.6).

### 2.2 friendships + blocks

```sql
create table if not exists public.friendships (
  requester   uuid not null references auth.users on delete cascade,
  addressee   uuid not null references auth.users on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending','accepted','declined')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table if not exists public.blocks (
  blocker    uuid not null references auth.users on delete cascade,
  blocked    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

alter table public.friendships enable row level security;
alter table public.blocks      enable row level security;

drop policy if exists friendships_select_mine on public.friendships;
create policy friendships_select_mine on public.friendships
  for select to authenticated
  using (auth.uid() in (requester, addressee));

drop policy if exists friendships_insert_mine on public.friendships;
create policy friendships_insert_mine on public.friendships
  for insert to authenticated
  with check (
    auth.uid() = requester
    and status = 'pending'
    and not public.is_blocked_between(auth.uid(), addressee)
  );

drop policy if exists friendships_update_answer on public.friendships;
create policy friendships_update_answer on public.friendships
  for update to authenticated
  using (auth.uid() = addressee)
  with check (auth.uid() = addressee and status in ('accepted','declined'));

drop policy if exists friendships_delete_mine on public.friendships;
create policy friendships_delete_mine on public.friendships
  for delete to authenticated
  using (
    auth.uid() = addressee
    or (auth.uid() = requester and status <> 'declined')
  );

drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks
  for all to authenticated
  using (auth.uid() = blocker) with check (auth.uid() = blocker);
```

The delete policy's exception is the anti-re-knock rule: a declined edge can
be cleared only by the decliner, or the requester deletes the refusal and
knocks again, forever.

### 2.3 The helpers — security definer, search_path pinned

A policy subquery against an RLS'd table sees nothing; these run as definer,
do one thing, and are `stable`:

```sql
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester, addressee)    = least(a, b)
      and greatest(requester, addressee) = greatest(a, b)
  );
$$;

-- block_account(uuid): one transaction — delete the friendship edge and any
-- follows in both directions, insert the block. An RPC so no client can
-- leave a half state.
```

### 2.4 posts

```sql
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null references auth.users on delete cascade,
  scope      text not null check (scope in ('friends','public')),
  caption    text check (char_length(caption) <= 280),
  look       jsonb not null,   -- SNAPSHOT: name, occasion, piece names/categories/colors.
                               -- No FK anywhere. Never joined to wardrobes.
  photo_path text,             -- null until F1; storage path under author's folder
  created_at timestamptz not null default now()
);

create index if not exists posts_author_created_idx
  on public.posts (author, created_at desc, id desc);
create index if not exists posts_public_created_idx
  on public.posts (created_at desc, id desc) where scope = 'public';
create index if not exists posts_photo_path_idx on public.posts (photo_path);

alter table public.posts enable row level security;

-- READ: yours; or friends-scoped through an accepted edge; or public by a
-- LISTED author (both flags, conjoined — unlisting really withdraws).
-- Blocks veto everything. Fail-closed: an unknown scope matches no arm.
drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts
  for select to authenticated
  using (
    author = auth.uid()
    or (
      not public.is_blocked_between(auth.uid(), author)
      and (
        (scope = 'friends' and public.are_friends(auth.uid(), author))
        or (scope = 'public' and exists (
              select 1 from public.profiles p
              where p.id = author and p.listed))
      )
    )
  );

-- WRITE: your own rows only; public scope only if listed; a photo path may
-- only sit under your own folder.
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (
    author = auth.uid()
    and (scope <> 'public' or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.listed))
    and (photo_path is null
         or photo_path like auth.uid()::text || '/%')
  );

-- NO update policy, deliberately. A post is a dated statement; it does not
-- rewrite. Fix a mistake by taking it off.
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts
  for delete to authenticated
  using (author = auth.uid());

-- Quota trigger (abuse control, rendered nowhere):
create or replace function public.enforce_post_quota()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if (select count(*) from public.posts
      where author = new.author
        and created_at > now() - interval '1 day') >= 8 then
    raise exception 'daily post quota reached';
  end if;
  return new;
end;
$$;
drop trigger if exists posts_quota on public.posts;
create trigger posts_quota before insert on public.posts
  for each row execute function public.enforce_post_quota();
```

### 2.5 stories (F2)

```sql
create table if not exists public.stories (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null references auth.users on delete cascade,
  scope      text not null check (scope in ('friends','public')),
  caption    text check (char_length(caption) <= 140),
  media_path text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index if not exists stories_author_live_idx
  on public.stories (author, expires_at);
create index if not exists stories_expiry_idx on public.stories (expires_at);

alter table public.stories enable row level security;

-- Expiry lives IN the read policy: authority #1 of §1.4.
drop policy if exists stories_select_visible on public.stories;
create policy stories_select_visible on public.stories
  for select to authenticated
  using (
    expires_at > now()
    and (
      author = auth.uid()
      or (
        not public.is_blocked_between(auth.uid(), author)
        and (
          (scope = 'friends' and public.are_friends(auth.uid(), author))
          or (scope = 'public' and exists (
                select 1 from public.profiles p
                where p.id = author and p.listed))
        )
      )
    )
  );

drop policy if exists stories_insert_own on public.stories;
create policy stories_insert_own on public.stories
  for insert to authenticated
  with check (
    author = auth.uid()
    and media_path like auth.uid()::text || '/%'
    and (scope <> 'public' or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.listed))
  );

drop policy if exists stories_delete_own on public.stories;
create policy stories_delete_own on public.stories
  for delete to authenticated
  using (author = auth.uid());

-- No update. No story_views table, ever — "seen by" is banned, and the way
-- to keep it banned is for the table not to exist.

-- The sweeper (hygiene; RLS is the enforcement). pg_cron, hourly:
--   select cron.schedule('stories-sweep', '17 * * * *', $$ ... $$);
-- Objects first (rows still name the paths), then rows:
--   delete from storage.objects where bucket_id = 'story-media'
--     and name in (select media_path from public.stories where expires_at < now());
--   delete from public.stories where expires_at < now();
-- If pg_cron is unavailable on the plan, an Edge Function on a schedule with
-- the service key does the same two deletes through the storage API.
```

Stories per day: 8, by a trigger of the same shape as `enforce_post_quota`.

### 2.6 follows (F1)

```sql
create table if not exists public.follows (
  follower   uuid not null references auth.users on delete cascade,
  followed   uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followed),
  check (follower <> followed)
);

alter table public.follows enable row level security;

-- You see only edges you stand in. Nobody computes anyone else's counts.
drop policy if exists follows_select_mine on public.follows;
create policy follows_select_mine on public.follows
  for select to authenticated
  using (auth.uid() in (follower, followed));

-- Follow only a LISTED account, never across a block.
drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows
  for insert to authenticated
  with check (
    auth.uid() = follower
    and not public.is_blocked_between(auth.uid(), followed)
    and exists (select 1 from public.profiles p
                where p.id = followed and p.listed)
  );

-- Either end may sever: unfollow, or remove a follower.
drop policy if exists follows_delete_either on public.follows;
create policy follows_delete_either on public.follows
  for delete to authenticated
  using (auth.uid() in (follower, followed));
```

### 2.7 reports + takedowns

```sql
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter     uuid not null references auth.users on delete cascade,
  subject_kind text not null check (subject_kind in ('post','story','profile')),
  subject_id   uuid not null,
  reason       text not null check (reason in
               ('not-theirs','not-clothes','targets-a-person','unlawful')),
  note         text check (char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

alter table public.reports enable row level security;

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated with check (reporter = auth.uid());

drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select to authenticated using (reporter = auth.uid());
-- Resolution: service role only (the named person, in Studio). No
-- update/delete policy for authenticated — a filed report cannot be edited
-- or unfiled.

create table if not exists public.takedowns (
  subject_kind text not null,
  subject_id   uuid not null,
  reason       text,
  taken_at     timestamptz not null default now(),
  primary key (subject_kind, subject_id)
);
alter table public.takedowns enable row level security;
-- No policies: service-role only. A ledger, not a surface.
```

### 2.8 Storage — buckets and object policies

Two private buckets (never `public: true` — takedown must kill links, and
unguessable paths are not access control). Path convention:
`<auth.uid()>/<post-or-story-uuid>.webp`; the first folder segment being the
owner's uid is what every storage policy keys on.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('look-photos', 'look-photos', false, 1572864, array['image/webp','image/jpeg']),
  ('story-media', 'story-media', false, 1572864, array['image/webp','image/jpeg'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload only into your own folder, only into these buckets.
drop policy if exists media_insert_own on storage.objects;
create policy media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('look-photos','story-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read (which is also the right to mint a signed URL): your own objects, or
-- an object some visible row points at. The posts/stories subqueries run as
-- the requesting user, so §2.4/§2.5's select policies do the deciding —
-- object visibility IS post visibility, by construction.
drop policy if exists media_select_visible on storage.objects;
create policy media_select_visible on storage.objects
  for select to authenticated
  using (
    (bucket_id = 'look-photos' and (
       (storage.foldername(name))[1] = auth.uid()::text
       or exists (select 1 from public.posts p where p.photo_path = name)))
    or
    (bucket_id = 'story-media' and (
       (storage.foldername(name))[1] = auth.uid()::text
       or exists (select 1 from public.stories s where s.media_path = name)))
  );

-- Delete your own objects (take a post off; the sweeper and takedowns use
-- the service role and bypass RLS).
drop policy if exists media_delete_own on storage.objects;
create policy media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('look-photos','story-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

**Signed URLs.** Private buckets serve through signed URLs minted client-side
(`createSignedUrls`, batched per feed page — one round trip per page, not per
image). Minting requires select permission on the object, so the select
policy *is* the access control; the URL is just the ticket it prints. TTL:
7 days for post photos (long enough for the service-worker cache to be
useful), `min(60 min, remaining life)` for story media. Takedown kills access
in ≤ TTL even for URLs already in the wild; for posts the object is deleted
outright so the URL 404s immediately.

### 2.9 Caps and quotas

| Thing | Cap | Enforced by |
|---|---|---|
| Photo size | 1.5MB post-encode | client + bucket `file_size_limit` |
| Photos per post | 1 (the look's one 4:5 frame) | posts schema (single `photo_path`) |
| Posts per day | 8 | trigger `enforce_post_quota` |
| Stories per day | 8 | trigger, same shape |
| Storage per user | 250MB (≈ an alpha-year of posting) | nightly usage check; publish refused with a plain sentence when over |
| Caption | 280 chars (posts), 140 (stories) | schema `check` |

Quota counts are server-side abuse controls. They render in no UI, feed no
badge, and are not metrics in the banned sense — said here so the line is
drawn before someone draws a progress bar.

### 2.10 Moderation and the report path

The duty arrives with the first stranger's photograph, so it is designed
before F1, not after:

- **Report:** every post/story/profile card carries "Report this" in its
  overflow → a `reports` row (§2.7). Reporter sees their own filings and
  nothing else.
- **Review:** alpha scale — the named person (Decision D5), in Supabase
  Studio, service role. At 5,000 users this is a human-hours cost line, not a
  compute one.
- **Takedown:** delete the storage object (URL dies now), delete the row,
  record a `takedowns` tombstone so the act is a ledger entry — mirrors
  `removedPostIds`' resurrect-proofing locally.
- **Legal fact, named plainly:** hosting user-uploaded images carries
  statutory duties (CSAM reporting among them) that exist regardless of
  scale. Friends-only audiences reduce exposure, not obligation. This goes in
  the F1 gate text for the owner, not in fine print.

### 2.11 Verification

`supabase/test-rls.sql` (docs/39's hand-run transcript) extends with: B reads
A's friends-post through an accepted edge (1 row) and after a block (0 rows);
C reads it (0 rows); an expired story reads as 0 rows for everyone including
its author; B cannot insert into A's storage folder; B cannot mint a signed
URL for media whose post is scoped away from them; unlisting A drops A's
public posts from B's read when B is not a friend. Cannot run in CI — no
live-project harness — run by hand on every change to the file, output pasted
into the report.

---

## 3. What ships in the CURRENT alpha

All local, no backend, no new tables, no migration. The UI/UX squad's spec is
the implementing document; `wardrobe-brand` and `toile-social` are loaded
before any file is touched.

1. **Beautified feed UI.** `PostCard` extracted to `social.tsx` with the
   verbs row (Ask after it on piece posts, Attach on all — wired through
   `location.state` into the existing Chats composer), `shortDate` flipped to
   en-IN (`"9 Aug"`), spacing and tokens per the spec's tables. No counts of
   any kind.
2. **View-only stories rail + viewer.** "On show in the last day" rail of
   monogram eyelets over `TagRail`; full-screen `/story/:accountId` viewer
   with progress hairlines, tap zones, reduced-motion handling. No
   seen-state, no writes, no expiry from storage.
3. **`/explore` over local + buffer content.** The grid, search
   (Closet-pattern boxed input), single-select chip rail, detail route
   `/explore/:postId`, nav entry in the More sheet (five mobile slots stay
   five). Same `postVisibleTo` set as the feed, always.
4. **CC0 buffer assets** — only if Decision D7 is signed: bundled, re-encoded,
   labelled interludes on Explore, 1-in-6 cap, credits shipped.
5. **Sample labelling everywhere** a buffer byte reaches: feed chip, explore
   `· SAMPLE` suffix, story-viewer chip, rail `aria-label`.

**Checks (red-proofed before landing):** rail membership boundary (23h59 in /
24h01 out; day-granular post in on its own day, out the next); en-IN date
shape; explore filter equals the `postVisibleTo` set (fixture includes a
`self`-scoped post whose caption is the query); sample suffix present; a
no-counts grep over the new files; `npx tsc --noEmit`; `check-brand` green.
Known seam: sample seeds carry past day-granular dates, so the demo rail may
render empty — if the owner wants it populated in demos,
`scripts/build-persona-data.mjs` stamps one recent `at` per sample wardrobe
(seed-builder squad; re-run builders + `test:demo`).

**Phases beyond the alpha** (each gate is written, or the phase does not
start):

**F1 — the real network: graph, follows, real posts, global Explore.**
Profiles directory (§2.1), friendships + blocks (§2.2–2.3), posts with
photos (§2.4), buckets + signed URLs (§2.8), quotas (§2.9),
reports/takedowns (§2.7, §2.10), follows (§2.6), the Out-there grid over
`public`+`listed`. *Gate:* Decisions D2, D3, D4, D5, D6 signed — the PLAN #1
second-job amendment, the written override of the three Explore bans, the
profiles RLS change, the named moderator with statutory duties acknowledged,
and the shared-plane encryption call made in the open. *Cost:* $25/mo.
An intermediate cut is available if the owner wants it: words-and-plates
friends posts first (photo_path null — docs/39 N4), photos after; the gate
text covers both.

**F2 — stories upload + 24h.** `stories` + bucket + sweeper (§2.5), TTL-capped
URLs, no seen-by ever; optional persona story rings. *Gate:* F1's gate held
for a while without incident, plus the sweeper verified live.

**F3 — ranking + moderation at scale.** The §5.2 formula behind a per-viewer
switch, default off — only on an explicit toile-social 3 amendment (Decision
D1; the squad's recorded advice is to refuse). Moderation staffing scales
with strangers; fan-out-on-write and Realtime are revisited here and not
before.

---

## 4. Hosting and backing costs

Estimates against Supabase's published tiers as read on 2026-08-19 (Free:
500MB DB / 1GB storage / 5GB egress; Pro $25/mo: 8GB DB / 100GB storage /
250GB egress; overages ≈ $0.021/GB-mo storage, $0.09/GB egress). Re-verify at
purchase; prices move. Working figures: photo ≈ 300KB after re-encode; a feed
page ≈ 30 rows ≈ up to 9MB of images cold, far less warm (SW cache). docs/39's
structural cost analysis (what photos, moderation, and encryption actually
cost this house) remains the evidence base under these numbers.

**Alpha, 15–50 users:**

| Line | Arithmetic | Verdict |
|---|---|---|
| Current alpha as scoped (§3: local + buffer, no backend) | KB-scale localStorage only | **$0** |
| F1 rows (posts+edges+profiles) | < 20MB total | noise |
| F1 storage | 50 × ~12 posts/mo × 0.3MB ≈ 180MB/mo growth | breaches free 1GB around month 5 |
| F1 egress | 50 × ~3–5MB fresh media/day × 30 ≈ 4.5–7.5GB/mo after cache | brushes the free 5GB ceiling |
| **F1 total** | | **$25/mo Pro, ~20x headroom** |

**5,000 users (~1,500 DAU):**

| Line | Arithmetic | $/mo |
|---|---|---|
| Pro base | — | 25 |
| Storage | 5k × 12 × 0.3MB ≈ 18GB/mo growth → ~220GB by month 12; (220−100) × $0.021 | ~2.5, climbing |
| Egress | 1.5k DAU × ~8MB/day × 30 ≈ 360GB; (360−250) × $0.09 | ~10, spiky |
| Compute headroom (query load is index scans) | small Pro instance holds | 0–15 |
| **Infrastructure total** | | **~$40–80/mo** |
| **Moderation** | reports at 5k users are human-hours, not compute | **the real cost line — a person, not a plan** |

Dominant lever at both scales: the client-side WebP re-encode and the SW
cache — media egress is 90%+ of every bill. No-video is a cost decision as
much as a scope one. Auth MAU sits far inside Pro's included tier at both
scales.

---

## 5. The ranking, explainable

### 5.1 What ships: no ranking

Home: reverse-chronological, `(created_at desc, id desc)`, entire. Explore
browse: the day's shuffle, hero pinned — order without judgement; the hash
sees ids and a date, and nothing about a post, its author, or its popularity
(there is no popularity) can move it. Search: standing order
(`newestFirst`). Buffer interleaving obeys the diversity caps of §1.5 — an
arrangement rule for sample content, not a ranking of people's posts. This is
toile-social 3 complied with, not worked around.

### 5.2 The boost formula, as ordered — documented, OFF, gated behind D1

Designed to be the least objectionable member of its banned species; if the
owner ever amends toile-social 3, this is the only shape worth considering.
It is the researcher's three signal families (interest, recency, affinity —
Mosseri, §8 citation 2) reduced to fixed, additive, on-device time-credits:

```
effective_at(post, viewer) = post.created_at + boost(post, viewer)

boost = min(360 minutes, sum of whichever apply):
  +240 min   are_friends(viewer, author)                 -> card line "Raised: a friend's look"
  +120 min   a pass or conversation between viewer and   -> "Raised: you two have talked cloth"
             author in the viewer's LOCAL store, last 14d
  +60  min   post.look.occasion matches an event on the  -> "Raised: you have one of these coming"
             viewer's OWN calendar in the next 7 days

order by effective_at desc, id desc
```

Explainable rather than algorithmic-in-the-bad-sense because: additive fixed
time-credits only — a boost means "counts as posted N hours later than it
was", nothing multiplicative, no decay curves; capped at 6h so a day never
reorders across days; computed entirely on the viewer's device from the post
plus data the viewer already owns — zero signals sent, deterministic,
unit-testable as a pure function; and every boosted card renders its reason
in one mono line, so the explanation is shown, not merely available.

### 5.3 The standing recommendation: refuse it

Even this formula is a ranking; toile-social 3 bans ranking of any kind, and
docs/39 §A7 already rejected a gentler on-device affinity with reasons that
have not aged a day — it answers a question nobody asked and narrows what a
person sees toward what they already have. The friend boost is a no-op on
home (all friends), and on Explore it quietly rebuilds the two-tier room.
The chip rail delivers the same power honestly, as questions the user asks.
Ship §5.1; keep §5.2 as the priced alternative for the owner's call (D1).

---

## 6. OWNER DECISIONS

> ─────────────────────────────────────────────────────────────────────────
>
> **Every standing-contract amendment this plan needs, boxed for signature.
> Each decision carries a recommendation and a stated default — the default
> is what happens if the owner says nothing. No phase whose gate is listed
> here starts before its decision is signed in this section, by edit, with a
> date.**
>
> **D1 — toile-social 3: the no-metrics, no-ranking law.**
> The plan keeps NO public counts at every phase — no likes, followers,
> views, "seen by", or mutual counts; several are made impossible to compute
> by the select policies. Instagram-familiarity is delivered by grammar
> (stories rail, card feed, explore grid, tap-through viewer, follows), not
> by metrics — the two are separable, and this plan is the proof by
> construction. An amendment to toile-social 3 is needed ONLY if the §5.2
> boost formula ever ships.
> *Recommendation:* leave the law intact; refuse the formula (§5.3).
> *Default:* no amendment; reverse-chron + day's shuffle ship; §5.2 never
> ships.
>
> **D2 — PLAN.md #1: the second-job amendment.**
> The account's admitted job is carrying a synced wardrobe copy. A
> directory listing, a friend graph, follows, posts, and stories are further
> jobs. Adopt docs/39 §A9's amendment text, extended to name posts, stories,
> and follows: all opt-in, all off by default, nothing about a wardrobe's
> contents admitted with them, telemetry and social counts staying banned.
> Non-negotiables #2 (no commerce), #3 (no shame), #5, #6 are untouched by
> this plan; #7 is untouched because no AppState changes ship (§3).
> *Recommendation:* adopt the extended amendment at the F1 gate.
> *Default:* only §3 (the local current alpha) ships; F1–F3 do not start.
>
> **D3 — the Explore override, in writing.**
> A global Explore of strangers is refused by three standing documents:
> docs/12 (no discovery), docs/38 §5 (banned list), docs/39 §A11.1. The
> owner overrode that direction on 2026-08-19; this plan records the
> override, but an override of written contracts must itself be written —
> one amendment naming all three, acknowledging the moderation duty that
> arrives with strangers' photographs (§2.10).
> *Recommendation:* sign it at the F1 gate together with D5, not before.
> *Default:* `/explore` stays local-only (§3) indefinitely; the Out-there
> grid does not ship.
>
> **D4 — the profiles RLS change: a searchable directory.**
> §2.1 changes `profiles` from owner-only-readable to
> `listed or auth.uid() = id`, `to authenticated`, plus the listing columns.
> A listed profile is published — every field public to any signed-in
> person; there is no "searchable but private" tier and the toggle copy says
> so. Listing stays off by default, per person, never per wardrobe.
> *Recommendation:* adopt as written at the F1 gate.
> *Default:* profiles stay unreadable to others; no directory, no follows,
> no public posts (their policies conjoin on `listed`).
>
> **D5 — who moderates.**
> Photographs from strangers make the owner responsible for other people's
> images, with statutory duties (CSAM reporting among them) that exist
> regardless of scale. Alpha: the named person is the owner, reviewing
> `reports` in Supabase Studio on a stated cadence (weekly minimum), with
> the takedown path of §2.10. At 5,000 users this is a budgeted
> human-hours line or the scale does not happen.
> *Recommendation:* the owner signs as the named person at the F1 gate and
> names a deputy before any growth push past the alpha cohort.
> *Default:* no named person, no F1 — the gate text requires one.
>
> **D6 — the shared-plane encryption call.**
> docs/35 decision 2 (E2E) covers the synced wardrobe only. A post shared to
> friends is readable by others by definition and cannot ride the wardrobe
> key. At F1 shared photos sit plaintext at rest on the server, and Settings
> must say so in one plain sentence at the publish switch; per-recipient
> sealed-box encryption (public key on the profile) is the later option,
> with real cost. Shipping plaintext silently would spend the trust decision
> 2 was bought to protect.
> *Recommendation:* accept plaintext-at-rest for the shared plane at F1 with
> the plain sentence shipped; re-evaluate sealed-box before F2.
> *Default:* no photos upload; F1 ships words-and-plates posts only
> (photo_path null) until this call is made.
>
> **D7 — the CC0 commons interludes.** *(amended 2026-08-19 to match what
> shipped; countersign covers both surfaces or names the trim)*
> Non-wardrobe imagery (animals, plants) enters the app for the first time:
> bundled and re-encoded (never hotlinked), labelled `from the commons` with
> credits, 1-in-6 ratio cap on Explore, never two non-real cards adjacent,
> no fake social proof, no counts.
> **What shipped on the owner's brief ("use that as buffer feed"), ahead of
> this signature:** (a) the commons ALSO holds one "Guests" slot at the end
> of the home stories rail — never a card in the home feed itself, and the
> story viewer treats the guest deck as an island (a walk through real
> wardrobes ends at the feed; the rail slot is the only door in); (b) the
> shipped build weight is 1.85MiB against this plan's 1.5MB cap — dropping
> one webm and a few images lands under the cap if the owner prefers the cap
> to the fuller set.
> *Recommendation:* countersign both as shipped — the slot is labelled, the
> island holds, and 1.85MiB lazy-loaded is honest weight for an alpha; or
> name the trim and the home slot comes off in one small change.
> *Default:* as shipped, pending the countersign.
>
> **D8 — the names.**
> The decisions of record say "the Look Book" for `/feed` (docs/38 §2.1) and
> "the Index" at `/find` (docs/39 §A2), refusing "Explore" as
> platform-speak. The owner's override asks for Instagram-familiar surfaces,
> and the UI/UX spec is built on route `/explore`, masthead "Explore".
> Marketing's proposals stand on the record: "The Index" for the lookup
> room, "The Airing" for the stories feature when F2 ships (ephemerality
> inside the metaphor — an airing ends by nature, no countdown chrome).
> *Recommendation:* route `/explore` with masthead "Explore" ships now, per
> the override; "the Look Book" stays the feed's name per docs/38; "The
> Airing" is adopted as the F2 feature name at its gate; the rail label
> stays the contract-clean "On show in the last day".
> *Default:* the recommendation — the UI/UX spec is build-ready as written.
>
> ─────────────────────────────────────────────────────────────────────────

---

## 7. Research citations

From the researcher's report of 2026-08-19 (scratchpad `research-feed.md`);
each shaped a rule in this plan.

1. **Finite, calm feeds:** Eyal, *Hooked* ch. 3 via
   appcues.com/blog/variable-rewards; BeReal usage study,
   arxiv.org/html/2408.02883v1 → the feed ends with a caught-up line; buffer
   content never paginates infinitely (§1.2).
2. **Instagram's three ranking families:** Mosseri, "Shedding More Light on
   How Instagram Works"
   (about.instagram.com/blog/announcements/shedding-more-light-on-how-instagram-works);
   Medvedev, "Powered by AI: Instagram's Explore recommender system"
   (instagram-engineering.com/powered-by-ai-instagrams-explore-recommender-system-7ca901d2a882)
   → the §5.2 formula's three terms, reduced to fixed on-device credits.
3. **Two-stage retrieval + source diversity:** Medvedev, above; Meta
   Engineering 2023
   (engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)
   → the interleaving caps of §1.5: never two buffer cards adjacent while
   real cards remain.
4. **Labelled buffer content:** house law (docs/35 decision 3) plus research
   rule 4 → sample and commons labels on every surface a buffer byte reaches.
5. **Chronology as relief:** BeReal coverage,
   qz.com/bereal-is-the-social-media-app-for-people-who-hate-soci-1849353911;
   Mosseri, above → §5.1 ships reverse-chron as the feature, not the fallback.
6. **Visible like-counts harm:** *Personality and Individual Differences*
   (sciencedirect.com/science/article/pii/S0191886920307005); Project Daisy
   (techcrunch.com/2021/05/26/facebook-and-instagram-will-now-allow-users-to-hide-like-counts-on-posts/;
   shorensteincenter.org/resource/case-study-online-youth-harms-project-daisy)
   → no public counts at any phase; Instagram could only hide the metric its
   revenue is made of — Almari deletes it.
7. **One daily moment, calm technology:** ABC on BeReal
   (abc.net.au/news/2022-09-23/what-is-bereal-tiktok-rival-app-social-media-authentic/101453182);
   Amber Case (calmtech.com) → at most one quiet nudge a day, addressed to
   the clothes; no social push notifications (docs/33 veto stands).
8. **Streaks weaponize loss aversion:**
   justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature;
   apptitude.io/blog/how-duolingos-streak-mechanic-actually-works → no
   streaks, no broken chains, no countdowns, anywhere in this plan.
9. **Rewards of the self retain closet-app users:** Stylebook/Indyx/Whering
   comparisons (vestatheapp.com/blog/vesta-vs-indyx-whering-acloset;
   myindyx.com/versus/whering-vs-indyx) → cost-per-wear stays the quiet flex
   (marketing loop 1); no tribe metrics needed.
10. **Ephemerality lowers posting anxiety:** Mosseri, above → F2 stories are
    low-stakes by construction: nothing accrues on them, no residue of
    judgment collects.
11. **CC0 assets (Decision D7):** 43 images + 2 videos verified live on
    2026-08-19 via the Openverse API (license=cc0) and Wikimedia Commons
    (per-file `LicenseShortName == CC0`), HTTP 200 and image/video
    content-types confirmed, six visually inspected. The full manifest with
    URLs, authors, and source pages is the researcher's report; the JSON
    block at its foot is the build input for the D7 bundling step.

---

## 8. What this document does not do

- **It does not run anything.** Every SQL block is unapplied; `src/`,
  `supabase/`, `scripts/`, `app/` are untouched by this document.
- **It does not overrule docs/38 or docs/39's designs.** The Look Book,
  the graph, the directory, and the day's shuffle are adopted whole. Where
  the owner's override displaces docs/39's *recommendation*, the reasoning
  is preserved and the override is routed through D3 for signature.
- **It does not add a metric.** No counts render anywhere at any phase;
  several are impossible to compute by policy, which is the stronger
  guarantee.
- **It does not move the boundary.** Wardrobe data stays on the private and
  synced planes; only explicit, scoped, snapshot copies exist on the shared
  plane; no SQL object connects the two.
- **It does not change AppState.** The current alpha requires no migration;
  any future seen-state or collection feature lands its
  `scripts/test-migrate.mjs` case FIRST, per the lossless-export law.
- **It does not start a gated phase.** F1–F3 wait on the signatures in §6.

## 9. Provenance

Synthesized 2026-08-19 from: the architecture squad's shared-plane design
(scratchpad `feed-architecture.md` — tables, RLS, storage, costs, phasing),
the UI/UX squad's build-ready spec (`feed-uiux.md` — adopted as the
implementing document for §3), the marketing squad's positioning and naming
(`feed-marketing.md` — "The Airing", the growth loops, the ten attention
traps), and the researcher's rules and CC0 manifest (`research-feed.md`).
The advisor-wave file named in the brief (`advisor-wave.md`) was not present
in the scratchpad; noted here rather than silently skipped. This synthesis
squad's toolset carried no advisor tool and no subagent spawner, so the
CLAUDE.md advisor consult could not be run on this document — flagged per the
discipline. Scratchpad files are session-bound; everything this plan depends
on is restated here so the plan stands alone.

*Recorded by the SYNTHESIS squad, 2026-08-19. §6's decisions are owner
calls; everything else stands or falls on the reasons written above.*
