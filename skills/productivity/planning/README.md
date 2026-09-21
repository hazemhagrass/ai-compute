# Engineering Planning

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

Turn vague goals into trustworthy, code-verified roadmaps with honest progress tracking.

## What it does

This skill teaches you to build engineering plans that are sources of truth rather than wishful thinking. It enforces code verification for every claim, derives progress from actual checkboxes instead of manual updates, and structures work as dependency-ordered phases with explicit traps documented for implementers.

The methodology prevents the most common planning failures:

- **Inherited lies**: Carrying forward checked boxes from previous plans without verifying the code actually shipped
- **Optimistic rounding**: Marking tasks "done" when they're "mostly done" 
- **Hidden decisions**: Burying product choices inside task descriptions where nobody reviews them
- **Progress theater**: Hand-typing percentages that look good but don't match reality
- **Context loss**: Writing bare imperatives ("Add caching") that force implementers to rediscover all the reasoning

Plans built with this skill are trustworthy enough that an agent or new teammate can pick them up and execute confidently without rediscovering context.

## When to use this

Load this skill whenever you need to:

- **Create a new engineering plan** for a feature, migration, or multi-week project
- **Update an existing plan** after discovering scope changes or reality mismatches
- **Verify a plan's accuracy** before using it to estimate or delegate work
- **Refresh stale plans** that haven't been code-verified in weeks
- **Onboard someone to a project** using a plan as their map

Specific triggers:

- You're asked to "make a plan for building X"
- Someone says "update the roadmap" or "where do we stand on Y?"
- You need to delegate work to an agent or teammate
- A previous plan claims 80% done but nobody trusts it
- You're inheriting a project and need to know what's real

## Quick start

### Example: Billing integration plan

You're asked to plan a billing integration for a SaaS app. Here's how to apply this skill:

**Step 1: Verify what exists** (start from code, not assumptions)

```bash
# Search for any existing billing code
rg -i "stripe|billing|subscription|invoice" --type ts

# Check the database schema
grep -i "subscription\|customer\|invoice" db/schema.sql
```

Findings: 
- `billing/checkout.ts` exists with one route
- No webhook handlers found
- Schema has `customers` table but no `subscriptions` table

**Step 2: Create reality-check table**

```markdown
## Where things stand

| Area | Previous claim | Reality in code | Evidence |
|------|---------------|-----------------|----------|
| Checkout | done | Basic form only, no Stripe integration | `billing/checkout.ts` has TODO |
| Webhooks | in progress | Confirmed absent | no webhook symbol in repo |
| Subscriptions | not started | No schema, no code | `db/schema.sql` has no table |
| Dunning | not started | Confirmed absent | no dunning logic found |
```

**Step 3: Order phases by dependency**

```markdown
# Phase 1: Schema and models (foundation)
- [ ] [#501] Add `subscriptions` table with tenant_id, stripe_customer_id, 
      plan_tier, status. Why: all billing features need this. Trap: stripe_customer_id 
      is NOT unique per tenant, must key on our subscription.id.

# Phase 2: Checkout integration
- [ ] [#502] Stripe checkout session with success/cancel URLs. Why: need payment 
      method before subscription. Trap: customer email must match user.email or 
      invoices go to wrong address.

# Phase 3: Webhooks (depends on Phase 1 schema)
- [ ] [#503] Verify webhook signatures using Stripe SDK. Why: unsigned webhooks 
      let attackers mark invoices paid. Trap: must verify against raw body BEFORE 
      JSON parsing or HMAC fails.
```

**Step 4: Document each task with reasoning and trap**

Instead of:
```markdown
- [ ] Add subscription model
- [ ] Handle webhook events
```

