# Plans

Engineering trackers: what is actually built, and what is left.

## How this works

**Phases live here as markdown. Tickets live as GitHub issues.**

A phase file is a checklist with one row per ticket, and each row links to its
issue. The issue is the only place a ticket's detail, discussion, and status
live, so there is exactly one source of truth per ticket and nothing to keep in
sync by hand.

```
docs/plans/
  README.md              # this file: the all-plans progress table
  phase-01-foundation.md
  phase-02-security.md
  ...
```

Progress numbers are **derived, never typed**. Run:

```bash
./scripts/sync-plans.sh          # dry run, prints what would change
./scripts/sync-plans.sh --write  # rewrite the tracker blocks
```

It reads live issue state from the GitHub API, so a closed issue flips its
checkbox automatically. A number typed by hand is a number that will be wrong
within a week.

## Rules that are not negotiable

1. **Never tick a box you have not verified in the code.** Under-report. A plan
   with optimistic checkboxes is worse than no plan, because the next person
   skips verifying what it claims. "Done" means code plus tests, not a stub.
2. **Adding scope lowers the percentage. Say so in the same edit.** Without a
   note under the bar, a drop reads as a week of lost work.
3. **Every row carries its reasoning, not just a label.** Name the trap, the
   file that has to change, the thing that will bite. A row another agent can
   pick up cold is the only kind worth writing.
4. **A product decision is written as a decision, not quietly implemented.**
   Mark it, state the tradeoff, leave it for a human.
5. **`- [~]` means partially landed.** It counts as not done everywhere, and is
   reported separately, so honesty does not cost visibility.

## All plans

<!-- plans-table:start -->

| Phase | Focus | Progress |
| --- | --- | --- |
| [1. Foundation](./phase-01-foundation.md) | Correctness, tests, CI | ✅ complete |
| [2. Security](./phase-02-security.md) | Auth, tenancy, secret handling | ✅ complete |
| [3. Router quality](./phase-03-router.md) | Scoring, evaluation, benchmarks | not started · 0 / 6 |
| [4. Analytics](./phase-04-analytics.md) | Budgets, reporting, exports | not started · 0 / 5 |
| [5. Providers](./phase-05-providers.md) | Streaming, fallback, coverage | not started · 0 / 5 |
| [6. Release](./phase-06-release.md) | Packaging, deploy, backups | not started · 0 / 5 |
| [7. Skills](./phase-07-skills.md) | Agent skill authoring | ✅ complete |

<!-- plans-table:end -->

## Suggested order of attack

Ordered by what unblocks production soonest, not by phase number.

1. **Phase 2 auth** ([#issue](https://github.com/hazemhagrass/ai-compute/labels/phase-2-security)) —
   the app currently has none. Everything else is moot if the instance is
   public, because the keys are in it.
2. **Phase 1 tests** — the scoring engine and cost maths are pure functions with
   zero coverage. They are also the two places a silent wrong answer costs real
   money.
3. **Phase 5 streaming** — the single biggest perceived-quality gap. A 40s wait
   with no output feels broken even when it is working.
4. Everything else, by dependency.
