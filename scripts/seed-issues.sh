#!/usr/bin/env bash
# Create the ai-compute backlog as GitHub issues.
# Idempotent: skips any issue whose exact title already exists.
set -uo pipefail

REPO="hazemhagrass/ai-compute"

existing() { gh issue list --repo "$REPO" --state all --limit 500 --json title --jq '.[].title'; }
EXISTING="$(existing)"

mk() {
  local title="$1" labels="$2" body="$3"
  if grep -Fxq "$title" <<<"$EXISTING"; then
    printf '  skip  %s\n' "$title"
    return 0
  fi
  local url
  url=$(gh issue create --repo "$REPO" --title "$title" --label "$labels" --body "$body" 2>&1 | tail -1)
  printf '  %s  %s\n' "${url##*/}" "$title"
}

# ---------------------------------------------------------------- phase 1
echo "== phase 1: foundation =="

mk "Add a test runner and cover the scoring engine" \
"phase-1-foundation,type:test,size:M" \
'The router has no tests at all. `rankModels` and `taskFromText` in `src/lib/engine.ts` are pure functions that decide which model a user spends money on, so a silent regression here is expensive and invisible.

**Scope**
- Add Vitest (no config gymnastics: it reads the existing tsconfig paths via `vite-tsconfig-paths`).
- `pnpm test` and `pnpm test:watch` scripts.
- Cover, at minimum:
  - A required capability excludes a model that lacks it (`requires.vision` drops non-vision models).
  - `requires.embedding` is symmetric: embedding models are excluded from non-embedding tasks, which is the non-obvious half and currently only asserted by reading the code.
  - An unknown axis falls back to `quality * 0.7` rather than 0, so a sparsely-scored model is not silently disqualified.
  - A pinned model surfaces first even when it scores lower.
  - `taskFromText("debug a huge Rust trace cheaply")` yields debugging + longContext + cheapness.
  - Weighted mean is order-independent and bounded 0..100.

**Done when** `pnpm test` runs green in CI and covers every branch of `meetsRequirements`.'

mk "Cover cost arithmetic with tests, including the estimation path" \
"phase-1-foundation,type:test,size:S" \
'`computeCost` in `src/lib/usage.ts` converts per-1M-token prices into a dollar figure that the whole analytics surface is built on. It is currently verified only by a one-off manual check.

**Scope**
- Assert 1M in + 1M out at $5/$25 equals exactly $30 (float drift matters here; use a tolerance).
- Assert a realistic 12k/3k split at $3/$15 equals $0.081.
- Assert a local model at $0/$0 is free regardless of volume.
- Cover `readUsage` in `src/lib/client.ts`: OpenAI shape (`prompt_tokens`), Anthropic shape (`input_tokens`), and the fallback where a provider returns no usage block at all and `estimated` must come back `true`.

**Why it matters** the estimation fallback is the one that will be wrong quietly. If a provider changes its usage field name, cost silently switches to a ~4 chars/token guess and nothing surfaces it except the `estimated` flag.'

mk "Add CI: typecheck, lint, test, build on every push" \
"phase-1-foundation,type:chore,size:S" \
'No CI exists. The React 19 compiler lint rules in particular catch real bugs (a mid-render mutation in the donut chart was caught this way) and will rot without enforcement.

**Scope**
- `.github/workflows/ci.yml`, pnpm with a lockfile cache.
- Steps: `tsc --noEmit`, `eslint src --max-warnings 0`, `pnpm test`, `pnpm build`.
- Run only on changes under `apps/ai-model-router/**` so skill and doc edits do not queue a five-minute build.

**Note** `tsc --noEmit` alone fails on `RouteContext`, which Next generates into `.next/types` during build. Either run `next build` first or add `next typegen` as a pretest step. Do not "fix" this by hand-declaring the global.'

mk "Validate API request bodies with a schema instead of casts" \
"phase-1-foundation,type:chore,size:M" \
'Every route handler does `await request.json() as SomeType`, which is a lie the compiler believes. A malformed body reaches the SQLite layer and fails there, producing a 500 and a stack trace instead of a 400 and a message.

