# Design Critique — pixels, not code

A principal-designer review of real screenshots (all 8 routes, mobile + desktop,
populated + empty) against `docs/05-brand-identity.md` and
`docs/06-focus-group-requirements.md`.

**Status:** findings 1, 2, 5, 12, 13, 25, 33 are **fixed**; finding 3 was a
false positive (verified in source) (see the commit that
adds this file). Everything else is open and is the best available worklist for
the next session — the three "highest-leverage changes" at the bottom are the
recommended order.

Screenshots regenerate with `npm run shots`.

---

# TOILE — Design Critique from Real Pixels

Verified against `docs/05-brand-identity.md` and `docs/06-focus-group-requirements.md`. Coordinates are approximate positions in the named screenshot.

---

## P0 — Broken or illegible

**1. Mobile nav labels are 9px mono — 4px below the contract's own floor, wrong face, and they break the rail.**
`src/components/Layout.tsx:161` → `<span className="type-ledger text-[9px]">{item.label}</span>`
Contract §4: nav is **13px Switzer 600 caps +0.08em**, with an explicit note that "12px was below the legibility floor." Shipping 9px IBM Plex Mono is the single worst legibility call in the app. Because mono is wide, `Before you buy` then wraps to two lines (`compare-mobile.png`, bottom rail; also `dashboard-mobile.png` y≈815), pushing that slot's icon ~7px above its four neighbours and crowding `OUTFITS` and `MORE`.
**Fix:** `type-nav` (Switzer 600, 13px, caps, +0.08em); add `shortLabel: 'Compare'` to the `/compare` entry at `Layout.tsx:20` and render `item.shortLabel ?? item.label` in the rail only.

**2. The active-nav eyelet dot is positioned against the wrong ancestor.**
`Layout.tsx:162` → `<span className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" />`. The `<Link>` is not `relative`, so the dot resolves against the `fixed` `<nav>`. In `compare-mobile.png` it lands **below and right of "BUY"**, unattached to anything — it reads as a stray red pixel, not a state marker.
**Fix:** add `relative` to the Link and `left-1/2 -translate-x-1/2` to the dot.

**3. ~~Filled inputs are indistinguishable from placeholders.~~ — FALSE POSITIVE.**
*Verified in source: "Black wool coat" is the `placeholder` on the name field (`BeforeYouBuy.tsx:246`), not a typed value. Both strings in that row are placeholders, so rendering them identically is correct. `inputClass` already sets value `text-text` and placeholder `text-text-2/70`. No change made.*

Original finding:
`compare-desktop.png`, "WHAT IS IT" / "BRAND" row (y≈370). The typed value *"Black wool coat"* and the placeholder *"Brand, or made by you"* render at **identical colour and weight** (`--color-text-2`). The user cannot tell what they've entered.
**Fix:** `src/components/ui.tsx` `Field`/input — value `text-text` (`#EFE9D9`), `placeholder:text-text-2` (`#A89F8D`).

**4. The empty-state plate looks like a failed SVG.**
`dashboard-empty-desktop.png` / `closet-empty-desktop.png`, centre (~y≈245). At 6× the drawing shows: a measuring tape stroked in a **near-background dark brown** so it vanishes; that tape **cutting through** the shirt's shoulder and a hanger stem; hanger triangles overlapping each other; and **six** scattered carmine ticks floating unattached — contract §6.2 specifies **one** carmine detail. The whole composition occupies only the top half of its box, giving the squashed 155×80 silhouette instead of the spec'd ~200×160. This is the first thing a new user ever sees.
**Fix:** `src/components/art.tsx` `PlateEmptyCloset` — restroke the tape in `currentColor`, route it *behind/around* the garment, collapse the six ticks to one carmine tape-clip, and correct the viewBox so the art fills the plate.

**5. `RESET` is the brightest, most saturated element on Settings — and it destroys everything.**
`settings-desktop.png` bottom right (y≈1640). It uses `--color-danger` `#F297A4` (a **text** token) as a **fill**, with a chalk label on top → roughly 2:1 contrast, unreadable, and it out-shouts every other control on the page.
**Fix:** destructive fill `#8C1B32` + `--color-chalk` label, per §7.

**6. `Paper` / `YOUR DATA` rows collapse to one word per line on mobile.**
`settings-mobile.png` y≈1040–1190 ("Light / is / the / pattern / room; / dark / is / the / atelier / at / night." — 14 lines in a ~30px column) and y≈1240–1400 (Import description, same failure). A horizontal flex row with a fixed-width control and no wrap breakpoint.
**Fix:** the setting-row wrapper → `flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between`.

