# Code Review Checklist

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="code-review-checklist robot" width="200">
</div>

A repeatable pass order for reviewing someone else's pull request, so that a tired reviewer finds the same defects as a fresh one.

## What it does

This skill turns pull request review into a fixed sequence of single-concern passes with explicit verification steps, instead of one mixed read from the top of the diff.

- **Fixes the order.** Intent, then correctness, then security, then tests, then naming and style. Each pass looks for one class of defect, because mixed passes spend attention on the easy-to-see style problems and miss the logic bug.
- **Starts outside the diff.** The description, the ticket, the file list, and the test diff are read before any implementation, so scope creep and wrong-requirement implementations surface in the first two minutes.
- **Verifies instead of reading.** Tests are run with the implementation removed to prove they fail without it. Callers of changed signatures are listed with a search rather than trusted to the diff. Similar blocks are compared with a diff tool rather than by eye.
- **Checklists the absences.** Error paths, null and empty cases, rollback, migration ordering, config, telemetry. A diff renders what was written and nothing renders what was skipped, so absent code needs a list rather than attention.
- **Covers the boundaries a diff hides.** Concurrency and transaction scope, copy-paste divergence across siblings, backward compatibility for API responses and schemas, and the commit history behind the squashed view.
- **Ends with a verdict rule.** Approve with comments, request changes, or stop commenting and pair in person, with a stated scope of what went unreviewed.

The output is a bounded review: the same checks in the same order every time, each one either passed or turned into a located comment.

## When to use this

Load this skill when:

- You have a pull request assigned and want a pass order rather than an opinion.
- A diff is large enough that you will run out of attention before you run out of lines.
- The change touches migrations, transactions, background jobs, or a public API, where the damaging defects are in the absences.
- You have approved something that later broke, and you want the check that would have caught it.
- A review has reached its third round and you need the rule for when to stop commenting.
- You are new to a codebase and need a procedure that does not depend on knowing the system well.

Do not use it for:

- Writing the comments themselves. Wording, severity labels, and the comments not worth making live in `../code-review`.
- Reviewing your own branch before requesting review. That is the self-review pass in `../code-review`.
- Formatting and lint disputes. Configure the tool instead.

## Quick start

A pull request titled "fix timeout handling in the sync worker".

**Pass 0, intent, before opening the diff.**

```bash
gh pr view "$PR" --json title,body,files --jq '.title, .body, (.files[].path)'
```

The file list includes `billing/invoice.py`. That is not timeout handling, and it is the first comment: ask for a split, because nobody has reviewed it against a stated goal.

**Pass 0b, read the tests first.**

```bash
gh pr diff "$PR" -- 'tests/**'
```

Tests cover a timeout on attempt one and attempt two. Nothing covers the third attempt also failing. Note it; comment in pass 3.

**Pass 1, correctness and callers.**

```bash
gh pr diff "$PR" | grep -E '^\+.*(def |class |async def )'
rg -n 'retry_with_backoff' --type py
```

`retry_with_backoff` gained a `cap` parameter and now returns `None` instead of raising. Three call sites exist; the diff updates one. Trace one concrete input: three timeouts returns `None`, `worker.py:110` reads `result.id`, and that is an `AttributeError` on the exact path this change claims to fix.

**Pass 1b, transactions.** The new retry wraps a call that runs inside an open transaction. Confirm every early return commits or rolls back, and that a retried attempt does not re-apply a side effect.

**Pass 2, security and logs.** The new failure log prints the full job payload. Ask for the identifiers only.

**Pass 3, verify the tests fail without the change.**

```bash
git stash
pytest tests/test_retry.py -x   # expect failures
git stash pop
```

Two of the three new tests still pass with the implementation removed. They assert on the mock, not on the behavior.

**Pass 3b, absences.** No test for the exhausted-retry path, no metric for the new failure mode, no rollback path in the migration that adds `attempt_cap`.

**Pass 4, naming.** `cap` reads as a count next to `max_attempts`. One nit, closable.

**Close.**

```bash
gh pr review "$PR" --request-changes --body "Blocking on the two unupdated
callers of retry_with_backoff. Reviewed the retry logic, worker call path,
and the migration. Did not review the billing change; please split it."
```

