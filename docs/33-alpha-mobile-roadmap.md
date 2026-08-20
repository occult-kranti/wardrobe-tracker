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

---

## The native era (opened 2026-08-19)

Phases A–H above are the **web** sprint and are complete; the web PWA is
feature-complete for alpha and every standing gate is green. What follows is the
native build, run as waves under `docs/34` (the plan of record) with the wave law
from `CLAUDE.md`: disjoint file ownership declared before each wave, one squad
owning the build at a time, verification between waves and never during.

### Owner decisions taken 2026-08-19

These bind the phases below, and two of them **override `docs/34`**:

| # | Decision | Effect |
|---|---|---|
| 1 | **Sync stays inside Phase 1** — `docs/34`'s exit line kept as written | Overrides the tech-lead and QA loops, which both recommended narrowing to "sign-in + a real closet" and deferring sync to a Phase 1.5. The sync-clock fixes become critical path. |
| 2 | **Photo encoding: native inlines on export** | Native keeps files on disk, converts to base64 at export, so the document round-trips with web both ways. `photoEncoding` on `AppState`, default `'inline'`. |
| 3 | **`app/` stays isolated — no npm workspaces** | Metro's `nodeModulesPaths` lists `app/node_modules` first, root as fallback. Preserves "root stays web-only" and keeps the SDK 57 pins authoritative. |
| 4 | **Squads may apply `supabase/setup.sql`** to the live project | Applied and verified 2026-08-19. |
| 5 | **The relay's model is Claude Fable 5** | Opus 5 was the fallback if Fable were unavailable; it is available. Measured, not assumed — see below. |

### Wave 1 — web truth (done, all gates green)

Nothing moved and nothing native was touched. The wave made the contracts that
Phase 1 depends on *testable* while the tree was still simple, and fixed three
confirmed defects before a second client could inherit them.

- **EXPORT-TRUTH** — export/import logic extracted to a pure `src/lib/exportDoc.ts`
  (bound for `packages/shared`). The denylist became an allowlist plus a
  *structural* gate refusing any value that could not have come from `JSON.parse`.
  This closed a live defect: every backup ever written carried a spurious
  `"packedItemIds": {}`, because a `ReadonlySet` is not a function and slipped
  the old filter.
- **SYNC-CLOCK** — `remoteIsNewer` compares instants, not glyphs; `flushQueue`
  now stamps the meta it never stamped; both upserts read `updated_at` back from
  the database so client and server cannot disagree; the trigger became
  `before insert or update`, closing a fast-client-clock gap. The state column
  gained the `{v, alg, payload}` envelope, `alg: 'none'` for alpha, so turning
  on E2E later is a new `alg` value rather than a migration of live rows.
  **Severity correction, on the record:** a 202,500-pair sweep showed the old
  string compare never once *missed* news — every disagreement was a same-instant
  echo. It was latent robustness, not data loss.
- **SCHEMA-PHOTO** — `photoEncoding` on `AppState`, `SCHEMA_VERSION` 7 → 8,
  migration case written and run red *before* the type changed, per the
  lossless-export law in `CLAUDE.md`.
- **LINT-GUARD** — `check-brand.mjs` gained explicit walk roots, a
  dead-allowlist-entry failure, and a minimum-scanned-file floor, so the Wave 2
  lift cannot silently shrink brand coverage inside a green `verify`.
- **TIME-TRUTH** — `test-dates.mjs` (five-zone matrix incl. Lord Howe's 30-minute
  DST, plus a `scripts/fixtures/date-truth.json` for Wave 3 to replay on Hermes),
  `test-routes.mjs`, and `check-native-storage.mjs`. `dates.ts` and `cost.ts`
  came back clean in all five zones.

**Found and fixed between waves:** `safeNext` matched the raw path, so
`/profile/../open` was admitted and then resolved to the door it promises never
to return. No origin escape (HashRouter does not normalise), but Phase 1 was
going to port that guard verbatim to native, where a deep link arrives from any
installed app. Dot segments are now refused outright.

### Wave 2a — model, decisions, plan (done)

