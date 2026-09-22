# Refactoring Safety Checks

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="refactoring-safety-checks robot" width="200">
</div>

Evidence-based verification that a refactor left observable behaviour unchanged.

## What It Does

A refactor is a claim - "nothing observable changed" - and this skill is the procedure for proving it. It covers recording a baseline before the first edit, naming the frozen boundary, sweeping for references no compiler can see, proving equivalence with golden or differential tests, reviewing the diff for smuggled behaviour, verifying the runtime, and having a rollback plan ready before merge.

The core ordering rule: capture evidence of the old behaviour first, change the code second, compare third. Evidence gathered after the change can only describe the new behaviour.

## When to Use

- Before merging any structural change described as "no behaviour change"
- When refactoring code with thin, absent, or mock-heavy test coverage
- When moving or renaming anything referenced by strings: feature flags, SQL, templates, dashboards, API schemas, other repos
- When replacing an implementation that writes to a database, queue, or persisted cache
- When reviewing someone else's refactor PR and deciding whether to trust the green check

## Quick Start

### 1. Baseline on the untouched commit

```bash
mkdir -p .refactor
git rev-parse HEAD > .refactor/baseline-sha
pytest -q --cov=src/payments --cov-report=term > .refactor/baseline-tests.txt
pytest -q --collect-only | wc -l > .refactor/baseline-testcount.txt
```

Record pass/fail/skip counts, not just the colour. A test that becomes skipped still reads green.

### 2. Sweep for invisible references

```bash
git grep -n "send_invoice"
rg "send_invoice" --glob '*.{yaml,yml,json,sql,tf,md,html,jinja,tpl}'
```

Then check by hand: feature flags, alert and dashboard queries, job schedulers, serialized payloads already in flight, client SDKs in other repos, reflection and dynamic-import strings, DI registrations, DB enum values.

### 3. Review the diff as a reviewer would

```bash
git diff --stat                    # does the shape match the claim?
git diff -w                        # strip whitespace noise
git diff --color-moved=zebra       # moved code vs rewritten code
```

A changed constant, an added null check, a swapped operator, or a new early return is behaviour. Split it out.

## Key Concepts

### The Observable Boundary

Write the frozen surface into the PR description before you start:

- HTTP status codes, response bodies, header casing
- Return values and the exception types/messages callers match on
- Emitted events, queue messages, serialization format
- Database writes: columns, ordering, transaction boundaries
- Log lines and metric names consumed by dashboards, alerts, or parsers
- Timing and ordering guarantees anything downstream relies on

The last two break production most often, because no test you own can see them.

### Golden Tests

Capture outputs on the baseline commit, assert byte equality afterwards. Best for serializers, formatters, report generators, query builders.

```python
def test_invoice_rendering_matches_golden(golden):
    for case in load_cases("fixtures/invoice_cases.json"):
        assert render_invoice(case) == golden[case["id"]]
```

### Differential / Shadow Execution

Run old and new side by side on the same input, keep the old path authoritative, and count divergences.

```python
def process(order):
    new = new_pricing(order)
    if SHADOW_COMPARE:
        old = legacy_pricing(order)
        if old != new:
            log.warning("pricing_divergence", order_id=order.id, old=old, new=new)
        return old          # old path authoritative until divergence is zero
    return new
```

Watch divergence through a full business cycle - month-end, retries, timeouts, empty collections, the largest customer - then flip authority, and delete the old path in a separate commit.

### Mutation Testing

Before trusting a suite to guard a refactor, confirm it fails when the code is wrong:

```bash
mutmut run --paths-to-mutate src/payments     # Python
npx stryker run                                # JS/TS
```

Surviving mutants in the target file mean the tests assert nothing useful there. Coverage says the line ran; mutation testing says something checked it.

### Rollback Plan

- Revertible as one commit or a clean range?
- Does it change a persisted format? If so, deploy the reader before the writer - revert alone is not enough.
- Is it behind a flag you can flip without a deploy?
- Who is watching after release, and on which metric?

## Common Pitfalls

### Green Suite, No Baseline

**Wrong:**
```bash
git checkout -b refactor-pricing
# ...edits...
pytest          # 2 failures - "probably flaky"
```

**Right:**
```bash
pytest -q > .refactor/baseline-tests.txt   # on the untouched commit
git checkout -b refactor-pricing
pytest -q > after.txt
diff .refactor/baseline-tests.txt after.txt
```

### Counting Colour Instead of Tests

**Wrong:** "All green, ship it." - a deleted or mis-collected test file passes silently.

**Right:** Compare collected/passed/skipped counts against the baseline. Any drop is a regression in the safety net.

### Trusting the Type Checker on a Rename

Type checkers see none of: template strings, SQL, feature flags, serialized payloads, dashboard queries, reflection, or other repositories. Sweep those surfaces manually before calling a rename mechanical.

### Verifying the Build Instead of the Runtime

Tests that mock the refactored boundary pass regardless of what you did to it. Start the app, exercise the touched path once, and confirm import cycles, DI wiring, config keys, log names, and metric names all still work.

### Happy-Path-Only Equivalence

Matching outputs on valid inputs proves nothing about the error path, which is where refactors usually break. Include failures, timeouts, empty inputs, and the largest real record in the comparison set.

### Deleting the Old Path Too Early

Removing the legacy implementation in the same commit turns a flag flip into a redeploy. Delete it after divergence has been zero for a full cycle.

## Post-Merge Verification

For the first 24 hours or one full batch cycle, compare against the recorded baseline:

- Error rate and exception types on the touched service
- p50/p99 latency on the touched endpoints
- Throughput of background jobs in the blast radius
- Shadow-comparison divergence counters
- A spot check of data actually written: same rows, same values, same counts

If any of these moved, revert first and diagnose after.

## See Also

- **Refactoring**: the transformations themselves - one named operation per commit
- **Test Strategy**: choosing the level of test that can actually hold behaviour still
- **Code Review**: reviewing a refactor diff by shape rather than line by line
- **CI/CD Debugging**: making baselines reproducible in the pipeline
- **Database Migrations**: reader-before-writer sequencing for persisted formats
