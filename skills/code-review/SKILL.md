---
name: code-review
description: Review pull requests and local code changes for bugs, regressions, missing tests, and maintainability issues.
disable-model-invocation: true
---

# Code Review

Review correctness first, then challenge avoidable complexity. Look for designs that remove branches, duplicated state, or unnecessary layers while preserving the intended behavior.

## Scope and mode

- Resolve the requested PR, commit range, branch changes, or uncommitted diff. Record the repository, base and head commits, and included working-tree changes. Use the actual target branch; do not assume `main`.
- Read repository instructions, changed code, and the callers, contracts, and tests needed to assess its behavior. Distinguish existing problems from problems introduced or worsened by the change.
- Default to a read-only review. With `--fix` or an explicit request to fix findings, apply focused local corrections and verify them. Commit, push, and publishing review comments require their own authorization; reuse authorization already given.
- Respect the caller's requested effort level and scope. For a quick pass, prioritize likely regressions; for a deep pass, trace affected boundaries and failure paths. Do not silently broaden a focused review into a codebase rewrite.

## Review priorities

1. **Correctness and regressions.** Check changed control flow, data and type contracts, lifecycle and concurrency, error handling, compatibility, and user-visible behavior. Identify a concrete trigger and consequence for each suspected bug.
2. **Relevant tests.** Check whether tests cover the changed contract and realistic failure or boundary cases. Missing coverage is actionable when it leaves a specific risk unverified; do not demand tests that merely repeat the implementation.
3. **Structural simplicity.** Ask whether existing architecture can eliminate whole branches, modes, helpers, or intermediate state. Prefer removing complexity over distributing it across more files.
4. **Boundaries and abstractions.** Challenge feature-specific checks in shared paths, duplicated canonical helpers, casts or optionality that conceal an invalid contract, and wrappers that add indirection without isolating complexity.
5. **Growth and legibility.** Inspect large files, nested branching, scattered state updates, and misleading names. A file crossing 1,000 lines is a prompt to inspect cohesion, not an automatic blocker. Recommend decomposition around real responsibilities rather than arbitrary line counts.

For a maintainability finding, explain the concrete cost: repeated changes across paths, invalid states, an unclear ownership boundary, or a flow that is materially harder to verify. Show a feasible simpler approach and its tradeoff. A merely plausible alternative design is not enough to block a change.

Keep broader architecture opportunities separate from findings that the current change should fix. Preserve behavior when restructuring; do not bundle speculative refactors into `--fix`.

## Findings and verification

Follow a caller or repository's review format when provided. Otherwise report findings in priority order with:

- Severity and a concise title.
- A precise path and the smallest useful line range in the reviewed revision.
- The triggering case, resulting impact, and evidence from code, tests, or a reproduction.
- A focused remedy; include alternatives only when the choice matters.

Be direct about substantial problems. Prefer a few supported findings over cosmetic nits or a finding quota. State uncertainty as a question when the available evidence does not establish a defect.

After fixes, review the resulting diff and run checks appropriate to the affected contract. Report what was checked, baseline failures, and remaining gaps. Distinguish static inspection, local test results, CI, and device or manual validation. If there are no actionable findings, say so and identify material limits of the review.
