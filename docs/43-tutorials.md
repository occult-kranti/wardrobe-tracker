# 43 · Per-page tutorials — the build-ready spec

**Verdict: APPROVED — build Option A, the stepped walkthrough behind the page
guide, with three amendments.** Closing ruling of the tutorial panel (two
seats: marketing, tech lead), 2026-08-20. The tech seat's recommendation is
adopted as the mechanism; it conflicts with no house law, and it is the only
option weighed that adds stepping and pointing without breaking a law
`PageGuide` already states in its own comment block. The marketing seat's copy
is adopted as the inventory, edited to the copy law in the four places named in
§3.0.

Three amendments, each forced by something read in the tree this session, and
none of them a change of direction:

- **A · Names match exactly, with alternatives** (§1.2). Substring-first-visible
  would ring the wrong control on Settings, where three visible controls carry
  the word *Export* — and it would make the suite's ambiguity check impossible
  to pass on the second of the three week-one tutorials.
- **B · The resolver has two scopes, `main` and `chrome`** (§1.3). The tech
  seat's worked example is wrong on this point: `Closet.tsx:465` is the
  **empty-state** button, so on a stocked closet — the state every tutorial
  reader is in — there is no "Add a piece" inside `<main>` at all. The control
  that is always there lives in Layout's masthead (`Layout.tsx:203`, phone) and
  sidebar (`Layout.tsx:256`, desktop), outside `<main>` by design.
- **C · The anchor test runs against two fixtures** (§7, check 4), because a
  page's controls differ between a blank wardrobe and a stocked one, and a
  drift net that only sees one of those states is half a net.

Build order: **Today, Settings, the intake bench** — the marketing seat's
week-one three — then the Closet worked example, then the rest as data (§8).

### 0 · Provenance

Sources: `tutorial-marketing.md` and `tutorial-tech.md` (both seats' briefs,
read in full); `src/lib/pageGuides.ts`, `src/lib/tutorial.ts`,
`src/components/Tutorial.tsx`, `src/components/Layout.tsx`,
`src/components/ui.tsx`, `src/index.css`, `scripts/test-features.mjs`, and the
page files named against each anchor in §2.2 and §3.
Binding: `.claude/skills/wardrobe-brand/SKILL.md`, `PLAN.md`, `CLAUDE.md`.

**Advisor deviation, declared.** CLAUDE.md asks for an advisor consult before
declaring done. This seat has neither an advisor tool nor a subagent-spawning
tool in its kit, so the consult could not be performed; the tech seat declared
the same gap. Flagged here rather than skipped silently. The three amendments
above are this seat's substitute — each one re-verified in the tree, with the
file and line that forced it.

---

## 1 · The mechanism

### 1.1 What it is

A page that has a tutorial shows one extra tertiary control in the foot of its
guide sheet: **"Walk me through it."** Choosing it closes the Modal and mounts a
small **non-modal step card** — `position: fixed`, portaled to `document.body`
like the Modal, docked at the foot of the viewport above the mobile rail
(bottom-right at `lg`+), `z-[60]`: above the rail's `z-50`, below the Modal's
`z-[100]`, and clear of `<main>`'s `z-10`. The card carries "2 of 4", one
instruction, Back / Next (Done on the last), and a cross. No scrim, no focus
trap, `role="dialog"` without `aria-modal` — the page stays fully operable,
because the point of a step is that you can *do* it while reading it.

A step may name a target. The target gets one **ring**: a
`pointer-events: none` fixed box at `z-[55]` drawn from
`getBoundingClientRect()`, 2px `--color-accent` outline, radius 2, re-measured
on scroll and resize through one rAF-throttled listener, plus
`scrollIntoView({ block: 'center' })` on step change. No mask, no cutout, no
clone, no pulse — an outline and a scroll, nothing more.

**Two doors deep, both pulled by the reader.** The only way in is a button
inside a sheet that itself never opens on its own. That is what keeps the
mechanism legal under the never-do list (§4).

