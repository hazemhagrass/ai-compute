# Code Review

A severity-ordered review procedure that finds defects in a diff before attention runs out, and turns findings into comments an author can act on in one pass.

## What it does

This skill replaces the default "read the diff top to bottom" habit with four ordered passes and a fixed comment vocabulary.

- **Orders the search.** Correctness first, then security, then design, then style. Line 1 of a diff is usually an import block, and that is a bad place to spend your freshest attention.
- **Judges against stated intent.** The PR description and linked ticket are read before any code, so a flawless implementation of the wrong requirement gets caught.
- **Labels every comment.** Each comment is prefixed `blocking:`, `should-fix:`, or `nit:` so the author knows what must change before merge and what they may close without replying.
- **Hunts for absences.** Missing tests, unupdated callers, schema changes with no migration, new failure modes with no telemetry. Most real bugs are in what the diff does not contain.
- **Suppresses noise.** Formatting, import order, lint-catchable defects, and coverage percentages are explicitly delegated to tooling, because a wall of nits buries the one comment that mattered.

The output is a review, not a reading: a small set of located, consequence-stating comments plus an explicit statement of what you did not review.

## When to use this

Load this skill when:

- You are reviewing a pull request or a diff someone else wrote.
- You are about to request review on your own branch and want the self-review pass first.
- A review round has produced twenty comments and you cannot tell which ones block the merge.
- You are re-reviewing after the author pushed changes and need to scope the second round.
- A reviewer asked "is this safe?" or "needs error handling" and you need to turn that into something actionable.
- You are reviewing code in a subsystem you do not know well and need a way to scope your approval honestly.

Do not use it for:

- Formatting or lint disputes. Configure the tool instead.
- Design arguments about code that is not in the diff. File an issue.
- Decisions already argued out in the ticket. Reopen them there, not inline.

## Quick start

A worked example. You are reviewing PR #412, described as "fix timeout handling in the sync worker".

**Step 1 - read intent before code.**

```bash
gh pr view 412 --json title,body,files
```

The description says timeout handling. The file list includes `sync/worker.py`, `sync/retry.py`, and `billing/invoice.py`. That last file is unrelated, and it is your first comment:

> `should-fix:` `billing/invoice.py` is not timeout handling. Please split it into its own PR so it gets a real review; right now nobody has looked at it against a stated goal.

**Step 2 - read the tests first, not the implementation.**

```bash
gh pr diff 412 -- 'tests/**'
```

The tests cover a timeout on attempt one and attempt two. Nothing covers the third attempt also failing. Note it, do not comment yet.

**Step 3 - read the interfaces.**

```bash
gh pr diff 412 | grep -E '^\+.*(def |class |async def )'
```

`retry_with_backoff` gained a `cap` parameter and now returns `None` on exhaustion instead of raising.

**Step 4 - find the callers the diff did not update.**

```bash
rg -n 'retry_with_backoff' --type py
```

Three call sites. The diff touches one. Two still assume an exception.

**Step 5 - trace one concrete input end to end.** A sync job that times out three times: `worker.run` calls `retry_with_backoff`, gets `None`, and passes it to `record_result(result.id)`. That is an `AttributeError` in production, on the exact path this PR claims to fix.

**Step 6 - write located, labelled comments.**

```text
blocking: retry.py:88 - retry_with_backoff now returns None on exhaustion
instead of raising. worker.py:110 and scheduler.py:64 still assume the
exception path; worker.py:110 calls result.id and will raise AttributeError
on the three-timeout case this PR is meant to fix. Either keep raising and
add the cap separately, or update both callers here.

should-fix: no test covers the third attempt also failing, which is the new
behavior. tests/test_retry.py only exercises success on attempts one and two.

nit: `cap` reads as a count next to `max_attempts`. `backoff_cap_seconds`
would remove the ambiguity. Fine to close this.
```

**Step 7 - close the review with scope.**

```bash
gh pr review 412 --request-changes --body "Reviewed the retry logic and the
worker call path. Did not review the billing change (please split it) or the
Terraform. One blocking issue on the unupdated callers."
```

One blocking comment, one should-fix, one nit, and an honest statement of what went unread.

## Key concepts

**The four passes.** Correctness (does it do what it claims for the inputs it will actually receive), security (untrusted input reaching a query, shell, path, template, or deserializer; authorization present on one route and missing on its sibling), design (is this the right seam), style (only what a tool cannot catch). If the correctness pass finds a blocker, stop and submit. Asking for a rewrite and a naming nit in the same breath wastes both people's time.

