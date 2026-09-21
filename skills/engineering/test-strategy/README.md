# Test Strategy

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A decision guide for choosing what to test, at which level, and how to name it so a red test reads like a violated rule instead of a line number.

## What it does

`SKILL.md` encodes a set of judgment calls about test suites:

- **Level selection.** Put the test where the bug actually lives, not where it is
  easiest to write. Six mocks means you picked the wrong level.
- **Risk-based coverage.** Coverage percentage is a lagging indicator. Track the
  branches that move money, grant access, or delete data instead.
- **Pure functions first.** Silent wrong answers (a cost calculation off by a
  cent) throw no error and pass type checks, so they need exact-value assertions.
- **Mock skepticism.** A mock is an assumption. Build fixtures from captured real
  responses, and test the degraded payloads the happy-path mock never produces.
- **Table-driven matrices.** When behavior is a function of input combinations, a
  table makes the missing row visible.
- **A do-not-test list.** Framework behavior, third party libraries, getters,
  implementation details, unread snapshots.
- **Naming and intent.** Name the rule (condition plus outcome), and write the
  assertion from the requirement rather than from reading the function body.

## When to use this

Load it when any of these are true:

- You are about to write tests for a new module and are unsure whether the case
  belongs in a unit, integration, or end to end test.
- A reviewer asked for "more coverage" and you want to argue about which coverage.
- You are writing a regression test for a bug that just shipped to production.
- A test suite is green but bugs keep escaping, which usually means the tests
  assert shape rather than value, or mock away the boundary that breaks.
- Tests fail on every refactor even though behavior did not change (the classic
  symptom of asserting implementation details).
- You are reviewing someone else's tests and need concrete criteria instead of
  taste.
- You are setting a team policy on coverage gates and want a defensible position.

Do not reach for it for test *infrastructure* problems (flaky CI runners,
container startup, fixture database seeding). That is a tooling issue, not a
strategy one.

## Quick start

Say a bug report lands: a pro customer with a large order was charged a discount
of $500 instead of the documented $50 cap.

**1. Ask which test would have gone red.** None: `discountFor` was covered only
by a "pro customer gets 10 percent" test on a small order. The cap branch was
executed by nothing.

**2. Write the failing test first, at the pure-function level.** The bug lives in
arithmetic, not in wiring, so no HTTP, no database, no mocks.

```ts
// src/pricing/discount.test.ts
import { describe, it, expect } from "vitest";
import { discountFor } from "./discount";

describe("discountFor", () => {
  const cases = [
    { name: "new customer, small order, no discount", tier: "new", cents: 1000, want: 0 },
    { name: "new customer, large order, 5 percent", tier: "new", cents: 100000, want: 5000 },
    { name: "pro customer always gets 10 percent", tier: "pro", cents: 1000, want: 100 },
    { name: "pro customer discount caps at 50 dollars", tier: "pro", cents: 1000000, want: 5000 },
    { name: "unknown tier is treated as new", tier: "bogus", cents: 100000, want: 5000 },
  ] as const;

  it.each(cases)("$name", ({ tier, cents, want }) => {
    expect(discountFor(tier, cents)).toBe(want);
  });
});
```

**3. Watch it go red before fixing anything.**

```bash
npx vitest run src/pricing/discount.test.ts
```

```
 FAIL  src/pricing/discount.test.ts > discountFor > pro customer discount caps at 50 dollars
AssertionError: expected 100000 to be 5000
```

A test you never saw fail is a test you have not verified.

**4. Fix the implementation, then re-run.**

```ts
// src/pricing/discount.ts
const CAP_CENTS = 5000;

export function discountFor(tier: string, cents: number): number {
  const rate = tier === "pro" ? 0.1 : cents >= 50000 ? 0.05 : 0;
  return Math.min(Math.round(cents * rate), CAP_CENTS);
}
```

```bash
npx vitest run src/pricing/discount.test.ts
#  ✓ src/pricing/discount.test.ts (5 tests) 4ms
```

**5. Add exactly one thin integration test** to prove the checkout route actually
calls the capped function, not to re-test the matrix:

```ts
it("applies the capped discount to a pro checkout", async () => {
  const res = await request(app)
    .post("/checkout")
    .send({ tier: "pro", cents: 1000000 });

  expect(res.body.discountCents).toBe(5000);
});
```

**6. Use coverage diagnostically, not as a gate.**

```bash
npx vitest run --coverage --coverage.reporter=text src/pricing
```

Read the uncovered branch list and ask, per branch, "can this be wrong and
silent?" If yes, write a test. If no (a logging helper, a debug formatter), leave
it uncovered deliberately and move on.

