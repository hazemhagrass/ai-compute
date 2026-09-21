---
name: code-review-checklist
description: "Use when reviewing a PR. Run fixed single-concern passes. Order them intent, correctness, security, tests, absences, then style, and verify each test fails without the change."
---

# Code Review Checklist

A checklist exists so that a tired reviewer finds the same defects as a fresh
one. This is the mechanical pass order for someone else's pull request: what to
open, in what order, and what to verify by running something rather than by
reading. For comment wording and severity labels, use `../code-review`; this
skill covers only the sequence and the verification steps.

## Run the passes in this order, one concern at a time

- Do pass 0 (intent) before opening the diff. You cannot judge correctness
  against a goal you have not read, and every later pass depends on knowing
  what the change is supposed to do.
- Do pass 1 (correctness) alone, with no eye on naming. Mixed passes cost you
  the logic bug, because style defects are easier to see and consume the
  attention budget first.
- Do pass 2 (security) as a separate sweep over the same lines. Security
  defects look correct; they are only wrong relative to a trust boundary, and
  you have to be looking for the boundary to see it.
- Do pass 3 (tests) before pass 4 (naming and style). A missing test is a
  merge risk; a mediocre variable name is not.
- Write comments as you go, but submit them in one batch. Drip-feeding
  comments over an hour makes the author rebase against a moving target.
- Never start a pass you do not have time to finish. Half a security pass that
  you do not disclose reads to the author as a completed one.

## Pass 0: intent, before any code

- Read the title, description, and linked ticket first, then state the claim in
  one sentence to yourself. Everything you find later is measured against that
  sentence.
- List the changed files before reading any of them. The file list alone
  exposes scope creep, and it is cheaper to ask for a split now than after you
  have reviewed 600 lines.
- Read the test diff next, not the implementation. Tests are the author's
  executable claim about the contract, and the edge cases they omit tell you
  where to look.
- Comment immediately if the description is missing or does not match the file
  list. Reviewing a diff with an unstated goal produces opinions, not findings.

```bash
gh pr view "$PR" --json title,body,files --jq '.title, .body, (.files[].path)'
gh pr diff "$PR" -- 'test*' 'tests/**' '**/*_test.*' '**/*.test.*'
```

## Pass 1: does it do what the title claims, and nothing more

- Trace one realistic input end to end through the changed code. Reading
  verifies plausibility; tracing verifies behavior, and only the second one
  finds the bug.
- Check every changed function against the claim. Any behavior change the
  description does not mention is either an unreviewed second change or a
  mistake, and both need a comment.
- List the callers of every changed signature, default, or return shape
  yourself. The diff shows the ones the author remembered, not the ones they
  forgot.
- Re-read any line the author moved rather than wrote. Moved code shows as
  added and deleted, and a one-token edit inside a moved block is nearly
  invisible.

```bash
gh pr diff "$PR" --name-only                  # scope check
git log --oneline "origin/main..$BRANCH"      # per commit intent
rg -n 'retryWithBackoff' -g '!node_modules'   # callers the diff missed
```

## Pass 1b: concurrency and transaction boundaries

- Ask, for every new shared read followed by a write, what happens if two
  requests interleave. Check-then-act on a row, a counter, or a cache entry is
  a race unless something holds a lock.
- Trace where each transaction opens and closes. A network call inside a
  transaction holds a database connection for the duration of someone else's
  outage.
- Check that every early return and every thrown exception inside a transaction
  leaves it committed or rolled back. Missing rollback paths leak connections
  until the pool dies, and no test with a happy path will catch it.
- Confirm retries are idempotent. A retried request that charges a card twice
  is a correctness bug introduced by a reliability feature.
- Check that locks are acquired in a consistent order across the codebase. Two
  call sites taking the same pair of locks in opposite orders is a deadlock
  waiting for load.

## Pass 2: security and data exposure

- Follow every new value that comes from a request into a query, a shell, a
  path, a template, or a deserializer. Trust ends at the request boundary, not
  at the function boundary.
- Check that the tenant or user identifier comes from the session, not the
  request body. A body-supplied scope is a cross-tenant read that passes all
  the tests.
- Compare the new route against its sibling routes for authorization. Checks
  are usually present on the route someone thought about and absent on the one
  added later.
- Read every new log line and error message for secrets, tokens, full request
  bodies, and personal data. Logs outlive the code and are readable by more
  people than the database.
- Require that error messages name an action. "Operation failed" produces a
  support ticket; "upload rejected: file exceeds 25 MB" produces a fix.

Bad log line:

```python
logger.info("auth attempt %s", request.json)   # dumps the password
```

Good log line:

```python
logger.info("auth attempt user=%s ip=%s result=%s", user_id, ip, result)
```

## Pass 3: tests, verified rather than counted

