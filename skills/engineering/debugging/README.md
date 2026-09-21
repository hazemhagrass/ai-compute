# Systematic Debugging

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

A methodical approach to finding and fixing the root cause of bugs instead of patching symptoms.

## What It Does

This skill provides a systematic debugging framework that:

- Ensures you reproduce bugs reliably before attempting fixes
- Uses binary search techniques to narrow down the cause (code changes, input, execution path)
- Distinguishes between symptom patches and root cause fixes
- Provides practical instrumentation strategies (logging, debuggers, system tools)
- Recognizes common bug classes on sight (race conditions, timezone issues, floating point errors)
- Validates fixes properly before considering the work done

The core principle: if you cannot explain why the bug happened, you have not fixed it.

## When to Use

Reach for this skill when you encounter:

- **Unexplained failures**: tests fail, APIs return errors, processes crash without obvious cause
- **Intermittent bugs**: works sometimes, fails other times, especially in CI or under load
- **Regressions**: "it worked last week" or "it works in dev but fails in staging"
- **Mysterious behavior**: data corruption, wrong calculations, unexpected state changes
- **Performance anomalies**: slow first calls, timeouts on specific inputs, or inexplicable hangs
- **Integration failures**: third-party API calls fail, database queries error out, external services timeout

Symptoms that definitely trigger this workflow:

- You are on your third guess about what might fix it
- The error message does not make sense
- Adding a log line makes the bug vanish
- The bug only happens for some users or at certain times
- Your fix worked locally but failed in CI
- You cannot reliably reproduce the issue

## Quick Start: Concrete Debugging Session

Here is a realistic debugging session from start to finish.

**Scenario**: API endpoint `/api/orders/123/total` returns 500 error intermittently.

### Step 1: Reproduce Reliably

```bash
# Pin the environment
export TZ=UTC LANG=C.UTF-8
git stash list && git rev-parse --short HEAD

# Try to reproduce
for i in {1..10}; do
  curl -s http://localhost:3000/api/orders/123/total | jq .
done

# Output shows: fails 3 of 10 times with "Internal Server Error"
# Flakiness is now the bug to explain
```

### Step 2: Read the Error Completely

```bash
# Check application logs
tail -100 logs/app.log | grep -A 5 "orders/123"

# Output shows:
# TypeError: cannot multiply Decimal by float
# at calculateTotal (src/orders.js:47)
# Caused by: discount value 0.1 is float, expected Decimal
```

Now we know: the bug is a type mismatch, and it is intermittent because discount values are sometimes float, sometimes Decimal.

### Step 3: Write a Failing Test

```javascript
// tests/test_orders.js
test('order total handles float discount without crashing', () => {
  const order = { subtotal: new Decimal('100.00'), discount: 0.1 };
  expect(() => calculateTotal(order)).not.toThrow();
  expect(calculateTotal(order)).toEqual(new Decimal('90.00'));
});
```

Run it:

```bash
npm test -- tests/test_orders.js
# FAIL: TypeError: cannot multiply Decimal by float
```

### Step 4: Binary Search the Code Path

```javascript
// src/orders.js:47
function calculateTotal(order) {
  // Add assertion halfway through the pipeline
  console.log('discount type:', typeof order.discount, order.discount);
  assert(order.discount instanceof Decimal || typeof order.discount === 'number',
    `discount must be Decimal or number, got ${typeof order.discount}`);
  
  const discount = new Decimal(order.discount);  // Convert to Decimal
  return order.subtotal.minus(order.subtotal.times(discount));
}
```

### Step 5: Root Cause and Fix

Root cause: discount field comes from two sources (user input as Decimal, coupon system as float), and we assumed it was always Decimal.

Fix:

```javascript
function calculateTotal(order) {
  const subtotal = new Decimal(order.subtotal);
  const discount = new Decimal(order.discount);  // Normalize both inputs
  return subtotal.minus(subtotal.times(discount));
}
```

### Step 6: Validate the Fix

