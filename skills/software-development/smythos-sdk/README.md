# SmythOS SDK Skill

A working guide for building, testing, and debugging AI agents with the `@smythos/sdk` TypeScript package, plus a full bundled API reference.

## What it does

This skill turns "write a SmythOS agent" into a repeatable procedure instead of a guessing game about method names. It covers:

- Scaffolding a new project with the `sre` CLI (`@smythos/cli`), including the `~/.smyth/models/sre-models-pub` models repo that agent creation depends on.
- The eight rules that silently break agent code when ignored (missing `await`, unawaited streams, missing skill descriptions, thrown exceptions inside skills, and so on).
- Implementing every feature as a skill via `addSkill()`, then choosing the invocation mode: `agent.call()`, `agent.prompt()`, or `agent.chat()`.
- Credential handling through the vault (`~/.smyth/vault.json` or `.smyth/.sre/vault.json`), never hardcoded keys.
- A build/run/test loop, a debug-logging toggle, and a documentation step (Mermaid diagrams plus a version tag).

The bundled `references/sdk-api.md` is the actual API surface, so code can be written against documented signatures rather than invented ones.

## When to use this

Load this skill when any of these are true:

- A file imports `@smythos/sdk` or `@smythos/sdk/core`.
- You are creating a SmythOS agent from scratch.
- You are modifying an existing SmythOS project: adding a skill, integrating an API, changing behavior, fixing a bug.
- You are adding `@smythos/sdk` to an existing codebase.
- An agent runs but produces truncated output, no output, or an auth error deep in a call stack.

Do not use it for generic LLM-wrapper work that has nothing to do with the SmythOS runtime.

## Quick start

A complete single-file agent with one skill, invoked three ways. This is the shape every SmythOS project starts from (`src/index.ts`).

```typescript
import { Agent, Model, TLLMEvent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Crypto Desk Agent',
    model: Model.OpenAI('gpt-4o', { temperature: 0.3, maxTokens: 1500 }),
    behavior:
        'You are a crypto market analyst. Quote live prices from the get_coin_price skill only, ' +
        'never from memory. State the currency and the timestamp of every figure you report.',
});

agent.addSkill({
    name: 'get_coin_price',
    description: 'Get the current USD price and 24h change for a cryptocurrency by its CoinGecko id (e.g. bitcoin, ethereum).',
    process: async ({ coin_id }) => {
        try {
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin_id}&vs_currencies=usd&include_24hr_change=true`;
            const res = await fetch(url);

            if (!res.ok) {
                return `Error: CoinGecko returned ${res.status} ${res.statusText}`;
            }

            const data = await res.json();

            if (!data[coin_id]) {
                return `Error: unknown coin id "${coin_id}". Use a CoinGecko id such as "bitcoin".`;
            }

            return { coin_id, usd: data[coin_id].usd, change_24h: data[coin_id].usd_24h_change, fetched_at: new Date().toISOString() };
        } catch (error) {
            return `Error fetching price: ${error.message}`;
        }
    },
});

async function main() {
    // 1. Direct call: no LLM involved, deterministic, good for CLI args and tests.
    const raw = await agent.call('get_coin_price', { coin_id: 'bitcoin' });
    console.log(raw);

    // 2. Prompt: the LLM reads the skill description and decides to call it.
    const answer = await agent.prompt('Is ether up or down today, and by how much?');
    console.log(answer);

    // 3. Streaming: you MUST await the End event or output truncates with no error.
    const stream = await agent.prompt('Summarise the last 24h for bitcoin and ether.').stream();
    stream.on(TLLMEvent.Content, (chunk) => process.stdout.write(chunk));
    stream.on(TLLMEvent.Error, (err) => console.error('stream error:', err));
    await new Promise((resolve) => stream.on(TLLMEvent.End, resolve));
}

main().catch((error) => console.error('Agent failed:', error.message));
```

Project setup and run loop:

```bash
npm i -g @smythos/cli
sre create "crypto-desk-agent" --template=empty --res-folder=home

ls ~/.smyth/models/sre-models-pub || git clone https://github.com/SmythOS/sre-models-pub.git ~/.smyth/models/sre-models-pub

