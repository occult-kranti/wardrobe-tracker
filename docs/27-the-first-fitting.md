# The First Fitting — the new-user tutorial

*Design plan. Nothing in this document is built yet; it exists so that when the
tutorial is built, every decision in it has already been made once, on paper,
against the contract.*

The app has never had onboarding. That was defensible while the empty states
did the teaching — every page carries a drawn plate, one sentence, and one
action, and the §8.4 cold-start promise (value at item #1) holds. But the app
now has twenty-two addresses, eight sample wardrobes, and features whose whole
point is that they *wait quietly* (the cooling-off, the bench states, the
household layer). A thing designed to be quiet cannot introduce itself. The
tutorial exists to introduce the quiet parts, once, and then get out of the way.

The name is the frame: a first fitting is short, the tailor does the talking,
the customer mostly stands there, and nothing is sewn yet. The atelier
metaphor is budgeted to onboarding and reward moments (docs/05 §5) — this is
one of the two places it is allowed to concentrate, and it should still be
spent sparingly.

---

## 1. What binds it

From the contract and the focus group, in force here as everywhere:

- **No notifications.** The tutorial never initiates. It appears only when the
  person has already arrived somewhere.
- **No progress-as-achievement.** A step count ("2 of 5", 11px mono,
  non-interactive metadata) is a fact. A filling bar, a checkmark parade, or
  any congratulation at the end is chrome, and vetoed.
- **No confetti, no celebration copy, no exclamation points.**
- **One primary button per view** — a coach mark may not add a second accent
  button to a page that already has one. Coach-mark actions are quiet buttons.
- **Copy law**: house-tailor voice; address the clothes, never the identity;
  ≤ 60 words on the welcome sheet, ≤ 20 words per coach mark.
- **Contract §7 already prescribes the visual language**: dotted leader lines
  (dasharray `0.1 4`, round caps, ring terminus) with mono labels — "tailor's
  annotations on pattern paper." The tutorial invents no new visual grammar.
- **44px touch targets, AA contrast in every room, focus-trapped dialogs.**

## 2. Shape: three layers, strictly ordered

### Layer 1 — the welcome sheet (one Modal, once)

**When.** First entry into any wardrobe on this device — sample or real — when
`toile-toured` is absent. Never again after, in any wardrobe.

**What.** The existing `Modal` primitive, unchanged: paper sheet, Fraunces
22px title over the double rule, `thock()` on landing, focus trap, Escape
closes (closing counts as skipping; skipping is not an error and is never
mentioned again).

**Contents, top to bottom:**

1. `PlateFirstFitting` — a drawn plate, ~200×160: the tailor's table before a
   fitting (chalk, pincushion, measuring tape), one accent detail. Artwork
   spec in §5.
2. Title: **The first fitting**
3. Body (the whole of it):
   > This is a record, not a form. It lives on this device, asks the day's one
   > question, and keeps the ledger honest. Five stops, half a minute — or
   > walk in on your own.
4. Actions: primary **Walk the rooms** · quiet text link **Skip the tour**

Two exits, equally final. "Skip the tour" writes the same `toile-toured` flag
as finishing — a person who skipped is not a person to be reminded.

### Layer 2 — the tour (five coach marks, one at a time)

Coach marks are **not modals**. No scrim, no focus trap, page fully
interactive behind them — an annotation pinned to the page, not a lightbox
over it. One is visible at a time. Each is:

- a paper chip (`bg-surface`, hairline `--color-border`, radius 2, max-width
  ~260px), holding
  - the label: Switzer 13px, one sentence, ≤ 20 words
  - the step fact: `2 of 5` in 11px mono `--color-text-2`
  - one quiet **Next** button (last stop: **Finish**) and a quiet **Leave it**
    text link on every stop (leaving = done, same flag)
- a `LeaderLine` (the existing component: 1px `currentColor`, dash `0.1 4`,
  round caps — the one sanctioned round-cap exception) from chip to a 2.5px
  ring terminus resting on the anchor element
- anchored via a `data-tour="<stop>"` attribute on the target, positioned from
  its `getBoundingClientRect`, re-measured on resize and route entry (the
  `.v2-route` entrance runs 300ms; marks draw after it settles)

**The five stops.** Each teaches one thing, on the page where it is true, and
navigates there when Next is pressed. Copy is final draft, not placeholder:

| # | Page | Anchor | Label |
|---|---|---|---|
| 1 | Today | the log-wear action | The day's one question. Two taps answer it, and every piece in the outfit is credited. |
| 2 | The closet | the first garment tile | Pieces, with or without photographs. The drawn flat is a state, not a placeholder. |
| 3 | The ledger | the cost-per-wear figure | Cost-per-wear falls as the record grows. That number is the whole argument. |
| 4 | The wishlist | the add action | Tempted? It waits here quietly. Seven days, then one question, and never a shop link. |
| 5 | Settings | the export row | The record is yours. Export the whole of it, any time, and it reads back losslessly. |

Stop 5 ends with **Finish**, which closes the chip. No summary card, no
recap, no "you're all set". The last thing the tour does is nothing.

**In a sample wardrobe** the same five stops run, and the chip's step fact
line gains a second clause where relevant — e.g. stop 4 in Nico's closet
lands on a wishlist that actually shows a coat that waited two winters. The
samples were built to be walked through; the tour just walks them.

### Layer 3 — contextual first-time nudges (already mostly built)

No new surface. The existing empty states remain the teachers of their own
pages, and the existing toast grammar ("Logged. Worn once.") remains the
reward voice. The tutorial adds exactly one new toast, fired after the first
*real* wear ever logged in a non-sample wardrobe:

> Logged. The record has begun.

Type `seal` (it earns the wax), once per device (`toile-first-log`), and
nothing further. No day-2 tips, no "did you know", no re-engagement of any
kind — those are notifications wearing a disguise.

## 3. The popup inventory, complete

| Surface | Kind | Count | Modal? | Sound | Dismissal |
|---|---|---|---|---|---|
| Welcome sheet | `Modal` (existing) | 1, once ever | Yes — trap, Escape | `thock` on land | Skip link, Escape, or starting the tour |
| Tour stops | Coach-mark chip + `LeaderLine` (new, one component) | 5, once ever | No — page stays live | none | Next/Finish, Leave it, Escape, route change away |
| First-log toast | `Toast` (existing, type `seal`) | 1, once ever | No | `chime` | auto, 4s |
| Anything else | — | 0 | — | — | — |

Nothing recurs. Nothing schedules. Nothing badges.

## 4. Motion, sound, reduced motion

- Chip: 140–200ms ease-out fade-and-settle (`animate-slip` is already this).
- Leader line: `stroke-dashoffset` draw-in, 300ms, after the chip lands.
- Ring terminus: appears with the line's arrival, no pulse. A pulsing ring is
  a notification asking for attention; a still ring is an annotation.
- Sounds: only the sounds the primitives already own (`thock` for the sheet).
  The tour itself is silent — a tailor marking a hem does not chime.
- `prefers-reduced-motion`: everything collapses to opacity, including the
  draw-in; the v2 global reduce block already covers the primitives.

## 5. Artwork

All hand-coded SVG, tokens only, no bodies, radius ≤ 2, no shadows.

1. **`PlateFirstFitting`** (~200×160, for the welcome sheet): the tailor's
   table at the start of a fitting — tailor's chalk, a pincushion with a few
   pins, a measuring tape in a lazy curve. Ink contour 1.5px `currentColor`
   at plate opacity; the ONE accent detail is a chalked guide-line in
   `--color-accent`, basting-dashed (`4 3`). No garment on the table: the
   fitting has not started, which is the point.
2. **Coach-mark geometry**: the existing `LeaderLine` (1px, `0.1 4`, round
   caps, 2.5r ring). The ring terminus takes `--color-accent`; the line takes
   `--color-text-2`. One accent element per region holds: the ring is the
   accent for the annotated region while a mark is up.
3. **No new icons.** The tour needs none; the pages' own icons are the
   subject matter.

Reference implementations of both, drawn to these specs and ready to paste
into `art.tsx` when the tutorial is built, are in Appendix A. They follow the
plate conventions of `PlateEmptyCloset` and the line law of `LeaderLine`
exactly.

## 6. State and wiring

- **Seen flag**: `toile-toured` = `'done'`, device-scoped, hand-rolled
  try/catch read/write like `toile-room` (`src/components/Room.tsx` is the
  precedent). Deliberately *not* in `AppState` — a tutorial is a fact about
  this device, not about the wardrobe, and it must not ride along in exports.
- **First-log flag**: `toile-first-log` = `'done'`, same pattern.
- **Mount point**: `<TutorialLayer />` in `Layout.tsx` beside `AddItemModal`
  and `ToastContainer` — inside both providers, covering every in-wardrobe
  route. The Door needs nothing: the Door is its own explanation.
- **Z-order**: chips at `z-[150]` — above page chrome (50), below toasts
  (200). The welcome sheet is a `Modal` and keeps `z-[100]`.
- **Anchors**: `data-tour` attributes on five existing elements; the layer
  finds `[data-tour="<stop>"]`, measures, and positions. On mobile the
  anchors sit in the bottom rail; the chip flips above it. If an anchor is
  missing (feature flag, future refactor), the stop is skipped silently —
  a tour that errors is worse than no tour.
- **Navigation**: Next uses the router (`ROUTES` in `src/lib/routes.ts` has
  the addresses and their sentence-case names — the tour's vocabulary comes
  from there, so copy never drifts from the nav).
- **Re-entry**: one quiet row in Settings — "Walk the rooms again" — clears
  `toile-toured` and starts the tour. Discoverable re-entry, zero nagging.

## 7. Rejected, on the record

- **Checklist onboarding** ("Add 5 items ✓ · Log a wear ✓") — progress-as-
  achievement, vetoed by §8; also teaches cataloguing-as-homework, the
  category's signature failure.
- **Spotlight/dim-the-page tours** — a scrim says *stop*; the contract's
  annotation grammar says *look here while you keep walking*.
- **Interactive "try it now" gates** (forcing a practice log) — the two-tap
  log does not need rehearsal, and a forced action in a demo is a form.
- **Video or animation walkthroughs** — raster assets are banned, and a film
  already exists for the site; the app teaches in its own material.
- **Tooltips-on-hover for everything** — hover is not a mobile surface, and
  ambient tooltips are ambient noise. The `title=` attributes stay as they
  are.
- **A tutorial wardrobe** ("Tutorial Tessa") — the eight samples already are
  the tutorial wardrobes; a ninth built for teaching would be a showroom.

## 8. Build order, when it is built

1. `PlateFirstFitting` + coach-mark chip into `art.tsx`/`ui.tsx` (the chip is
   ~40 lines: chip, line, ring, position math).
2. `TutorialLayer` with the five stops as data, `toile-toured` read/write.
3. Welcome sheet wired to first entry; Settings re-entry row.
4. The first-log toast behind `toile-first-log`.
5. `npm run shots` and the design-critic agent on all five stops, both themes,
   390px and desktop, before merge — the standing rule for any UI change.

Estimated size: one new component file, one plate, ~250 lines total, no new
dependencies, no schema change, no migration.

---

## Appendix A — reference artwork, ready to merge

Drawn by the brand-artist against the conventions above. The `plateStroke`
const and `Plate` wrapper duplicate the ones already in `art.tsx` — delete
them on merge. Tokens only; no hex anywhere.

```tsx
/**
 * ALMARI tutorial artwork â€” "The First Fitting" â€” all hand-coded SVG,
 * no rasters, no external assets. Art direction: docs/05-brand-identity.md Â§6â€“7
 * and .claude/skills/wardrobe-brand/SKILL.md. Never draw a body.
 *
 * Drop-in snippet for src/components/art.tsx. The `plateStroke` const and
 * `Plate` wrapper below DUPLICATE the ones already in art.tsx â€” delete them on
 * merge and let the plate join the empty-state set as-is. This file, like
 * art.tsx, contains no hex at all: it paints in tokens only.
 */

const plateStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'butt' as const,
  strokeLinejoin: 'miter' as const,
};

function Plate({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={`w-[200px] h-[160px] text-text-2 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * The First Fitting: the tailor's table before any cloth arrives â€” chalk,
 * pincushion, and the tape flopped over the table edge, mid-thought. The one
 * accent detail is the chalked guide-line, dashed like basting, wavering the
 * way a line drawn freehand along a rule always does. One gold pin head, the
 * same ornament PlateEmptyMending wears; everything else is ink. No garment,
 * no body â€” the fitting has not started, which is the point.
 */
export function PlateFirstFitting() {
  return (
    <Plate>
      {/* the chalked guide-line â€” THE accent, dashed like basting */}
      <path
        d="M36 52c22-5 42 4 64 2s44-7 64-2"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      {/* the table: one long edge, two legs */}
      <path d="M14 112h172" {...plateStroke} />
      <path d="M26 112v34M174 112v34" {...plateStroke} />

      {/* tailor's chalk, the flat triangle, standing on its worn base */}
      <path d="M38 112L53 90l15 22z" {...plateStroke} />
      <path d="M45 105h16" stroke="currentColor" strokeWidth="1" opacity="0.5" />

      {/* measuring tape in a lazy curve, over the edge, brass tip hanging */}
      <path
        d="M18 96c18 10 38 12 56 6s30-4 34 8c2 6 2 16 2 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.35"
      />
      <path
        d="M34 100v6M52 101v6M72 99v6M92 97v6M107 124h6M107 132h6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M105.5 141h9" stroke="currentColor" strokeWidth="3" />

      {/* pincushion with three pins, one head in gold â€” decorative only */}
      <path d="M122 112c0-14 8-22 18-22s18 8 18 22" {...plateStroke} />
      <path d="M132 94L123 81M140 91V77M148 94l9-13" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="121.5" cy="79" r="2.5" fill="currentColor" />
      <circle cx="140" cy="74.5" r="2.5" fill="var(--color-gold)" />
      <circle cx="158.5" cy="79" r="2.5" fill="currentColor" />
    </Plate>
  );
}

/**
 * Coach-mark specimen: the tutorial annotation stated as pure geometry â€” a
 * paper chip, the dotted leader (1px, dasharray 0.1 4, round caps: the house's
 * ONE round-cap exception, matching LeaderLine), and a 2.5px accent ring
 * pressed on the thing being pointed at. The chip is deliberately empty: the
 * label is HTML mono copy laid over it, never SVG text, so it wraps, scales,
 * and reads to screen readers like any other sentence.
 */
export function CoachMarkSpecimen({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 80"
      width={240}
      height={80}
      className={className}
      aria-hidden="true"
    >
      {/* the paper chip â€” copy goes here as HTML, not SVG text */}
      <rect
        x="14"
        y="14"
        width="92"
        height="36"
        rx="2"
        fill="var(--color-surface)"
        stroke="var(--color-border)"
        strokeWidth="1"
      />

      {/* the dotted leader â€” tailor's annotation on pattern paper */}
      <path
        d="M110 32c34 2 66 13 100 26"
        fill="none"
        stroke="var(--color-text-2)"
        strokeWidth="1"
        strokeDasharray="0.1 4"
        strokeLinecap="round"
      />

      {/* the ring terminus, on the target â€” the accent's one appearance */}
      <circle cx="214" cy="59.5" r="2.5" stroke="var(--color-accent)" strokeWidth="1" fill="none" />
    </svg>
  );
}

```
