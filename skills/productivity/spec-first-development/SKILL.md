---
name: spec-first-development
description: Use when building a feature from scratch. Interview first, spec second, code last.
---

Turn a vague feature request into working code through a structured loop: research (ask questions), spec (write down exactly what to build), plan (break into tasks), build (implement), test (verify), and ship (commit + document).

The bottleneck is the spec, not the AI. A clear spec produces better code in fewer iterations than jumping straight to implementation.

## The loop

### 1. Research (ask first)
Interview the user before writing anything. Ask:
- What does success look like? (concrete outcome, not abstract goal)
- Who will use this? (end user, developer, API consumer)
- What are the inputs and outputs?
- What edge cases or constraints matter?
- What should NOT happen?

Produce a short Requirements doc:
```markdown
# Requirements: <feature-name>

**Success criteria:** <1-2 sentences>
**User:** <role>
**Inputs:** <what goes in>
**Outputs:** <what comes out>
**Constraints:** <limits, performance, compatibility>
**Out of scope:** <what we're NOT building>
```

### 2. Spec (define the interface)
Write a spec that defines the public interface without implementation details.

For a function/module:
```typescript
/**
 * Validates an email and returns detailed errors.
 * @param email - Raw input string
 * @returns { ok: boolean; errors?: string[] }
 * 
 * Edge cases:
 * - Plus-sign emails (user+tag@domain.com) are valid
 * - Internationalized domains (münchen.de) are valid
 * - Trailing dots are rejected (per RFC 5321)
 */
export function validateEmail(email: string): ValidationResult;
```

For an API endpoint:
```
POST /api/auth/signup
Body: { email: string; password: string }
Response 200: { userId: string; sessionToken: string }
Response 400: { error: string; fields: { email?: string; password?: string } }

Rules:
- Password must be 12+ chars
- Email must not already exist (checked at DB level)
- Rate limit: 5 requests/min per IP
```

For a UI component:
```tsx
<FileUploader
  accept=".pdf,.docx"
  maxSizeMB={10}
  onSuccess={(fileId) => ...}
  onError={(message) => ...}
/>

Behavior:
- Shows progress during upload
- Validates file type + size before sending
- Retries once on network failure
```

### 3. Plan (break into tasks)
List the implementation tasks in dependency order:

```markdown
## Tasks for <feature-name>

1. [ ] Add `validateEmail` to `src/lib/validation.ts`
2. [ ] Write tests (passing: valid emails, failing: edge cases)
3. [ ] Wire `validateEmail` into `POST /api/auth/signup` handler
4. [ ] Update Zod schema to call validator
5. [ ] Add field-level error display to signup form
6. [ ] Document the validation rules in README

Dependencies: Task 3 needs Task 1; Task 5 needs Task 3.
```

### 4. Build (implement the spec)
Write the code that matches the spec. The spec is the contract; implementation details don't matter as long as the interface holds.

Run tests after each task (not just at the end).

### 5. Test (verify the contract)
Every spec claim needs a test:
- "Plus-sign emails are valid" → test case with `user+tag@domain.com`
- "Rate limit: 5/min" → test that the 6th request returns 429

Run the full suite: `pnpm test` (or equivalent). Fix failures before moving on.

### 6. Ship (commit + document)
- Write a commit message that references the spec (not the implementation)
- Update the relevant doc (README, API docs, changelog)
- If the spec changed during implementation, update the spec too

## Rules

1. **Never skip the spec.** "I know what to build" is how you end up rebuilding it. Write the spec even if it's obvious.

2. **Spec stays stable.** If you realize mid-implementation that the spec is wrong, STOP, revise the spec, and get agreement before continuing. Don't silently drift.

3. **One task at a time.** Finish and test Task 1 before starting Task 2. Trying to do them all in parallel produces merge conflicts and missed edge cases.

4. **Tests enforce the spec.** If the spec says "trailing dots are rejected", the test must check that. If the spec is silent on something, the test shouldn't assume behavior.

5. **Document decisions.** If you chose one approach over another, write a comment explaining why. Your future self (or another dev) will wonder.

## Anti-patterns

- ❌ "Let me just write the code and we'll figure out the spec later" (produces code that doesn't match what was needed)
- ❌ "The spec is in my head" (other people can't review or extend it)
- ❌ Spec that describes implementation ("use a HashMap to store the cache") instead of contract ("lookups are O(1) average case")
- ❌ Skipping tests because "it's a small change" (small changes break in surprising ways)

## When to use this skill

Use this skill when:
- Building a new feature (not fixing a bug - bugs need systematic-debugging)
- The request is vague or high-level ("add user authentication")
- Multiple people need to agree on what's being built
- You're building a public API or library (the spec becomes the docs)

Skip this skill when:
- Fixing a clearly-defined bug with a known root cause
- Writing a throwaway prototype/spike
- The task is purely mechanical (rename a variable, update a dependency)
