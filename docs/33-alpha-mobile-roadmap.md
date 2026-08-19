# 33 — The Alpha Mobile Sprint

> **Status:** active · **Owner:** project lead · **Opened:** 2026-08-18
> **Mission:** take Almari from a desktop-strong PWA to a mobile-first build a
> circle of 15–20 alpha testers can live in — feed alive, sync correct,
> onboarding honest — then lock the native-app and backend plan.

This supersedes the open items in `docs/26-next-steps.md` where they overlap.
The seven non-negotiables (`PLAN.md`) and the component law
(`.claude/skills/wardrobe-brand/SKILL.md`) bind every phase below.

---

## Baseline (verified 2026-08-18)

- Node 24.18 / npm 11.16 · Playwright 1.62 + Chromium · Python 3.12 + Pillow
  (photo pipeline; invoked as `python`, not `python3`, on this machine).
- Green: `build`, `lint:brand`, `test:migrate`, `test:demo`, `test:intake`,
  `test:cast`.
- Dev loop: `npm run dev` → :5173. Browser suites need
  `npx vite preview --port 4174` (flows/features) or :4173 (smoke/shots/contrast).

## Audits that feed this sprint

**Feed/sync (from code audit):**
1. Feed appears frozen — personas never post after install; wears/outfits never
   surface; only manual shares appear (top alpha complaint, by design in
   docs/12 — now deliberately changed, see C1).
2. Same-day posts/messages order randomly — UUID tiebreak on day-granular dates.
3. Cross-tab lost updates on `toile-community` — whole-blob last-write-wins.
4. Deleted seed posts resurrect on reseed (no tombstones).
5. Borrow requests in Chats never reach the Rail loans ledger — two half-wired
   systems.
6. `setCommunity` writes localStorage inside a React state updater.

**Mobile (from 390px audit):** iOS input zoom (text inputs below 16px), More
sheet has no backdrop dismissal, missing `overscroll-behavior`, modals have no
mobile sheet form factor or keyboard strategy, Calendar is a deep-scroll stack,
manifest is SVG-only so iOS home-screen gets a screenshot not the mark.

## Decision points (product calls, reopenable)

- **D1 — Feed mechanics.** Instagram-*patterned* (image-first cards, vertical
  rhythm, profile grid, share sheet) inside Toile component law. **No public
  metrics**: no like counts, followers, ranking, unread badges. The only
  engagement mechanic is a private, on-device *save*. This keeps the docs/12
  panel veto while making the feed worth opening.
- **D2 — Mobile visual language.** The shipped component law (radius 2,
  letterpress hairlines, 13px label floor) governs. The atelier pack's chamfered
  plates stay in the gallery until a judge pass ratifies a contract amendment.
- **D3 — Native + backend.** Capacitor remains plan of record for the first
  store build (docs/32). A full Flutter/React-Native track and an optional,
  end-to-end-encrypted sync backend are planned in detail in
  `docs/34-app-development-plan.md` per the owner's direction; the backend is
  off by default and requires the panel conversation docs/11 demands.

---

## Phase B — Feed & sync correctness

**Goal:** the shared store stops losing writes and the feed orders honestly.

- B1 Sub-day timestamps (`at`, ISO datetime) on posts + messages; `newestFirst`
  orders by it; seeded day-granular rows stay valid. Same-day scramble gone.
- B2 `setCommunity` side effect out of the state updater; storage-event handler
  merges per-entity by id (newer wins per entity) instead of wholesale replace.
- B3 Tombstones (`removedPostIds`) so taken-down seed posts stay down.
- B4 Accepting a borrow request in Chats creates the real loan in the Rail
  ledger — one system, not two half-wired ones.
- B5 `scripts/test-feed.mjs`: ordering, seed idempotency, tombstones, merge,
  scope rules. Wired into `verify`. Each test proven against the old behavior.