## Key concepts

**One concern per pass.** Style defects are easier to see than logic defects, so a single mixed read spends its freshest attention on the cheapest findings. Separate passes force the expensive search to happen while attention is still available.

**Intent before implementation.** The title, description, ticket, file list, and test diff are all readable before the first line of implementation, and all of them constrain what a defect even means. A correct implementation of the wrong requirement passes every automated check.

**Verification over reading.** Reading confirms plausibility. Running the tests with the implementation stashed, searching for callers, and diffing two similar blocks confirm facts. Every pass in this skill has at least one step you execute rather than skim.

**Absent code is invisible.** A diff has no rendering for the error path nobody wrote, the migration with no down step, or the failure mode with no metric. The only defense is a fixed list walked every time, which is why the absence checklist is enumerated rather than left to judgment.

**Trust boundaries, not function boundaries.** Security defects look correct locally. They are wrong only relative to where untrusted input entered, so the security pass follows values from the request edge instead of reading lines in order.

**Version skew is a review concern.** During a rollout, two versions of the code read the same database, queue, and cache. Schema and payload changes must be tolerable to the version still running, which is what expand, migrate, contract buys.

**History is evidence.** The squashed diff shows the final state. The commit sequence shows the workaround added in one commit whose cause was removed in another, and the secret committed then deleted but still in history.

**Verdicts are calibrated signals.** Request changes means correctness, security, data loss, or an unchangeable interface. If most reviews request changes, the verdict has stopped carrying information and authors start ignoring it.

## Common pitfalls

**Counting tests instead of verifying them.** A test that passes with the implementation removed asserts nothing, and no coverage number reveals it.

Bad:

> Coverage is at 88%, looks good.

Good:

> The three new cases in `test_retry.py` still pass with `retry.py` stashed. They assert `mock_sleep.called` rather than the returned value, so they would not catch the `None` return added here.

**Reading similar blocks in sequence rather than diffing them.** Eyes confirm similarity and skip the one flipped comparison.

Bad:

> These two handlers look consistent to me.

Good:

> `invoices.ts:112` uses `>=` where `orders.ts:57` uses `>`. If that is intentional the copied comment above it is now wrong; if not, invoices accepts one more item than orders.

**Treating the file list as noise.** Unrelated files in a focused PR are a second, unreviewed change riding along. Ask for a split before reviewing 600 lines, not after.

**Approving a schema change without the deploy order.** A column drop that the currently running version still selects is an outage for the length of the rollout, and it is invisible in a diff that only shows the new state.

**Skipping the transaction boundaries because the happy path is clean.** Rollback defects only appear on the error path, which is the path with no test.

**Accepting a log line because it helps debugging.** Logs are readable by more people than the database and outlive the code, so a payload dump is a data exposure even when the intent was diagnostic.

**Letting a disagreement run past two rounds.** Three rounds of comments on the same point is a design conversation being held one comment at a time. Move it to a call.

**Vague closing verdicts.** "Looks mostly fine, a few concerns" leaves the author guessing whether they can merge. State the blocking item, state what you did not review, and let the nits be nits.

**Leaving the unreviewed part unsaid.** Silence reads as coverage. If you did not read the Terraform or the generated client, say so, so someone else can.

## See also

- `SKILL.md` in this directory, for the full pass order including the concurrency, copy-paste, and backward-compatibility sweeps.
- `../code-review`, for the other half: comment wording, the `blocking` / `should-fix` / `nit` vocabulary, and the self-review pass on your own branch.
- `../test-strategy`, for deciding what the missing test found in pass 3 should actually be.
- `../database-design`, for the expand, migrate, contract pattern behind the migration ordering checks.
- `../api-design`, for judging whether a response or request change in pass 3d is genuinely breaking.
- `../debugging`, for when a review finding turns into a real bug hunt instead of a comment.
- `../../security/security-audit`, for a pass 2 finding that needs a deeper look than an inline comment.
- `../../devtools/git-workflow`, for keeping diffs small and single-purpose so the full pass order fits in one sitting.
