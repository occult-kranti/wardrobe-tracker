# BUILD-HANDOFF — start-of-build prompt for the native era

Paste this into a fresh Claude Code session opened on this repo to begin the
Expo build. Read `CLAUDE.md` first (it loads every session anyway), then
`docs/34-app-development-plan.md` (the plan of record) and
`.claude/skills/expo-build/SKILL.md` (the operational digest).

---

## (a) Where the work stands — shipped this sprint

The web PWA is **feature-complete for alpha**. This sprint landed:

- **The living feed** — a deterministic persona engine (`src/lib/feedEngine.ts`)
  derives dated look-posts from each persona's own outfits, events and
  seasons; merged idempotently at boot, capped, tombstone-aware, never
  touching user posts. Image-first 4:5 cards; the only engagement mechanic is
  a private on-device save. Personas are labelled "sample wardrobe"
  (owner decision, docs/35).
- **Feed & sync correctness** — sub-day timestamps ended the same-day
  scramble; cross-tab writes merge per entity; taken-down posts stay down;
  accepting a borrow request in Chats creates the real loan in the Rail
  ledger. 72 feed checks stand watch.
- **The mobile-first pass** — 16px input floor (no iOS zoom), bottom-sheet
  modals with keyboard safety, dismissible More sheet, snap-strip calendar,
  real PNG icons + apple-touch-icon.
- **First-run tutorial** — four beats, dismissible forever, replayable from
  Settings; empty states audited.
- **Sign-in + optional Supabase sync** — email auth, per-wardrobe opt-in,
  whole-blob LWW by `updated_at`. The device stays the default home of every
  wardrobe.
- **Kimi K3 vision intake** — photo intake, **feed-screenshot import** (an
  Instagram grid becomes cropped garment drafts; group photos left alone), and
  **multi-photo gallery import with auto-crop** — all through the Supabase
  `ai-proxy` relay, which holds the key server-side.
- **The cofounder persona** — the owner's real closet ships as the sixth
  sample wardrobe (`personaCast.ts` id `cofounder`), at his own ask.
- **Docs 33–37** — alpha roadmap, app plan, alpha panel + owner decisions,
  badges spec, alpha kit. `company/ship.html` is the public status page.

## (b) Verified green

- `npm run verify` — build + `lint:brand` (72 files) + `test:migrate` +
  `test:demo` + `test:intake` + `test:feed` + `test:sync` +
  `test:feedintake` + `test:galleryintake`.
- `npm run test:flows` and `npm run test:features` against
  `npx vite preview --port 4174`.
- `npx tsc -b` clean; `npx tsc --noEmit` green in `app/` (scaffold).

## (c) Next phases, in order

