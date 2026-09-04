# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The 60-second orientation

**Almari** is a private wardrobe ledger: track what you own, what you actually
wear, what it costs per wear. Local-first — no commerce, no shame mechanics; an
optional account syncs a wardrobe you choose, off by default, and the alpha's
opt-in usage record is off until a tester ticks the box (PLAN.md #1 as amended
2026-08-28; `src/lib/usage.ts` and `docs/45-what-almari-records.md`). The house style is pattern-cutting paper, iron-gall ink, one
sealing-wax carmine. Comments in this repo are long and essayistic on purpose:
they record *why*, usually after a failure. Read the comment before changing
what it guards.

Three trees and a back office:

- `src/` — the **web PWA** (React 19 + Vite 8 + Tailwind v4, HashRouter,
  localStorage + IndexedDB). Feature-complete for alpha, and the reference
  implementation for everything else.
- `packages/shared/` — `@almari/shared`: framework-free TypeScript with no
  build step, consumed directly by the web app, the native app, and every node
  suite. Types, migration, dates, cost, similarity, intake, flags, nav, storage.
- `app/` — the **native app** (Expo SDK 57 + React Native), scaffold only.
  The plan is `docs/34-app-development-plan.md`. `app/CLAUDE.md` is just
  `@AGENTS.md`, whose one rule binds: read
  https://docs.expo.dev/versions/v57.0.0/ before writing any app code. Load the
  `expo-build` skill before touching `app/`.
- `supabase/` — the backend: `setup.sql` (tables + RLS), `functions/ai-proxy`
  (the AI relay), `functions/admin-stats`. `workers/ai-proxy` is a legacy
  Cloudflare fallback, kept for reference and not deployed.
- `company/` — internal boards (tracker, ship page, build plan). Not the
  product; `company/ship.html` is the public status page.
- `docs/` — numbered decision records (see *Documents of record*).

## Commands

```bash
npm run dev                 # vite on :5173
npm run build               # tsc -b && vite build — typecheck is part of the build
npm run lint                # oxlint + the brand contract (scripts/check-brand.mjs)
npm run lint:brand          # the brand contract alone
npm run verify              # build + lint + alias parity + 26 node suites, no browser.
                            # This is the gate before any report of "done".

# One suite at a time — every suite is a standalone node script:
npm run test:migrate                              # or: node scripts/test-migrate.mjs
node scripts/check-alias-parity.mjs --red-proof   # proves the check still bites
node scripts/check-native-storage.mjs --red-proof

# Browser suites (Playwright). Serve a build first; two ports, on purpose:
npx vite preview --port 4174 &
npm run test:flows          # every route, signed out and in, phone and desktop
npm run test:features       # the door, the cutout, the relay, installability
# smoke / contrast / screenshot.mjs default to :4173 instead

# Network suites — never in verify, only under an explicit flag:
node scripts/test-relay.mjs --live           # the deployed relay; needs no key
node scripts/test-feed-intake.mjs --live     # needs the owner's provider key,
node scripts/test-gallery-intake.mjs --live  # exported in the environment
```

Suite conventions: each script prints `PASS`/`FAIL - label` lines and exits 1 on
failure; node suites load TypeScript by bundling it with esbuild plus
`sharedAliases()` from `packages/shared/aliases.mjs`. Several carry a
`--red-proof` mode that deliberately breaks the thing under test and demands the
check notice — a suite that cannot go red is not trusted here.
`docs/08-verification.md` maps what each suite protects and the traps in them.

Python (`requirements.txt`, Pillow) is build-time only, for
`scripts/build-garment-photos.mjs`; run it inside `.venv`, invoked as `python`.

## Architecture — the parts that span files

### One alias table for the shared package

`@almari/shared/*` resolves through **one** table,
`packages/shared/aliases.mjs`, read by `vite.config.ts` (`resolve.alias`),
`tsconfig.app.json` (`paths`), Metro, and every esbuild call site in
`scripts/`. `check-alias-parity.mjs` resolves each shared module through vite
and esbuild for real and diffs the absolute paths — and it pins the module set
to an explicit `EXPECTED_MODULES` list, so **adding a file to
`packages/shared/` means adding it there too** or verify goes red.
`scripts/check-brand.mjs` walks `src` and `packages/shared` both.

### Where the record lives

- One localStorage key per wardrobe, `wardrobe-tracker:<accountId>`, plus a
  registry (`toile-accounts`), a session pointer (`toile-session`) and one
  shared store (`toile-community`). Canonical keys live in
  `packages/shared/storage.ts`. **The keys keep the old `toile-` names on
  purpose** — renaming one orphans every wardrobe already on a device.
