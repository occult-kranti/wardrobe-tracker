# Handoff — Almari

> Updated 2026-09-07 for the Rose atelier, event stylist and operator workbench release. The owner authorized commit, GitHub merge and publication in this session. See [current links](docs/49-alpha-links.md) and the [repository guide](docs/README.md) for the active surfaces and commands. The numbered sprint details below retain useful background.

## 1 · Current implementation

The web alpha defaults to warm Rose atelier (`gilt`), uses Outfits in the main navigation and Profile in More, and includes weather-aware event styling with Claude Fable 5.1. Explicit stored theme choices still win. Safe Obsidian-style corner ornaments replace overlapping nested frames across all six themes.

The separate portal supports operational statistics and explicit model/image comparisons. Its public shell is staged under `/portal/`; stats and AI calls require `ADMIN_TOKEN`. Token and test material stay in memory. Dated prices and returned usage produce estimates, with unknown costs shown explicitly. Publication and validation status live in docs/49 and the latest release record.

### What the sprint shipped, in one screen

1. **The alpha usage record** — PLAN.md #1 as amended by the owner 2026-08-28.
   `src/lib/usage.ts`: fourteen event names in a closed vocabulary, property
   values only numbers/booleans/enums (no sanitiser, by law — there is no path
   for user text), nothing buffered before consent, revocation destroys local
   and remote, bounded ring buffer that yields to the wardrobe. Consent panel
   (`src/components/UsageConsent.tsx`): unticked box, two equal exits, shows
   the real pending payload. Twelve call sites; byte counts travel as four
   size bands; `sync_attempted`'s clock is floored to the hour so it cannot be
   joined to the account-named wardrobe row. An adversarial review broke three
   of the four rules with live reproductions; every hole is closed and each
   carries the regression case that would have caught it.
2. **The project lead’s portal** — separate build (`vite.portal.config.ts`, `src/portal/`). The 2026-09-07 owner direction replaces the former local-only ruling: publish the static shell, keep operational reads and test calls authenticated, and keep it outside consumer chunks/precache. Nothing fires on mount.
3. **The demolition** — the previous agent's uncommitted admin rewrite is gone:
   four fabrication modules (hardcoded audit scores, an in-memory "telemetry"
   store) archived under `docs/attic/` and removed; the `/admin` route struck
   from the app; a broken `check-alias-parity.mjs` (syntax error — verify could
   not run at all) repaired; a live non-negotiable-#3 violation in the Wishlist
   (no-wait pieces interrogated on arrival, calm exit hidden) fixed and gated.
4. **The documents tell one truth** — README, CLAUDE.md, PLAN.md, AGENTS.md,
   GEMINI.md, ship.html, alpha.html, and the tester consent note (docs/37, now
   counting **three** exceptions) all describe the amendment.
   `check-promises.mjs` walks the whole tree in verify; dated records keep
   their historical prose behind a superseded banner, living documents were
   corrected in the body, and the red-proof proves the check bites both ways.
   `docs/45-what-almari-records.md` is the reference the others point at.
5. **Three coding subagents** for the next waves: `telemetry-engineer`,
   `portal-builder`, `suite-writer` (`.claude/agents/`), each carrying the
   binding rules of its lane.

### The addresses

| | |
|---|---|
| The app (testers) | https://occult-kranti.github.io/wardrobe-tracker/ |
| The tester door | https://occult-kranti.github.io/wardrobe-tracker/alpha.html |
| Operator portal | https://occult-kranti.github.io/wardrobe-tracker/portal/ — public shell, authenticated calls |

---

## 2 · What is built but NOT yet deployed — the owner's runbook

The client half of the usage record ships with the next push; the server half
does not exist until these run. Until then `flushUsage` fails silently by
design and the bounded buffer simply holds — nothing is lost and nothing leaks,
but the portal's roster stays empty and no usage row ever lands.

In order, once:

1. `git push` (main). The Pages deploy runs; the check-portal-not-shipped step
   is now part of it.
