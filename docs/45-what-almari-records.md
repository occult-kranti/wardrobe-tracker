# 45 · What Almari records, and what it does not

**Standing reference, opened 2026-08-28.** This document exists because
PLAN.md non-negotiable #1 was amended that day to admit an opt-in alpha usage
record, and a promise that has been amended needs somewhere to be written down
in full rather than in the margin of six other files. It is the document the
app's own copy points at — the README's Privacy section, `company/ship.html`,
`public/alpha.html`, `AGENTS.md` and `GEMINI.md` all end here.

It answers one question in four parts: **everything the maker of this app can
learn about a tester, by every route that exists.** For each route: what it
carries, what it does not, who can read it, and how a tester makes it stop.

The four routes are unequal, and the inequality matters. Three of them existed
before the amendment; only the third is new. None of them turns on by itself.

| # | Route | On by default | New in this amendment |
|---|---|---|---|
| 1 | Operational records over the sync cohort | No — sync is opt-in per wardrobe | No |
| 2 | The relay, and the services behind it | No — one press at a time | No |
| 3 | The opt-in usage record | **No — off until the box is ticked** | **Yes** |
| 4 | Human research | No — by invitation and written consent | No |

---

## 1 · Operational records over the sync cohort

**What it is.** A wardrobe whose owner turned sync on has a copy of its
document in `public.wardrobes` on Supabase, so a second device can open it.
The local record is the original; this is the copy.

**What it carries.** The row is `id`, `user_id`, `name`, `state`, `updated_at`
(`supabase/setup.sql`). `state` is an envelope — `{ v, alg, payload }` — and
`payload` is the **whole wardrobe document**: pieces with their names, brands,
notes and *fits like* lines, outfits, wear logs, the wishlist, settings, and
photographs inlined at the moment of the push (`forTheWire` in
`src/lib/sync.ts`). A signed-in person also has one row in `public.profiles`:
`id`, `display_name`, `handle`, `created_at`. Supabase's own auth tables hold
the email address the account was made with.

**What it does not carry.** Anything from a wardrobe that never opted in. A
sample wardrobe never syncs. Signing out deletes nothing and sends nothing.

**Who can read it.** Row-level security restricts every read and write to the
owning `user_id` (`wardrobes_select_own` and its three siblings). The project
owner, holding the service key, can read any row — and **this is the one route
where that matters**, because `alg` is still `none`: the payload sits on the
server in the clear. `docs/35` commits Almari to end-to-end encryption, and the
discriminator exists so that the day it lands is a version bump rather than a
migration. Until then `public/alpha.html` says so in as many words, and it must
keep saying so.

**How a tester makes it stop.** Turn sync off for the wardrobe; delete the
wardrobe's synced copy from Settings, which issues
`from('wardrobes').delete().eq('id', syncId)`; or ask for the account to be
deleted, which cascades both tables from `auth.users`. A wardrobe that was never
synced needs nothing done to it.

---

## 2 · The relay, and the services behind it

**What it is.** When a person asks the app to read a photograph, the image goes
to `supabase/functions/ai-proxy`, which holds the provider keys so the device
never has to, and forwards it to Anthropic, Google or Moonshot by model prefix.
One press, one photograph.

**What it carries.** The photograph and the intake prompt, out; words and
coordinates, back. Four clamps apply: a model allowlist (`claude-fable-5`,
`claude-opus-5`, `gemini-3.7-flash`, `k3`, plus point releases), a token
ceiling, a body cap, and an Origin check.

**What it does not carry.** No wardrobe document, no account identifier, no
other piece from the closet. The relay function writes no log lines of its own.
The photograph is not stored along the way.

**Who can read it.** Whatever the platform keeps: Supabase's edge-function
request logs (timestamps, status codes, sizes — the project owner can see
these), and the model provider's own retention policy for an API request, which
is the provider's and not Almari's. A tester who prefers neither can set their
own endpoint or key in Settings, which bypasses the relay entirely.

**How a tester makes it stop.** Do not use the cataloguer. Nothing else in the
app calls it, and every route into it is a deliberate press.

---

