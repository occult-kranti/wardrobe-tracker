# 39 — The Index, the friend graph, and the calendar question

> **Status:** design record · **Written:** 2026-08-19 · **Squad:** PLAN, one
> document, no code. **Binding on everything below:**
> `.claude/skills/toile-social/SKILL.md` (the four verbs, snapshot consent, no
> metrics), `.claude/skills/wardrobe-brand/SKILL.md` (tokens, radius 2, the copy
> law), `PLAN.md`'s seven non-negotiables as amended 2026-08-18, and the owner
> decisions of 2026-08-19 (`docs/35`). **Companions:** `docs/38` (the Look Book,
> the design of record for the feed), `docs/12` (why the feed has no discovery),
> `docs/13`, `docs/19` (households and their veto list), `docs/34` §3 (Supabase,
> and the E2E-sync gate), `docs/37` (the alpha kit).
>
> **The owner's direction, as received:** (A) an Instagram-Explore-style
> surface — browsable and searchable, searchable profiles, people adding each
> other as friends. (B) can Almari link with Google Calendar.

---

## 0. The two verdicts, before the reasoning

**Part A.** Ship the half that is honest and cheap: **search**, **a listed
handle**, and **a real friend graph with knock / accept / decline / remove /
block**. Recommend **against** an Explore grid of strangers' looks — it is
banned by three written contracts, it needs photo hosting Almari does not have,
and it makes a two-person alpha responsible for moderating other people's
photographs. The friends half delivers most of what was asked. The strangers
half delivers the part the house was built to refuse.

**Part B.** **Recommend against Google Calendar for the alpha.** No Expo Go
build can complete a Google OAuth flow, the read scope needs Google's
verification review, and the web half cannot refresh a token without putting a
tester's Google credential through the owner's server. Ship an `.ics` door
instead — outward first, inward second. Reopen the live link the day Almari
leaves Expo Go, and reopen it as **`expo-calendar` reading the device's own
calendars**, not as Google's API.

---

# PART A — The Index: search, listings, and friends

## A1. What the contracts already say

These are not preferences. They are the written law this design has to fit
inside, quoted so no phase can plead ignorance later.

`.claude/skills/toile-social/SKILL.md`, non-negotiable 3:

> **The feed is not a performance surface.** No likes, reactions, counts,
> followers, unread badges, "seen by", streaks, or ranking of any kind. Order is
> reverse-chronological and that is the whole algorithm. **Filters are the user
> asking a question; ranking is the app answering one they did not ask.**

Non-negotiable 4:

> **Shared looks are SNAPSHOTS**, captured at share time — name, photograph,
> piece names, occasion. Never read another wardrobe's store to render a feed
> row. This makes consent structural rather than a filter predicate one refactor
> away from leaking.

Non-negotiable 5:

> **Avatars are garment tags with a monogram.** Never a face, never a body.

Non-negotiable 8:

> **A declined request is a neutral fact.** The word is "Staying home". No red,
> no alarm styling.

`docs/12`, on the feed, listing what is absent *deliberately*: "likes,
reactions, counts, followers, **discovery**, algorithmic ranking, unread badges,
'seen by', streaks, share counts, and comments under a share."

`docs/38` §5, the banned list, restated there precisely because "a design
document is where banned things try to come back": "**Discovery feeds and
suggested-anything.** Public profiles of non-members. Ranking of people or
posts."

`PLAN.md` #1 as amended: the optional account "does one job only — keeping a
synced copy of a wardrobe's record on Supabase so a second device can open it."

**The consequence, said plainly.** An Instagram Explore — a ranked grid of
people you do not know — is not a feature this codebase is allowed to grow. A
**search box** is: the skill's own sentence sanctions it, because search is the
user asking a question. A **friend graph** is neither sanctioned nor banned; it
is outside what #1 admits, so it needs an amendment in the open (§A9). That
three-way split is the whole shape of Part A.

## A2. The reframe, and the room's name

Two rooms, not one.

- **The Look Book** (`/feed`, `docs/38`) stays exactly what it is: what has been
  put on show, newest first, no ranking.
- **The Index** (new, `/find`) is where you go to look something up. A book has
  an index; the Look Book is a book. One search field, two tabs — **Looks** and
  **Wardrobes** — and a chip rail of filters.

*Why not "Explore".* Same reason `docs/38` §2.1 refused to keep the word "Feed":
platform-speak promises a population. "Explore" promises a world of strangers
behind the tile. The Index promises a lookup, which is what it performs.

*Why the address is `/find` and not `/index`.* `/index` reads as a file on a web
server and will be typed wrong forever. `/find` is a verb and it is what the
button says. `ROUTES` gains `{ path: '/find', name: 'the index' }`; `known()`
needs no change (`src/lib/routes.ts:37-43`).

## A3. What is searchable with no server, and no telemetry — today

Everything in this section ships with **zero backend**. It is Phase N1.