2. **SQL:** paste the whole of `supabase/setup.sql` into the SQL editor and run
   it (idempotent). This creates `public.usage_events` and — important — DROPS
   the anon insert policy; the table ends with RLS on and zero policies. Verify
   per the comment block at the file's foot: every anon operation refused.
3. **Functions:** `supabase functions deploy admin-stats` (the roster — without
   this the portal says, correctly, that the service predates the board) and
   `supabase functions deploy usage` (`supabase/config.toml` now carries its
   `verify_jwt = false`). `ADMIN_TOKEN` must be set in secrets; the usage
   function needs nothing beyond the runtime-injected service pair. End-to-end
   curl checks are step 6 of `supabase/README-SETUP.md`.

---

## 3 · The outfit-features cost ruling (2026-08-31, measured live)

The owner asked what "Outfit of the day" (50×/user/month) and "ask for an
outfit" (75×/month) would cost through the relay. Twelve live calls were run
through it (≈ $0.40 total) with a real 60-piece persona closet serialized as a
4,681-token prefix, on both `claude-fable-5` ($10/$50 per MTok) and
`claude-opus-5` ($5/$25). Measured, not estimated:

| Per call, 60-piece closet + weather + event | in | out | cost |
|---|--:|--:|--:|
| Fable, default effort | 4,758 | 758 (~476 thinking) | $0.086 |
| Fable, effort low | 4,758 | 539 (~246 thinking) | $0.074 |
| **Opus, thinking off, effort low** | 4,759 | 426 (0 thinking) | **$0.034** |
| Images: 900×600 JPEG = 729 tok (matches px/750) · 128px JPEG = 23 tok · 128×192 **WebP = 808 tok** — never send WebP | | | |

Monthly per user at 125 calls: Fable as specced **$11.10**, Opus tuned
**$4.29**, best possible pure-API ≈ **$2.60–3.00**, closet-as-images **$50+**.
Against docs/28's **$2.80 net revenue per unit, once**, a 20% COGS budget over
three years is **$0.0156/user/month ≈ one Opus call**. No pure-API design
comes within 100× of fitting, and fifty testers on the Fable plan would burn
≈ $470/month — a double-digit share of the whole stated burn.

**The ruling (advisor-reviewed, measurements concurring):**

- **OOTD makes zero API calls.** `getWearablePool()` + `suitsOutdoors()` + the
  event reservations already answer it, offline and free — and an automatic
  morning call would be the first thing in Almari to leave the device without
  a press. Batch API is rejected too: the weather chip is tapped at the
  window, so batching overnight means four variants at half price = 2× one
  live call.
- **ASK runs on Opus 5, never Fable:** Fable cannot disable thinking (an
  unboundable, invisible cost line) and cannot run under zero-data-retention —
  and closet text is exactly the sensitive payload. Config: thinking off,
  effort low, `max_tokens: 2000`, structured output, ordinal indices instead
  of UUIDs (~$1/user/month in identifiers alone), a local matcher in front so
  only genuinely open asks reach the API (~6 calls/month for an active user ≈
  **$0.14/month**), and a bundled lifetime allowance + BYOK (the `AiOverride`
  mechanism already exists) beyond it.
- **Fable stays where it earns 2×:** reading a photograph at intake.
- Two empirical traps for the implementer: changing `output_config.effort`
  silently invalidates the prompt cache (measured — pin one effort per route),
  and caching a once-daily call is a pure 1.25× surcharge (5-minute TTL never
  hits; it pays only inside multi-question sessions).

---

## 4 · The roadmap — next plans, in order

Waves are disjoint and sequential; verify runs between them (the
parallelization law in CLAUDE.md binds all of this).

**W0 — Owner actions (unblocks everything).** Push main; run the §2 runbook;
confirm the portal roster fills after the first test signup.

**W1 — Finish the usage record.** Wire the four unwired events (`app_opened`,
`cutout_run`, `export_taken`, `session_ended` — 10 of 14 have call sites
today). Build the 90-day purge for `usage_events` (docs/45 states it as an
intention, deliberately not as fact — pg_cron or a dated runbook step; the doc
updates in the same commit). Add a "forget this install id" note to the
tester-facing copy once the purge exists.

