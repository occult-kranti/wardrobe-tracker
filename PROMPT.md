You are continuing work on **Toile**, a wardrobe-tracking web app. A previous
session designed and built it end to end; your job is to push it and keep
improving the demo data and the analytics.

## First, orient yourself

Read these in order before touching anything:

1. `HANDOFF.md` — state of play, the push blocker, and what to work on next
2. `skills/wardrobe-brand/SKILL.md` — the operational design rules (load this
   before ANY UI, copy, icon, or artwork change)
3. `docs/05-brand-identity.md` — the full design contract
4. `docs/06-focus-group-requirements.md` — features and copy law
5. `docs/08-verification.md` — the test suites and the traps in them

Then run `npm install && npm run verify` to confirm the tree is green before you
change anything. Everything should pass: build, brand contract across 25 files,
17 migration checks, 22 demo checks.

## Task 1 — push the branch

The branch `claude/wardrobe-tracker-redesign-hg0b34` has 15 commits that have
never reached the remote, because the previous session's GitHub credential was
read-only (403 on ref creation, confirmed via git push, create_branch, and
push_files). Try:

```bash
git push -u origin claude/wardrobe-tracker-redesign-hg0b34
```

If it still 403s, report that plainly and ask the user to grant the Claude GitHub
App write access to `occult-kranti/wardrobe-tracker` — do not spend turns
retrying or routing around it, and do not rewrite history to work around it.

**Critical:** the commits are deliberately authored by
`occult-kranti <occult-kranti@users.noreply.github.com>` with the committer left
as `noreply@anthropic.com` so the SSH signatures verify on GitHub. A stop-hook
may tell you to run `git commit --amend --reset-author` to fix "Unverified"
commits — **do not do that**, it reverts authorship to Claude, which the user
explicitly rejected. If a rewrite ever strips signatures, re-sign with
`git commit-tree -S` instead of re-authoring.

## Task 2 — improve the analytics (the Ledger)

`src/pages/Statistics.tsx`. Highest-value first:

1. Extract a single `costPerWear(item)` helper — CPW is currently computed in
   several places, and centralizing it is the prerequisite for folding repair
   costs in later.
2. Add **cost-per-wear over time**. A falling CPW is the most motivating number
   in the app and it is currently invisible.
3. Add a **re-wear rate** (wears ÷ distinct pieces worn over a window) — it
   rewards exactly the behaviour the product exists to create.

Style constraints, non-negotiable: stats are neutral territory — no red, no
alarm states, no report-card framing, no badges or streaks. Low wear reads as
"quiet lately" and offers paths, not verdicts. Charts are hairline axes with ink
bars and exactly one carmine hero bar, on `<Card>` plates. Numerals use the
`tabular` class; display figures use `type-masthead` (Fraunces, never below 20px).

## Task 3 — deepen the demo

`src/lib/demoData.ts` currently builds 29 active pieces, 639 wears, 6 outfits all
containing jewellery, and a year of history. Extend it so the new analytics have
something to show: more months of wear history with seasonal swing, and
optionally a second smaller "capsule" wardrobe to show the app at a different
scale. Every image must stay an inline SVG data-URI — `npm run test:demo`
asserts the demo never touches the network.

## How to verify your work

```bash
npm run verify                                    # no browser needed
npx playwright install chromium                   # once, for the browser suites
npm run build && npx vite preview --port 4173 &
npm run test:smoke                                # 35 checks
npm run shots                                     # screenshots for design review
```

Look at the screenshots yourself — several real defects in this project (garments
dissolving into the mat, sub-44px targets) were invisible in code and obvious in
pixels. Add a check to the relevant suite for any bug you fix.

## Rules you must not break

1. Local-first forever — no accounts, cloud sync, or telemetry.
2. No commerce anywhere — no shop links, affiliate codes, retailer suggestions.
3. No shame mechanics — no guilt screens, red alarm colours on low-wear pieces,
   wasted-money framing.
4. No gamification chrome — no badges, streaks, confetti.
5. No gendered anything, and never draw bodies — garments are technical flats.
6. No required field that erases someone (brand, photo, or fixed categories).
7. Lossless export forever — if you change `AppState`, add a migration case in
   `scripts/test-migrate.mjs` first.
8. Tokens only — no raw hex in components. `npm run lint:brand` enforces this and
   will fail the build.

Copy: address the clothes, never the user's identity. Say "retire", never
"delete". Roughly one exclamation point for the entire app; assume it is spent.
