---
name: model-selection
description: "Use when choosing which AI model to use for a task. Match model class to the axis the task actually stresses, then measure on your own prompts."
---

# Model Selection

Picking a model is not picking "the best model." It is matching a task to the
one or two axes it actually stresses, then paying the least you can for those
axes. The frontier model is frequently the wrong answer.

## Core Principle: The Axes Are Independent

- **Treat reasoning, context length, latency, and cost as four separate axes**,
  because a model strong on one is routinely mediocre on another. A small-fast
  model can have a huge context window; a reasoning model can be slow and
  expensive while being no better at extraction than a cheap one.
- **Name the axis before you name a model.** Write down "this task needs
  multi-step reasoning and tolerates 30s latency" first. If you cannot state
  the axis, you are choosing by brand reputation, not by fit.
- **Default to the cheapest class that clears the quality bar**, then escalate
  only on measured failures. Starting at the frontier and never re-checking is
  how teams end up paying 50x for classification.

## Model Classes (describe classes, not versions)

Version names and benchmark numbers date within weeks. Reason in classes:

| Class | Strength | Weakness | Typical fit |
|---|---|---|---|
| Frontier | Peak reasoning, best instruction following | Highest price, slowest | Hard novel problems, final review |
| Reasoning | Multi-step derivation, self-correction | Thinking tokens cost real money, high latency | Math, planning, debugging |
| Mid-tier | Good general quality at moderate price | Loses on long chains | Most day-to-day work |
| Small-fast | Very cheap, very low latency | Shallow reasoning, brittle on ambiguity | Classification, routing, extraction |
| Local | Free marginal cost, private, offline | Peak quality gap, cold-start latency | Bulk, sensitive data, air-gapped |
| Embedding | Cheap semantic vectors | Cannot generate or reason | Retrieval, dedupe, clustering |

## Cost: The Axis That Dominates At Volume

- **Assume output-token price spans roughly four orders of magnitude**, from
  about $0.02 to about $75 per 1M output tokens across classes. Nothing else
  you optimize moves the bill that much.
- **For bulk classification, let price decide.** At a million items, a 100x
  price difference swamps a few points of accuracy, and a cheap model plus a
  targeted retry on low-confidence cases usually beats one expensive pass.
- **Estimate with output tokens, not input tokens**, because output is
  typically 3x to 5x the input rate and reasoning models emit hidden thinking
  tokens you still pay for.
- **Price the actual tier you will run in.** Batch tiers run roughly half
  price and cache reads roughly a tenth. Quoting a batch or cached number for
  an interactive workload understates true cost by about 2x, which is the most
  common estimation error in this whole area. Say out loud which tier your
  number assumes.
- **Use batch tiers only when minutes-to-hours latency is acceptable**, and
  prefix caching only when a large stable prefix repeats across calls;
  otherwise the discount does not apply and your forecast breaks.

## Context Window Is A Ceiling, Not A Budget

- **Plan to use at most about 70 percent of the advertised window**, because
  retrieval accuracy and instruction adherence degrade measurably past that.
  The last third of the window is marketing, not working memory.
- **Put the instruction near the end of a long prompt**, since mid-context
  material is the most likely to be ignored.
- **Prefer retrieval over stuffing.** Ten relevant chunks beat a 500k-token
  dump on both quality and price, and they make failures debuggable.
- **Chunk-and-reduce when input genuinely exceeds the working budget**, rather
  than upgrading to a bigger window. A map-reduce over a mid-tier model
  usually beats a single long-window frontier call on cost and often on
  accuracy.

## Local Models

Choose local when:

- **Data cannot leave your boundary**, because no contract or region setting
  beats never transmitting.
- **Volume is high and steady**, since fixed hardware cost amortizes and
  per-token cost goes to roughly zero.
- **You need offline or deterministic-cost operation**, so no provider outage
  or pricing change can break you.

Avoid local when:

- **The task needs peak reasoning**, because the gap to frontier is still real
  on hard multi-step problems.
- **First-call latency matters**, since cold-start model loading adds seconds
  to tens of seconds; keep the model resident or do not use it interactively.
- **You lack the ops appetite**, because you now own quantization choices,
  memory limits, and upgrade churn.

## Benchmarks Are Contaminated

- **Do not choose on published leaderboards**, because test sets leak into
  training data and vendors tune for them. Benchmark rank predicts your task
  performance weakly.
- **Build a 20-prompt eval from your real traffic** with expected outputs. It
  takes an afternoon and beats any leaderboard for your decision.
- **Include your ugly cases**: ambiguous inputs, wrong-format inputs, very
  long inputs, adversarial phrasing. Models diverge most on the ugly tail.
- **Re-run the eval when you change prompt, model, or provider**, since a
  provider-side update can shift behavior without a version bump.