## 3 · The opt-in usage record

**What it is.** New on 2026-08-28, for the alpha and no longer. The contract is
`src/lib/usage.ts`; the service half is the collector at
`supabase/functions/usage`. It answers questions the other three routes cannot —
how long the first hour actually takes, which screens are opened and abandoned,
how often a write is refused on a full phone — without any of the things that
make analytics a betrayal.

### 3.1 · The gate

A tester is asked once, and the box is unticked. Under *show what would be
sent*, the panel renders `pendingPayload()` — the real payload from this
device, not a sample and not a description of one. Before consent that function
returns `null`, because there is nothing to return, so the block prints the
declared shape instead and the line above it says exactly that. The real
payload is what the same block shows in Settings afterwards.
**Nothing is buffered before consent.** Not held back from sending:
not written down at all. `record()` checks `isRecording()` on its first line and
returns. This is the whole trust argument, and it is why a tester who opens the
panel cannot find it already full of their morning.

Granting mints a fresh `installId` — a random UUID, never the account id.
Revoking and re-granting mints another, so two spans cannot be stitched
together. `CONSENT_VERSION` exists so that a material change to the payload asks
again; it is never bumped to nag.

### 3.2 · The closed vocabulary

An event name comes from `EVENT_NAMES` and never from a variable. A property
value is a number, a boolean, or a member of an enum, typed per event through
`EventProps`. `string` is absent on purpose and its absence is load-bearing: the
compiler refuses `props: { name: item.name }` at the call site, which is where a
leak would otherwise be introduced by somebody being helpful on a hurried
afternoon.

**There is no sanitiser in that file and there must never be one.** A sanitiser
is what you build when user text can reach the payload. The point here is that
it cannot. Anything that would need stripping is a path to be deleted, not
cleaned.

### 3.3 · The full event list

Fourteen names. This table is the whole vocabulary; nothing else can be
recorded, and the collector's own allowlist is compared against this list by
`scripts/test-usage.mjs`, because a name the service does not know is an event
silently discarded in production.

| Event | Properties | What it answers |
|---|---|---|
| `app_opened` | `cold` (bool), `standalone` (bool) | Did it start fresh, and from the home-screen tile or a browser tab |
| `wardrobe_created` | `seeded` (bool) | A new wardrobe, empty or from a sample |
| `piece_added` | `via` (`manual` \| `photo` \| `intake` \| `sample`), `hasPhoto` (bool), `tier` (`unrecorded` \| `free` \| `budget` \| `mid` \| `investment`) | How pieces actually get into a closet |
| `wear_logged` | `pieces` (num), `viaOutfit` (bool) | The daily loop, and whether outfits carry it |
| `outfit_created` | `pieces` (num) | How many pieces an outfit really holds |
| `screen_viewed` | `screen` (enum, below), `ms` (num) | Which rooms are used, and for how long |
| `intake_run` | `offered` (num), `accepted` (num), `ms` (num) | Whether the cataloguer's guesses are kept |
| `cutout_run` | `ms` (num), `kept` (bool) | Whether the background lift is taken or discarded |
| `export_taken` | `size` (`under-1mb` \| `1-3mb` \| `3-5mb` \| `over-5mb`) | Whether testers keep their own copy |
| `tutorial_step` | `screen` (enum, below), `action` (`shown` \| `done` \| `skipped`) | Where a walkthrough is abandoned |
| `write_refused` | `size` (band, as above) | The full-device failure, which is real and frequent here |
| `error_raised` | `where` (`intake` \| `cutout` \| `sync` \| `photos` \| `storage` \| `render` \| `export`), `kind` (`network` \| `refused` \| `quota` \| `parse` \| `timeout` \| `unknown`) | That something broke, in which part, of what kind |
| `sync_attempted` | `ok` (bool), `ms` (num), `size` (band, as above) | Whether sync works on real phones and real networks |
| `session_ended` | `ms` (num), `screens` (num) | The shape of a session |

