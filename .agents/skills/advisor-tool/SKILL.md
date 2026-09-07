---
name: advisor-tool
description: Implementation and operation of the Claude Advisor Tool pattern for Antigravity, including timing guidance, pre-execution consultation, and post-verification review.
---

# Claude Advisor Tool Protocol

This skill operationalizes Anthropic's Advisor Tool architecture for pair-programming and autonomous agent workflows.

## System Prompt Timing Guidance

For coding and complex agentic tasks, prepend this block to the executor's instructions:

```markdown
Timing guidance: You have access to an advisor tool backed by a stronger reviewer model. It takes NO parameters — when you call advisor(), your entire conversation history is automatically forwarded.
```

## When to Call the Advisor

### 1. Early Consultation (Orientation & Planning)
- **Trigger**: After reading the task description and completing initial exploratory file reads.
- **Purpose**: Verify assumptions, validate architectural boundaries, check non-negotiables, and confirm the proposed approach before writing code.
- **Advisor Input**: The full conversation trajectory is forwarded. Focus on plan feasibility, missing edge cases, and consistency with design contracts.

### 2. Intermediate Consultation (When Stuck or Pivoting)
- **Trigger**: When an approach encounters unexpected roadblocks, test suite failures recur, or a significant change in strategy is contemplated.
- **Purpose**: Get a fresh, un-anchored perspective to resolve ambiguities or avoid local minima.

### 3. Final Review (Pre-Completion)
- **Trigger**: Once all code changes are written to disk, builds succeed, and all verification test suites pass.
- **Purpose**: Quality assurance check against regression risks, missing edge cases, brand law compliance, and documentation completeness.

## Handling Advisor Feedback

- **Give Advice Serious Weight**: The advisor model brings high-level reasoning and broader context.
- **Explicit Conflict Surfacing**: If you diverge from the advisor's recommendation, state the exact reason in your progress report rather than silently ignoring it.

