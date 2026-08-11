# Roadmap — what to build next

Written 2026-08-11, after the Ledger analytics pass; updated the same day after
the expansion pass (Shared Rail, ceremony/festival wardrobe, drawn plates).
Ordered by leverage, not by effort.

## Open, and asked for

- **Sharing scopes.** Sharing is currently everyone-or-nobody. The design calls
  for four — everyone, a group, one person, only yourself — plus a "what you
  share" screen that states the current state completely rather than per-tile.
- **Direct-message composition.** The threads seed and render, and a message can
  carry a look or a piece; starting a *new* conversation from the UI is not
  wired yet.
- **Borrow requests inside conversations.** The states render and advance; the
  request sheet that creates one (and picks whose piece it is) is not built.
- **Brand linking on "Complete the look".** Deliberately not built — see
  `docs/12-wardrobes-and-feed.md`. Would require the panel's commerce rule to
  change, not just code.

## Shipped since first writing

- **The Shared Rail** (`/rail`) — borrowing among known people as a local-first
  preview: profiles, one group, one thread, all four request states, loan
  ledger. Decision record: `docs/11-shared-rail.md`. Schema v3.
- **Ceremony, festival, and heritage wardrobe** — 12 pieces (sari, lehenga,
  kurta, kaftan, haori, obi, juttis, jhumkas, bangles, sequins, metallic boots,
  piano shawl), a custom `drapes` demo category, `festival`/`wedding`/`ceremony`
  occasions, and 7 occasion outfits + 8 daily-register outfits.
- **Drawn garment plates** — 49 hand-drawn technical flats replace the caption
  swatches, validated by the new `test:art` suite (which caught five broken).
- **The salon** — a third theme for everyone, grounded in colour theory with
  every pair measured in a browser by the new `test:contrast` suite, which
  caught the shipped dark theme failing AA by 0.01. Theme is now device-level,
  so switching wardrobes no longer flips the palette.
  Reasoning: `docs/13-the-salon.md`.
- **Wardrobes, profiles, a feed, conversations and events** — three switchable
  worked wardrobes with their own closets, taxonomies, calendars and history;
  honest open/start screens in place of login; a feed with no engagement
  mechanics; a group thread and one per pair; events holding outfits against
  dated occasions, with "Complete the look" filling gaps from what is owned.
  Decision record: `docs/12-wardrobes-and-feed.md`. Conventions:
  `skills/toile-social/SKILL.md`.
- **`loading="lazy"` removed from every data-URI image** — the direct cause of
  the below-the-fold void wall (finding 9's trigger). The structural fix (plate
  under photo, one Thumb) is still open below.

Everything here is checked against the two binding contracts
(`docs/05-brand-identity.md`, `docs/06-focus-group-requirements.md`); anything
that could not be made to pass them is in *Rejected* at the bottom, with the rule
it broke, so it does not get proposed again.

The open design findings live in `docs/09-design-critique.md` — 31 of 38 are
still open and each carries a file and an exact fix. This roadmap groups them
into shippable passes rather than restating them.

---

## Now — the three highest-leverage passes

### 1. The carmine budget, enforced in CI
*Critique findings 8, 14, 20, 21. Half done.*

The Ledger is clean (bars are ink, the amendment is recorded in §6.5), but the
accent still leaks across five other screens: six `WEAR TODAY` buttons in one
Outfits viewport, two Closet filter-chip dots, two Wishlist links, two Settings
links, and a carmine paint swatch in the Before You Buy colour deck. With no
primary, the eye has nowhere to land.

The fix that makes it stick is not the edit, it is the **check**.
`scripts/check-brand.mjs` enforces nine rules and *nothing* about carmine. Add a
`carmine-budget` rule capping `bg-accent|bg-accent-fill|text-accent|border-accent`
occurrences per file, with an allowlist for the nav rail and the log-wear hero.
Without it this gets re-litigated in three commits.

### 2. One garment tile, used everywhere
*Critique findings 9, 37.*

`Thumb` is reimplemented in **seven** files (`Dashboard`, `Closet`, `Calendar`,
`Outfits`, `Wishlist`, `BeforeYouBuy`, `ItemDetail`). They disagree, which is why
~20 Closet tiles render as blank mats below the fold. Consolidate into one
component that paints `GarmentPlate` as the **base layer** with the photo above
it, so a tile is structurally incapable of being empty, and drop `loading="lazy"`
above the fold.

One live bug rides along: `flats[categoryId] ?? flats.accessories` means every
accessory draws the handbag glyph — the Tan Leather Belt renders as a handbag.
Add real `jewellery`, `belt`, `bag` and `scarf` flats. (The other — flats stroked
in `item.color`, drawing dark pieces invisible — is fixed: the line is always
`currentColor` now, with the colour said as a small chip beneath.)

This is what actually delivers "the no-photo state is first-class" (§2.5).

### 3. Mobile chrome
*Critique findings 6, 7. Findings 1, 2 and 25 are now fixed.*

Still broken at 390px: the Settings/Your Data rows collapse to one word per line
(14 lines in a 30px column), and the Outfits masthead fails entirely — the count
breaks to two lines, the button label wraps inside itself, and the block overhangs
the masthead rule. Stack `Masthead` below `sm`, and give the setting-row wrapper
`flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between`.

