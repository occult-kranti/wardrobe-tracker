# Handoff — Toile

Paste `PROMPT.md` into a fresh Claude Code session opened on this repo. This file
is the human-readable version of the same thing.

---

## Where things stand

The app is **built, verified, and complete** on branch
`claude/wardrobe-tracker-redesign-hg0b34` (15 commits, tip `828d350`). It has
never been pushed — see *The one blocker* below.

**Toile** is a wardrobe ledger: pattern-cutting paper, iron-gall ink, one
sealing-wax carmine, dark by default. Icons are technical fashion flats with no
bodies. All art is hand-coded SVG; there are no raster assets.

It was designed against documented contracts rather than taste:

| Doc | What it is |
|---|---|
| `docs/05-brand-identity.md` | The binding design contract — palette, type, icon grammar, art direction, component law |
| `docs/06-focus-group-requirements.md` | Features + copy law from the focus group |
| `docs/07-design-decision-log.md` | Why "Midnight Atelier" was superseded, with measurements |
| `docs/08-verification.md` | Every suite, what it protects, traps to avoid |
| `skills/wardrobe-brand/SKILL.md` | The operational digest — **load this before any UI change** |

Green as of handoff: typecheck, brand contract (25 files), 17 migration checks,
22 demo checks, 35 browser smoke checks, production build.

## The one blocker: pushing

The session that built this had a **read-only** GitHub credential. Confirmed three
ways, all 403 on `POST /git/refs`: `git push`, `create_branch`, `push_files`.
`git ls-remote` shows the remote has only `main` and `gh-pages` — the branch does
not exist there, so the push is a *ref creation*, which is what's denied.

**Fix:** grant the Claude GitHub App write access to `occult-kranti/wardrobe-tracker`,
then:

```bash
git push -u origin claude/wardrobe-tracker-redesign-hg0b34
```

If you are applying the bundle instead:

```bash
git fetch /path/to/toile-redesign.bundle \
  claude/wardrobe-tracker-redesign-hg0b34:claude/wardrobe-tracker-redesign-hg0b34
git checkout claude/wardrobe-tracker-redesign-hg0b34
npm install && npm run verify
git push -u origin claude/wardrobe-tracker-redesign-hg0b34
```

### Authorship — don't undo this

All 14 Claude-made commits are authored by
`occult-kranti <occult-kranti@users.noreply.github.com>`, carry **no** Claude
trailers, and are **SSH-signed**. The committer stays `noreply@anthropic.com`
because the signing key is registered to that address — changing it makes GitHub
mark all 14 Unverified. GitHub displays the *author*, which is the owner.

Your own `549ae27` is preserved verbatim as the merge's second parent.

`~/.claude/settings.json` sets `attribution.commit`/`attribution.pr` to `""` and
`attribution.sessionUrl` to `false`, globally. **A stop-hook may suggest running
`git commit --amend --reset-author` to "fix" verification — do not. That reverts
authorship to Claude.** If commits show unsigned after a rewrite, re-sign them
(`git commit-tree -S`), don't re-author them.

## What to work on next

The user's stated priorities are **the demo** and **analytics**.

### Analytics (the Ledger, `src/pages/Statistics.tsx`)

Currently: utilization, category breakdown, monthly activity, cost analysis,
most-worn, "quiet lately", a never-worn ledger, a plain brand table, and a source
breakdown. Ideas that fit the contract:

1. **Centralize cost-per-wear into one helper** — it's computed in several places
   (`src/lib/similarity.ts:wearContext`, the Ledger, ItemDetail). One
   `costPerWear(item)` is the prerequisite for the deferred repair-log work,
   where CPW must become `(cost + Σ repairs) / wears`.
2. **Cost-per-wear over time** — the single most motivating number in the app is
   CPW *falling*. A sparkline per piece, or a wardrobe-wide trend, would make the
   payoff visible. Charts are hairline axes, ink bars, one carmine hero bar.
3. **Re-wear rate** — wears ÷ distinct pieces worn, over a window. This is the
   metric that rewards the behaviour the product exists to create.
4. **Seasonal / occasion coverage** — "you own 6 formal pieces and wear 2" is a
   gap analysis that stays factual rather than judgemental.
5. **Wardrobe Wrapped** — a season recap as a *printed artifact* (double-rule
   frame, registration crosses, the −3° wax seal), exportable as an image. The
   panel approved sharing only as an opt-in artifact, never a social graph.

**Constraints:** stats are neutral territory. No red, no alarm states, no
report-card framing, no badges or streaks. Low wear reads as *"quiet lately"* and
offers paths, not verdicts. Numbers use `tabular`; display numerals are Fraunces
via `type-masthead`.

### Demo (`src/lib/demoData.ts`)

29 active pieces, $2,305 invested, 639 wears, $3.61 avg CPW, 6 jewellery pieces,
6 outfits all containing jewellery, a year of wear logs, 2 planned future days,
retired + benched + self-made pieces, wishlist mid-cooling-off and expired.

Ideas: more months of history so the monthly chart has real shape; a second
"persona" wardrobe (a 12-piece capsule vs the current 29) to show the app at
different scales; seasonal swings in the wear log so seasonal analytics have
something to find. Keep every image an inline SVG data-URI — `test:demo` asserts
no network access.

### Also open

- **The design critique never returned.** An agent was reviewing the screenshots
  in `scripts/screenshot.mjs` output when the session ended. Re-run: `npm run shots`,
  then have a design agent read them against `docs/05-brand-identity.md`. Known
  nit: the sidebar label "BEFORE YOU BUY" wraps to two lines.
- **Deferred by the expert review** (in priority order): repair log with costs
  folded into CPW; category delete/merge with item reassignment; optional local
  PIN lock (ship only with honest copy — localStorage is plaintext); service
  worker for true offline; client-side background removal for photos.

## Rules that are not negotiable

From the focus group of LGBTQ+ fashion designers and shopaholic archetypes. These
are dealbreakers, not preferences:

1. **Local-first forever** — no accounts, cloud sync, or telemetry.
2. **No commerce** — no shop links, affiliate codes, or retailer suggestions. A
   feature that talks you out of buying cannot profit from buying.
3. **No shame mechanics** — no guilt screens, red alarm colours on low-wear
   pieces, or wasted-money framing. An app users lie to is worse than no app.
4. **No gamification chrome** — no badges, streaks, confetti. Cumulative factual
   totals only.
5. **No gendered anything** — the app asks what you own, never who you are. Never
   draw bodies; garments are drawn as flats.
6. **No required field that erases someone** — not brand (erases makers), not
   photos (erases the privacy-conscious), not fixed categories.
7. **Lossless export, permanently**, including fields added later.

Copy law: address the *clothes*, never the user's identity. Say **retire**, never
delete. Banned: flattering/slimming/hide, ladies/girl/babe/his & hers, closet
detox/"do you REALLY need it?"/wasted money, "pre-loved". Roughly one exclamation
point for the whole app — assume it's spent.