- Verify each new test fails without the change. A test that passes on both
  sides of the diff asserts nothing, and this is the single highest-value
  check in the whole review.
- Read the assertions, not the test names. `assert result is not None` under a
  name like `test_rejects_expired_token` tests nothing about expiry.
- Require a test for the error path of every new branch. Happy paths get tests
  by habit; error paths get tests only when someone asks.
- Reject tests that assert on mocks alone. Asserting that a mock was called
  verifies the test's own wiring, not the system's behavior.
- Cite the untested branch by name instead of a coverage percentage, because a
  number tells the author nothing about what to write.

```bash
git stash                     # remove the implementation, keep the tests
pytest tests/test_retry.py -x # expect failures; passes here mean dead tests
git stash pop
```

## Pass 3b: hunt for what is absent

A diff renders what was written. Nothing renders what was skipped, so absences
need a checklist rather than attention.

- Error paths: a new call that can fail with no handling, a caught exception
  that is swallowed, a retry with no ceiling.
- Null, empty, and zero cases: empty list, empty string, zero rows, missing
  optional field, first run with a cold cache.
- Rollback: a migration with no down path, a deploy step with no way back, a
  partially applied batch with no cleanup.
- Migration ordering: a schema change that the currently running version cannot
  tolerate mid-deploy, such as dropping a column the old code still selects.
- Config and flags: a value the new code reads that no environment defines yet.
- Telemetry: a new failure mode with no log or metric, which is a failure mode
  you will debug blind.
- Documentation and changelog entries describing behavior that no longer
  exists.

## Pass 3c: copy-paste divergence

- Diff any two blocks that look alike instead of reading them in sequence. Eyes
  confirm similarity; a diff tool finds the one flipped operator.
- Check that a fix applied in one place was applied to every sibling. Bugs
  propagate by copy-paste, and so do half-applied fixes.
- Check copied blocks for stale identifiers: the copied handler that still
  logs the old event name, the copied test that still asserts the old ID.
- Ask for extraction only when three or more copies exist and they must change
  together. Two copies that evolve independently are cheaper left alone.

```bash
# compare two similar handlers directly rather than reading both
diff <(sed -n '40,80p' src/handlers/orders.ts) \
     <(sed -n '95,135p' src/handlers/invoices.ts)
```

## Pass 3d: backward compatibility

- Check that no response field was removed or retyped. Clients you cannot
  deploy are still parsing the old shape.
- Check that no request field became required and no default changed. Both
  break callers silently and only under production traffic.
- Check that enum values were added, not renamed. Renames break every consumer
  matching on the old string.
- Require expand-migrate-contract for schema changes: add the new column, dual
  write, backfill, then drop, each in a separate deploy. A single-step rename
  is an outage for the duration of the rollout.
- Check that queued jobs and cached payloads written by the old version can
  still be read by the new one. The queue is a version boundary too.

## Pass 4: naming and style, last and briefly

- Comment only on names that mislead. A name that describes different behavior
  than the code is a future bug; a name you would have chosen differently is
  not.
- Flag comments that contradict the code, because one of the two is wrong and
  the reader cannot tell which.
- Leave formatting, import order, and lint-catchable defects to tooling. If the
  repo has no formatter, say that once instead of leaving inline nits.

## Review the commit history, not just the squashed diff

- Read the commits in order when the squashed diff is confusing. The sequence
  shows intent that the final state hides.
- Look for a commit that adds a workaround and a later one that removes its
  cause. The workaround is usually still there and now unnecessary.
- Look for secrets, large binaries, and vendored directories added in one
  commit and deleted in another. Deleting them later does not remove them from
  history.
- Ask for a rebase when commits are titled "fix", "wip", or "review comments".
  The history is the only explanation available to whoever bisects this later.

## Close with the right verdict

- Approve with comments when everything left is a nit and you trust the author
  to land it. Holding a merge for taste burns the trust you will need for a
  real blocker.
- Request changes only for correctness, security, data loss, or an interface
  you cannot change after release. If a third of your reviews request changes,
  the signal has stopped meaning anything.
- Pair in person when the third round is repeating the second. More than two
  rounds on the same disagreement is a design conversation being held one
  comment at a time, and it is faster spoken.
- Say what you did not review, every time. "I did not look at the Terraform" is
  honest and lets someone else cover it.
- Re-review only the delta on later rounds. A full re-read invites fresh nits
  on untouched code and makes review feel endless.

Weak closing comment:

> Looks mostly fine, a few concerns, let me know.

Strong closing comment:

> Requesting changes for one issue: `retry.py:88` now returns `None` on
> exhaustion and `worker.py:110` still assumes the exception path. The rest is
> nits you can close. I reviewed the retry logic and the worker call path, and
> did not review the Terraform.