**Scope**
- Add Zod, one schema per route body, colocated with the route.
- Return `400` with field-level errors on a parse failure.
- Coerce numerics at the boundary so `updateModel` stops hand-rolling `Number(x) || 0` in fifteen places.

**Care** the tri-state `apiKey` semantics must survive: absent keeps the stored key, empty string clears it, a value replaces it. A naive `z.string().optional()` collapses the first two cases and will silently wipe keys.'

mk "Paginate and index the models list before it gets slow" \
"phase-1-foundation,type:chore,size:S" \
'`listModels()` returns every row with no limit. Importing from OpenRouter alone adds 446 models, and the models panel renders all of them into one table.

**Scope**
- Server-side pagination and a provider filter on `GET /api/models`.
- Virtualize or paginate the models table.
- Verify the existing `idx_models_provider` is actually used by the filtered query (`EXPLAIN QUERY PLAN`).'

# ---------------------------------------------------------------- phase 2
echo "== phase 2: security =="

mk "Add authentication — the app is currently wide open" \
"phase-2-security,type:security,size:L" \
'**This is the blocker for any deployment that is not localhost.** There is no auth of any kind. Anyone who reaches the port can read every logged prompt and response, add a provider pointing anywhere, and spend the stored API keys through `/api/playground`.

**Scope**
- Single-user password login is enough for v1; this is a personal tool, not a SaaS. Do not build multi-tenancy yet.
- Password hashed with `scrypt` (already a Node builtin, and `crypto.ts` sets the precedent).
- Signed, `httpOnly`, `SameSite=Lax` session cookie. Short-lived, rolling.
- Middleware gating every `/api/*` route except the login endpoint, plus the page itself.
- Rate-limit failed logins so the single password cannot be brute-forced.

**Explicitly out of scope** OAuth, SSO, user management, roles. Adding them now buys nothing and triples the surface.

**Decision needed from a human:** whether to also support a reverse-proxy trust mode (`X-Forwarded-User` from an authenticating proxy like Authelia or Cloudflare Access). It is the right answer for a homelab and the wrong one if the header can be spoofed. Do not pick this silently.'

mk "Stop logging full prompts and responses without a retention policy" \
"phase-2-security,type:security,size:M" \
'Every prompt and response is stored in full, forever, in plaintext in SQLite. That is the feature, but it is also an unbounded, unencrypted archive of everything you have ever asked a model, sitting next to the API keys.

**Scope**
- A retention setting: keep forever / 90d / 30d / do not store bodies at all.
- A per-call opt-out so a sensitive prompt can be run without persisting its text, while still recording tokens and cost.
- A prune job honouring the setting.
- Document the tradeoff in the README: analytics needs tokens and cost, not the text. The text is for *your* recall, and only you can decide if that is worth keeping.

**Consider** encrypting the `prompt` and `response` columns with the same AES-256-GCM key as the provider secrets. It costs searchability (the `LIKE` filter in `/api/logs` stops working), which is a real loss. Flag as a decision rather than choosing unilaterally.'

mk "Harden provider URLs against SSRF" \
"phase-2-security,type:security,size:M" \
'A provider base URL is user-supplied and the server fetches it. Once auth exists this is low severity, but before that it is an open proxy: `http://169.254.169.254/` reaches cloud instance metadata, and `http://localhost:*` reaches anything else on the host.

**Scope**
- Block link-local (169.254/16), and resolve the hostname before fetching so a DNS name pointing at a blocked range is caught too.
- Allow private ranges by default but behind an explicit "this is a local provider" acknowledgement, since pointing at an Ollama box on the LAN is a first-class use case and must keep working.
- Apply on save and on every fetch, because DNS can be rebound between the two.

**Do not** simply blocklist `localhost` — that breaks the primary local-model workflow.'

mk "Redact secrets from error messages returned to the browser" \
"phase-2-security,type:security,size:S" \
'`testConnection` and `chat` return `text.slice(0, 600)` from a failed upstream response straight to the client. Several providers echo the submitted Authorization header or key fragment in their 401 body, which would put a real key into the browser and into any screenshot of the error toast.