1. **docs/33 Phase G remainder** (web alpha readiness) — check
   `company/ship.html` and docs/33 for current state: G1 QA/edge-case sweep
   (qa-sentinel's charter), G2 alpha-kit owner fills (docs/37 §11), G3 device
   matrix, G4 performance/code-splitting, G5 ledger pack (per-category CPW,
   marginal monthly CPW, utilization trend, CSV export), G6 TOILE→Almari
   internals sweep (storage keys stay byte-identical), G7 disclosure pack
   (partly landed: who-pays shipped, personas labelled).
2. **docs/34 Phases 0–4** (the native app) — Phase 0 setup (tokens, fonts,
   icons, router skeleton, AsyncStorage adapter, `packages/shared` lift, CI);
   Phase 1 basics (Supabase auth, closet CRUD + photos, two-tap log); Phase 2
   features (every screen, export↔import round-trip); Phase 3 design pass;
   Phase 4 hardening + the pre-registered alpha gates.

## (d) How to use the roadmap

- `docs/33-alpha-mobile-roadmap.md` is the **backlog of record** for the web
  app and the alpha itself.
- `docs/34-app-development-plan.md` is the **app build plan** — decisions,
  backend, phases, QR distribution. It supersedes docs/32 on the toolchain
  only; docs/32's storage research still stands.
- `company/ship.html` is the **public status** — when a phase ships, the page
  changes in the same wave.
- `PLAN.md` holds the seven non-negotiables (as amended); `docs/35` holds the
  owner decisions that bind the build (E2E sync committed, personas labelled,
  who-pays published, notifications vetoed).

## (e) Parallelization — the wave law

Run subagent waves with **disjoint file ownership declared in each squad's
prompt before it starts**. This sprint's pattern: FEED owned
`src/lib/feedEngine.ts`, `src/pages/Feed.tsx`, `scripts/test-feed.mjs`;
MOBILE owned `src/index.css`, `src/components/Layout.tsx`, modal chrome;
REPO-PREP owned `.claude/**` and root handoff files only. **One squad owns the
build at a time** — verification runs between waves, not during. **No git
mutations without the owner's explicit permission** — squads report, the owner
commits. For app work, the natural squads are: SHARED-LIFT (packages/shared +
web alias rewiring), TOKENS/ICONS (app/src/tokens, app/src/icons), SCREENS
(one route group at a time per the docs/34 §2.2 map), BACKEND (sync client +
relay), QA (jest mirrors + edge cases).

## (f) Backend facts

- **Supabase project `wvupsqfevlrmhqfjreyx`**
  (`https://wvupsqfevlrmhqfjreyx.supabase.co`). Tables `profiles` and
  `wardrobes` (`state jsonb`, `updated_at`); **RLS owner-only**
  (`auth.uid() = id` / `= user_id`); `supabase/setup.sql` is idempotent;
  runbook `supabase/README-SETUP.md`.
- **Sync semantics:** whole-state blob, **last-writer-wins by `updated_at`**
  (client-stamped in alpha; ties keep local). Photos do not sync in alpha.
  **E2E-encrypted sync is the committed trust target** (docs/35 owner
  decision 2) — until it lands the blob is operator-readable and copy says so.
- **The ai-proxy edge function** (`supabase/functions/ai-proxy/index.ts`):
  pass-through to Kimi (`https://api.kimi.com/coding/v1/chat/completions`),
  OpenAI-compatible shape, model `k3`, no key from the client, `verify_jwt`
  off, logs nothing. K3 is a reasoning model — `max_tokens` ≥ 8000; the answer
  is `choices[0].message.content`. Redeploy from the repo root:
  ```sh
  supabase link --project-ref wvupsqfevlrmhqfjreyx
  supabase secrets set KIMI_KEY=<the key>      # never written to any file
  supabase functions deploy ai-proxy           # elsewhere: add --no-verify-jwt
  ```
- `workers/ai-proxy` is the parked Cloudflare attempt — do not revive it
  without an owner call.

## (g) Repo map

- `src/` — web PWA (pages, components, context, hooks, lib; `types.ts` is the
  state contract)
- `app/` — Expo SDK 57 scaffold (`AGENTS.md` inside is binding; `src/`
  sublayout per docs/34 §2.1 as phases land)
- `company/` — internal boards: `tracker.*` (workroom), `ship.html` (public
  status), `build.*`
- `docs/` — numbered decision records (33–37 are the current era)
- `scripts/` — build pipelines and the `test-*.mjs` suites (the web's source
  of truth; they bundle with esbuild)
- `supabase/` — `setup.sql`, `config.toml`, `functions/ai-proxy`
- `workers/` — parked (see above)
- `design-*/` — design exploration packs, not the product

## (h) Keys & secrets — where each lives (values never in the repo)

| Secret | Where it lives | Notes |
|---|---|---|
| `KIMI_KEY` | Supabase secrets store (`supabase secrets set`) | Powers the ai-proxy relay. Set. Never in the repo; `supabase secrets list` prints names only. |
| Supabase publishable anon key | `src/lib/supabase.ts`, shipped in client code | Safe by design — it grants nothing on its own; RLS is the lock. |
| Anthropic key | A user's own device (`localStorage` `toile-key`), legacy/BYOK only | Entered by the user, sent only to their own endpoint/Anthropic. Never in the repo. |
| EAS access | The owner's Expo login (occult-kranti) | `eas update` / `eas build` run owner-authenticated, never in CI. Project id `1b9ec18c-58dc-4052-a50d-219cb2376e64`. |

The rule: **secrets never enter the repo.** `secrets.md` is gitignored. ⚠
`test_images/` currently is **not** — `.gitignore` lists `test-images/` with a
hyphen but the directory uses an underscore; fix that line before any commit
that could sweep in tester photographs. Also per docs/33: `company/tracker.js`
carries a legacy JWT-style anon key for the internal board — verify and rotate
before anyone outside the team clones. Two loose ends to hand the owner:
`app/app.json` still has `REPLACE-WITH-EAS-PROJECT-ID` placeholders (the real
id sits in a stray repo-root `app.json` — swap it in and delete the stray).

## (i) Verify & test commands

```bash
npm run verify            # the no-browser gate: build, brand, migrate, demo, intake, feed, sync, feed-intake, gallery-intake
npx vite preview --port 4174 &   # browser suites need a served build
npm run test:flows        # every route, signed out and in, phone and desktop
npm run test:features     # door, cutout, relay honesty, installability
# port 4173 for: test:smoke, test:contrast, shots
npx tsc -b                # typecheck alone
npm run lint:brand        # the brand contract alone
```

Live AI test modes (real reads against the Kimi API; the key comes from the
environment and is never written down):

```bash
KIMI_KEY=... node scripts/test-feed-intake.mjs --live [screenshot.png]
KIMI_KEY=... node scripts/test-gallery-intake.mjs --live
```

App side (as it gains code): `cd app && npx tsc --noEmit`, then jest +
jest-expo suites mirroring the node corpus. `npx expo start` shows the QR.

## (j) The advisor, and which models do what

`CLAUDE.md` carries the **advisor discipline** (consult before substantive
work and before declaring done; deliverables durable first; conflicts
surfaced, never silently switched). It binds this session.

Model routing: **Claude Code is the builder.** Inside the product, app AI
calls go to **Kimi K3 (model id `k3`) through the ai-proxy relay** — never
direct, never with a key on the device.