**7. The Outfits masthead fails entirely at 390px.**
`outfits-mobile.png` y≈60–125. All three masthead slots degrade at once: `6 OUTFITS` breaks to two lines in a ~55px column, `BUILD AN OUTFIT` wraps to two lines inside its button, and the button block overhangs the masthead rule that runs under "Outfits". `wishlist-mobile.png` shows the same pattern in milder form.
**Fix:** `ui.tsx` `Masthead` — stack below `sm`: title + meta on row 1, `action` full-width on row 2. Better still, suppress the page-level action on mobile entirely; the sticky header already carries a global `+`.

---

## P1 — Undermines the brand or usability

**8. Carmine is not reserved for log-wear. It is the app's most promiscuous colour.**
Audit across all 8 screens:

| Screen | Carmine spent on |
|---|---|
| Dashboard | hero button ✅ |
| Closet | **2** filter-chip dots (`EVERYTHING`, `ALL 29`) — no log action present |
| Outfits | **6** `WEAR TODAY` buttons + 1 chip dot |
| Calendar | wear-dot ✅ |
| Ledger | **2** chart bars — no action at all |
| Wishlist | **2** `HOLD IT UP AGAINST THE CLOSET` links |
| Before you buy | **1 carmine paint swatch** in the colour deck |
| Settings | 2 `EXPORT A BACKUP` links |

`outfits-desktop.png` is the worst: **six carmine buttons in one viewport** plus a chalk-filled `BUILD AN OUTFIT` plus the chalk `ADD A PIECE` in the rail. There is no primary; the eye has nowhere to land. §3's "exactly one primary button per view" and "one carmine element per view region" are both broken.
**Fix:** carmine fill only for the log-wear action, once per screen. Outfits: `WEAR TODAY` → primary ink/chalk fill (`Button variant="primary"`), and reserve carmine for the card under hover/focus, or for none. Closet chips: selected = transparent + 1px chalk border + **filled** eyelet ring, no carmine, no chalk fill. Ledger bars: see #10. Wishlist/Settings links: `--color-text` with a 1px underline; keep carmine tertiary for at most one link per page.

