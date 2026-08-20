# BUILD-HANDOFF — the phased native build, with advisors

Paste this whole file into a fresh Claude Code session opened on this repo.
It is written as your brief and your operating model. `CLAUDE.md` loads with
the session anyway — read it first; this file supersedes it wherever the two
disagree about the app build.

You are the **project lead**. You do not write most of the code yourself: you
plan, you hire subagents (coders, researchers, artists, QA), you run advisor
loops, you verify, and you report. The owner reviews; you commit nothing
without the owner's explicit go-ahead, each time.

---

## (1) Mission

Build the Almari native app (Expo + React Native, iOS and Android, one
codebase) in phases, per `docs/34-app-development-plan.md`, reaching a
15–50 person alpha distributed by QR code — **no App Store, no Play Store**.
The web PWA at the repo root is feature-complete and is the reference
implementation: port its behavior, do not reinvent it. Everything you build is
tested as it lands — every feature, and the edge cases too, not after.

## (2) Current state — what already exists (do NOT rebuild)

As of commit `9f85c78` (main), the web app ships, all gates green:

- **Living feed**: deterministic persona engine (`src/lib/feedEngine.ts`),
  image-first cards, private on-device saves, personas labelled "sample
  wardrobe". **Feed sync is fixed**: sub-day timestamps, cross-tab per-entity
  merge, tombstones, borrow→loan wiring; `scripts/test-feed.mjs` (72 checks)
  and `scripts/test-sync.mjs` stand watch.
- **Sign-in, simple and working**: Supabase email auth; the Door leads with
  the account (sign in / join / a prominent honest skip), wardrobes second.
  Sync is opt-in per wardrobe, LWW by `updated_at`; the device stays the
  default home of every wardrobe.
- **Exactly four sample wardrobes, all public-facing**: **Hruday Mehta**
  (`cofounder`, `@hruday_mehta` — the owner's real closet: 22 crops cut by
  intake from his own photos, 13 outfits, wired through `PHOTO_OVERRIDES`),
  **Meher**, **Vikram**, **Aarav** (generated, `personaData.ts`).
- **Closet image integrity is enforced**: every cofounder tile is a real crop
  (asserted 22/22); persona photo floors and "photographs resolve to files"
  are asserted in `test:demo`; broken references are findable through the
  portal's orphan check.
- **The project lead portal** at `/admin` (passcode `almari-lead`): device
  dashboard, profile deletion with a naming sheet, delete-all behind a typed
  phrase, closet content tools, smoke checks + orphan cleaning, action log.
  Every destructive step passes a warning — that is portal law.
- **AI intake, on Claude**: photo intake, feed-screenshot import, multi-photo
  gallery import with auto-crop — all through the `ai-proxy` relay, which now
  routes by model name (`claude*` → Anthropic, else Kimi). Default model
  `claude-fable-5` since 2026-08-19 (measured: 14 pieces vs Sonnet 4.5's 12 on
  the same set, ~19.8s vs ~9.8s median — see `scripts/model-bakeoff.mjs`).
  Disclosures in the app name the model and its house; a features check
  asserts it.
- **Mobile-first pass, tutorial, icons, room art** — done and covered by
  `test:flows` / `test:features` (phone + desktop).
- Docs of record: **docs/33** (web/alpha backlog), **docs/34** (app plan),
  **docs/35** (binding owner decisions), **docs/36** (badges spec — approved,
  not built), **docs/37** (alpha kit — 7 owner fills outstanding),
  **docs/38** (main-feed design). `company/ship.html` is the public status
  page — update it in the same wave as anything it describes.

### The five retired personas — policy

Fergus, Amparo, Bok-soon, Ngozi and Nico were removed from the public app at
the owner's call. They are **not deleted property**: their full briefs live in
git history (`src/lib/personaCast.ts` at commit `99e40f4`, plus
`personaWardrobe.ts` `EVENT_PLANS` at the same ref). They are reserved for
**feed content and internal testing in the future**. Do not resurrect them
into the public sample roster without an explicit owner decision; when that
day comes, restore from that commit and bump `PERSONA_SEED_VERSION`.

## (3) Phase 0 — environment and workspace (do this first, yourself)

Set up the minimal, honest workspace before any squad starts:

1. **Secrets**: `secrets.md` sits at the repo root (gitignored — it must
   never be committed; verify `.gitignore` still covers it, `test_images/`,
   and `supabase/.temp/`). It holds the Supabase keys and the model keys.
   Read from it when wiring services; copy no value into any tracked file.
