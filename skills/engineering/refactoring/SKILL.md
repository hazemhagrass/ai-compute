---
name: refactoring
description: "Use when restructuring existing code. Hold behaviour still with tests, then apply one named transformation per commit and stop at a stated goal."
---

# Refactoring

Refactoring is changing structure while behaviour stays byte-identical at the observable boundary. If behaviour changes, it is not a refactor, and calling it one hides risk from reviewers.

## Before you touch anything

- Run the existing test suite and record that it passes, because a green baseline is the only evidence that a later failure was caused by you.
- Identify the observable boundary you are promising not to change (HTTP responses, function return values, emitted events, DB writes, log lines other systems parse). Everything inside it is fair game, everything on it is frozen.
- If there are no tests covering the target code, stop and write characterization tests first (see below). A refactor with nothing holding it still is a rewrite, so either add the net or announce it as a rewrite and get it reviewed as one.
- Write down the finish line in one sentence before starting ("extract payment retry logic out of `OrderService` so it can be unit tested"). Undefined scope is the main way refactors eat a week.
- Check whether the code is about to be deleted or replaced. Refactoring code with a scheduled execution date is pure waste.

## One transformation per commit

Each commit does exactly one of these, named in the commit message:

- **Extract** (function, method, variable, class, module)
- **Inline** (the reverse)
- **Rename**
- **Move** (between files, modules, classes)
- **Change signature** (add, remove, reorder, retype parameters)

Reasons to keep them separate:

- A commit mixing a rename with a signature change cannot be reverted cleanly when only one half turns out wrong.
- Reviewers can verify a pure rename by reading the diff shape alone; a mixed diff forces line-by-line reading and gets rubber-stamped instead.
- Bisecting a behaviour regression lands on a commit small enough to understand.

Never mix a refactor commit with a behaviour change commit. If you spot a bug mid-refactor, finish the transformation, commit, then fix the bug in its own commit with its own failing test. Fixing it inline makes the "no behaviour change" claim false and the diff unreviewable.

## Mechanical vs semantic changes

Treat these as two different risk classes, because the tools that make one safe do nothing for the other.

**Mechanical** (the compiler or an IDE refactor tool proves it correct): rename a local, extract a pure expression into a variable, move a private helper within a file, reorder imports.

- Do these in bulk, trust the tool, review the diff for surprises only.
- Danger: the tool cannot see string-based references. Grep for the old name in templates, serialized config, DB values, reflection, dynamic imports, and log-parsing queries before declaring a rename mechanical.

**Semantic** (requires a human argument that behaviour is preserved): changing a signature, changing a data structure, moving code across a module boundary, replacing a loop with a library call, changing evaluation order or laziness.

- Do these one at a time with tests run between each.
- For a signature change, prefer the expand/migrate/contract sequence: add the new parameter or overload with a default, migrate callers in separate commits, then delete the old form. A single atomic signature change breaks every unmigrated caller at once, including callers in other repos you cannot see.

```python
# BEFORE: 9 call sites pass positional args
def send_invoice(customer_id, amount, currency, retry):
    ...

# STEP 1 (additive, all existing callers still compile)
def send_invoice(customer_id, amount, currency, retry, *, options: InvoiceOptions | None = None):
    options = options or InvoiceOptions(currency=currency, retry=retry)
    ...

# STEP 2..N: migrate callers, one commit per module
# FINAL: delete the old parameters once no caller uses them
def send_invoice(customer_id, amount, *, options: InvoiceOptions):
    ...
```

## Refactoring without test coverage

Write characterization tests: tests that assert what the code *currently* does, bugs included, not what it should do.

1. Find the seam (the narrowest input/output pair you can call directly).
2. Call it with representative inputs and assert on the actual output you observe.
3. If a captured value looks wrong, still assert it, and add a `# characterization: suspected bug, do not fix here` comment. Fixing it now conflates two changes.
4. Cover the branches you plan to touch, not the whole file. Full coverage of code you are not moving is unpaid work.
5. Delete or rewrite characterization tests once real behavioural tests exist; they are scaffolding, not a spec.

```python
# Characterization test: documents current (including odd) behaviour
def test_format_discount_current_behaviour():
    assert format_discount(0) == ""            # not "0%"
    assert format_discount(12.5) == "12%"      # truncates, does not round
    assert format_discount(-5) == "-5%"        # negatives not rejected
```

