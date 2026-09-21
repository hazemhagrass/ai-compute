# Spec-First Development

A six-stage loop (research, spec, plan, build, test, ship) that turns a vague feature request into working code by writing the contract before writing the implementation.

## What it does

This skill replaces "start typing and see what happens" with an explicit sequence:

1. **Research** - interview the requester until success criteria, inputs, outputs, constraints, and out-of-scope items are written down.
2. **Spec** - define the public interface (function signature, HTTP contract, component props) plus the edge cases it must honor. No implementation details.
3. **Plan** - list implementation tasks in dependency order, with the dependencies stated explicitly.
4. **Build** - write code that satisfies the spec, one task at a time.
5. **Test** - one test per spec claim. A claim with no test is not part of the contract.
6. **Ship** - commit referencing the spec, update the docs, and update the spec itself if it drifted.

The premise: the bottleneck is the spec, not the code generation. A precise spec produces correct code in fewer iterations than a vague prompt plus five rounds of correction.

## When to use this

Use it when:

- You are building a new feature rather than fixing a bug.
- The request is high-level ("add user authentication", "let users upload files").
- More than one person has to agree on what is being built.
- You are shipping a public API or library, where the spec doubles as the documentation.

Skip it when:

- The bug has a known root cause and a one-line fix.
- You are writing a throwaway spike to answer a question.
- The change is mechanical (rename a symbol, bump a dependency).

## Quick start

Request from a product owner: *"Users should be able to upload their resume."*

### Stage 1: Research

Questions asked, answers recorded:

```markdown
# Requirements: resume-upload

**Success criteria:** A signed-in candidate uploads a PDF or DOCX resume and
sees it listed on their profile within 5 seconds.
**User:** Signed-in job candidate (web, desktop and mobile browsers)
**Inputs:** One file, drag-dropped or picked from a file dialog
**Outputs:** A stored file ID, plus the file name and upload date on the profile
**Constraints:** 10 MB max, PDF and DOCX only, existing S3 bucket, no virus scan yet
**Out of scope:** Resume parsing, multiple resumes per user, versioning
```

The "out of scope" line is the one that saves the most time. Without it, someone builds resume parsing.

### Stage 2: Spec

```tsx
<FileUploader
  accept=".pdf,.docx"
  maxSizeMB={10}
  onSuccess={(fileId: string) => void}
  onError={(message: string) => void}
/>
```

Backing endpoint:

```
POST /api/resume
Body: multipart/form-data, field "file"
Response 201: { fileId: string; fileName: string; uploadedAt: string }
Response 400: { error: string }   // wrong type, or over 10 MB
Response 401: { error: string }   // not signed in
Response 413: { error: string }   // body exceeded the proxy limit

Rules:
- MIME type AND extension are both checked server-side
- A second upload replaces the first (one resume per user)
- Rate limit: 10 uploads/hour per user
```

Behavior the component must show: progress while uploading, client-side type and
size validation before the request is sent, one automatic retry on network failure.

### Stage 3: Plan

```markdown
## Tasks for resume-upload

1. [ ] Add `resumeFileSchema` (type + size) to `src/lib/validation.ts`
2. [ ] Write validation tests: .pdf ok, .docx ok, .exe rejected, 11 MB rejected
3. [ ] Add `POST /api/resume` handler with auth guard and rate limit
4. [ ] Write route tests for 201, 400, 401, 413 and the replace-existing rule
5. [ ] Build `<FileUploader />` with progress, client validation, single retry
6. [ ] Render the uploaded resume row on the profile page
7. [ ] Document the endpoint in `docs/api.md`

Dependencies: 3 needs 1; 5 needs 3; 6 needs 5.
```

### Stage 4 to 6: Build, test, ship

Finish task 1, run the tests, then start task 2. When task 4 reveals that the
proxy returns 413 before the handler ever runs, stop: that is a spec change.
Add the 413 row to the spec, confirm it with the requester, then continue.

