# Refactoring

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

Systematic code restructuring that changes internal structure while keeping external behavior byte-identical.

## What It Does

Refactoring transforms code structure through small, verifiable steps while holding behavior constant. Each transformation is a single, named operation (extract, inline, rename, move) applied in isolation and verified by tests before proceeding. This approach turns risky rewrites into safe, reviewable commits.

The key discipline: if behavior changes, it is not a refactor. Calling a behavior change a refactor hides risk from reviewers and breaks the revert model.

## When to Use

Apply refactoring when you encounter these code smells:

**Long Parameter List**
Four or more positional parameters, or any boolean flag parameter. Callers silently swap argument order.

**Feature Envy**
A method reads mostly another object's data instead of its own. This scatters invariant enforcement.

**Primitive Obsession**
Raw strings for IDs, emails, currency, or durations. The compiler cannot catch an order ID passed where a user ID belongs.

**Shotgun Surgery**
One conceptual change requires edits in five or more files. This predicts future bugs better than any other smell because the sixth site always gets missed.

**Temporal Coupling**
Methods must be called in a hidden order: `init()` then `configure()` then `run()`. The order should be impossible to get wrong.

## Quick Start

### Before: Temporal Coupling

```typescript
const conn = new Connection();
conn.setTimeout(5000);
conn.authenticate(token);
await conn.query("SELECT 1"); // throws at runtime if auth was skipped
```

### After: Type-Enforced Order

```typescript
const authed: AuthedConnection = await Connection
  .open({ timeoutMs: 5000 })
  .authenticate(token);
await authed.query("SELECT 1"); // unreachable without auth
```

### Before: Primitive Obsession + Long Parameter List

```typescript
function transfer(from: string, to: string, amount: number, usd: boolean, notify: boolean) { }
transfer(b, a, 100, true, false); // arguments silently swapped
```

### After: Parameter Object + Branded Types

```typescript
type AccountId = string & { readonly __brand: "AccountId" };
function transfer(args: {
  from: AccountId;
  to: AccountId;
  amount: Money;
  notify: NotificationPolicy;
}) { }
```

## Key Concepts

### One Transformation Per Commit

Each commit performs exactly one named operation:

- **Extract**: Pull a function, method, variable, class, or module out
- **Inline**: Collapse an abstraction back into its caller
- **Rename**: Change a name consistently everywhere
- **Move**: Relocate code between files, modules, or classes
- **Change Signature**: Add, remove, reorder, or retype parameters

Keeping them separate enables clean reverts, visual review by diff shape, and bisectable regression hunts.

### Mechanical vs Semantic Changes

**Mechanical** transformations are compiler-proven:
- Rename a local variable
- Extract a pure expression into a variable
- Move a private helper within a file
- Reorder imports

Do these in bulk and trust the tool. Danger: the tool cannot see string-based references in templates, serialized config, DB values, reflection, dynamic imports, or log-parsing queries. Grep first.

**Semantic** transformations require human argument:
- Changing a signature
- Changing a data structure
- Moving code across module boundaries
- Replacing a loop with a library call
- Changing evaluation order

Do these one at a time with tests run between each.

### Expand-Migrate-Contract for Signature Changes

Atomic signature changes break every unmigrated caller at once, including callers in other repos you cannot see. Instead:

**Step 1: Expand** (additive, all existing callers still compile)

```python
# BEFORE: 9 call sites pass positional args
def send_invoice(customer_id, amount, currency, retry):
    ...

# AFTER EXPAND
def send_invoice(customer_id, amount, currency, retry, *, options: InvoiceOptions | None = None):
    options = options or InvoiceOptions(currency=currency, retry=retry)
    ...
```

**Step 2: Migrate** (one commit per module)

```python
# Migrate each call site to use options parameter
send_invoice(cust_id, amt, options=InvoiceOptions(currency=cur, retry=True))
```

**Step 3: Contract** (delete the old parameters once no caller uses them)

```python
def send_invoice(customer_id, amount, *, options: InvoiceOptions):
    ...
```

### Refactoring Without Test Coverage

Write characterization tests: tests that assert what the code currently does, bugs included, not what it should do.

1. Find the seam (the narrowest input/output pair you can call directly)
2. Call it with representative inputs and assert on the actual output
3. If a captured value looks wrong, still assert it with a comment
4. Cover only the branches you plan to touch
5. Delete characterization tests once real behavioral tests exist

