# 26 — Next steps

Where the project stands, and what is worth doing next. Supersedes docs/21 as
the working list; docs/21's six interface designs are still valid and still
unbuilt, and are carried forward below.

Written after the dressing-room round. Everything marked SHIPPED is on `main`
and live; everything else is a claim about the future and should be read as one.

---

## What shipped in this round

- **The dressing room.** Nine furniture forms including three almirahs, drawn
  from the user's own records. Schema v7: `place` on a garment, `packed` on a
  compartment, `ornament` on a fitted almirah.
- **The room**, twice: built, deleted, rebuilt as a compositor over
  `drawFurniture` rather than a second drawing system.
- **The chair**, standing in the room, derived from `laundryStatus`, tappable to
  send the pile to the wash.
- **Mughal, Rajput and Shoji ornament** on the fitted almirah.
- **The background cut**, rewritten. Palette chosen by result, edge-guarded
  flood, honest failure, draw-a-box and tap-the-background.
- **Five more sample wardrobes**, briefed rather than named.
- **docs/25**, the flow map, and the rule that every address not in the nav
  carries a named way back.

---

## Open, ranked

### 1. The five wardrobes have no photographs

Four of the five are period, and the photo pool is contemporary Western basics
plus an Indian ethnic set — so a justaucorps, a jeogori and a george wrapper
fall back to the drawn flat. That is the correct behaviour and it is also a
thin-looking closet.

`scripts/fetch-garment-photos.mjs` already pulls from Wikimedia Commons behind a
licence gate, and Commons carries public-domain museum costume photography — Met
Open Access, Rijksmuseum, LACMA — which is exactly where these garments live.
This is the single biggest visible improvement available and it needs no new
code, only a fetch run and new `PHOTO_RULES` entries.

### 2. The Closet masthead costs 181px and has no primary

Two co-equal outlined buttons — *Today's outfit* and *A whole layout* — wrap
under the title on a phone and strand the piece count between them. It is also a
straight §7 violation: exactly one primary per view, and this view has none.
Make *Today's outfit* the primary and move *A whole layout* into the filter
drawer or the empty state. Measured saving: about 70px of first screen.

### 3. The Closet empty state has three CTAs

Against §8.4's "exactly one CTA on empty screens" — a primary plus two
underlined links. It is also the first screen a new person actually sees.

### 4. The room shows your oldest furniture

`standing.slice(0, showPieces)` is insertion order, so the piece you drew a
minute ago is the one behind the door. Insertion order is right for identity —
"mine is the second one" must stay true — so the fix is not a sort. Either widen
what fits, or mark the most recent piece rather than reordering.

### 5. The dress form may be a body

`FRIEZE_PIECES.dressform` is a headless torso with a knob head, bust, waist and
hips on a tripod, and it ships on `/outfits` and `/compare`. docs/06 §2.4 says
never draw bodies. Either it is redrawn as a coat stand, or the clause is
amended on the record by a documented pass. It should not simply stay.

### 6. The room frame is not sized to its furniture

`roomArt.ts`'s own docblock says the frame is "as wide as its furniture needs and
no wider". It is not — `W = plateW`. The fix keeps the unit-is-a-pixel invariant:
leave `W` alone and draw the wall lines at `x0 - 18` and `x0 + innerW + 18`.

### 7. Sync you own

Export and import over a file the person controls, so a wardrobe can move
between devices without an account. Listed in docs/24 §7 as the next build item
and still the largest gap against every rival. The migration is already lossless
in both directions, which is most of the work.

### 8. The six from docs/21, unchanged

Lending, the events packing surface, closet sort, past-date logging, wishlist
price projection, and V2 Vitrine phase 2. All still designed, none built.

---

## Debt worth naming

- **`personaData.ts` is generated from a source pack that is not in this
  repository.** Running `scripts/build-persona-data.mjs` without it deletes three
  wardrobes. The five authored ones live in `personaCast.ts` for that reason.
  Either the pack comes back into the repo or the generator should refuse to run
  without it.
- **The cut runs on the main thread**, about 250ms median. `cutoutCore` was
  specced as DOM-free so it could move to a worker; it has not.
- **Two research passes exhausted their web-search budget**, so a few figures in
  the persona research are indexed rather than fetched, and two source-list
  corrections came back. Nothing in shipped data depends on them.

---

## The rule this round earned

Three separate defects this round were tests that could not fail: two counted
links across the whole document when every page inherits a navigation rail, and
one measured an SVG element that is the same size for every form by
construction. Each passed for months while the thing it named was broken.

> **A test that cannot fail is worse than no test, because it is also a claim.**

When adding a check, prove it fails against the bug it is for — before fixing
the bug.