**Lifecycle is inherited, not written.** The step state lives inside
`PageGuide`, which Layout mounts inside the route-keyed div
(`Layout.tsx:282`). Walking to another screen remounts it, so a walkthrough
ends with the page it belonged to — the exact behaviour the sheet has today.

### 1.2 Amendment A — exact names, with alternatives

The match is on the **accessible name, exact, case-insensitive, whitespace
collapsed** — not a substring.

The evidence: `/settings` renders "Export a backup now" (`Settings.tsx:492`),
"Export" (`Settings.tsx:727`) and "Export a backup" (`Settings.tsx:876`). Under
substring-first-visible, a step meaning the primary Export button rings the
reminder card's link instead, and check 4's "exactly one visible match" can
never pass on the page the marketing seat ranked **second most important in
week one**. Exact matching resolves all three unambiguously and needs no new
markup.

Where a label legitimately changes with state, the step lists the alternatives
and the first visible one wins:

- Today's hero is `Log today's wear` while the day is blank and `Log another`
  once it is not (`Dashboard.tsx:477`, `Dashboard.tsx:510`).
- The bench's first button is `Read a photograph` at `/intake` and `Read what I
  am wearing` at `/intake?worn=1` — and both Settings and the Closet link to the
  second (`Settings.tsx:707`, `Closet.tsx:471`).

Alternatives are cheaper and stricter than a `contains` flag: `contains: 'Read'`
would match four buttons on the bench at once.

### 1.3 Amendment B — two scopes

```
scope: 'main'   (default) — the page's own column, document.querySelector('main')
scope: 'chrome'           — the shell's persistent controls: header, aside, nav
```

Neither scope ever includes the walkthrough's own card or ring, and both skip
`[hidden]`, `aria-hidden="true"` and zero-box subtrees. Within a scope: first
**visible** match in document order.

Why two and not one: this app has two kinds of control, and they are in two
places on purpose. Page controls live in `<main>`. The shell's controls — "Add a
piece", "Change theme", the rail's links — live in `<header>` on a phone and
`<aside>` on a desktop, one visible at a time, `lg:hidden` against
`hidden lg:flex`. Visibility does the viewport work for free: at 390px the
chrome scope finds the masthead's IconButton, at `lg` it finds the sidebar's
Button, and never both.

Why not one document-wide scope: on an empty closet, "Add a piece" is visible
**twice** at 390px — the masthead IconButton and the empty-state Button
(`Closet.tsx:465`) — and the ambiguity net in §7 would fire on a page that is
behaving correctly.

### 1.4 Amendment C — two fixtures

See §7, check 4. A step's anchor is asserted against a blank wardrobe **and** a
sample wardrobe: at most one visible match in either (ambiguity is a spec bug in
any state), at least one across both (a name that resolves in neither is dead
copy).

### 1.5 The two rejected options, in one line each

- **Coach marks with a spotlight cutout** — rejected. Auto-running is illegal
  here, so they would be reader-invoked anyway, at which point they are Option A
  carrying a mask, a scrim, z-index warfare and a blocked page. A dimmed screen
  is precisely what `PageGuide` defines itself against.
- **First-use contextual nudges** — rejected outright. A nudge asks. "An
  unopened guide waits; it does not ask" is the whole contract, and per-page
  nudges also break "the same place on every screen".

### 1.6 The chrome, under the brand contract

- **Tokens only.** Card: `bg-surface`, hairline `border-border`, `plate`,
  `rounded-[2px]`. Ring: 2px `--color-accent` outline, radius 2. No shadow —
  depth is the hairline and the plate edge.
- **Never a primary or hero button.** Brand rule 3 allows exactly one primary
  per view, and the page underneath usually already spends it (the sidebar's
  "Add a piece" is `tone="primary"`; Today's hero is the log-wear fill). Next
  and Done are the default `secondary`; Back is `tertiary`; the cross is an
  `IconButton` labelled "Close the walkthrough". The hero fill stays reserved
  for log-wear, always.
- **Type.** The instruction is 14–15px Switzer; the "2 of 4" is 11px mono,
  non-interactive metadata, `type-ledger text-text-2` — a position in a short
  list, never a score (§4.3).
- **Motion.** One 140–200ms ease-out fade on mount. The ring never pulses. Under
  `prefers-reduced-motion` the global collapse at `index.css:1057` handles the
  fade, and `scrollIntoView` drops to `behavior: 'auto'`.
- **Geometry.** The card docks with the existing `.above-rail` utility
  (`index.css:612`) so it meets the rail exactly as the log sheet does, plus
  `safe-b` for the inset. One flip rule: if the target's rect would sit under the
  card, dock the card to the top for that step. Every control in it is 44px.
- **Reading order.** The card is portaled last in the body, `role="dialog"`
  `aria-label="Walking through this page"`, with `aria-live="polite"` on the
  instruction so a step change is announced without stealing focus. Escape ends
  it. Focus is never trapped and never moved to the ring.

---

## 2 · The data shape

**A sibling `src/lib/tutorials.ts`, not new fields inside `pageGuides.ts`.**
Strictly additive: the 17 existing `Guide` entries and the `Guide` interface are
not edited at all, which is the proof the shipped guides cannot regress.
`pageGuides.ts` also carries a documented length law (a lede and at most three
doings) that step scripts would dilute. Keying through `guideKeyFor` inherits
the flag seating for free, so a tutorial can only exist where a guide already
stands — no tutorial can point at a Look Book room that answers with Today. And
the file stays framework-free like its sibling, so the native app in `app/` can
read the same step copy and bind its own anchors.

### 2.1 The types, and the Closet worked example

```ts
// src/lib/tutorials.ts — framework-free, same law as pageGuides.ts
import { guideKeyFor } from './pageGuides';

