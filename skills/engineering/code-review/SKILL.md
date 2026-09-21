---
name: code-review
description: "Use when reviewing a diff or pull request. Review in severity-ordered passes, judge against stated intent, and label every comment blocking/should-fix/nit."
---

# Code Review

A review is a search for defects under a time budget, not a read-through. The
order you look in decides what you find, because attention runs out before the
diff does.

## Review in passes, never top to bottom

- Run four passes in this order: correctness, security, design, style. A
  reviewer who starts at line 1 spends their freshest attention on import
  ordering and reaches the logic bug tired or never.
- Pass 1, correctness: does this do what it claims, for the inputs it will
  actually receive? Off-by-one, null/empty, concurrent access, partial failure,
  retries that are not idempotent.
- Pass 2, security: untrusted input reaching a query, a shell, a path, a
  template, or a deserializer. Authorization checks that exist on one route and
  not its sibling. Secrets in code, logs, or error messages.
- Pass 3, design: is this the right seam? Will the next change to this area be
  easy or will it require touching five files again? Design comments are
  expensive to act on, so raise them before the author polishes.
- Pass 4, style: only what a tool cannot catch, like a misleading name or a
  comment that contradicts the code.
- Stop and submit if the correctness pass found a blocker. Asking for a rewrite
  and a naming nit in the same breath wastes both people's time.

## Leave these entirely to tooling

- Formatting, import order, line length, trailing whitespace, quote style. If a
  formatter could have made the comment, the comment is noise that buries your
  substantive ones.
- Lint-catchable defects: unused variables, shadowed names, missing awaits that
  the linter flags, obvious type errors.
- Coverage percentages and complexity scores. Cite the untested branch by name
  instead, because a number tells the author nothing about what to write.
- If the repo has no formatter or linter and you keep making these comments,
  the correct review comment is "add a formatter", once, not fifty inline nits.

## Read the diff against its stated intent

- Read the PR title, description, and linked ticket before the first line of
  code. Code that is flawless but implements the wrong requirement passes every
  automated check and every careful line-by-line read.
- Ask explicitly: does the change set match the description? A diff described as
  "fix timeout handling" that also renames a module is two changes, and the
  second one is unreviewed by anyone.
- If the description is missing or vague, that is the first comment. You cannot
  judge correctness against an unstated goal, and neither can the next person
  reading the history.
- Check the claim in the description against the tests. "Handles empty batches"
  with no empty-batch test means the claim is unverified.

## Label every comment with severity

Prefix each comment with one of three labels. An uncategorised wall of comments
is unactionable, so authors either fight all of it or ignore all of it.

- `blocking:` correctness, security, data loss, or a public API you cannot
  change later. Merging with this unresolved is a mistake.
- `should-fix:` real problem, not a release blocker. Author may fix now or file
  a follow-up, but must respond.
- `nit:` preference. Author may close it without replying. Say so, so they feel
  free to.

Keep blocking comments rare. If a third of your comments are blocking, the label
has stopped carrying information.

## Hunt for what is not in the diff

Most real bugs live in the absence, not the text. Walk this list every time:

- Missing tests for the new branch, especially the error path. New conditional,
  no new test, is a standing question.
- Missing error handling: a new call that can fail with no handling, a caught
  exception that is swallowed, a retry with no ceiling.
- Callers not updated. Search for every use of a changed signature, changed
  default, or changed return shape. The compiler catches some languages and
  almost none of the dynamic ones.
- Schema change with no migration, or a migration that is not backward
  compatible with the currently running version during deploy.
- Config, feature flag, or secret that the new code reads and no environment
  defines yet.
- Docs, changelog, or API reference that now describes behavior that no longer
  exists.
- Telemetry: a new failure mode with no log or metric is a failure mode you will
  debug blind.

## Reviewing a diff you did not write

This is the common case and the harder one. Do not start with the
implementation, because you will pattern-match on syntax and learn nothing about
purpose.

1. Read the tests first. They state the intended contract in executable form,
   including the edge cases the author thought about (and, by omission, the ones
   they did not).
2. Read the interfaces next: type signatures, public methods, API schemas, DB
   columns. This gives you the shape of the change without the noise.
3. Read the implementation last, now that you know what it is supposed to do.
4. Trace one realistic request or input end to end through the changed code.
   Concrete tracing finds bugs that reading never does.
5. Timebox unfamiliar context. After twenty minutes with no model of the system,
   say so: "I can review the error handling and the SQL here, but I do not know
   this scheduler well enough to judge the locking. Please get a second
   reviewer." A silent shallow approval is worse than a scoped one.

## Review your own diff first

- Read your full diff as a stranger before requesting review. It catches debug
  prints, commented-out blocks, stray TODOs, and unrelated edits every single
  time.
- Delete unrelated changes into a separate branch. Bundled cleanups make the
  real change unreviewable.
- Leave author comments on the parts you are unsure about, pointing reviewers at
  the risky lines. This raises review quality more than anything a reviewer
  does.
- Write the description you would want to receive: what changed, why, what you
  chose not to do, how you verified it.

## Write comments that can be acted on

Vague comments generate a conversation. Specific comments generate a commit.

Bad:

> This function is confusing.

Good:

> `should-fix:` `resolveTarget` does three things (parses input, hits the
> cache, and writes the audit row). The audit write is why the cache test needs
> a DB fixture. Splitting the write into the caller would let the cache path be
> tested in isolation.

Bad:

> Needs error handling.

Good:

> `blocking:` if `fetchUser` throws here, the transaction opened on line 42 is
> never rolled back and the connection leaks back into the pool. Wrap lines
> 42-58 in try/finally, or move the fetch above the transaction.

Bad:

> Is this safe?

Good:

> `blocking:` `orgId` comes from the request body, not the session, so a caller
> can read another tenant's rows. Take it from `ctx.session.orgId`.

Bad:

> Add tests.

Good:

> `should-fix:` no test covers the retry path when the third attempt also
> fails. Given the backoff cap added here, that case now returns `null` instead
> of raising, which callers on line 110 do not handle.

Rules the examples encode:

- Name the symbol, line, or input. "Somewhere in this file" is not a review.
- State the consequence, not just the smell. "Connection leaks" beats "bad
  pattern", because the author can verify a consequence.
- Offer a direction, not a mandate. One suggested fix keeps the author moving
  without forcing your design.
- Ask real questions as questions, and assert real defects as assertions.
  Fake-questioning a known bug ("did you mean to leak this?") wastes a round
  trip and reads as sarcasm.

## Comments not worth making

- Anything a formatter or linter owns. Configure the tool instead.
- Preference rewrites with no defect behind them: map versus loop, ternary
  versus if, your favourite naming scheme.
- Speculative scale: "this will not work at a million rows" when the table holds
  four hundred and the code is easy to change later.
- Design objections to code that is not in the diff. File an issue instead of
  holding someone's unrelated change hostage.
- Repeating a comment on every occurrence of the same pattern. Say it once on
  the first instance and write "same below".
- Praise with no information ("nice"). Praise the specific choice or say
  nothing: "good call putting the retry ceiling in config".
- Second-guessing a decision already argued out in the ticket. Reopen it there,
  not inline.

## Closing the review

- Approve when remaining comments are nits. Blocking a merge on taste burns
  trust you will need for a real blocker.
- Say what you did not review. "I did not look at the Terraform" is useful and
  honest.
- Re-review only the delta on the second round. Re-reading the whole diff
  invites new nits on untouched code and makes review feel endless.