- `useLocalStorage` (`src/hooks/`) writes in an effect, coalesced 250ms after
  the last edit and flushed on hide/unmount, never inside the state updater. A
  refused write (quota) is counted and said out loud; nothing may confirm
  "saved" over a refusal.
- Photographs live in IndexedDB (`src/lib/photoStore.ts`); the record holds
  `idb:<id>` in `imageUrl` where a data URL used to sit. Both doors off the
  device — export and sync push — **inline** those references. `photoSrc()` is
  the synchronous cache every tile reads, hydrated once at the top of `App.tsx`.
- Migration is `packages/shared/migrate.ts` against `SCHEMA_VERSION` in
  `types.ts`. Unknown keys survive verbatim so a newer export round-trips
  through an older build. Change `AppState` → the case lands in
  `scripts/test-migrate.mjs` FIRST.

### The provider tree and the route table

`SessionProvider` (accounts, which wardrobe is open, community, theme, Supabase
auth) sits above `HashRouter`. Inside it, `Session` gates on `activeId`: with
none, only the Door routes render. With one, `WardrobeProvider` mounts **keyed
by `activeId`** — that key is the whole reason switching wardrobes cannot write
one closet's contents into another's storage key, because `useLocalStorage`
only reads storage in its initializer. Pages never know accounts exist.

`src/lib/routes.ts` is the one route table (path plus the name used in a
sentence); `App.tsx` pairs it with an `ELEMENTS` map, and every page except the
Door and Today is a lazily split chunk — safe only because the service worker
precaches the whole build. `packages/shared/nav.ts` is the bar roster for both
apps, and the flows suite asserts the rail against that same array.

### The flag

`FEED_ENABLED` in `packages/shared/flags.ts` hides the Look Book (feed,
Explore, story decks) — hidden, never deleted. It is a constant and never an
env var (an Expo Go tester carries no environment); the `feed-showcase` branch
differs by exactly that one line. Suites read the flag from the module and
assert the other truth at the other value; nothing is skipped by deletion.

### The three things that leave the device

1. **A photograph, one press at a time.** `src/lib/anthropic.ts` → the relay at
   `supabase/functions/ai-proxy/index.ts`, which holds the provider keys and
   routes by model prefix (`claude*` → Anthropic, `gemini*` → Google, anything
   else → Kimi). Four clamps: model allowlist (`ALLOWED_MODELS`), token ceiling,
   body cap, Origin check. Default model `claude-fable-5`. A user's own endpoint
   or a legacy key bypasses the relay entirely.
2. **A wardrobe that opted in.** `src/lib/sync.ts` → the `wardrobes` table.
   Last-writer-wins over the whole document, no field-level merge; a sample
   wardrobe never syncs; signing out never deletes. The pure rules are
   unit-tested in `scripts/test-sync.mjs`; the network half is not.
3. **The alpha usage record, once a tester has ticked the box.**
   `src/lib/usage.ts` — admitted by the 2026-08-28 amendment to PLAN.md #1, for
   the alpha and no longer. Three things make it honest, and each is enforced by
   construction rather than by review:
   - *The consent gate.* `record()` checks `isRecording()` on its first line and
     returns. Nothing is buffered before consent — not held back from sending,
     not written down at all — so a tester who opens the panel cannot find it
     already full of their morning. Granting mints a fresh `installId`; revoking
     empties the buffer here and asks the service to drop the rows there, which
     is what makes the Settings copy true.
   - *The closed vocabulary.* Event names come from `EVENT_NAMES`; property
     values are numbers, booleans, or members of an enum, typed per event
     through `EventProps`. `string` is absent on purpose, so the compiler
     refuses `props: { name: item.name }` at the call site. **There is no
     sanitiser and there must never be one** — a sanitiser is what you build
     when user text can reach the payload. If you want to strip something,
     delete the path instead.
   - *The bounded buffer.* A ring capped at `MAX_EVENTS`/`MAX_BYTES`,
     drop-oldest, and any refused write abandoned silently. The wardrobe comes
     first: a tester must never lose a wear log because the app was recording
     that they logged one.

Everything else is local by construction. What is never collected by any route:
garment names, brands, notes, `fitsLike`, captions, chat text, category and
occasion labels, colours, photographs or anything derived from one, cost values
(only a tier bucket), wardrobe names, account names, handles, email addresses.
`docs/45-what-almari-records.md` is the full account and the document the app's
own copy points at.

### The service worker

`public/sw.js` carries two placeholders that `vite.config.ts` rewrites at
`closeBundle` with the real emitted file list and a hash-named cache. The build
**fails** if a placeholder survives, if no JS/CSS/woff2 was emitted, or if
`sw.js` was not copied — a worker that silently precaches nothing looks healthy
from outside. Fonts are self-hosted in `public/fonts`; the app makes no
third-party request of any kind.