If the code has no seam (global state, network calls, constructors doing work), introduce the seam first as its own commit (extract a function, inject a dependency) and accept that this first step is unprotected. Keep it tiny and mechanical.

## Smells worth acting on

Act on these when you are already in the file for another reason:

- **Long parameter list** (4+ positional params, or any boolean flag param). Callers get argument order wrong silently. Replace with a parameter object or keyword-only args.
- **Feature envy** (a method reads mostly another object's data). Move the method to the data. This is what keeps invariants enforceable in one place.
- **Primitive obsession** (raw `str` for ids, emails, currency, durations). Wrap in a type so the compiler catches a user id passed where an order id belongs.
- **Shotgun surgery** (one conceptual change forces edits in 5+ files). Pull the scattered knowledge into one module. This smell predicts future bugs better than any other, because the sixth site always gets missed.
- **Temporal coupling** (methods must be called in a hidden order: `init()` then `configure()` then `run()`). Make the order impossible to get wrong by returning the next-stage object or taking everything in the constructor.

```typescript
// BEFORE: temporal coupling, caller must know the sequence
const conn = new Connection();
conn.setTimeout(5000);
conn.authenticate(token);
await conn.query("SELECT 1"); // throws at runtime if auth was skipped

// AFTER: the type system enforces the order
const authed: AuthedConnection = await Connection
  .open({ timeoutMs: 5000 })
  .authenticate(token);
await authed.query("SELECT 1"); // unreachable without auth
```

```typescript
// BEFORE: primitive obsession + long parameter list + boolean flag
function transfer(from: string, to: string, amount: number, usd: boolean, notify: boolean) { }
transfer(b, a, 100, true, false); // arguments silently swapped, nobody notices

// AFTER
type AccountId = string & { readonly __brand: "AccountId" };
function transfer(args: {
  from: AccountId;
  to: AccountId;
  amount: Money;
  notify: NotificationPolicy;
}) { }
```

## Smells to leave alone

Deliberately skip these; the churn costs more than the smell:

- **Duplication under three occurrences.** Two similar blocks are often coincidence, and a premature shared abstraction is harder to unwind than the duplication was. Wait for the third.
- **Long functions that are straight-line, well named, and never edited.** A 200-line config builder with no branches is readable; splitting it adds indirection without removing complexity.
- **Style and naming in code you are not otherwise touching.** It conflicts with everyone else's in-flight branches and buries real changes in review.
- **Smells in generated code, vendored code, or code behind a deprecation date.** It will be regenerated or deleted.
- **Anything in a file with no tests that you do not need to change.** The risk is real and the benefit is zero.
- **"Clever to obvious" rewrites you cannot explain in the commit message.** If you cannot state what got better, nothing did.

## The stopping rule

Refactoring expands to fill the time available, so stop at the first of these:

- The sentence you wrote before starting is true. Stop even if you can see three more improvements; write them down as follow-up issues instead.
- The test suite is green and the diff is reviewable in under ten minutes. A refactor too big to review is a refactor too big to trust.
- You are two levels deeper than the original goal (refactoring a helper of a helper of the thing you came for). Revert the detour, land the original, start fresh if it still matters.
- You have spent more time than the change you were originally here to make. The refactor was supposed to make that change easier, not replace it.
- You have started guessing at behaviour instead of confirming it with a test. Guessing means the net has holes.

Prefer landing a small, complete refactor and returning later over holding a large one open. Long-lived refactor branches lose to every merge conflict they meet.

## Common mistakes

- **"I renamed it and also fixed the null check while I was there."** Now the revert of the rename also reverts a bug fix. Two commits, always.
- **"Tests fail but only the ones that were flaky anyway."** You do not know that. Establish the baseline first; a test failing before and after is context, a test failing only after is your bug.
- **"I extracted a `BaseHandler` so the two handlers share code."** Two callers do not justify an inheritance hierarchy. Extract a function, not a superclass, and only at three.
- **"The behaviour is a bit different but the new way is more correct."** That is a behaviour change. Ship it as one, with its own test, so the reviewer and the changelog both see it.
- **"I updated the types, the tests still pass."** Check for runtime string references first: templates, feature flags, serialized payloads, SQL, dashboards. Type checkers do not see them.
- **"It's a big diff but it's all mechanical."** Then it should be several small mechanical diffs. Size is exactly what stops reviewers from verifying that claim.
- **"I'll add the tests after the refactor lands."** Tests written after the change encode the new behaviour, so they cannot tell you whether the old behaviour survived.
