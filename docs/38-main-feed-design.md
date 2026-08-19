# 38 — The Look Book: main feed, clubs, and the page map

> **Status:** design record · **Convened:** 2026-08-19 · **Squad:** FEED-DESIGN —
> a senior tech lead, a principal designer, and a marketing psychologist,
> moderated, run against the alpha build. **Companions:** the sprint plan in
> `docs/33-alpha-mobile-roadmap.md`, the panel record in
> `docs/35-alpha-panel.md`, the honors spec in `docs/36-badges-rewards.md`, the
> feed decision record in `docs/12-wardrobes-and-feed.md`, the household model
> in `docs/19-households.md`. The component law (`.claude/skills/wardrobe-brand`,
> `docs/05-brand-identity.md`) binds everything below.
>
> **The owner's direction, as received:** a closet wardrobe organizer with a
> fashion-based, Instagram-inspired feed as the social layer; layouts of mixed
> squares and rectangles — a masonry grid of looks; marketing-psychology-
> optimized within the house law as amended (positive-only honors, no public
> counts, streaks, or shame; no commerce; samples labeled).

---

## 1. The loop record

Three reviewers, one moderator. Each one's non-negotiables, then the rulings
where they argued.

### What the tech lead insists on

Grounded in what the code already does and what broke when it didn't.

1. **The snapshot model stays.** A shared look is a self-contained copy — name,
   image, piece names, occasion — written into the shared store at share time
   (`docs/12`; `src/types.ts` `SharedLook`). Consent is structural: no code path
   can render an unshared piece, because unshared pieces are not in the store
   the feed reads. No live joins, no reading another wardrobe's store, now or in
   the masonry redesign. A grid cell is a dated statement, not a window.
2. **The scopes stay.** The five scopes (`src/types.ts:433-437` — everyone, one
   conversation, one person, just the household, only this wardrobe) and
   `postVisibleTo` (`src/types.ts:466`) are the whole visibility system. Clubs
   (§3) reuse the household scope; no new scope kind is invented for this
   design.
3. **Local-first default.** The feed reads the on-device shared store
   (`CommunityState`, `src/types.ts:565`). Nothing in this document requires a
   server, an account, or sync. Where a feature would require one, it is listed
   under "never ships" or deferred to the E2E-sync gate (`docs/34` H3).
4. **The masonry grid is CSS-only, 60fps, no layout-thrash.** No measured
   JavaScript masonry: no absolute positioning, no `ResizeObserver`, no
   per-image height reads. CSS multi-column does the packing; the browser does
   the work; scroll stays on the compositor. Images keep `loading="lazy"`
   (already in `LookThumb`, `src/components/social.tsx:97`) and grid cards take
   `content-visibility: auto` with a `contain-intrinsic-size` estimate so
   offscreen cards cost nothing. The failure mode this refuses: the first
   masonry implementation that janks a mid-tier Android at 390px — the exact
   device class the alpha panel sits on.
5. **Drawn flats and photographs are first-class alike.** The plate renders
   `imageUrl` when present and `GarmentPlate` when not
   (`src/components/social.tsx:93-103`); both sit on the flat mat tile, and no
   layout branch may assume one or the other. A grid that only works with
   photos is a grid that fails every new wardrobe's first week.
6. **Ordering is data, not layout.** `newestFirst` (`at`, then `date`, then id —
   `src/components/social.tsx:172-177`) is applied to the list before layout;
   layout never reorders. The `at` clock stamps user posts with real local time
   (`nowLocalStamp`, `src/components/social.tsx:153`) and schedule posts with a
   deterministic evening hour (`src/lib/feedEngine.ts:210-215`).

### What the principal designer insists on

1. **The masonry rhythm law.** Plate ratios come from the wardrobe's own aspect
   system — the garment card's 4:5 (`docs/05` §7) and its two neighbors, 3:4
   and 1:1 — and from nowhere else. Three ratios, never random for its own
   sake: the eye should read a weave, not a shuffle. The ratio of a given post
   never changes between loads; a grid that re-tiles on refresh is a room that
   rearranges your furniture while you're out.
2. **One hero per viewport.** The newest look leads, once, above the grid.
   Below it, nothing exceeds a column width. The feed's single vertical rail
   (`max-w-[460px]`, `src/pages/Feed.tsx:133`) is retired on desktop — it was
   the right shape for eleven cards and the wrong shape for a look book.
3. **Hairlines, not shadows.** Depth stays the house way: 1px chalk hairlines,
   manila layering, the 1px plate edge (`docs/05` §7). Masonry grids invite
   card-shadow creep; none is admitted. Radius stays 2. The photo-grid purity
   rule wins every conflict — no ornament behind a plate.
4. **Motion ≤200ms.** Ease-out fades only, per the component law; the grid
   itself never animates layout. `prefers-reduced-motion` collapses what little
   remains. No staggered-load theatrics on the feed — that pattern belongs to
   marketing pages, and this is not one.
