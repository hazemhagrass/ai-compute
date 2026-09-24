---
name: autonomous-task
category: workflow
description: "Use when a long task must proceed uninterrupted. Running for hours with the user away: plan files, checkpoints, parallel subagents, incremental commits, no questions."
---

# Autonomous Task

Run for hours while the user is away. No one is present to answer questions,
approve steps, or unstick errors. Every rule below assumes that absence.

## Before starting

- Agent config already has `max_turns: 0` (unlimited turns). Do not re-check
  it or ask the user — it is set.
- Write a plan file first, before any other action:
  `<workspace>/plan.md` with numbered, independently-committable items, each
  with: what "done" means, the files it touches, and its verification command.
  Everything later (subagent spawn, checkpoints, status %) keys off this file.
- Load `todo_list` and create one item per plan item. Tick items off as they
  complete — the todo list is the live plan; the file is the durable one.
- Split the plan into independent vs. sequential items. Independent items go
  to parallel subagents via `delegate_task`; sequential items you run yourself.
- Fix the commit cadence up front: push every N completed items (default N=3).
  Work that is not pushed does not survive a crash.

## Parallel subagents

- Spawn one `delegate_task` per independent item. Give each: the exact task
  text, the files it owns, its verification command, and where to write
  progress (`<workspace>/status/<item-id>.md`). If two subagents touch the
  same files you get merge conflicts, so partition files before spawning.
- Spawn per item, not per batch. A subagent that fails mid-batch loses the
  whole batch; a single-item failure is cheap to retry.
- When a subagent reports completion, verify before counting it: read the
  files it claims to have written and run its verification command yourself.
  A subagent's "done" is a claim, not a fact.
- Include an item in a commit only after you verified it yourself.

## Checkpointing and commits

- After each item, append one line to `<workspace>/progress.md`:
  timestamp, item id, done/blocked/failed, one-line result. This file is what
  you resume from after any restart.
- Commit and push every N items (default 3), with messages naming the items:
  `feat: items 2-4 — auth flow, session cache, e2e tests`. Push, don't just
  commit — the local disk is one of the failure modes you survive.
- Never commit code that fails its own verification "to fix later". A crash
  mid-run must leave a branch that builds and passes as of the last push.

## Errors and rate limits

- Rate limit (429/5xx): wait at least 60s, then retry with exponential
  backoff (60s → 120s → 240s → cap at 15m). Do not retry in a tight loop —
  it resets or worsens the limit — and do not abandon the item on the first
  refusal.
- Subagent spawn failure: retry once with the same prompt, then run the item
  yourself. A stuck subagent never blocks the whole run.
- A tool or test failure on one item: mark it failed in `progress.md`, move
  on to the next independent item, retry the failed one after the batch.
  Blocked ≠ stopped.
- Only an error that corrupts already-committed work stops the run.

## Never do these

- Do not ask clarifying questions. A question is a total stop while the user
  is away. Pick the interpretation a reasonable engineer would pick, and
  record the assumption in `progress.md` and the final report.
- Do not wait for approval on work the original task already authorizes. The
  task IS the authorization. Work genuinely outside its scope is skipped and
  logged, not attempted and not asked about.
- Do not stop on non-critical errors: lint warnings, one flaky test, an
  unreachable docs page, a failed optional step. Log it, continue, fix or
  report it later. Critical means committed work may be wrong.
- Do not trust reported completions. For every "done": read the actual files,
  run the actual commands, confirm the actual output. "Tests pass" means you
  saw the pass line, not that someone said so.

## Status reporting

- Update the session title after every item, not just at milestones:
  `Task: auth migration 63% (5/8 items)`. The user checking in from a phone
  sees the title first; a stale title reads as a stalled run.
- In subagent activity descriptions, state the item being worked and the
  verification that will prove it done.
- The user can see commits for the rest — do not narrate small progress in
  messages.

## Finishing

- Run the full verification once at the end even if you verified each item
  piecewise — integration is where pieces conflict.
- Write `<workspace>/final-report.md`: completed items with their commits,
  failed items with reasons, skipped items, assumptions made without the user.
  This is the first thing the user reads on return.
- Set the session title to `Task: <name> — DONE 100%` or
  `Task: <name> — partial X% (2 items blocked)`.
- Push everything. An unpushed final commit is work the user cannot see.

## Resume protocol

Starting work and `progress.md` already exists? Read it before touching
anything. Skip items marked done and verified; redo items marked done without
a verification record; pick up at the first incomplete item. Never restart a
long run from scratch when the checkpoint says it is half done — plan items
are the unit of resumption.

## Counter-examples

- Vague: "checkpoint progress regularly."
  Actionable: append a timestamped line to `progress.md` after every item,
  and push commits every 3 items.
- Vague: "handle errors gracefully."
  Actionable: on 429 wait 60s then back off exponentially; on any other
  single-item failure, log it and move to the next independent item.
- Vague: "report status."
  Actionable: session title `Task: auth migration 63% (5/8 items)` after
  every item.