/**
 * Where a step points. Not a CSS selector: a role and an accessible name,
 * resolved by the same idiom the suites already use to find things.
 *
 * The name is matched EXACTLY (case-insensitive, whitespace collapsed) — see
 * docs/43 §1.2: three visible controls on /settings contain the word "Export",
 * and a substring match rings the wrong one. A label that legitimately changes
 * with state lists its alternatives instead; the first visible one wins.
 */
export interface StepTarget {
  role: 'button' | 'link' | 'textbox' | 'tab' | 'checkbox';
  /** One exact accessible name, or the alternatives one control takes. */
  name: string | string[];
  /**
   * 'main' (default) — the page's own column.
   * 'chrome' — the shell's persistent controls in <header>/<aside>/<nav>,
   *   one viewport's worth visible at a time. Required for "Add a piece",
   *   which is Layout's, not the Closet's (docs/43 §1.3).
   */
  scope?: 'main' | 'chrome';
  /**
   * The escape hatch, checked FIRST where present: a data-tutorial value on
   * the target, for a control with no stable accessible name. No launch
   * tutorial uses one, and any future use adds that page file to that wave's
   * ownership list, explicitly.
   */
  hint?: string;
}

export interface TutorialStep {
  /** One instruction, at most two sentences: the act, and what it settles. */
  say: string;
  /** Omitted for a step about the page as a whole — no ring, no scroll. */
  target?: StepTarget;
}

export interface Tutorial {
  /** THE LENGTH LAW, inherited: at most five steps. A page needing more is
   *  asking too much of a first-timer, and the fix belongs in the page. */
  steps: TutorialStep[];
}

const TUTORIALS: Record<string, Tutorial> = {
  '/closet': {
    steps: [
      { say: 'This grid is everything on the record. Tap any piece to open its card — its wears, its cost, and what it now costs per wear.' },
      { say: 'A piece is added from the same place on every screen. A name is enough; a photograph is welcome and never asked for.',
        target: { role: 'button', name: 'Add a piece', scope: 'chrome' } },
      { say: 'Search finds a piece by name when the grid grows long.',
        target: { role: 'textbox', name: 'Search by name' } },
      { say: 'Filters narrow the grid by kind, colour or season. The small number on the control is how many are set.',
        target: { role: 'button', name: 'Filters' } },
    ],
  },
};

