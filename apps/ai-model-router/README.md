# AI Model Router

A Next.js app that manages a live Hermes install's per-profile model router — providers, keys, tier config, and usage — and separately picks the right AI model for each task, tracks cost and usage, and streams multi-turn chat.

## What it does

- **Hermes profile dashboard**: lists every profile on the Hermes install this app runs on (the default install plus every `~/.hermes/profiles/<name>`), and for each one:
  - **Providers & keys** — add any of Hermes's 35+ built-in provider profiles or a custom/self-hosted endpoint (Ollama, LM Studio, vLLM…), set/replace/clear the API key (written to that profile's own `.env`, never this app's database), and see at a glance which providers have a key, which is the default, and which tiers/fallback chain reference them
  - **Router & tiers** — enable/disable Hermes's tier router, edit the classifier pool, and create/edit/rename/delete named tiers (pool, fallback, round-robin vs priority, escalate-to) — every write lands directly in that profile's `config.yaml`, atomically with a `.bak` kept
  - **Usage** — per-model call counts, token counts, and cost (actual where Hermes has billing data, estimated otherwise), read straight from that profile's `session_model_usage` table in its own `state.db`
- **Recommends models** per task using a scoring engine (quality, speed, cheapness, skills) with structured exclusion explanations
- **Streams multi-turn chat** through any provider (OpenAI, Anthropic, Gemini, Bedrock, or local Ollama)
- **Tracks cost** at the token level (cached, reasoning, input, output priced separately) and reconciles against provider invoices
- **Budgets with enforcement** (daily/weekly/monthly limits, 50/80/100% thresholds, burn-rate projection) -- a call that would cross its budget is refused with a 402 before the upstream request happens
- **Compares two models side by side** on the same prompt
- **Validates model ids** against the provider's discovery endpoint before saving
- **Health dashboard** that tests every provider connection concurrently, plus per-key verification (probe a stored key against its provider; a revoked active key is flagged even when the provider itself looks healthy)
- **Persists recommendations** so a choice can be revisited later, pruned automatically (30 days, newest-1000 cap)
- **Automatic retention** on usage data and recommendations, run at most hourly from server start / first render / analytics -- no schema growth by neglect
- **Multi-key pools per provider** with automatic rotation: a 401/403 fails over to the next stored key on the same request, and exhaustion is reported after at most one rotation
- **Subscriptions** with entitlement filtering and an implicit per-provider monthly cap (a $5 plan means $5 across that provider's traffic, not per-model)
- **Exports/imports config** (providers, models, tasks) for replication
- **Backs up and restores** the database + encryption key with verified decryption
- **Real eval harness** that measures per-axis scores (coding, reasoning, speed) to replace hand-written guesses
- **Auth with scrypt** (password + session cookies), SSRF guard (with `kind="local"` bypass for Ollama), log retention (redaction + age/count pruning), and secret rotation

## Run it

```bash
cd apps/ai-model-router
pnpm install
pnpm build
pnpm start -p 3000
```

Open `http://localhost:3000`, set a password (12+ chars). The **Hermes** tab is the default landing tab — pick a profile, add a provider, and configure tiers there. Use the **Router** tab and the rest for the standalone task-based recommender/chat/cost tooling.

By default this app manages the Hermes install at `~/.hermes` (override with `HERMES_HOME`). It must run on the same machine as that Hermes install — it edits `config.yaml` and `.env` files on disk and reads `state.db` directly; there is no remote Hermes API involved.

**Local Ollama (task-recommender providers, not the Hermes tab):**
```json
POST /api/providers
{
  "name": "Ollama",
  "baseUrl": "http://localhost:11434",
  "kind": "local",
  "chatPath": "/v1/chat/completions",
  "modelsPath": "/v1/models",
  "authType": "none"
}
```

Discover models, add them, and chat works through the router.

## Verify

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint src --max-warnings 0
pnpm test        # vitest (572 tests across 35 files)
pnpm build       # next build
```

## Deploy

See `../../docs/operations.md` for backup, restore, key rotation, and retention.

**Docker:**
```bash
# From repo root
docker compose up
```

Opens on port 3000. DB and `.secret` live in a named volume (`amr-data`). Losing the secret makes stored API keys unrecoverable — back it up. **The Hermes tab needs the container to have `~/.hermes` mounted and writable** (e.g. `-v ~/.hermes:/root/.hermes` with `HERMES_HOME=/root/.hermes`) — without that mount every profile reads as empty.

## Structure

- `src/lib/` — core logic (engine, schemas, repo, client, usage, crypto, backup, import, export, reconcile, retention, eval)
- `src/lib/hermes/` — Hermes integration: `paths.ts` (profile → file paths), `config-schema.ts`/`config-io.ts` (typed, atomic `config.yaml` read/write with `.bak`), `env.ts` (format-preserving `.env` editor), `catalog.ts` (Hermes's built-in provider list), `profiles.ts`/`providers.ts`/`tiers.ts` (mutation helpers), `usage.ts` (readonly `state.db` aggregation)
- `src/app/api/` — 39 routes (thin over lib), including `api/hermes/profiles/**` for the Hermes tab
- `src/components/` — 10 panels (hermes, router, playground, compare, analytics, logs, providers, health, models, dashboard + settings)
- `src/lib/**/*.test.ts` — 572 tests

## Architecture

The Hermes tab is a thin, direct editor of the live Hermes install's files — it does not proxy through a Hermes API or keep its own copy of provider/tier state. Every read parses the profile's `config.yaml` fresh; every write goes through `updateHermesConfig` (read → mutate → atomic write with a `.bak` of the previous version) so a crash mid-write never corrupts the file Hermes itself will read on the next turn. API keys are never stored in this app's own database for Hermes-managed providers — they're written to that profile's `.env` under the same environment variable name Hermes's own provider plugin reads (e.g. `ANTHROPIC_API_KEY`), so a key added here is immediately usable by the Hermes CLI/gateway with no extra step, and vice versa.

The router scores models per task using weighted axes (quality, speed, cheapness, plus per-capability skills like coding/reasoning/vision). Tasks carry requirements (min context, tool calling, vision) that hard-filter the candidate set; the remaining models are scored and ranked. The recommendation includes structured exclusion reports so you can see exactly why a model didn't make the cut ("needs 128k context, model has 32k").

Cost tracking happens at recordUsage: every chat logs input/output/cached/reasoning tokens with per-token pricing, so analytics can aggregate by model, provider, or task. The reconcile module compares computed cost against a provider's invoice line by line.

Authentication uses scrypt (password + per-password salt) with HMAC-signed httpOnly session cookies (12h rolling). The SSRF guard blocks private addresses by default but allows `kind="local"` providers (Ollama on localhost) to pass through. Secrets are AES-256-GCM encrypted with a master key in `.secret`; rotation re-encrypts every stored key in one transaction and verifies decryption before committing.

## License

MIT