Commit message references the contract, not the diff:

```
feat(resume): accept PDF/DOCX resume upload, 10 MB cap, one per user
```

## Key concepts

**Contract, not implementation.** The spec says "lookups are O(1) average case",
never "use a HashMap". The spec is what callers depend on. Anything a caller
cannot observe belongs in the code, not the spec.

**The spec is stable by default.** Discovering mid-build that the spec is wrong
is normal. Silently coding something different is not. Stop, revise the spec,
get agreement, resume.

**One task at a time.** Each plan task is finished and tested before the next
one starts. Parallel half-done tasks hide which change broke the suite.

**Every spec claim has a test.** "Plus-sign emails are valid" becomes a test
case using `user+tag@domain.com`. "Rate limit 5/min" becomes a test that the
sixth request returns 429.

**Silence in the spec is not permission.** If the spec says nothing about
concurrent uploads, the test must not assert a behavior for them. Either add
the claim to the spec or leave it untested and unpromised.

**Out of scope is part of the spec.** It is the cheapest section to write and
the one that prevents the most rework.

## Common pitfalls

**Writing the spec as implementation notes**

```
Bad:  Cache the user lookup in a Map keyed by userId, evict after 60s.
Good: getUser(id) returns the current user; repeated calls within a
      request are cheap. Staleness up to 60s is acceptable.
```

The bad version locks in a data structure. The good version states what callers
can rely on and leaves the mechanism free.

**Leaving the spec in your head**

```
Bad:  "I know what we're building, let's just start."
Good: A 15-line Requirements block in the PR description, linked from
      the first commit.
```

An unwritten spec cannot be reviewed, disagreed with, or used as a test oracle.

**Vague success criteria**

```
Bad:  Success criteria: uploads work well.
Good: Success criteria: a candidate uploads a 10 MB PDF and sees it on
      their profile within 5 seconds on a 4G connection.
```

"Works well" cannot fail a test. The good version can.

**Drifting silently when reality disagrees**

```
Bad:  Spec says 400 for oversized files. Proxy returns 413 first.
      Ship it, adjust the test to expect 413, say nothing.
Good: Spec says 400. Proxy returns 413. Add 413 to the spec, note the
      proxy limit, confirm with the requester, then update the test.
```

The test passing either way is exactly why this is dangerous.

**Batching all tasks then testing once**

```
Bad:  Implement tasks 1 through 6, run the suite, get 14 failures.
Good: Implement task 1, run the suite (green), implement task 2,
      run the suite (green), ...
```

Fourteen failures at once means you no longer know which change caused which.

**Skipping the spec for "small" features**

```
Bad:  "It's just a checkbox, no spec needed."
Good: Checkbox spec: default off, persists per user, disabled while the
      parent form is saving, does not fire on programmatic change.
```

The checkbox had four behaviors nobody had agreed on.

## See also

Sibling skills in `skills/productivity/`:

- [`planning/`](../planning) - breaking larger efforts into ordered, trackable work; pairs with stage 3 of this loop.
- [`technical-writing/`](../technical-writing) - sharpening the prose of the Requirements and spec documents.
- [`readme-generator/`](../readme-generator) - producing the user-facing docs that stage 6 asks you to update.
- [`git-commit-writer/`](../git-commit-writer) - writing the spec-referencing commit message in stage 6.
- [`truth-first/`](../truth-first) - keeping claims about what was built honest, which is the same discipline as not letting the spec drift.
- [`grill-me/`](../grill-me) - pressure-testing a spec by having its assumptions challenged before you build.
- [`autonomous-task/`](../autonomous-task) - running the plan's tasks with less supervision once the spec is settled.
- [`skill-authoring/`](../skill-authoring) - writing new skills, itself a spec-first exercise.
- [`env-doctor/`](../env-doctor) - unblocking the environment when stage 4 or 5 fails for reasons unrelated to your code.
