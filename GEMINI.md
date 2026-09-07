# GEMINI.md — Almari / Toile Workspace Guidelines

## Timing Guidance & Advisor Tool Protocol (Claude Platform Standard)

> **Timing guidance:**
> You have access to an `advisor` tool backed by a stronger reviewer model. It takes NO parameters — when you call `advisor()`, your entire conversation history is automatically forwarded.

### When to Consult the Advisor
1. **Early Consultation (Before Substantive Work):**
   - Call after orientation and initial file reads, but *before* making substantive architectural decisions or writing code.
2. **Final Consultation (Before Declaring Done):**
   - Call after code changes are durable on disk and test suites are passing, before presenting final completion.
3. **When Stuck / Pivot:**
   - Call if errors recur or when considering an alternative approach.
4. **Weight & Transparency:**
   - Give the advice serious weight. If an approach deviates from advisor recommendations, explicitly document the rationale in the report.

---

## Subagent Swarms & Parallelization Law

- **Disjoint File Ownership:** Each squad's prompt must declare an explicit, non-overlapping list of files it owns before launching.
- **Serialized Builds:** Only one squad executes `verify` or builds at a time. Verification runs strictly between waves, never concurrently.
- **No Unapproved Git Mutations:** Never commit, push, rebase, or reset git branches without explicit owner confirmation.
- **Goal & Subgoal Hierarchy:** Each phase is structured into verifiable subgoals with passing test gates.

---

## Non-Negotiable Product Contracts (Binding)

1. **Local-First Forever:** Device is the primary home. Sync is opt-in per wardrobe. No tracking, and no collection a person did not switch on.
   *Amended 2026-08-28 by owner direction:* one exception is admitted, for the alpha and no longer — an **opt-in usage record** (`src/lib/usage.ts`), gated behind a consent panel that shows the exact payload before anything is written. Nothing is buffered before consent. The vocabulary is a closed union: event names from `EVENT_NAMES`, property values numeric, boolean or enum, typed per event — free text cannot reach a payload, and **no sanitiser may be added** to make it safe to try. Never collected: garment names, brands, notes, captions, chat text, category and occasion labels, colours, photographs or derivatives, cost values (tier bucket only), wardrobe names, account names, handles, email. Revocation deletes what was gathered, on the device and on the server. When the alpha ends the collector is removed rather than switched off. See `PLAN.md` #1 and `docs/45-what-almari-records.md`.
2. **No Commerce / Affiliate Incentives:** No shop links, affiliate codes, or sponsored products.
3. **No Shame Mechanics:** Zero red alarm colors on low-wear items; neutral "quiet lately" framing; no guilt messaging.
4. **No Gamification Chrome:** No streaks, confetti, or loss-avoidance penalties. Positive-only milestones.
5. **Lossless Export Forever:** Every data migration must preserve all fields and wear logs.
6. **Brand Tokens & Aesthetics:** Radius 2, iron-gall ink, pattern-cutting paper, sealing-wax carmine (`--wax-carmine`), Fraunces serif mastheads, tabular figures.

