# CLAUDE.md — Almari

## The 60-second orientation

**Almari** is a private wardrobe ledger: track what you own, what you actually
wear, what it costs per wear. Local-first — no telemetry, no commerce, no
shame mechanics; an optional account syncs a wardrobe you choose, off by
default. The house style is pattern-cutting paper, iron-gall ink, one
sealing-wax carmine.

Two apps and a back office live here:

- `src/` — the **web PWA** (React 19 + Vite + Tailwind v4, HashRouter,
  localStorage). Feature-complete for alpha; all suites green.
- `app/` — the **native app** (Expo SDK 57 + React Native), scaffold only.
  The plan is `docs/34-app-development-plan.md`; the operational digest is
  `.claude/skills/expo-build/SKILL.md`. `app/AGENTS.md` is a hard rule: read
  https://docs.expo.dev/versions/v57.0.0/ before writing any app code.
- `company/` — internal boards (tracker, ship page, build plan). Not the
  product.
- `docs/` — numbered decision records. `docs/33` is the alpha roadmap
  (backlog of record), `docs/34` the app plan, `docs/35` the alpha panel and
  the owner's decisions, `docs/37` the alpha kit. `company/ship.html` is the
  public status page.

## Binding contracts

- `.claude/skills/wardrobe-brand/SKILL.md` — load before **any** UI, copy,
  icon, or artwork change. Tokens only, radius 2, the two reds and a blue,
  copy law (address the clothes; one exclamation point, assume it is spent).
- `.claude/skills/toile-social/SKILL.md` — load before touching accounts,
  the feed, chats, sharing: the four verbs, snapshot consent, no metrics.
- `PLAN.md` — the seven non-negotiables, as amended 2026-08-18 (#1: an
  optional account for opt-in per-wardrobe sync is admitted; #4: positive-only
  honors admitted per docs/36, not yet built) and the owner decisions of
  2026-08-19 (`docs/35`: E2E-encrypted sync is the committed trust target;
  personas labelled as samples; who-pays published).
- Lossless export forever — change `AppState` and a migration case lands in
  `scripts/test-migrate.mjs` FIRST.

## Verification

```bash
npm run verify        # build + brand + migrate/demo/intake/feed/sync/feed-intake/gallery-intake — no browser
npx vite preview --port 4174 &   # then:
npm run test:flows    # every route, signed out and in, phone and desktop
npm run test:features # the door, the cutout, the relay, installability
# test:smoke / test:contrast / shots run against port 4173 instead
```

Live AI suites (owner's key in the environment, never written down):
`KIMI_KEY=... node scripts/test-feed-intake.mjs --live` and
`test-gallery-intake.mjs --live`.

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