5. **The editorial voice carries the caption, the ledger voice carries the
   facts.** Caption in Fraunces italic-adjacent editorial register (as now,
   `src/pages/Feed.tsx:228`); author, date, pieces, and scope in Plex Mono
   11px caps. Never above 15px, never below the 13px interactive floor.

### What the psychologist insists on

Levers admitted, and the bright line. Frameworks as defined in `docs/35`.

**Allowed:**

- **Variable-reward freshness from the living feed.** The persona schedule
  (`src/lib/feedEngine.ts:196-222`) makes the room different on a Tuesday than
  it was on a Monday. This is a variable reward with no slot machine behind it:
  the content varies, the mechanism is visible, and nothing is withheld to
  manufacture a pull. Admitted because docs/02's "Cher Horowitz" browseability
  is a genuine user want, and the feed is where it lives.
- **Completionism via honors.** Per `docs/36`: private, positive-only,
  off-by-default, unloseable facts, never goals, no catalogue of the unearned.
  Admitted as amended — the owner confirmed the amendment 2026-08-19
  (`docs/35`, owner decision 1).
- **Social proof inside clubs.** Real, named, accepted membership (the
  household invitation model, `docs/19`) feeds SDT relatedness honestly — the
  panel's diagnosis was that *faked* relatedness converts warmth into evidence
  of manipulation (`docs/35`, behavioral researcher). A club you actually
  joined is the proof; a sample wardrobe labeled as one is the set dressing,
  honestly marked.
- **Endowed progress on closet-filling.** Already house law (`docs/05` §8.4);
  the feed extends it — your own cards in the grid are the record, worn in
  public under the scopes you chose.

**Banned, and named so no ticket can smuggle them back:**

- Public counts of any social kind — likes, followers, saves shown to anyone
  but the saver, "seen by", member-count chrome on club cards, post counts as
  status. (A factual count of your own device's store in your own masthead —
  "11 shared", `src/pages/Feed.tsx:116` — is a ledger fact about your device,
  not a social metric; it stays.)
