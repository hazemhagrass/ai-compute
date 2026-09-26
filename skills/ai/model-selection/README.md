# Model Selection

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A decision skill for matching an AI task to the cheapest model class that clears its quality bar, instead of defaulting to the frontier model for everything.

## What it does

`SKILL.md` encodes a repeatable procedure for answering "which model should this
call use?" It replaces brand reputation and leaderboard rank with four
independent axes and a measured eval:

- **Axis separation.** Reasoning, context length, latency, and cost are treated
  as four separate dimensions. A model strong on one is routinely mediocre on
  another, so the skill forces you to name the axis your task stresses before
  you name a model.
- **Classes, not versions.** The skill reasons in six durable classes (frontier,
  reasoning, mid-tier, small-fast, local, embedding) with a strength, weakness,
  and typical fit for each. Version names and benchmark scores go stale in
  weeks; class behavior does not.
- **Cost modeling that survives review.** Output-token pricing spans roughly
  four orders of magnitude across classes. The skill requires you to estimate on
  output tokens and to state which pricing tier (interactive, batch, cached) a
  number assumes.
- **Context-window realism.** The advertised window is a ceiling, not a working
  budget. Plan for about 70 percent, put the instruction near the end of a long
  prompt, and prefer retrieval over stuffing.
- **An in-house eval instead of leaderboards.** Twenty prompts drawn from real
  traffic, scored against a fixed rubric, including the ugly tail (ambiguous,
  malformed, oversized, adversarial inputs).
- **Fallback chains.** Production paths get at least two providers ordered by
  cost, with the model name behind a single configurable call site.

It ships a decision table covering nine common task shapes, a fully worked
800k-ticket classification example, and a red-flag list for reviewing somebody
else's model choice.

## When to use this

Load this skill when:

- You are starting a new AI-backed feature and have not picked a model yet.
- Your inference bill jumped and you need to know which calls to downgrade.
- Someone proposes a frontier model for what looks like extraction,
  classification, or formatting.
- A cost estimate arrives with no pricing tier named.
- You are choosing between a hosted API and a local model for data that carries
  PII or lives under a residency constraint.
- A single hard-coded model name is spread across many call sites and you need
  to argue for an abstraction boundary.
- A reasoning model is proposed and you cannot describe the intermediate step it
  would compute.

Skip it when the model is already fixed by contract or platform, and the real
question is prompt quality. That is `../prompt-engineering/SKILL.md`.

## Quick start

Task: route inbound emails to one of 6 teams, about 40k messages a month,
replies expected within a minute, no PII constraint.

**Step 1: name the axes before naming a model.**

```
Reasoning depth : shallow (6 known labels, decided from subject + first para)
Context length  : small (under 2k tokens per message)
Latency         : matters (under 60s end to end, so no batch tier)
Cost            : moderate (40k/month, not millions)
Privacy         : no special constraint
```

Two axes dominate: latency and cost. Reasoning is explicitly not one of them.

**Step 2: pick the starting class from the decision table.**

"Classification at volume" maps to small-fast. The batch-tier note does not
apply here because the latency axis rules batch out, so this is small-fast at
the interactive rate.

**Step 3: estimate cost on output tokens, at the tier you will actually run.**

```
40,000 msgs/month
  input  ~600 tokens each  = 24M input tokens
  output ~10 tokens each   = 0.4M output tokens   (a label, nothing more)

Tier assumed: INTERACTIVE (not batch, not cached).
Small-fast class: single-digit dollars per month.
Frontier class:   two to three orders of magnitude more for the same labels.
```

Writing "Tier assumed: INTERACTIVE" on the line is the point. An estimate
without it is wrong by 2x or 10x and nobody catches it in review.

**Step 4: build a 20-prompt eval from real traffic.**

```
evals/email-routing.jsonl
  12 clear-cut messages, one obvious team each
   4 ambiguous messages that plausibly fit two teams
   2 messages forwarded as a wall of quoted replies
   1 message in a language other than English
   1 empty body with only a subject line
```

Score with a fixed rubric: exact label match, pass or fail. No vibes.

**Step 5: run the cheapest class first, escalate only on measured failure.**

```
small-fast  : 17/20, misses 3 of the 4 ambiguous cases
mid-tier    : 19/20, misses 1 ambiguous case
frontier    : 19/20, same miss, roughly 30x the price of mid-tier
```

Frontier buys nothing over mid-tier here, so it is out on measurement, not
on opinion.

