# AI Model Router

A Next.js app that picks the right AI model for each task, tracks cost and usage, and streams multi-turn chat through local or cloud providers.

## What it does

- **Recommends models** per task using a scoring engine (quality, speed, cheapness, skills) with structured exclusion explanations
- **Streams multi-turn chat** through any provider (OpenAI, Anthropic, Gemini, Bedrock, or local Ollama)
- **Tracks cost** at the token level (cached, reasoning, input, output priced separately) and reconciles against provider invoices
- **Budgets with alerts** (daily/weekly/monthly limits, 50/80/100% thresholds, burn-rate projection)
- **Compares two models side by side** on the same prompt
- **Validates model ids** against the provider's discovery endpoint before saving
- **Health dashboard** that tests every provider connection concurrently
- **Persists recommendations** so a choice can be revisited later
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

Open `http://localhost:3000`, set a password (12+ chars), then add providers and models.

**Local Ollama:**
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
pnpm test        # vitest (479 tests across 28 files)
pnpm build       # next build
```

## Deploy

See `../../docs/operations.md` for backup, restore, key rotation, and retention.

**Docker:**
```bash
# From repo root
docker compose up
```

Opens on port 3000. DB and `.secret` live in a named volume (`amr-data`). Losing the secret makes stored API keys unrecoverable — back it up.

## Structure

- `src/lib/` — core logic (engine, schemas, repo, client, usage, crypto, backup, import, export, reconcile, retention, eval)
- `src/app/api/` — 18 routes (thin over lib)
- `src/components/` — 8 panels (router, playground, compare, analytics, logs, providers, health, models)
- `src/lib/*.test.ts` — 479 tests

## Architecture

The router scores models per task using weighted axes (quality, speed, cheapness, plus per-capability skills like coding/reasoning/vision). Tasks carry requirements (min context, tool calling, vision) that hard-filter the candidate set; the remaining models are scored and ranked. The recommendation includes structured exclusion reports so you can see exactly why a model didn't make the cut ("needs 128k context, model has 32k").

Cost tracking happens at recordUsage: every chat logs input/output/cached/reasoning tokens with per-token pricing, so analytics can aggregate by model, provider, or task. The reconcile module compares computed cost against a provider's invoice line by line.

Authentication uses scrypt (password + per-password salt) with HMAC-signed httpOnly session cookies (12h rolling). The SSRF guard blocks private addresses by default but allows `kind="local"` providers (Ollama on localhost) to pass through. Secrets are AES-256-GCM encrypted with a master key in `.secret`; rotation re-encrypts every stored key in one transaction and verifies decryption before committing.

## License

MIT