**The three labels.** `blocking:` is correctness, security, data loss, or an unchangeable public API. `should-fix:` is a real problem that is not a release blocker; the author may defer but must respond. `nit:` is preference, closable without reply, and you should say so. Keep blocking rare. If a third of your comments are blocking, the label has stopped carrying information.

**Read order for a diff you did not write.** Tests, then interfaces, then implementation. Tests state the intended contract in executable form, including (by omission) the edge cases the author did not consider. Starting at the implementation makes you pattern-match on syntax and learn nothing about purpose.

**Concrete tracing.** Pick one realistic request or input and follow it through the changed code. This finds bugs that reading does not, because reading verifies plausibility while tracing verifies behavior.

**The absence checklist.** Missing tests on new branches (especially error paths), unhandled new failure modes, swallowed exceptions, retries with no ceiling, callers not updated for a changed signature or return shape, schema changes with no migration or with a migration that breaks the currently running version mid-deploy, config or flags no environment defines, docs describing behavior that no longer exists, and new failure modes with no log or metric.

**Timeboxing unfamiliar code.** After twenty minutes with no working model of the system, scope your review out loud: "I can review the error handling and the SQL, but I do not know this scheduler well enough to judge the locking. Please get a second reviewer." A silent shallow approval is worse than a scoped one.

**Self-review.** Read your own full diff as a stranger before requesting review. It catches debug prints, commented-out blocks, stray TODOs, and unrelated edits every single time. Leave author comments pointing at the lines you are unsure about; this raises review quality more than anything a reviewer does.

## Common pitfalls

**Vague comments generate conversation; specific ones generate a commit.**

Bad:

> Needs error handling.

Good:

> `blocking:` if `fetchUser` throws here, the transaction opened on line 42 is never rolled back and the connection leaks back into the pool. Wrap lines 42-58 in try/finally, or move the fetch above the transaction.

**Naming a smell instead of a consequence.** The author can verify a consequence; they can only argue with a smell.

Bad:

> This function is confusing.

Good:

> `should-fix:` `resolveTarget` does three things (parses input, hits the cache, writes the audit row). The audit write is why the cache test needs a DB fixture. Splitting the write into the caller would let the cache path be tested in isolation.

**Fake-questioning a defect you already identified.** It costs a round trip and reads as sarcasm.

Bad:

> Is this safe?

Good:

> `blocking:` `orgId` comes from the request body, not the session, so a caller can read another tenant's rows. Take it from `ctx.session.orgId`.

**Citing a coverage number instead of the untested branch.** A percentage tells the author nothing about what to write.

Bad:

> Coverage dropped to 71%, please bring it back up.

Good:

> `should-fix:` no test covers the retry path when the third attempt also fails. Given the backoff cap added here, that case now returns `null` instead of raising, and callers on line 110 do not handle it.

**Repeating the same comment on every occurrence.** Say it once on the first instance and write "same below". Fifty identical inline nits make the substantive comment invisible.

**Inline nits standing in for a missing tool.** If the repo has no formatter and you keep flagging quote style, the correct review comment is "add a formatter", once, not fifty inline nits.

**Blocking a merge on taste.** Approve when the remaining comments are nits. Blocking on preference burns the trust you will need for a real blocker.

**Re-reading the whole diff on round two.** Review only the delta. A full re-read invites fresh nits on untouched code and makes review feel endless to the author.

**Speculative scale objections.** "This will not work at a million rows" is noise when the table holds four hundred and the code is cheap to change later.

**Praise with no information.** "Nice" carries nothing. Either praise the specific choice ("good call putting the retry ceiling in config") or say nothing.

## See also

- `SKILL.md` in this directory - the full procedure, including the complete absence checklist and the comment-vocabulary rules.
- `../security-audit` - the deeper pass for tenancy, authorization, and secret leakage, when pass 2 turns up something that needs more than an inline comment.
- `../debugging` - for when a review finding turns into an actual bug hunt rather than a comment.
- `../test-strategy` - the other side of the "missing tests for the new branch" finding.
- `../refactoring` - for design-pass findings that are too large to fix inside the PR under review.
- `../git-workflow` - keeps diffs small and single-purpose, so a four-pass review fits in one sitting.
