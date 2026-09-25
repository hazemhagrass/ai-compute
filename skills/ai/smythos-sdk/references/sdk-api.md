# SmythOS SDK: Full API Reference

> Verified from official docs. Do NOT hallucinate SDK APIs. Check
> https://smythos.github.io/sre/sdk/ or the examples repo before inventing anything.

## Quick Reference

```typescript
import { Agent, TLLMEvent } from "@smythos/sdk";

const agent = new Agent({
    name: "My Agent",
    model: "gpt-4o",
    behavior: "You are a helpful assistant.",
});

const response = await agent.prompt("Hello");
```

---

## 1. Import Paths

### Main SDK (default, 95% of cases)

```typescript
import { Agent, TLLMEvent } from "@smythos/sdk";
```

### Core SRE (advanced only)

```typescript
import { SRE, SecureConnector, ACL, TAccessLevel } from "@smythos/sdk/core";
```

Use ONLY for: custom connectors, enterprise ACL, direct SRE runtime init.

---

## 2. Agent Configuration

```typescript
const agent = new Agent({
    name: "Customer Support Agent",
    model: "gpt-4o",
    behavior: "You are a customer support specialist. Help users with empathy.",
});
```

| Property   | Required | Description                                        |
| ---------- | -------- | -------------------------------------------------- |
| `name`     | Yes      | Agent identity                                     |
| `model`    | Yes      | Model string or `Model.*()` call                   |
| `behavior` | Yes      | System prompt (be specific, never vague)           |

### Model selection

#### Simple string (auto-resolved via vault)

```typescript
model: 'gpt-4o'            // OpenAI
model: 'claude-sonnet-4-5' // Anthropic
model: 'gemini-3-pro'      // Google
```

#### Provider-explicit via `Model.*`

```typescript
import { Model } from '@smythos/sdk';

model: Model.OpenAI('gpt-4o')
model: Model.Anthropic('claude-sonnet-4-5')
model: Model.GoogleAI('gemini-1.5-pro')
model: Model.Groq('llama-3.1-70b-versatile')
model: Model.DeepSeek('deepseek-chat')
model: Model.TogetherAI('meta-llama/Llama-3-70b-chat-hf')
model: Model.xAI('grok-beta')
model: Model.Perplexity('llama-3.1-sonar-large-128k-online')
model: Model.Ollama('llama3.2')
model: Model.Bedrock('anthropic.claude-3-sonnet')
model: Model.VertexAI('gemini-1.5-pro')
```

All providers: `OpenAI`, `Anthropic`, `GoogleAI`, `Groq`, `DeepSeek`, `TogetherAI`, `xAI`,
`Perplexity`, `Ollama`, `Bedrock`, `VertexAI`, `Echo`

#### Provider with parameters

```typescript
model: Model.OpenAI('gpt-4o', {
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.9,
    baseURL: 'https://api.openai.com/v1',  // custom endpoint
})
```

| Parameter           | Type     | Description                              |
| ------------------- | -------- | ---------------------------------------- |
| `temperature`       | number   | 0.0-2.0, randomness                      |
| `maxTokens`         | number   | Max response tokens                      |
| `maxThinkingTokens` | number   | For reasoning models                     |
| `topP`              | number   | 0.0-1.0, nucleus sampling                |
| `topK`              | number   | Limits to K most likely tokens           |
| `frequencyPenalty`  | number   | 0.0-2.0, penalises repeated tokens      |
| `presencePenalty`   | number   | 0.0-2.0, penalises already-used tokens  |
| `stopSequences`     | string[] | Sequences that halt generation           |
| `baseURL`           | string   | Custom API endpoint URL                  |
| `numCtx`            | number   | Context window size (Ollama-specific)    |

### Ollama (no API key needed)

```typescript
model: Model.Ollama('llama3.2', {
    temperature: 0.7,
    maxTokens: 2000,
    numCtx: 4096,
    baseURL: 'https://llmstudio2.hazemhagrass.com',  // primary remote server
    // fallback: 'https://llmstudio1.hazemhagrass.com'
})
```

### LM Studio / any OpenAI-compatible server

```typescript
model: Model.OpenAI('my-local-model', {
    baseURL: 'http://localhost:1234/v1',
})
```

### Custom model config files

Drop JSON in `~/.smyth/models/` (loaded at runtime):

```json
{
    "my-ollama-llama": {
        "provider": "Ollama",
        "label": "Local Llama 3.2",
        "modelId": "llama3.2",
        "features": ["text", "tools"],
        "tokens": 4096,
        "completionTokens": 512,
        "enabled": true,
        "baseURL": "https://llmstudio2.hazemhagrass.com",
        "credentials": ["none"]
    }
}
```

Then: `model: 'my-ollama-llama'`

Official model repo: `git clone https://github.com/SmythOS/sre-models-pub ~/.smyth/models/sre-models-pub`

---

## 3. Skills

```typescript
agent.addSkill({
    name: "get_book_info",       // snake_case
    description: "Get information about a book by its name",  // one clear sentence
    process: async ({ book_name }) => {
        const res = await fetch(`https://openlibrary.org/search.json?q=${book_name}`);
        return (await res.json()).docs[0];
    },
});
```

| Aspect         | Rule                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| `name`         | `snake_case`                                                                   |
| `description`  | One clear sentence. The LLM routes based on this.                              |
| `process`      | Async. Destructure params. Return string or JSON-serialisable value.           |
| Error handling | RETURN error strings, do NOT throw. Exceptions kill the agent loop.            |

Direct skill call (bypass LLM): `await agent.call("get_book_info", { book_name: "..." })`

---

## 4. Interaction Modes

### Simple prompt

```typescript
const response = await agent.prompt('Hello');
```

### Streaming

```typescript
const stream = await agent.prompt("Tell me a story.").stream();