### The brand linter

`scripts/check-brand.mjs` (in `lint`, `verify` and CI) rejects raw hex outside
the token sheet, any radius but 2, drop shadows, `lucide-react`, emoji, the
banned-copy list, more than one exclamation point, raw control bytes, and a
theme block that omits a token. Need a colour? Add a token in `src/index.css`.
The allowlist of files permitted literal hexes is in the script itself.

### Deploy

`.github/workflows/deploy.yml` builds on push to `main` and pushes `dist/` to
the `gh-pages` branch (the artifact flow is blocked by a branch policy). The
company boards are copied into `dist/company` **by file name, never the
folder** — adding a document to `company/` must not publish it by accident.

## Binding contracts

- `.claude/skills/wardrobe-brand/SKILL.md` — load before **any** UI, copy,
  icon, or artwork change. Tokens only, radius 2, the two reds and a blue,
  copy law (address the clothes; one exclamation point, assume it is spent).
- `.claude/skills/toile-social/SKILL.md` — load before touching accounts,
  the feed, chats, sharing: the four verbs, snapshot consent, no metrics.
- `.claude/skills/expo-build/SKILL.md` — load before anything inside `app/`.
- `PLAN.md` — the seven non-negotiables, as amended 2026-08-18 (#1: an
  optional account for opt-in per-wardrobe sync is admitted; #4: positive-only
  honors admitted per docs/36, not yet built), the owner decisions of
  2026-08-19 (`docs/35`: E2E-encrypted sync is the committed trust target;
  personas labelled as samples; who-pays published), and the amendment of
  2026-08-28 (#1: an opt-in alpha usage record is admitted, gated behind a
  consent panel that shows the payload, revocable, and removed when the alpha
  ends — `docs/45`).
- Lossless export forever — change `AppState` and a migration case lands in
  `scripts/test-migrate.mjs` FIRST.
- The three product principles every change is judged against: local-first;
  anti-shame (factual, neutral analytics — "quiet lately", never a red alarm,
  a streak, or a completion meter); honest AI (name the model, explain the
  reasoning, no hidden sponsorship).

## Documents of record

`docs/08` the verification map · `docs/23` the photo-intake prompt · `docs/33`
the alpha roadmap (backlog of record) · `docs/34` the native app plan ·
`docs/35` the alpha panel and the owner's decisions · `docs/37` the alpha kit ·
`docs/42` the navigation shell · `docs/43` tutorials · `docs/44` the alpha
website and competitive roadmap · `docs/45` what Almari records, and what it
does not. `supabase/README-SETUP.md` is the owner's
runbook for the account and the relay.

`HANDOFF.md` is the handoff of record (rewritten 2026-09-04: sprint state, the
deploy runbook, the outfit-features cost ruling, and the wave roadmap). Stale
by design, kept as history: `PROMPT.md` and `BUILD-HANDOFF.md` are session
briefs from earlier phases (Toile-era branch names, superseded counts), and
`.claude/skills/README.md` describes skills that do not exist. Where a
document and the tree disagree, believe the tree and the newest numbered doc.

## The parallelization law (subagent waves)

- **Disjoint file ownership, declared before the wave starts.** Each squad's
  prompt lists exactly the files it may touch. This sprint's example: FEED
  owned `src/lib/feedEngine.ts` + `scripts/test-feed.mjs` while MOBILE owned
  `src/index.css` + layout chrome; REPO-PREP owned `.claude/**` and the root
  handoff files only.
- **One squad owns the build at a time.** Builds and `verify` runs happen
  between waves, not during — two squads building one tree is how red suites
  get blamed on the wrong change.
- **No git mutations without the owner's explicit permission** — no commit,
  push, rebase, reset, or branch surgery, however convenient. Report; the
  owner commits.

## The advisor discipline

Adapted from Anthropic's advisor-tool guidance (the "suggested system prompt
for coding tasks": the timing block, and the rule that the advice carries
serious weight). You have access to an advisor — the advisor tool where your
host provides one, or a senior-review subagent you spawn yourself. It reads
your transcript with fresh eyes.

- **Consult BEFORE substantive work** — after a few exploratory reads, before
  writing, before committing to an interpretation, before building on an
  assumption.
- **Consult BEFORE declaring done** — make the deliverable durable first
  (code written to files, suites run), then ask for the review.
- Also consult when stuck (errors recurring, approach not converging) and when
  considering a change of approach.

**Give the advice serious weight.** If you choose not to follow it, say so
explicitly and say why — surface the conflict in your report rather than
silently switching approach.