export function tutorialFor(pathname: string): Tutorial | null {
  const key = guideKeyFor(pathname);
  return key ? TUTORIALS[key] ?? null : null;
}
/** The seen-state key for an address — the parent path, same as the guides. */
export function tutorialKeyFor(pathname: string): string | null {
  const key = guideKeyFor(pathname);
  return key && TUTORIALS[key] ? key : null;
}
/** Every scripted address, for the suite and for anything that clears marks. */
export function tutorialPaths(): string[] { return Object.keys(TUTORIALS); }
```

### 2.2 Why the Closet example resolves — verified this session

| Step | Target | Where it really is | Blank wardrobe | Sample wardrobe |
|---|---|---|---|---|
| 1 | none | — | — | — |
| 2 | button · Add a piece · **chrome** | `Layout.tsx:203` (phone masthead, `aria-label`) / `Layout.tsx:256` (desktop sidebar) | 1 visible | 1 visible |
| 3 | textbox · Search by name | `Closet.tsx:566` (the placeholder supplies the name) | 0 — the search row is hidden on an empty closet | 1 visible |
| 4 | button · Filters | `Closet.tsx:588` (`aria-label="Filters"`; the visible word is `display:none` below `sm`) | 0 | 1 visible |

Step 2 is the amendment in one row. `Closet.tsx:465` — the line the tech seat
cited as the page header — sits inside the `closetEmpty` branch, so scoping to
`<main>` would leave the most important step in the Closet's tutorial pointing
at nothing the moment the closet has anything in it.

### 2.3 The runtime is forgiving; the suite is strict

A target that does not resolve at runtime: the step still shows its text, with
no ring, no scroll, no error, and it is **never skipped** — skipping would make
the step count lie. Drift becomes a red test (§7 check 4), not a broken sheet in
someone's hands.

### 2.4 Why not `data-tutorial` attributes as the primary anchor

They would be the first test-ids in a codebase that deliberately has none; they
spread tutorial knowledge into page files the shipped design keeps ignorant
("no page file has to know it exists"); and they do not remove the need for the
anchor test, because an attribute can be dropped in a refactor exactly as
silently as a label. Both schemes need the same test; only one needs to touch
seventeen page files. It stays as the documented escape hatch in §2.1.

---

## 3 · The inventory

### 3.0 Four rulings on the marketing seat's drafts

1. **The door gets no tutorial.** There is no guide at the door — it stands
   outside the Layout shell and has no entry in `pageGuides.ts` — so under §2 no
   tutorial can exist there, and inventing one would mean a second teaching
   mechanism with laws of its own. The door's install-first lesson moves into
   the Settings walkthrough, step 4, which is where the marketing seat itself
   ranked it ("Settings + export, with the door's install-first lesson"). The
   door keeps its own page copy, unchanged.
2. **The Closet's opening line adopts the shipped phrase.** "the photograph can
   come when it likes" becomes "a photograph is welcome and never asked for" —
   the app already makes that promise in those words in three places
   (`pageGuides.ts:97`, the tour's first beat, the Closet's empty state), and
   one promise should have one phrasing.
3. **Outfits names the noun.** "what is on the line is not dealt" becomes "a
   piece in the wash is benched, and a benched piece is not dealt" — *benched*
   is the house word the Closet guide already defines, and the seat's own rule
   is to teach the noun.
4. **Settings tells the whole truth about sync.** The opening line stands, and
   step 1 carries the sentence the page itself carries: sync is per wardrobe,
   and until end-to-end encryption lands a synced copy is stored readable
   (`docs/35`, `PLAN.md` #1 as amended). A false privacy line is the most
   expensive sentence this app can print; the tour's fourth card was rewritten
   once for exactly that.

Everything else is adopted as written. No draft carried an exclamation point, a
body verdict, a gendered address, or a "Don't forget".

### 3.1 Wave one — the three that carry week one, scripted

#### `/` · Today + logging — **build first**

- **Aha:** two taps and the day is on the record; this is the whole daily job.
- **Mistake:** treating Almari as a cataloguing chore and never forming the
  habit.
- **Opening line:** *"Today asks one question — what went on. Two taps answer
  it, and the day is kept."*

| # | Say | Target |
|---|---|---|
| 1 | Today asks one question — what went on. Answering it is the whole daily job; everything else in the app exists to make this tap worth taking. | — |
| 2 | Press this, then tap what went on. With a saved outfit it is two taps; without one, a tap and then the pieces themselves. | button · `['Log today's wear','Log another']` · main |
| 3 | A day that got away is not a broken record. The calendar takes a late entry, and the ledger counts it the same as any other. | — |
| 4 | The counts underneath are the closet at a glance. Resting is how many pieces have had no first wear yet. | — |

Today rings once, on the only control the page is about. Three of its four steps
are text because the rest of the page is state — a matured plan's "Wore it",
"Same as yesterday", "Undo" — and a ring that appears only on some mornings
teaches nothing reliably. The alternatives on step 2 cover both halves of the
hero (`Dashboard.tsx:477`, `Dashboard.tsx:510`).

#### `/settings` · Settings + export + install + sync — **build second**

- **Aha:** the record lives in this browser, so the copy worth keeping is the
  one Export writes — in the first week, not the last.
- **Mistake:** trusting an assumed cloud backup; clearing site data takes the
  wardrobe with it, and sync is per wardrobe, opt-in, and not yet end-to-end
  encrypted.
- **Opening line:** *"The record lives in this browser. Export writes it as one
  file worth keeping somewhere safe — this week, while the closet is young."*

| # | Say | Target |
|---|---|---|
| 1 | The record lives in this browser. An account is optional, sync is per wardrobe, and until end-to-end encryption lands a synced copy is stored readable. | — |
| 2 | Export writes the whole record as one file — pieces, wears, costs, categories, tags. Keep it somewhere that is not this browser. | button · `Export` · main |
| 3 | Import reads a backup back in, from any version of Almari. It replaces what is on this device, so export first if there is any doubt. | button · `Choose a file` · main |
| 4 | The row above adds Almari to the home screen. An in-app browser — WhatsApp's, Instagram's — keeps storage of its own, so a wardrobe catalogued in one is not the wardrobe the installed app opens. | — |
| 5 | The short tour waits here. It never returns on its own; this is the only way back to it. | button · `Replay` · main |

Anchors: `Settings.tsx:727` (Export, exact — the reminder's "Export a backup
now" at 492 and the footer's "Export a backup" at 876 are different names, which
is amendment A doing its job), `Settings.tsx:739` (Choose a file),
`Settings.tsx:888` (Replay). Step 4 is deliberately targetless: "Add to home
screen" renders only where `beforeinstallprompt` has fired, which is never in
the suite's browser, so ringing it would be a dead anchor by design.

#### `/intake` · The intake bench — **build third**

- **Aha:** everything arrives as a draft with its doubts stated — nothing
  touches the closet until you press add.
- **Mistake:** closing the bench believing the drafts were saved; expecting a
  photograph of two people to be read (empty by rule).
- **Opening line:** *"Photograph the clothes and the pieces come out of the
  photograph — as drafts, waiting for your yes."*

| # | Say | Target |
|---|---|---|
| 1 | Everything on this bench arrives as a draft. Nothing is written to the closet until you press the add button at the foot of it. | — |
| 2 | Photograph what you have on, or lay several garments out and photograph the lot. One journey out to the model; the cutting out happens on this device. | button · `['Read a photograph','Read what I am wearing']` · main |
| 3 | Or a handful of photographs at once — flat lays, hanger shots, one outfit as worn. A photograph with two or more people in it comes back empty, by rule. | button · `Read your photos` · main |
| 4 | No key of your own is needed: the relay holds the service key. Prefer your own model, or no network at all? Take the prompt and bring the file back. | button · `['Copy the prompt','Prompt copied']` · main |
| 5 | Each draft states its doubts — a colour it is unsure of, a name it guessed. Correct them on the bench, leave one out, and the add button says how many are going in. | — |

Anchors: `Intake.tsx:754`, `Intake.tsx:876`, `Intake.tsx:787`. Step 5 is
targetless on purpose — the bench does not exist until a photograph has been
read, so its controls are unresolvable at rest and §2.3's forgiving runtime would
drop the ring anyway. That is the degradation path working as designed.

### 3.2 Wave two — the Closet, scripted in §2.1

- **Aha:** a name is enough; a piece is retired, never deleted.
- **Mistake:** stalling the first hang on photographing everything — photos also
  fill the browser's fixed storage fastest.
- **Opening line:** *"One piece starts the record. A name is enough; a
  photograph is welcome and never asked for."*

### 3.3 Wave three — the rest of the house, as data

Each is a `tutorials.ts` entry and nothing else. The aha, the mistake and the
opening line are the marketing seat's, adopted with the §3.0 edits; the budget
is the number of steps the room may spend, capped at five by the length law.

**`/outfits` · Outfits** — budget 4.
Aha: a saved set logs in one tap; the draw deals only from what is clean and in
rotation. Mistake: reading a benched or quiet-category piece's absence from the
draw as a bug.
> "A set you already know works, saved once and worn in a tap. A piece in the wash is benched, and a benched piece is not dealt."

Likely anchors: `Deal a set` (`Outfits.tsx:641`), the builder's primary
(`Outfits.tsx:484`).

**`/furniture` · The dressing room** — budget 3.
Aha: the closet learns "where is it", not only "what is it". Mistake: thinking
filing changes a piece, or that an address is required.
> "A rail is a place; so is the shelf by the door. Draw one, and the clothes gain addresses."

**`/calendar` · The calendar** — budget 3.
Aha: the record can always be put right — a missed day is not a broken one.
Mistake: abandoning the habit after a gap because back-filling looks impossible.
> "A day that got away can still be put on the record. Tap it, say what was worn, and the ledger carries on."

**`/events` · Events** — budget 3.
Aha: a reservation is a plan, not a wear; the day still logs when it comes.
Mistake: assuming reserving counted as wearing, leaving a hole in the record.
> "An occasion with a date deserves a look settled before the morning of. Reserving decides; wearing still gets logged."

**`/ledger` · The ledger** — budget 4.
Aha: cost per wear falls with every wear — the number rewards use, not purchase.
Mistake: reading the blank money column as broken when no cost is recorded yet.
> "Give a piece its price and every wear divides it down. Until then the arithmetic waits, blank on purpose."

**`/wishlist` · The wishlist** — budget 3.
Aha: the wait is silent; the card asks once at the end, and the closet answers
back with near-matches meanwhile. Mistake: expecting a reminder — this alpha
sends nothing, ever.
> "A thing you are considering waits here in silence. When the wait is up it asks once: keep, let go, or bought."

**`/compare` · Before you buy** — budget 3.
Aha: it reports what you own that comes close, then stops — the conclusion is
yours. Mistake: waiting for a verdict, a score, or a shop link that will never
come.
> "Hold the thing in your hands against what already hangs at home. The page states the facts and then goes quiet."

**`/chats` · Conversations + loans** — budget 3.
Aha: attaching shows a piece; it does not lend it — only the owner lends.
Mistake: believing an attached piece changed hands.
> "A loan begins as a question in a conversation, and only the owner answers it. Showing is not lending."

**`/rail` · The shared rail** — budget 3.
Aha: the standing record of out-and-back between wardrobes under one roof.
Mistake: never marking a return, so a piece stays out of rotation at home.
> "The rail remembers who has the black coat, and since when. Mark it returned and it rejoins the rotation."

**`/profile` · Profile + households** — budget 3.
Aha: nothing reads a closet to fill this page — a wardrobe says only what it has
chosen to say; joining a roof shares a rail, not a closet. Mistake: fearing the
profile exposes the closet.
> "This page holds what the wardrobe has chosen to say, and nothing it has not."

**`/open` · Wardrobes** — budget 3.
Aha: one device holds several wardrobes; samples show what a year of wear looks
like. Mistake: keeping real pieces in a sample (rebuilt on every update), or
retiring a wardrobe unexported.
> "One device, several wardrobes, each with its own closet and its own arithmetic. Samples are for looking, not for living in."

**`/feed` and `/explore` · The Look Book** — **not scripted this season.** Both
guides are flag-seated behind `FEED_ENABLED`, and `guideKeyFor` returns null for
them while the flag is off, so a tutorial entry would be unreachable copy. They
walk in with the rooms.

**`/admin`** — no guide, so no tutorial. Correct: it is an alpha portal, not a
room in the product.

---

## 4 · What a tutorial must never do

1. **Never open itself.** Not on a first visit, not on a fifth, not after an
   update. Two doors deep, both pulled by the reader (§1.1).
2. **Never block or cover.** No scrim, no focus trap, no modal tour holding the
   app hostage, nothing between Today and the log-wear button. The two-tap floor
   is sacred, and the card must never sit over its own target — that is the flip
   rule in §1.6, asserted in §7 check 8.
3. **Never count anything but steps.** No badges, no checkmarks, no "3 of 12
   pages explored", no percent bars, no streaks. "2 of 4" is a position in a
   short list, set in non-interactive 11px mono, and it leaves with the card.
   The guide's one dot means "not read yet", never "you owe us".
4. **Dismissed is dismissed.** Every exit — cross, Escape, Done, walking to
   another page — writes the same flag and never asks again, never re-arms after
   an update, never sulks in a corner with a red badge.
5. **Never condescend, cheer, or celebrate.** No "Great job", no mascot, no
   confetti, no exclamation point. No progress talk, no shame copy, no body
   verdicts, no gendered address.
6. **Never promise what does not ship.** The privacy sentences in §3.1 are the
   ones the app itself prints. If sync changes, this file changes with it.
7. **Never skip a step it cannot point at.** An unresolvable target loses its
   ring, not its text (§2.3) — the count must not lie.
8. **Never take focus.** The instruction is announced `aria-live="polite"`;
   focus stays wherever the reader put it.

---

## 5 · Seen state

New localStorage key **`toile-walkthroughs`**, in `src/lib/tutorial.ts`, beside
`toile-guides`, with the same shape and the same fail-silent discipline: one
JSON string array of guide keys; a `readGuides`-style reader where storage that
throws reads as "seen", so a mark that can never be cleared is never shown, and
a malformed row reads as an empty list and recovers on the next write. Additive
exports: `walkthroughSeen(key)`, `markWalkthroughSeen(key)`.

**Marked on start, not on completion.** The guide precedent is "opening IS
reading"; marking on Done would smuggle in a completion mechanic, which is a
score by the back door and banned by §4.3. The only v1 consumers are the suite
and any future "clear the marks" in Settings — **no dot, no badge, no second
affordance.** The guide sheet's existing dot already carries "you have not
looked here yet", and one quiet mark per screen is the ceiling.

**Not in `AppState`, for four reasons.** CLAUDE.md binds any `AppState` change to
a migration case in `scripts/test-migrate.mjs` first, and walkthrough marks are
worth zero migrations forever. They are a fact about this browser's reader, not
about the wardrobe — they must not ride the lossless export, must not sync, and a
second device is entitled to its own first time. They are app-wide, not
per-wardrobe, so switching wardrobes must not resurrect them. And a separate key
clears in one write, which is the argument `tutorial.ts` already documents for
`toile-guides`.

---

## 6 · File ownership for the build squad

Declared before the wave, disjoint, and complete. **Four files:**

1. `src/lib/tutorials.ts` — NEW. The types, the record, `tutorialFor` /
   `tutorialKeyFor` / `tutorialPaths`. Framework-free.
2. `src/lib/tutorial.ts` — additive only: `walkthroughSeen`,
   `markWalkthroughSeen`, and the `toile-walkthroughs` key. No existing export
   changes.
3. `src/components/Tutorial.tsx` — the "Walk me through it" control in
   `PageGuide`'s sheet foot; the new `Walkthrough` component: card, ring, and the
   resolver (the resolver lives here because it touches the DOM, and the lib
   stays framework-free).
4. `scripts/test-features.mjs` — the checks in §7, in one block after the
   existing flows.

**Not owned, and not to be touched:** `src/components/Layout.tsx` (the mount at
line 282 already carries everything — the walkthrough is internal to
`PageGuide`); `src/components/ui.tsx` (Modal unchanged); `src/index.css`
(`.above-rail`, `safe-b` and the reduced-motion collapse already exist; the card
and ring are Tailwind utilities over tokens); `src/lib/pageGuides.ts` (zero
edits — that is the additive proof); all of `src/pages/**`; `AppState` and
`scripts/test-migrate.mjs`; everything in `app/`, `company/` and `docs/`.

The squad **must** load `.claude/skills/wardrobe-brand/SKILL.md` before the
component work: tokens only, radius 2, no shadows, no second primary button
(§1.6), and step copy that addresses the clothes and the page — never the
reader's diligence.

One squad owns the build at a time; `npm run verify` runs between waves, not
during. No git mutations without the owner's explicit permission.

---

## 7 · Test plan

`npm run verify` is untouched by design — no `AppState`, no migration, no brand
asset, no route. All new coverage lands in `scripts/test-features.mjs`
(Playwright, 390x844, `hasTouch`, role/name locators, the suite's own `check()`).

1. **The law.** Land on `/closet` cold: no `[role="dialog"]`, no walkthrough card
   anywhere in the DOM, no ring. The tutorial never announces itself.
2. **The door.** Open "What is this page?" on `/closet` — "Walk me through it"
   stands in the sheet foot. Open the sheet on a page with no tutorial yet — the
   control is absent and the sheet is the shipped guide, unchanged. This is the
   additive proof for the seventeen existing guides.
3. **Stepping, and the page stays alive.** Start it: `.modal-overlay` is gone,
   the card reads "1 of 4", `document.body.style.overflow` is not locked, and a
   page control outside the card still takes a real tap. Next to the end — "Done"
   closes it. Assert **no primary or hero button inside the card** while it is up
   (brand rule 3, §1.6).
4. **Anchor integrity — the drift net, two fixtures.** For every path in
   `tutorialPaths()`, walk every step, in a **blank wardrobe** and then in a
   **sample wardrobe** (the suite already opens one; reuse it):
   - in either fixture, **at most one** visible match for a step's target within
     its scope — more than one is an ambiguous anchor and always a spec bug;
   - across the two fixtures, **at least one** resolution per target — a name
     that resolves in neither is dead copy;
   - where it resolves, the ring's rect overlaps the target's rect.
   A renamed button or a dropped `aria-label` fails here, by name.
5. **Persistence.** After starting, `toile-walkthroughs` contains `/closet`.
   Reload: nothing auto-opens — check 1 re-asserted now that state exists.
6. **Reduced motion.** `page.emulateMedia({ reducedMotion: 'reduce' })`: the ring
   is present, computed `animationName` on card and ring is effectively none, and
   stepping still brings the target into view, instantly.
7. **Exits.** Escape ends it. Navigating to `/outfits` mid-walkthrough ends it
   (the keyed unmount) and leaves no card and no ring behind in `document.body`.
8. **It never covers its own target.** On the phone viewport, for every step with
   a resolved target, the target's rect and the card's rect do not intersect —
   the flip rule in §1.6, asserted rather than assumed.

Suites that must stay green, untouched: `test-flows` (routes unchanged),
`check-brand` (tokens only), `test-migrate` (nothing to migrate — the point),
`test-contrast` (the ring is `--color-accent` on page grounds, a pair already
measured).

---

## 8 · Build order

| Wave | Scope | Files |
|---|---|---|
| 1 | The mechanism, plus **Today** — the daily habit is the product | all four (§6) |
| 2 | **Settings** — the one mistake that ends a tester permanently is a lost record | `tutorials.ts` + suite |
| 3 | **The intake bench** — a stocked closet is the reason to come back, and it is the one AI moment | `tutorials.ts` + suite |
| 4 | **The Closet** — the worked example in §2.1 | `tutorials.ts` + suite |
| 5 | The rest of §3.3, as pure data | `tutorials.ts` + suite |

Waves 2 onward are copy waves against a mechanism that already passes its suite:
one record entry, one anchor row in check 4, no component change. The marketing
seat's ranking sets 1–3 and this ruling keeps it — the daily habit, the copy they
keep, the stocked closet, in that order.