**W2 — The portal reads the alpha, not just the account service.** An
aggregates endpoint (extend `admin-stats` or a sibling; aggregates only, never
raw rows, service-role only) and a usage section on the board with the
denominator rule ("14 of 23 opted in") and counts-never-rates. Then the
advisor's wave-3 panels: the return curve from `updated_at` (7/14/21/28-day
counts), the rule-of-three caption under every zero, the roster card. While
the sync consent copy names the rows the service reads (it does, since
ff7ab72), this is honest to build.

**W3 — Relay hardening, BEFORE any outfit feature.** Clamp
`output_config.effort` beside the existing `max_tokens` clamp (today it is a
pure pass-through — anything on the Pages origin can send `effort: max`); a
per-install quota, buildable without logging anything about a wardrobe; and
the `pg_column_size` RPC so `admin-stats` stops selecting whole wardrobe
blobs just to length-count them.

**W4 — The outfit features, per the §3 ruling.** OOTD: polish the local
generator's surface (it already exists; no network). ASK: a new text-only
request builder in `src/lib/` (the intake path hard-requires an image — none
of it is reusable but the relay plumbing), the local matcher gate, the
allowance meter, BYOK passthrough. **docs/45 and the consent surfaces are
amended BEFORE the feature ships** — closet text leaving the device is a new
exception and gets argued as one, with the same deliberate-press law as
intake.

**W5 — Alpha program operations** (from the 2026-08-28 research; the sources
are linked in docs/45's neighbourhood and the sprint reports). Decide the
naming (at 15–50 target-market testers on a feature-complete product this is
a private beta; testers told "alpha" forgive the wrong things). Write exit
criteria before the first invitation. Over-recruit 2×; screen for both
archetypes plus low-digital-confidence testers. A plain-language participant
agreement over an NDA. Instruments: diary study (5–12 people, 2–3 weeks),
three rounds of five moderated sessions, the Sean Ellis/PMF survey at week 4
— the usage record counts beside these, never instead of them. If the Android
production track is wanted: Google Play's closed-testing gate (12 testers,
14 continuous days, then ~7 days review) is a three-week schedule dependency
that starts the day an APK exists.

**W6 — The native track** stays as planned in `docs/34` (plan of record);
note EAS Update does not load in Expo Go, so the OTA-fix path needs the
dev-client decision first.

---

## 5 · Open questions only the owner can answer

1. Portal publication is authorized as of 2026-09-07; access to its data and AI calls still requires the existing admin secret.
2. Retention window and the delete-a-tester path — 90 days is written as
   intention; make it real in W1 or strike it.
3. `company/index.html` still says "no accounts, no cloud" in two places —
   stale against the 2026-08-18 sync amendment (a different amendment than
   the usage record's; no check covers it). Correct or banner?
4. The beta-vs-alpha naming (W5) — it changes tester copy in docs/37 and
   alpha.html.
5. ASK allowance size: the measured floor is ~$0.03/call — 40 lifetime calls
   ≈ $1.20 COGS against $2.80 net. Pick the number.

---

## 6 · Gotchas the next session should not rediscover

- **Build order:** consumer build and isolation gate first; portal builds independently into `dist-portal/`; `stage:portal` copies only that public shell afterward. A later app build empties the staged `dist/portal/`, so stage again before publishing.
- **`docs/attic/` is an archive of removed code** — excluded from
  check-promises on purpose; never "fix" it.
- The dated records (docs/24/28/29/39) carry a superseded banner and keep
  their historical text; docs/33 and docs/34 are LIVE plans, corrected in the
  body, and `check-promises.mjs` refuses the banner escape for them by name.
- The browser suites (`test:flows`, `test:features`, `test:portal`,
  `test:usagelive`) are outside verify because they need a served build; they
  seed consent as `declined` so the panel never swallows a click — the
  panel's own behaviour lives in `test-usage-live.mjs` alone.
- `PROMPT.md` and `BUILD-HANDOFF.md` remain Toile-era history. This file is
  the handoff of record.

*Verify before believing any of the above: `npm run verify`, then the browser
suites against a preview on :4174 and the portal on :4175.*
