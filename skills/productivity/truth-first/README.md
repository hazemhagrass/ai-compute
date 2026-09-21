# Truth First

Ground every factual claim in a verifiable source, and mark clearly when you are inferring instead of quoting.

## What it does

Turns "sounds right" into "here is where I checked". The skill applies five rules to any output that asserts an external fact:

1. **State your source.** Claims about API behavior, versions, laws, or benchmarks carry a pointer (doc URL, file path, changelog entry, test run).
2. **Distinguish verified from inferred.** Quoting evidence and reasoning from evidence get different language.
3. **Check numbers before citing them.** Versions, dates, counts, timings, and config values get looked up, not recalled.
4. **Prefer primary sources.** Official docs and source code outrank blog posts and forum answers.
5. **Flag uncertainty explicitly.** "I cannot verify this" is a valid answer and beats a confident guess.

It also ships two workflows (writing documentation, answering a factual question) and a pre-send checklist.

The goal is preventing the **hallucination cascade**: one unverified claim gets treated as settled, then becomes the premise for the next three claims, and by the time someone checks, the whole section is wrong.

## When to use this

Use it when:

- Writing documentation: README files, API references, tutorials, onboarding guides
- Answering "how does X work?" or "what does this endpoint return?"
- Recommending a library, version, or architecture on performance or compatibility grounds
- Citing benchmarks, version numbers, release dates, or legal requirements
- Reviewing someone else's doc for claims that nobody actually checked

Skip it when:

- Writing opinion. "I recommend Postgres here because the query patterns are relational" needs no citation.
- Explaining code you just wrote. You are the primary source.
- Brainstorming or sketching. Accuracy matters less than idea volume at that stage.

## Quick start

A worked example. Someone asks you to document the retry behavior of an internal HTTP client.

**Step 1: draft without citations.** Get the shape down.

```
The client retries failed requests 3 times with exponential backoff.
Rate-limited responses return 429 and the client honors Retry-After.
This is faster than the old client.
```

**Step 2: mark every factual claim.** Four here: the retry count, the backoff strategy, the 429 or Retry-After handling, and the speed comparison. Every one of them is something a reader could file a bug about.

**Step 3: verify or qualify each one.** Go look.

```bash
rg -n "maxRetries|backoff|Retry-After" src/client.ts
```

Say that returns:

```
src/client.ts:12:  maxRetries: 3,
src/client.ts:31:  const delay = base * Math.pow(2, attempt)
```

Two claims verified with a file path and line number. `Retry-After` produced no match, so the claim that the client honors it is unsupported. The speed comparison has no benchmark behind it at all.

**Step 4: rewrite with sources, qualifiers, and deletions.**

```markdown
## Retry behavior

The client retries failed requests up to 3 times
(`maxRetries: 3`, `src/client.ts:12`) using exponential backoff
(`base * 2^attempt`, `src/client.ts:31`).

The client does not appear to read the `Retry-After` header;
no reference to it exists in `src/client.ts`. Rate-limited
requests fall back to the same exponential backoff.
```

The speed claim is gone. It could not be verified in under 30 seconds and it was not load-bearing, so deleting it costs nothing and removes a future embarrassment.

**Step 5: run the pre-send check.** Can a reader verify every claim? Yes, each has a file and line. Is inference marked? Yes, "does not appear to" signals a negative search result rather than a confirmed design decision. Ship it.

## Key concepts

### Hallucination cascade

An unverified claim gets restated as settled fact, and later claims build on it. The cost of checking claim one is thirty seconds. The cost of unwinding claims one through eight after a reader hits production behavior that contradicts the doc is a day.

### Verified vs inferred

Two different epistemic states that deserve two different sentence shapes.

- Verified: "The timeout is 30s (`docs/api.md`, 'Timeouts' section)."
- Inferred: "The project imports `better-sqlite3`, so it likely stores data in SQLite."

Inference is legitimate. Inference dressed as observation is not. Signal it with "suggests", "likely", "appears to", "based on X".

### Authority hierarchy

When two sources disagree, the higher one wins:

1. Official docs
2. Source code (the actual implementation)
3. Changelog and release notes from the official repo
4. Issue tracker, especially issues labeled `bug` or `confirmed`
5. Maintainer blog posts dated within six months
6. Stack Overflow and forums, when several answers agree
7. Random blog posts (verify independently before relying on them)

Source code outranking docs is common in practice: docs go stale, code does not.

### The 30-second rule

If you cannot verify a number in under thirty seconds, either write "approximately" or drop the number. Precise-sounding numbers are the most dangerous hallucinations because readers rarely question them.

### Show guesses as guesses

When you genuinely must produce a shape you have not seen, mark it in the artifact itself so the marker survives copy-paste:

```javascript
// Assumed response shape (VERIFY against the real API):
{ ok: boolean, requestId: string }
```

## Common pitfalls

### Vague attribution

Bad:

```
React 19 removed several hooks.
```

Good:

```
React 19 removed `useEvent`, which never shipped as stable
(React 19.0.0 changelog, "Removed APIs").
```

"Several" is unfalsifiable and unactionable. Naming the API and the source makes the claim checkable in one click.

### Inference stated as observation

Bad:

```
The service stores sessions in Redis.
```

Good:

```
The service imports `ioredis` in `src/session.ts`, which suggests
sessions live in Redis. I did not read the store implementation
to confirm.
```

Seeing an import is not the same as reading the code path. One of these survives a code review; the other gets you a comment asking where you saw that.

### Recalled numbers

Bad:

```
This feature requires Node 18 or higher.
```

Good:

```
`package.json` declares `"engines": { "node": ">=20.9.0" }`,
so Node 20.9 is the floor.
```

Version floors drift with every dependency bump. Read the file rather than trusting the number you remember from last quarter.

### Unmeasured performance claims

Bad:

```
The new parser is significantly faster.
```

Good:

```
On the 4MB fixture in `bench/large.json`, the new parser
completes in 120ms vs 340ms for the old one
(M1 Pro, Node 20.9, 10 runs, median).
```

"Faster" without a workload, a machine, and a run count is not a measurement, it is a vibe. If you have not run the benchmark, do not make the comparison.

### Invented response shapes

Bad:

```
GET /users/:id returns { id, name, email, createdAt }.
```

Good:

```
GET /users/:id returns { id, name, email } per the `User`
schema in `openapi.yaml` (lines 88-102). No timestamp field
is defined.
```

Guessing field names from the endpoint name produces docs that look authoritative and break the first client that trusts them.

### Filling a gap to avoid saying "I do not know"

Bad:

```
The default timeout is 30 seconds.
```

Good:

```
No timeout is documented. `src/client.ts:47` sets a 30s default,
but that is an implementation detail and may change without notice.
```

An honest gap report is more useful than a confident guess, because it tells the reader exactly how much weight the answer can bear.

## See also

Sibling skills in `skills/productivity/`:

- [`technical-writing`](../technical-writing/SKILL.md) - structure and style for docs; pairs with this skill, which covers whether the content is true
- [`readme-generator`](../readme-generator/SKILL.md) - generating README files, a prime place to apply the verification workflow
- [`spec-first-development`](../spec-first-development/SKILL.md) - write the spec before the code, so docs cite a real contract
- [`grill-me`](../grill-me/SKILL.md) - adversarial interrogation of a plan, which surfaces the unverified assumptions inside it
- [`planning`](../planning/SKILL.md) - breaking work into steps you can actually check off
- [`skill-authoring`](../skill-authoring/SKILL.md) - writing skills like this one