**Done when:** two tabs can post/message/accept without losing each other;
same-day threads read in order; `npm run test:feed` green.

## Phase C — The living feed

**Goal:** the feed earns its name — it moves every day — while staying calm.

- C1 Persona activity engine: a pure, deterministic `personaSchedule(persona,
  today)` deriving dated look-posts from each persona's own outfits, events and
  seasons (seeded PRNG), merged idempotently at boot by deterministic id,
  generic over **all** personas present and future, capped (~60), tombstone-
  aware, never touching user posts.
- C2 Feed layout: one look per card, image-first 4:5 in a hairline plate,
  author/date line, caption, scope chip; private save (bookmark, no counts);
  honest empty states.
- C3 Share flow from Outfits: caption + scope + `at` timestamp; snapshot
  semantics unchanged.
- C4 Profile: the account's looks as a grid above the fold.

**Done when:** installing samples and waiting a day changes the feed; a shared
look appears instantly for every scope that should see it; no metric anywhere.

## Phase D — Mobile-first pass

- D1 16px floor on every text input (kills iOS auto-zoom) — systematic sweep.
- D2 More sheet: backdrop + outside-tap + Esc dismissal.
- D3 `overscroll-behavior` at root; pane containment kept.
- D4 Modals as bottom sheets on `<lg` with visualViewport keyboard safety
  (`interactive-widget=resizes-content`).
- D5 Calendar navigable on a phone without deep scroll.
- D6 Real PNG icons (192/512/apple-touch-180) via a Playwright raster script;
  manifest shortcuts to real routes.
- D7 Verified at 390px through `test:flows` + `test:features`.

**Done when:** an iPhone and a mid-tier Android both get: no zoom jank, sheets
that dismiss like sheets, a home-screen icon that is the mark, and green suites.

## Phase E — Tutorials & first-run

- E1 First-run walkthrough after *Start a wardrobe*: four beats max — add a
  piece (photo optional), the two-tap log, Before You Buy, the export reminder.
  Dismissible forever, never blocking, replayable from Settings.
- E2 Empty-state coaching audit — every empty room teaches one thing, copy law
  held (address the clothes; the one exclamation point stays unspent).
- E3 Stale copy fix: "three sample wardrobes" → eight (eleven after Phase F).

**Done when:** a brand-new tester reaches the first logged wear without asking
anyone anything.

## Phase F — Three new wardrobes

- F1 *The capsule curator* — a 12-piece capsule, synthetic, briefed not named;
  shows the app at small scale.
- F2 *The maximalist archivist* — 60+ pieces, heavy brand/source metadata;
  the stress test.
- F3 *The photographed closet* — real photographs through the existing
  `fetch-garment-photos` → `build-garment-photos` pipeline (CC0/CC-BY/PD only,
  licence manifest, compressed webp), persona authored to match fetched slugs.
- F4 Each: full authored week, exactly 3 event plans, arcs (sources, favourites,
  retired, wishlist), feed presence via the C1 engine.
- F5 Tests: `test-cast` count 5→8, `PERIOD` set if needed, `NAMED` regex
  extended, `PERSONA_SEED_VERSION` bumped, `test-demo` photo floors held.

**Done when:** `test:cast` + `test:demo` green with eleven wardrobes; the three
new closets open without an empty room.

## Phase G — Alpha readiness (15–20 testers)

- G1 QA sweep: all suites plus new edge cases — empty closet, 500-piece closet,
  midnight-crossing wear log, DST week, corrupted localStorage, storage quota,
  two-tab torture.
- G2 Alpha kit: PWA install instructions, manual feedback form, diary-study
  template, consent text. Measurement stays manual (no telemetry), gated on
  docs/28 §4.4: ≤2-tap logging, ≥60% week-1 diary completion, ≥40% week-12
  logging.
- G3 Device matrix: iOS Safari 390px, Android Chrome 360/412px, desktop
  Chrome/Firefox/Safari.