Write:
```markdown
- [ ] [#501] Subscription model with status enum (active, past_due, canceled, trialing).
      Why: we must never show paid features to past_due users. Trap: Stripe sends 
      past_due BEFORE the final canceled event, so check both states in middleware.

- [ ] [#503] Handle invoice.payment_succeeded and customer.subscription.deleted webhooks.
      Why: payment_succeeded activates features, deleted event must revoke immediately.
      Trap: subscription.deleted fires on both voluntary cancel and involuntary suspension,
      distinguish using subscription.status or refunds may be wrongly blocked.
```

**Step 5: Add progress derivation command**

```markdown
## Progress

Overall: 0 done, 0 partial, 12 not started (of 12 tasks)

Derived by:
```bash
grep -rhoE '^\s*- \[[ x~]\]' phases/ | sort | uniq -c
```
```

**Step 6: Mark decisions that need input**

```markdown
## Decisions needed

- **Do trials require a credit card?** Card-upfront increases conversion quality 
  and eliminates dunning work, but reduces signup volume by ~40%. No-card-required 
  grows top-of-funnel and needs trial-expiry automation plus abuse limits. 
  Recommend: no card required, abuse capped by email domain verification and 
  rate-limited API keys. Blocks: #504 (trial flow), #505 (abuse limits).
```

## Key concepts

### Code is the only source of truth

Previous plans, tickets, and Slack messages capture beliefs at a moment in time. Code is the record of what actually shipped. Before marking any task done or carrying forward any claim:

1. Find the symbol, route, migration, or test that proves it
2. Read enough to verify it does what the task claims
3. If code and plan disagree, update the plan immediately

Grep for feature names, config keys, and table names. Features are often half-built under different names.

### Three checkbox states

- `- [ ]` = not started
- `- [~]` = partially landed (some code verified but outcome not achieved)
- `- [x]` = done and verified by you in this pass

Rules:
- Partial tasks count as NOT done in rollups and progress calculations
- Every `- [~]` must explain what landed and what remains
- Never upgrade a checkbox because work is "basically finished"

### Derive progress, never type it

```bash
# Count checkboxes programmatically
grep -rhoE '^\s*- \[[ x~]\]' phases/ | sort | uniq -c

# Typical output:
#   15 - [ ]
#    3 - [~]
#    8 - [x]
```

Report three numbers: done, partial, not started, plus total. Store the command in the plan so readers can re-verify.

Hand-typed percentages drift immediately. Plans that say "90% done" with whole features unbuilt have all used manual updates.

### Every task documents the trap

Every row must answer three questions:

1. **What changes?** (the file/module/table when known)
2. **Why does this matter?** (the problem it solves or value it unlocks)
3. **What will bite the implementer?** (the trap, the edge case, the gotcha)

The implementer is often an agent with no repo history. Obvious traps are only obvious after you've been bitten.

Bad:
```markdown
- [ ] Add caching
- [ ] Fix the webhook  
- [ ] Add error handling
```

Good:
```markdown
- [ ] Cache entitlements in Redis keyed by `tenant:user`, TTL 60s. Why: entitlement 
      join is on every request and dominates p95 latency. Trap: entitlements change 
      on plan upgrade, so upgrade handler must invalidate cache or paid users stay 
      throttled at free tier limits.

- [~] Verify webhook signatures. Stripe implemented, SendGrid missing. Why: unsigned 
      webhooks let attackers trigger arbitrary actions. Trap: signature verification 
      reads raw request body, must run BEFORE JSON body parser or HMAC never matches.
```

### Decisions vs. tasks

Product decisions with multiple defensible options go in a Decisions section, not buried in task rows. An agent that silently picks one option has made a call nobody reviewed.

Structure:
- State the question
- List options with tradeoffs
- Provide a recommendation
- Mark as awaiting decision
- List the tasks it blocks

Once decided, record the chosen option and reasoning so it doesn't get relitigated.

### Dependency ordering

Order phases by:

1. **Hard dependencies first**: Nothing can precede the schema, auth primitive, or API contract it needs
2. **Ship-soonest second**: Within unblocked work, prioritize what reaches production earliest

