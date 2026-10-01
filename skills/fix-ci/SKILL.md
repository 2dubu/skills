---
name: fix-ci
description: Diagnose failing CI checks on GitHub pull requests and apply focused local fixes. Distinguish code issues from flaky tests and infrastructure failures.
---

# Fix CI

Find the actionable failure, correct its cause, and verify at the appropriate level.

## Establish the failing revision

- Resolve the requested PR in the actual repository. Compare its head SHA with local `HEAD` and the failing run's commit. Inspect working-tree and index changes before editing.
- Use `gh pr checks "$pr" --repo "$owner/$repo" --json name,bucket,state,workflow,link` with the resolved target to discover checks. Inspect required checks separately with `--required` when configured. For GitHub Actions, inspect the concrete run and failed job logs; for external checks, follow the provider link or report that logs are unavailable.
- Do not modify current code to fix an obsolete run. Reconcile the checkout and run revision first without discarding or stashing unrelated work.

## Diagnose and fix

1. Extract the first actionable error, its failing command, and the relevant log context. Distinguish the root failure from downstream cancellations or cascaded errors.
2. Classify the cause: deterministic code/test failure, flaky test, build or dependency configuration, infrastructure outage, or authentication/permissions/secrets. Reproduce locally when practical. Avoid changing product behavior to mask an infrastructure or credentials failure.
3. Apply the smallest justified local fix and run checks that exercise the affected contract. Preserve unrelated changes and hooks. Do not weaken tests, remove required checks, or add blanket retries merely to obtain green status.
4. Review the resulting diff. Local checks establish local evidence; they do not establish that the PR CI passed.

## Remote iteration

Commit, push, rerun/cancel jobs, and modify remote CI settings are separate actions. Continue them when the user has already authorized them; otherwise finish the local fix and verification, then identify the exact next action that needs authorization.

After an authorized push or rerun, inspect checks for the new PR head and confirm the failing job actually ran against it. Retry only when a new hypothesis, new evidence, or an identified transient failure justifies it. If the same failure recurs without new evidence, or progress requires permissions or external recovery, stop the loop and report the blocker and next useful action.

## Output

Report the PR and failing revision, root error and evidence, changes made, local verification, and current remote check state. Distinguish passed, failed, pending, skipped, cancelled, and absent checks; state required-check results separately from overall results. Never call an empty check set or a local test pass "CI green".