**Scope**
- Scrub anything matching the stored key, plus generic `sk-[A-Za-z0-9]{16,}` patterns, from every error surface.
- Cover both the provider test path and the playground path.
- Add a regression test with a fake upstream that echoes the key.'

mk "Rotate the encryption key without losing stored secrets" \
"phase-2-security,type:security,size:M" \
'The AES master key is generated once into `data/.secret` and never rotates. There is no path to change it, and if it leaks, every stored provider key must be re-entered by hand.

**Scope**
- `scripts/rotate-key.mjs`: decrypt every secret with the old key, re-encrypt with a new one, write atomically, keep a backup.
- Handle the `AMR_SECRET` env var case as well as the file case.
- Document that losing `.secret` is unrecoverable by design, and that it must be backed up outside git.

The ciphertext already carries a `v1.` version prefix, so a future format change is expressible. Use it.'


# ---------------------------------------------------------------- phase 3
echo "== phase 3: router quality =="

mk "Replace hand-written skill scores with a real evaluation harness" \
"phase-3-router,type:feature,size:L" \
'Every skill score in `src/lib/seed.ts` is a number I made up. They are plausible and internally consistent, which is exactly what makes them dangerous: the UI presents them with two significant figures and an explanation panel, implying a precision that does not exist.

**Scope**
- A prompt suite per axis (coding, debugging, extraction, summarization, instruction-following) with programmatically checkable answers, so scoring needs no human judgement.
- A runner that executes the suite against selected models and writes measured scores back.
- Store measured-vs-assumed provenance per score, and mark assumed scores in the UI so the distinction is visible where it matters.

**Why this is the most valuable ticket in the repo** the entire product is a ranking, and the ranking is currently built on guesses. Everything else is polish on top of that.

**Start small.** Twenty prompts across five axes against three models beats a perfect harness that never ships.'

mk "Measure real latency and throughput instead of assuming a speed score" \
"phase-3-router,type:feature,size:M" \
'`speed` is a hand-assigned 0-100, but `usage_events` already records true `latencyMs` and `tokensPerSec` for every call. The data to replace the guess is sitting in the table unused.

**Scope**
- Roll observed throughput into the speed axis once a model has enough samples (require ~10 before trusting it; a single cold-start call is noise, as the 110s Ollama timeout during testing showed).
- Weight recent samples more heavily so a provider slowdown surfaces.
- Show measured-vs-assumed in the models table.
- Keep the manual value as the prior for models with no history.'

mk "Explain why a model was excluded, not just which ones ranked" \
"phase-3-router,type:feature,size:S" \
'`rankModels` silently drops anything failing a hard requirement. When a user constrains the search and gets two results, there is no way to tell whether the other twenty were expensive, incapable, or disabled.

**Scope**
- Collect exclusions with their reason (`meetsRequirements` already computes a `why` string and then throws it away).
- Render a collapsed "18 models excluded" panel grouped by reason.
- This is the fastest path to trust in the recommendation: seeing the rejects proves the filter works.'

mk "Let a task fall back to a second model when the first fails" \
"phase-3-router,type:feature,size:M" \
'The router names one model. In practice a provider 429s, a local box is asleep, or a model is deprecated, and the answer should be "use this, or that if it is down" rather than a dead end.

**Scope**
- An ordered fallback chain per task, defaulting to the top three ranked.
- The playground and any future API consumer walk the chain on 429/5xx/timeout.
- Log which chain position actually served, so analytics can show how often the primary fails.

Mirrors how the user already configures Hermes model routing, so the mental model transfers.'

mk "Compare two models side by side on the same prompt" \
"phase-3-router,type:feature,size:M" \
'Deciding between two candidates currently means running one, switching the dropdown, running the other, and comparing from memory. The data model already supports this; only the UI is missing.

**Scope**
- Run one prompt against N models concurrently.
- Show answers, tokens, latency, and cost in parallel columns.
- Tag all resulting usage events with a shared comparison id so the run is reconstructible from the logs.'