2. **Supabase**: `supabase link --project-ref wvupsqfevlrmhqfjreyx`;
   `supabase secrets list` should show `ANTHROPIC_KEY` and `KIMI_KEY` (set
   from `secrets.md` if missing). Database already has `profiles` +
   `wardrobes` with owner-only RLS (`supabase/setup.sql`, idempotent — run it
   if the tables are missing). Deploy the relay after any edit:
   `supabase functions deploy ai-proxy`.
3. **Python**: the intake pipelines crop with Pillow. Create `.venv`
   (gitignored), `pip install -r requirements.txt`; the scripts call `python`
   — make the venv's python the one on PATH when running them.
4. **Playwright**: browsers must be installed for the flow/feature suites
   (`npx playwright install chromium`).
5. **Expo/EAS**: `cd app && npm install`; logged in as `occult-kranti`;
   project id `1b9ec18c-58dc-4052-a50d-219cb2376e64` is already wired into
   `app/app.json` (`updates.url` + `extra.eas.projectId`). `npx expo start`
   must show a QR before Phase 1 ends.
6. **Baseline**: `npm run verify` green, then `npx vite preview --port 4174`
   with `npm run test:flows` and `npm run test:features` green. Do not begin
   Phase 1 on a red baseline.

## (4) The AI model policy — check for the newest, then update everywhere

At the start of the build session, **web-search the current Anthropic model
lineup** (model ids change; do not trust memory). Then:

- DONE 2026-08-19: the default is now `claude-fable-5` (owner's call — Opus 5
  was the fallback had Fable been unavailable). Re-run `node
  scripts/model-bakeoff.mjs` the next time the lineup moves; switch only if
  quality holds and latency does not regress — measure, don't assume.
  NOTE: on the 5-series thinking is ON by default and spends from the same
  `max_tokens` as the answer, which is why `MAX_TOKENS` is 16000, not 8000.
  Fable rejects `thinking:{type:'disabled'}` outright with a 400. The relay already routes any `claude*` model; switching means
  changing `RELAY_MODEL` in `src/lib/anthropic.ts` and the `MODEL` constants
  in `scripts/test-feed-intake.mjs`, `scripts/test-gallery-intake.mjs`, and
  `scripts/build-cofounder-closet.mjs`.
- The disclosure copy ("Claude Fable by Anthropic, through Almari's relay")
  appears in `src/pages/Intake.tsx` (×3), `src/components/AddItemModal.tsx`,
  `src/pages/Furniture.tsx`, `company/ship.html`, and is asserted in
  `scripts/test-features.mjs` (`namesModel`). Update all of them together —
  a stale name is a failed check and a lie to the user.
- Kimi k3 remains the wired fallback; `ANTHROPIC_KEY` and `KIMI_KEY` both
  live in the Supabase secrets store. Keys never touch the repo, the client
  bundle, or `app/`.

## (5) The operating model — squads, advisors, waves

**Advisor discipline** (from CLAUDE.md, binding): consult the advisor before
substantive work and again before declaring done; make deliverables durable
first; surface conflicts, never silently switch approaches. Per phase, run
three standing loops:

- **Senior tech lead loop** — architecture, storage contracts, sync/edge
  semantics, performance. Reviews the phase plan before it starts and the
  diff before it ships.
- **Designer loop** — every screen against `docs/05-brand-identity.md` and
  the `.claude/skills/wardrobe-brand` skill; the artist subagent(s) own
  generated art (icons, empty states, room art) and must read the skill
  before drawing anything.
- **Edge-case/QA loop** — `.claude/agents/qa-sentinel.md` is the charter:
  empty states, huge closets, tiny screens, offline, interrupted writes,
  cross-tab races, timezone edges, orphaned images. Every phase ends with a
  sentinel pass, not just the last one.

**Wave law** (hard rule): subagent waves run with **disjoint file ownership
declared in each squad's prompt before it starts**. One squad owns the build
at a time; verification runs between waves, never during. Squads report; the
owner commits. Suggested squads per phase: SHARED-LIFT (`packages/shared` +
web alias rewiring), TOKENS/ICONS (`app/src/tokens`, art), SCREENS (one route
group per squad per the docs/34 §2.2 map), BACKEND (sync client + relay),
QA (jest mirrors + sentinel passes).

**Goals and subgoals**: write each phase as a goal with checkable subgoals
before starting it; a subgoal is only done when its check runs green.
Optimize as you go — dependencies, bundle size, render paths — but no
speculative generality, and nothing is concrete: settings and features may
change at the owner's word; prefer the best maintained open-source option
when a capability is genuinely missing, and say when you add one.

## (6) The phases (from docs/34 — the plan of record, obey its gates)