```bash
# Test passes
npm test -- tests/test_orders.js
# PASS

# Revert fix and confirm test fails
git stash
npm test -- tests/test_orders.js
# FAIL

# Reapply fix
git stash pop

# Stress test the endpoint
for i in {1..50}; do
  curl -s http://localhost:3000/api/orders/123/total | jq .total
done
# All 50 succeed with correct total: 90.00
```

### Step 7: Close the Loop

```bash
# Ask: where else does this pattern exist?
grep -r "new Decimal" src/ | grep -v "order.discount"
# Found 3 other places assuming Decimal without conversion

# Fix those too, add tests, commit
git add tests/test_orders.js src/orders.js src/invoices.js
git commit -m "fix: normalize numeric inputs to Decimal before arithmetic

Root cause: discount and tax values arrive as float from coupons API
but as Decimal from user input. Decimal arithmetic throws on float.

Fix: wrap all numeric inputs in new Decimal() at boundaries.
Covered with regression test for order totals, invoices, tax calc."
```

## Key Concepts: The Systematic Loop

### 1. Reproduce First, Always

Get a deterministic repro before changing code. Write it as a command:

```bash
pytest tests/test_payments.py::test_refund_rounding -x
```

Not as a vague description ("click the refund button a few times").

Run it 3 times. If it fails 2 of 3, the flakiness is the bug.

### 2. Binary Search Three Dimensions

**Change set** (when did it break?):

```bash
git bisect start
git bisect bad HEAD
git bisect good v2.1.0
git bisect run pytest -x tests/test_payments.py::test_refund_rounding
git bisect reset
```

**Input** (what triggers it?):

Start with 200MB CSV, halve it until you have the 4 lines that crash it. Delete rows, do not edit them.

**Code path** (where does it break?):

Assert data shape at the middle stage, then bisect whichever half is wrong:

```python
assert isinstance(amount, Decimal), f"Expected Decimal, got {type(amount)}: {amount}"
```

### 3. Stop Guessing After Two Tries

Two failed guesses = stop and instrument. Add logging or use a debugger:

```bash
# Python debugger
python -m pdb -c continue script.py

# Node debugger
node --inspect-brk server.js
# Then open chrome://inspect
```

```python
# Inside code
breakpoint()  # Python 3.7+

# pdb commands:
# n (next), s (step into), c (continue), w (where/stack), pp expr, u/d (up/down frames)
```

Log values, not milestones:

```python
# Bad
log.info("processing payment")

# Good
log.info("payment: id=%s amount=%r type=%s", payment.id, amount, type(amount))
```

### 4. Change One Thing at a Time

Make one edit, rerun the repro. Two simultaneous changes make results uninterpretable.

Revert failed attempts immediately:

```bash
git checkout -- src/payments.py
```

Keep a written list of hypotheses and outcomes.

### 5. Recognize Bug Classes

**Race condition**: passes alone, fails under load. Look for shared mutable state, missing await.

**Off-by-one**: fails on first/last element or empty collections. Check `<` vs `<=`.

**Timezone**: off by whole hours, breaks near midnight. Store UTC, convert at display edge.

**Floating point**: `0.1 + 0.2 != 0.3`. Use `Decimal` for money, `math.isclose()` for comparisons.

**Cold start**: first call takes 110s and times out, second call takes 447ms. Lazy initialization, not network issues. Fix with warmup on startup.

**Stale cache**: correct after restart, wrong later. Check cache invalidation keys.

**Encoding**: mojibake, UnicodeDecodeError. Pin UTF-8 everywhere.

### 6. Validate the Fix

State the root cause in one sentence before writing the fix.

Confirm by toggling: revert the fix, watch it fail, reapply, watch it pass.

Land the failing test alongside the fix:

```bash
git add tests/test_payments.py src/payments.py
git commit -m "fix: convert payment amounts to Decimal before arithmetic

Root cause: amounts from Stripe webhook arrive as float.
Decimal * float raises TypeError."
```

Ask: where else does this class of bug exist? Fix those too.

## Common Pitfalls

### Guessing Instead of Observing

**Pitfall**: Making three speculative edits in a row without adding any instrumentation.

