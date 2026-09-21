# README Generator

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Reads an actual codebase and writes a README.md whose every claim can be traced back to a file.

## What it does

This skill inspects a repository and produces a README with a fixed section order, grounded in what the code really contains.

- **Reads the manifest first:** `package.json`, `pyproject.toml`, `Cargo.toml`, or `go.mod` supply the project name, the one-line description, and the install command.
- **Derives features from source:** each bullet under "What it does" maps to a module, an exported function, or a passing test.
- **Extracts install commands from the build system:** the lockfile decides whether the command is `npm install`, `pnpm install`, `uv pip install`, or `cargo install`.
- **Builds the quick start from tests and examples:** existing `tests/` and `examples/` directories are the source of runnable snippets, so the example is known to work.
- **Reports the license as found:** the text of the LICENSE file or the manifest field, or the literal string "No license file found."

The output is deliberately short. No table of contents, no roadmap, no badge wall.

## When to use this

Use it when:

- A repository has no README at all.
- The README exists but describes an older version of the code (renamed commands, removed modules, a stale install line).
- You inherited a project and need an accurate map of what it does before touching it.
- A library gained or lost exported functions and the docs never caught up.

Do not use it when:

- You want marketing copy or a landing page. This skill states capabilities, nothing more.
- The feature does not exist yet. A README for unwritten code is a specification, so use `spec-first-development` instead.
- You only need to document a single change. That belongs in a commit message, so use `git-commit-writer`.

## Quick start

Point the skill at a repository and let it read before it writes.

**Input repository:**

```
redis-queue/
  package.json        name: "redis-queue", description: "Durable job queue on Redis streams"
  src/
    queue.ts          exports createQueue, push, pop
    worker.ts         exports startWorker
    retry.ts          exports withRetry
  tests/
    queue.test.ts     vitest suite covering push/pop round trip
  examples/
    basic.ts          runnable demo
  LICENSE             MIT
  .github/workflows/ci.yml
```

**Invocation:**

```
Generate a README for this repo.
```

**Generated README.md:**

```markdown
# redis-queue

Durable job queue on Redis streams.

## What it does

- Creates named queues backed by Redis streams (`src/queue.ts`)
- Pushes and pops jobs with at-least-once delivery (`src/queue.ts`)
- Runs background workers that claim and acknowledge jobs (`src/worker.ts`)
- Retries failed jobs with exponential backoff (`src/retry.ts`)

## Install

\`\`\`bash
npm install redis-queue
\`\`\`

Requires Node 18+ and a reachable Redis 6.2 or newer.

## Quick start

Assumes Redis is running on localhost:6379.

\`\`\`typescript
import { createQueue, push } from 'redis-queue';
import { startWorker } from 'redis-queue/worker';

const queue = createQueue('emails');

await push(queue, { to: 'user@example.com', subject: 'Welcome' });

startWorker(queue, async (job) => {
  console.log('sending to', job.to);
});
\`\`\`

## Structure

- `src/` - queue, worker, and retry logic
- `tests/` - vitest suite

## License

MIT
```

Notice what is absent: no "powerful", no roadmap, no download badge. Every bullet names a file.

## Key concepts

### Evidence per claim

Each feature bullet must have a file path behind it. Before writing a bullet, locate the code. If you cannot point to `src/retry.ts`, the retry bullet does not get written. The file path may appear inline in the bullet (as in the example above) or simply be the thing you verified before writing, but the verification is not optional.

### Section order is fixed

1. Title and one-line description
2. What it does
3. Install
4. Run it / Quick start
5. Structure (optional, multi-directory projects only)
6. Configuration (optional, only for flags and variables you saw parsed)
7. License

Optional sections may be dropped. Present sections may not be reordered, because readers scan by position.

### One package manager

The lockfile decides. A `pnpm-lock.yaml` means the install line is `pnpm install` and nothing else. Documenting four package managers signals that the author never ran any of them.

### Language matches the project

A TypeScript project gets a TypeScript quick start. A Python project gets Python. Mixing languages in examples is allowed only when the project is genuinely polyglot, and then each block is labeled with its runtime.

### Badge minimalism

Three badges are permitted, each conditional on real evidence:

- CI status, only if `.github/workflows/` exists
- Package version, only if the package is actually published
- License, only if a LICENSE file exists

Download counts, "awesome" badges, and Discord invites do not appear.

### The three-question verification gate

Before the README ships, answer all three:

- Can a stranger copy-paste the install command and have it succeed?
- Does every feature claim have a file path you could cite?
- If someone runs the quick start block, does something observable happen?

Any "no" means revise, not ship.

## Common pitfalls

### Inventing features that are not in the code

**Bad:**

```markdown
## What it does

- Real-time job monitoring dashboard
- Multi-region replication
- Plugin system for custom backends
```

**Good:**

```markdown
## What it does

- Creates named queues backed by Redis streams (`src/queue.ts`)
- Retries failed jobs with exponential backoff (`src/retry.ts`)
```

The bad version describes a product someone imagined. The good version describes files that exist.

### Quick start code that cannot run

**Bad:**

```typescript
import { Queue } from 'redis-queue';
const q = new Queue();
q.process(job => handle(job));
```

**Good:**

```typescript
import { createQueue, push } from 'redis-queue';

const queue = createQueue('emails');
await push(queue, { to: 'user@example.com' });
```

The bad version invents a class-based API that the source never exported. Copy the shape of the call from `tests/` or `examples/`, where it is known to work.

### Hiding the prerequisites

**Bad:**

```markdown
## Quick start

\`\`\`typescript
const queue = createQueue('emails');
\`\`\`
```

**Good:**

```markdown
## Quick start

Assumes Redis is running on localhost:6379.

\`\`\`typescript
const queue = createQueue('emails');
\`\`\`
```

An example that silently requires a running service produces a connection error and a confused reader. One sentence prevents it.

### Aspirational framing instead of statements

**Bad:**

```markdown
This project aims to provide a modern, powerful, and easy-to-use solution for job queueing.
```

**Good:**

```markdown
Durable job queue on Redis streams.
```

"Aims to" is a promise. The one-liner is a fact.

### Listing every package manager

**Bad:**

```bash
npm install redis-queue
yarn add redis-queue
pnpm add redis-queue
```

**Good:**

```bash
pnpm install
```

Read the lockfile and pick the one the project actually uses.

### Roadmap and contributing boilerplate

**Bad:**

```markdown
## Roadmap
- [ ] Multi-region support

## Contributing
PRs welcome! Please star the repo.
```

**Good:**

Omit both. Add a Contributing section only when `CONTRIBUTING.md` exists, and then link to it in one line. Roadmaps go stale within a month and teach readers to distrust the rest of the document.

### Documenting config that is never parsed

**Bad:**

```markdown
## Configuration

- `QUEUE_TIMEOUT` - job timeout in ms
- `QUEUE_LOG_LEVEL` - logging verbosity
```

**Good:**

Grep for the variable first. Include only the names you can find being read in the source (for example `process.env.REDIS_URL` in `src/queue.ts`). If none are parsed, drop the Configuration section entirely.

## See also

- `technical-writing` - task-first documentation structure that a stranger can act on quickly
- `truth-first` - grounding claims in verifiable evidence, the rule behind "evidence per claim"
- `git-commit-writer` - the same no-filler discipline applied to commit messages
- `spec-first-development` - use this instead when the code does not exist yet
- `env-doctor` - diagnoses the missing deps and env vars your Install section must mention
- `skill-authoring` - for editing this skill's own SKILL.md