---

## Next — features the contracts already sanction

### Repair log, folded into cost-per-wear
The deferred feature the CPW centralization was a prerequisite for, and it is now
unblocked. `src/lib/cost.ts` already routes every consumer through `costBasis()`
and accepts `repairs?: RepairEntry[]`, so summing repairs propagates to per-item
captions, the By-maker table and the Ledger average in one edit. An inherited coat
at cost 0 plus a $40 hem graduates from `free` to genuinely costed with no
call-site change — precisely the case the repair log exists for.

**Gate:** adding `repairs` to `ClothingItem` is an `AppState` change. Hard rule 7
means a case lands in `scripts/test-migrate.mjs` *first*, plus a coercion beside
the new cost sanitizer in `migrate.ts`, plus a `SCHEMA_VERSION` bump.

This also serves the repair-studio member of the panel, whose craft is currently
invisible in the data model.

### Seasonal and occasion coverage
"You own 6 formal pieces and wear 2" is a gap analysis that stays factual. The
demo now carries 20 months of seasonally-weighted history, so the data to compute
it exists. Frame as coverage, never as a gap to close — a wardrobe is not a
collection to complete (§2.2).

### Wardrobe Wrapped, as a printed artifact
A season recap in the double-rule frame with registration crosses and the −3° wax
seal, exportable as an image. The panel approved sharing **only** as an opt-in
printed artifact, never a social graph (§8.6). The seal and frame already exist in
`art.tsx`.

### Category delete and merge, with reassignment
Deferred for data-loss risk. Needs the same care as retire: nothing is destroyed,
items are reassigned, and the copy says so.

---

## Then — infrastructure

- **Service worker** for true offline. The app already never touches the network;
  this makes that promise real when the tab is opened on a train.
- **Local PIN lock.** Worth doing, but ships only with honest copy —
  `localStorage` is plaintext and the lock is a curtain, not a safe. Saying
  otherwise would be the first lie the app tells.
- **Client-side background removal** for photos, so a phone snap looks like a
  catalogue plate without anything leaving the device.
- **Specimen numbers** (`№ 041 · ZARA · 14 WEARS`, critique finding 19). The
  strongest ledger signal in the contract is absent app-wide.

---

## Rejected, with the rule

Recorded so they are not re-proposed:

| Idea | Rule it breaks |
|---|---|
| Per-piece "biggest cost-per-wear fall" leaderboard | Ranking by lifetime fall collapses onto price order — the top eight are the eight most expensive pieces, in exact price order. An anti-consumption app's flagship card would be a display of your most expensive purchases. |
| Carmine hero bar on any chart | §2.6 "every category gets identical visual weight"; amendment recorded in §6.5. |
| Utilization percentage / completion meter | Progress-as-achievement. Hard rule 4, §2.2, §8.2. Removed this pass; do not reintroduce in another shape. |
| Re-wear rate charted as a long trend | The rate falls mechanically as a wardrobe grows. A number that drops while nothing is wrong is a verdict wearing a lab coat. Six whole months, with the mechanism stated. |
| Raster stock photography | §6 "all hand-coded SVG/CSS, zero rasters"; most garment stock is shot on a model, and §2.4 says never draw bodies. |
| Streaks, badges, confetti, notifications | Hard rule 4 and §2.2, unanimous panel rejection. |
| Any commerce surface | Hard rule 2. A feature that talks you out of buying cannot profit from buying. |

## Held from the 2026-08-11 design-critic pass

The critic's P0s and top-five are fixed. These stay open, recorded so they are
chosen rather than forgotten:

- **The dark closet defeats its own mat** — studio cutouts with near-white
  grounds render as light boxes on ink cloth. The fix is in the seed pipeline
  (matte photos to `--color-mat` at build time, or reject >20% near-white
  backgrounds in sourcing), not in CSS.
- **Icon system pass**: nine of thirteen nav glyphs float their pattern notch in
  empty space instead of crossing a principal stroke; `IconEvents` reads as a
  spray bottle at 20px; Feed/Chats are confusable offset-rectangles; the
  check counts notches but verifies neither quadrant nor crossing.
- **Empty-state plates for the social pages** — Events/Feed wear the dress form,
  Chats/Rail wear the wishlist suitcase, Profile wears the closet hanger. Four
  new destinations deserve their own plates (brand-artist task).
- **Type-scale drift**: 46 uses of `text-[14px]`, 29 of `text-[10px]`, both off
  the contract scale. One mechanical sweep, but it touches ~20 files.
- **Nav active state**: contract asks for a filled icon beside the accent rule;
  the filled variants were never drawn. Mobile's active marker is a 4px dot in
  the home-indicator zone.
- **Specimen numbers**: the caption reads `ZARA · 14 WEARS` but §7 specifies
  `№ 041 · ZARA · 14 WEARS`; §8.4 makes specimen framing load-bearing.
- **`--color-charcoal` is declared in four rooms and used nowhere** — give it
  its §7 job or retire it from the token sheet and the all-rooms check.
- **Salon character**: two of the three things docs/13 says carry the room
  (gold, rose) render on zero surfaces. The gilding room now demonstrates what
  a ground that carries its own character looks like; the salon deserves the
  same treatment or an honest merge.
