---
name: make-pr-easy-to-review
description: Make pull requests easier to review by clarifying descriptions, guiding reviewers through changes, and organizing commits.
---

# Make PR Easy to Review

Help a reviewer understand the problem, resulting behavior, important files, and risk. Prepare concrete text and a history plan before requesting any missing authorization.

## Inspect and propose

- Resolve the target PR and actual local repository. Read repository instructions and branch conventions. Record the PR's base/head repositories, branch names and SHAs, local `HEAD`, remote URLs, and working-tree/index state. A fork's head branch may not exist on `origin`.
- Read the commits and final diff. Identify stale descriptions, unrelated changes, mixed mechanical and semantic changes, unclear dependencies, and missing evidence. Inspect generated files rather than assuming they are unimportant.
- Draft a description that leads with the concrete problem and resulting behavior. Add reviewer entry points, significant tradeoffs, risks, and actual validation. Follow the repository template. Prefer splitting an oversized or unrelated change to explaining around it.
- Group commits by coherent changes in dependency order. Keep tests with the behavior they verify when that makes each commit understandable; do not impose a tests-last sequence.

Editing the remote description, posting guidance, rewriting history, and pushing require the corresponding user authorization. Use authorization already given. A general reviewability request permits local inspection and drafts, not an unrequested force-push.

## History changes

Before an authorized rewrite, verify that the checkout represents the intended PR head and that no unrelated working-tree or index changes will be included. Resolve and fetch the head and base from their actual repositories. Do not silently switch branches, reset, or stash someone else's work.

Save the original commit, its tree, and the current remote head SHA separately. Create a persistent backup ref pointing to the original commit; choose a unique name and refuse to overwrite an existing backup. A tree SHA alone cannot restore commit history.

For a pure regrouping or squash, verify content identity with an actual failing check before pushing:

```sh
original_commit=$(git rev-parse HEAD)
original_tree=$(git rev-parse "$original_commit^{tree}")
backup_ref="refs/backup/pr-review/$(date -u +%Y%m%dT%H%M%SZ)-$original_commit"
git update-ref "$backup_ref" "$original_commit" ""  # create only; run before rewriting
# Perform the agreed rewrite, preserving requested per-commit authors and hooks.
test "$(git rev-parse HEAD^{tree})" = "$original_tree" || exit 1
```

Inspect the rewritten commits and diff as well. If the plan intentionally rebases onto a changed base, tree equality is not an appropriate proof: review the resulting diff, resolve conflicts within scope, and run relevant checks for any changed behavior. Report that distinction explicitly.

## Publishing an authorized rewrite

Read and save the remote branch SHA from the verified head repository before rewriting. Immediately before pushing, check that it still equals the saved SHA. If someone else updated it, stop and reconcile rather than refreshing the lease to overwrite their work.

Use an explicit lease bound to that saved SHA:

```sh
git push --force-with-lease="refs/heads/$head_branch:$expected_remote_sha" \
  "$head_remote" "HEAD:refs/heads/$head_branch"
```

Here `head_remote`, `head_branch`, and `expected_remote_sha` must come from the verified PR head repository, branch, and pre-rewrite remote state. Never substitute a guessed `origin` branch or use bare `--force`.

Verify the remote SHA and GitHub PR head after pushing, then inspect checks and review state for that revision. A successful push does not establish CI success or approval. Report the backup ref, content verification, remote changes made, and any remaining validation gaps. Do not conceal behavior changes inside history cleanup.
