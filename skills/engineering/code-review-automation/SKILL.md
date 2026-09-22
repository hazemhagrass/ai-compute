---
name: code-review-automation
description: Use when CI bots or AI reviewers comment on PRs. Decide what to automate, gate on, and silence.
---

# Code Review Automation

Automation exists to delete review comments a human should never have to write.
Every check you add either removes a class of human comment or adds a class of
noise, and a bot that is ignored is worse than no bot, because it trains authors
to dismiss the channel that also carries the real finding.

This covers what to automate, how to wire it into CI, and how to keep the signal
high. Human review judgment lives in `../code-review`; the manual pass order
lives in `../code-review-checklist`.

## Automate only what has a ground truth

- Automate a check when the same comment has been written by a human three
  times. That repetition is the signal that a rule exists and can be encoded.
- Automate anything with a deterministic answer: formatting, import order, lint
  rules, type errors, dead code, dependency vulnerabilities, secret patterns,
  license violations, migration file naming, generated files that are out of
  date.
- Do not automate taste. A rule that fires on "this function is doing too much"
  produces a comment the author cannot verify and cannot fix without argument.
- Do not automate a check whose false positive rate you have not measured. Run
  it in report-only mode for a week and count, because a check firing wrongly
  once in five runs teaches everyone to skip the whole job.
- Delete a check that has been overridden more than it has been fixed. An
  ignored rule is a maintenance cost that also hides the rules that matter.

## Run the cheap checks first and fail fast

- Order jobs by cost: format and lint, then typecheck, then unit tests, then
  integration, then build, then anything that needs a live dependency. An author
  waiting eight minutes to learn about a missing semicolon stops pushing small
  commits.
- Keep the required-check set under five minutes for the common path. Past that,
  authors context-switch away and the review round trip stretches from minutes
  to hours.
- Run the full matrix only on the merge queue or on `main`, not on every push.
  Per-push runs exist to give the author a fast answer, not full coverage.
- Cache dependencies and build artifacts keyed on the lockfile hash. An uncached
  install is usually the largest single block of CI time.
- Make every job independently rerunnable. A pipeline where you must rerun all
  seven jobs to retry one flaky integration test wastes the budget you just
  saved.

## Fix instead of commenting where the fix is mechanical

- Run formatters and safe lint autofixes as a pre-commit hook on the author's
  machine, so the defect never reaches CI or a reviewer.
- If a check can autofix, it must not comment. A bot that says "run
  `ruff format`" is asking a human to be a shell.
- Never let a bot push commits to a pull request branch by default. It invalidates
  approvals, confuses `git pull`, and hides the change from the author's local
  history. Fail the job with the exact command to run instead.
- Make the failure message contain the literal command that fixes it, including
  the path. `pnpm lint --fix src/api/routes.ts` is actionable; "lint failed" is
  a second investigation.
- Pin tool versions in the lockfile or the hook config. A formatter that differs
  between a laptop and CI produces a diff war that nobody can win locally.

## Configure bots for signal, not coverage

- Cap inline bot comments per pull request (ten is a workable ceiling). Beyond
  that, post one summary comment with a link to the full report.
- Comment only on lines the diff touched. A static analysis bot that reports
  pre-existing findings on every pull request makes each pull request look
  broken and makes the new finding invisible.
- Have the bot update its existing comment rather than posting a new one each
  push, so the thread holds one current state instead of a history of stale
  failures.
- Resolve bot comments automatically when the finding goes away. Stale resolved
  threads are the main reason authors stop reading the bot.
- Give every finding a severity and gate only on the top one. Advisory findings
  belong in the summary, not in a red X.
- Route noisy-but-useful analysis (complexity trends, coverage deltas, bundle
  size) to a dashboard or a scheduled report, not to the pull request.

## Gate on facts, never on trends

- Gate on: tests fail, typecheck fails, lint fails, build fails, a known
  vulnerability at your severity threshold, a secret detected, a schema check
  fails. These are binary and the author can act on each one.
- Do not gate on a coverage percentage. It is gamed with tests that assert
  nothing, and the number moves for reasons unrelated to the diff. Gate on
  "new or changed lines in this diff have no covering test" if you gate at all,
  and treat it as advisory first.
- Do not gate on a complexity or maintainability score. The author's only
  available response is to split a function arbitrarily to move a number.
- Do not gate on bundle size or performance without a stated budget and a
  baseline from `main`. Without both you are gating on noise.
- Every required check needs a documented override path and a named owner. A
  gate with no way through is bypassed by merging with admin rights, which
  disables every other gate at the same time.

## Treat flaky checks as outages

- A test that fails and passes on rerun without a code change is broken, not
  unlucky. Quarantine it the same day: move it out of the required set and open
  a ticket with its failure rate.
- Never add a blanket retry to the test job. Retries convert a visible flake
  into an invisible one and hide real race conditions that will surface in
  production.
- Measure flake rate per job and publish it. A required check below 98 percent
  pass-on-green is not a gate, it is a coin flip that authors learn to reroll.
- Forbid "rerun until green" as a normal workflow. If that is the practice, the
  gate is already advisory and should be labelled that way honestly.

## Using an AI reviewer

- Give it a scope, not the whole diff: one of security, error handling, missing
  tests, or API compatibility per run. An unscoped model comments on everything
  at uniform confidence, which is indistinguishable from noise.
- Feed it the pull request description and the linked ticket. Without stated
  intent it can only check the code against itself and will never catch the
  correct implementation of the wrong requirement.
- Require a located finding: file, line, and the consequence. Reject the output
  format that produces "consider adding error handling" with no target.
- Keep it advisory. An AI reviewer must never be a required check, because the
  failure mode is a confident wrong blocker that costs more than the bug it
  looked for.
- Never let it approve. Approval carries accountability and a model cannot hold
  any.
- Track its precision: count findings that produced a commit versus findings
  that were dismissed. Below roughly half acted-on, tighten the scope or remove
  it.
- Do not paste proprietary code into a third-party reviewer without checking the
  data retention terms, because a review tool sees every line of every diff.

## Workflow: adding a check

1. Find the repeated human comment. Search closed review threads for the phrase
   before writing any config.
2. Implement it as a local hook first (`pre-commit`, `lefthook`, `husky`) so the
   feedback arrives before the push.
3. Run it in report-only mode on every pull request for a week. Record true
   positives and false positives.
4. Fix or remove the check if false positives exceed roughly one in twenty runs.
5. Promote it to required only after that measurement, and only if the finding
   is one you would block a merge on by hand.
6. Write the failure message with the exact fix command, then confirm a fresh
   contributor can resolve a failure from the message alone.

## Counter-examples

Vague: add static analysis to CI.

Actionable: run `semgrep --config p/owasp-top-ten --baseline-commit
$(git merge-base origin/main HEAD)` so only findings introduced by this diff are
reported, and post them as a single summary comment.

Vague: enforce test coverage.

Actionable: fail when a changed line in `src/` has no covering test, report it
as a list of file:line, and exempt generated files by path.

Vague: the bot should be less noisy.

Actionable: cap inline comments at ten per pull request, filter to changed
lines, and move complexity and bundle-size reporting to the weekly summary.

## See also

- `../code-review`, for the comments a human still has to write.
- `../code-review-checklist`, for the manual pass order automation cannot cover.
- `../test-strategy`, for what the missing-test check should actually demand.
- `../../devops/ci-cd-debugging`, when the pipeline itself is the thing failing.
- `../../security/secrets-management-audit`, for what a secret scanner misses.
