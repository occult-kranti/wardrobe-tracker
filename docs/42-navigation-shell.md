# 42 · The navigation shell — the build-ready spec

**Verdict: APPROVED — build.** Closing ruling of the navigation panel (three
seats, two rounds, one direction memo), 2026-08-20. Every load-bearing claim
was re-verified in the tree this session: expo-router 57.0.14 vendors
`TopTabs` at `expo-router/js-top-tabs` and exports `Protected`
(`build/layouts/TopTabsClient.js:21`); Expo Go for SDK 57 bundles
`react-native-pager-view` 8.0.2 (`expo/bundledNativeModules.json`);
`react-native-tab-view` is pure JS; `TYPE.rail: 11` sits at
`app/src/tokens/typography.ts:75` with exactly one consumer; the web rail is
`mobilePrimary` at `src/components/Layout.tsx:61`; the flag's four web entry
points exist where the panel said they do.

Two panel conflicts are settled in this ruling, stated plainly: the House
slot's icon is the artist's `IconHouse` almirah, superseding the direction
memo's ported hanger (§1); and the alpha note ends after its first sentence —
the marketing seat's truncated second sentence is declined (§2).

---

## 1 · The bar

Alpha (flag off): **TODAY · CLOSET · CHATS · HOUSE** — four equal slots.
Showcase (flag on): **TODAY · CLOSET · LOOKS · CHATS · HOUSE**, the Look Book
seated centre. Home never moves.

| Owner's word | Slot label | Address | Native route file | Icon |
|---|---|---|---|---|
| home | TODAY | `/` | `(tabs)/index.tsx` | `IconToday` |
| wardrobe | CLOSET | `/closet` | `(tabs)/closet.tsx` | `IconCloset` |
| feed | LOOKS (flagged off) | `/feed` | `(tabs)/feed.tsx` | `IconFeed` |
| conversations | CHATS | `/chats` | `(tabs)/chats.tsx` | `IconChats` |
| profile | HOUSE | `/profile` | `(tabs)/profile.tsx` (new) | `IconHouse` (new) |

- **Addresses never move.** The fifth slot's file is `profile.tsx` so the
  address stays `/profile` on both apps; only the slot label and the masthead
  say House (`options.title: 'House'`, masthead THE HOUSE). A deep link is
  the same sentence everywhere.
- **Geometry law:** the bar's geometry derives from the *visible* roster,
  never the full one. Four slots are four generous drawers of a complete
  chest — no spacer, no ghost cell, no disabled slot. Bar, pager, eyelet
  stops, and swipe adjacency all read one array (§7).
- **Anatomy:** ground `--color-surface`; hairline top rule in
  `--color-border` (`StyleSheet.hairlineWidth`) — the rule is the rail, not
  decoration. Content 56dp + bottom safe-area inset; slots equal-flex,
  full-height touch targets. Icons 24×24, 1.5px stroke, `currentColor`;
  resting ink `--color-text-2`, active ink `--color-text`. Labels 13px
  (`TYPE.label`), 600, uppercase, 0.5 tracking, 4dp below the icon.
- **The 11px rail exception is retired.** Delete `rail` from
  `app/src/tokens/typography.ts`; `(tabs)/_layout.tsx` uses `TYPE.label`;
  web `.type-label-rail` in `src/index.css` goes to 13px, comments updated
  (its cause, OUTFITS on the rail, has left the rail). The rule going
  forward: the word shrinks, never the type — the flag-on centre label is
  LOOKS, never 11px.
- **Active mark — the eyelet.** A 6dp filled circle in `--color-accent`
  (circles are lawful for eyelets), punched through the top hairline,
  centred over the active slot: the rail holds the sheets; here hangs the
  current one. During a swipe the bead rides the pager offset along the
  hairline between measured slot centres. `--color-accent` is per-room, so
  the bead is room-aware by construction.