## Key concepts

**"Which test would go red?"** The opening question for every test. If the answer
is "none", that gap is the test to write, and the level it should live at.

**Risk branches.** An explicit, maintained list of code paths where a silent
wrong answer is expensive: refunds, proration, permission checks, retention
deletes, bulk destructive operations. A gap here blocks release. A gap in a
rendering helper does not.

**Silent wrong answers.** Failures that produce a plausible value rather than an
exception. Type checks and smoke tests cannot see them, which is why pure
calculations get exact-value assertions.

**Mocks as assumptions.** Every mock states a belief about a collaborator. A mock
derived from a type definition describes the contract you wish you had; a
recorded fixture describes what the provider actually sent.

**Contract tests.** Scheduled checks that validate fixtures against the live
provider schema, so drift shows up as a failing build rather than a page.

**The rewrite litmus test.** If the implementation were rewritten from scratch
against the same requirements, would this test still pass? If not, it tests
implementation, not intent.

**Deliberate non-coverage.** Leaving a branch untested on purpose, recorded as a
decision, is a valid outcome. Reflexively covering it to reach a number is not.

## Common pitfalls

**Asserting shape instead of value**

```ts
// Bad: passes when the total is 1998, 2000, or 19990.
expect(total).toBeGreaterThan(0);

// Good: catches an off by one cent.
expect(total).toBe(1999);
```

**Mocking only the happy path**

```ts
// Bad: the provider always returns a well formed payload, so the
// fallback branch is never executed by any test.
const client = { fetchQuote: vi.fn().mockResolvedValue({ amount: 1200, currency: "USD" }) };

// Good: exercise the degraded payload the real provider sends.
const client = { fetchQuote: vi.fn().mockResolvedValue({ amount: 1200 }) };
expect((await getQuote(client, "sku-1")).currency).toBe("USD");
```

**Naming the call instead of the rule**

```ts
// Bad: a failure tells you nothing about what broke.
it("test computeCost 2", () => { /* ... */ });

// Good: the failure reads as a spec violation.
it("returns 0 when the price is missing", () => {
  expect(computeCost({ quantity: 3 })).toBe(0);
});
```

**Asserting implementation details**

```ts
// Bad: fails on every refactor, passes on every real pricing bug.
const spy = vi.spyOn(pricing, "applyTax");
computeCost({ price: 100, quantity: 1 });
expect(spy).toHaveBeenCalledTimes(1);

// Good: asserts the outcome, survives a rewrite.
expect(computeCost({ price: 100, quantity: 1, taxRate: 0.1 })).toBe(110);
```

**Testing the framework, not your code**

```ts
// Bad: verifies that the ORM works, which you will never fix.
await User.create({ email: "a@b.com" });
expect(await User.count()).toBe(1);

// Good: verifies the mapping and defaults you chose.
expect(toUserRow({ email: "A@B.com" })).toEqual({ email: "a@b.com", role: "member" });
```

**Chasing a coverage number**

```bash
# Bad: a gate that rewards executing lines without asserting anything.
npx vitest run --coverage --coverage.thresholds.lines=90

# Good: read the report, triage the uncovered risk branches by hand.
npx vitest run --coverage --coverage.reporter=text src/billing
```

**Non-deterministic tests**

```ts
// Bad: fails at 23:59, passes in the morning.
expect(invoice.dueDate).toEqual(new Date());

// Good: inject the clock.
const clock = () => new Date("2026-01-15T00:00:00Z");
expect(buildInvoice({ clock }).dueDate).toEqual(new Date("2026-02-14T00:00:00Z"));
```

**Green-washing a refactor failure**

```ts
// Bad: the new behavior is copied into the expectation, deleting the
// only record of what was intended.
expect(refund.amountCents).toBe(12000); // was 10000, "updated to match"

// Good: the rule stays; if it now fails, the refactor is the bug.
it("never refunds more than the original charge", () => {
  expect(refundFor({ chargeCents: 10000, requestedCents: 12000 })).toBe(10000);
});
```

## See also

- `skills/engineering/debugging/SKILL.md` - reproduce and isolate the failure
  before you write the regression test.
- `skills/engineering/code-review/SKILL.md` - reviewing test quality, not just
  test presence.
- `skills/engineering/refactoring/SKILL.md` - which tests must survive a rewrite,
  and which are safe to delete.
- `skills/engineering/api-integration/SKILL.md` - recording real provider
  responses as fixtures and keeping contract tests honest.
- `skills/productivity/spec-first-development/SKILL.md` - deriving assertions from
  requirements rather than from the implementation.
