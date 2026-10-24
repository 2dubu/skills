---
name: baton
description: "Turn agreed decisions into a code-grounded implementation handoff."
---

# Baton

Turn agreed requirements into a design and tasks grounded in the current code.
Produce a `HANDOFF.md` that an implementation model can use alongside the
repository without reading the earlier conversation. Expose unresolved decisions
and reduce guesswork during implementation. Do not promise that a less capable
model will succeed or switch models automatically.

Write the handoff document and all user-facing output from this skill in English,
including questions, progress updates, the final summary, and the copyable
implementation prompt. Preserve code identifiers, paths, commands, and source
literals that must remain exact.

## Inputs and Scope

- Prioritize the latest decisions in the current conversation and specifications
  identified by the user. Prior use of `interview-me` or `grill-me` is optional
  when agreed requirements are already available.
- Distinguish decisions, proposals, facts verified in code, and unverified
  assumptions. Do not promote an unconfirmed proposal to an agreement or repeat
  questions the user has already answered.
- Resolve missing or conflicting information from relevant code and supplied
  materials first. If a remaining decision materially affects behavior, scope,
  compatibility, or design, ask one question at a time. Continue independent
  investigation while waiting and identify tasks that depend on the answer.
- Limit this skill to investigation and writing a local handoff document. Do not
  modify product code, tests, or configuration; install dependencies; create
  branches; or create commits, pushes, pull requests, or tickets. If implementation
  is separately requested, follow that request's scope as a separate activity.

## Derive the Design from the Code

Read applicable repository instructions first and follow the rules for the
relevant paths. Keep the current checkout and investigate only what the task needs.

- Record the repository or workspace location, the baseline commit when
  available, and local changes the design depends on. Identify any local changes
  that must be present when implementing in another environment.
- Trace entry points through relevant implementations, interfaces, callers, and
  registration or assembly sites. Read nearby implementations and tests to
  understand responsibility boundaries and verification conventions.
- Cite file paths and symbols as evidence. Clearly distinguish existing behavior
  from planned modifications and additions. Do not describe nonexistent APIs or
  files as if they already exist.
- Specify the interfaces, data flow, state transitions, and failure and
  cancellation behavior needed for the task. Make public contracts and key
  invariants explicit without fixing every coding choice covered by existing
  conventions or writing the entire implementation in advance.
- Do not present unverified platform behavior or external contracts as facts.
  Identify the investigation or experiment needed, the affected tasks, and
  whether the uncertainty blocks implementation. If investigation shows that an
  agreed decision is infeasible, explain the conflict with evidence and present
  viable alternatives.
- Derive verification commands and environment requirements from actual
  instructions, scripts, and test configuration. Creating the document does not
  require running every build or test. Follow repository procedures when baseline
  checks are needed, and distinguish checks performed from their results.

## Write HANDOFF.md

Use the path specified by the user. Otherwise, place `HANDOFF.md` in the existing
directory for task documents, or at the repository or workspace root if no such
convention exists. Update a document for the same task, but never overwrite another
task's `HANDOFF.md`. If task-specific directories cannot resolve a collision,
confirm the path. Keep the document local; do not commit it or change ignore rules.

Include the following content at a level of detail appropriate to the task. Do not
expand scope to fill irrelevant sections or leave an empty template. Reference
shared repository rules instead of copying them, while keeping this task's key
constraints and decisions in the document itself.

| Content | Guidance |
| --- | --- |
| Goal and scope | Describe behavior to change, behavior to preserve, exclusions, and decision rationale. Assign requirement IDs such as `R1`. |
| Baseline and code evidence | Record the checkout baseline, required local changes, instructions to read, relevant files and symbols with their roles, and existing implementations to follow. |
| Implementation design | Map requirements to code changes and explain responsibilities, contracts, flow, and important exceptions. Distinguish existing, modified, and new elements. |
| Verification criteria | Use IDs such as `V1` for observable inputs, actions, and expected results, linked to requirements. Include procedures, environment prerequisites, and manual checks. |
| Task list | Include an ID such as `T1`, requirements covered, prerequisites, where and how to make changes, completion conditions, and verification IDs. |
| Open issues and start conditions | Identify unresolved decisions, unverified assumptions, and affected tasks. Separate tasks ready to start from blocked tasks. |
| Implementation prompt | Write a prompt to paste into a fresh session, including the actual document path and repository location. |

Break work into tasks whose outcomes can be verified individually. Add only
necessary foundational changes as prerequisites. Do not divide work mechanically
by file or layer, or assume every task can run independently. Flag tasks that still
require difficult judgment, such as concurrency or recovery behavior. Do not claim
that underspecified tasks are ready for a less capable model.

Write verification criteria that establish whether the implementation satisfies
the requirements. Reuse existing tests and distinguish required regression tests
from manual and integration checks. Never describe planned verification as passed;
record why any checks could not be performed.

The implementation prompt must clearly instruct the implementer to:

- Read repository instructions and the handoff, then recheck the code baseline,
  interfaces, and required local changes.
- Implement ready tasks in dependency order within the user's authorized scope,
  and verify the results.
- Resolve routine coding choices using existing conventions. If the specification
  conflicts with the code, or agreed behavior, compatibility, or responsibility
  boundaries must change, stop the affected task and report the evidence.
- Never weaken requirements or verification criteria arbitrarily. Report completed
  tasks, changed files, checks performed and their results, and remaining
  limitations. The handoff does not grant additional authorization.

## Review Before Delivery

Review from the perspective of an implementer who has only the document and the
repository. Check that referenced paths and symbols exist, planned additions are
clearly identified, every requirement maps to tasks and verification, and task
dependencies have no cycles or missing prerequisites. Look for conflicts among
decisions, design, and tasks within the document as well as across documents.

Document confirmed portions even when decisions remain unresolved, and identify
what can start. Distinguish readiness for implementation from verified code
behavior. Finish with a concise summary containing the document path, tasks ready
to start, remaining decisions or verification limits, and the implementation prompt
to paste into a fresh session.
