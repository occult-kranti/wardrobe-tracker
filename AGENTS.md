# AGENTS.md — Almari / Toile Root Agent Guidelines

## 1. The Advisor Discipline (Claude Platform Standard)

> **Timing guidance:**
> You have access to an `advisor` tool backed by a stronger reviewer model. It takes NO parameters — when you call `advisor()`, your entire conversation history is automatically forwarded.

- **Early Consultation**: Consult after exploratory reads and before starting substantive coding or design modifications.
- **Final Consultation**: Consult after making changes durable on disk and verifying all test suites, before declaring done.
- **When Stuck**: Consult if tests fail repeatedly or when changing strategic approach.
- **Weight**: Treat advisor recommendations with high priority. Document any intentional trade-offs.

## 2. Multi-Agent Swarm Laws

- **Disjoint File Ownership**: Before any wave of subagents begins, declare the explicit list of non-overlapping files each squad owns.
- **Sequential Build Gates**: Squads do not run builds in parallel on a single working tree. Verification (`npm run verify`) runs between waves.
- **Safe Environment**: Always execute Python scripts within `.venv`.
- **Immutable Git History**: No commits or branch manipulations without explicit owner instruction.

## 3. Product Principles (Non-Negotiable)

- **Local-First**: Local storage & IndexedDB are primary; cloud sync is opt-in per wardrobe.
- **No Silent Collection**: The device reports nothing about a person unless that person turned it on. PLAN.md #1 was amended 2026-08-28 to admit exactly one exception, and only for the alpha: an **opt-in usage record** (`src/lib/usage.ts`). A tester is asked once, in a panel showing the exact payload; nothing is buffered before consent. Its vocabulary is a closed union of event names with numeric, boolean and enum properties — no free text can reach a payload, and **no sanitiser may ever be added**, because a sanitiser is what you build when user text *can* get in. Never collected: garment names, brands, notes, captions, chat text, category and occasion labels, colours, photographs, cost values (a tier bucket only), wardrobe or account names, handles, email. Off is destruction, here and on the server. The collector is removed when the alpha ends, not disabled. Full account: `docs/45-what-almari-records.md`.
- **Anti-Shame**: Factual neutral analytics ("quiet lately"), no red alarms, no streak anxiety.
- **Honest AI**: Clear model disclosures, explainable styling rationale, no hidden sponsored recommendations.