Every event also carries `at`, milliseconds since epoch on this device's clock
— except `sync_attempted`, whose `at` is floored to the hour, for the reason
given in §3.6. A batch carries `installId`, `sentAt` and `build`, and nothing
else. Fourteen names is the ceiling, not a report of today's wiring: a name
nothing calls yet records nothing, and the tree is where that is read off.

`screen` is an enum of seventeen room names — `today`, `closet`, `outfits`,
`dressing-room`, `calendar`, `events`, `ledger`, `wishlist`, `before-you-buy`,
`chats`, `profile`, `rail`, `intake`, `settings`, `wardrobes`, `door`,
`elsewhere` — and **never a pathname**, because a pathname carries ids.

### 3.4 · What it never carries, by any route

Garment names. Brands. Notes. *Fits like* lines. Captions. Chat text. The names
a person gave their own categories and occasions, which are user-authored by
law. Colours. Photographs, or anything derived from one. Cost **values** — only
the tier bucket in `piece_added`. Wardrobe names. Account names. Handles. Email
addresses. Pathnames. Item, outfit and wardrobe ids. Byte counts — a payload,
an export and a refused write are each a four-way size band, never a figure.
The exact moment of a sync — that one event's clock is floored to the hour.

`scripts/test-usage.mjs` carries the red-proof: it builds a wardrobe of real
garment names, brands, notes and photographs, drives every path that records,
and asserts that not one of those strings survives into a payload.

### 3.5 · The buffer yields to the wardrobe

A bounded ring — `MAX_EVENTS` 500, `MAX_BYTES` 96 KB — dropped oldest first, and
any write that throws abandoned silently. This app already loses writes to a
full device; `src/hooks/useLocalStorage.ts` counts refusals because quota is a
real and frequent failure here. **A tester must never lose a wear log because
the app was busy recording that they logged one.** A buffer that arrives
hand-edited, half-written or written by a newer build is discarded rather than
repaired: it is not the record, and losing it costs nobody anything.

### 3.6 · Who can read it, and for how long

The project owner, and nobody else. Rows are keyed by `installId` and carry no
account, no email and no handle. That is not the same as unlinkable, and the
difference is the one thing this section exists to state rather than gloss.

**An install id and a synced wardrobe were joinable by their timing, and the
code was changed to blunt it.** A push writes `public.wardrobes` with a
server-stamped `updated_at` under a `user_id` that names the person, and
`sync_attempted` is recorded in the same instant. So that event, alone of the
fourteen, is stamped with its clock floored to the hour (`COARSE_EVENTS` and
`stampFor` in `src/lib/usage.ts`) and its payload size as a four-way band
rather than a byte count (`sizeTierOf`). Both were exact when this document was
first written; both were coarsened for this reason and for no other.

What is left is a join at the resolution of an hour. The server's `updated_at`
is still exact; the record's stamp is not, so the two can be lined up only on
the hour they share. In a cohort this size that still narrows towards a person
without naming one, and the owner
holds the service key over both tables, so nothing in the schema forbids the
join being run by hand. What stands against it is that the owner does not do
it, and that no code in this repo does: `supabase/functions/admin-stats` reads
`profiles` and `wardrobes` and never opens `usage_events` at all. A tester who
never turns sync on leaves nothing on the server to line the record up against
— but they are still not anonymous, because **the cohort is small enough that a
count of three is three people.** Almari does not call these numbers anonymous,
and no document in this repo may describe them as anonymous.

**Retention: ninety days is the intention. It is not built.** Nothing in
`supabase/` deletes a row because it got old — there is no scheduled sweep, no
`pg_cron` job, no expiry column. Today a row leaves the table one of three ways:
a tester revokes and the collector's DELETE handler drops every row for that
install id; the owner deletes by install id on request; or the table itself goes
when the collector is removed at the end of the alpha (§3.8). A ninety-day sweep
is written down here as the intention so that it can be checked against the
tree, and until the tree has one, this paragraph is a plan and not a practice.

**No gate depends on it.** The pre-registered alpha gates of `docs/28` §4.4 are
measured by moderated sessions, diary studies and volunteered exports, and
`company/ship.html` says so. A number produced only by the testers who agreed to
be counted cannot be the number the whole cohort is judged by.