- Streaks, in any costume. A span is honored (`docs/36` #9); a streak is not.
- FOMO timers, expiring content, "before it's gone" framing of any kind.
- Infinite-pull dopamine copy — no "pull to see more", no manufactured
  anticipation, no unread bait. The feed ends when the store ends, and an
  honest end-of-rail line says so.
- Discovery surfaces, ranking, "people you may know" — the full absent list in
  `docs/12` stands.

### Rulings

- **Tech lead vs designer, on ordering in a masonry grid.** CSS columns fill
  column-major: the first column fills downward, then the second. Strict
  left-to-right recency across a row is not achievable without measured JS
  layout, which is refused. **Ruling:** the ordering promise is amended in the
  open — `newestFirst` holds strictly *down every column*; across a row it is
  not promised. The hero (§2.4) pins the single newest post at the top so
  recency is never ambiguous where it matters. This is the same trade
  Pinterest and every CSS-masonry build makes; we make it in writing.
- **Designer vs psychologist, on the hero.** A hero is emphasis; emphasis on
  one person's look could read as an editorial verdict on whose clothes lead.
  **Ruling:** the hero is always and only the newest post in the active filter
  — a property of the clock, not of taste — and any author, sample or not, can
  hold it. The sample tag shows on a hero the same as on any card.
- **Psychologist vs the owner's "Instagram-inspired," on the record.** The
  pattern is admitted (image-first cards, a browsable grid, a share sheet);
  the mechanics are not (metrics, ranking, infinite pull). This is exactly
  docs/33's D1: Instagram-*patterned* inside Toile component law. The design
  below is that sentence, drawn.

---

## 2. The main feed — named the Look Book

### 2.1 The name, and why not the alternatives

**Decision: the room is called the Look Book. The address stays `/feed`.**

- *Why not "The Rail":* the name is taken. `/rail` is the Shared Rail — the
  borrowing ledger between people who already know each other
  (`src/pages/Rail.tsx:11`, `src/lib/routes.ts:28`). Two rails in one
  navigation is a collision the copy would spend itself out of, and the words
  mean different things: a rail is where hangers wait to be lent; a book is
  where looks are kept.
- *Why not keep "Feed":* the panel's second through-line — "the feed's social
  framing outruns its reality" (`docs/35`). "Feed" is platform-speak and
  promises a population (friends, an algorithm, a crowd) that a device-local
  store does not have. The designer's option 2 — reframe the room so the
  promise matches the population — is the cheap half of honesty, and owner
  decision 3 already shipped the other half (sample labels). A look book is a
  bound collection of looks; that is precisely what the page is.
- *Why the address does not move:* `src/lib/routes.ts:13-15` already holds the
  principle — renaming a path to match a label is a 404 for somebody. The
  route stays `/feed`, `ROUTES` gains `name: 'the look book'`, the nav label
  becomes "Look Book" (mobile rail: "Looks"), the masthead reads "The Look
  Book". Bookmarks, deep links, and the guard's remembered destinations all
  survive.

### 2.2 The masonry look-grid

**Container.** The single 460px rail is retired. The grid takes the standard
content column (`max-w-5xl`, as every other page), gutter 16px — two steps of
the 8px grid law.

**Column rules, by viewport width:**

| Viewport | Columns | Where |
|---|---|---|
| < 640px | 2 | every phone the alpha targets (360/390/412px) |
| 640–1399px | 3 | tablets, small desktop, desktop beside the 220px rail |
| ≥ 1400px | 4 | wide desktop only |

Implementation is one line of the house's own idiom: CSS `columns` with
`break-inside-avoid` on the card. No JavaScript measures anything.

**The ratio law.** Every plate is one of **1:1, 3:4, or 4:5** — the garment
card's 4:5 and its two neighbors. The ratio is a deterministic property of
the post, derived from the post id with the same FNV/mulberry hash family the
persona engine already uses (`src/lib/feedEngine.ts:25-36`): roughly 15% fall
1:1, 25% fall 3:4, 60% keep 4:5. Nothing is stored; the same post tiles
identically on every load, every reseed, every device. Schedule posts carry
deterministic ids (`feed-<personaId>-<date>`, `src/lib/feedEngine.ts:224`), so
their plates are stable too. Flats and photos both fill their plate by
`object-cover` on the mat tile; the ratio law applies to the plate, not the
asset, so a drawn flat and a photograph weave identically.

**Ordering, stated honestly (the §1 ruling).** The list is sorted
`newestFirst` before layout — `at`, then `date`, then id — and layout does
not reorder. Down any one column the rail is strictly chronological; across a
row it is not. The hero pins the newest. The standing copy under the masthead
changes one line, from "In the order they were shared"
(`src/pages/Feed.tsx:119`) to: *"Newest leads; every column reads newest
downward. Nothing is ranked, counted, or scored."*

### 2.3 Card anatomy

One look per card, top to bottom, in this order — the current `FeedCard`
(`src/pages/Feed.tsx:173-267`) re-proportioned for the grid:

1. **The plate.** The look image or drawn flat in its assigned ratio, 1px
   `border-border` hairline, radius 2, mat tile behind (`bg-mat`). Nothing
   decorative behind it. Tapping the plate goes nowhere new — no lightbox in
   alpha; the look's home is its author's profile grid.
2. **The author line.** `AccountMark` at 26px, wardrobe name, then
   `handle · date` in 11px mono (`AccountLine`,
   `src/components/social.tsx:26-43`). The name links to `/profile/:id`. The
   **sample wardrobe** chip sits beside it whenever `author.isSample` — the
   shipped honesty marker (`src/pages/Feed.tsx:210-214`; `docs/35` owner
   decision 3) — unchanged in the grid.
3. **The save mark.** The bookmark `IconButton` (18px, top-right of the author
   row, `aria-pressed`, as now) — the feed's only engagement mechanic, private
   to this device, counted nowhere (`src/types.ts:578-582`).
4. **The caption.** Editorial face, clamped to three lines in the grid; full
   length on the hero. No "more" unfolding inside a card — a caption that
   needs a fourth line belongs to its author to edit.
5. **The ledger line.** Look name · occasion, then pieces joined by `·`, 11px
   mono (`src/pages/Feed.tsx:240-246`). A piece-post (`post.piece`, no look)
   keeps its `PieceCard` rendering — the grid is not looks-only by fiat; the
   store holds piece shares and the grid serves them.
6. **Author-only controls.** The scope chip and the take-down button render
   only on your own cards (`src/pages/Feed.tsx:251-262`) — a reader is told
   nothing about a shelf they were handed. Both survive the redesign
   untouched.

### 2.4 The hero

The newest post in the active filter renders once, above the grid.

- **Mobile:** full content width; plate at 4:5, capped at the same ~380px the
  `LookCard` cap already enforces (`src/components/social.tsx:60-63`); caption
  in the editorial face at 19–20px below the plate.
- **Desktop:** the plate left (4:5, capped), the caption block right — author
  line, full caption, ledger line — a two-up spread, one hairline frame.
- One per viewport, by law: no second enlarged card anywhere down the grid.
- The hero is the clock's choice, not an editor's. A sample wardrobe's post
  can hold it; the tag says so. When the filter is "Set aside", the hero is
  the newest *set-aside* post — the filter defines the population, the clock
  picks from it.

### 2.5 The quiet filter rail

One hairline strip directly under the masthead, mono 11px caps, chips as they
already exist (`src/components/ui.tsx` `Chip`). Three filters, left to right:

1. **Everything** — the default. Every visible post.
2. **Set aside** — your private marks. The chip exists only once something is
   set aside (the current law, `src/pages/Feed.tsx:124-129` — a filter to an
   empty room is clutter, not a feature).
3. **Scoped to you** — posts addressed narrower than everyone: to this
   wardrobe, to a conversation you're in, or under a roof you've joined
   (`scope.kind` ≠ `everyone`, visible by `postVisibleTo`). Appears only when
   such a post exists. This is where club posts surface in the main book
   without a club ever needing a badge.

No counts on chips. No chip for samples — the samples *are* the standing
population and their tag already says so; a "hide the samples" filter was
considered and cut: it spends chrome to say a thing the diary study
(`docs/33` G2) should settle about the tab itself.

### 2.6 Empty states

Every empty room teaches one thing, copy law held, no exclamation point spent.

- **Nothing shared at all:** the current plate and copy stand
  (`src/pages/Feed.tsx:98-107`): "Nothing is on show yet." with the single
  action — *Choose a look to share* / *Build a look to share* — routing to
  `/outfits`. Amended with one appended sentence, the first-run honesty card
  the designer prescribed (`docs/35`): *"The closets marked sample wardrobe
  ship with Almari to show what a living look book looks like."*
- **Set aside, empty:** the current line stands ("Nothing set aside right
  now…", `src/pages/Feed.tsx:150`).
- **Scoped to you, empty:** *"Nothing has been addressed to this wardrobe
  yet. Looks shared to a roof or a conversation you belong to appear here."*
- **A club rail, empty:** *"No looks have been shared under this roof yet."*
  with one action: *Share a look to this roof* (Outfits → share sheet, roof
  scope preselected).
- **End of the rail:** when the grid runs out, one mono line —
  *"That's everything on show."* An honest end; no pull-to-load, no infinite
  anything.

### 2.7 How the personas' schedule posts interleave

They don't get a lane. The schedule engine (`src/lib/feedEngine.ts`) derives
each installed sample's dated posts from its own outfits, calendar, and
seasons — deterministic per persona per day, capped, tombstone-aware, pruned
at 30 days, and never touching user posts. User shares stamp real local time
(`at`); schedule posts stamp a deterministic evening hour, 17:00–22:59
(`src/lib/feedEngine.ts:210-215`). The merged store sorts by `newestFirst`
and that is the entire interleaving mechanism: same-day posts order by the
clock, not by id luck, not by author class. A household post at 18:12 sits
above a persona's 17:00 post and below their 21:00 one. No boosting, no
pinning, no "sample posts sink to the bottom" rule — the tag is the
disclosure, and placement is the clock's.

### 2.8 Mobile and desktop forms

- **Mobile (390px reference, verified through `test:flows` +
  `test:features`):** masthead "The Look Book", the quiet filter rail beneath
  it, then the hero full-width, then the 2-column grid. Cards lose nothing —
  the same six elements, the save mark reachable in the thumb zone. The
  bottom rail's fourth slot reads **Looks** (§4.1).
- **Desktop:** the 220px sidebar lists *Look Book* between Before you buy and
  Conversations (§4.1); the page runs hero-as-spread, then 3–4 columns by the
  viewport table. The "What you are showing" card (`src/pages/Feed.tsx:156-168`)
  moves from the page foot to a right-hand margin plate at ≥1400px, and stays
  a foot plate below that — it is your own sharing ledger, useful, and not
  worth permanent column space at phone widths.

### 2.9 What never changes

The absent list from `docs/12`, restated because the grid must not smuggle
any of it back: no likes, reactions, counts, followers, discovery,
algorithmic ranking, unread badges, "seen by", streaks, share counts, and no
comments under a share — talk about a garment happens in a conversation,
where it is a conversation.

---

## 3. Clubs & groups — households grow a rail

### 3.1 What a club is

**A club is a roof with a name and a rail.** The record is the household
record, unchanged: `{ id, name?, kind, members: [{accountId, joined?}] }`
(`src/types.ts:542-547`). The `docs/19` veto list stands entire — a household
stores ids and a kind, nothing else; every crossing is a snapshot; membership
is flat. What changes is the surface:

- Any household may carry a name (the field already exists). **A named
  household presents as a club** — it gets a page, a rail of looks shared
  under it, and a place in this document's navigation.
- One new kind joins the three (`partners`, `housemates`, `family`):
  **`circle`** — the generic room for friends, a class, a team. The kinds
  describe rooms, never relationships (`docs/19`; §2.7 of the founding
  requirements), and "a circle" is a room. This is the answer to Maya's panel
  finding — "no friend can ever join" made the feed set dressing — at device
  scale: friends on this device can, now, share a room.
- Clubs are per-device, like every record in the shared store. Cross-device
  clubs wait on the E2E-sync gate (`docs/34` H3); the design draws no
  architecture docs/34 hasn't already committed to.

### 3.2 The club page and its tabs

New route `/clubs/:id` (§4.2), reached from the Profile's "Under this roof"
cards — the author's own scope chip on a club post links there too, and the
chip renders for the author alone (`src/pages/Feed.tsx:251-262`), so no
reader is ever shown a door to a shelf they were merely handed. One masthead — the club's name, meta
in mono stating the kind ("a circle" / "a housemates' roof") — over three
tabs, hairline tab strip, the house's existing pattern:

1. **The rail.** The looks shared to this club — posts scoped
   `{ kind: 'household', householdId }`, which `postVisibleTo` already resolves
   to joined members only (`src/types.ts:466-488`). Same masonry, same card
   anatomy, same ordering law as the main book, two columns at every width (a
   club rail is a room, not a hall). Empty state per §2.6.
2. **The tray.** Pass-it-on offers between this club's members — visible only
   for the **family** kind, where docs/19 unlocks pass it on; other kinds show
   no tray tab at all (a capability that appears and disappears by kind is
   honest; one that renders disabled is a tease). Offers render as pull-only
   cards — the piece, its provenance line ("From Aarav. 12 wears in their
   record."), one *Take it in* action that completes the existing accept path
   (`src/pages/Closet.tsx:497-529`). The Closet tray remains the canonical
   landing place; the club tab is a view of the same `community.passes`
   records, so an offer seen under the roof is the same object seen in the
   closet.
3. **The roof.** The member list — `AccountLine` per joined member, invitation
   rows for the unanswered ("invited; nothing is shown until they say yes"),
   one *Invite a wardrobe* action (chooses among wardrobes on this device,
   reusing the invitation model), and *Leave this roof* for yourself —
   unilateral, asks no one (`docs/19` veto 3). Names, not numbers: no member
   count chrome anywhere on the page.

Sharing to a club happens where sharing already happens: the share sheet from
Outfits, where joined roofs are already listed as scopes
(`src/components/ShareSheet.tsx:124-134`). Clubs add no new compose surface.

### 3.3 Joining and leaving

Join-by-acceptance is the existing model, unchanged: a member without
`joined` is an invitation waiting for its yes; an unanswered invitation shows
nothing, unlocks nothing, and pressures no one — there is no "pending" nag
surface. Leaving is unilateral and takes effect immediately; the leaver's
past posts under the roof stay down-tagged to them as author but remain
visible to the roof (a shared look is a dated statement, and leaving a room
does not unwrite statements made in it). Removal of another member does not
exist — no admin hierarchy, membership is flat.

### 3.4 What never ships

- **No discovery feeds.** No "find clubs", no suggested roofs, no public
  directory. You are invited or you are not in.
- **No public profiles of non-members.** A club's rail, tray, and roof are
  invisible to accounts outside the membership — `postVisibleTo` already
  enforces this for posts; the club page inherits the rule whole.
- **No counts.** Not on club cards, not on tabs, not on the roof page. No
  "active this week", no post totals, no member totals.
- **No cross-club anything.** No posting to two roofs at once (one post, one
  scope — the existing `ShareScope` shape enforces it), no club-to-club
  surfaces.
- **No notifications, badges, or count bubbles** — `docs/19` veto 7, restated
  because a club with a badge is a club that becomes a chore.

---

## 4. The page-by-page map

The load-bearing section. Every route in `src/lib/routes.ts:9-34`, its one
primary action, where its controls sit, what changed this sprint, and the
target state. "Masthead" = the page's `Masthead` (title over double rule,
meta in mono at right); "rail" = the quiet filter rail under a masthead;
"sheet" = a modal in its mobile bottom-sheet form (`docs/33` D4); "card" = a
control living on the object itself.

### 4.1 The chrome

**Mobile bottom rail — five slots, thumb zone** (currently
`src/components/Layout.tsx:57`: Today, Closet, Outfits, Feed + More):

| Slot | Target | Address |
|---|---|---|
| 1 | Today | `/` |
| 2 | Closet | `/closet` |
| 3 | Outfits | `/outfits` |
| 4 | **Looks** (renamed from Feed; the alpha's diary gates arbitrate keeping the slot at all — `docs/35` owner decision 3) | `/feed` |
| 5 | More | sheet |

**More sheet contents, top to bottom** (currently the flat `secondaryNav`
list, `src/components/Layout.tsx:278-293`): Calendar · Events · Ledger ·
Wishlist · Before you buy · Conversations · Shared rail · Profile · Settings
· Wardrobes. Events moves up beside Calendar; the rest keep their order. The
sheet keeps its three ways out (scrim tap, Esc, route change —
`src/components/Layout.tsx:94-108,271-275`).

**Desktop sidebar order** (currently `navItems`,
`src/components/Layout.tsx:24-43`), target state — the record rooms first,
the social rooms grouped, the internals last, with a basting-stitch divider
before Look Book and before Settings:

1. Today · 2. Closet · 3. Outfits · 4. Calendar · 5. Events · 6. Ledger ·
7. Wishlist · 8. Before you buy
— *basting* —
9. **Look Book** · 10. Conversations · 11. Shared rail · 12. Profile
— *basting* —
13. Settings · 14. Wardrobes

Events moves from slot 8 to slot 5 (it is the Calendar's other face, not a
social surface); Shared rail moves from slot 12 to slot 11 (social rooms
together). The rail's footer is unchanged: the open-wardrobe switcher, the
Add a piece primary button, the in-closet count and theme control
(`src/components/Layout.tsx:184-209`).

### 4.2 Route by route

Legend for "changed this sprint": phase references are `docs/33`.

**`/` — today.** Purpose: what went on the record today. Primary action:
**LOG TODAY'S WEAR** — the hero-fill button on the log card, the one
sanctioned accent fill (`src/pages/Dashboard.tsx:462-495`). Controls: masthead
is the time-of-day greeting with the date in mono; everything else is card
content. Changed this sprint: nothing structural — the four-stat row and
category bars still stand (`src/pages/Dashboard.tsx:540-549`). Target: the
panel's fold (`docs/35`, designer) — the stat row collapses to one quiet line
("238 wears on the record") linking to the Ledger; the category bars move to
the Ledger; the greeting, hero log card, one rotating insight, and recent
entries stay.

**`/closet` — the closet.** Purpose: the catalogue. Primary action: **Add a
piece** (masthead-adjacent; also the global chrome action). Controls: filter
chips in a rail under the masthead (horizontal-scroll fix shipped, D8); item
cards carry their own hover border; the retire sheet holds the pass-it-on
offer (`src/pages/Closet.tsx:877-934`); the pull-only tray of incoming
hand-me-downs sits at the top of the list when offers wait
(`src/pages/Closet.tsx:497`). Changed this sprint: D8 chip-row clip fix. Target:
unchanged structurally; the tray gains a "viewed under the roof" affordance —
the same offers render on the family club page (§3.2) — and the door to
`/furniture` and `/intake` stays exactly as the HELD_BY map has it
(`src/components/Layout.tsx:77-79`).

**`/outfits` — outfits.** Purpose: composed looks. Primary action: **Build a
look**. Controls: share state lives on each outfit's card — "On the feed" /
"Not shared", "Share this look" / "Take it off the feed"
(`src/pages/Outfits.tsx:219-227`); the share sheet carries caption + scope +
the `at` stamp (`src/components/ShareSheet.tsx`; C3). Changed this sprint:
C3 share flow (caption, scope, timestamp). Target: the sheet's scope list
presents clubs by their room names (already true — it lists joined roofs);
no new compose surface.

**`/furniture`, `/furniture/:id` — the dressing room / a place.** Purpose:
where things physically live. Primary action: **Draw a place** (list) /
assign pieces (detail). Controls: sheet for drawing a place
(`src/pages/Furniture.tsx:194`); deliberately absent from every nav — reached
from inside the Closet (`src/components/Layout.tsx:45-54`). Changed this
sprint: none. Target: unchanged. The design explicitly keeps it tab-less.

**`/calendar` — the calendar.** Purpose: the week, planned and worn. Primary
action: **log or schedule a day** (day cells). Changed this sprint: D5
phone-navigable calendar. Target: unchanged by this design.

**`/events` — events.** Purpose: occasions with reserved looks. Primary
action: **Add an event** (sheet, `src/pages/Events.tsx:98`). Moved in the
sidebar beside Calendar (§4.1); mobile entry via More, same regrouping.
Target: unchanged otherwise.

**`/ledger` — the ledger.** Purpose: the numbers. Primary action: none — it is
a reading room of stats; the empty state's one door is **Add the first piece**
(`src/pages/Statistics.tsx:387`). Export lives where the data law puts it, in
Settings → Your data. Changed this sprint: the panel's ledger pack is Phase G5
(per-category CPW, marginal monthly CPW, utilization trend, CSV — the CSV
landing beside the existing JSON export in Settings) — wave 3, so in-flight,
not shipped. Target: receives the category bars folded out of Today; gains the
one calm honors line when one is set down (`docs/36` — gated, off by
default).

**`/wishlist` — the wishlist.** Purpose: wants under cooling-off. Primary
action: **Add a want**. Target: unchanged; The Cooled Wish (`docs/36` #12)
is its only growth edge, and it is a Profile plate, not a Wishlist surface.

**`/compare` — before you buy.** Purpose: talk yourself out of it, kindly.
Primary action: **compare the piece in hand**. Target: unchanged. Mobile rail
shortLabel "Compare" stands.

**`/feed` — the look book.** Purpose, actions, controls: §2 in full. Primary
action: there is no compose action on this page by design — sharing starts at
the outfit — so the primary action is the **private save**, on the card.
Changed this sprint: B1 (the `at` clock), B3 (tombstones), C1 (the schedule
engine), C2 (the card), C5 (the sample tag). Target: the masonry grid, the
hero, the quiet filter rail, the rename, the desktop margin plate.

**`/chats`, `/chats/:id` — conversations / a conversation.** Purpose: talk,
with looks and pieces riding along as snapshots; borrow asks. Primary action:
**send a message** (composer, foot of thread); list page's primary action is
**New conversation** (sheet, `src/pages/Chats.tsx:159`). Controls: attach
look / attach piece / ask after a piece, all in sheets
(`src/pages/Chats.tsx:426-482`). Changed this sprint: B1 message timestamps,
B4 — accepting a borrow request writes the real loan to the Rail ledger.
Target: unchanged by this design; club conversations are not a thing —
talk stays in threads, looks stay on rails.

**`/profile` — your profile.** Purpose: this wardrobe's public-on-device
face and its roofs. Primary action: none decorative — the working action is
**manage roofs** ("Under this roof", `src/pages/Profile.tsx:155-157`).
Controls: looks grid (C4 — the account's shares above the fold), household
cards with Join for unanswered invitations, honors plate when the feature is
on (`docs/36`). Changed this sprint: C4 looks grid. Target: household cards
gain the club affordance — a named roof links to `/clubs/:id`; the honors
plate lands below the wardrobe summary (Phase J, off by default).

**`/profile/:id` — a profile.** Purpose: another wardrobe's shown face.
Primary action: none — it is a reading room; the sample marker stands in the
account line (owner decision 3). Target: sample profiles show their honors
plate (the feature's only discoverability surface beyond Settings,
`docs/36`); everything else unchanged.

**`/rail`, `/rail/:id` — the shared rail / a neighbour's rail.** Purpose:
borrowing between people who already know each other, stated as local preview
(`src/pages/Rail.tsx:11-16`). Primary action: **record a loan / advance a
request** (request slips on the card). Target: unchanged. The name keeps its
meaning — lending — which is exactly why the feed could not have it (§2.1).

**`/clubs/:id` — a club (new).** Purpose: one roof — its rail, its tray, its
members. Primary action: **Share a look to this roof** (routes to Outfits →
share sheet, roof preselected). Controls per §3.2: hairline tabs (The rail /
The tray / The roof); invite on The roof; take-it-in on The tray (family
kind). Route registration: `ROUTES` gains `{ path: '/clubs/:id', name: 'a
club' }`; `known()` needs no change — the stem rule
(`src/lib/routes.ts:37-43`) covers it once the row exists.

**`/intake` — photo intake.** Purpose: catalogue from photographs, consent
first. Primary action: **send photos to the relay** (the disclosure pack
names the provider at send time — G7, wave 3). Target: unchanged by this
design.

**`/settings` — settings.** Purpose: one wardrobe's internals plus the
device's. Primary action: page has none — it is a panel of toggles, each
section's control on its own row. Changed this sprint: who-pays shipped in
About (owner decision 4); sign-in surface deferred until ≥3 pieces (E4).
Target: the Honors toggle lands beside Theme — device-level, off by default,
exact copy per `docs/36`: *"Honors — quiet marks on your own profile as the
record grows. Off by default; never shown to anyone; never goals."*

**`/open`, `/open/new` — wardrobes / a new wardrobe.** Purpose: the chooser
and the start. Primary action: **Open** (list) / **Start** (form). Changed
this sprint: E1 first-run walkthrough (four beats, dismissible forever,
replayable from Settings) is wave 2 — in-flight. Target: unchanged by this
design; samples install with their clubs seeded — Vikram's three roofs
(`docs/19`) gain names and present as the first clubs.

---

## 5. The growth/psych layer, honestly

What is adopted, with the mechanism named; then the banned list restated,
because a design document is where banned things try to come back.

### Adopted

- **Endowed progress on closet-filling.** Already house law (`docs/05` §8.4).
  The look book extends it: your own cards in the grid are the visible record
  of a closet that knows itself, and honors (`docs/36` #1, #2) mark the
  filling without a progress bar anywhere.
- **Variable freshness.** The living feed changes daily
  (`src/lib/feedEngine.ts`); the rotating insight after a log varies honestly
  (`docs/05` §8.3). The reward is real content and real arithmetic, never a
  manufactured near-miss.
- **Social proof inside clubs.** Real membership, accepted, named — the SDT
  relatedness leg (`docs/35`, behavioral researcher) — replacing the faked
  warmth the panel caught. Samples show what a lived-in room looks like and
  carry their tag; the fiction is legible, the real thing is joinable.
- **Completionism via honors.** Twelve honors, positive-only, private,
  off-by-default, unloseable, never goals (`docs/36`). Sample wardrobes show
  theirs — the one sanctioned visibility surface.
- **The shareable outfit card as the only outward channel.** The 1080×1920
  client-side export (docs/33, Phase J; on `PLAN.md`'s Phase 3 list) is the
  entirety of outward distribution: a printed artifact, opt-in per use, no
  graph attached. Growth flows through an image a person chooses to post
  elsewhere, or it does not flow.
- **The two-tap loop as the re-engagement plan, measured not assumed.** No
  notifications (veto reaffirmed, `docs/35`); the diary gates in the alpha
  kit arbitrate whether the loop and the ledger payoff suffice
  (`docs/33` G2). If they fail, that is a product finding, not a permission
  slip for push.

### Banned, restated

Public counts of any social kind (likes, followers, others' saves, "seen
by", member-count chrome). Streaks. FOMO timers and expiring content.
Infinite-pull mechanics and dopamine copy. Unread badges and count bubbles.
Discovery feeds and suggested-anything. Public profiles of non-members.
Ranking of people or posts. Comments under shares. Push notifications. Guilt
framing of resting pieces. Any engagement metric shown to its own subject.
Commerce surfaces of every kind (`docs/12`, hard rule 2). Each of these is
banned not because it doesn't work — most of them work — but because what
they work on is the person, and the house works for them.

---

## 6. Build order + acceptance

Web first; the app follows per `docs/34` (Phase 3's design pass absorbs this
document; bottom tabs mirror §4.1). Each phase's checks follow the existing
suite style — Node scripts with fixture states and non-zero exits, wired
into `verify`; Playwright flows at 390px; `lint:brand` over every string.

### Phase F1 — the masonry look book (web; ships for alpha)

1. Feed container: retire the 460px rail; CSS-columns masonry, 2/3/4 by the
   §2.2 table; `break-inside-avoid`; lazy images and `content-visibility`
   per §1.
2. Deterministic plate ratios (§2.2) — pure function of post id, same hash
   family as `feedEngine`.
3. The hero (§2.4) and the quiet filter rail (§2.5), with the chip-presence
   laws kept.
4. The rename: `ROUTES` name, nav labels, masthead; address untouched.
5. The "What you are showing" plate moves per §2.8.

**Acceptance:**

- `scripts/test-feed.mjs` (B5's suite) gains cases: ratio assignment is
  deterministic and within {1:1, 3:4, 4:5}; the hero is the newest post of
  the active filter; "Scoped to you" selects exactly `scope.kind ≠
  'everyone'` ∩ `postVisibleTo`; renaming the label touches no route path
  (`known('/feed')` stays true). `npm run test:feed` green.
- `npm run test:flows` + `npm run test:features` green at 390px; masonry
  renders two columns at 390px and three at 768px in `test:shots`.
- No `ResizeObserver`, no measured-position code in the feed path (asserted
  by a grep-guard test in the B5 style).
- `npm run lint:brand` green over all new copy; no exclamation point spent.

### Phase F2 — clubs (web; ships for alpha)

1. `circle` kind + `HOUSEHOLD_KIND_LABELS`; named households present as
   clubs; Profile's roof cards link through.
2. `/clubs/:id`: the three tabs of §3.2; club rail reuses the F1 masonry at
   two columns; tray is a view over `community.passes` (family kind only).
3. Invite / accept / leave on the existing `joined?` model.
4. Samples seed Vikram's three roofs with names.

**Acceptance:**

- New `scripts/test-clubs.mjs` in the house style: unjoined invitee sees
  nothing (postVisibleTo held against club posts); leaving is unilateral and
  immediate; a leaver's past posts remain; tray accept writes
  `source: 'inherited'`, wear count 0, provenance attached (the existing
  Closet accept path); non-family kinds expose no tray. Wired into `verify`.
- `test:flows` at 390px covers: open a club from Profile, share a look to it,
  take in a family offer.
- Veto-list audit against `docs/19`: one grep-level pass demonstrating no
  live reads, no silent insertions, no counts in club markup.

### Phase F3 — the honest chrome (web; ships for alpha, mostly landed)

The fold of Today's stat row and bars into the Ledger (§4.2), the ledger
pack (G5), and the disclosure pack (G7) — already phased in docs/33; this
document ratifies their interaction with the feed (no feed chrome on Today;
the Ledger hosts the numbers and the honors line).

**Acceptance:** existing suites green at 390px; Today's folded line links to
`/ledger`; `test:features` covers the fold.

### Phase F4 — after alpha (post-alpha, per docs/33 Phase J and docs/34)

Honors plate on Profile + Settings toggle (`docs/36`; owner decision 1
confirmed; off by default); the 1080×1920 outfit-card export; named
collections from set-asides; then the app port absorbs F1–F3 in `docs/34`'s
Phase 3 design pass — 2-column grid on phones, sidebar mirroring §4.1 on
tablets, no web-only assumption carried silently.

**Acceptance:** `scripts/test-honors.mjs` per `docs/36`'s nine-case plan;
export renders verified by the Playwright raster path docs/33 D6
established; app-side suites per `docs/34` §6.

### What ships for alpha vs after

- **Alpha:** F1 (the look book), F2 (clubs), F3 (the honest chrome), with the
  sample-wardrobe tag and who-pays copy already shipped. The tab slot itself
  stays under the G2 diary gates' arbitration, exactly as owner decision 3
  left it.
- **After:** F4 — honors surfaces, the outfit card, named collections, the
  app port. Cross-device clubs wait on E2E sync (`docs/34` H3); nothing in
  this document asks for them sooner.

---

*Recorded by the FEED-DESIGN squad, 2026-08-19. The masonry rhythm law, the
ordering amendment (column-wise `newestFirst`), and the name change are
design-contract amendments in the sense of `docs/05`'s closing line — they
stand because this document records the judges' reasons, and they yield to
any future judge pass that does the same.*