**Why it fails**: Guessing has no convergence property. You can guess wrong indefinitely.

**Fix**: After two failed guesses, stop and add logging or use a debugger. Observe the actual values.

### No Minimal Repro

**Pitfall**: Trying to debug against "click around the app for a while, eventually it crashes."

**Why it fails**: You cannot tell if a fix worked. You cannot write a regression test. You will retest the same broken theory five times.

**Fix**: Minimize the input and steps until you have the smallest command that still triggers the bug:

```bash
# Not this
"run the import script on production data and wait"

# This
pytest tests/test_import.py::test_malformed_date -x
```

### Symptom Patching

**Pitfall**: Adding a try/except around the error, wrapping it in `|| true`, or checking for null without understanding why it is null.

**Why it fails**: The bug comes back in a different form. You cannot explain what happened.

**Fix**: State the root cause in one sentence before writing the fix. If you cannot, keep debugging.

### Changing Multiple Things at Once

**Pitfall**: Editing three files, changing a config, and restarting the service all at once.

**Why it fails**: If it works, you do not know which change fixed it. If it breaks, you do not know which change hurt.

**Fix**: One change, one test run. Revert immediately on failure.

### Assuming It Is the Library

**Pitfall**: "Must be a bug in requests/axios/django/react."

**Why it fails**: Popular libraries have millions of runs on the happy path. Your new code has a dozen. Usually it is a contract misreading.

**Fix**: Log exactly what you send and exactly what you get back, byte for byte. Read the library source in `node_modules/` or `site-packages/` before filing a bug.

### Skipping the Error Message

**Pitfall**: Seeing an error, immediately scrolling to the stack trace, skipping the message text.

**Why it fails**: The answer is usually in the message (`KeyError: 'userId'` vs `KeyError: 'user_id'` are two different bugs).

**Fix**: Read every line of the error, top to bottom. Read the innermost cause on wrapped exceptions. Note exact values quoted.

### Ignoring "That Should Be Impossible"

**Pitfall**: Saying "that should not happen" and moving on.

**Why it fails**: That sentence marks the false assumption holding the bug in place.

**Fix**: When you say "that should be impossible," stop and verify it. Print the value, check the type, read the function that produced it.

## See Also

- [Test-Driven Development](../testing/tdd.md): Write the failing test first, which forces a reliable repro
- [Code Review](../review/code-review.md): Root cause statements belong in commit messages
- [Logging Best Practices](../observability/logging.md): Structure logs for debugging, not just milestones
- [Git Workflow](../git/workflow.md): Keep debugging commits atomic (one fix per commit)
- [Performance Profiling](../performance/profiling.md): When the bug is "too slow" instead of "crashes"
- [Integration Testing](../testing/integration.md): Verify fixes against real external dependencies
- [Production Debugging](../observability/production-debugging.md): Debugging in live systems with limited access

## Tools Reference

### Debuggers

```bash
# Python
python -m pdb script.py
python -m pdb -c continue script.py  # break on exception

# Node.js
node --inspect-brk server.js         # then chrome://inspect

# pytest with debugger
pytest --pdb tests/test_foo.py       # drop into pdb on failure
```

### Binary Search

```bash
# Git bisect (manual)
git bisect start
git bisect bad HEAD
git bisect good v1.2.0
# test, then: git bisect good | bad
git bisect reset

# Git bisect (automated)
git bisect start HEAD v1.2.0
git bisect run pytest -x tests/test_foo.py
git bisect reset
```

### System Instrumentation

```bash
# System call trace
strace -e trace=open,read,write python script.py

# Library call trace
ltrace ./binary

# Network capture
tcpdump -i any -w capture.pcap port 5432

# Process monitoring
watch -n 1 'ps aux | grep myapp'
```

### Log Analysis

```bash
# Find errors in logs
grep -i error logs/app.log | tail -50

# Context around error
grep -A 5 -B 5 "KeyError" logs/app.log

# Time-based filtering
awk '/2024-01-15 14:3[0-9]/ {print}' logs/app.log
```
