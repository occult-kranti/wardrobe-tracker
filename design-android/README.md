# Toile for Android — the design pack

The native Android app, designed before a line of it is coded. Everything in
this folder is a design artifact: HTML mockups at phone scale (412×915), a
shared token foundation, and the plan. Production re-measures every contrast
pair; nothing here ships as-is.

**Browse it live:** `node design-android/serve.mjs` → http://localhost:4200/ —
sidebar to switch screens, ←/→ to walk them, and a room-override bar that
re-dresses any screen into any of the four rooms.

## The idea

The app's storage reads as furniture. Not decoration — orientation: the closet
is an open almirah whose rail holds the hanging pieces, whose drawers are the
categories (one sits ajar), with the shoe rack below and the jewellery stand
beside. Every furniture reading is a skin on a control that already exists.
**The governing rule: furniture is orientation, never navigation cost.** If the
metaphor ever adds a tap, the metaphor loses. The two-tap wear log is the
load-bearing wall.

Line artwork appears DURING actions, not as wallpaper — the art moments:

| Action | The drawing |
|---|---|
| A wear is logged | The hanko presses / the hanger settles onto the rail |
| A piece is added | The tag's thread ties itself through the eyelet |
| Wash-day send | The washline strings itself across the sheet |
| A plan matures | The paper tag on the hanger waits for its answer |
| Retire | The piece is folded once, tenderly, into the trunk |
| Pass on | The tag's thread unties, re-ties in the next room |
| Cooling-off ends | The candle/hourglass line completes and asks once |
| Outfit saved | The drape pins itself to the dressform |
| Event packed | Bandhani dots settle into the arch border |
| Room change | The new room's motif draws itself across once |

## Navigation (from the UX research)

Five-slot bottom bar, no drawer: **Today · Closet · Calendar · Ledger · The
House**. Closet folds in Outfits as a segment; Calendar folds in Events (the
packing surface is day-anchored); The House is a visible hub — wishlist,
before-you-buy, feed, chats, rail, profile & households, settings. The
wardrobe switcher is the tag-portrait in the top bar (account-switcher sheet).
Predictive back is never intercepted. The two-tap log gets faster natively:
a home-screen widget with one-tap "same as yesterday," notification quick-log,
and an app shortcut. Material dynamic color is declined — the rooms are the
color system; platform sheets, snackbars, and back gestures are kept.

## The four rooms

| Room | Ground | Accent / Seal | Signature motifs |
|---|---|---|---|
| **Mughal** | Ivory marble `#F3ECDC` | Lapis `#26619C` / Carnelian `#B03A2E` | Jharokha cusped arch, jaali lattice, gold `#B08D3E` |
| **Rajput** | Haveli sandstone `#F2E3C8` | Indigo `#34548A` / Vermillion `#C03516` | Scalloped arches, bandhani dots, miniature borders |
| **Gothic** | Near-black stone `#121014` | Stained-glass blue `#7FA3D8` / Deep red `#9E1B2E` | Pointed lancets, tracery, rose window, old gold `#A98C4B` |
| **Japanese** | Washi `#F5F0E6` | Ai indigo `#33586B` / Hanko vermilion `#C73E2D` | Tansu, kumiko/asanoha, the enso, the seal pressed |

One rule keeps it elegant, not costume: the motif lives in the chrome
(masthead arch, plate corners, dividers, the active nav slot) and in the art
moments — never behind text, never on a number.

## The screens

All in `mockups/`, each with an at-rest phone and (where the screen has an
art moment) a second phone mid-action, captioned:

- **Japanese** — `japanese-today` (home + log sheet + the seal pressed),
  `japanese-log-widget` (home-screen widget + notification quick-log),
  `japanese-item` (item detail as a hanging scroll + amend state)
- **Mughal** — `mughal-wardrobe` (THE flagship: rail, drawers, shoe rack,
  jewellery stand; drawer-open + wash-day state), `mughal-add-piece` (jharokha
  intake + the tag tied), `mughal-detail` (cusped-arch detail + provenance)
- **Gothic** — `gothic-calendar` (tracery week + matured-plan question),
  `gothic-ledger` (the illuminated ledger), `gothic-wishlist` (the reliquary
  cooling-off + the day the wait ends)
- **Rajput** — `rajput-outfits` (looks as miniature paintings + draw-a-set),
  `rajput-events` (the procession of functions), `rajput-rooms` (the room
  picker), `rajput-household` (the haveli roof + pass-on tray)

## What this is not

No gamification, no guilt copy, no exclamation points, "retire" never
"delete", no bodies in any drawing, 44px touch floor, every animation behind
the reduced-motion gate. The record's honesty rules (plans never silently
count) are architecture, not UI, and carry over verbatim.

See ROADMAP.md for the build plan.