**9. The garment tile is empty for ~20 of 29 pieces below the fold.**
`closet-desktop.png` from row 7 down (Gold Signet Ring y≈2330 onward) — every tile is a blank mat rectangle. Same in `closet-mobile.png` from row 7, `ledger-desktop.png` MOST WORN (the app's #1 piece, *Gold Signet Ring, 96 wears*, is an empty box), and the jewellery slots in every `outfits-*.png` strip. Cause: `loading="lazy"` on the swatch `<img>` with nothing painted underneath — on a real phone the user scrolls into a wall of voids that fill in late. Only `Pearl Studs` and `Tan Leather Belt` survive, because those two have no image and fall through to the inline `GarmentPlate`.

Two compounding bugs in `src/components/art.tsx:235–262`:
- `stroke={color ?? 'currentColor'}` — any dark-coloured piece with no photo draws an **invisible** flat on `bg-sunken`. Focus-group §2.5 requires the no-photo state to be first-class.
- `flats` is keyed `dresses` but the taxonomy id is also `dresses` while the UI label is "One-pieces" — that one is fine; however `flats[categoryId] ?? flats.accessories` means anything unmapped, and every accessory, draws the **handbag/padlock** glyph. `Tan Leather Belt` renders as a handbag (`closet-desktop.png`, last row).

**Fix (one change, four screens repaired):** render `GarmentPlate` as the tile's **base layer** and the photo above it, so a tile is never a void; stroke the flat in `currentColor` always (use `item.color` only for a small chip, never the line); drop `loading="lazy"` for the first ~24 tiles; add distinct `jewellery` and `belt`/`bag`/`scarf` flats.

**10. The Ledger is a report card, and the panel banned report cards.**
`ledger-desktop.png`:
- **`WARDROBE IN USE — 93%`** (y≈150) — a giant Fraunces percentage over a full-width completion meter. This is progress-as-achievement, rejected outright in focus-group §2.2 and §2.6.
- **Two carmine bars** (`JEWELLERY` in BY CATEGORY, `JUL` in MONTHLY ACTIVITY). §2.6: *"Stats are neutral territory. No red, no alarm states."* The focus-group doc is a binding amendment and post-dates the brand contract's "one carmine hero bar" — the stricter reading wins.
- **`QUIET LATELY`** is a bottom-5 leaderboard sorted `FEWEST WEARS`, closing with *"Revive it, alter it, or pass it on."* — a prescription. Copy law: *"speaks in data, then stops talking. The user supplies the conclusion."*

**Fix:** delete the `93%` numeral and the meter; keep only the sentence *"27 of 29 pieces have been worn at least once. 2 are still resting."* Bars → `--color-text` throughout, no hero bar. Cut the last clause of the Quiet Lately caption; keep *"A quiet piece is still a piece."*

**11. The BY CATEGORY chart's bars encode a different number from the one beside them.**
`ledger-desktop.png` y≈265–410. Bar length = **piece count**; the label reads **wears**. `ACCESSORIES` (77 wears), `BOTTOMS` (90), `OUTERWEAR` (29) and `SHOES` (135) all draw **identical-length bars** because each has 3 pieces. It looks like a rendering bug and it actively misleads.
**Fix:** drive the bar from `wears`, or drop the wears column.

**12. Two different quantities share one label, 24× apart, on the same page.**
`Dashboard.tsx:131` — `recordedWears = wearLogs.filter(…).length` is a count of **logged days**, labelled `"Wears recorded"` at `Dashboard.tsx:397` and `Statistics.tsx:288`. Meanwhile `Statistics.tsx:369` renders `639 wears on record`. So `ledger-desktop.png` shows **`27 WEARS RECORDED`** in the masthead and **`639 WEARS ON RECORD`** 600px lower. Contract §8.2 wants the cumulative unloseable total stated like a bank balance — 639, not 27.
**Fix:** relabel `recordedWears` → `"days logged"`; make `"wears recorded"` the item-wear total everywhere.

**13. The double rule — the house's most-repeated motif — is invisible on all 8 mastheads.**
`index.css:177` fakes it with `box-shadow: 0 3.5px 0 -3px`. At 1× the 0.5px sliver rounds away; the negative spread also insets it 3px on each side so it wouldn't align even if it painted. At 4× zoom (`settings-desktop.png` masthead) there is exactly one 2px chalk line.
**Fix:** real geometry — `border-bottom: 2px solid var(--color-text)` plus `::after { height:1px; margin-top:3px; background: color-mix(in srgb, var(--color-text) 55%, transparent); }`, full width.

**14. The Before You Buy colour deck is a 24-chip paint rack on the calmest page in the app.**
`compare-desktop.png` y≈195–290. Twenty-four fully-saturated 34px swatches, including **`#BE1231` itself at position 10** — the accent demoted to decoration on the anti-impulse screen. It reads as an e-commerce colour filter. Row 2 also ends ragged (5 chips + `ANY` + a wide gutter), and `ANY` — the default — sits *last*, looking like the 24th colour.
**Fix:** 24px chips, 1px `--color-border` hairline, `opacity:.72` until selected; move `ANY` to first position; remove any chip within ΔE≈10 of the accent.

**15. Wishlist match tiles are the largest garment images in the app, and one match leaves two empty cells.**
`wishlist-desktop.png` y≈345–620 — the *Camel Wool Cardigan* card renders a single **~230×290px** tile with 2/3 of the row void, making that card ~760px tall. Cause: `src/pages/Wishlist.tsx:139` → `grid grid-cols-3 gap-3`, hard 3 columns regardless of count.
**Fix:** `flex flex-wrap gap-3` with `max-w-[120px]` per tile. Match thumbnails should be *smaller* than closet cards, not larger.

**16. The same action carries two labels on one Wishlist screen.**
`wishlist-desktop.png`: *Camel Wool Cardigan* offers **`✓ GOT IT`** (y≈281); *Another Black Dress* offers **`BOUGHT`** (y≈876). Also, `GOT IT` reads as "understood / dismiss," not "I bought it." Requirement §1.7 names the three exits precisely: Keep / Let it go / Bought.
**Fix:** `BOUGHT` everywhere.

**17. The Wishlist surfaces the comparison *during* the cooling-off wait.**
`wishlist-desktop.png` — the *Camel Wool Cardigan* card shows `WAITING · 3 DAYS LEFT`, a purchase button, and the full "already in the closet" comparison. Requirement §1.7: *"Total silence during the wait — the silence is the intervention."* A visible countdown is anticipation, not silence.
**Fix:** during the wait, show the item and a neutral state line (`WAITING · UNTIL AUG 14`) only; hold the comparison and the exits until expiry.

**18. `RESTING` renders as a broken two-column table.**
`ledger-desktop.png` y≈1250. Reads: `Indigo Chore Jacket … OUTERWEAR   Pearl Studs … JEWELLERY` — item 1's category tag visually collides with item 2's name. Also, focus-group §1.8 specifies the money line — *"$890 is resting here"* — and it is missing.
**Fix:** one item per row, or a chip list; append the resting-value line.

**19. The specimen number is gone.**
Contract §7 specifies `№ 041 · ZARA · 14 WEARS`. `specimenCaption()` in `src/pages/Closet.tsx:60` emits `UNIQLO · WORN 34× · $1.32/WEAR` — no `№`. The single strongest ledger/atelier signal is absent app-wide, and the caption is long enough to truncate on most cards (`$2.67/WE…`, `$13.75/WE…`, `$2.14/WE…`, `COMMON PROJECTS · WORN 88× · $3…` in `closet-desktop.png`).
**Fix:** restore `№ NNN` as the first segment and drop `/WEAR` from the grid caption (keep it in ItemDetail) so the line fits at 224px.

**20. Card action buttons out-shout the photos they sit under.**
`closet-desktop.png` — the middle icon of each card's three-icon row renders as a **chalk-filled 44px square** in some states, scattering bright cream blocks across the grid (rows 1, 2, 3, 4, 6, 7). Contract §7: *"nothing competes with the photo."* Three unlabelled icon buttons permanently visible under every tile is also a lot of chrome for a browse surface. Cards carrying a status line (`⊡ NEEDS REPAIR`, `⊡ AT THE TAILOR`) push their action row down, so action rows no longer align across a grid row.
**Fix:** reveal the action row on `group-hover`/`focus-within` (always-on under `@media (pointer:coarse)`); active state = 1px chalk border + filled icon, never a chalk fill; reserve a fixed-height slot for the status line so rows align.

**21. Two filter rows are welded together and both selected chips are chalk-filled.**
`closet-desktop.png` y≈100–140: ~2px between the chip rows versus 8px between chips, so `EVERYTHING` and `ALL 29` merge into one L-shaped white blob — the brightest object on a page whose hero is supposed to be photographs.
**Fix:** row gap ≥8px; hide zero-count status chips (`NEEDS WASH 0`, `IN THE WASH 0`); drop `MENDING PILE 2`, which is just `NEEDS REPAIR 1` + `AT THE TAILOR 1`; separate the two chip families with a `Basting` divider.

**22. "RECENT ENTRIES" contains future dates.**
`dashboard-desktop.png` y≈1044 & 1097: `FRI, AUG 14` and `WED, AUG 12` appear above `SUN, AUG 9` — today is Tue Aug 11. Planned outfits are being listed as recent history, distinguished only by a small `PLAN` button.
**Fix:** split into `COMING UP` and `RECENT ENTRIES`, or filter future logs out of the list.

**23. The empty states don't earn their keep.**
Both `*-empty-*.png`: an identical drawing + one line + one CTA, floating in a 490px plate with voids above and below, and ~300px of dead page beneath. Missing against §8.4 / requirement §1: **no ghost cards showing the filled state**, no endowed progress, no specimen framing. And there are **two** CTAs on screen at once — `ADD THE FIRST PIECE` (centre) and `ADD A PIECE` (rail) — same destination, two labels, both chalk-filled; §8.4 says *"exactly one CTA on empty screens."* The empty Closet masthead also drops its meta slot entirely, where every other masthead carries a count.
**Fix:** add 3–4 ghost cards (basting-dash outlines with plausible specimen captions) below the plate; suppress the rail button on empty screens; one CTA label; masthead meta `0 PIECES`.

---

## P2 — Polish

24. **`Still up` is a greeting where every other masthead is a noun** (`Closet`, `Outfits`, `Ledger`…). Worse, `dashboard-empty-*.png` greets a first-run user with a late-night quip about *them*, not their clothes — copy law addresses the clothes. Use `Today`.
25. **Sidebar `BEFORE YOU BUY` wraps** (`dashboard-desktop.png` y≈415–440), making that row taller than its seven siblings and dropping its icon out of the icon column. It needs ~4px: reduce nav-item horizontal padding 16→12px and gap 12→10px; it fits at 13px +0.08em in a 220px rail.
26. **Two link idioms in the same column** — `dashboard-desktop.png` has `LEDGER →` (y≈304) and `CALENDAR` (y≈992) with no arrow.
27. **`WORN 11× · LAST WORN AUG 6 · 6 PIECES` orphans "PIECES" onto line 2 in all six outfit cards** (`outfits-desktop.png`). Shorten to `WORN 11× · AUG 6 · 6 PIECES` or give the meta more width.
28. **Outfit card icon state looks random**: the first four cards show a chalk-filled icon box, `Stage Night` and `Warm Day, Linen` don't (`outfits-desktop.png` y≈388 vs y≈1051). Whatever it encodes, it needs a label or a legend.
29. **Outfit thumbnail strips clip mid-tile on mobile** (`outfits-mobile.png`, *Saturday Market*) — the 6th tile is sliced at the card edge. Either scroll with an intentional peek or cap at 5 + `+N`.
30. **Calendar day cells show 3 thumbnails but say `5 PIECES`** (`calendar-desktop.png`, SUN 9) — no `+2` overflow mark. `UNDO` and `REMOVE` are also styled identically despite one being destructive, and both read as inert mono text.
31. **The eyelet is a ring everywhere except the hero button**, where it's a solid dot (`dashboard-desktop.png`, `● LOG TODAY'S WEAR`). Make it a ring.
32. **`SCHEMA 2` occupies the masthead meta slot on Settings**, where every other page puts a human count; it also repeats as `SCHEMA VERSION 2` at the page foot.
33. **`LOAD SAMPLE` copy says "31 pieces"** while every visible count says 29 (`settings-desktop.png` y≈1545).
34. **The same fact appears four times**: `2 RESTING` (stat strip), `93% … 2 are still resting`, `RESTING — 2 pieces haven't had a first wear yet` on the Ledger, plus `2 pieces are resting` on the Dashboard.
35. **`MOST WORN` is a horizontal photo strip; `QUIET LATELY` directly below is a vertical list with 38px thumbnails** using only the left 25% of a 1100px plate. Same data shape, two layouts, one large void.
36. **Chips aren't tag-shaped and search has no eyelet** — §6 specifies "tag-shaped chips with a left eyelet" and "search is the one boxed input, tag-shaped with eyelet." Both render as plain rounded rects. The `○` ring stands in for the eyelet; the clipped tag corner is missing everywhere.
37. **`Thumb` is reimplemented in 7 files** (`Dashboard`, `Closet`, `Calendar`, `Outfits`, `Wishlist`, `BeforeYouBuy`, `ItemDetail`) — the direct cause of the inconsistencies in #9. `GarmentPlate` also paints `bg-sunken` over the `bg-mat` wrapper, so `--color-mat` is effectively never used.
38. **Before You Buy shows no matches and no "fits like" line.** `compare-desktop.png` has a filled name field and 29 pieces on record, yet zero photos — requirement §1.5 says *"Your own photos dominate"* in two taps, and §1.3 says the fits-like line *"appears in Before You Buy."* The two exits also sit alone in their own bordered plate.

---

## THE THREE HIGHEST-LEVERAGE CHANGES

**1. Enforce the carmine budget and one-primary rule.**
Strip carmine from filter chips, chart bars, tertiary links and the colour deck; demote `WEAR TODAY` to ink/chalk primary so `outfits-desktop.png` stops showing six red buttons; leave carmine to the log-wear action, the calendar wear-dot, and the nav mark. One pass repairs the visual hierarchy on six of eight screens and restores the meaning the accent is supposed to carry. *(Findings 8, 10, 14, 20, 21.)*

**2. Make the garment tile impossible to leave empty.**
Consolidate the seven `Thumb` copies into one component that paints `GarmentPlate` as the base layer with the photo above it, strokes flats in `currentColor`, adds real `jewellery` / belt / bag / scarf flats, and drops `loading="lazy"` above the fold. This single change fills ~20 blank tiles in the Closet, the `MOST WORN` row on the Ledger, the jewellery slots in all six outfit strips, and the Calendar thumbnails — and it is what actually delivers "the no-photo state is first-class." *(Findings 9, 37.)*

**3. Ship a mobile chrome pass.**
Rail labels to 13px Switzer 600 caps with a `Compare` short label; anchor the active eyelet to its icon; stack `Masthead` below `sm`; wrap the Settings/YourData rows. Right now the bottom rail is illegible, the Outfits masthead collapses, and the Appearance row renders one word per line — the phone experience is materially broken while the desktop is merely imperfect. *(Findings 1, 2, 6, 7.)*

**Cheapest high-value fix outside the three:** replace the `box-shadow` hack at `index.css:177` with real geometry. Three lines of CSS restores the double rule — the house's most-repeated motif — to all eight mastheads, where it is currently invisible. *(Finding 13.)*