**The corpus a device already holds:**

| Source | Fields | Where |
|---|---|---|
| The accounts registry | `name`, `handle`, `city`, `tagline` | `ACCOUNTS_KEY`, `src/lib/accounts.ts` |
| Shared posts | `caption`, `look.name`, `look.occasion`, `look.pieces[]`, `piece.name`, `piece.category`, `piece.color` | `community.posts` |
| Roofs | `Household.name` | `community.households` |
| Your own closet | every field the Closet search already reads | `src/pages/Closet.tsx:341` |

**What is not in the corpus, and can never be put in it:** any other wardrobe's
store. The snapshot rule (§A1) is what makes the search box safe — a query
cannot reach an unshared piece, because unshared pieces are not in the store the
search reads. Search inherits the feed's consent model whole, and it inherits
`postVisibleTo` as a hard pre-filter, applied before matching, never after.

**The matcher.** Normalize both sides (lowercase, strip diacritics, collapse
whitespace), split the query into tokens, and keep a record when **every** token
prefix-matches some token in the record. That is it. No fuzzy distance, no
synonym table, no scoring.

*Why no scoring:* a relevance score is a ranking, and toile-social 3 forbids
ranking of any kind. Results therefore come back in the standing order —
`newestFirst` for posts (`src/components/social.tsx`), name order for wardrobes.
The honest cost: typing "blue" does not find "navy", and the best match does not
lead. The mitigation is the chip rail (§A7), where colour, category, season and
occasion are values the user presses rather than words the app guesses at.

*Why this needs no index:* a device holds tens of accounts and hundreds of
posts. A linear scan over a few hundred short strings is sub-millisecond, runs
offline, and stores nothing. An index would be a cache to invalidate and a
second place for a stale caption to live.

**Nothing about a query leaves the device, ever.** No query logging, no "recent
searches" synced anywhere, no counters. Telemetry stays banned (`PLAN.md` #1).

## A4. What genuinely needs a backend — and exactly how much

Three separable things, listed in increasing cost so the owner can stop at any
line.

### (i) Finding a person who is not on your device

Needs a directory. The `public.profiles` table already exists
(`supabase/setup.sql`) with `id, display_name, handle unique, created_at` — but
its only select policy is:

```sql
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
```

So today **nobody can find anybody**, by construction. Making a profile findable
is three changes and no new table:

```sql
alter table public.profiles
  add column if not exists listed     boolean not null default false,
  add column if not exists city       text,
  add column if not exists tagline    text,
  add column if not exists monogram   text,
  add column if not exists mark_color text;

-- The directory read. `to authenticated` is load-bearing: without it the
-- publishable anon key shipped in the client can walk the whole directory.
drop policy if exists profiles_select_listed on public.profiles;
create policy profiles_select_listed on public.profiles
  for select to authenticated
  using (listed or auth.uid() = id);

-- Prefix lookup on the handle, over listed rows only.
create index if not exists profiles_handle_prefix_idx
  on public.profiles (lower(handle) text_pattern_ops) where listed;
```

Client side that is one query: `.select(...).ilike('handle', q + '%')
.eq('listed', true).limit(20)`, with a minimum query length of 2.

**Say the true thing at the switch.** A listed profile is *published*. Any
signed-in person can walk the alphabet and read the directory; a `limit` and a
minimum length slow that down and do not prevent it. So the listing carries only
what a person typed into it, and the copy at the toggle says every field on it
is public. There is no "searchable but private". That is not a tier this design
pretends to offer.

### (ii) An edge between two people

Needs the friend graph — §A5. One new table, one small one, four policies, and
one `security definer` helper.

### (iii) Seeing a friend's looks

Where the cost becomes structural rather than incremental:

- Photographs are **not synced in alpha** (`docs/34` §3 — the blob carries
  paths, not bytes). An explore grid of looks means Supabase Storage, a bucket
  policy, an upload path, per-user quota accounting, and image moderation.
- The E2E-sync gate (`docs/35`, owner decision 2) covers the *wardrobe
  document*, encrypted to its owner. A look shared to a friend is by definition
  readable by someone else, so it **cannot ride the same key**. It needs
  per-recipient encryption or it sits in plaintext on the server. Neither is a
  small job, and shipping the plaintext one quietly would spend the trust
  decision 2 was made to buy.
- Any surface carrying other people's content needs a report path, a takedown
  path, and a person to answer them.

**The recommendation** is therefore §A10's middle road: a friend post carrying
**the words and the drawn plate and no photograph** — look name, occasion, piece
names, caption. Small rows, no image hosting, no image moderation, and the card
already renders correctly without a photograph (`GarmentPlate` is first-class,
`docs/38` §1.5). It is a thinner thing than Instagram, and the owner should
decide with that said out loud rather than discover it later.

## A5. The friend graph

### The verbs

