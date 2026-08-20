# 41 — The Showing (the Explore mosaic)

> **Status:** build-ready spec, panel closed · **Requested by:** the owner
> ("different sized boxes … changes as you scroll … fashion-show / wardrobe /
> atelier inspired; all artistic liberty, then optimize for functionality") ·
> **Closed:** 2026-08-19 · **Panel:** two customers, marketing, psychology,
> tech lead, artist, Instagram-mechanics research, one advisor, one moderator ·
> **Supersedes:** the flat grid in `src/pages/Explore.tsx` · **Companions:**
> `docs/39`, `docs/40` §1.3/§3, both binding skills.

## The verdict

Build **The Showing**: the Explore grid becomes a dealt mosaic — bands of
uniform 4:5 racks, one double-width plate per band that takes **the turn**,
the turn's side mirroring as the scroll deepens, month seams as basting
hairlines, and a hem at the bottom, because a show that never ends is not a
show. Size comes from arithmetic over position, never from behavior; there is
no behavior data to read and this spec keeps it that way. The consent aperture
stays `resolveFeedEntries`, the one door — this entire feature styles what it
is given and never widens what is visible. No metrics, no counts, no ranking,
no seen-state ride in with it. Every conflict below was settled in the panel's
standing order: hard constraints first, then the tech lead's feasibility veto,
then the psychologist's calm rules, then artistry.

The publishable size law, one breath, true at every breakpoint:

> **Every band deals one turn: whatever arrives at that slot in time's order
> takes it, a guest steps aside by one place, and every other slot is the
> rack.**

And its corollary, printed as a second fact, not folded in: *the newest post
always opens the showing at full plate.*

---

## 1. The concept

**The Showing.** The wall is the workroom's: the day's work pinned to
pattern-cutting paper in dealt bands, the way a cutter lays a marker — mostly
racks, and once per band a plate that takes the turn. Scrolling is the
procession: newest first, month seams as chapters, a hem at the end with one
quiet next step. It takes Instagram's actual mechanism — a strict metronome of
uniform cells with one accent per band, side alternating — and leaves
Instagram's ranking on the floor: here the metronome is earned by arithmetic a
person can check against the page. A wardrobe whose look renders small can be
told exactly why, and the reason is a calendar, never a crowd.

## 2. Grid mechanics

### 2.1 Columns per breakpoint

| Viewport | Columns | Unit (chunk) | Turn indices (`i` in the tiles array) |
|---|---|---|---|
| 320–767px (incl. 375) | 2 | 5 | `i % 5 === 0` |
| 768–1023px | 3 | 6, mirrored (cycle 12) | `i % 12 ∈ {0, 7}` |
| 1024px+ | 4 | 9, mirrored (cycle 18) | `i % 18 ∈ {0, 11}` |

Four columns is the cap — a fifth turns looks into stamps. Column count comes
from **one `matchMedia` pair** (`(min-width: 768px)`, `(min-width: 1024px)`)
resolved at render; crossing a breakpoint re-deals the wall **without
animating tile positions**.

### 2.2 The band templates (spans)

One `<ul>`, `display: grid`, `gap: 12px`, `grid-auto-flow: row` — never
`dense`, never `order:`, never column masonry. Racks carry
`aspect-ratio: 4/5` on the image region plus a fixed caption; **the turn
carries no aspect-ratio** — it stretches to the rows the racks define. Racks
legislate row height; the turn obeys.

- **2 columns, unit of 5:** `[turn: col-span-full, natural height]` then
  `[rack ×4]` in two rows. No row spans at all on the phone — the cheapest
  mechanism at the width that needs it most.
- **3 columns, unit of 6, mirrored per repeat:** band A is DOM
  `[turn (cols 1–2, row-span 2), rack → r1c3, rack → r2c3]` then one plain
  row of three. Band B mirrors: DOM `[rack → r1c1, turn pinned
  grid-column: 2/4 (row-span 2), rack → r2c1]` then one plain row of three.
  Only the turn is pinned; the auto cursor never back-fills; reading order
  stays monotone.
- **4 columns, unit of 9, mirrored:** band A `[turn (cols 1–2, row-span 2),
  rack ×4 filling cols 3–4 over two rows]` then one plain row of four. Band B
  mirrors with the turn pinned `grid-column: 3/5`.

Rack row height closes exactly: `1.25 × column-width + 52px` (caption, §3).
Nothing is measured; nothing waits on a decode.

### 2.3 The deterministic size grammar

`variantFor(i, total, cols) → 'rack' | 'turn' | 'turn-r'` — a pure function
of position in the tiles array, rendered as `data-variant`. It reads the
index, the total, and the column count; **never** the post's kind, content,
author, recency weight, or any popularity signal (none exists). Looks,
pieces, drawn flats, and pinned notes take the turn on equal terms.

The reason a person whose look renders small can be given, verbatim: *your
look sits in a rack because of when it arrived, nothing else — every band
deals one turn, and time alone decides what takes it.* The law's sentence and
its corollary (above) are the whole apparatus; both are printed in docs and on
any future settings surface, and acceptance requires that a person who has
not read the code can predict any tile's class from the rendered page.

**Tail guard:** at a turn index the tile is promoted only when the turn-band
behind it can fill — at 3 columns only if **≥ 2 tiles follow** in the band, at
4 columns only if **≥ 4 follow**; the phone's full-width turn never demotes
(a complete row by construction). Otherwise the tile renders as a rack and
the final row rags naturally. A rag at the hem is a rag, never a hole.

### 2.4 How the pattern changes with scroll depth

The turn's side mirrors per band repeat — left, then right, by arithmetic.
The 3-column unit is 6 (not 9) precisely so the mirror shows by tile seven:
a realistic alpha wall of twelve posts renders the one dynamic the owner
pointed at. The arrangement is **fixed once laid**: same day, same wall — the
date seed rotates *which* guests appear, never *where* anything sits. No
re-deal on reload, no per-scroll randomness, tiebreaks included.

### 2.5 The guest step-aside (the backward swap)

`interleaveCommons` stays exactly as shipped and **layout-blind** (the node
suite and the native app import it). It places guests at output indices
`6k + 5`; collisions with turn indices are therefore arithmetic, not edge
cases — on the phone at `i ≡ 5 (mod 30)`, at 4 columns every third guest;
3 columns never collides. The mechanism, applied in the page's tiles array
after interleaving:

> For each turn index `t`: if `tiles[t]` is a guest, swap `tiles[t]` and
> `tiles[t−1]`.

Invariants, each proven against the source: `t−1 ≥ 4` always exists and holds
a real post; `t−1` is never itself a turn index at any breakpoint; no cascade
(swap sites are ≥ 18 apart); no two non-real tiles are ever adjacent after
swaps; no twelve-slot window holds more than two guests; real posts keep
their relative order — **a look never changes position because of a guest**;
a guest never opens or closes the run. The **forward swap is refused** (it
stacks two non-reals in one window of six and can hand a guest the closing
tile). The swap is deterministic within the day.

### 2.6 Month seams

The deal runs **continuously** — it never resets at a seam (a reset would let
posting cadence buy prominence: post rarely, headline always). The seam
prints at the **next band boundary** after the pour crosses a month; its
label is the month and year of the next band's first real post; the misfiled
run above a seam never exceeds one band. One seam per boundary even when
several thin months are skipped. Seams are computed after the swap **from
real posts' dates only** — guests are month-transparent and can never create,
move, or straddle a seam. A month emptied by a chip or search prints no seam.

The element: `<li role="separator" aria-label="July 2026">`,
`grid-column: 1 / -1`, fixed height 36px — one `.basting` hairline with the
month word set on it in `type-ledger` 11px, uppercase, tracked, left-aligned
to the grid margin: `JULY 2026`. A locator, never a header. **It is not a
tile**: it takes no index, and no variant or swap arithmetic can see it. No
structural CSS selector (`nth-child` and kin) may drive variants — the seam
would shift it; variants come from the array index alone.

Seams are a deep-archive feature. Twelve posts from one August produce zero
seams and that is correct; nobody "fixes" their absence with day seams, which
would shred a twelve-tile wall.

## 3. Tile anatomy

All tiles: `bg-surface`, `.plate` edge, `rounded-[2px]`, whole tile one
`<Link>` to `/explore/:postId`. Photographs sit on flat `bg-mat`; nothing
decorative behind clothing. **No cell ever crops the 4:5.**

**The caption block, fixed in pixels** (this is the zero-shift contract):

| Region | Composition | Height |
|---|---|---|
| Rack caption | 6px rest · name line, Switzer 14px/20px, truncate · 2px · **ledger row, fixed 18px flex row** · 6px rest | **52px, declared** (`h-[52px] overflow-hidden`) |
| Turn caption | 8px rest · name, Fraunces 20px/26px, up to two lines, clamped · 2px · ledger row 18px · 8px rest | phone: **fixed 88px**; 3/4-col: `flex: 1; min-height: 88px; overflow: hidden` |
| Seam | one basting line, month word | **36px, declared** |

The ledger row (one line, never a third): the **author monogram** — the
existing `TagPortrait` at 16px, initials on a garment tag, never a face —
then the ledger text in 11px Plex Mono, vertically centred. The tag appears
only when the visible wall holds more than one author (on a single-author
wall it is noise); when shown it is identical in size for every author,
unconditional, and never ordered by. **The date never truncates**: the
occasion yields first, then the author's name; the date and the `· sample`
suffix always stand, at 320px included. Empty paper below a short ledger line
is the brand, not a defect. 11px mono remains non-interactive metadata;
everything tappable stays ≥ 13px. The turn's ledger spells the author's name
in full beside the tag.

Per kind:

- **Look tile** — image region: `LookThumb` as shipped (photograph, or the
  drawn `GarmentPlate` flat when none exists), 4:5. Ledger:
  `occasion · date` (+ `· sample` for sample personas). In the turn, the
  whole 4:5 at double width — the flat takes the turn on photograph terms,
  line-work at double scale on flat mat, nothing decorative behind it.
- **Piece tile** — image region: the piece photograph or its `GarmentPlate`
  flat, 4:5. Ledger: `category · date`, category read through
  `sharedCategoryLabel` (house defaults, never the reader's renames).
- **Pinned note (words-only post)** — the same outer geometry as a rack: a
  4:5 face plus the 52px caption. The words are the look; no photograph is
  faked. Face: Fraunces italic **20px/26px, clamped to four lines**, centred
  on the mat — the Fraunces floor is law; the shipped 17px tile is a defect
  this spec corrects, not a precedent; below the floor the type becomes
  Switzer, it never shrinks. In the turn: 24px/32px, clamped to six lines, a
  pull-quote in a spread. Caption: name line stays empty paper; ledger row as
  standard (tag where due · date · `· sample` where true).
- **Guest (from-the-commons sample)** — rack cells **only**, never the turn,
  not even under its own chip. Dress: **dashed** hairline where residents
  wear solid; a selvage strip down the image edge setting `COMMONS_LABEL`
  vertically in 11px `type-ledger`; the caption keeps the shipped ledger
  `from the commons · sample`; **no monogram tag** — a tag would dress a
  sample as a person. Video guests show the poster frame only
  (`preload="metadata"`), never autoplay; playback lives on the detail route
  with controls. The existing aria-label
  (`{caption} — from the commons, a sample`) stands. The 1-in-6 interleave
  cap, never-adjacent, and real-opens/real-closes all stand untouched
  upstream.

## 4. Search and chips

Placement is unchanged and standing: masthead (`N on show · M guests`, guests
never counted as looks) → the one boxed search input, exactly as the closet
wears it → the `TagRail` chip rail → the wall. Search filters within the
resolved entries and returns **standing order**; chips are single-select
questions; ranking stays refused.

**The search hay grows three facts**, all read from data already inside the
aperture, no schema change, no migration:

1. **Colour words.** A small hue-word mapper (`hueWords(hex)`, ~14 house
   words: red, carmine, navy, blue, green, cream, oatmeal, tan, brown, black,
   grey, gold, pink, white) quantizes `SharedPiece.color` and joins the hay.
   Stated limit, honest and enough for the alpha: **looks match colour only
   through their piece names** — `SharedLook.pieces` is names-only by consent
   design, and nobody widens it for this feature (that would be a schema
   change, a migration case, and a wider aperture: three vetoes in one).
2. **Month words.** The post's date as long and short month name plus the
   year string ("march", "mar", "2026") — seams get you near March; this gets
   you to the wedding.
3. Everything already in the hay stands.

**Chips**, in rail order: `Everything` · `Looks` · `Pieces` · one per house
category present among visible piece posts · one per occasion among visible
look posts · `From the commons`. The Looks/Pieces pair appears only when both
kinds are present on the wall — chips offer only questions whose answers
differ from Everything. **Colour chips are deferred** until the mapper has
proven it does not call a dusty-rose camisole pink to its face; a search word
is forgiving, a chip is a claim. Guests ride only under Everything (capped
interludes) and From the commons (an all-rack room — no turns for samples
even in their own room); never inside a question about clothes. The query
runs through `useDeferredValue`.

## 5. Motion

**What moves:** one entrance fade per tile — opacity only, 160ms ease-out,
fired once by a single shared `IntersectionObserver`, never re-fired on
re-scroll. Nothing else. The `animation-timeline: view()` garnish proposed in
round 1 is **refused** (the artist's veto, sustained): the house's motion law
is one entrance, once; a wall that performs on every scroll is Instagram's
nervousness in our clothes, and the static composition is the deliverable.

**What never moves:** tile positions and sizes after the deal; the
arrangement on reload (same day, same wall); layout on filter change,
breakpoint crossing, or prepend — no FLIP, ever; no scroll-linked animation,
no parallax, no pulsing skeletons, no spinner at the foot; grid video never
plays.

**Reduced motion, the full answer:** the entrance fade does not run — tiles
are simply there, in pattern, layout identical to the animated page in every
pixel. The liveliness of The Showing is compositional (the bands, the turn,
the mirror, the seams), so the reduced-motion page is not a degraded mode; it
is the same page at rest, and it is also the screenshot.

## 6. Accessibility

- One `<ul>`; tiles are `<li>`; **DOM order = chronological order = reading
  order = tab order**, turns included. Seams are `role="separator"` list
  items with an `aria-label`, not focusable.
- The whole tile is a single link — target far exceeds 44px; the clear-search
  button stays 44×44; chips keep their ≥ 13px labels.
- Focus visibility: the house `:focus-visible` treatment — a 2px
  `--color-accent` outline, offset 2px, on the tile link; never removed, never
  clipped by `overflow: hidden` (outline sits outside the clip).
- The turn carries no special semantics: size is presentation, and announcing
  it would imply a standing the law forbids.
- Images keep their `alt` (the post's name); guest labels as §3. AA contrast
  in both light and dark rooms; tokens only, no new colors anywhere in this
  feature.

## 7. Performance budget

- **≤ 4KB new min+gz JS, zero dependencies.** `variantFor` + swap + seams +
  the observer hook + the hue mapper ≈ 2KB. No scroll listeners; the one
  named `IntersectionObserver` (§5) is the only scroll-adjacent JS.
- **CLS = 0 by construction:** every image lives in an `aspect-ratio` box;
  captions and seams are fixed pixel heights (§3); the turn stretches to
  row-defined height; nothing is measured, no layout waits on a decode.
- `content-visibility: auto` on rack and pinned-note tiles with
  `contain-intrinsic-size: auto <w> <h>` per variant — rough fallbacks
  computed from the breakpoint's nominal column width
  (`h = 1.25 × w + 52`), one utility class per variant in `src/index.css`.
  The `auto` keyword makes the engine remember true rendered sizes; fallback
  error on never-rendered tiles moves the scrollbar, not CLS. The 2×2 turn
  takes none (row-constrained); the phone turn takes `auto` with a rough
  fallback. No container-query machinery.
- **Fonts:** add `@font-face` fallback overrides with `size-adjust` (and
  ascent/descent where needed) for the Georgia, system-ui, and Menlo stacks
  in `src/index.css` — none exist today, and Switzer arrives over the
  network, so the swap shift is real. Without these the fixed-pixel caption
  contract is fiction.
- Images `loading="lazy" decoding="async"`; guest videos poster-only. The
  page body never scrolls horizontally.

## 8. Empty, sparse, dense

The lay begins at **five** entries. Below five, entries hang as a single
centred column of full plates — `width: min(100% − 32px, 400px)` (≈ 288px at
320px, a gallery wall at desktop) — wearing the turn's caption dress: with
four things there is room to speak. `interleaveCommons` admits no guest
before a sixth real exists, so 1–5 is real-only by construction: **never pad
a young wall with samples.** A thin wardrobe shown small in a void reads as a
verdict, and the house does not do shame mechanics.

| Tiles | The wall |
|---|---|
| 0 | The existing `EmptyState` stands verbatim — many testers' first screenshot; leave it alone. |
| 1 | One full plate, centred column, hem beneath. |
| 3 | Three plates, centred column, hem. |
| 5 | The lay begins: phone, one complete unit (turn + four racks); 3-col, turn band + a two-rack rag; 4-col, the turn band exactly. |
| 9 | Phone: two units minus one; 3-col: band A + a plain row of three (the index-7 turn demotes via the tail guard — only one tile follows). |
| 12 | md+: one full mirrored cycle — **both turn sides visible**; this is the acceptance still. |
| 150 | Seams appear where months cross; `content-visibility` earns its keep; still one list. |
| 500 | Same page: no pagination, no load-more, no windowing library; the hem still ends it. |

**The hem**, in every state, outside the `<ul>`: the last band renders whole,
then a basting rule and one calm sentence with **exactly one quiet action**
(a plain `LinkButton`, never the accent fill — the hero fill belongs to
log-wear):

- Unfiltered: **"That is everything on show."** → *Build a look to share*
  (`/outfits`). A creation verb — closure that hands the reader a needle, not
  the top of the stairs; back-to-top is not the hem's offer.
- Any chip or search active (the commons room included): **"That is
  everything that answers."** → *Show everything* (clears query and chip).

No load-more, no pull-to-refresh, no spinner. New posts take the top of the
spine on the next visit, unannounced.

## 9. The stress-test list (QA)

Expected behavior stated for each; the arithmetic ones live as node
assertions in `scripts/test-showing.mjs`.

1. Same day, same viewer, two reloads — identical tile order and sizes,
   including after a guest swap fired.
2. No engagement data exists in any fixture; layout is a function of index
   arithmetic only — this test keeps it that way.
3. Sampled month of dates × cols {2, 3, 4} × filter states: no guest at any
   turn index after swaps; no two non-real tiles adjacent; ≤ 2 guests per
   twelve-slot window; real posts keep relative order; on 320px no guest tile
   is ever full-width.
4. Hole check, totals 0–60 × every column count: no cell gap above the final
   row; the rag may only be the last row (tail guard).
5. Exactly five entries: phone unit closes; 3-col turn band + two-rack rag,
   no hole; 4-col turn band closes — five is the promised threshold.
6. A twelve-post wall at md+ shows both turn sides (the mirror renders).
7. Seams: positions identical whether or not a guest slid nearby; never
   mid-band; misfile ≤ one band; a month emptied by a filter prints none;
   label matches the next band's first real post; a run of skipped thin
   months yields one seam.
8. Final row whole + hem line + the correct sentence at 320px and desktop,
   under every chip and search state, including one result and the commons
   room.
9. Tab order = reading order = chronology, turns included;
   `role="separator"` seams skipped by focus.
10. `prefers-reduced-motion`: zero animation, layout pixel-identical.
11. No `autoplay`, no scroll-linked animation, no foot spinner — grep the new
    files; the one `IntersectionObserver` fires the fade once.
12. Crossing a breakpoint re-deals without animating positions.
13. Ledger truncation at 320px: the date never truncates, `· sample` never
    truncates, occasion yields first; the monogram appears only on
    multi-author walls and is identical for every author.
14. Words-only tiles: nothing editorial below 20px Fraunces (or it is
    Switzer); the shipped 17px tile is corrected.
15. Fonts: with the metric overrides in place, webfont arrival causes no
    visible reflow; a DevTools CLS trace over a 60-tile wall reads ≈ 0.
16. Colour search: "navy" finds navy pieces through the mapper; looks match
    colour only through piece names (fixture asserts both directions); the
    mapper's word table has its own unit tests.
17. Month search: "march", "mar", and the year each find the post.
18. Consent: a fixture with a `self`-scoped post whose caption matches the
    query never appears — the Explore set equals the `postVisibleTo` set,
    before and after this redesign.
19. The no-counts grep over all new files: no metrics, seen-state, or badges
    rode in.
20. A panel member who has not read the code predicts any tile's class from
    the rendered page using only the printed size law.

## 10. Build notes

**Components touched — these and no others:**

- `src/pages/Explore.tsx` — the page, rewritten around the tiles array:
  `resolveFeedEntries` → filters → `interleaveCommons` → **backward swap** →
  `variantFor` as `data-variant` → seams → the wall → the hem. `PostTile` /
  `GuestTile` take the §3 anatomy (52px caption, 18px ledger row, 16px
  `TagPortrait` from `art.tsx`, dashed guest dress, selvage strip); the
  pinned-note type is raised to the floor; the search hay gains colour and
  month words; the rail gains Looks/Pieces; sparse renders the centred
  column; columns come from the one `matchMedia` pair. `OnShow` (the detail
  route) stands as shipped.
- `src/components/social.tsx` — **no change this round.** `LookThumb`
  already deals the 4:5; `PostCard` and the feed are untouched. If a future
  surface wants the caption block shared, extraction is its own ticket.

**Support files** (named so nothing else is touched): `src/lib/showing.ts`
NEW — framework-free like `bufferFeed.ts`, exporting `variantFor(i, total,
cols)`, the swap, the seam computation, and `hueWords(hex)`, all pure and
node-testable; `scripts/test-showing.mjs` NEW — the unit tables and the §9
assertion loops; `src/index.css` — the variant intrinsic-size utilities, the
seam dress, the `size-adjust` fallback overrides. **Never touched:**
`interleaveCommons` / `bufferFeed.ts` (layout-blind, imported by the node
suite and the native app), `resolveFeedEntries` (the one door), `Feed.tsx`,
the `EmptyState`. No `AppState`/`CommunityState` change, therefore no
migration case. Verify: `npm run verify`, `test:flows`, `test:features`,
`check-brand` green.

**The declared fallback**, in the drawer and not invoked: if implementation
falsifies any band trace in §2.2, retreat to the column-spans-only grammar —
the phone loses nothing, desktop loses only the 2×2; the law's sentence still
holds.

---

## The record — arbitrations and refusals

Accepted amendments, folded in above: the reworded size law (advisor C1,
marketing's final copy); the backward swap (C2, ratified as law by Customer
B); seams at the next band boundary (C3, bounded by B); fixed-pixel captions
plus `size-adjust` (C4); the 3-column unit shortened to 6 (C5 — also
collision-free, verified); colour-in-search and month-word-in-search (C6, via
Customer A's honest hue-word mapper and B's recovered ask); the monogram as a
16px tag inside the fixed 18px ledger row (A's spec, inside the tech lead's
fixed-height contract — the third-line form stays vetoed); the hem's creation
verb and the filtered hem's honest copy; the Fraunces floor on pinned notes;
the tail guard as an acceptance test.

Refused, with the ruling seat: the 1×2 tall cell (crops the 4:5 — Customer
B's law; the artist buried it); deal-reset-per-month and day seams (psych
vetoes V2/V3); the `view()` scroll garnish (the artist's veto, sustained at
the artistry tier); the forward swap, `nth-child` variant arithmetic, the
monogram as a third line, `dense`, `order:`, masonry, FLIP, aspect-ratio on
the spanning turn, five columns, re-tuning `interleaveCommons`, any span
from popularity (tech lead and research, standing vetoes); the data-plan
line on this surface (marketing veto + psychology — reassurance belongs
where the anxiety arises; relocate to the alpha kit, `docs/37`, its own
ticket).

Deferred with named destinations: **colour chips** — after the mapper proves
itself (Customer A's own call); **the set-aside shelf** — a `docs/33` backlog
line with the destination A named: a private "Set aside" chip on this rail
when the shelf ships. With colour, month words, the monogram, and the
Looks/Pieces chips in, Customer A's wallpaper clause is answered and her
conditional veto is satisfied: this ships as a showing, not as wallpaper
over a file manager.

---

## Errata (2026-08-20, from the stress suite's findings — each verified by measurement, ruled by the lead)

**E1 — §2.5's guest-window bound corrected.** "No twelve-slot window holds
more than two guests" is arithmetically false under the ratified mechanism
itself: guests at 6k+5 give two per window, and a backward swap at a window's
right edge slides a third in. The mechanism is the law; the bound is amended
to what the suite proves: **at most two guests per twelve-slot window before
the swap, at most three after**, with adjacency, ratio, order and open-close
invariants unchanged.

**E2 — §3/§9.13: the tag yields on two-column racks.** The promise that the
monogram tag, the date, AND `· sample` all stand at 320px is geometrically
unsatisfiable (measured: 124px of unyielding content in a 109px row). A
sample that cannot say it is a sample breaks an owner law (docs/35), which
outranks the tag — identity is one tap away. Amended dress: **two-column
racks wear no monogram tag**; the turn keeps its tag and full author name at
every width; racks keep the tag from three columns up.

**E3 — §8's sparse width meant the visible plate.** The literal
`min(100% − 32px, 400px)` double-inset the plate (the page column already
carries the house gutter), landing 241px where the spec's own parenthetical
predicted ≈288px. The parenthetical was the intent: the plate is
**`min(100%, 400px)`** of the column.

**E4 — noted, accepted.** Guest tiles keep the house-wide link transition
while resident tiles override it via `.plate` — a press eases on a guest and
snaps on a resident. Not a §5 violation; recorded so nobody rediscovers it.

**Enforcement note, not an erratum:** §6's focus ring was right and the house
CSS was wrong — the three mounted rooms' decorative `.plate` outline outranked
`:focus-visible` at (0,3,0) vs (0,1,0), leaving keyboard focus invisible
house-wide in dyehouse, gilt and obsidian. Fixed in `src/index.css` with
`:not(:focus-visible)` on every mounting rule: the frame steps aside while the
ring speaks.
