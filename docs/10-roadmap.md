# Roadmap — what to build next

Written 2026-08-11, after the Ledger analytics pass; updated the same day after
the expansion pass (Shared Rail, ceremony/festival wardrobe, drawn plates).
Ordered by leverage, not by effort.

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
- **`loading="lazy"` removed from every data-URI image** — the direct cause of
  the below-the-fold void wall (finding 9's trigger). The structural fix (plate
  under photo, one Thumb) is still open below. Everything here is checked against the two binding contracts
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

Two live bugs ride along: `art.tsx` strokes flats in `item.color`, so any dark
piece with no photo draws an invisible garment; and `flats[categoryId] ??
flats.accessories` means every accessory draws the handbag glyph — the Tan
Leather Belt currently renders as a handbag. Add real `jewellery`, `belt`, `bag`
and `scarf` flats.

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