- **`IconHouse` — the almirah, the app's namesake.** The direction memo
  seated the ported hanger before weighing the rename; with the slot
  labelled HOUSE a hanger mismatches its word, and the bar would carry two
  hanger-family glyphs in four slots (`IconCloset` is itself garments on a
  rail). The memo's operative point — no letterform in the icon row — is
  preserved. To the standing rules (24×24, 1.5px, butt caps, miter joins,
  half-grid, one 2px 45° NE notch):

  ```
  <path d="M5.5 4.5h11l2 2v14h-13z" />   carcase; the NE corner is the notch
  <path d="M12 4.5v16" />                the two doors meet
  <path d="M9.5 11v2.5M14.5 11v2.5" />   one pull each door
  ```

  Lands in BOTH sets: `src/components/icons.tsx` and
  `app/src/icons/index.tsx`. `IconProfile` stays in the web set untouched;
  its native port is cancelled.
- **Long-press the House slot opens the wardrobe switcher** — Instagram's
  account-switch gesture, translated. `Pressable`'s own `onLongPress`
  (default 350ms); no gesture library. The tag-portrait (the `AccountMark`)
  lives on the House nameplate and in the switcher sheet — never in the
  icon row.
- **No notification chrome of any kind on the bar.** No dot, no numeral,
  nothing at whisper weight — the record refuses it three times
  (toile-social #3, docs/11, docs/19). A waiting message is discovered by
  walking into Chats. Pull, never push.

## 2 · The flag

- **Module:** `packages/shared/flags.ts` (new).
  `export const FEED_ENABLED = false;`
  Resolved through the existing package-root alias
  (`packages/shared/aliases.mjs`) — zero alias or parity-check changes; web,
  native, and every `scripts/test-*.mjs` esbuild call site see the same
  constant. Never an env var: Expo Go testers cannot carry env, and one
  constant means one commit.
- **The showcase branch differs by exactly that one line** (`= true`).
- **Native gates (three, all additive):**
  1. `(tabs)/_layout.tsx` — the feed slot wrapped in
     `<TopTabs.Protected guard={FEED_ENABLED}>`. Under TopTabs this matters
     doubly: `Protected` removes the slot from the bar AND the page from the
     pager — a merely-hidden slot would still be swipeable-into.
  2. First line of `(tabs)/feed.tsx` and `story/[accountId].tsx`:
     `if (!FEED_ENABLED) return <Redirect href="/" />;` — covers deep links
     sent by other apps.
  3. Every other native entry point (StoriesRail, PostCard) lives inside the
     gated tab; grep confirms no stray `/feed` or `/story` link in `app/src`.
- **Web gates:** `Layout.tsx` filters `/feed` and `/explore` out of
  `navItems` and `HELD_BY`; `App.tsx` renders `/feed`, `/explore`,
  `/explore/:postId`, `/story/:accountId` as `<Navigate to="/" replace />`
  when off (routes stay in the table — nothing deleted); `routes.ts` builds
  `ROUTES` through one flag-aware filter so `known()` refuses the four paths
  and `safeNext` never remembers a feed link; `Outfits.tsx` "Share this
  look" gates (it posts to the store the feed reads); `Profile.tsx`'s
  "What you are showing / On show" grid gates (same store, one reader).
  **Show / Ask / Lend stay whole** — the conversation verbs are the owner's
  "sharing with friends stays," said in the four-verb grammar.
- **Not gated, by explicit ruling:** the intake bench's "From a feed
  screenshot" import (`#intake-feed`, `/intake`) is the PHOTO bench, not the
  social feed. It stays in both branches, and the suites assert its presence
  in both so nobody helpfully gates it.
- **Deep links, flag off, resolve to Today silently.** No plaque, no
  explainer, no date. A door that is not in the house this season gets no
  plaque.
- **The alpha note, final and entire:** *"For the alpha, the house keeps to
  your closet and the people you already talk to."* The marketing seat's
  truncated second sentence ("Sharing a look works from any piece") is
  declined: "Share this look" is the gated Share verb's own UI words, and
  the four-verb grammar does not permit the ambiguity. What remains needs no
  sentence — Chats is on the bar.

## 3 · The swipe

**Mechanism:** `TopTabs` from `expo-router/js-top-tabs` in
`(tabs)/_layout.tsx`, `tabBarPosition: 'bottom'`, the `tabBar` render prop
replaced wholesale with `HouseBar`. The navigator that owns the URL owns the
gesture — no double-driven state. Options: `lazy: true`,
`lazyPreloadDistance: 1`.

**Dependencies** (owner sign-off before the wave, §10):
`npx expo install react-native-pager-view` (pins 8.0.2 — inside Expo Go for
SDK 57, verified in the versioned docs and `bundledNativeModules.json`) plus
`npm i react-native-tab-view@^4.3` (pure JS; sole dependency
`use-latest-callback`). Nothing imports gesture-handler; the pager needs
none of it.

**The feel — paper on a rail.** The finger slides the sheet 1:1; both
grounds stay opaque `--color-bg`; the incoming sheet leads with a 1px
hairline edge in `--color-border`; on release a 180ms
`Easing.out(Easing.cubic)` settle; no parallax, no zoom, no bounce. The
eyelet bead is the pager offset interpolated over measured slot centres and
arrives as the sheet squares up. Each sheet carries its own masthead the
whole way. A tab swipe carries no motif — art on every swipe is wallpaper.

**Conflicts, resolved:**

- **The story viewer is never a pager page.** It is a pushed route over the
  tabs (`app/src/app/story/`, outside the `(tabs)` group); its tap zones and
  hold-to-pause survive untouched. This stays true permanently.
- `/chats/[id]` is a stack route outside the tabs; the iOS back-swipe keeps
  working.
- Any child owning a sideways gesture — TagRail, a photo rail, StoriesRail —
  wins over the pager. Standing rule: every future horizontal rail is QA'd
  against the pager, or that one screen sets `swipeEnabled: false`.
- **Predictive back is never intercepted.** The screen edge belongs to the
  OS; back walks the current screen's own stack, then predictive-back to
  the launcher from Today.

**Reduced motion — the full answer.** The drag still tracks the finger (the
user's own hand is not motion the system asked for); the release settle is
immediate, no eased fling; a bar tap is a 140ms opacity crossfade, no slide;
the eyelet does not travel — it is punched at the new slot; the room-change
motif collapses to a plain fade. Nothing else in the shell moves. One
`AccessibilityInfo.isReduceMotionEnabled` hook in the shell, passed to
HouseBar.

**The retreat, pre-declared:** Option B — the current bottom `Tabs`, no
swipe. `HouseBar` is navigator-agnostic by contract:

```tsx
interface HouseBarProps {
  slots: { key: string; label: string; Icon: ComponentType<IconProps> }[];
  activeIndex: number;
  position?: PagerOffset;   // absent under Option B and reduced motion
  reduceMotion: boolean;
  onPress(index: number): void;
  onLongPress(index: number): void;
}
```

Under Option B the punched eyelet becomes the only treatment; the bar does
not change. Flip rules are pass/fail in the stress list (§10) — written
before the wave, not after.

## 4 · The House (native `/profile`)

One hall, doors and facts. **Junk-drawer law:** no content lives on the hall
floor — every plate is at most two door rows plus one mono fact line; a
plate that wants a third row becomes a pushed room. Every room is ≤2 taps
from the bar. **Doors only for rooms whose ports exist** — the no-plaque
rule applied inward: Ledger, Wishlist, Before-you-buy, and the Shared rail
gain their rows only as their native screens land, in the floor-plan order
below. Web `/profile` keeps all its rooms.

```
+----------------------------------------------+
| THE HOUSE · DYE HOUSE                    (S) |  <- spool (IconSettings) -> /settings
|  [A]  Asha's wardrobe                        |  <- tag-portrait 44dp -> switcher
|       KEPT SINCE MARCH 2026                  |  <- a date, never a streak
|       41 PIECES · 128 DAYS ON THE RECORD     |  <- facts, mono
| ============================================ |
| | (THE LEDGER · THE BUYING TABLE ·         | |  <- reserved rows: render only
| |  THE SHARED RAIL — as their ports land)  | |     when the room exists
| | THE ROOM                                 | |
| |   Dye house — the default room         > | |  <- motif draws once on change
| | THE RECORD                               | |
| |   Export the record                    > | |  <- lossless, always
| |   This wardrobe stays on this device.  > | |  <- sync as fact; its sheet holds
| | WARDROBES ON THIS DEVICE                 | |     the account row. Synced on:
| |   [P] Priya's wardrobe                 > | |     "Synced · last night"
| |    +  Open another                       | |  <- -> /open
| (HONORS — renders only once docs/36 ships)   |
| (LOOKS YOU HAVE SHARED — flag-on only)       |
+------------------------------------o---------+
|  TODAY      CLOSET       CHATS      HOUSE    |
+----------------------------------------------+
```

- **The four factual plates** (below the nameplate): pieces on the rail ·
  wears noted · outfits kept · what it cost. Cumulative facts about the
  clothes — never a rate, delta, streak, or comparison. A plate with nothing
  to say says nothing; no zeros dressed as prompts.
- **Floor-plan order of record** (rooms slot in as ports land): nameplate →
  Ledger → buying table (Wishlist, Before you buy) → Shared rail → the Room
  → the Record → Wardrobes. The Ledger sits above the fold when it arrives.
- **Flag on:** LOOKS YOU HAVE SHARED joins below the Record — snapshots in
  4:5 frames, reverse-chron, captioned, countless. In alpha it is absent,
  not empty.
- **Signed out (local-only):** the nameplate carries *"Kept on this
  phone."* — a fact, not a lack. Wardrobes collapses to the `/open` door.
  The Record's device row opens the record sheet, where the account sits as
  one quiet hairline row in the door's own words ("Sign in or create an
  account"). No banner, no badge, no modal.
- **Chats, signed out and empty:** masthead CONVERSATIONS; one editorial
  line — *"Conversations travel between wardrobes with accounts. This one
  keeps to this phone."* — and one hairline door to `/open`. That is the
  entire screen, and it repeats nowhere else in the shell.
- **Build size:** one route file ~200 lines plus a ~40-line `Stat` plate
  port; reuses `useWardrobe`, tokens, `AccountLine`. Switcher sheet:
  `WardrobeSwitcher.tsx` — grab handle, tag rows, "Open another".

## 5 · Home is Today

The record has exactly one urgent question a day — *what did today wear?* —
and the two-tap wear log is the load-bearing wall: any other home makes the
log three taps. So home is Today; the slot says TODAY (the label names the
screen; "home" was the owner describing a function, not naming a door); back
from Today is predictive-back to the launcher; and when the flag turns on,
the Look Book takes the centre slot and home does not move. The hero pair —
LOG THE DAY'S WEAR, SAME AS YESTERDAY — stays in the bottom third at the
thumb. The seal-press fires on "Set it down": during the action, never
wallpaper, plain fade under reduced motion.

## 6 · Where the pack's rooms live on the phone

| Pack slot | Where it lives |
|---|---|
| **Calendar** | Behind Today's **week strip**: a 56dp strip between the masthead and ON THE RECORD — seven 44dp day cells, carmine day-mark under logged days, an eyelet over days holding events, a month door (`AUG >`) at the strip's end to the deep archive. Events ride with it, day-anchored. A strip day opens **that day's page**, never a month grid. |
| **Ledger** | A room of the House (its row lands with its native port; on web it stays a More-sheet item). The counter book is kept, not toured. |
| **The House** | The fifth slot itself. |
| **Settings** | Off the bar. `(tabs)/settings.tsx` MOVES to `app/src/app/settings.tsx`; `<Stack.Screen name="settings" />` joins the root stack in `app/src/app/_layout.tsx`; `/settings` survives verbatim; the House masthead spool does `router.push('/settings')`. |
| **Outfits** | A segment of Closet (the pack's own ruling). Web converges post-alpha: `/outfits` will select the segment. |

**Tap arithmetic, proven from code** (`logWear` already takes a date —
`src/pages/Calendar.tsx:173` — so the strip needs zero engine change):
log today, 2 taps (unchanged — the wall); log a day this week, 3 (was 4);
log an older day via the month door, 4 (unchanged); pack an event from the
strip's event eyelet, 2 (was 3). The metaphor never adds a tap; twice it
returns one. The single declared cost in the whole plan: web-mobile Outfits
leaves the rail for the More sheet, +1 tap, spent to seat the owner's
roster. The seven-days-out event plate on Today is deferred to the events
port — a Today-page question, not shell scope.

## 7 · Web parity — one roster

`packages/shared/nav.ts` (new), the single source of truth both bars read:

```ts
import { FEED_ENABLED } from './flags';

export interface NavSlot {
  key: string; path: string; label: string;
  shortLabel?: string; flagged?: boolean;
}

/** The bar in order; the centre slot belongs to the flag. */
export const NAV_SLOTS: NavSlot[] = [
  { key: 'today',    path: '/',        label: 'Today' },
  { key: 'closet',   path: '/closet',  label: 'Closet' },
  { key: 'lookbook', path: '/feed',    label: 'Look Book', shortLabel: 'Looks', flagged: true },
  { key: 'chats',    path: '/chats',   label: 'Conversations', shortLabel: 'Chats' },
  { key: 'house',    path: '/profile', label: 'House' },
];

export const barSlots = () => NAV_SLOTS.filter(s => !s.flagged || FEED_ENABLED);
```

Each app binds its own icon component by `key`; native maps path to screen
name (`'/' -> index`, … `'/profile' -> profile`). Order cannot diverge —
both bars and the eyelet's stops read one array.

`src/components/Layout.tsx` changes: `mobilePrimary` (line 61) derives from
`barSlots()` — flag off, the phone rail reads **Today · Closet · Chats ·
House · More** (More is the web's fifth cell; native has no More sheet);
flag on, Today · Closet · Looks · Chats · More, with House via More — six
cells at 320px is a wall we do not build. The `/profile` entry's label
becomes **House** with `IconHouse`; the address does not move. Outfits'
slot goes to the More sheet (its `navItems` entry and `/outfits` address
untouched). `navItems` and `HELD_BY` filter `/feed` and `/explore` on the
flag. `src/App.tsx` and `src/lib/routes.ts` gate as §2. The travelling bead
never comes to the web — there is no pager under it; the mobile rail keeps
its foot-of-slot accent dot through alpha (the punched eyelet may land in
Wave 1 only if the artist supplies the CSS). One visual system per app per
release.

## 8 · The art moments that survive — the motif budget

- The eyelet bead's travel along the hairline is furniture, not art — it
  rides the pager offset and costs nothing.
- The seal-press on "Set it down" — kept as shipped: during the action,
  never wallpaper.
- The room-change motif draws itself across **once per room change**, fired
  from the House's room row — never on a tab swipe. Plain fade under
  reduced motion.
- The switcher sheet rises like every other sheet: grab handle, no ceremony.
- Total new artwork this wave: none. The shell spends its whole budget on
  the bead.

## 9 · Accessibility

- **Touch:** every slot is a full-height, full-width target (≥44dp by
  construction; 56dp + inset). Week-strip day cells 44dp. The long-press
  target is the whole House slot.
- **Screen readers, native:** each slot `accessibilityRole="tab"`,
  `accessibilityState={{ selected }}`, label "Today, tab 1 of 4" — the count
  from the *visible* roster. The House slot carries `accessibilityHint`
  "Hold to switch wardrobes." The eyelet and hairline are
  `importantForAccessibility="no"`. The settled page announces its masthead.
- **Web:** `<nav>` landmark, `aria-current="page"` on the active slot,
  visible focus ring, the More sheet keeps its three ways out (Escape,
  scrim, navigation).
- **Type:** the 13px floor is restored everywhere; no 11px interactive text
  remains in either app.
- **Contrast:** active ink is `--color-text` on `--color-surface` (AA in
  every room); the eyelet is `--color-accent` on surface — a graphic pair to
  re-measure at ≥3:1 across all six rooms in `test:contrast`. No ink fill in
  the bar, so `--color-accent-on-ink` is not in play.
- **Reduced motion:** §3's full answer; everything else in the shell was
  already opacity-only per brand rule 9.

## 10 · The build plan

**Owner sign-offs required before Wave 2, stated here and in the wave
report, never assumed:** (a) `app/package.json` gains
`react-native-pager-view` (via `npx expo install`) and
`react-native-tab-view@^4.3`; (b) the same edit pins the pre-existing
landmine to Expo Go's binaries — gesture-handler ~2.32.0, reanimated 4.5.1
(`app/node_modules` currently carries unpinned 3.2.1 / 4.5.3; nothing
imports either, and nothing may). No git mutations by squads; the owner
commits.

**Wave 1 — FLAG+WEB** owns: `packages/shared/flags.ts`,
`packages/shared/nav.ts` (both new); `src/components/Layout.tsx`;
`src/App.tsx`; `src/lib/routes.ts`; `src/pages/Profile.tsx`;
`src/pages/Outfits.tsx`; `src/components/icons.tsx` (IconHouse);
`src/index.css` (`.type-label-rail` to 13px); `scripts/test-flows.mjs`;
`scripts/test-features.mjs`.
Gate: `npm run verify` + flows + features green at BOTH flag values.

**Wave 2 — SHELL** owns everything under `app/`: `(tabs)/_layout.tsx`
(TopTabs + `Protected` + HouseBar; the docstring's 11px paragraph goes with
the token); `src/components/HouseBar.tsx` and
`src/components/WardrobeSwitcher.tsx` (new); `(tabs)/profile.tsx` (new); the
settings move + root-stack registration; first-line redirects in
`(tabs)/feed.tsx` and `story/[accountId].tsx`; `src/icons/index.tsx`
(IconHouse); `src/tokens/typography.ts` (delete `rail`); `app/package.json`
(signed off).
Gate: the stress list below, on devices.

**Wave 3 — ARTIST** polish on `HouseBar.tsx` only (eyelet travel, settle
curve, reduced-motion crossfade); suites re-run.

**Suite matrix (Wave 1 writes it):**

- `test-flows.mjs`: PAGES — flag off, `/feed` and `/explore` land on `#/`
  with the Today masthead; door intent — signed-out `/#/feed` lands home
  silently, history delta ≤1, the door never says "feed"; "the feed,
  exercised" runs only flag-on. Both branches: the mobile rail equals the
  roster; the More sheet carries no Feed/Explore when off; Outfits has no
  "Share this look" when off; Profile has no on-show grid when off;
  `/#/story/x` and `/#/explore/x` land home when off.
- `test-features.mjs`: the stranded `/feed` deep-link case branches on the
  flag; the intake bench (`#intake-feed`) asserted present in BOTH branches.
- Untouched: `test-feed`, `test-feed-intake`, `test-gallery-intake`,
  `test-migrate`, `test-demo`, `test-sync`.

**QA stress list (Wave 2's gate).** Devices: one physical Android via Expo
Go + emulator API 35; iOS simulator + one physical iPhone. Half a day.
Pass/fail, not vibes:

1. Bar tap to pager sync: 20 mixed-order taps, scene always matches slot,
   zero desync or double-render. **Fail: Option B.**
2. Full traverse both ways: finger tracks 1:1, never skips a page, the bar
   lights the right slot. **Fail: Option B.**
3. Eyelet lands centred over the active slot ±1dp, one settle, no drift; a
   second tap mid-settle never strands the bead between stops.
4. A drag started inside Closet's horizontal TagRail: the rail wins 10/10.
   **Fail: `swipeEnabled: false` on that screen — not a retreat.**
5. Android edge-back from `/chats/[id]` pops the stack without paging;
   predictive-back preview shows the correct screen. **Fail: Option B.**
6. Reduced motion ON: taps crossfade 140ms with no slide; the drag still
   tracks; settle immediate; eyelet punched, not travelled.
   **Fail: fix before ship; accessibility is not negotiable.**
7. `lazy` + `lazyPreloadDistance: 1`: no visible blank scene on page-in;
   Closet's scroll kept when swiping away and back within preload distance.
   **Fail: one day of tuning, then Option B.**
8. Showcase branch: five slots, LOOKS seated centre; StoriesRail scrolls to
   its end before the pager takes the gesture; the rail is never dead.
9. Both branches, both apps: equal-width slots (bar/4 or bar/5, ±1dp), no
   ghost gap; labels 13px; the eyelet sits over the route under test in
   every screenshot.

---

## Sign-off

Approved as the panel's closing ruling. Two amendments against my own
round-1 direction, made explicitly: the House slot wears `IconHouse`, not
the ported hanger — the rename outweighs the earlier seating, and the
no-letterform point survives it; and the marketing seat's truncated second
sentence for the alpha note is declined — it borrows the gated verb's own
words. Everything else stands as the panel converged it: home is Today; the
fifth slot is the House; addresses never move; TopTabs wears the artist's
cloth; the flag is one constant flipped in one commit; no notification
chrome anywhere on the bar; the retreat to plain tabs is pre-priced and
cheap. The clothes keep their addresses. Only the doors were rehung.

— The advisor seat, navigation panel, 2026-08-20
