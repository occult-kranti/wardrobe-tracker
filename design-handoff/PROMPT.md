# Toile — artwork design brief for a vision-language model

You are looking at 28 screenshots (`pages/`) of **Toile**, a local-first wardrobe
ledger: every route, desktop full-page and mobile, signed in as a sample user
with 61 pieces and nine months of history. Your job is to DESIGN artwork the
house's engineer will then hand-code as SVG. You produce **drawings and exact
specifications**, not code.

## The house, in brief

Letterpress stationery, not a tech product: pattern-cutting paper grounds, a
grid of small crosses, hairline borders, tag-shaped chips with punched eyelets,
a wax seal. Five colour themes ("rooms"): cream, greige, rose-and-gold, dark
plum-rose, near-black. All ornament is **line work** — no fills, no gradients,
no rasters, no drop shadows, radius 2px everywhere. Two line metals per room
(gold+pewter, silver+gold, bronze+brass...). Existing ground art: a frieze of
closet furniture from seven cultures (tansu, armoire, sandook, almirah,
wardrobe, yìguì, bandaji) with Mughal buta flower sprigs and a Rajput bird;
Mughal cusped-arch corner ornaments on cards; a kakemono double mounting in two
rooms. Icons: 24×24 technical flats, 1.5px stroke, one 45° "pattern notch" in
the north-east quadrant, never a human body, never emoji.

## What to design (in priority order)

1. **Household marks** — three small emblems for a new feature: wardrobes on
   this device joined as *roommates*, *partners*, or *family* (one person can be
   in all three). Each mark must: read at 20px and at 44px; contain NO human
   figures, NO hearts, NO gendered signal; be built from the house's furniture/
   tailoring vocabulary (hangers, rails, tags, pegs, thread); carry exactly one
   pattern notch when used at icon size. Suggest one mark per kind plus a
   generic "household" mark.
2. **Empty-state plates for the social pages** (~200×160 line drawings, one
   accent detail each): Feed (no looks shared yet), Conversations (no threads),
   Events (nothing planned), Profile (no record), Household (none formed yet).
   Current pages reuse plates from other features — see feed/chats/events
   screenshots.
3. **Per-page ground-art refinements** — look at each screenshot's bottom
   frieze and top rail; propose better compositions page by page (which
   furniture, which side, what density) where the current hang fights the
   content. Calendar and Ledger are the tightest.
4. **Anything you would redesign** — argue it in one paragraph per item, ranked.

## Required output format (the engineer needs ALL of this)

For EVERY piece of artwork you design, deliver:

- **A rendered image** of the drawing (any raster format is fine for review).
- **Geometry spec**: viewBox (use `0 0 460 560` for furniture-scale pieces,
  `0 0 200 160` for plates, `0 0 24 24` for marks); every path as coordinates
  or a precise construction description (e.g. "cornice: rect x64 y78 w332 h16").
- **Stroke registers**: which lines are *structure* (width 2.5, opacity 0.30),
  which are *detail/cloth* (width 2, opacity 0.38), which are *ambient*
  (width 2, opacity 0.20). Butt caps, miter joins. Curves only for cloth,
  hooks, rings, domes — structure stays rectilinear.
- **Colour**: name NO colours. Every stroke is `var(--color-artline)` or
  `var(--color-artline-2)` (the room decides). State which lines take metal 1
  vs metal 2.
- **For icon-size marks**: coordinates snapped to a 0.5 grid inside a 24×24
  frame, 20×20 live area, 1.5px stroke, and the position of the single NE
  pattern notch.
- **Negative space plan**: where page content will overlap the art (see the
  screenshots — cards sit on top of ground art), and which parts of your
  composition survive being 70% hidden.

## Hard constraints (a design violating these will be discarded)

- No human bodies, faces, or silhouettes. No gendered signal anywhere.
- No fills, no gradients, no shadows, no photorealism — line only.
- No brand logos, no text other than specified labels.
- Cultural furniture must be drawn with its real construction details (an
  almirah has a mirror strip and a hanging padlock; a bandaji has iron hinge
  plates and nailheads) — never a generic cupboard relabelled.
- Nothing may sit BEHIND a garment photograph — artwork surrounds content.

Deliver as: one section per artwork, image first, then the specs. The engineer
will transcribe your geometry into hand-coded SVG and measure contrast floors,
so precision beats beauty where they conflict.
