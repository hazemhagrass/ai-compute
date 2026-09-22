---
name: refactoring-safety-checks
description: "Use when verifying a refactor did not change behaviour. Prove equivalence with a recorded baseline, a reference sweep, and a rollback plan before merging."
---

# Refactoring Safety Checks

A refactor is a claim: "observable behaviour is unchanged." This skill is about producing evidence for that claim. A green test suite is weak evidence when the suite never covered the code you moved, and it is no evidence at all when you never ran it before touching anything.

The order matters: capture evidence of the old behaviour *first*, change code *second*, compare *third*. Evidence gathered after the change can only describe the new behaviour.

## 1. Record the baseline before the first edit

On the unmodified commit, capture and commit (or stash outside the repo) everything you will later compare against:

- **Test results**, with the exact command and the pass/fail/skip counts. `pytest -q | tail -5 > /tmp/baseline.txt`. "Those tests were already flaky" is a claim you can only make if you measured it.
- **Skip and xfail lists.** A refactor that silently turns a passing test into a skipped one reads as green. Compare counts, not colour.
- **Coverage of the target files only.** If the lines you are about to move are at 20% coverage, the suite cannot protect them and you need characterization tests first.
- **Timing**, if the code is on a hot path. Structural changes flip inlining, allocation, and laziness.

```bash
# Baseline, on the untouched commit
git rev-parse HEAD > .refactor/baseline-sha
pytest -q --cov=src/payments --cov-report=term > .refactor/baseline-tests.txt
pytest -q --collect-only | wc -l > .refactor/baseline-testcount.txt
```

If you cannot get a green baseline, stop. Refactoring on top of a red suite means every later failure is ambiguous, and ambiguity is how a regression ships.

## 2. Name the observable boundary explicitly

Write the frozen surface down in the PR description. Anything not on this list is free to change; anything on it must be proven identical.

- HTTP status codes, response bodies, and header casing
- Function and method return values, including exception types and messages that callers match on
- Emitted events, queue messages, and their serialization format
- Database writes: columns touched, ordering, transaction boundaries
- Log lines and metric names that dashboards, alerts, or log-parsing jobs depend on
- Timing and ordering guarantees, if anything downstream relies on them

The last two are where "pure refactors" break production. Renaming a metric or reordering two log statements is invisible to every test you own and visible to the on-call engineer at 3am.

## 3. Sweep for references the compiler cannot see

Type checkers and IDE rename tools only follow static references. Before calling any rename or move "mechanical", grep the whole repo *and* the places code is not:

```bash
# Static + dynamic reference sweep for an old name
git grep -n "send_invoice"                     # code, tests
git grep -n "send.invoke\|sendInvoice"          # casing variants
rg "send_invoice" --glob '*.{yaml,yml,json,sql,tf,md,html,jinja,tpl}'
```

Check the non-code surfaces by hand: feature-flag definitions, dashboards and alert queries, cron/job schedulers, serialized payloads already in the queue or database, API schemas and client SDKs in other repos, reflection and dynamic-import strings, DI container registrations, and database enum/string values.

Any hit outside the refactor's blast radius means the change is not mechanical and needs its own migration step.

## 4. Prove equivalence, do not assume it

Pick the strongest check the situation allows:

**Golden / approval tests.** Capture outputs for a representative input set on the old code, then assert byte equality on the new code. Best for serializers, formatters, report generators, and query builders.

```python
# Generated on the baseline commit, committed as a fixture
def test_invoice_rendering_matches_golden(golden):
    for case in load_cases("fixtures/invoice_cases.json"):
        assert render_invoice(case) == golden[case["id"]]
```

**Differential (A/B) execution.** Run old and new implementations side by side on the same inputs and assert the results match. Use real production traffic in shadow mode when the input space is too large to enumerate.

```python
def process(order):
    new = new_pricing(order)
    if SHADOW_COMPARE:
        old = legacy_pricing(order)
        if old != new:
            log.warning("pricing_divergence", order_id=order.id, old=old, new=new)
        return old          # old path still authoritative until divergence is zero
    return new
```

Ship the shadow comparison, watch the divergence counter reach and stay at zero over a full business cycle (including month-end and batch jobs), then flip authority and delete the old path in a separate commit.

**Mutation testing on the safety net.** Before trusting a suite to guard a refactor, check that it actually fails when the code is wrong. `mutmut run --paths-to-mutate src/payments` or Stryker for JS. Surviving mutants in the target file mean the tests assert nothing useful there.

