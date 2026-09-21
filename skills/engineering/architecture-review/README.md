# Architecture Review

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="architecture-review robot" width="200">
</div>

A review procedure for design documents that converts confident prose into stated constraints, sourced numbers, named failure modes, and a rollout you can reverse.

## What it does

This skill reviews a design or architecture proposal before any code exists, where there is nothing to run and nothing to trace, so the only evidence is what the document claims.

- **Forces the constraint into the open.** The author must name the one property being optimised for (tail latency, cost, headcount, compliance boundary, time to first release) and what is being sacrificed to buy it. Without that, every alternative looks equally good and the review collapses into taste.
- **Demands the rejected alternatives.** At least two, each with the measured reason it lost, and one of them must be "do nothing" or "extend what exists". A design with no rejected alternatives was assumed, not designed.
- **Walks the failure modes.** For every dependency: what happens when it is down, slow, returning garbage, or delivering twice. A dependency with no stated failure behaviour takes the system down with it.
- **Pins data ownership.** One named writer per entity, every copy enumerated, and a reconciliation path for each copy that keeps it converging back to the owner.
- **Finds the distributed transaction.** Any two sequential writes to different systems is a partial-failure state that needs an outbox, a saga, or an idempotent durable retry, named explicitly.
- **Prices new infrastructure.** Every new datastore, broker, or cache is charged for who patches it, who is paged, how a restore is tested, and how it gets removed if it was wrong.
- **Requires an incremental rollout.** Deployable steps, a coexistence period, a rollback per step, irreversible steps marked, and a kill switch with the metric that triggers it.
- **Demands the number behind every scaling claim.** Current load, projected load, the source of the projection, and the first component that breaks.
- **Sorts decisions by reversibility.** Review effort goes to the ones you cannot undo.

The output is an approval, a conditional approval with the exact thing that would clear it, or a send-back, plus a written record of the accepted decision and the alternatives it beat.

## When to use this

Load this skill when:

- You have been sent a design doc, RFC, or ADR and asked to review it.
- You are writing one and want to pre-empt the questions a good reviewer will ask.
- A proposal introduces a new datastore, broker, queue, or service and you need to price the operational cost honestly.
- A team is about to split a monolith, adopt events, or go multi-region and nobody has produced the number that justifies it.
- Two teams disagree about who owns a piece of data and the argument keeps reopening.
- A migration plan exists but the rollback does not.
- A design review has produced thirty comments and you cannot tell which ones block approval.

Do not use it for:

- Reviewing a diff or pull request. Use `../code-review`.
- The detailed contract at one HTTP boundary. Use `../api-design`.
- Table, column, index, and migration mechanics. Use `../database-design`.
- Turning a vague ask into requirements before a design exists. Use `../../workflow/spec-first-development`.

## Quick start

A worked pass over a proposal titled "Move notifications to an event-driven architecture".

**Step 1, find the constraint.** The document says the goal is "scalability and decoupling". That is not a constraint, so it is your first comment: which of checkout latency, notification delivery latency, cost, or team autonomy is this buying, and what is it spending to get it? Nothing else in the review is meaningful until this is answered.

**Step 2, ask for the losers.** The doc considers no alternatives. Ask for two plus "keep the synchronous call and add a retry queue", each with the measured reason it lost.

**Step 3, walk each dependency through the four questions.** The design calls an email provider inline from the consumer.

```text
down:       doc says nothing. Ask: drop, retry forever, or dead-letter?
slow:       no timeout stated. Ask for the number and what the consumer
            does after it, since an unbounded wait stalls the partition.
garbage:    provider returns 202 with a body indicating rejection. Where
            is that checked?
duplicate:  at-least-once delivery means a user gets two emails. Ask for
            the idempotency key and where it is stored.
```

**Step 4, look for the hidden distributed transaction.** The service writes the order row, then publishes the event. Between those two lines the process can die, and the order exists with no notification, forever, silently. This is a blocking comment: the design needs a transactional outbox or an equivalent durable record, and the doc must say which.

**Step 5, price the new infrastructure.** A broker is being added. Ask who operates it, whether anyone on the team has run one in production, what the backup and restore procedure is, and what its failure looks like to the on-call engineer who did not write this doc.

**Step 6, demand the scaling number.** The doc says "handles our expected growth". Ask for events per day now, projected, the source of the projection, and the first component to saturate.

**Step 7, require the rollout.** Ask for the deployable steps, the period where synchronous and event paths both run, which path is authoritative during it, the rollback for each step, and the metric plus threshold that trips the kill switch.

**Step 8, sort and close.** Mark each comment reversible or irreversible. The outbox and the data ownership question are irreversible and block approval. The broker choice and the retry policy are reversible, so raise them and let the author decide.

```text
Conditional approval. Blocking: (1) order write and event publish are a
distributed transaction with no durable record between them, (2) the
notification-preferences table is written by two services with no stated
owner. Both are irreversible once other teams build on them.
Non-blocking: broker choice, retry policy, consumer count.
Not reviewed: the cost model or the vendor contract.
```

## Key concepts

