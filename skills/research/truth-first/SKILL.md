---
name: truth-first
description: Use when making factual claims or citing sources. Ground every statement in verifiable evidence.
---

Before making any factual claim, verify it against primary sources or provide a path to verification. Prevent the "hallucination cascade" where one unverified claim becomes the basis for others.

## Rules for factual claims

### 1. State your source
Every claim about external facts (API behavior, historical events, benchmark numbers, legal requirements) needs a source.

**Good:**
- "React 19 removed `useEvent` (per the React 19.0.0 changelog)"
- "GDPR requires breach notification within 72 hours (GDPR Article 33)"
- "This endpoint returns 429 with `Retry-After` header (tested against api.example.com v2.1)"

**Bad:**
- "React 19 removed several hooks" (which ones? says who?)
- "GDPR requires prompt notification" (how prompt? link?)
- "Rate limits return 429" (did you test, or assume?)

### 2. Distinguish verified from inferred
If you're reasoning from evidence rather than quoting it, say so:

- "The code imports `better-sqlite3` → likely uses SQLite" ✓
- "The code uses SQLite" (when you saw an import but didn't read the code) ✗

Use qualifiers:
- "suggests", "likely", "appears to", "based on X"

### 3. Check yourself before citing a number
Numbers are the most dangerous hallucinations because they sound precise.

Before citing:
- A version number → check package.json, changelog, or docs
- A performance number → check the benchmark source or run it
- A date → check the git log, release notes, or changelog
- A config value → check the config file or docs
- A count ("5 items", "12 fields") → actually count

If you can't verify it in under 30 seconds, say "approximately" or omit the number.

### 4. Prefer primary sources
The authority hierarchy:
1. **Official docs** (api.example.com/docs)
2. **Source code** (the actual implementation)
3. **Changelog / release notes** (official repo)
4. **Issue tracker** (GitHub issues, especially labeled "bug" or "confirmed")
5. **Blog posts from maintainers** (dated within 6 months)
6. **Stack Overflow / forums** (multiple consistent answers)
7. **Random blog posts** (lowest authority; verify independently)

Never cite a random blog as truth without checking the official docs.

### 5. Flag uncertainty explicitly
If you're not sure, say so:

- "I don't have access to X, so I can't verify this claim."
- "The docs are unclear on X; based on code, it appears to Y."
- "This worked in version 1.0; I can't confirm it still works in 2.0 without testing."

## Workflow: writing documentation

1. **Draft without citations**  
   Write the content first.

2. **Mark every factual claim**  
   Highlight any sentence that a reader might question.

3. **Verify or qualify each one**  
   - Can you link to official docs? Add the link.
   - Can you point to code? Add the file path.
   - Can you run a test? Run it and state the result.
   - If none of the above: add a qualifier ("likely", "appears to").

4. **Remove unverifiable claims**  
   If you can't verify it and it's not critical, delete it. Better to say less accurately than more inaccurately.

## Workflow: answering a factual question

1. **Check primary sources first**  
   Before answering, search official docs, read the relevant code, or grep the repo.

2. **If you find the answer, cite it**  
   "According to `docs/api.md`, the timeout is 30s."

3. **If you don't find it, say so**  
   "I don't see a documented timeout. Based on the default in `src/client.ts` line 47, it's 30s, but that's an implementation detail and might change."

4. **Never fill a gap with a guess presented as fact**  
   "It's probably X" is acceptable.  
   "It's X" (when you're guessing) is not.

## Common hallucination traps

### API responses
Don't invent response shapes. If you haven't seen the actual response:
- "The endpoint returns `{ ok: boolean }` (source: `openapi.yaml`)" ✓
- "The endpoint returns `{ ok: boolean }`" (when you're guessing from the name) ✗

If you must guess, show the guess as code the user should verify:
```javascript
// Assumed response shape (VERIFY against real API):
{ ok: boolean }
```

### Version compatibility
Don't claim "X works in version Y" unless you've verified it.
- "This syntax requires TypeScript 4.5+ (per TS 4.5 release notes)" ✓
- "This should work in TypeScript 4.5" (when you're inferring from features) ✗

### Performance claims
Don't state "X is faster than Y" without benchmarks.
- "In this benchmark, X completes in 120ms vs Y's 340ms (M1 Pro, Node 18.0)" ✓
- "X is faster than Y" (when you haven't measured) ✗

## Before you hit send

Ask yourself:
1. Can the user verify every factual claim I made?
2. Did I mark anything as "likely" or "based on" when I'm inferring?
3. Did I cite a source for any claim that could be wrong?

If the answer to any is "no", revise.

## When to use this skill

Use this skill when:
- Writing documentation (README, API docs, tutorials)
- Answering "how does X work?" or "what does Y return?"
- Making a recommendation based on performance, compatibility, or requirements
- Citing benchmarks, version numbers, or historical facts

Skip this skill when:
- Writing opinion ("I recommend X because Y" - opinion is fine)
- Explaining your own code (you're the primary source)
- Sketching ideas or prototypes (accuracy matters less in brainstorming)