mk "Persist recommendations so a choice can be revisited" \
"phase-3-router,type:feature,size:S" \
'A recommendation exists only in React state. Reload the page and the reasoning is gone, which makes it impossible to ask "why did I pick this three weeks ago".

**Scope**
- Persist each recommendation with its inputs, constraints, and ranked output.
- A history view, and a diff against what the same query returns today, so a price or score change that flips the answer is visible.'

# ---------------------------------------------------------------- phase 4
echo "== phase 4: analytics =="

mk "Add budgets with alerts before the bill arrives" \
"phase-4-analytics,type:feature,size:M" \
'Analytics is entirely retrospective. It tells you what you spent after you spent it, which is the least useful moment to learn it.

**Scope**
- Monthly budget, global and optionally per provider.
- A visible burn-down: spend to date, run rate, projected month end.
- Warn at 80%, and offer a hard stop at 100% that refuses new calls (opt-in, since a silent refusal mid-task is its own failure mode).

**Decision for a human** whether the hard stop blocks or merely warns. Blocking is safer for the wallet and worse for a long agent run that dies at token 300k.'

mk "Export usage data as CSV and JSON" \
"phase-4-analytics,type:feature,size:S" \
'Usage data is trapped behind the analytics UI. Reconciling against a real provider invoice, or pivoting in a spreadsheet, needs the rows.

**Scope**
- `GET /api/logs/export?format=csv|json` honouring the current filters.
- Stream rather than buffer: this table grows without bound.
- Include computed cost and the `estimated` flag, so a consumer knows which rows are approximations.'

mk "Reconcile computed cost against real provider invoices" \
"phase-4-analytics,type:feature,size:L" \
'Cost is computed from stored per-1M prices, so it is an estimate that drifts from reality: cache discounts, batch pricing, tiered rates, and free-tier credits are all invisible to it.

**Scope**
- Where a provider exposes a usage or cost API (OpenAI and Anthropic both do), pull actuals and show computed-vs-actual.
- Surface the delta as a percentage so a systematically wrong price corrects itself.
- Prompt-cache hits are the likeliest source of overstatement; `cached_tokens` is already recorded but not yet priced differently.'

mk "Price cached tokens separately from fresh input tokens" \
"phase-4-analytics,type:feature,size:M" \
'`cached_tokens` is recorded and then ignored by `computeCost`. Cache reads are roughly a tenth the price on Anthropic and OpenAI, so any workload reusing a large system prompt is being systematically overcharged in the reporting.

**Scope**
- Add a cache-read price per model, syncable from the catalogue where available.
- Bill cached tokens at that rate.
- Show the cache saving explicitly; it is a genuinely satisfying number to watch.'

mk "Show the true cost of a multi-turn conversation" \
"phase-4-analytics,type:feature,size:M" \
'Every call is logged independently, so the compounding cost of a long conversation (where the whole history is resent each turn) is invisible. That resend is the dominant cost in agentic use and nothing in the UI shows it.

**Scope**
- A conversation id grouping related calls.
- Cumulative cost and context growth across a thread.
- Flag when resent history exceeds fresh input, which is the moment to compact.'

# ---------------------------------------------------------------- phase 5
echo "== phase 5: providers =="

mk "Stream responses instead of blocking until the last token" \
"phase-5-providers,type:feature,size:L" \
'The playground waits for the full response. A 40-second generation looks identical to a hang, which is the single biggest perceived-quality gap in the app.

**Scope**
- SSE from the route handler, incremental render in the panel.
- Usage arrives in the final chunk for both OpenAI and Anthropic shapes; log the event only after it lands, so cost stays accurate.
- On a mid-stream abort, log what was received with the partial flag set rather than dropping the event, because a partial generation still costs money.

**Trap** `streaming: true` is already advertised per model in the features flags, so the UI currently implies a capability that does not exist.'

mk "Support multi-turn conversations, not just single prompts" \
"phase-5-providers,type:feature,size:M" \
'`chat()` takes one system and one user string. Testing a model on anything conversational, or on how it handles a long context, is impossible.

