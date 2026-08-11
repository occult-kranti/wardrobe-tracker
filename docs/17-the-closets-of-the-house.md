# The closets of the house — five cultures on five grounds

*Added 2026-08-11, at the owner's direction: different types of closets and
drawers — almirah, sandook, wardrobe — open and closed, from different
traditions, named in different languages, in all themes; multiple per room so
the page's own content never hides all of them; gold, silver or bronze in the
dark rooms; and border curves after Mughal and Rajput art.*

## The five closets

Every culture that keeps clothes built furniture for it, and the furniture is
never the same twice. Five of them, drawn in the house line (structure
rectilinear, curves for cloth and for what is genuinely round), each named in
its own language as ground typography:

| piece | culture | the tell | word |
|---|---|---|---|
| **Wardrobe** | English | panelled doors, cornice, plinth; one door ajar on a rail | WARDROBE |
| **Armoire** | French | arched bonnet crown, curve-top panels, cabriole legs | ARMOIRE |
| **Almirah** | Indian | twin doors, mirror strip, latch plate with hanging lock, stamped panels | ALMIRAH · अलमारी |
| **Kaidan-tansu** | Japanese | the staircase chest: stepped drawers, round iron pulls | TANSU · 箪笥 |
| **Sandook** | South Asian / Middle Eastern | low dowry chest, domed lid ajar with cloth spilling, strap bands, ring handles | SANDOOK · صندوق |

## Two per room, for contrast

A single artwork was usually hidden behind the page's own content, so each room
stands two pieces in its deep band — a large one bottom-right, a smaller one
from a *different* tradition bottom-left, fixed to the viewport so the
furniture stands behind the paper while the page scrolls past:

- **Pattern room** — wardrobe, with a tansu
- **Salon** — armoire, with a sandook
- **Gilding room** — almirah, with a sandook
- **Atelier at night** — kaidan-tansu, with an almirah
- **Dye house** — sandook, with a wardrobe

## The metals

The owner asked: gold, silver or bronze in the dark rooms, whichever reads
best. Measured against the grounds:

- The light rooms keep their own golds (ochre, antique brass, leaf).
- **The atelier at night is struck in SILVER** (`#B4BEC3`) — the Rinpa silver
  screen rather than the gold one. Gold linework on ink cloth reads as
  yellowed varnish; silver reads as moonlight, and it is the one metal that
  belongs to that room's chalk-and-ink register.
- **The dye house is struck in BRONZE** (`#C98A4B`) — brass fittings darkened
  by vat steam. Gold there fought the seal; silver went cold against the plum.

## The Mughal corners

Every room's plates now carry border art: the **multifoil (cusped) arch** of
Mughal and Rajput building — the profile of a jharokha opening — quartered into
a corner ornament. An outer frame quadrant, and an inner run of three cusps
stepping through the turn. Placed top-right and bottom-left, where card content
is thinnest, in each room's own metal, at line weight and opacity that keep it
an ornament of the *border*. The gilding room and dye house keep their kakemono
double-mounting as well; the cusped corners sit inside it.

The standing rules hold throughout: no ornament behind a photograph (§6.1 — the
artwork surrounds the photo grid, the mats stay flat), metals are decorative
and never text (§2), no room is named for a person (§2.7), and the script
typography names furniture, never people.


## Superseded the same day: the frieze

The owner asked for more than one piece per room, and for the owner's own name
in the art. So the per-room pairs became **one frieze of all seven cultures** —
tansu, armoire, sandook, almirah, wardrobe, and two new pieces: the Chinese
**yìguì** compound cabinet (twin doors, the great round brass lockplate) and the
Korean **bandaji** blanket chest (drop-front door, iron hinge plates, nailhead
studs) — standing in a row behind every page, largest overlap at the shoulders,
the way furniture actually stands in a godown.

Over each piece, the open wardrobe's own name in that culture's language:
*Meher's wardrobe · L'armoire de Meher · Meher की अलमारी · Meherの箪笥 ·
صندوق Meher · Meher的衣柜 · Meher의 반닫이.* Because the name is in the art,
the frieze is a live component (`GroundFrieze` in art.tsx), not CSS — and it
recolours per room through a single new token, `--color-artline`: gold ochre in
the pattern room, antique brass in the salon, the leaf in the gilding room,
**silver** in the atelier at night, **bronze** in the dye house. One artwork,
five colour theories, which is what was asked: "just need to change the color
theory for each theme."

In the same pass, the elements gained their own ground: the closet and outfit
photo grids now sit on a muslin plate (which §6.1 had always technically
required — the pattern crosses were ornament behind the photo grid), picking up
the kakemono mounting and Mughal corners in the rooms that carry them; and the
primary and hero buttons carry a **zari weave** — a diaper of thread-dots in the
fill's own label colour at 12%, drawn with token-following gradients so it holds
in all five rooms and shifts no measured ratio.
