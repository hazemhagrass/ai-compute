---
name: architecture-review
description: "Use when reviewing an architecture or design document. Force the author to state the optimised constraint, produce rejected alternatives, name failure modes, and prove an incremental rollout and rollback path."
---

# Architecture Review

A design review happens before code exists, so there is nothing to run and
nothing to trace. The only evidence is what the document claims. Your job is to
convert claims into commitments: a stated constraint, a number, an owner, a
rollback. Anything that survives that conversion is reviewable. Anything that
does not is a decision nobody has made yet.

This operates one level above `../code-review` (which judges a diff against its
stated intent), `../api-design` (contracts at one boundary), and
`../database-design` (one schema). Use those once the design is accepted and the
boundaries are being written.

## Make the author state the constraint being optimised for

- Refuse to review any design that does not name, in one sentence, the single
  property it optimises for: tail latency, cost per request, engineer headcount,
  regulatory boundary, time to first release. Without it every alternative looks
  equally good and the review degrades into taste.
- Require the constraint to be falsifiable, so a reviewer can point at a choice
  and say "that trades against the stated goal".
- Demand the things being sacrificed. A design that claims to improve latency,
  cost, and operability at once is either uncosted or wrong, because real designs
  spend one budget to buy another.
- Ask what number would make this design the wrong choice. If no answer exists,
  the constraint is decoration.

Bad (unreviewable, nothing to argue with):

> We are moving the order service to an event-driven architecture to improve
> scalability, decoupling, and maintainability.

Good (reviewable, states the budget and the sacrifice):

> We optimise for checkout p99 latency under 400ms during peak. Order
> confirmation becomes asynchronous, so we accept that a customer may see
> "pending" for up to 5 seconds and that we now operate a broker. We do not
> optimise for cost: this adds roughly 1.2k per month in broker and storage.

## Demand the rejected alternatives and why they lost

- Require at least two alternatives considered and rejected, each with the
  specific reason it lost against the stated constraint. A design with no
  rejected alternatives has not been designed, it has been assumed.
- Require "do nothing" or "extend what exists" to be one of them, because the
  cheapest design is usually the one already running and it must be beaten
  explicitly, not skipped.
- Reject reasons that are properties rather than measurements. "Does not scale"
  is not a reason; "single writer caps us at 800 writes per second and we project
  2,000" is.
- Watch for alternatives written to lose. A straw alternative means the real
  decision happened before the document and the review is theatre.

## Hunt the failure modes, not the happy path

For every external dependency in the diagram, ask the same four questions and
require the answer in the document, because a dependency with no stated
behaviour under failure will take the whole system down with it:

- What happens when it is **down**? Do we fail closed, fail open, queue, or serve
  stale? Name which, and who decided that customers may see stale data.
- What happens when it is **slow**? Name the timeout and what the caller does
  after it. A dependency with no timeout is a dependency that converts into
  thread exhaustion across every upstream service.
- What happens when it returns **garbage**? Malformed payload, wrong type, a
  field that is silently null. State where validation happens, because trusting a
  partner payload puts their bug inside your data.
- What happens when it is **duplicated or reordered**? Any queue, retry, or
  webhook path delivers twice eventually, so the document must say which
  operations are idempotent and what key makes them so.

Also require: the behaviour when the system starts cold with empty caches, and
the behaviour when a retry storm from a recovering dependency arrives all at
once. Both are the common way a recovery turns into a second outage.

## Check data ownership and the source of truth

- Require exactly one named owner per entity: the service that may write it.
  Shared write access means no one can reason about correctness and every bug
  becomes a multi-team investigation.