**Scope**
- Accept a message array end to end.
- Thread UI in the playground with edit-and-resend.
- Pairs with the conversation-cost ticket; do that one after this lands.'

mk "Add native Gemini and Bedrock request shapes" \
"phase-5-providers,type:feature,size:M" \
'The client speaks OpenAI-compatible and Anthropic Messages. Gemini is reachable through its OpenAI compatibility layer, which works but silently drops native features (system instructions, safety settings, and its distinctive multimodal parts). Bedrock is not reachable at all: it needs SigV4 request signing, which none of the existing auth types cover.

**Scope**
- A pluggable request/response adapter per shape rather than growing `isAnthropic` into a chain of booleans. That boolean is already the seam where this design decision has to be made.
- SigV4 signing as a new auth type.'

mk "Validate that a model id actually exists on its provider" \
"phase-5-providers,type:feature,size:S" \
'A model id is free text. A typo surfaces as a 404 from the provider at call time, buried in a raw error string, long after the mistake was made.

**Scope**
- On save, check the id against the provider model list where one is available.
- Warn rather than block: a brand-new model may not be listed yet, and blocking would be worse than the typo.
- Periodically re-check and flag models that have disappeared, since silent deprecation is common.'

mk "Test every provider connection at once with a health dashboard" \
"phase-5-providers,type:feature,size:S" \
'Connections are tested one provider at a time by hand. With seventeen configured, finding the broken one is tedious enough that it will not be done.

**Scope**
- Test all in parallel, with a status grid and recorded latency.
- Optional scheduled re-check and a history sparkline.
- Respect a per-provider timeout; a sleeping local box should not hold the whole sweep.'

# ---------------------------------------------------------------- phase 6
echo "== phase 6: release =="

mk "Ship a Dockerfile and compose file" \
"phase-6-release,type:chore,size:M" \
'Deployment today is `pnpm build && pnpm start` on a machine with the right Node version. That is fine for localhost and nothing else.

**Scope**
- Multi-stage Dockerfile; `better-sqlite3` is a native module, so the build stage needs toolchain and the runtime stage does not.
- Compose file mounting `data/` as a named volume, with `AMR_SECRET` from the environment.
- Document that the volume holds both the database and the encryption key, and that losing the latter is unrecoverable.
- Run as non-root, and make sure the data directory is writable by that user.'

mk "Back up and restore the database and encryption key" \
"phase-6-release,type:chore,size:M" \
'There is no backup story. The SQLite file holds every provider key and the entire prompt archive, and `.secret` is the only thing that can decrypt the keys.

**Scope**
- `scripts/backup.sh` using the SQLite online backup API, not a file copy: the database runs in WAL mode and a naive `cp` can capture a torn state.
- Include `.secret`, clearly marked, with a loud warning that the archive is as sensitive as the keys themselves.
- A verified restore path, tested by actually restoring into a scratch directory.'

mk "Import a config export back into a fresh instance" \
"phase-6-release,type:chore,size:S" \
'`GET /api/export` produces a config backup that nothing can consume. Export without import is a false sense of safety.

**Scope**
- `POST /api/import` with merge-or-replace semantics.
- Match providers by slug, models by provider plus model id.
- Keys are deliberately absent from an export, so the import must clearly report which providers need their key re-entered rather than silently producing dead providers.'

mk "Write the deployment and operations guide" \
"phase-6-release,type:docs,size:S" \
'The README covers what the app is and how to run it locally. Nothing covers running it somewhere real.

**Scope**
- Reverse proxy config, TLS, and the auth requirement stated as a prerequisite rather than a suggestion.
- `AMR_SECRET` and `AMR_DATA_DIR` handling, and what happens when each is missing.
- Backup, restore, and upgrade procedure.
- A short threat model: what this app protects against and what it does not.'

mk "Add a repo-level agent quickstart for the router app" \
"phase-6-release,type:docs,size:S" \
'The root `CLAUDE.md` covers repo conventions. An agent sent to work on the router app itself has to rediscover the architecture every session.