The four verbs of `toile-social` — **Show, Share, Ask, Lend** — are about
garments and must not be blurred. "Ask" in this house means *ask after a piece*.
The friend verbs are therefore different words, drawn from the vocabulary the
app already keeps (doors, roofs, rooms):

| Action | Proposed word | State |
|---|---|---|
| Send a request | **Knock** | `pending` |
| Accept | **Let them in** | `accepted` |
| Decline | **Staying home** | `declined` |
| Undo, either side | **Remove** | row deleted |
| Refuse contact | **Block** | row in `blocks`, edge deleted |

"Staying home" is the app's existing word for a declined request
(`toile-social` 8; `src/pages/Rail.tsx`). It is neutral, it carries no red, and
it already means *this is not a verdict on whoever asked*. **These strings are
proposals; the brand skill's copy pass is binding and gets the last read.**

### The tables

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

-- One edge per pair, whichever way it was asked. Without this, two people who
-- knock at the same moment become two rows and every read has to reconcile them.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table if not exists public.blocks (
  blocker    uuid not null references auth.users on delete cascade,
  blocked    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
```

### The policies, and what each one refuses

```sql
alter table public.friendships enable row level security;
alter table public.blocks      enable row level security;

-- You see only edges you are standing in. Nobody can enumerate anyone's
-- friends — which is what makes a follower count structurally impossible
-- rather than merely unrendered.
create policy friendships_select_mine on public.friendships
  for select to authenticated
  using (auth.uid() in (requester, addressee));

-- Only you may knock, only as pending, and never at someone who blocked you.
create policy friendships_insert_mine on public.friendships
  for insert to authenticated
  with check (
    auth.uid() = requester
    and status = 'pending'
    and not public.is_blocked_between(auth.uid(), addressee)
  );

-- Only the person asked may answer, and may never set it back to pending.
create policy friendships_update_answer on public.friendships
  for update to authenticated
  using (auth.uid() = addressee)
  with check (auth.uid() = addressee and status in ('accepted','declined'));

-- Remove is unilateral and asks no one (docs/19 veto 3, same principle) —
-- EXCEPT that a declined edge can only be cleared by whoever declined it.
-- Otherwise the requester deletes their own refusal and knocks again, forever.
create policy friendships_delete_mine on public.friendships
  for delete to authenticated
  using (
    auth.uid() = addressee
    or (auth.uid() = requester and status <> 'declined')
  );

create policy blocks_own on public.blocks
  for all to authenticated
  using (auth.uid() = blocker) with check (auth.uid() = blocker);
```

**One implementation fact that will otherwise cost a day.** The insert policy
reads `public.blocks`, which is itself RLS-protected. A plain subquery inside a
policy is evaluated *with RLS applied*, so it would see nothing and the check
would always pass. `is_blocked_between` must be a `security definer` function
with `search_path` pinned:

```sql
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;
```

**Blocking is one operation, not two.** A client that deletes the edge and then
inserts the block can lose the connection between them and leave a person
blocked but still connected, or connected but unreachable. Give it an RPC —
`block_account(uuid)` — that does both inside one transaction.

**The honest limit of a block.** It stops contact; it does not hide that it
happened. Anyone blocked can infer it from a profile that stops answering. The
copy must not describe it as a cloak.

### Where it is stored, and what stays local

The edge lives on Supabase, between **auth users** — people — and never between
wardrobes. This matters: a device can hold four wardrobes (`docs/38` §4.2), and
listing a *wardrobe* would publish how many closets you keep and what you call
them. So: **one person, one listing, one handle, and no wardrobe named on it.**
Which closet you were standing in when you posted is nobody's business.

Consequence to accept: the network handle is claimed against
`profiles.handle unique` at listing time and may differ from the locally derived
handle (`handleFor`, `src/lib/accounts.ts`). The interface must show the claimed
handle in the Index and the local one in the local rooms, without implying they
are the same string.

## A6. What a person sees before they accept

Governed by snapshot consent (§A1, rule 4) and the avatar rule (rule 5). A knock
shows, and shows only:

- the **tag with a monogram** — never a face, never a body, never a portrait
  photograph pulled from anywhere;
- display name;
- claimed handle;
- the one line the person wrote about their clothes;
- city, only if they listed one.

**Not shown, and named so a ticket cannot add them:** any look, any piece, any
closet, any count, any "N mutual friends" (a count *and* a graph leak — the
select policy makes it impossible to compute anyway), any activity time, any
wardrobe names, any honors (`docs/36` — private, and not a stranger's business).

Two buttons: *Let them in* · *Staying home*. One line of mono metadata under
them: **"Nothing of yours is shown until you let them in."** That sentence has
to be true of the implementation, not only of the screen — and it is, because
the select policy on posts (§A10, N4) resolves through `accepted` edges alone.

After acceptance a person sees exactly what N4 says and nothing more. There is
no tier where "friend" means "can browse your closet". `docs/19` veto 4 — "No
kind unlocks closet browsing, wear read-back, laundry or spend visibility" —
applies to this edge with the same force it applies to a roof.

## A7. Ordering, with no metrics

The Index has two surfaces and they order differently on purpose.

**Search results: the standing order.** `newestFirst` for looks, name order for
wardrobes. A query already narrowed the set; ordering it by a score would be the
app answering a question the user did not ask.

**The browse grid (no query typed): the day's shuffle.** A deterministic
permutation of the eligible set, seeded by `date + the viewer's account id`,
using the same FNV/mulberry hash family the feed engine already carries
(`src/lib/feedEngine.ts:25-36`).

What it is: order without judgement. The hash sees ids and a date. Nothing about
a post, its author, its age or its popularity — there is no popularity — can
move it. It is stable for a whole day, so a card does not slide out from under a
thumb; it is different tomorrow, which is the same honest variable freshness
`docs/38` §1 already admitted for the living feed; and it is reproducible, so a
check can assert it.

**What it costs, stated:**

1. **No relevance.** A wardrobe you care about is no likelier to lead than one
   you do not. Past a few hundred cards this is noise. The answer to noise is
   the chip rail, not a model.
2. **A different order per viewer.** Two people cannot compare positions, and
   "it was at the top for me" is not reproducible in support. Small, real.
3. **Reshuffling at midnight** moves everything at once. Mitigated the way the
   Look Book already does it: the newest post is pinned as the hero and is never
   shuffled, so recency is unambiguous where it matters.

**The chip rail** is the whole personalization story, and every chip is a value
the user pressed: season · occasion · category · colour · *Friends only* ·
*On this device*. Colours and categories come from the viewer's own taxonomy
(`AppSettings.categories`, the closet's colour vocabulary), so the chips speak
the user's own words.

**Rejected, and why.** *Colour affinity* — ordering strangers' looks by how
close they sit to the viewer's own palette. It is computable on-device from data
the user owns, it sends nothing anywhere, and it is still a ranking: it answers
"what will this person like" without being asked, and it would quietly narrow
what a person sees to what they already own. That is the mechanism the house
exists to refuse. The same information is available honestly as a chip the user
presses. Also rejected: recency-weighted mixes, "fresh wardrobes first",
"wardrobes like yours", and every other phrasing of the same thing.

## A8. The privacy default, resolved

Almari is local-first and sync is opt-in per wardrobe, off by default. A
searchable profile is the opposite of that by nature. The resolution is not to
soften either half; it is to draw the line in one place and never move it.

| Never leaves the device | Opt-in, off by default | Public the moment it is listed |
|---|---|---|
| Pieces, wear logs, costs, cost-per-wear, ledger totals, calendar, wishlist, furniture, taxonomy, notes, photographs, saved posts, the local accounts registry, and every search query | (a) the wardrobe document, to your own account — *existing* sync, per wardrobe (`SyncMode`); (b) **the listing**, per person; (c) **friend edges**; (d) **text-only look posts to accepted friends** | Display name, claimed handle, one line, monogram and mark colour, city if given |

Four rules hold that table up.

1. **Four separate switches, four separate decisions.** Sync on does not imply
   listed. Listed does not imply posting. Posting to friends does not imply a
   photograph. Every one of them defaults off, and none of them turns another
   one on.
2. **A wardrobe that never opts in never leaves the device** — `PLAN.md` #1 as
   amended, unchanged by any of this.
3. **Sample wardrobes never list and never post.** They never sync already
   (`src/lib/sync.ts`, rule 1); the same exclusion is applied at the listing
   client and the post client, not by policy.
4. **`everyone` must never be silently promoted to mean the internet.** Today
   `{ kind: 'everyone' }` means *everyone on this device* (`src/types.ts`).
   Uploading those posts would rewrite the meaning of every share ever made,
   retroactively — precisely the "silently rewrite dated statements" failure
   `docs/12` refused. The network gets a **sixth scope**:

```ts
| { kind: 'friends' }   // SCOPE_LABELS: 'People I have let in'
```

**One good property to keep, and one duty.** `postVisibleTo` (`src/types.ts`)
switches on `scope.kind` with no default branch, so a build predating `friends`
matches nothing, returns `undefined`, and hides the post. That is
**fail-closed**, which is the correct direction, and a check should pin it there
so a later refactor cannot turn it into fail-open. `CommunityState` is not
`AppState`, so `scripts/test-migrate.mjs` does not cover it — but `loadCommunity`
(`src/lib/accounts.ts`) must **keep** an unknown-scope post rather than drop it,
or an older build silently deletes a newer build's shares from the shared store.
That case belongs in the new suite, written before the scope exists.

## A9. The amendment this needs, in the open

`PLAN.md` #1 as amended admits an account that "does one job only — keeping a
synced copy of a wardrobe's record". A friend graph is a **second job**. This
design does not pretend otherwise and does not proceed on a reading.

**Proposed amendment text, for the owner to accept or refuse:**

> *(Amended 2026-08-\_\_ by owner direction: the optional account is admitted a
> second job — a directory listing and a mutual friend graph, both opt-in and
> both off by default. Nothing about a wardrobe's contents is admitted with it:
> the account still carries the wardrobe document only to its own owner, and a
> friend edge unlocks no closet, no ledger, no calendar and no wear history.
> Telemetry stays banned, ranking stays banned, and counts of any social kind
> stay banned.)*

If the owner declines, **N1 still ships** — local search over the device is
entirely inside the existing rules and needs no amendment at all. N2 onward
stops.

## A10. Build order

Letters: **N**, for network — `docs/33` uses A–H and `docs/38` uses F1–F4, and
two plans sharing a letter is how the wrong suite gets blamed.

Each phase names a check. A phase whose check cannot be run is marked as such,
because a check nobody can run is not a check.

### Phase N1 — the Index, local only (no backend; can ship for alpha)

1. Route `/find`, name "the index"; a nav entry in the More sheet and in the
   desktop sidebar's social group (`docs/38` §4.1). One search field, reusing
   the Closet's boxed-input pattern (`src/pages/Closet.tsx:544-565`,
   `IconSearch`).
2. Two tabs — Looks · Wardrobes — over the corpus in §A3, with `postVisibleTo`
   applied as a pre-filter.
3. The chip rail (§A7), over the viewer's own taxonomy.
4. The browse grid when nothing is typed: the day's shuffle, hero pinned,
   masonry reused from `docs/38` F1.
5. Empty states in the house register: nothing typed, nothing found, nothing on
   this device to find.

**Check — `scripts/test-explore.mjs`, new, wired into `verify`:**

- A query matching a piece name inside a snapshot returns that post.
- A post scoped `self` by another author is **never** returned, for any query —
  the fixture includes one whose caption is exactly the query string.
- A post scoped `household` is returned only when the viewer has `joined`.
- Result order is exactly `newestFirst` over the matched subset — the fixture
  puts the "better" match older, and the check fails if it leads.
- An empty query returns nothing, not everything.
- The day's shuffle is a pure function of `(date, viewerId, ids)`: same inputs,
  same permutation; a different date permutes differently; the hero is excluded.
- Grep guard: no `fetch` and no `supabase` import anywhere in the Index path
  at N1.
- `npm run lint:brand` green over every new string.

### Phase N2 — the listing (backend; owner amendment required)

1. `profiles` columns, policies and index per §A4(i), added to
   `supabase/setup.sql` — idempotent, like everything else in that file.
2. Settings gains a listing panel: off by default, four fields, and one
   paragraph saying every field on it is public and that unlisting removes the
   row from the directory but cannot un-see what was already read.
3. Handle claim, with collision handling against `profiles.handle unique`.
4. The Index's Wardrobes tab gains a *Look beyond this device* affordance,
   shown only when signed in and only when the person has listed.

**Check:** unit cases over the query builder in `test-explore.mjs`, plus a
**hand-run RLS transcript** committed as `supabase/test-rls.sql` — two signed-in
users; B selects A's listed row (1 row); B selects A's unlisted row (0 rows);
the `anon` role selects the directory (0 rows); B updates A's row (refused).
*This one cannot run in CI — the repo has no live-project harness. Recorded as
such, run by hand on every change to that file, output pasted into the report.*

### Phase N3 — the friend graph (backend)

Tables, policies and the `security definer` helper per §A5; the knock / let them
in / staying home / remove / block flows; the pre-acceptance card per §A6.

**Check:** extend `supabase/test-rls.sql` — C cannot read A↔B's edge; only the
addressee can accept; a declined edge cannot be deleted by the requester; a
blocked person's insert is refused; `block_account` leaves no half state. Plus
pure unit cases in `test-explore.mjs` over the state machine — which transitions
are legal from which state, and who may make them. That half runs in CI.

### Phase N4 — friends' looks, words and plates only (backend)

The sixth scope `{ kind: 'friends' }`; a `posts` table whose select policy
resolves through `accepted` edges via a `security definer` `are_friends(a,b)`;
**no image bytes uploaded**; the card renders `GarmentPlate` where there is no
photograph, which it already does.

**Check:** a friends-scoped post is readable by an accepted friend and by nobody
else, a `pending` one included; blocking removes visibility immediately; a
payload guard asserting no `imageUrl` field is ever in an upload body; the
fail-closed `postVisibleTo` case from §A8; `loadCommunity` keeps an
unknown-scope post rather than dropping it.

### Phase N5 — after alpha, and only behind a written policy

Photographs on the network. Blocked on: E2E or per-recipient encryption
(`docs/35` decision 2), storage quotas, and a written report/takedown path with
a named person to answer it. **Not an engineering phase until those three
exist.**

## A11. What I recommend against, and why

1. **A public Explore of strangers' looks.** Banned by `docs/12`, by
   `toile-social` 3, and by `docs/38` §5 — and each ban has a reason that has
   not changed. Beyond the contract: it needs image hosting Almari does not
   have, and it makes the owner responsible for moderating photographs of other
   people's clothing at a scale a two-person alpha cannot staff. The friend
   graph delivers the owner's real goal — people adding each other — without
   any of that.
2. **Relevance ranking, on-device colour affinity included.** §A7.
3. **Mutual-friend counts, "people you may know", suggested wardrobes.** Each is
   a metric or a graph leak or both. The select policy makes them impossible to
   compute, and that is the point.
4. **Listing a wardrobe instead of a person.** It would publish how many closets
   you keep. §A5.
5. **Reusing `everyone` for the network.** It rewrites the meaning of every
   share already made. §A8.
6. **A "searchable but private" tier.** There is no such thing: a directory any
   signed-in person can read is published. Saying so is cheaper than a promise
   that fails once.

---

# PART B — Google Calendar

## B0. The verdict

**Recommend against Google Calendar for the alpha.** Three independent blockers,
any one of them sufficient: no Expo Go build can complete a Google OAuth flow; a
calendar read scope needs Google's verification review before the app is public;
and the web half cannot refresh a token without a client secret, which means
routing a tester's Google credential through the owner's server. Ship the `.ics`
door instead. Reopen the live link when Almari leaves Expo Go — and reopen it as
**`expo-calendar` reading the device's own calendars**, which is a better answer
to the owner's actual question than Google's API is.

*Expo facts below were checked against `https://docs.expo.dev/versions/v57.0.0/`
on 2026-08-19, per `app/AGENTS.md` — not recalled.*

## B1. What it would actually take

**A Google Cloud project and three OAuth clients** — a Web client for the PWA,
an Android client (keyed to package name plus SHA-1 certificate fingerprint),
and an iOS client (keyed to the bundle id, redirecting on the reversed-client-id
scheme).

**A consent screen**, with a published privacy policy at a domain Google can
verify the owner controls, an app name, a logo, and a support email.

**Verification review, for a read scope.** Google's published scope table
(`developers.google.com/identity/protocols/oauth2/scopes`) lists the Calendar
scopes without a sensitivity column — the console carries the label, so
**confirm there before anyone plans around it**. What is not in doubt: reading a
person's events is not a basic-tier scope; an unverified consent screen shows an
"unverified app" interstitial and is capped at 100 test users. That cap is
survivable for 20–50 testers (`docs/34` §7) and is not survivable for a launch,
so the review is deferred cost, not avoided cost.

**Which scope is minimally sufficient:**

| Scope | What it grants | Verdict |
|---|---|---|
| `.../auth/calendar.events.readonly` | "View events on all your calendars" | **The minimum that does the job.** Almari needs to know what is on the day it is dressing, and nothing else. |
| `.../auth/calendar.readonly` | "See and download any calendar you can access" | More than needed — adds calendar metadata and access lists. Refuse it. |
| `.../auth/calendar.events` | View **and edit** | Never, for reading. Standing write access to somebody's real calendar is not a thing this app should hold. |
| `.../auth/calendar.app.created` | "Make secondary Google calendars, and see, create, change, and delete events on them" | The right one **if** Almari ever writes outward: it can only touch a calendar Almari itself made. An "Almari" calendar a person can hide or delete in one gesture is the correct shape. |

**A token store and refresh handling.** An access token lasts about an hour; a
refresh token is long-lived and is a standing credential to the tester's Google
account. Where it would have to live:

- **Web:** `localStorage`, or riding along in the Supabase session — both
  plaintext. `toile-social` 1 already says the honest thing about localStorage:
  *"a curtain, not a safe"*. A curtain over a wardrobe is a defensible trade
  the app has already explained to people. A curtain over a third party's
  standing credential is a different class of promise, and not one this project
  should make.
- **Native:** `expo-secure-store` — verified in SDK 57, listed "Android, iOS,
  tvOS, Included in Expo Go", no web. Note its limit: the docs record that some
  iOS releases historically refused values above roughly 2048 bytes, so a
  refresh token belongs in its own key rather than stringified into one bundle.
- **The refresh asymmetry that ends the argument.** Google's Web client type
  requires a client secret to exchange a refresh token. A static PWA cannot hold
  a secret. So the web path needs a server exchange — the existing
  `workers/ai-proxy`, or a Supabase function — which puts a tester's Google
  credential through the owner's infrastructure. Native/installed clients use
  PKCE with no secret and could stay client-side. The two halves of Almari would
  then have materially different privacy stories for the same feature, which is
  worse than not having the feature.

## B2. How it sits with the house rules

Badly, and specifically.

`PLAN.md` #1 as amended admits an account for **one job**: a synced copy of a
wardrobe. A Google token is a third job (after §A9's second) and would need its
own amendment. `docs/34` §3's framing is "opt-in sync, never a requirement", and
a calendar link would be opt-in too, so that part is fine. What is not fine is
the credential. The app's honesty rests on being able to say plainly where every
byte sits. "Your Google refresh token is in this browser's localStorage, and on
the web it passes through our proxy on every refresh" is a sentence Settings
would have to carry, and it costs more trust than the feature returns.

## B3. What breaks in the QR alpha

Checked against the SDK 57 docs:

- **`expo-auth-session` is in SDK 57 and is included in Expo Go.**
  `makeRedirectUri()` in Expo Go yields `exp://127.0.0.1:8081/--/redirect`; a
  development build yields `my-scheme://redirect`.
- **Its Google helper is deprecated.** `GoogleAuthRequestConfig` carries a
  deprecation note steering to `@react-native-google-signin/google-signin`.
- **That library cannot run in Expo Go.** Expo's Google-authentication guide:
  *"These libraries can't be used in Expo Go because they require custom native
  code."* A development build is required.
- **The generic AuthSession path does not reach Google either.** The only
  redirect an Expo Go build can receive is `exp://127.0.0.1:8081/--/redirect`,
  and no Google OAuth client type accepts it: Android clients are keyed to
  package plus SHA-1 and take no redirect URI, iOS clients take the
  reversed-client-id scheme, Web clients take `https` redirects only. The
  `auth.expo.io` proxy that used to bridge exactly this gap is gone. **Confirm
  in the Google console before anyone spends a day on it — the Expo half is
  verified from the docs; the Google half is from Google's published client
  rules.**
- **`expo-calendar` is not in Expo Go either.** The SDK 57 page states: *"To
  provide quicker updates, 'expo-calendar' is currently unsupported in Expo Go
  and Snack."* It is also **device only** — no simulator — and needs
  `NSCalendarsFullAccessUsageDescription` on iOS and `READ_CALENDAR` on Android.

**Net for the alpha:** iOS is Expo Go only (`docs/34` §7 — no TestFlight, no
Apple account), so on iOS there is no path to either Google OAuth or the device
calendar. Android could reach both through the internal-distribution APK
(channel 2), which would ship a calendar feature to half the cohort and not the
other half. That is a worse alpha than shipping neither.

## B4. The cheaper alternative, compared fairly

Three `.ics` shapes, in increasing cost.

**(1) Outward — Almari writes an `.ics`.** An event, or a week of planned days,
becomes a calendar file a person opens in whatever calendar they keep. Web: a
`Blob` and a download. Native: write to `FileSystem` and hand it to
`expo-sharing`. **No OAuth, no token, no review, no network at all.** It is the
one direction that needs nothing from anybody, and it delivers the concrete
want — *my dressed day shows up in my calendar*. Cost: it is a copy, not a link;
change the reservation and you export again.

**(2) Inward — the person picks an `.ics` file.** Web: `<input type="file">`.
Native: `expo-document-picker`, verified as "Android, iOS, Web, Included in Expo
Go" — it works in the QR alpha on both platforms today. Parse locally, map each
`VEVENT` to a `WardrobeEvent` (`WardrobeEvent`, `src/types.ts`), show exactly what will land
before it lands, and let the person drop the ones they do not want. No
credential of any kind, no server, works offline. Cost: manual, and stale the
moment the calendar changes. **One scoping call worth making early:** support
`DTSTART` / `DTEND` / `SUMMARY` / `LOCATION` only, and skip recurring events
with one plain line saying so. Half-parsing `RRULE` is how an import quietly
invents an event that is not there.

**(3) Inward and live — subscribe to a secret `.ics` URL.** Google publishes a
private iCal address per calendar. Paste it, poll it. Assessed honestly:

- That URL **is** a bearer credential. Anyone holding it reads the calendar
  until it is regenerated, and it would sit in the same plaintext storage as
  everything else. It is narrower than an OAuth token — one calendar,
  read-only, revocable in one click — and it is still a credential.
- **On web it does not work without a proxy.** Google's `.ics` endpoint sends no
  CORS headers, so a browser fetch fails. Routing it through `workers/ai-proxy`
  puts a tester's calendar contents through the owner's server, the exact thing
  §B2 refuses.
- **On native it works directly** — no CORS, no proxy, no server.

So: native only, opt-in, off by default, with the URL's nature stated at the
input. Not on web in the alpha.

### The comparison

| Path | OAuth | Google review | Credential stored | Works in Expo Go | Value |
|---|---|---|---|---|---|
| Google Calendar API | Yes, 3 clients | Yes, sensitive tier | Refresh token, plus a web proxy | **No** | Live, two-way |
| `expo-calendar` (device calendars) | No | No | None — an OS permission | **No** (dev build; device only) | Live; reads the Google calendar the OS already syncs |
| `.ics` import, by file | No | No | None | **Yes** | One-time, manual |
| `.ics` export, outward | No | No | None | **Yes** | One-way outward |
| `.ics` subscribe, by URL | No | No | A secret URL | Yes, native only | Live-ish, one-way inward |

**The finding worth carrying forward.** The owner's question is "can Almari see
my Google Calendar". The best answer is not Google's API — it is
**`expo-calendar`**, which reads the device's own calendars, and a Google
account added to a phone is already one of them. One OS permission prompt
instead of a verification review; no token; no server; nothing passing through
the owner's infrastructure. It costs a development build, which `docs/34` §7
already names as the standing direction of travel ("Expo steers to dev builds").
It is the right feature at the wrong moment, and the moment is after the QR
alpha.

## B5. Build order

### Phase N6 — the outward `.ics` (web and native; can ship for alpha)

An event, or a planned calendar day holding a reserved look, exports as `.ics`.
`SUMMARY` is the event or look name, `DESCRIPTION` the piece list, and
`DTSTART`/`DTEND` are local-timezone-correct through the existing helpers
(`src/lib/dates.ts`) — this is exactly the class of bug `docs/12`'s
local-timezone fix already paid for once.

**Check — `scripts/test-ics.mjs`, new, wired into `verify`:** a fixture event
round-trips to a byte-exact `.ics`; CRLF line endings and 75-octet line folding
per RFC 5545; a UTF-8 look name survives folding intact; an all-day event
carries `VALUE=DATE` and does not shift a day across timezones; a look with no
pieces produces no empty `DESCRIPTION`.

### Phase N7 — the inward `.ics` file (web and native; after alpha, or during it if cheap)

Pick a file, parse locally, preview, choose what lands. Each imported event
carries a provenance line naming the file and the day it was read.

**Check:** the parser is a pure function with its own fixtures — a Google
export, an Apple export, a file carrying `RRULE` (asserted **skipped**, with the
count reported), a file with a malformed `DTSTART` (asserted skipped, nothing
thrown), and a 2MB file (asserted parsed inside the frame budget). Nothing in
the parser path touches the network — grep guard.

### Phase N8 — the live link, after Expo Go

`expo-calendar` in a development build, read only, with the permission strings
in `app.json` and a plain sentence in Settings naming which calendars are read
and stating that nothing is written. Google's API stays closed unless the diary
study (`docs/33` G2) shows testers actually asking for two-way.

**Check:** per `docs/34` §6's app-side suite pattern. Device only, so it is a
manual acceptance step in the alpha kit (`docs/37`), not a CI check — said in
the kit rather than pretended otherwise.

---

## What this document does NOT do

- **It does not build an Instagram Explore.** No grid of strangers, no suggested
  wardrobes, no "people you may know", no ranking. Those are refused in §A11
  with reasons, not deferred.
- **It does not add a single metric.** No likes, follower counts, mutual counts,
  post counts, "seen by", or activity times. The friendship select policy makes
  several of them impossible to compute rather than merely unrendered.
- **It does not upload a photograph.** Not in N1–N4. Photographs on the network
  are N5, blocked on encryption, quotas, and a written takedown path.
- **It does not change what `everyone` means.** A sixth scope is added; the five
  existing ones keep every meaning they have ever had, and every dated statement
  already made stays true.
- **It does not let a friend see a closet.** No pieces, no wears, no costs, no
  ledger, no calendar, no wishlist, no honors. `docs/19` veto 4 applies to a
  friend edge exactly as it applies to a roof.
- **It does not amend `PLAN.md`.** §A9 proposes the amendment the friend graph
  requires and stops there. N1 needs no amendment and can ship regardless.
- **It does not touch the Look Book.** `docs/38` remains the design of record
  for `/feed`; the Index is a second room, not a redesign of the first.
- **It does not authorize a Google Cloud project.** Part B recommends against
  one for the alpha and names what would have to be true to reopen it.
- **It does not ship any code.** No file in `src/`, `app/`, `scripts/` or
  `supabase/` was changed. Every SQL block above is a proposal for review, not a
  migration that has been run.

## Checks that cannot run in this repo today

Said plainly, so nobody records a green suite that never executed.

- **RLS behaviour needs a live Supabase project.** `supabase/test-rls.sql` is a
  hand-run transcript, not a CI check. Every policy in §A4 and §A5 is unverified
  until somebody runs it against two real sessions and pastes the output.
- **`expo-calendar` and `expo-document-picker` are device-only or
  activation-gated.** Their acceptance is a manual step in the alpha kit
  (`docs/37`).
- **Google's console labels and redirect rules were not opened.** The Expo half
  of §B3 is verified from the SDK 57 docs; the Google half rests on Google's
  published client rules and should be confirmed in the console before any work
  starts.

---

*Recorded by the PLAN squad, 2026-08-19. Part A's amendment (§A9) and Part B's
verdict (§B0) are owner calls, not squad calls; everything else stands or falls
on the reasons written above.*
