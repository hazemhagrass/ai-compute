# Phase 1: Foundation

Nothing below is safe to build on until the things here are true. The scoring engine and the cost arithmetic are pure functions that decide what a user spends money on, and both shipped with zero tests.

Tickets are GitHub issues; this file is the checklist over them. **Do not edit the
tracker block by hand** — run `node scripts/sync-plans.mjs --write`, which reads
live issue state so a closed issue flips its own box.

## Overall progress

<!-- tracker:start -->

<!-- Generated from GitHub issues. Edit the issues, not these numbers. -->

**0% done · 100% in progress**

`🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧`

🟩 **0 done** · 🟧 **5 in progress** · ⬜ **0 remaining** — 5 tickets

<!-- tracker:end -->

## Tickets

- [~] **[#2](https://github.com/hazemhagrass/ai-compute/issues/2) · Cover cost arithmetic with tests, including the estimation path** `S` — computeCost in src/lib/usage.ts converts per-1M-token prices into a dollar figure that the whole analytics surface is built on. It is currently verified only by a one-off manual check.
- [~] **[#3](https://github.com/hazemhagrass/ai-compute/issues/3) · Add CI: typecheck, lint, test, build on every push** `S` — No CI exists. The React 19 compiler lint rules in particular catch real bugs (a mid-render mutation in the donut chart was caught this way) and will rot without enforcement.
- [~] **[#5](https://github.com/hazemhagrass/ai-compute/issues/5) · Paginate and index the models list before it gets slow** `S` — listModels() returns every row with no limit. Importing from OpenRouter alone adds 446 models, and the models panel renders all of them into one table.
- [~] **[#1](https://github.com/hazemhagrass/ai-compute/issues/1) · Add a test runner and cover the scoring engine** `M` — The router has no tests at all. rankModels and taskFromText in src/lib/engine.ts are pure functions that decide which model a user spends money on, so a silent regression here is expensive a…
- [~] **[#4](https://github.com/hazemhagrass/ai-compute/issues/4) · Validate API request bodies with a schema instead of casts** `M` — Every route handler does await request.json() as SomeType, which is a lie the compiler believes. A malformed body reaches the SQLite layer and fails there, producing a 500 and a stack trace …

---

[All plans](./README.md) · [Open issues for this phase](https://github.com/hazemhagrass/ai-compute/labels/phase-1-foundation)