**Step 6: build a chain ordered by cost, not by quality.**

```yaml
# config/models.yaml - one place, so swapping a class is config, not a refactor
email_routing:
  primary:    { provider: A, class: small-fast, confidence_floor: 0.75 }
  escalation: { provider: B, class: mid-tier }   # different provider on purpose
  log_tier:   true                                # escalation rate = drift alarm
```

Messages below the confidence floor (about 15 percent of traffic) go to the
mid-tier model. Result: 85 percent of calls run at small-fast price, quality
matches the mid-tier-everywhere option, and a provider A outage degrades
throughput instead of stopping routing.

## Key concepts

**The four axes.** Reasoning, context length, latency, cost. State which one or
two your task stresses. If you cannot, you are choosing by reputation.

**Class over version.** Reason about "small-fast" and "reasoning," never about a
specific version string, so the decision outlives the release cycle.

**Tier-qualified cost.** A price is meaningless without its tier. Batch runs
roughly half price and cache reads roughly a tenth, so quoting a batch number
for an interactive workload understates the bill by about 2x.

**The 70 percent rule.** Retrieval accuracy and instruction adherence degrade
past roughly 70 percent of the advertised context window. The last third is
marketing, not working memory.

**Thinking-token test.** Pay for a reasoning model only when you can describe an
intermediate step worth computing. Extraction, formatting, and fixed-label
classification fail this test.

**Contaminated benchmarks.** Public test sets leak into training data and
vendors tune for them, so leaderboard rank predicts your task performance
weakly. A 20-prompt in-house eval takes an afternoon and beats all of it.

**Cost-ordered fallback.** Cheap primary, mid-tier on failure or low confidence,
frontier as last resort, across providers. Most traffic never escalates.

## Common pitfalls

**Choosing by leaderboard rank.**

```
Bad:  "Model X is #1 on the reasoning benchmark, so we use it for ticket tagging."
Good: "We hand-labeled 20 tickets including 5 ambiguous ones. Small-fast scores
       18/20, mid-tier 19/20. We ship small-fast and route low-confidence
       outputs to mid-tier."
```

**Quoting a cost without its tier.**

```
Bad:  "About $400/month at current token prices."
Good: "About $400/month assuming the INTERACTIVE tier. Batch would be roughly
       $200, but our 60s SLA rules batch out, so $400 is the real number."
```

**Buying a bigger context window to skip retrieval.**

```
Bad:  Upgrade to a million-token model and paste all 340 policy documents in.
Good: Embed and index the documents, retrieve the top 10 chunks, send about 8k
       tokens to a mid-tier model, and log which chunks were retrieved so a bad
       answer is debuggable.
```

**Paying for thinking tokens on mechanical work.**

```
Bad:  Reasoning model extracts invoice_number, total, and due_date from a PDF,
      emitting hidden thinking tokens you pay for and occasionally "improving"
      a value that should have been copied verbatim.
Good: Small-fast model with a strict JSON schema. Retry schema-invalid outputs
      one tier up. The expensive class touches only the failures.
```

**Hard-coding a model name across the codebase.**

```
Bad:  The same model string appears at 12 call sites, so no fallback is
      possible and every migration is a refactor.
Good: One call site reads the model class from config. Swapping a class or
      adding a cross-provider fallback is a config change.
```

**Same-provider fallback.**

```
Bad:  primary and fallback are two models from provider A, which share the
      outage and the rate limit you were protecting against.
Good: primary on provider A, fallback on provider B, with the serving tier
      logged per request so a rising escalation rate warns you of drift.
```

**Using a chat model where an embedding model will do.**

```
Bad:  Ask a mid-tier chat model "are these two tickets duplicates?" for every
      candidate pair.
Good: Embed once, compare vectors, and send only the borderline pairs to a chat
      model. Embeddings are orders of magnitude cheaper per comparison.
```

## See also

Verified siblings in this repository:

- [`../prompt-engineering/SKILL.md`](../prompt-engineering/SKILL.md) - once the
  model class is chosen, this covers writing the prompt as an interface contract
  and parsing model output defensively with a fallback path.
- [`../../engineering/api-integration/SKILL.md`](../../engineering/api-integration/SKILL.md) -
  retries, timeouts, and failure handling for the provider calls behind a
  fallback chain.
- [`../../meta/skill-authoring/SKILL.md`](../../meta/skill-authoring/SKILL.md) -
  conventions used to write and extend `SKILL.md` files like this one.