### 3.7 · How a tester makes it stop

- **Decline at the panel.** Nothing was written down, so there is nothing to
  delete. Nothing else in the app changes.
- **Switch it off in Settings.** Revocation is destruction: the local buffer is
  emptied and the service is asked to drop every row for that `installId`. A
  revoke that merely stopped future sends would make the Settings copy false.
  When the service does not answer, `eraseUsage()` returns `'failed'` and
  Settings leaves a standing line saying so — this device is empty, those rows
  are not, and the id that named them was retired with them. Reporting the
  clean outcome over the failed one is the single lie this feature is built to
  make impossible, and the rows are then removed by hand on request.
- **Read it first.** Settings shows the record as it stands — the real payload
  from this device, through the same `PendingPayload` block the consent panel
  uses — so the decision is made against the actual contents rather than a
  promise about them. There is no button that downloads it; reading it is what
  Settings offers, and no document may promise more than that.

### 3.8 · It expires with the alpha

When the alpha ends the collector is **removed, not disabled**. The amendment is
scoped to the alpha, and a switched-off collector left in the tree is a standing
invitation to switch it back on. Removing it means: `src/lib/usage.ts` and its
call sites deleted, `supabase/functions/usage` undeployed and dropped, the table
dropped, and this section rewritten in the past tense.

---

## 4 · Human research

**What it is.** The oldest route and still the main one: moderated sessions,
interviews, diary studies, and a tester who chooses to send their own export.

**What it carries.** Whatever the tester chooses to say or send — and an export
is the whole wardrobe, which means photographs that can include faces and home
interiors, travel dates through events and packing, and household members
through the shared rail. `docs/28` §2.5 is blunt about the consequence: the
moment an export lands in a company inbox, the company is processing personal
data as a fiduciary for it.

**What it does not carry.** Nothing arrives without a person deciding to send
it. There is no background upload, no crash reporter, no third-party SDK.

**Who can read it.** The research protocol of `docs/28` §2.5 binds: written
consent per tester; testers 18 and over only; a fixed retention-and-deletion
date per study; artifacts stored segregated from company systems; and the
redacted **research export** — schema and counts, no photographs, no free text —
preferred over the full one wherever it will do.

**How a tester makes it stop.** Say no, or say nothing. Leaving the study at any
time, for any reason, by writing one line, is stated on `public/alpha.html` and
is not conditional on giving a reason.

---

## 5 · Forget this tester

One request, one path, and it covers all four routes. A tester writes to the
address on `public/alpha.html` and asks to be forgotten. What happens:

1. **The usage record.** They read their `installId` from Settings and send it,
   or simply switch the record off — which already asks the service to drop the
   rows. On request the owner deletes by `installId` directly. If the id has
   been lost there is no fallback in time — nothing expires on its own, per
   §3.6 — and the rows stand until the collector and its table are removed at
   the end of the alpha.
2. **The synced wardrobes.** The account is deleted, which cascades
   `public.wardrobes` and `public.profiles` from `auth.users`, taking every
   synced document and the auth record with them. A tester who prefers to do it
   themselves deletes each synced copy from Settings and then the account.
3. **The research artifacts.** Every session recording, note, transcript and
   volunteered export held for that tester is destroyed, ahead of the study's
   fixed deletion date.
4. **The correspondence.** The support thread itself, once the request has been
   carried out and confirmed.

What cannot be undone, and is said rather than glossed: platform-side request
logs at Supabase and at the model providers are the platforms' records, kept to
their own schedules, and Almari cannot reach into them. They carry timestamps,
sizes and status codes, not wardrobes.

The local record is untouched by any of this. It is on the tester's device, it
is theirs, and no request made to the maker has ever been able to reach it.

---

*Sources of record: `PLAN.md` #1 as amended 2026-08-28 · `src/lib/usage.ts` ·
`supabase/setup.sql` · `supabase/functions/ai-proxy/index.ts` ·
`src/lib/sync.ts` · `docs/28-the-company.md` §2.5 and §4.4 ·
`docs/35-alpha-panel.md`. Where this document and the tree disagree, believe the
tree and fix this document.*
