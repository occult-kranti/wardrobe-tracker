# Toile for Android — roadmap

Design precedes code; each phase has a gate that must pass before the next
begins. The web app (v1/v2) remains the product of record throughout — the
Android app reads and writes the same export format from day one.

## Phase 0 — Design (this pack) ✦ current
- [x] Interaction architecture (5-slot nav, hub, native log accelerators)
- [x] Furniture metaphor mapped, art moments defined
- [x] Four rooms specified with token sets
- [x] 13 screen mockups across the four rooms
- [ ] Remaining screens at parity: ledger detail states, compare, feed/chats,
      settings, onboarding (each in one room is enough)
- [ ] Motion spec: each art moment storyboarded (duration, easing, reduced-motion fallback)
- **Gate:** every core flow walkable in the gallery; the two-tap log costs two taps in every design.

## Phase 1 — Foundation
- Single-activity Compose app; local Room/SQLite store mirroring the web
  AppState schema (same migration discipline: test case FIRST for every change)
- Import/export interop with the web app's JSON — a wardrobe moves both ways
- Token system: the four rooms as Compose theme objects; contrast measured and
  gated in CI exactly as the web does (the 120-pair rule)
- The line-art system: frieze grammar renderer (SVG path data shared with web)
- **Gate:** a closet imported from the web renders in all four rooms with measured contrast.

## Phase 2 — The record
- Today + two-tap log + same-as-yesterday; Closet (the almirah surface);
  add/amend/retire; wash-day flows; Calendar with the planned-flag law
- The first three art moments (log, add, wash) behind the motion gate
- **Gate:** the honest-ledger invariants hold under property tests; logging is ≤2 taps measured.

## Phase 3 — The native advantages
- Home-screen widget: today's question + one-tap same-as-yesterday
- Notification quick-log; app shortcut; share-sheet intake (add a piece from a photo)
- Predictive back everywhere; offline is the only mode
- **Gate:** a wear logged from the widget without opening the app.

## Phase 4 — The rest of the house
- Ledger, Wishlist + cooling-off, Before-you-buy, Events/packing, Outfits +
  draw-a-set; The House hub; households + pass-on tray (veto list is law)
- Remaining art moments; the room-change draw
- **Gate:** feature parity with web v1 minus social surfaces that need a second device to mean anything.

## Phase 5 — Ship
- The four rooms polished on OLED and LCD; battery/perf pass on a mid device
  (the capability-gate philosophy from web v2 carries over)
- Store listing in the house voice (no exclamation points, no urgency)
- **Gate:** the store page's screenshots are the gallery's screens, unretouched.

## Sequencing note
Phases 1–2 are the product; 3 is why native exists; 4 completes it; 5 states
it plainly. Anything that threatens the two-tap log waits.