- G4 Performance: route-level code-splitting (kill the >500kB chunk warning),
  image lazy-load audit.

**Done when:** the kit can be handed to 15–20 people with no engineer present.

## Phase H — Native + backend plan

Written up in `docs/34-app-development-plan.md`:

- H1 Track 1 — Capacitor (plan of record, docs/32): storage adapter, store
  gates, timeline.
- H2 Track 2 — Flutter/React-Native rebuild planned in full: module map,
  design-token port, SVG icon strategy, state/storage, the maths (cost-per-wear,
  utilization, re-wear rate, similarity), repo organisation, test strategy, and
  a recommendation between the two with criteria.
- H3 Backend — optional E2E-encrypted sync: per-device keys, opaque blobs,
  threat model, cost table, the panel-approval gate; what never goes server-side.
- H4 Tooling: `requirements.txt`, Playwright, Node, CI matrix.

---

## Wave plan (execution)

| Wave | Squads (parallel, disjoint file ownership) | Output |
|---|---|---|
| 1 | **FEED** (B+C) · **MOBILE** (D) | living feed, correct sync, mobile chrome |
| 2 | **PERSONAS** (F) · **ONBOARD** (E) | eleven wardrobes, tutorials |
| 3 | **QA** (G1–G4) · **RESEARCH** (G2 kit) · **PLAN** (H / docs/34) | alpha-ready build + kit + plan |

**Sprint acceptance:** every pre-existing suite green + new feed/mobile/persona
tests green; `test:flows` + `test:features` pass at 390px; alpha kit ready;
docs/34 written. Design-critic reviews screenshots before the kit ships.

## Risks

- Two coders in one tree → waves keep file ownership disjoint; builds run
  between waves, not during.
- Sample-reseed rebuilds persona closets in place — alpha notes must say so.
- `company/tracker.js` (internal board, not the app) carries a live Supabase
  anon key per `test-workroom.mjs` comments — verify and rotate before anyone
  outside the team clones the repo.

---

## Panel outcomes (2026-08-18)

Three-reviewer alpha panel; full record in `docs/35-alpha-panel.md`, honors
spec in `docs/36-badges-rewards.md`. Accepted asks, folded into the phases
(new items take the next free number in their phase):

| Ask | Lands in | Wave |
|---|---|---|
| Ledger pack — per-category CPW, marginal monthly CPW (unhidden), utilization trend, CSV export | Phase G (new G5) | 3 |
| Closet filter-chip clip at 360–390px | Phase D (new D8), verify at 390px | done-pass |
| TOILE→Almari internals sweep (wordmarks, titles; storage keys unchanged) | Phase G (new G6) | 3 |
| Disclosure pack — relay names upstream model/provider at send time; sync copy says who can read the blob; who-pays line | Phase G (new G7); README/PLAN staleness resolved in flight by the QA squad | 3 |
| Sign-in surface deferred until ≥3 pieces catalogued | Phase E (new E4) | 3 |
| Outfit-card export, 1080×1920, client-side | new Phase J (post-alpha); builds on the Phase 3 recap-card line in `PLAN.md` | — |
| Named collections from saved posts | new Phase J (post-alpha) | — |
| E2E-encrypted sync blob | `docs/34` H3 — promoted from optional to committed target pending owner decision 2; sync stays opt-in and off by default until it lands | — |
| Feed framing — label personas as sample wardrobes (ships regardless); keep-vs-demote the tab is owner decision 3, arbitrated by the G2 diary gates | label: Phase C (new C5); tab: pending | 3 / — |
| Honors per `docs/36` | gated on owner decision 1 (amend non-negotiable #4 in the open); if approved, Phase J, off by default | — |
| Notifications | veto reaffirmed — no push; re-engagement rests on the two-tap loop and ledger payoff, measured by the G2 diary gates (≤2-tap logging, week-1/week-12 completion) | — |
