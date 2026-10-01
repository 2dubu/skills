---
name: pr-feedback
description: Collect existing feedback on GitHub pull requests, including comments and reviews, then triage remaining actions with source links.
---

# PR Feedback

Produce an actionable view of the feedback on a specific PR. This is read-only unless the user separately requests fixes, replies, or thread resolution.

## Collect the full conversation

1. Prefer an explicit PR URL or number. Otherwise resolve the PR for the current branch in the actual repository. Record the owner, repository, PR number, base and head SHA, and retrieval time. Clarify if several PRs plausibly match.
2. Fetch every page of the PR conversation comments, inline review comments, and review summaries. With `gh api`, these are `repos/{owner}/{repo}/issues/{number}/comments`, `pulls/{number}/comments`, and `pulls/{number}/reviews`. Use `--paginate --slurp` and retain IDs, authors, timestamps, URLs, review state, and current/original code positions.
3. Fetch GraphQL `repository.pullRequest.reviewThreads` with `isResolved`, `isOutdated`, path and line positions, and comment replies. Paginate the threads and each thread's comments independently; a complete first page of threads does not guarantee complete replies. REST comments alone do not establish resolution state.
4. Recheck the PR head after collection. If it changed, refresh the affected data or clearly label the result with the revision it describes. If access, pagination, or an API fails, name the missing data rather than treating it as an empty conversation.

## Triage

- Read replies before deciding whether an action remains. Separate unresolved actionable feedback, questions awaiting an answer, resolved threads, and historical feedback.
- Outdated means the code location changed, not that the issue was fixed. Compare the concern with the current code when available; otherwise mark its applicability uncertain.
- Preserve review history, but distinguish the latest submitted review per author from prior requests, dismissals, and approvals. An unresolved thread and the current approval state answer different questions.
- Merge repeated bot or human reports of the same issue into one action, retaining their source links. Do not merge distinct issues solely because they share a file.
- Prioritize concrete blockers and correctness risks over suggestions. Keep the author's stated severity separate from your assessment; do not invent a blocker from ambiguous language.

## Output

Lead with remaining actions, ordered by priority. For each, include the author, a direct comment/thread URL or ID, path and current/original line when relevant, whether it applies to the recorded head, and the concrete change or answer needed.

Summarize resolved and historical feedback briefly, then list open questions and collection gaps. If nothing remains, distinguish "no actionable feedback found" from "all threads resolved" and only claim either when the collected evidence supports it. Do not edit code, reply, resolve threads, or post a review as part of collecting comments.
