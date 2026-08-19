# TOILE — Project Plan

> **Status:** The rebrand and feature rebuild are complete on
> `claude/wardrobe-tracker-redesign-hg0b34`.
> **Goal:** Iterate on the web app until it earns a mobile build.

---

## Phase 1 — Research & identity (✅ complete)

- [x] Market research: 12+ competitors, churn drivers, monetization, trust ruptures,
      and unclaimed visual territories → `docs/01-market-research.md`
- [x] UX/behavioral psychology: habit loops, interaction cost, cold start, ethical
      reward design, accessibility floor → `docs/02-design-psychology.md`
- [x] Three independent brand concepts, scored by a psychologist, a designer, and an
      engineer. **Toile** won 2/3 verdicts; runner-up ideas grafted in
      → `docs/05-brand-identity.md`
- [x] Focus group (LGBTQ+ fashion designers + shopaholic archetypes), moderated, then
      reviewed by a developer and a behavioral psychologist
      → `docs/06-focus-group-requirements.md`
- [x] Brand contract encoded as a loadable skill → `.claude/skills/wardrobe-brand/SKILL.md`
- [x] Repo agents: `design-critic`, `brand-artist` → `.claude/agents/`

## Phase 2 — Rebuild (✅ complete)

**Design system**
- [x] Token set for both themes, AA-verified (warning ochre darkened after audit)
- [x] Custom icon set: technical fashion flats, 1.5px butt/miter, one NE notch each
- [x] Hand-coded SVG art: wordmark, tag monogram, wax seal, six empty-state plates,
      and `GarmentPlate` for first-class no-photo items
- [x] Primitives with focus trap, 44px targets, one-primary-button discipline
- [x] Fraunces + Switzer + IBM Plex Mono; pattern paper, double rules, basting
      dividers, letterpress plates, seal-press motion (reduced-motion safe)

**Data & correctness**
- [x] Local-timezone dates (wear logs no longer shift across UTC)
- [x] Outfit wears credit every member piece
- [x] Future-dated logs are plans, not wears
- [x] User-owned categories and occasions, with quiet categories
- [x] `source`, `fitsLike`, `retired`, bench laundry states
- [x] Wishlist `status` + cooling-off
- [x] Lossless migration, 17 passing checks (v1 data keeps every wear)
- [x] Export serializes whole state (wishlist was silently dropped before)

**Features**
- [x] Before You Buy (cross-category similarity, explainable reasons)
- [x] Brand + source with a plain brand table
- [x] Retire, don't delete
- [x] Mending pile · honest generator · never-worn ledger · stayed-yours ledger
- [x] Taxonomy editor · theme control · backup reminder
- [x] PWA manifest and drawn app icons

## Phase 3 — Next (📋)

- [ ] Service worker for true offline (manifest is in; SW is not)
- [ ] Repair log with costs folded into cost-per-wear (needs a centralized CPW helper)
- [ ] Category delete/merge with item reassignment
- [ ] Optional local PIN lock — ship only with honest copy (localStorage is plaintext)
- [ ] Client-side background removal for photos (on-device = privacy *and* speed)
- [ ] Packing list generator
- [ ] Sealed "season recap" export card (the shareable artifact, opt-in, no social graph)
- [ ] Automated a11y + contrast regression checks in CI

## Phase 4 — Mobile (📱 later)

Gate: Phase 3 complete, Lighthouse 90+ across the board, and the PWA genuinely
pleasant to install and use offline. Capacitor is the likely path — it reuses this
codebase and keeps the local-first promise intact.

## Phase 5 — Alpha mobile sprint (🏃 active)

The mobile-focused alpha push for 15–20 testers: feed correctness and the
living feed, a mobile-first UX pass, tutorials, three more wardrobes, QA and
edge cases, and the native/backend plan. Goals, sub-goals, wave plan and
acceptance live in [`docs/33-alpha-mobile-roadmap.md`](docs/33-alpha-mobile-roadmap.md);
the app development plan (native tracks, backend, tooling) in
[`docs/34-app-development-plan.md`](docs/34-app-development-plan.md).

## Non-negotiables (any future work must hold these)

1. **Local-first, forever.** No accounts, no cloud sync, no telemetry.
   *(Amended 2026-08-18 by owner direction: an optional account is admitted, and
   it does one job only — keeping a synced copy of a wardrobe's record on
   Supabase so a second device can open it. Sync is opt-in per wardrobe and off
   by default; a wardrobe that never opts in never leaves the device, and
   everything works with no account at all. Telemetry stays banned.)*
2. **No commerce.** No shop links, affiliate codes, or retailer suggestions — a
   feature that talks you out of buying cannot profit from buying.
3. **No shame mechanics.** No guilt screens, red alarm colors on low-wear pieces, or
   wasted-money framing. An app users lie to is worse than no app.
4. **No gamification chrome.** No badges, streaks, or confetti. Cumulative factual
   totals only.
   *(Amended 2026-08-18 by owner direction: badges are admitted into the design,
   positive-only — they mark what happened and never punish what did not.
   Streaks, confetti, and anything a user can fail at stay banned.)*
5. **No gendered anything.** The app asks what you own, never who you are.
6. **No required field that erases someone.** Not brand (erases makers), not photos
   (erases the privacy-conscious), not fixed categories (erases everyone else).
7. **Lossless export, permanently**, including fields added by future versions.

---

*Plan updated 2026-08-18.*
