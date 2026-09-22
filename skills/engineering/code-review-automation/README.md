# Code Review Automation

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="code-review-automation robot" width="200">
</div>

Rules for deciding what a machine should say on a pull request, so that every automated comment removes human work instead of adding a thing to ignore.

## What it does

This skill treats CI checks, lint bots, and AI reviewers as one system with a single budget: author attention. Every rule below either buys attention back or spends it deliberately.

- **Sets an admission test for new checks.** A check is worth automating when a human has written the same comment three times and the answer is deterministic. Taste, architecture opinions, and anything the author cannot verify stay with humans.
- **Orders the pipeline by cost.** Format and lint, then typecheck, then unit tests, then integration and build, with the required set kept under five minutes so authors keep pushing small commits.
- **Prefers fixing to commenting.** Mechanical defects get autofixed in a local pre-commit hook and never reach CI. A bot that asks a human to run a formatter is a bot doing the wrong job.
- **Configures bots for signal.** Comment caps, changed-lines-only filtering, comment updates instead of new posts, auto-resolution of fixed findings, and one severity that gates while the rest goes to a dashboard.
- **Separates facts from trends.** Gates on binary facts (tests, types, lint, build, known CVEs, detected secrets). Keeps coverage percentages, complexity scores, and unbenchmarked bundle sizes out of the gate.
- **Treats flakes as outages.** Same-day quarantine, no blanket retries, published per-job flake rates, and an honest label when a gate has become advisory in practice.
- **Scopes AI reviewers.** One concern per run, intent supplied from the description and ticket, located findings only, advisory forever, never an approver, with tracked precision.

The output is a check set where a red X means something and a bot comment gets read.

## When to use this

Load this skill when:

- Authors have started ignoring the bot, rerunning until green, or merging with admin override.
- You are adding a linter, scanner, or AI reviewer to a repository and need to decide whether it gates.
- CI takes long enough that the review round trip is measured in hours.
- The same human review comment keeps appearing and you want it encoded once.
- A required check is flaky and nobody has decided what to do about it.
- You are writing the config for a review bot and need the comment-volume and filtering rules.

Do not use it for:

- Writing review comments as a human. That is `../code-review`.
- The manual pass order on a diff. That is `../code-review-checklist`.
- Debugging a pipeline that is broken rather than badly designed. That is `../../devops/ci-cd-debugging`.

## Quick start

A repository where the bot posts forty comments per pull request and everyone has muted it.

**Step 1, measure before changing anything.**

```bash
gh pr list --state merged --limit 50 --json number \
  --jq '.[].number' \
  | xargs -I{} gh pr view {} --json comments \
    --jq '[.comments[] | select(.author.login | endswith("[bot]"))] | length'
```

Forty per pull request, of which the authors resolved four. The bot has a ten percent action rate, which is noise with a red X on it.

**Step 2, filter to the diff.** Most of the volume is pre-existing findings re-reported on every run. Baseline them:

```bash
semgrep --config p/owasp-top-ten \
  --baseline-commit "$(git merge-base origin/main HEAD)"
```

Volume drops to what this change introduced.

**Step 3, move the mechanical ones left.** Formatting and import order become a hook, so they never reach a comment:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

**Step 4, split gate from advisory.** Required: typecheck, lint, unit tests, build, secret scan, CVEs at high or above. Advisory: complexity, coverage delta, bundle size, AI review.

**Step 5, cap the rest.** Ten inline comments maximum, changed lines only, one updated summary comment per push.

**Step 6, quarantine the flake.** The integration test failing one run in six leaves the required set the same day, with its rate recorded in the ticket, rather than gaining a retry.

**Step 7, re-measure.** Comments per pull request in single digits, action rate above half, required checks under five minutes. If not, cut another check.

## Key concepts

**Attention is the budget.** Every automated comment spends some of the author's finite attention. A check that spends more than it saves is a net loss even when each individual finding is technically correct.

**Determinism is the admission criterion.** A check belongs in CI when its answer does not depend on judgment. Anything an author can reasonably argue with generates a conversation, and conversations belong to humans.

**Shift left beats comment early.** The cheapest place to catch a mechanical defect is the author's machine before the commit. The second cheapest is CI. A review comment is the most expensive place, because it costs two people and a round trip.

**Fixes beat findings.** If a tool can produce the corrected text, asking a human to produce it instead is pure overhead. Report-and-fix-command is the minimum; autofix in a hook is the target.

**Facts gate, trends inform.** Binary results (compiles, passes, contains a secret) are fair to block on because the author can act on each one. Aggregate numbers move for reasons unrelated to the diff, and gating on them teaches gaming rather than quality.

**A flaky gate is not a gate.** A required check that passes on rerun has no information content, and its real effect is to normalise rerunning, which also defeats the checks that work.

**Bot comments need a lifecycle.** Post, update, resolve. A bot that only ever appends leaves a thread of stale failures that hides the one current finding.

**AI review is a second opinion, never a verdict.** A model can raise a candidate defect for a human to judge. It cannot hold accountability for a merge, so it cannot approve and should not block.

## Common pitfalls

**Automating an opinion.** A rule that fires on subjective structure produces comments the author cannot verify and cannot satisfy without argument.

Bad:

> Bot: this function exceeds the recommended cognitive complexity of 15.

Good:

> Bot: `parse_invoice` at `billing/parse.py:88` has no test covering the branch added on line 104. (advisory)

**Reporting the whole repository on every pull request.**

Bad: `semgrep --config auto .` on every run, posting 340 findings.

Good: `semgrep --baseline-commit $(git merge-base origin/main HEAD)`, posting only what this branch introduced.

Reason: without a baseline the output is dominated by code the author never touched, and the one new finding sits at position thirty where nobody reads it.

**Letting a bot push fixup commits.** It invalidates approvals, surprises the author on the next pull, and makes the local branch diverge for reasons nobody sees in the log.

**Blanket retries on the test job.**

Bad: `retry: 3` on the whole suite, so a failing run eventually goes green.

Good: quarantine the named flaky test, file it, and keep the rest of the suite non-retrying.

Reason: a blanket retry turns a visible race condition into an invisible one, and the race is still there in production where there is no rerun button.

**Gating on coverage percentage.**

Bad: `fail_under = 85` in the coverage config.

Good: require that lines added by this diff are covered, and let the total float.

Reason: the reliable way to raise a percentage is a test that exercises code without asserting on it, which is exactly the test that catches nothing.

**Required checks with no override path.** When the only way through is an admin merge, every other gate is bypassed in the same action.

**An AI reviewer as a required check.** Its failure mode is a confident, wrong blocker, and the cost of arguing with it exceeds the bug it was looking for.

**Adding a check without measuring its false positives.** One wrong failure in five runs is enough to teach a team that the job is decorative.

**Keeping a check nobody acts on.** An overridden-more-than-fixed rule is maintenance cost plus camouflage for the rules that matter. Delete it.

## See also

- `SKILL.md` in this directory, for the full rule set including the check-promotion workflow.
- `../code-review`, for the comments a human still has to write, and how to word them.
- `../code-review-checklist`, for the manual pass order that automation cannot replace.
- `../test-strategy`, for deciding what the missing-test check should actually require.
- `../../devops/ci-cd-debugging`, for a pipeline that is failing rather than badly scoped.
- `../../security/secrets-management-audit`, for the leak paths a secret scanner does not see.
- `../../devtools/git-workflow`, for keeping diffs small enough that a fast required set is sufficient.