- **MODEL** — the relay's default is `claude-fable-5`. Measured through the real
  relay, app prompts, real photographs: Sonnet 4.5 found 12 pieces at ~9.8 s;
  Fable 5 and Opus 5 both found 14 at ~19.8 s and ~14.3 s. Sonnet 4.5 missed a
  camouflage tee worn under a hoodie that both 5-series models caught.
  `MAX_TOKENS` 8000 → 16000, because Fable always thinks and thinking spends from
  the same budget as the answer. Disclosure copy updated in all six places and
  the `namesModel` check with it — a stale model name is a lie to the user.
  `scripts/model-bakeoff.mjs` re-runs the comparison the next time the lineup moves.
- **FIXES** — `expo.android.allowBackup: false` (Android auto-backup was copying
  the app data directory to Google by default, which makes "local-first, your
  closet is yours" untrue); five UTC day labels replaced with `todayLocal()`;
  the dead `similarity.ts` brand-lint exemption removed.
- **PLAN** — `docs/39-explore-and-calendar.md`.

### Wave 2b — voice and teaching (done)

Advisor, marketing-lead and first-time-customer runs over the app, feeding a copy
pass that removes AI-sounding lines, and a per-page guide surface built from
`Layout` so no page file is touched.

### Wave B — the owner's second slate (done, 2026-08-19)

Nine squads in one workflow: five planners in parallel with four builders, then
a synthesis, then the feed build.

- **RUPEE** — currency and numerals are INR with Indian grouping, app-wide and
  display-only: `formatMoney`/`formatPrice`/`formatPerWear` emit ₹ with en-IN
  grouping (₹12,34,567, not ₹1,234,567), every `en-US` locale call became
  `en-IN`. Recorded prices stay bare numbers — no `AppState` change, no
  migration. The 246-case date-truth fixture was re-pinned to the new truth;
  the doc inside it demands exactly this sentence in the commit.
- **PORTAL** — `#/admin` is now the alpha monitoring dashboard: a Services
  board with live relay probes (Fable 5, Opus 5, Gemini 3.7 Flash, Kimi K3)
  and an Alpha board reading a new `admin-stats` edge function (counts and
  byte-sizes only, never a wardrobe's contents) behind an `x-admin-token`
  header.
- **RELAY** — `ai-proxy` routes three providers now: `claude*` → Anthropic,
  `gemini*` → Google's OpenAI-compatible door with `GEMINI_KEY`, anything else
  → Kimi. The owner's Gemini key was probed live: both endpoints answered;
  the newest model on it is `gemini-3.7-flash`. `scripts/test-relay.mjs`
  probes the deployed relay under `--live`. **Deploys and the secret-set are
  owner actions** — the environment refuses them from here, rightly.
- **THE GATE** — `ConfirmDialog` stands before every destructive act in
  `ItemDetail`, `Furniture` and `Settings`; the portal keeps its own
  typed-phrase gate. Found between waves: two dialog bodies claimed "there is
  no undo" one line above the Undo toast they precede — the copy now tells
  the truth per site.
- **FEED** — the home feed beautified (stories rail of monogram eyelets, a
  view-only `/story/:accountId` viewer with progress hairlines), a new
  `/explore` with search and quiet chips, and 45 CC0 commons assets (2.0MB,
  credits filed) so the alpha feed is alive with zero backend and zero runtime
  network. Four verbs, no counts, samples say they are samples.
- **PLAN** — `docs/40-social-feed-plan.md` (the social plan of record):
  Instagram-familiar surfaces built from the four verbs, S1–S3 phasing,
  Supabase tables/RLS/storage written out, and an owner-decisions section
  that names every contract amendment it needs. Two squad overrides await the
  owner's countersign there: commons stories on the home rail, and the 2.0MB
  buffer weight against the plan's 1.5MB cap.
- **EXPO GO, SOLVED** — the Play Store build of Expo Go lags the SDK (Expo is
  "still waiting on approval" for 57), so a fully-updated phone still refuses
  an SDK 57 project. The fix is on the device: install Expo Go for SDK 57
  from `expo.dev/go`, or press `a` in `npx expo start` with the phone on USB.
  The alpha kit must link `expo.dev/go`, never the Play Store.

### Waves 3, 4a, 4b — done (2026-08-19 → 20)

- **Wave 3, the lift** — `packages/shared` holds exactly six (`types`, `dates`,
  `cost`, `similarity`, `migrate`, `intake`), lossless-proved; one alias table
  feeds vite, tsconfig and all 18 esbuild calls; the parity check with a
  standing red-proof rides inside `verify`; the metro doorway is wired.
  Independently reviewed and approved.
- **Wave 4a, the wardrobe opens** — native door (empty / sample starts),
  Closet with detail sheet and add-piece, Today with two-tap logging,
  migrate-on-read proven against v7 and bare-blob fixtures. 57 app tests.
- **Wave 4b, four squads** — the account door (skip stays first, sign in /
  create second; sessions in the keychain via expo-secure-store); per-wardrobe
  opt-in sync, byte-for-byte the web's envelope semantics; Conversations (a
  fifth tab, persona threads seeded to the web's own keys, membership lock,
  Ask/Attach arrivals contract); the Look Book alive (11 seeded posts, stories
  rail + viewer with the commons island, 12 CC0 stills at 153KB, verbs
  navigating to chats); and the Hermes stress net — **the 246-case date-truth
  fixture replays green on the jest-expo pipeline**, plus corruption, quota,
  midnight and garbage-migration parades. App suite: 455 tests, 0 failures.
- **The Showing** — docs/41's dealt-band mosaic built on web Explore (pure
  band arithmetic in `src/lib/showing.ts`, ~25 new pins, one spec erratum
  recorded on §2.5's guest-window bound). Browser stress suite in flight.
- **Found by the waves, fixed by the lead**: the web's own Chats page never
  consumed the navigation state the feed's Attach/Ask verbs send — the verbs
  silently dropped. The arrival contract the native squad defined now has its
  web half. The portal's passcode gate was retired by owner order; the naming
  sheets are the locks.

### The redirection (owner, 2026-08-20)

The alpha's goal narrows to **a functional wardrobe closet app** — sharing
with friends and conversations stay; the Instagram-style feed and Explore are
**hidden behind a flag**, not deleted. They live on in full on a showcase
branch, deployed beside the app. The shell becomes a five-slot bottom bar in
Instagram's grammar — home · wardrobe · (feed, flagged off) · conversations ·
profile — with swipe-between-screens; `docs/42-navigation-shell.md` is the
panel-made spec. Coding squads run on Opus by owner allocation.

### Goals and subgoals, restated

1. **Alpha ships a closet, not a network.** Two-tap logging, intake, cost per
   wear in rupees, furniture, sharing with friends, conversations. Feed and
   Explore wait behind `FEED_FLAG` for their own release.
2. **One shell, two apps.** The five-slot bar and swipe grammar per docs/42;
   a native profile screen; web nav follows the same flag.
3. **Trust holds.** Local-first, opt-in sync with the plain sentence, E2E the
   committed target, the portal monitoring users/services/relay.
4. **Every wave verifies before it lands** — verify + browser suites + the
   455-test app corpus + the stress nets; commit and merge on green, showcase
   branch cut before the flag flips.

### What is next

| Wave | Owns | Goal |
|---|---|---|
| 5 — **done 2026-08-20** | shell + flag, both apps | docs/42 built and LIVE: `FEED_ENABLED` in `packages/shared/flags.ts` hides the Look Book, Explore and stories on main (web nav/routes/`known()`, native `Protected` + hook-free redirect gates); the four-room bar TODAY · CLOSET · CHATS · HOUSE swipes on TopTabs with the eyelet bead; the House stands at `/profile`; Settings pushed; rail labels back at the 13px floor; the almirah glyph in both icon sets. Branch `feed-showcase` keeps the full social build and deploys at `/showcase/`. Merged to main at `45026a8`; Pages deploy green. |
| 6 | `app/**` | Closet depth: photos + intake on native, furniture, export/import round-trip against web, outfits. Plus docs/42's Wave 3 artist polish (crossfade taps, room-change motif) and the nine-point device QA list. |
| 7 | both | The design pass (Phase 3 visual diff, art moments per design-android), alpha kit, QR distribution. |

`docs/39` phases N1–N8 and `docs/40` S1–S3 interleave when the feed's own
release comes; N2 onward still needs the `PLAN.md` amendment named there.
