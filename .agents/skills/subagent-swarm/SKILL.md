---
name: subagent-swarm
description: Operational manual for coordinating parallel subagent swarms, declaring disjoint file ownership, managing wave transitions, and executing goal-directed roadmap tasks.
---

# Subagent Swarm Orchestration

This skill defines the operational framework for executing complex development sprints with parallel subagents in Antigravity and Claude Code.

## 1. Disjoint File Ownership Law

Before launching any wave of subagents:
- **Explicit Declaration**: Every squad's prompt must contain a strict, non-overlapping list of file paths that only that squad is permitted to create or modify.
- **Example Squad Breakdown**:
  - `SHARED-CORE`: `packages/shared/**`
  - `UI-ANALYTICS`: `src/pages/Statistics.tsx`, `src/components/Stats/**`
  - `UI-CLOSET`: `src/pages/Closet.tsx`, `src/components/PackingListModal.tsx`
  - `QA-SUITE`: `scripts/test-*.mjs`, `__tests__/**`
- **Zero Collision Guarantee**: Two subagents must never write to the same file in the same wave.

## 2. Serialized Build & Verification

- Subagents in a wave do **not** run conflicting build commands on the shared working tree.
- Verification (`npm run verify`, `tsc -b`, unit test suites) is executed strictly at **wave boundaries** by the lead agent or dedicated QA squad.

## 3. Goal & Subgoal Hierarchy

1. **Phase Milestone**: High-level capability goal (e.g. "Phase 3: Centralized Analytics & Packing").
2. **Subgoals**: Specific, testable units of work.
3. **Acceptance Criteria**: A subgoal is marked complete only when its designated test check passes.

## 4. Advisor Integration in Swarms

- The lead agent invokes the advisor before dispatching a wave of subagents to validate decomposition and file boundaries.
- After all subagents in the wave complete their work and the verification suite runs green, the advisor is consulted for a final review before committing progress.