**Scope**
- `apps/ai-model-router/CLAUDE.md`: the lib layer map, why there is no ORM, the tri-state `apiKey` rule, the React 19 compiler constraints that lint enforces, and the OpenRouter `:batch` variant trap.
- Keep it short. A long file gets skimmed and the load-bearing warnings get missed.'

# ---------------------------------------------------------------- phase 7
echo "== phase 7: skills =="

mk "Create a code-refactoring skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/engineering/refactoring/SKILL.md`: a repeatable procedure for restructuring code without changing behaviour.

**Must cover**
- Establish a behaviour baseline *before* touching anything. A refactor with no passing test to hold it still is a rewrite, and should be called one.
- One transformation at a time, committed separately: extract, inline, rename, move. A commit mixing two transformations cannot be reverted cleanly when one turns out wrong.
- Name the specific smells worth acting on (long parameter lists, feature envy, primitive obsession, shotgun surgery) and, more importantly, which ones to leave alone. Not every smell is worth the churn.
- The stopping rule. Refactoring expands to fill available time; the skill must say when to stop.
- Mechanical-vs-semantic: a rename is safe, a signature change is not. Treat them differently.

**Frontmatter** `description` must lead with the trigger: `Use when restructuring existing code. <behavior>.` The first 57 characters are what gets matched.

Real examples beat abstract advice. Include at least two before/after pairs.'

mk "Create a security-audit skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/engineering/security-audit/SKILL.md`: a systematic pass for finding vulnerabilities in a codebase before they ship.

**Must cover**
- A concrete checklist ordered by real-world frequency, not by textbook taxonomy: authz gaps (most common and most damaging), injection, secret handling, SSRF, unsafe deserialization, dependency CVEs.
- Authorization deserves its own section. Authentication bugs are loud; authorization bugs are silent and are the ones that leak data across tenants.
- How to grep for each class with specific patterns, so the pass is mechanical rather than vibes.
- Severity triage: exploitability times blast radius. A theoretical bug behind three auth layers is not a P0 and calling it one destroys trust in the whole report.
- Reporting format: the vulnerable line, the exploit path, the fix. A finding without a reproduction is a guess.

This repo is the first test case: it stores API keys and had no auth at all.'

mk "Create a code-quality review skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/engineering/code-review/SKILL.md`: how to review a diff and find what actually matters.

**Must cover**
- Review in passes rather than top to bottom: correctness first, then security, then design, then style. A reviewer who leads with style never reaches the logic bug.
- What to leave to tooling. Any comment a formatter or linter could have made is noise that buries the substantive ones.
- Read the diff against the stated intent. Code that is correct but implements the wrong thing passes every automated check.
- Comment severity: blocking / should-fix / nit. An uncategorised wall of comments is unactionable.
- What is *not* in the diff: missing tests, missing error handling, the callers that were not updated.

**Include** how to review a diff you did not write and lack context for, which is the common and harder case.'

mk "Create a test-strategy skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/engineering/test-strategy/SKILL.md`: deciding what to test and at which level.

**Must cover**
- Test at the level where a bug would actually be caught, not at the level that is easiest to write.
- Coverage percentage is a lagging indicator and a terrible target. Name what to measure instead: are the branches that handle money, auth, and data loss covered?
- Pure functions first: they are cheap to test and are usually where silent wrong answers live. This repo is the example, its scoring and cost maths are pure and were untested.
- When a mock is lying to you. A mocked provider that always returns well-formed usage will never catch the estimation fallback path.
- Table-driven tests for anything with a matrix of inputs.
- What not to test: framework behaviour, third-party libraries, and getters.'

mk "Create a debugging skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/engineering/debugging/SKILL.md`: finding root causes instead of symptoms.

**Must cover**
- Reproduce reliably before changing anything. A fix validated against an intermittent repro is a coincidence.
- Binary search the change set, the input, and the code path. `git bisect` is under-used.
- Read the error message completely. Most of the time the answer is in it, and the reflex is to skip to the stack trace.
- Question the assumption that the bug is in your code. Then question the assumption that it is not.
- The cold-start trap, from this repo: the first Ollama call timed out at 110 seconds and looked like a broken integration; it was model load time and the second call returned in 447ms. Timing-dependent first-run behaviour is a distinct bug class worth naming.
- When to stop and add logging instead of continuing to guess.'