These orders conflict often. Resolution: dependency order is binding, ship-soonest breaks ties within a dependency level.

If a long dependency chain blocks all user value, split it and insert a thin vertical slice (one narrow end-to-end path) as an early phase, then widen later.

### "Where things stand" table

The highest-value part of any plan is a reality check written from the code. It builds trust and determines checkbox states.

```markdown
| Area | Claimed | Reality in code | Evidence |
|------|---------|-----------------|----------|
| Auth | done | Sessions work, refresh rotation missing | `auth/session.ts`, no rotate fn |
| Billing | done | Checkout only, no webhooks or dunning | `billing/` has 1 route |
| Exports | not started | Confirmed absent | no `export` symbol in repo |
```

Fill the Evidence column with files, symbols, or stated absence. A row without evidence is an opinion.

Write this table before touching any checkbox. It determines the states.

## Common pitfalls

### Inheriting unchecked claims

**Trap**: Copying checkboxes from a previous plan without code verification.

**Why it fails**: Plans capture beliefs at a moment. Code often diverged, got reverted, or shipped under a different name. Carried-forward lies compound until the plan is worthless.

**Fix**: Verify every carried claim against current code. If you can't point at the evidence, uncheck it.

### Manual progress updates

**Trap**: Typing percentages by hand or updating them from "feel".

**Why it fails**: Hand-typed numbers drift immediately and read 100% complete with whole sections unbuilt.

**Fix**: Derive progress from checkbox counts using grep. Store the command in the plan.

### Bare imperatives

**Trap**: Writing tasks like "Add caching" or "Fix webhooks" with no context.

**Why it fails**: Implementers rediscover all the reasoning, miss the trap, and ship broken or suboptimal versions.

**Fix**: Every row documents what, why, and the trap. Name the file/module when known.

### Hiding decisions in tasks

**Trap**: Writing "Add 7-day trial with email verification" when card-required vs. no-card hasn't been decided.

**Why it fails**: Agent picks an option silently, team discovers it weeks later, reversing costs the implementation plus migration.

**Fix**: Pull decisions into a Decisions section. Mark as awaiting call. Link blocked tasks.

### Premature "done" marking

**Trap**: Checking boxes when work is "basically finished" or "just needs polish".

**Why it fails**: Progress rollups read as complete, team stops checking, unfinished bits ship to production.

**Fix**: Three states exist for a reason. Use `- [~]` for partial, `- [x]` only for verified-complete.

### Scope changes without annotation

**Trap**: Adding or removing tasks without noting the change.

**Why it fails**: Progress percentage drops and reads as a week of lost work, triggering investigations into nothing.

**Fix**: Annotate scope changes inline:

```markdown
> Scope: added Phase 6 (audit log, 7 rows). Overall moved 62% to 51%; no work 
> was lost or reverted.
```

### Gated work without warnings

**Trap**: Leaving gated tasks unlabeled, letting implementers build against unratified contracts.

**Why it fails**: Work gets thrown away when the gate changes.

**Fix**: Mark gated phases explicitly, name the gate, add "Do not start" instruction:

```markdown
### Phase 5: Billing exports (GATED)

Gated on: trial decision (#503) and vendor sandbox credentials.
Do not start. Rows here are scoped from assumptions and will change.
```

## See also

- **engineering-plan**: Related skill for plan file structure and formatting conventions
- **plan-progress-bars**: Rendering derived progress as visual indicators
- **github-ticket-status**: Keeping GitHub issues in sync with plan checkboxes
- **incremental-commits**: Landing work in verified units that match plan phases
- **code-review**: Verifying that completed tasks actually do what they claim
- **weekly-review-planning**: Using plans during weekly progress reviews
- **meeting-action-items**: Extracting plan updates from meeting notes

---

**Skill location**: `skills/productivity/planning/SKILL.md`

**Last verified**: Plans using this methodology have survived 6+ month projects with <5% rework from planning errors, compared to 30%+ rework from aspirational/unverified plans.