```python
# Characterization test: documents current behavior
def test_format_discount_current_behaviour():
    assert format_discount(0) == ""            # not "0%"
    assert format_discount(12.5) == "12%"      # truncates, does not round
    assert format_discount(-5) == "-5%"        # characterization: suspected bug, do not fix here
```

## Common Pitfalls

### Mixing Refactor With Behavior Change

**Wrong:**
```python
# Commit: "Extract retry logic"
def send_invoice(customer_id, amount):
    retry_count = 3  # ALSO FIXED: was 1, should be 3
    ...
```

**Right:**
```python
# Commit 1: "Extract retry logic" (pure refactor)
# Commit 2: "Fix retry count from 1 to 3" (behavior change with test)
```

Now the rename can be reverted without reverting the bug fix.

### Skipping the Green Baseline

**Wrong:**
```bash
# Start refactoring immediately
git checkout -b refactor-payment-retry
# Make changes...
# Tests fail
# "These tests were probably flaky anyway"
```

**Right:**
```bash
# Record baseline FIRST
npm test > baseline.log  # All green
git checkout -b refactor-payment-retry
# Make one transformation
npm test  # New failure = your bug
```

### Big-Bang Refactors

**Wrong:**
```bash
# Three weeks later...
git diff main...refactor-everything
# 47 files changed, 3,482 insertions(+), 2,891 deletions(-)
# "It's all mechanical, trust me"
```

**Right:**
```bash
# Land small, complete refactors
git log --oneline
a1b2c3d Extract retry logic to RetryPolicy class
b2c3d4e Rename handlePayment to processPayment
c3d4e5f Move retry config to options object
```

Each diff is reviewable in under ten minutes.

### Premature Abstraction

**Wrong:**
```python
# Two similar blocks exist
class BaseHandler:
    """Shared logic for UserHandler and OrderHandler"""
    ...
```

**Right:**
```python
# Wait for the third occurrence
# Two instances are often coincidence
# Premature abstractions are harder to unwind than duplication
```

### Ignoring String-Based References

**Wrong:**
```typescript
// IDE refactor: rename sendInvoice -> processInvoice
// Ship it
```

**Right:**
```bash
# Check string references BEFORE declaring it mechanical
git grep -i "sendInvoice"
# Found in: api-schema.yaml, feature-flags.json, analytics queries
# Update these manually or file follow-up tickets
```

### No Stopping Rule

**Wrong:**
```
# Original goal: extract retry logic
# Also refactored the logger
# And the config loader
# And the database helper
# And the error formatter
# Two weeks in, still not done
```

**Right:**
```
# Stop when the original sentence is true:
# "Extract payment retry logic out of OrderService so it can be unit tested"
# Write down other improvements as follow-up issues
```

## The Stopping Rule

Stop at the first of these:

1. The sentence you wrote before starting is true
2. The test suite is green and the diff is reviewable in under ten minutes
3. You are two levels deeper than the original goal
4. You have spent more time than the change you were originally here to make
5. You have started guessing at behavior instead of confirming it with a test

Land a small, complete refactor and return later. Long-lived refactor branches lose to every merge conflict.

## Pre-Flight Checklist

Before touching anything:

1. **Run existing tests and record green baseline.** A later failure needs proof it was caused by you.
2. **Identify the observable boundary** you are promising not to change: HTTP responses, function return values, emitted events, DB writes, log lines other systems parse.
3. **If no tests exist, write characterization tests first.** A refactor with nothing holding it still is a rewrite.
4. **Write the finish line in one sentence.** Undefined scope is how refactors eat a week.
5. **Check if the code is about to be deleted.** Refactoring code with a scheduled execution date is pure waste.

## Smells to Leave Alone

Skip these because churn costs more than the smell:

- **Duplication under three occurrences.** Two similar blocks are often coincidence. Wait for the third.
- **Long functions that are straight-line, well named, and never edited.** A 200-line config builder with no branches is readable.
- **Style and naming in code you are not otherwise touching.** It conflicts with in-flight branches and buries real changes.
- **Smells in generated code, vendored code, or code behind a deprecation date.** It will be regenerated or deleted.
- **Anything in a file with no tests that you do not need to change.** Real risk, zero benefit.

## See Also

- **Test-Driven Development**: Refactoring is the third step of red-green-refactor
- **Code Review**: Small refactors are self-reviewing; big ones get rubber-stamped
- **Continuous Integration**: Fast test suites make the refactor loop tight
- **Incremental Commits**: One transformation per commit enables atomic reverts
- **Characterization Tests**: The safety net for legacy code