- **Score with a fixed rubric, not vibes.** Exact-match, schema-valid, or a
  rated 1-5 per criterion, so results are comparable across runs.

## Reasoning Models: When Thinking Tokens Pay

Worth it:

- **Multi-step math and quantitative derivation**, where a single early error
  invalidates everything downstream.
- **Planning and architecture decisions**, where exploring alternatives before
  committing changes the answer.
- **Debugging from symptoms**, where hypothesis generation and elimination is
  the actual work.
- **Ambiguous specs**, where the model must notice a contradiction rather than
  answer the surface question.

Pure waste:

- **Field extraction and schema filling**, where the answer is copied from the
  input and thinking adds cost plus a chance of over-editing.
- **Formatting and rewriting**, where the transformation is mechanical.
- **Classification into known labels**, where a small-fast model matches the
  accuracy at a fraction of the price.
- **High-QPS interactive paths**, where the latency alone disqualifies it.

Rule: **if you cannot describe an intermediate step worth computing, do not
pay for thinking tokens.**

## Build A Fallback Chain, Not A Pick

- **Configure at least two providers for any production path**, because
  providers rate-limit, deprecate versions, and have outages, and a single
  hard-coded model is a single point of failure.
- **Order the chain by cost, not quality**: cheap primary, mid-tier on failure
  or low confidence, frontier as last resort. Most traffic never escalates.
- **Make the fallback cross-provider**, since a same-provider fallback shares
  the outage and the rate limit.
- **Pin an abstraction boundary** (one call site, model name in config) so
  swapping a class is a config change, not a refactor.
- **Log which tier served each request**, because escalation rate is your
  early warning that the primary has drifted or the task changed.

## Decision Table

| Task | Dominant axes | Start with | Notes |
|---|---|---|---|
| Code review | Reasoning, context quality | Mid-tier, frontier on critical paths | Feed diffs plus relevant files, not whole repos |
| Bulk extraction | Cost, throughput | Small-fast or local | Enforce a schema; retry failures one tier up |
| Classification at volume | Cost | Small-fast, batch tier | Price difference dominates accuracy deltas |
| Creative drafting | Style quality, latency tolerance | Mid-tier to frontier | Reasoning models add little; taste is not derivation |
| Agentic tool loops | Instruction following, latency, cost per step | Mid-tier | Many calls per task multiply price; reliability of tool-call format matters more than raw IQ |
| Translation | Language coverage, cost | Mid-tier | Check your specific language pair; coverage varies wildly by class |
| Vision / document parsing | Modality support, resolution handling | Vision-capable mid-tier | Verify page-count and image-size limits before committing |
| Retrieval / dedupe | Cost, vector quality | Embedding | Never use a chat model where an embedding model will do |
| Summarization of long docs | Context quality, cost | Mid-tier plus map-reduce | Do not buy a bigger window to avoid chunking |

## Worked Example

Task: classify 800k support tickets into 12 categories, nightly, no hard
latency requirement, tickets contain customer names.

1. **Axes**: cost dominates (800k items), reasoning is shallow (12 known
   labels), latency is irrelevant (nightly batch), privacy is a live concern
   (PII in text).
2. **Reject frontier**: at frontier output pricing this is a large recurring
   bill for a task with a known label set. No intermediate reasoning step is
   worth paying for.
3. **Reject reasoning class**: the label is inferable from the ticket surface;
   thinking tokens buy nothing.
4. **Shortlist**: small-fast hosted on the batch tier, versus a local
   mid-size model on owned hardware.
5. **Eval**: 20 hand-labeled tickets including 5 ambiguous ones. Both clear
   the bar; local trails by a couple of points on the ambiguous tail.
6. **Cost check**: quote the hosted option at the batch rate (roughly half of
   interactive) and state that explicitly, so nobody later compares it against
   an interactive number. Local marginal cost is near zero but carries fixed
   hardware and ops cost.
7. **Decide**: local model primary, since PII stays in-boundary and volume is
   steady. Route low-confidence outputs (under a tuned threshold, about 5
   percent of traffic) to a hosted mid-tier model as a second pass.
8. **Fallback**: if local inference is down, the whole batch falls through to
   the hosted small-fast model on the batch tier, different provider than the
   second-pass model.

Result: the expensive class touches only the hard 5 percent, and no single
outage stops the nightly run.

## Red Flags

- **"We use the best model for everything"**: you are overpaying, likely by an
  order of magnitude, on the majority of calls.
- **"It scored top on the leaderboard"**: contaminated signal; ask for the
  in-house eval instead.
- **"We need the million-token window"**: usually a missing retrieval step.
- **A cost estimate with no tier named**: assume it is wrong by 2x or 10x.
- **One model name hard-coded at twelve call sites**: no fallback is possible
  and no migration is cheap.
