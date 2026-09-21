# ollama-router

Routes prompts to local Ollama models based on what they actually do on your
machine, not on what their model cards claim.

Point any OpenAI-compatible client at it, ask for model `auto`, and it picks
a local model by measured throughput, VRAM fit, and whether the model is
already loaded.

## Why this is not a cost router

Hosted model routers optimise cost per token. Locally that number is zero,
so the interesting constraints are different:

- **VRAM is the hard limit.** A model that does not fit spills into system
  RAM and slows down by roughly four times.
- **Cold loading dominates short requests.** Loading measured between 5 and
  55 seconds here. For a 200 token answer that is most of the wall clock.
- **Parameter count does not predict speed.** See below.

## The measurement that drives the design

Benchmarked on an RTX 4090 Laptop with 16GB of usable VRAM:

| model | size | tok/s | on GPU |
|---|---|---|---|
| qwen2.5-coder:1.5b-base | 1.0GB | 250.6 | 100% |
| qwen3:30b-a3b (MoE) | 18.6GB | 26.5 | 46% |
| qwen3:14b (dense) | 9.3GB | 7.8 | 45% |

The 30B model is **3.4 times faster than the 14B** despite being twice the
size, because it is a mixture of experts: 30.5B total parameters but only
about 13.4B active per token. A router that ranks by parameter count picks
the 14B here and is wrong by a wide margin.

This is why the router stores `total_params` and `active_params` separately,
and why it prefers a real measurement over any heuristic.

## Install

No dependencies. Python 3.10 or newer.

```bash
cd apps/ollama-router
python3 -m ollama_router discover     # read what Ollama has installed
python3 -m ollama_router bench        # measure it, smallest model first
python3 -m ollama_router models       # see the table
```

`bench` skips models far larger than VRAM by default, because those runs
take minutes at single digit tokens per second. Add `--include-oversized` if
you want the numbers anyway.

## Use it

Explain a decision without running anything:

```bash
python3 -m ollama_router route "refactor this python function" --objective interactive
```

```
chosen:    qwen2.5-coder:7b
intent:    code
objective: interactive
reason:    qwen2.5-coder:7b for a code prompt under the interactive objective;
           fits entirely in VRAM; measured 48 tok/s; clearly ahead of llama3.1:latest
predicted: 11.2s for 512 tokens
```

Ask a question:

```bash
python3 -m ollama_router ask "explain mixture of experts in two sentences"
```

Run the server:

```bash
python3 -m ollama_router serve                # listens on 127.0.0.1:11435
```

```bash
curl -s localhost:11435/v1/chat/completions -H 'Content-Type: application/json' -d '{
  "model": "auto",
  "objective": "interactive",
  "messages": [{"role": "user", "content": "write a bash one-liner to find large files"}]
}' | python3 -m json.tool
```

The response is standard OpenAI shape plus an `x_router` block explaining the
choice, which clients that do not know about it will ignore.

## Objectives

`objective` reweights the same four signals rather than switching algorithms.

| objective | use when | favours |
|---|---|---|
| `interactive` | you are waiting at a prompt | resident models, low latency |
| `quality` | the answer matters more than seconds | larger, better models |
| `batch` | long unattended job | raw throughput, load cost amortises |
| `balanced` | default | a bit of everything |

## How a model is scored

Four sub-scores, each normalised to 0..1, combined with the objective's
weights:

- **fit** Does it sit entirely in VRAM? A measured GPU split overrides the
  size estimate, because a model that was observed spilling is spilling.
- **speed** Measured tokens per second when available, otherwise estimated
  from active parameters and clearly flagged as a guess.
- **residency** Already loaded scores full marks. Otherwise the score falls
  off with the model's measured cold load time.
- **capability** Total parameters with diminishing returns, nudged by family
  affinity (a `coder` model for a code prompt), reduced for heavy
  quantisation and for base models.

Two rules exist because the obvious version was wrong when tested:

- **Unmeasured models are discounted 15%.** Without this, an optimistic
  estimate beats an observed fact and the router prefers whatever it knows
  least about.
- **Spill is not penalised twice.** When speed was measured on a spilling
  model, the slowdown is already inside the tokens per second, so penalising
  fit again would bury a model that is demonstrably fast in spite of it.

## Hard filters

Scoring only runs on models that can do the job at all. A model is excluded,
with the reason recorded, when it lacks a required capability (`tools`,
`vision`), when it is embedding-only and the prompt needs generation, or
when its context window cannot hold the prompt plus the requested output.

## Every request is a benchmark

Routed requests write their own timings back into the registry, so the
router gets more accurate as you use it. Either view reports how close its
predictions have been:

```bash
python3 -m ollama_router history        # recent routes, predicted vs actual
curl -s localhost:11435/stats | python3 -m json.tool
```

```text
WHEN      MODEL                            OBJECTIVE       PRED   ACTUAL  TOKENS
02:34:03  nemotron-3.5-lightning:latest    balanced       11.5s     9.9s     504
02:33:51  nemotron-3.5-lightning:latest    balanced       11.5s    12.3s     662

prediction accuracy over 3 closed routes: median error 16%, 67% within 50%
```

`prediction_accuracy` compares predicted wall clock against actual for every
completed route. If it drifts, the scoring model is wrong and should not be
trusted. This is deliberately the one number the router reports about itself,
because a router that cannot predict its own latency is guessing.

## Endpoints

| method | path | purpose |
|---|---|---|
| POST | `/v1/chat/completions` | OpenAI-compatible, `"model": "auto"` to route, supports `stream` |
| POST | `/route` | explain a decision, including rejected models, without running it |
| POST | `/benchmark` | measure one model or all of them |
| POST | `/discover` | refresh the registry from Ollama |
| GET | `/models`, `/v1/models` | installed models with measured performance |
| GET | `/stats` | registry counts, VRAM, prediction accuracy |
| GET | `/routes` | recent routing decisions |
| GET | `/health` | Ollama reachability and GPU detection |

## Configuration

| variable | default | meaning |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | where Ollama lives |
| `OLLAMA_ROUTER_DB` | `router.db` | registry path |

The router talks to any Ollama over HTTP, so `--ollama http://gpu-box:11434`
points it at another machine on your network.

## Storage

SQLite, three tables. `models` holds what Ollama reports. `measurements` is
append only, one row per observed run, aggregated with a median so a single
slow sample cannot dominate. `routes` records every decision with its
predicted and actual duration.

Models that disappear from Ollama are dropped on the next `discover`, along
with their measurements, so a stale entry cannot be routed to.

## Tests

```bash
python3 -m unittest discover -s tests
```

39 tests, no network and no Ollama required: the registry is seeded with the
real numbers measured above, so the scoring logic is tested against observed
behaviour rather than invented figures.

## Limitations

- VRAM detection needs `nvidia-smi`. On Apple Silicon or AMD the fit check
  is skipped rather than guessed, and the router ranks on measured speed
  alone.
- Intent detection is regex based, not a model. Using an LLM to pick an LLM
  would add a cold load to every request, which is the latency this exists
  to avoid.
- Token estimates assume about 4 characters per token, which is fine for
  budgeting and wrong for anything needing exact counts.
- Quality is not measured. The router predicts speed and fit, and uses size
  as a rough proxy for capability. It cannot tell you which model gives the
  better answer.