mk "Create a plan-generation skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/productivity/planning/SKILL.md`: turning a vague goal into a plan someone can execute.

**Must cover**
- Verify current state by reading the code, not by trusting the previous plan. Every entry that was wrong cost real time.
- Phases ordered by dependency and by what unblocks production soonest, which is often not the same order.
- Every task row carries its reasoning and the trap it hides. `- [ ] Add caching` tells the next agent nothing.
- Derive progress numbers, never type them. Hand-counting has produced plans reading 100% complete with whole sections unbuilt.
- Under-report. A plan with optimistic checkboxes is worse than no plan.
- A three-state checkbox, because two cannot express "partially landed" and the honest option must not cost visibility.
- Mark product decisions as decisions. An agent that silently picks one has made a call nobody reviewed.
- Adding scope lowers the percentage; note it in the same edit or it reads as lost work.

This repo uses the pattern: phase files in `docs/plans/`, tickets as GitHub issues.'

mk "Create an API-design skill" \
"phase-7-skills,type:docs,size:S" \
'Write `skills/engineering/api-design/SKILL.md`: designing HTTP APIs that stay usable as they grow.

**Must cover**
- Validate at the boundary, then trust inwards. A cast is not validation, and `as SomeType` is a lie the compiler believes.
- Status codes that mean something: 400 for a malformed request, 422 for a well-formed but invalid one, 502 when an upstream failed rather than you.
- Error bodies a client can branch on, not prose.
- Tri-state fields, which this repo hit directly: absent, null, and empty string must be distinguishable when absent means keep, empty means clear, and a value means replace. Most schema libraries collapse the first two by default and silently destroy data.
- Pagination from day one. Retrofitting it is a breaking change.
- Idempotency for anything that spends money.'

mk "Create a database-design skill" \
"phase-7-skills,type:docs,size:S" \
'Write `skills/engineering/database-design/SKILL.md`: schema decisions that are expensive to reverse.

**Must cover**
- When an ORM earns its complexity and when raw SQL is the simpler correct answer. This repo uses raw SQLite deliberately; the skill should articulate that threshold rather than defaulting either way.
- Store derived values when the inputs change over time. Cost is computed at write time here precisely so that editing a price later does not silently rewrite history.
- Index what you filter and sort on, then verify with `EXPLAIN QUERY PLAN` rather than assuming.
- Nullable versus empty-string versus absent, and picking one convention per column.
- Migrations are immutable once applied. Editing one, even a comment, breaks checksum validation and demands a full reset.
- WAL mode, and why a naive file copy of a live database can capture a torn state.'

mk "Create a performance-profiling skill" \
"phase-7-skills,type:docs,size:S" \
'Write `skills/engineering/performance/SKILL.md`: making things faster without guessing.

**Must cover**
- Measure first. Intuition about hot paths is wrong often enough that acting on it is gambling.
- Distinguish latency from throughput; optimising one routinely worsens the other.
- The N+1 query, still the most common real-world cause.
- Perceived versus actual performance: streaming a response that takes the same total time feels dramatically faster, and is usually the cheaper win. This repo is a live example.
- Know when to stop. Past a point the user cannot perceive the difference and the complexity is permanent.
- Set a budget before optimising, so "fast enough" is defined rather than argued.'

mk "Create a frontend-architecture skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/engineering/frontend-architecture/SKILL.md`: structuring UI code that survives growth.

**Must cover**
- Where state belongs: server, URL, or component. Most state bugs are state living in the wrong place.
- Effects synchronise with external systems; they are not a place to derive state. The React 19 compiler now enforces this and the errors are opaque until the underlying rule is understood.
- No mutation during render, including the innocent-looking accumulator in a `.map()` that computes running offsets. This repo hit exactly that in a chart.
- Loading, empty, error, and partial states are part of the design, not an afterthought.
- When a dependency is worth it. Five static SVG shapes did not justify a charting library here; the tradeoff reasoning is the transferable part.
- Colocate by feature, not by file type.'

