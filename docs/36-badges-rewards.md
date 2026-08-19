# 36 — Honors (badges & rewards)

> **Status:** proposed spec · **Requested by:** the owner ("badges and awards on
> profiles, for filling the closet, positive and fashion-based") · **Opened:**
> 2026-08-18 · **Blocks on:** owner decision 1 in `docs/35-alpha-panel.md`.

## The ask, and the veto it meets

The owner asked for badges and rewards. Two written rules stand in the way, and
this spec does not pretend otherwise:

- `PLAN.md` non-negotiable #4: *"No gamification chrome. No badges, streaks, or
  confetti. Cumulative factual totals only."*
- `docs/06` §2.2: the focus group was unanimous against badges, streaks,
  confetti, and progress-as-achievement; the replacement was *cumulative,
  unloseable, factual totals, stated like a bank balance*.

**This spec exists because the owner asked for it, and it amends the veto in
the open rather than routing around it** — which is exactly what the alpha
panel (`docs/35`) demanded: Maya noted the veto and asked for open resolution;
Robin named non-negotiable #4 and required amendment, not exception; Dev
demanded off-by-default with a kill switch. If the owner approves, `PLAN.md` #4
gains one sentence — *"Private, off-by-default honors that only ever state
unloseable facts are permitted under the pattern in docs/36."* — and the rest
of the veto stands untouched: still no streaks, no confetti, no public counts,
no progress bars. If the owner declines, this document is a record of the
considered shape and nothing ships.

The feature's name is **Honors**. Not badges (gaming chrome), not rewards
(transactional). Honors are what an atelier records about its own work.

## Principles

1. **Positive-only.** An honor can only mark something done. Nothing is earned
   by not buying, by discarding, or by any number going down. No honor has a
   failure state, an expiry, or a "so close" nudge.
2. **Private by default, off by default.** The feature ships disabled. One
   Settings toggle turns it on for the device. Off means no plate, no lines, no
   evaluation notices — and the toggle is the kill switch Dev asked for:
   flipping it off hides everything (earned records are kept, silently, in case
   it is turned back on).
3. **Zero public surface.** No counts, no streaks, no leaderboards, no
   comparison, no sharing prompt, no toast storms. Honors are never a signal to
   anyone else; sample wardrobes show theirs only because samples exist to show
   what the app looks like lived-in.
4. **Unloseable facts, bank-balance register.** Every honor, once true, stays
   true — the same law `docs/06` §2.2 wrote for totals. Retiring the piece,
   turning the feature off and on, resyncing: nothing un-earns an honor.
5. **Pattern-room diction.** Awards are named like atelier honors, in the
   copy-law voice (address the clothes and the record, never the person). No
   exclamation points — the app's one exclamation point stays unspent. No
   gamified chrome: no ribbons, no stars, no confetti, no fanfare motion beyond
   the existing seal-press.
6. **Derived, not tracked.** Honors are computed from the existing `AppState`
   (plus two observed transitions, below). They add no server data, work fully
   offline, and are per-wardrobe, never per-person-public.
7. **Never goals.** Unearned honors are not listed anywhere. There is no
   catalogue to complete, no "3 of 12", no progress toward the next one. The
   plate shows only what has been earned; the Settings copy says once that
   honors are noted as the record grows, and never what is coming.

## The catalog — twelve honors, three families

Exact copy. Name in Fraunces on the plate; citation one line beneath in the
small face.

### Keeping the record

| # | Name | Citation (exact) | Earned when (derivation) |
|---|---|---|---|
| 1 | **The Opening Stitch** | The first piece went on the record. | `items.length ≥ 1` (any item, active or retired) |
| 2 | **The Full Rail** | Thirty pieces are on the record — a closet that knows itself. | `items.length ≥ 30` (retired pieces count; they are still on the record) |
| 3 | **The First Ensemble** | The first look was composed from what was already here. | `outfits.length ≥ 1` |
| 4 | **The Safe Record** | A copy of the record was taken into your own keeping. | `settings.lastExportAt` set (the export already exists; this honors the first use of it) |

### Wearing well

| # | Name | Citation (exact) | Earned when (derivation) |
|---|---|---|---|
| 5 | **Paid for Itself** | One piece's cost per wear has fallen below one — worn past its price. | any item with `cost > 0` and `wearCount ≥ 1` where `cost / wearCount < 1` (currency-neutral; the ledger already renders the unit) |
| 6 | **Thirty Wears** | One piece has been worn thirty times. | any item with `wearCount ≥ 30` (retired pieces keep it) |
| 7 | **The Hundredth Entry** | A hundred wears are on the record. | sum of `wearCount` across all items ≥ 100 — the same bank-balance total the Today page already states |
| 8 | **Nothing Resting** | Every piece in the closet has had a first wear. | ≥ 10 active pieces and every active item has `wearCount ≥ 1` (the 10-piece floor keeps an empty or new closet from earning it by accident) |
| 9 | **A Full Season** | The record spans ninety days. | earliest `wearLogs` date ≥ 90 days before today — a span, not a streak; days with no log break nothing |

### Care

| # | Name | Citation (exact) | Earned when (derivation) |
|---|---|---|---|
| 10 | **Mended, not Replaced** | A piece came back from the mending pile. | observed transition: an item leaves `needs-repair`/`at-tailor` for a working state |
| 11 | **To the Tailor** | A piece was entrusted to the tailor to be made right. | any item currently `at-tailor`, or the observation that one was (see data model) |
| 12 | **The Cooled Wish** | A want waited out its cooling-off and was let go. | any wishlist item with `status: 'let-go'` whose `coolingOff` was set — the wait is the honor; a wish dismissed without cooling-off does not earn it |

Alternates considered and cut: a sourcing honor (first secondhand piece) —
risks ranking one *how it came to you* over another, and the taxonomy law says
sources are flat; a furniture honor (every drawer named) — filing must never
become a chore with a prize.

## Data model

- **Pure derivation where possible.** `deriveHonors(state: AppState): AwardId[]`
  is a pure function over existing state — honors 1–9 and 12 need nothing else.
- **Two observed transitions.** Honors 10 and 11 mark events (a mend completed,
  a tailor visit) that current state cannot always prove after the fact — a
  piece back at Ready looks like it was never benched. While the feature is on,
  evaluation diffs the previous and next item states and records the
  transition.
- **Storage.** A per-wardrobe, per-device record —
  `almari-honors:<wardrobeId>` in localStorage — mapping award id to the ISO
  date first earned. It lives **outside** `AppState` deliberately: synced
  wardrobes put `AppState` on the server, and honors are no one's server data.
  Consequence, stated honestly: honors are a *view* of the record, not the
  record. The lossless-export guarantee (non-negotiable #7) covers the wardrobe
  itself; honors re-derive from it.
- **Toggle.** One device-level flag (`honorsEnabled`, default `false`),
  alongside Theme — the preference is the person's, not the wardrobe's. Off
  stops observation and hides all surfaces; earned dates are kept.
- **No migration.** `AppState` and its schema are untouched.

## Placement & presentation

- **Profile.** One quiet letterpress plate headed *Honors*, below the wardrobe
  summary. Each earned honor: name (Fraunces), date set down, citation line.
  Nothing else on the plate — no slots, no hints of unearned honors.
- **Sample wardrobes show theirs.** The samples derive honors from their seeded
  histories like any wardrobe; a lived-in sample legitimately shows several.
  This is the feature's only discoverability surface beyond Settings, and it
  answers Maya's "without any visibility I'd never notice them" without a
  single notification.
- **The earned moment.** No toasts. At most one calm line at the top of the
  Ledger: *"Set down today: Mended, not replaced."* It appears once, holds
  until the next session, and never stacks — two honors in a day read *"Two
  honors were set down today."* The one exclamation point stays unspent.
- **Settings copy, exact:** *"Honors — quiet marks on your own profile as the
  record grows. Off by default; never shown to anyone; never goals."*

## Edge cases

- **Retired pieces.** History counts: a retired piece's wears still earn 2, 5,
  6, 7. *Nothing Resting* (8) reads the active closet only — a piece retired
  unworn left the closet and blocks nothing.
- **Samples.** Derive identically. A sample reseed rebuilds the wardrobe, not
  the honors key (keyed by stable account id); re-derived honors come back the
  same or better.
- **Synced vs device wardrobes.** Honors never sync. Two devices of one synced
  wardrobe can differ on the observed honors (10, 11) until each device sees
  its own transition; the Settings copy's "never shown to anyone" covers the
  why, and the divergence is cosmetic, dated, and self-healing.
- **Import / fresh device.** Pure derivations (1–9, 12) re-run at first open
  with the feature on and re-earn instantly. Observed honors re-arm on the next
  observed transition. Accepted and documented: honors are re-derivable
  commentary on the record, not part of it.
- **Cost-less pieces** simply cannot earn 5; the ledger already declines to
  quote a cost per wear without a cost, and honors follow it.
- **Cooling-off bypassed.** A wishlist item let go without a wait does not earn
  12 — the honor belongs to the wait.
- **Toggle off, then on.** Derived honors present themselves as if always
  there; observed honors resume observing. No backfill theatre, no catch-up
  lines.

## Test plan — `scripts/test-honors.mjs`

A Node script in the house style of `scripts/test-feed.mjs`: fixture states
built on `initialState`, assertions, non-zero exit on failure, wired into
`verify`. Cases:

1. Empty state earns nothing (incl. *Nothing Resting* with 0 and with 3
   pieces — the 10-piece floor).
2. Each of 1–9, 12 earns on its minimal fixture, with the exact name/citation
   strings asserted.
3. Retired pieces: a retired 30-wear item earns 6; a retired unworn item does
   not block 8.
4. *The Cooled Wish*: `let-go` with `coolingOff` earns; `let-go` without does
   not.
5. Observed transitions: `needs-repair → clean` earns 10; `clean → at-tailor`
   earns 11; replaying identical states earns nothing twice.
6. Idempotency: evaluating twice yields identical maps and stable earned dates.
7. Toggle: `honorsEnabled: false` produces no plate data and no observation
   writes; re-enabling re-derives 1–9, 12 fully.
8. Import replay: a state built from an exported fixture re-derives every
   derived honor without the honors key.
9. Brand gate: `lint:brand`-style assertion that no honor string contains an
   exclamation point or banned vocabulary from `docs/06` §3.

## Non-goals

- Public, shared, or comparable honors; any count of honors; any "share your
  honor" surface (the outfit card is the shareable artifact; honors stay home).
- Streaks, progress bars, "next honor" hints, greyed-out slots, completion
  percentages, confetti, fanfare motion.
- Push, toasts, badges on icons, or any re-engagement mechanic built on honors.
- New server data, schema changes, or sync of honors.
- Honors for buying, spending, discarding, body-adjacent facts, or anything
  with a failure state.
- Monetization of any kind.