**Build-artifact comparison.** For pure moves and renames in compiled or bundled code, compare the normalized output (`objdump`, bundle analyzer, or a sorted export list). Identical artifacts are the strongest possible proof.

## 5. Read the diff as a reviewer would

Self-review the diff with the transformation name in mind before asking anyone else:

- `git diff --stat` - does the shape match the claim? A "rename" touching a file with no occurrence of the name is a red flag.
- `git diff -w` and `git diff --ignore-blank-lines` - strip formatting noise so real changes surface.
- `git diff --color-moved=zebra` - distinguishes moved code from rewritten code, which is the single highest-value review flag for a refactor.
- For a pure move, verify emptiness: `git show --stat` should show a near-symmetric add/delete, and `diff <(old file body) <(new file body)` should be empty.

If the diff contains a changed constant, an added null check, a swapped operator, or a new early return, that is behaviour. Split it out.

## 6. Verify the runtime, not just the build

Tests that mock the boundary you refactored will pass no matter what you did to it.

- Run the integration and contract suites, not only unit tests.
- Start the application and exercise the touched path once by hand or with a smoke script. Import-time side effects, DI wiring, and config keys break here and nowhere else.
- Check for changed import cycles or startup order after a module move.
- Re-run any database migration path if models or ORM mappings moved.
- Confirm log output and metric emission still match the names you froze in step 2.

## 7. Land it in reviewable pieces

A refactor that touches two hundred files is unreviewable, so it gets approved on
trust rather than on reading, which is how a behaviour change slips through inside
a "pure move".

- Split by transformation, not by directory, so each commit has one verb in its
  message: extract, inline, rename, move. A commit that needs "and" is two commits.
- Land the mechanical half first and the judgement half second. A rename across
  three hundred call sites reviews in a minute when it contains nothing else.
- Keep each commit green on its own, because a bisect that lands mid-refactor on a
  broken build cannot tell you which change introduced the bug you are hunting.

Bad: one commit, "refactor payments", 214 files, including a changed rounding mode.

Good: three commits: "move payment models to billing/", "rename calc_total to
compute_invoice_total", then a separate "fix: round half-even for VAT" that a
reviewer can actually argue with.

## 8. Have a rollback plan before you merge

- Is the refactor revertible as a single commit or a clean range? If it interleaves with behaviour changes from other people, it is not.
- Does it change a persisted format (DB schema, cached payload, serialized session, queue message)? Then revert is not enough: old code must be able to read new data. Deploy the reader before the writer.
- Is it behind a flag or a shadow comparison you can turn off without a deploy?
- Who is watching after release, and which metric or error rate tells them it went wrong?

Deploy a large refactor on a low-traffic window with someone available, not on a Friday, and not stacked with a feature release that would confuse attribution.

## Post-merge verification

For the first 24 hours (or one full batch cycle) after release, compare against the baseline you recorded:

- Error rate and exception types on the touched service
- p50/p99 latency on the touched endpoints
- Throughput of any background job in the blast radius
- Divergence counters from shadow comparisons
- A spot check of the actual data written: same rows, same values, same counts

If any of these moved, revert first and diagnose after. The whole point of one-transformation-per-commit is that revert is cheap.

## Common mistakes

- **"The tests pass."** Check that the same *number* of tests ran and that none became skipped. A missing test file passes silently.
- **"I ran the tests after finishing."** Without a baseline, a failure could be yours or could be a week old. Run them first, always.
- **"The type checker is happy."** Type checkers see none of: template strings, SQL, feature flags, serialized data, dashboards, reflection, or other repos.
- **"It's a pure move, no review needed."** Pure moves change import order, module initialization, and cycle structure. Run the app once.
- **"Shadow mode showed no divergence in an hour."** Run it through the rare paths: month-end, retries, timeouts, empty collections, and the largest customer.
- **"I compared the outputs and they matched."** On what input set? Outputs matching on the happy path proves nothing about the error path, which is where refactors usually break.
- **"I'll delete the old implementation in the same commit."** Then the rollback is a redeploy instead of a flag flip. Delete in a follow-up, once divergence has been zero for a full cycle.
- **"Coverage went up, so it's safer."** Coverage says the line ran, not that anything asserted on it. Mutation testing is the check that matters.
