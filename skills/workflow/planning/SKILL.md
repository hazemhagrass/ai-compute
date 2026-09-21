---
name: planning
description: "Use when making or updating an engineering plan. Turn a vague goal into dependency-ordered phases with honest, derived progress."
---

# Planning

A plan is a shared source of truth about what is real. Its value comes from being
trustworthy, not from being encouraging. Every rule below exists because the
opposite behavior burned time.

## Start from the code, not from the plan

- Read the actual source for every claim before you repeat it. A previous plan is
  a snapshot of someone's belief at one moment; code is the only record of what
  shipped. Entries carried forward unverified are the single largest source of
  wasted time.
- Verify a checked box by finding the symbol, the route, the migration, or the
  test that proves it. If you cannot point at the thing, it is not done.
- When code and plan disagree, the code wins and you edit the plan in the same
  pass. Leaving the contradiction means the next reader re-does your
  investigation.
- Grep for the feature name, the config key, and the table name. Features are
  often half-present under a different name, which is a `- [~]` not a `- [x]`.

## Order phases

- Order by hard dependency first: nothing can precede the schema, the auth
  primitive, or the client contract it needs.
- Within what is unblocked, order by what reaches production soonest. Shipping
  earlier compounds: it produces real usage data and shrinks the unmerged diff.
- These two orders conflict often. Resolve it this way: dependency order is
  binding, ship-soonest order breaks ties inside a dependency level. When a long
  dependency chain blocks all user-visible value, split the chain and insert a
  thin vertical slice (one narrow path end to end) as its own early phase, then
  widen it later.
- Never reorder to make progress look better. If a phase is blocked, it stays in
  place and says so.

## Task rows carry reasoning and the trap

Every row must answer: what changes, why, and what will bite the implementer. A
bare imperative transfers zero context and forces rediscovery.

Bad:

```markdown
- [ ] Add caching
- [ ] Fix the webhook
- [ ] Improve error handling
```

Good:

```markdown
- [ ] [#412](…/issues/412) Cache resolved entitlements in Redis, keyed by
      `tenant:user`, TTL 60s. Why: the entitlement join is on every request and
      dominates p95. Trap: entitlements change on plan upgrade, so the upgrade
      handler must invalidate the key or paying users stay throttled.
- [~] [#418](…/issues/418) Verify webhook signatures. Landed for Stripe only.
      Why: unsigned webhooks let anyone mark invoices paid. Trap: the shared
      verify helper reads the raw body, so it must run before the JSON body
      parser or the HMAC never matches.
```

- Name the file or module when you know it. Guessing costs the implementer a
  search; being wrong costs them a wrong edit.
- State the trap even when it feels obvious. The implementer is often an agent
  with no history in the repo.

## Three checkbox states

- `- [ ]` not started.
- `- [~]` partially landed: some code exists and is verified, but the task's
  stated outcome is not achieved.
- `- [x]` done and verified in the code by you, in this pass.

Rules:

- `- [~]` counts as NOT done in every rollup, and is reported separately as a
  partial count. Two states cannot express "partially landed", so honesty would
  cost visibility and people round up instead.
- Every `- [~]` row must say what landed and what is missing. A partial with no
  remainder described is unusable.
- Never upgrade a state because work is "basically finished". Verified or not.

## Derive progress, never type it

- Compute counts with a command over the plan files, never by hand. Hand-counted
  plans have read 100% complete with whole sections unbuilt.
- Report three numbers, not one: done, partial, not started, plus the total.
- Store the command next to the numbers so the next reader can re-derive them.

```bash
# from the plan directory
grep -rhoE '^\s*- \[[ x~]\]' phases/ | sort | uniq -c
```

- Under-report when uncertain. An optimistic plan is worse than no plan, because
  the next person trusts it and skips verifying what it claims, and the error
  survives for weeks.
- Percentages are per phase and overall, both derived. A single global number
  hides a phase that is entirely unstarted.

## Decisions are not tasks

- Anything with more than one defensible answer goes in a Decisions section, with
  the options, the tradeoff, and a recommendation, marked as awaiting a call.
- Never bury a product decision inside a task row. An agent that silently picks
  one has made a call nobody reviewed, and reversing it later costs the
  implementation plus the migration.
