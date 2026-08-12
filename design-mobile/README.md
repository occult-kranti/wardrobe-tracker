# Toile mobile — the atelier pack

The uploaded mobile UI/UX design (`new_mob_design.zip`) built as living HTML.
Fourteen screens, hand-coded to the pack's own contract: every render in
`pages/*/render.png` and every rule in `foundation/design-system.md` is the
target; nothing here is app code.

**Hosted:** https://occult-kranti.github.io/wardrobe-tracker/mobile_version_v1/
— built by `npm run build:gallery` and published beside the app on every
deploy. It walks the fourteen screens in the order the product is met, scales
each phone to fit whatever it is opened on, swipes on touch, and carries a
**See the moment** toggle so the art moments are reachable rather than buried
below the fold.

**Locally:** `node design-android/serve.mjs` → http://localhost:4200/ — this
pack sits at the top of the sidebar as **Mobile revamp**, with the Android
pack below it. ←/→ walks the screens; the room bar re-dresses any screen into
Atelier, Pattern room, Gilding or Dye house.

## The house

Letterpress stationery, not a tech product. Every ornament is line work —
no fills, no gradients, no shadows, radius 2 everywhere, and exactly two line
metals per room (`--line` and `--line-2`). The ground is pattern-cutting
paper with its grid of small crosses; plates are hairline frames whose
corners are cut at 45°; chips are tags with punched eyelets; the day's
record is closed with a wax seal. **No bodies, ever** — not in ornament, not
in the garment photography, which stays flat-lay or on-hanger.

Artwork surrounds content and never sits behind a photograph.

## The storage cast

Furniture owns features, and appears as line art at that feature's moments:

| Furniture | Owns |
|---|---|
| Wardrobe (rail behind doors) | Closet grid, categories |
| Dresser (chest of drawers) | Settings — one drawer per module |
| Almirah (mirror strip + padlock) | Profile; the padlock says "this device only" |
| Sandook (lidded trunk) | Resting pieces, archive, backup |
| Armoire (panelled, corniced) | Events — grand doors for grand days |
| Tansu (iron hardware) | Ledger, cost-per-wear — the merchant's chest |
| Bandaji (hinge plates, nailheads) | Shared Rail — built to travel between houses |
| Yigui (tapered, centre stile) | Wishlist, Before You Buy — considered, not yet admitted |
| Kakemono (hanging scroll) | Feed — a look hung for viewing |
| Hanger · tag · thread · wax seal | The verbs: add, log, plan, share, undo |

## Art moments

Line art appears **on action**, then settles into the ground — 300–900ms of
draw-on, strokes only, no physics cartooning:

log a wear → the seal stamps and a ledger line rules itself · undo → the seal
lifts, the thread un-ties · add a piece → a tag is punched, strung, tied to a
hanger · draw a set → hangers slide the rail and stop · wishlist → a parcel is
wrapped, the yigui door left ajar · verdict → a balance settles · share → a
kakemono unrolls · borrow → a hanger travels rail to rail · event planned →
armoire doors open on a cusped arch · export → a drawer slides out, a ribbon
ties · category quieted → a drawer closes softly.

## The rooms

Atelier (near-black, the room the renders are dressed in), Pattern room
(cream paper), Gilding room (rose and gold), Dye house (dark plum-rose). The
choice belongs to the screen, not the wardrobe. Seasonal overlay packs —
Mughal, Rajput, Gothic, Japanese — re-draw only ornament; structure, type and
spacing never change.

## The screens

`mockups/` — each file shows the screen at rest and, where the spec names
one, the same screen mid-art-moment, captioned:

Today · Closet · Outfits · Calendar · Ledger · Wishlist · Before You Buy ·
Events · Feed · Conversations · Profile · Shared Rail · Settings · Wardrobes

`foundation.css` carries the whole system: rooms, ground, chamfered plates,
corner brackets, rules and leaders, tag chips, buttons, the seal, stat grids,
bars, and the shell (top bar and five-slot tab rail).

## Source

The uploaded pack is preserved outside the repo; its renders are review
concepts, and the geometry in its `artwork/` folder is authoritative for
hand-coded SVG. Where a render and the design system disagreed, the design
system won.