**The stated constraint.** One sentence naming the property being optimised for, plus what is sacrificed. It must be falsifiable: there has to be a number that would make this design the wrong choice. A design claiming to improve latency, cost, and operability simultaneously is uncosted, because real designs spend one budget to buy another.

**Rejected alternatives as evidence of design.** Two or more, each losing for a measured reason, with "do nothing" among them. Watch for straw alternatives written to lose, which mean the decision happened before the document and the review is theatre.

**The four dependency questions.** Down, slow, garbage, duplicated. Plus two system-wide ones: cold start with empty caches, and the retry storm that arrives when a dependency recovers. Those last two are the usual route from one outage to two.

**Source of truth.** Exactly one service may write each entity. Every cache, read model, search index, and warehouse copy needs a stated reconciliation path, because a copy with no reconciler drifts and nobody learns until a customer sees two different numbers. Ask which copy a human actually reads during an incident; that is the real source of truth.

**Two sequential writes.** Any write to a database followed by a write to a queue, an HTTP endpoint, or an object store is a distributed transaction. The process will be killed between those lines. Acceptable answers are a transactional outbox, a saga with compensating actions that are themselves durable, or an idempotent retry driven from a persisted record. Anything with money or external side effects also needs a reconciliation job.

**Operational cost of infrastructure.** Stateless services are cheap to add and delete. Anything stateful buys backup, restore, upgrade, capacity, and paging work forever. Ask what existing component could do the job adequately, and what the exit plan is.

**Incremental rollout.** A big-bang cutover gets exactly one attempt with no signal along the way. Require deployable steps, a coexistence period with stated write and read behaviour, a rollback per step, explicit marking of irreversible steps, and a kill switch defined as a flag plus a metric plus a threshold.

**Reversibility as a budget.** Sort decisions into reversible (cache choice, internal boundary, queue depth) and irreversible (published external API, a data model other teams build on, vendor lock-in, deleted data). Argue the irreversible ones to resolution; let the reversible ones be decided by trying them.

## Common pitfalls

**Reviewing a design with no stated constraint.** You will spend an hour on style disagreements and approve something nobody can defend later.

Bad:

> We are moving the order service to an event-driven architecture to improve scalability, decoupling, and maintainability.

Good:

> We optimise for checkout p99 latency under 400ms during peak. Order confirmation becomes asynchronous, so a customer may see "pending" for up to 5 seconds and we now operate a broker. We are not optimising for cost: this adds roughly 1.2k per month.

**Accepting a scaling claim with no number.** Unquantified capacity language reads as rigour and contains none.

Bad:

> The new pipeline will handle our expected growth and scale horizontally.

Good:

> We ingest 4.2M events per day today (p95 burst 900 per second, from last quarter's metrics). Sales forecasts 3x accounts within a year, so we size for 15M per day and 3,000 per second. The first limit is the per-partition write rate at roughly 4,000 per second; past that we add partitions, which requires consumers to stop assuming per-account ordering.

**Treating "we will wrap it in a transaction" as an answer** when one of the two systems is a queue, an HTTP call, or an object store. There is no shared transaction there, and the sentence hides the entire problem.

**Approving a compensating action that is itself a distributed write.** "We refund the charge" can also fail. It needs its own durable record and retry, or the saga has simply moved the inconsistency one step later.

**Letting two services write the same field.** This is never resolved by convention. It becomes a multi-team investigation the first time the values disagree, and by then both write paths have callers.

**Accepting a rollout with no rollback.** "We would roll back if it broke" is not a plan. A flag, a metric, and a threshold are. Steps that delete data or publish an external contract must be marked irreversible before they ship, not after.

**Adding infrastructure nobody on the team has operated.** The learning happens during the first incident, at the worst possible time, and that cost belongs in the design document.

**Designing for 100x current traffic.** It solves a problem you may never have while making the next six months harder, and the machinery still has to be understood, tested, and migrated by everyone who joins.

**Spending the review on reversible decisions.** Blocking approval on a cache choice that can be changed in a week burns the attention you needed for the data model other teams are about to build on.

**Judging a design against an ideal team rather than the real one.** A system that needs continuous attention from people who also have a roadmap degrades quietly until it fails.

**Approving without recording why.** In a year the reasoning is the only part anyone needs, and it is the part nobody writes down. Capture the constraint and the beaten alternatives with the decision.

## See also

- `SKILL.md` in this directory, the full procedure including the dependency failure questions and the closing checklist.
- `../code-review` for the level below this one, once the design is accepted and there is a diff, including the severity labels this skill reuses.
- `../api-design` for the contract details at each boundary the design just drew.
- `../database-design` for the expand/contract migration sequence that makes the schema steps of a rollout reversible.
- `../test-strategy` for choosing where the verification of a newly drawn boundary belongs.
- `../performance-profiling` for producing the measured numbers a design review demands instead of accepting projections.
- `../refactoring` for changing an existing structure incrementally when the review concludes the current design is the problem.
- `../../workflow/spec-first-development` for the step before this one, when the requirements themselves are still vague.
- `../../workflow/grill-me` for stress-testing your own design before sending it out for review.
- `../../security/security-audit` for the tenancy, authorization, and secret-handling review of a boundary the design proposes.
