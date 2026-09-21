---
name: test-strategy
description: "Use when writing tests or planning coverage. Choose the level where the bug would actually be caught, test pure logic and risky branches first, and name tests after the rule they enforce."
---

# Test Strategy

Deciding what to test, and at which level, is the whole job. Writing more tests
at the wrong level buys confidence you do not have.

## Pick the level where the bug would actually be caught

- Ask "if this broke, which test would go red?" before writing anything. If the
  answer is "none of them", that is the test to write, at that level.
- Test at the level the bug lives, not the level that is easiest to reach. A
  serialization bug between two services will never be caught by a unit test of
  either service, because both sides agree on the mock and disagree in prod.
- Push logic down into pure functions so the interesting cases can be tested
  cheaply, then keep the integration test thin: one happy path plus one failure
  path to prove the wiring exists.
- Use an end to end test only for flows where the cost of breakage is high and
  the seams are many (checkout, signup, payment webhooks). They are slow and
  flaky, so spend them deliberately.
- If a test needs six mocks to run, it is at the wrong level. Either move the
  logic into something pure, or move the test up to where the real collaborators
  are available.

## Coverage percentage is a lagging indicator

- Never target a coverage number. Coverage measures lines executed, not
  assertions made, so a test suite that calls everything and asserts nothing can
  hit 90 percent and catch nothing.
- Measure the questions that matter instead: are the branches that move money,
  grant access, or delete data covered by tests that assert on outcomes?
- Keep an explicit list of those risk branches (refunds, proration, permission
  checks, retention deletes, bulk destructive operations) and treat a gap there
  as a release blocker, while a gap in a rendering helper is a shrug.
- Use coverage reports diagnostically, not as a gate: an uncovered branch is a
  prompt to ask "can this branch be wrong and silent?", and if the answer is no,
  leave it uncovered on purpose.

## Pure functions first

- Test pure functions before anything else. They are the cheapest tests to write
  and they are where silent wrong answers live: a scoring function or a cost
  calculation that returns a plausible but wrong number throws no error, fails no
  type check, and ships.
- Assert on exact values for calculations, not on shape. `expect(total).toBe(1999)`
  catches an off by one cent; `expect(total).toBeGreaterThan(0)` does not.
- Cover the boundaries that arithmetic gets wrong: zero, negative, missing input,
  rounding halfway, empty collection, single element, and the maximum the domain
  allows.

```ts
import { describe, it, expect } from "vitest";
import { computeCost } from "./pricing";

describe("computeCost", () => {
  it("returns 0 when the price is missing", () => {
    expect(computeCost({ quantity: 3 })).toBe(0);
  });

  it("rounds half up to the nearest cent", () => {
    expect(computeCost({ price: 10.005, quantity: 1 })).toBe(1001);
  });

  it("ignores a negative quantity rather than crediting the customer", () => {
    expect(computeCost({ price: 500, quantity: -2 })).toBe(0);
  });
});
```

## When a mock is lying to you

- A mock encodes your belief about a collaborator. If that belief is wrong, the
  test passes and production fails, so treat every mock as an assumption that
  needs independent evidence.
- A mocked API client that always returns well formed responses will never
  exercise the fallback path that runs when the real provider omits a field.
  Write at least one test where the mock returns a degraded payload: missing
  field, null, empty array, unexpected extra field, HTTP 500, timeout.
- Build mocks from real captured responses (a recorded fixture), not from the
  type definition. Types describe the contract you wish you had; fixtures
  describe what the provider actually sent.
- Add a contract test that validates the fixture against the live schema on a
  schedule, so drift in the provider surfaces as a failing test instead of a
  pager alert.

```ts
it("falls back to the list price when the provider omits currency", async () => {
  const client = { fetchQuote: vi.fn().mockResolvedValue({ amount: 1200 }) };

  const quote = await getQuote(client, "sku-1");

  expect(quote.currency).toBe("USD");
  expect(quote.amount).toBe(1200);
});

it("returns a cached quote when the provider times out", async () => {
  const client = { fetchQuote: vi.fn().mockRejectedValue(new Error("ETIMEDOUT")) };

  await expect(getQuote(client, "sku-1")).resolves.toEqual(cachedQuote);
});
```

## Table driven tests for input matrices

- Use a table whenever behavior is a function of a combination of inputs. It
  makes the missing row visible, which prose tests never do.
- Keep one assertion shape per table so a new case is a one line change, and give
  each row a label so failures name the case instead of an index.

```ts
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

## What not to test

- Do not test framework behavior. Asserting that a route decorator registers a
  route, or that an ORM `save` writes a row, tests code you do not own and will
  not fix.
- Do not test third party libraries. Test your adapter around them: the mapping,
  the error translation, the defaults you chose.
- Do not test getters, setters, or pass through constructors. They fail only when
  the compiler already caught it.
- Do not assert on implementation details (internal method call counts, private
  state, exact DOM structure). Those tests fail on every refactor and pass on
  every real bug, which is precisely backwards.
- Do not snapshot large blobs by default. A snapshot nobody reads gets updated
  reflexively and stops being a test.

## Name the rule, not the function

- Name the test after the rule being enforced, so a failure reads like a spec
  violation instead of a line number. `returns 0 when the price is missing`
  beats `test computeCost 2`.
- A good name contains a condition and an expected outcome. If you cannot phrase
  it that way, you probably do not know what the test is protecting.
- Do not number tests or name them after the function. The function name is
  already in the describe block; repeating it wastes the only human readable
  slot you get.

```ts
// Bad: names the call, asserts the implementation, breaks on refactor.
it("test computeCost 2", () => {
  const spy = vi.spyOn(pricing, "applyTax");
  computeCost({ price: 100, quantity: 1 });
  expect(spy).toHaveBeenCalledTimes(1);
});

// Better: names the rule, asserts the outcome, survives refactor.
it("applies sales tax once to the line total", () => {
  expect(computeCost({ price: 100, quantity: 1, taxRate: 0.1 })).toBe(110);
});
```

## Document intent, do not restate the implementation

- A test that documents intent states a rule someone decided (refunds never
  exceed the original charge). A test that restates the implementation copies the
  code into assertions (asserts the helper is called with the same arguments the
  code passes it), so it can only ever agree with the code, including when the
  code is wrong.
- Litmus test: if the implementation were rewritten from scratch against the same
  requirements, would this test still pass? If no, it is testing implementation.
- Write the assertion from the requirement, not from reading the function body.
  If you wrote the test by reading the code, you inherited its bugs.
- When a test fails during a refactor and you "fix" it by copying the new
  behavior into the expectation, stop: either the test was worthless, or you just
  deleted the only record of the intended behavior.

## Working rules

- Add the regression test before the fix, and watch it fail. A test you never saw
  red is a test you have not verified.
- One behavior per test. A test with five unrelated assertions reports one
  failure and hides four.
- Keep tests deterministic: inject the clock, seed randomness, never depend on
  test ordering or shared mutable fixtures.
- Delete tests that no longer encode a rule. A suite full of noise trains the team
  to ignore red.