mk "Create a prompt-engineering skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/ai/prompt-engineering/SKILL.md`: getting reliable output from a model.

**Must cover**
- Specificity beats politeness. "Reply as strict JSON, no markdown" works; "please try to" does not.
- Structured output: schema in the prompt, and parse defensively anyway. Models wrap JSON in code fences under load even when told not to, so strip fences before parsing. This repo does exactly that and still falls back gracefully.
- Always have a fallback path for unparseable output. Never let a malformed response become a crash.
- Context placement matters: instructions at the end are followed more reliably than instructions buried above a large document.
- Few-shot examples outperform lengthy description for format compliance.
- Temperature by task: near zero for extraction and classification, higher for generation.
- Cost awareness: a resent system prompt is billed every turn unless cached.'

mk "Create a model-selection skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/ai/model-selection/SKILL.md`: choosing the right model for a task, the human-readable counterpart to this repo app.

**Must cover**
- Match the axis to the job: reasoning, long context, speed, and cost are largely independent and the frontier model is frequently the wrong answer.
- Price spans four orders of magnitude, from roughly $0.02 to $75 per 1M output tokens. For bulk classification that difference dominates every other consideration.
- Context window is not context quality. Output degrades measurably past roughly 70% fill regardless of the advertised maximum.
- When local wins: privacy, volume, and offline. When it does not: peak quality, and cold start latency.
- Published benchmarks are contaminated and gamed. Measure on your own task.
- Batch and cache pricing tiers, and why matching the wrong tier understates real cost by half. This repo hit that exact trap syncing prices.'

mk "Create a git-workflow skill" \
"phase-7-skills,type:docs,size:S" \
'Write `skills/engineering/git-workflow/SKILL.md`: commit hygiene that makes history useful.

**Must cover**
- One logical change per commit. The test is whether it can be reverted alone.
- Commit messages that say *why*, since the diff already says what. A message explaining a non-obvious constraint saves the next reader an hour.
- Commit small and often rather than one end-of-day blob.
- Never commit secrets; how to check before pushing, and what to do after, which is rotate rather than rewrite history and hope.
- `git bisect`, and how commit granularity determines whether it is usable.
- Reviewing your own diff before committing. It catches debug statements and unrelated edits every time.'

mk "Create a technical-writing skill" \
"phase-7-skills,type:docs,size:S" \
'Write `skills/productivity/technical-writing/SKILL.md`: documentation people actually read.

**Must cover**
- Lead with what the reader needs to do, not with background. Most docs bury the command under three paragraphs of context.
- Write for the reader arriving mid-problem, because nobody reads documentation recreationally.
- Show the failure mode next to the instruction. "Run X" plus "if it says Y, you hit Z" halves the support load.
- Examples over description. One worked example outperforms three paragraphs.
- Say what a thing is *not* for. Scope boundaries prevent more misuse than any amount of feature description.
- Keep warnings rare so they keep working. A page of warnings is a page of noise.'

mk "Create a skill-authoring meta-skill" \
"phase-7-skills,type:docs,size:M" \
'Write `skills/productivity/skill-authoring/SKILL.md`: how to write the other skills well. This is the highest-leverage entry because it governs every future one.

**Must cover**
- Frontmatter: the first 57 characters of `description` are the trigger the model matches on, so lead with `Use when <trigger>.` A description opening with a description is a skill that never loads.
- Lessons, not logs. `Do X because Y` transfers; `On the March incident we discovered` does not.
- One rule per line, imperative mood, reason attached when the rule looks arbitrary.
- No dates, PR numbers, or incident narration. They date the skill and carry no instruction.
- Progressive disclosure: body stays short, depth moves to `references/` named by topic and linked so it loads only when needed.
- Extend an existing reference before adding a new one; fragmentation is worse than length.
- Include the counter-examples, because most skills fail by being too vague to act on rather than by being wrong.'

echo "done."