- Ask for every copy of that data (cache, read model, search index, warehouse
  table, another service's local table) and what makes each copy converge back to
  the owner. A copy with no reconciliation path drifts, and nobody learns until a
  customer reports two different numbers.
- Ask which copy a human reads during an incident, because that is the de facto
  source of truth regardless of the diagram.
- Flag any design where two services write the same field. That is not a design,
  it is a future data-corruption ticket.

## Find the distributed transaction hiding behind two sequential writes

- Trace every operation that writes to two systems. If step one commits and step
  two fails, the document must say what state the world is left in and who
  repairs it, because the process WILL be killed between those two lines.
- Reject "we will wrap it in a transaction" when the two systems are a database
  and anything else (a queue, an HTTP call, an object store, a payment provider).
  There is no shared transaction there.
- Require one of the known patterns, named explicitly: transactional outbox,
  saga with compensating actions, or an idempotent retry driven from a durable
  record. Each has a cost, and choosing is the design work.
- Require the compensating action to be real. "Refund the charge" is a second
  distributed write that can also fail, so it needs its own durable record.
- Require the reconciliation job for anything with money, entitlements, or
  external side effects, since eventual consistency without a reconciler is
  permanent inconsistency you cannot see.

## Question every new piece of infrastructure

- For each new datastore, broker, queue, cache, or service, require the operating
  cost to be written down: who patches it, who is paged for it, how it is backed
  up, how a restore is tested, and what its failure looks like at 3am to someone
  who did not design it.
- Ask what existing component could do this job adequately. A table plus an index
  beats a new search cluster until proven otherwise, because the table is already
  operated.
- Treat each new stateful component as the expensive one. Stateless services are
  cheap to add and cheap to delete; anything holding state adds backup, restore,
  migration, version-upgrade, and capacity work forever.
- Ask how it is removed if it turns out to be wrong. Infrastructure with no exit
  plan is a permanent commitment made by a document.

## Require an incremental rollout and a rollback path

- Treat a design that cannot ship in stages as unfinished, because a big-bang
  cutover has exactly one attempt and no diagnostic signal along the way.
- Require the sequence of deployable steps, each independently valuable or at
  least independently safe, and each leaving the system running.
- Require the coexistence story: old and new paths run together for some period,
  so the document must say how writes reach both and which one reads win.
- Require the rollback for each step, and mark the steps that are irreversible
  (data deleted, a type narrowed, an external contract published). See
  `../database-design` for the expand/contract migration sequence that makes
  schema steps reversible.
- Require the kill switch and the signal that triggers it. "We would roll back if
  it broke" is not a plan; a flag, a metric, and a threshold are.

## Look for the scaling assumption and demand the number

- Find every claim about volume, growth, or capacity and ask for the number
  behind it, its source (current telemetry, a business forecast, a guess), and
  the horizon it covers.
- Require current load and projected load as separate numbers, because a design
  for 100x present traffic solves a problem you may never have while making the
  next six months harder.
- Require the first component to break as load grows and roughly where. A design
  that cannot name its own bottleneck has not been sized.

Bad (unfalsifiable):

> The new pipeline will handle our expected growth and scale horizontally.

Good (sized, sourced, and bounded):

> We ingest 4.2M events per day today (p95 burst 900 events per second, from
> last quarter's metrics). Sales forecasts 3x accounts within a year, so we size
> for 15M per day and 3,000 events per second. The first limit is the per-partition
> write rate at roughly 4,000 per second; past that we add partitions, which
> requires the consumer to stop assuming per-account ordering.

## Identify the coupling that makes future change expensive

- Ask what changes together. Two components that must be deployed in lockstep are
  one component with extra network calls and worse failure modes.
- Flag shared mutable state between services (a shared database table, a shared
  cache key space) as the coupling that is hardest to remove later, because every
  consumer silently depends on the physical layout.
- Ask which change the design makes expensive. Every architecture makes some
  future edits cheap and others costly; the review should surface which, and
  confirm the costly ones are the unlikely ones.
- Flag synchronous call chains three deep or more, since availability multiplies
  down the chain and latency adds.

## Review the design against the team that will operate it

- Check the design against the actual headcount and on-call rotation, because a
  system that needs continuous attention from people who also have a roadmap
  degrades until it fails.
- Ask how many services one engineer ends up owning under this design, and
  whether anyone other than the author can debug it.
- Require the observability plan as part of the design, not a follow-up: what
  question does an on-call engineer ask at 3am, and which dashboard or log answers
  it. A new failure mode with no signal is a failure mode debugged blind.
- Flag any technology nobody on the team has run in production. That is a real
  cost, payable during the first incident.

## Separate reversible from irreversible decisions

- Sort every decision in the document into reversible (a cache choice, an
  internal module boundary, a queue depth) and irreversible or near-irreversible
  (a published external API, a data model other teams build on, a vendor with
  contractual lock-in, deleted data, a cross-team dependency).
- Spend the review budget on the irreversible ones. Argue them to resolution.
- Push the reversible ones to a decision by trying them. Blocking a design on a
  choice that can be changed in a week burns the attention you need for the ones
  that cannot.
- Say which bucket each of your comments is in, following the severity labelling
  in `../code-review`, so the author knows what blocks approval.

## Recognise over-engineering for the actual load

- Compare the design's complexity against the numbers it just gave you. Sharding,
  multi-region, eventual consistency, and a service mesh are answers to problems
  that must be shown to exist.
- Ask what the simplest thing that works looks like, and what specific measured
  threshold forces the step up from it. If that threshold is years away, the
  design is buying insurance with the interest paid in operational load.
- Treat "we might need it later" as a reason to keep the seam clean, not to build
  the machinery now, because an unused abstraction still has to be understood,
  tested, and migrated.
- Distinguish accidental complexity (the design's own structure) from essential
  complexity (the domain). Only the second is unavoidable.

## Closing an architecture review

- Approve, approve with conditions, or send back. Say which, and say exactly what
  would move it to approved.
- State what you did not review, the same way you would on a diff: "I did not
  evaluate the cost model" is honest and useful.
- Record the accepted decision with the constraint it optimised for and the
  alternatives it beat, because in a year the reasoning is the only part anyone
  needs and the only part nobody wrote down.