- **Phase 1 — basics**: Supabase auth (the same simple sign-in, wired to the
  same backend; the account screen comes first, as on the web), closet CRUD +
  photos, two-tap wear logging, AsyncStorage adapter matching the web's
  storage keys byte-for-byte, router skeleton, tokens/fonts/icons. Exit:
  sign-in + a real closet on a phone via Expo Go.
- **Phase 2 — all features**: every screen per the §2.2 map — feed, chats,
  rail, calendar, events, ledger, wishlist, compare, intake (relay-backed,
  same prompts), dressing room, settings, tutorial, export↔import
  round-trip against the web. Exit: feature parity, jest mirrors of the node
  suites running in `app/`.
- **Phase 3 — design pass**: designer loop over every screen; mobile-first
  per docs/33 and docs/38 (masonry feed direction); artist-produced assets
  replace placeholders (icon, splash — brand source is `public/icon.svg`).
- **Phase 4 — hardening + alpha**: sentinel edge-case sweep, performance,
  the pre-registered alpha gates in docs/34, docs/37 owner fills completed
  with the owner.

## (7) Alpha distribution without the stores

Per docs/34 and docs/37: **Expo Go for week one** (testers install Expo Go
and scan the project's QR — nothing to publish, works on iOS and Android,
free), **EAS Update as the standing channel** (`eas update` ships JS over
the air to the same QR link; the project id is wired). A development build
via `eas build` is the fallback if a native module outgrows Expo Go. Two
weeks, 15–50 testers, no store review anywhere in the path. The alpha kit
(docs/37) has the recruitment message, the feedback channel, and the
retention date — its 7 owner fills are outstanding; ask the owner for them.

## (8) The admin portal — extend, don't rebuild

The portal exists on the web (`src/pages/Admin.tsx`, `src/lib/admin.ts`,
route `/admin`, passcode gate, guarded deletes, smoke checks, action log —
with e2e coverage in `test:features`). For the alpha it grows into the
owner's monitoring dashboard, in this order:

1. **Alpha monitoring**: accounts created, sync health (parked pushes,
   last-synced stamps), storage pressure, smoke-check history — read-only
   first; the point is watching, not touching.
2. **Feed moderation**: list posts, tombstone a post (the feed engine already
   honors tombstones — moderation writes one, it never resurrects), restore
   with equal prominence.
3. **Account administration**: the existing guarded deletes are the pattern —
   keep them, extend with per-account state export before deletion.
4. **Native port** in Phase 2+: the same screens in `app/`, same laws.
   Portal law is unchanged: **a warning sheet before every major action, a
   typed phrase for the nuclear ones, an action log line for all of it, and
   remote data is never touched from the client** (server-side admin needs a
   service key, which lives nowhere near the app — that path is the Supabase
   dashboard until a backend admin function exists).

## (9) Verification — the standing gates

Web (must stay green through every wave):

```bash
npm run verify                              # build, brand, migrate, demo, intake, feed, sync, feed-intake, gallery-intake
npm run test:cast                           # the four-wardrobe roster
npx vite preview --port 4174 &              # browser suites need a served build
npm run test:flows && npm run test:features # routes, door, portal, relay honesty, installability
```

Live AI reads (keyless — the relay holds the keys):

```bash
node scripts/test-gallery-intake.mjs --live   # real photos in test_images/
node scripts/test-feed-intake.mjs --live "test_images/insta feed.png"
node scripts/build-cofounder-closet.mjs       # regenerates the owner's 22 crops (answers cached; --fresh forces live)
```

App (as it gains code): `cd app && npx tsc --noEmit`, jest + jest-expo
mirrors of the node corpus, then device passes on the owner’s phone via
Expo Go.

## (10) Links and facts you will need

- App (deployed PWA): https://occult-kranti.github.io/wardrobe-tracker/ —
  portal at `…/#/admin`
- Public status page: https://occult-kranti.github.io/wardrobe-tracker/company/ship.html
- Supabase: project `wvupsqfevlrmhqfjreyx`
  (dashboard https://supabase.com/dashboard/project/wvupsqfevlrmhqfjreyx);
  relay `https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy`
  (dual-provider: `claude*` → Anthropic, else Kimi; redeploy after edits)
- Expo/EAS: account `occult-kranti`, project id
  `1b9ec18c-58dc-4052-a50d-219cb2376e64` (wired in `app/app.json`)
- `workers/ai-proxy` (Cloudflare) is parked — do not revive without an
  owner call. `company/tracker.js` carries a legacy anon key — rotate when
  convenient; it is the last known key in a tracked file.

## (11) Reporting back

Each phase ends with: what shipped (files + checks), what the advisor and the
three loops said and what changed because of it, what is red or untested and
why, and the ask for the owner (decisions, secrets, device time). No git
mutations without the owner's explicit permission — squads report, the owner
commits.