cd crypto-desk-agent
npm install
npm install @smythos/sdk@latest   # the scaffold pins an older version
npm run build
npm start
node dist/index.js bitcoin        # real CLI invocation with real arguments
```

Put the OpenAI key in `~/.smyth/vault.json` under `default.openai` before running. No key means an auth failure that surfaces far from its cause.

## Key concepts

**Skill.** A named, described unit of capability registered with `addSkill()`. The `description` is not documentation; it is the input the LLM uses to decide whether to call the skill. `name` is `snake_case`. `process` is async and returns a string or a JSON-serializable object.

**Three invocation modes.** `agent.call(name, args)` runs a skill directly with no LLM in the loop. `agent.prompt(text)` lets the LLM pick skills. `agent.chat({ id, persist })` adds conversation memory across turns. All three are awaited; `.stream()` turns a prompt into an event emitter.

**Everything is a skill.** Even logic you could call as a plain function belongs in `addSkill()`. That is what produces telemetry, the security model, and access to SmythOS capabilities. Choose the invocation mode afterwards.

**Model resolution.** Three levels: a bare string (`'gpt-4o'`, resolved via the vault), `Model.OpenAI('gpt-4o')` for explicit provider selection, and `Model.OpenAI('gpt-4o', { temperature, maxTokens, baseURL, ... })` for tuning. Local models run through `Model.Ollama(...)` or `Model.OpenAI(id, { baseURL: 'http://localhost:1234/v1' })` for any OpenAI-compatible server.

**Services on the agent.** `agent.llm.*`, `agent.vectordb.*`, `agent.storage.*`, `agent.cache.*` are the built-in abstractions. Use them instead of provider SDKs like `aws-sdk`, so credentials, ACL, and telemetry keep working.

**Vault.** Credentials live in `vault.json` (project-local takes priority over home). The SDK resolves them automatically; you never pass an `apiKey`. Vault files are gitignored.

**Workflow skills.** For component-based logic, `addSkill()` without a `process`, then wire `skill.in(...)`, `Component.APICall(...)`, and `Component.SkillOutput()` into a graph.

## Bundled references

`references/sdk-api.md` (about 900 lines) is the verified API surface. Read it before writing SDK code; the skill treats guessing at method names as a defect. Sections:

| Section | Covers |
| --- | --- |
| 1. Import paths | `@smythos/sdk` vs `@smythos/sdk/core` and when core is actually required |
| 2. Agent configuration | `name` / `model` / `behavior`, behavior-writing do and don't, all model-selection forms, the full parameter table, Ollama and LM Studio setup, custom model JSON files, the models repo |
| 3. Skills | `addSkill()` structure, naming and description guidance, direct calls |
| 4. Interaction modes | Prompt, streaming, the complete `TLLMEvent` table, chat sessions, importing `.smyth` files |
| 5. Services | `agent.llm`, `agent.vectordb` (Pinecone, Milvus, RAMVec), `agent.storage` (Local, S3, Azure, GCS), `agent.cache` (RAM, Redis) |
| 6. Workflow skills | Component-based skills, `skill.in`, `Component.APICall`, `Component.SkillOutput` |
| 7. Vault | Lookup priority order, file structure, automatic credential resolution |
| 8-9. Project structure and style | Directory layout, `package.json` and `tsconfig.json` requirements, Prettier settings |
| 10-11. Async and errors | Await patterns, stream completion, `main()` pattern, returning error strings from skills |
| 12-13. Debugging and mistakes | `LOG_LEVEL`, source maps, and the four highest-frequency errors with fixes |
| 14. Advanced patterns | Multi-agent handoff, RAG over a vector database |
| 15. CLI and defaults | `sre create`, build/run scripts, preferred stack (Milvus, local storage, Redis, OpenTelemetry) |

## Common pitfalls

**Unawaited stream.** Output truncates and nothing is logged as an error.

```typescript
// Bad: the process can exit mid-response
const stream = await agent.prompt('Tell a story').stream();
stream.on(TLLMEvent.Content, (c) => process.stdout.write(c));

// Good
const stream = await agent.prompt('Tell a story').stream();
stream.on(TLLMEvent.Content, (c) => process.stdout.write(c));
await new Promise((resolve) => stream.on(TLLMEvent.End, resolve));
```

**Throwing from a skill.** An exception kills the agent loop; a returned string lets the LLM recover or report.

```typescript
// Bad
process: async ({ url }) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

// Good
process: async ({ url }) => {
    try {
        const res = await fetch(url);
        if (!res.ok) return `Error: API returned ${res.status} ${res.statusText}`;
        return await res.json();
    } catch (error) {
        return `Error fetching data: ${error.message}`;
    }
};
```

**Missing skill description.** The LLM has no basis to select the skill, so it is never called.

```typescript
// Bad
agent.addSkill({ name: 'do_thing', process: async ({ x }) => doThing(x) });

// Good
agent.addSkill({
    name: 'calculate_tax',
    description: 'Calculates tax owed from a gross income amount and a tax rate between 0 and 1.',
    process: async ({ income, rate }) => income * rate,
});
```

**Bypassing SDK service abstractions.** Reaching for a provider SDK loses vault resolution and telemetry.

```typescript
// Bad
import AWS from 'aws-sdk';
const s3 = new AWS.S3({ accessKeyId: process.env.AWS_KEY });

// Good
const storage = agent.storage.S3({ bucket: 'my-bucket', region: 'us-east-1' });
await storage.write('report.txt', content);
```

**Vague behavior.** `behavior: 'helpful assistant'` gives the agent no direction and makes skill selection erratic. Write two or three sentences naming the domain, the expected output form, and the failure posture.

**Hardcoded keys.** Never inline a key, even in a throwaway script. Put it in `vault.json` and keep that file gitignored.

**Debug logging left on.** After setting `LOG_LEVEL="debug"` in `.env`, reset it to `LOG_LEVEL=""` once the bug is found; the noise hides the next one.

## See also

- `SKILL.md` in this directory: the procedure itself (scaffold, implement, test, debug, document, tag).
- `references/sdk-api.md`: the full API reference described above.
- Repository: https://github.com/SmythOS/sre
- SDK docs: https://smythos.github.io/sre/sdk/
- Examples: https://github.com/SmythOS/sre/tree/main/examples
- Cheat sheet: https://smythos.github.io/sre/sdk/documents/99-cheat-sheet.html
- Models repo: https://github.com/SmythOS/sre-models-pub
