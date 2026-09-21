---
name: smythos-sdk
description: Use when code imports @smythos/sdk. Build SmythOS agents.
---

# SmythOS SDK

Build agents with `@smythos/sdk`. **Read [references/sdk-api.md](references/sdk-api.md) before writing
any SDK code** — it is the full API surface. Do not guess or hallucinate SDK APIs; when something is
not covered there, check the official docs rather than inventing a method name.

| Resource | URL |
| --- | --- |
| Repository | https://github.com/SmythOS/sre |
| SDK docs | https://smythos.github.io/sre/sdk/ |
| Examples | https://github.com/SmythOS/sre/tree/main/examples |
| Cheat sheet | https://smythos.github.io/sre/sdk/documents/99-cheat-sheet.html |
| AGENTS.md (LLM guidelines) | https://raw.githubusercontent.com/SmythOS/sre-project-templates/refs/heads/main/AGENTS.md |

The SDK evolves. If an implementation that matches this skill does not work, check the live docs
before assuming the code is wrong.

## Applies to

- Creating an agent from scratch → full scaffolding below.
- **Modifying an existing SmythOS project** — adding skills, changing behavior, integrating an API,
  fixing a bug → skip to "Implement".
- Adding `@smythos/sdk` to an existing codebase.
- Debugging an agent → see "Debugging".

## The rules that break code when ignored

1. **Always `await`** `agent.prompt()`, `agent.call()`, `chat.prompt()`.
2. **Always await stream completion** — `await new Promise(r => stream.on(TLLMEvent.End, r))`.
   A stream not awaited truncates output with no error.
3. **Never hardcode API keys** — vault (`~/.smyth/vault.json`, or `.smyth/.sre/vault.json`
   in-project) or env vars.
4. **Every skill needs a `description`** — the LLM reads it to decide when to call the skill.
5. **Skills return error strings; they do not throw.** A thrown exception kills the agent loop where
   a returned string lets the LLM recover or report.
6. **Import from `@smythos/sdk`**, not `@smythos/sdk/core` — core is only for custom connectors,
   ACL, and enterprise security internals.
7. **Implement every feature as a skill via `addSkill()`**, even logic you could call directly. That
   is what gives you telemetry, SmythOS capabilities, and the security model. Then choose how to
   invoke it: `agent.call()` for direct logic, `agent.prompt()` to let the LLM choose,
   `agent.chat()` for conversation.
8. **Prefer SDK built-ins over external libraries** — tools, models, workflows, vectorDB, storage,
   cache. Check the SDK docs before adding a dependency.

## Scaffolding a new project

Prerequisites: Node.js **v22.5.0+**, git, `npm i -g @smythos/cli` (verify with `sre`).

```bash
# Template: `empty` by default. Electron app → smythos-electron-starter-project.
# Android app → android-mobile-agent. Honor an explicitly requested template.
sre create "<project-name>" --template=empty --res-folder=home
```

Name in kebab-case. `--res-folder=home` shares `~/.smyth` for resources (recommended); all SmythOS
config and work files live there.

Ensure the models repo exists — it holds the templates and definitions agent creation depends on:

```bash
ls ~/.smyth/models/sre-models-pub || {
  mkdir -p ~/.smyth/models && cd ~/.smyth/models
  git clone https://github.com/SmythOS/sre-models-pub.git
}
```

Pull it periodically so new models are available.

```bash
cd <project>
npm install
npm install @smythos/sdk@latest   # the scaffold pins an older version; always update
npm run build
npm start                          # a minimal project starts and exits — expected
```

Then `git init && git add . && git commit -m "Initial project scaffolding"` if there is no repo, so
you can tag working states and revert to them.

## Implement

Read `references/sdk-api.md` first. Build features as `addSkill()` calls. Make sure the agent is
invocable from the CLI.

If the agent needs LLM models, tell the user to put the matching API keys in `vault.json` — the
failure otherwise is an auth error deep in a call stack.

## Test

```bash
npm run build
npm start
node dist/index.js <test-args>   # CLI invocation with real arguments
```

Verify: no runtime errors, correct CLI response, expected output, and that invalid input is handled.

## Debugging

Create `.env` in the project root:

```
LOG_LEVEL="debug"
LOG_FILTER=""
```

**Disable it again afterwards** (`LOG_LEVEL=""`) — debug logging is noisy enough to hide the next bug.

## Document and tag

For a non-trivial agent, write Mermaid diagrams under `mermaid/` — text-based and
version-controllable: `architecture.mmd` (what components exist), `workflow.mmd` (what happens
when), `components.mmd` (how pieces connect).

Bump `package.json` version, commit, and `git tag v1.0.0`. Tags are what let you `git checkout` back
to a state that worked.