- Record a resolved decision with its chosen option and reason, then link the
  tasks it unblocks. Undocumented resolutions get relitigated.

```markdown
## Decisions needed

- **Do trials require a card?** Card upfront lifts conversion quality and
  removes dunning work, but cuts signups. No card grows the funnel and needs a
  trial-expiry flow plus abuse limits. Recommend: no card, abuse capped by
  email domain. Blocks #431, #432.
```

## Gated work

- Every gated item names its gate and what unblocks it, in the row.
- Add an explicit instruction not to start it. Absent that, an eager
  implementer builds against an unratified contract and the work is thrown away.

```markdown
### Phase 5: Billing exports (GATED)

Gated on: the trial decision above, and vendor sandbox credentials.
Do not start. Rows here are scoped from assumptions and will change.
```

## Scope changes move the percentage

- When you add scope, state it in the same edit that adds it: what was added,
  how many rows, and the new denominator. Otherwise the percentage drops and
  reads as a week of lost work, which triggers an investigation into nothing.
- Same for removals: note the cut, or a jump upward looks like fabrication.

```markdown
> Scope: added Phase 6 (audit log, 7 rows). Overall moved 62% to 51%; no work
> was lost or reverted.
```

## Where things stand

The highest value part of a new or refreshed plan is a reality-check table
written from the code. It is what a reader trusts before anything else.

```markdown
## Where things stand

| Area | Claimed | Reality in code | Evidence |
|---|---|---|---|
| Auth | done | Sessions work; refresh rotation missing | `auth/session.ts`, no rotate path |
| Billing | done | Checkout only; no webhooks, no dunning | `billing/` has 1 route |
| Exports | not started | Confirmed absent | no `export` symbol in repo |
| Search | in progress | Index writes exist, no read path | `search/indexer.ts` only |
```

- Fill "Evidence" with a file, symbol, or a stated absence. A row without
  evidence is an opinion.
- Write this table before touching any checkbox. It determines the states.

## Layout: phases as files, tickets as issues

Keep one source of truth per unit of work and nothing that must be hand-synced.

```
plan/
  README.md          overview, derived progress, decisions, where things stand
  phases/
    01-foundations.md
    02-billing-core.md
    03-exports.md
```

- Each phase is one markdown file containing its goal, its dependencies, its
  exit criteria, and its task rows.
- Each task row links to a GitHub issue that holds the discussion, the diff
  links, and the detailed acceptance criteria. The row keeps only the one-line
  what, the why, and the trap.
- The issue is authoritative for status detail; the row's checkbox is a derived
  local mirror you refresh when you verify code. Do not duplicate acceptance
  criteria into the row, because two copies drift and neither becomes trusted.
- Close issues from merged work, never to tidy the plan. A closed issue with no
  code is a lie the rollup will repeat.
- Phase files are small enough to read whole. When one passes roughly 150 lines,
  split it: a phase nobody reads is a phase nobody follows.

## Plan file skeleton

```markdown
# Phase 2: Billing core

Goal: a paying customer can subscribe, change plan, and be correctly invoiced.
Depends on: Phase 1 (tenant model, sessions).
Exit criteria: a test subscribes, upgrades, and produces one correct invoice
against the vendor sandbox, with webhooks verified.

Progress: 2 done, 1 partial, 3 not started (of 6). Derived: see README command.

## Tasks

- [x] [#401](…/issues/401) Tenant-scoped customer records. Why: invoices must
      never cross tenants. Trap: the vendor customer id is not unique per
      tenant, so key on our id.
- [~] [#418](…/issues/418) Verify webhook signatures. Stripe done, vendor B
      missing. Trap: verify before the body parser.
- [ ] [#421](…/issues/421) Proration on plan change. Why: mid-cycle upgrades
      otherwise double-charge. Trap: proration and trial end interact; assert
      both in one test.

## Notes

- Blocked rows, open questions, and anything a reader should not start.
```

## Before you call a plan done

- Every `- [x]` was verified against code in this pass.
- Every `- [~]` says what landed and what remains.
- Progress numbers were produced by the command, not typed.
- Gated phases name their gate and say not to start.
- Decisions are in the Decisions section, not hidden in rows.
- Any scope change is annotated with its effect on the denominator.
- "Where things stand" matches the checkboxes.