stream.on(TLLMEvent.Content, (chunk) => process.stdout.write(chunk));
stream.on(TLLMEvent.End, () => console.log("\nDone"));

// CRITICAL: always await stream end or output truncates silently
await new Promise((resolve) => stream.on(TLLMEvent.End, resolve));
```

### Stream events (TLLMEvent)

| Event                   | Description                                  |
| ----------------------- | -------------------------------------------- |
| `TLLMEvent.Content`     | Response chunks                              |
| `TLLMEvent.Thinking`    | Reasoning blocks                             |
| `TLLMEvent.End`         | Stream completed                             |
| `TLLMEvent.Error`       | Error occurred                               |
| `TLLMEvent.ToolInfo`    | LLM selected next tool                       |
| `TLLMEvent.ToolCall`    | Before tool execution                        |
| `TLLMEvent.ToolResult`  | After tool execution                         |
| `TLLMEvent.Usage`       | Token usage statistics                       |
| `TLLMEvent.Interrupted` | Response interrupted before completion       |

### Chat (conversation memory)

```typescript
const chat = agent.chat({ id: "session-001", persist: false });
const r1 = await chat.prompt("Hello, I'm Alice");
const r2 = await chat.prompt("What's my name?");  // remembers
```

### Import .smyth files

```typescript
import agentData from "./my-agent.smyth";
const agent = new Agent(agentData);  // file must include default_model
```

---

## 5. Built-in Services

### LLM service

```typescript
process: async ({ text }) => {
    const llm = agent.llm.OpenAI("gpt-4o-mini");  // or .Ollama(), .Anthropic(), etc.
    return await llm.prompt(`Summarise: ${text}`);
}
```

### VectorDB: prefer Milvus (install if absent)

```typescript
const vec = agent.vectordb.Milvus({ namespace: "kb", indexName: "main" });
const results = await vec.search(query, { topK: 5 });
```

Supported: `Pinecone`, `Milvus`, `RAMVec`

### Storage: Local by default, S3 if user prefers

```typescript
const storage = agent.storage.Local();
await storage.write(filename, content);
```

Supported: `Local`, `S3`, `Azure`, `Google Cloud`

### Cache: prefer Redis (install if absent; fall back to RAM)

```typescript
const cache = agent.cache.Redis();
await cache.set(key, data, { ttl: 3600 });
const val = await cache.get(key);
```

### Observability: OpenTelemetry (OTel) only

---

## 6. Workflow Skills (Component-Based)

```typescript
import { Component } from "@smythos/sdk";

const skill = agent.addSkill({ name: "MarketData", description: "Get crypto data" });
skill.in({ coin_id: { description: "Cryptocurrency ID e.g. bitcoin" } });

const apiCall = Component.APICall({
    url: "https://api.coingecko.com/api/v3/coins/{{coin_id}}",
    method: "GET",
});
apiCall.in({ coin_id: skill.out.coin_id });

const output = Component.SkillOutput();
output.in({ result: apiCall.out.Response.market_data });
```

---

## 7. Vault & Credentials

NEVER hardcode keys. NEVER commit vault files.

Locations (priority order):
1. `./.smyth/vault.json`
2. `./.smyth/.sre/vault.json`
3. `~/.smyth/vault.json`
4. `~/.smyth/.sre/vault.json`

```json
{ "default": { "openai": "sk-...", "anthropic": "sk-ant-..." } }
```

SDK auto-resolves, no `apiKey` field in code.

---

## 8. Project Structure

```
project/
├── src/index.ts
├── dist/                    # gitignored
├── .smyth/.sre/vault.json   # gitignored
├── mermaid/                 # architecture diagrams
├── package.json             # must have "type": "module"
├── tsconfig.json
└── rollup.config.js
```

Code style: 4-space indent, single quotes, printWidth 150.

package.json minimum:
```json
{
    "type": "module",
    "scripts": {
        "build": "rollup -c ./rollup.config.js",
        "start": "node dist/index.js",
        "dbgstart": "node --enable-source-maps dist/index.js"
    },
    "dependencies": { "@smythos/sdk": "^1.3.1" }
}
```

---

## 9. Multi-Agent & RAG

```typescript
// Sequential
const research = await researchAgent.prompt("Research topic");
const article  = await writerAgent.prompt(`Write from: ${research}`);

// RAG
process: async ({ question }) => {
    const vec = agent.vectordb.Milvus({ namespace: "docs", indexName: "kb" });
    const ctx = (await vec.search(question, { topK: 5 })).map(r => r.metadata.text).join("\n\n");
    return await agent.llm.OpenAI("gpt-4o").prompt(`Context:\n${ctx}\n\nQ: ${question}`);
}
```

---

## Pre-submission Checklist

- [ ] `@smythos/sdk` imports (not core unless explicitly needed)
- [ ] Agent: specific `name`, detailed `behavior`
- [ ] Skills: `snake_case` name, one-sentence `description`, errors returned as strings
- [ ] All `agent.prompt()` / `agent.call()` / `chat.prompt()` awaited
- [ ] Stream `TLLMEvent.End` awaited before process exits
- [ ] No hardcoded API keys, vault only
- [ ] 4-space indent, single quotes, `"type": "module"` in package.json
- [ ] Vault files in .gitignore
