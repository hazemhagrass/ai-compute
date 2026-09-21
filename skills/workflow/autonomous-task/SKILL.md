---
name: autonomous-task
description: Use for long-running tasks requiring sustained work without interruption. Work until done or blocked.
---

Work autonomously on complex, multi-step tasks until completion, minimizing interruptions and permission requests. Make reasonable judgement calls, continue through minor obstacles, and report only genuine blockers.

## Core principles

**Sustained focus over permission-seeking.** If the next step is obvious and low-risk (read a file, run a test, write a helper function), do it. Don't stop to ask.

**Verify as you go.** After each significant change (new module, refactor, API integration), run the relevant verification (tests, typecheck, build, manual smoke test) before moving to the next piece.

**Report blockers, not progress.** When genuinely stuck (missing credentials, ambiguous requirement, architectural decision beyond your scope), state the blocker clearly and what you need to proceed. Otherwise, keep working.

**Commit in logical units.** Don't wait until the entire task is done. Commit each coherent piece (one ticket, one module, one feature) as it passes verification, with `Refs #N`.

## When to stop and ask

- **Missing information you cannot discover**: credentials, API keys, production URLs, user preferences
- **Architectural decisions with multiple valid approaches**: microservice boundaries, database schema, framework choice
- **Conflicts with existing patterns**: the codebase has an established way, but the task seems to require breaking it
- **Test/build/deploy failures you cannot fix** after one genuine attempt (not just re-running the same thing)
- **Ambiguous requirements**: "add analytics" could mean ten different things

## When NOT to stop

- ✅ Next file to edit is obvious
- ✅ Variable/function name needs choosing (pick a clear one)
- ✅ Test is failing due to typo/import (fix it)
- ✅ Linter complains (fix it, don't ask permission)
- ✅ Need to read docs/code to understand an API (read it)
- ✅ Have 3 tickets in the same area (do all 3, commit each)

## Workflow

1. **Understand the full scope.** Read the ticket(s), related code, docs, and tests before starting.
2. **Plan the work.** Identify logical chunks (e.g., "backend route → client function → UI component → tests").
3. **Execute chunk by chunk.** Implement, verify (tests/typecheck/build), commit with `Refs #N`.
4. **Self-verify the whole thing.** After all chunks land, run the full test suite, build, and a manual smoke test if applicable.
5. **Report completion** with what was done, what was verified, and the commit SHAs.

## Verification ladder

After each chunk, run the **minimum verification** that proves it works:

| Change type | Minimum verification |
|-------------|---------------------|
| New function/module | Unit tests pass |
| API route | Integration test or manual `curl` |
| UI component | Build succeeds, visual check in browser |
| Refactor | Existing tests still pass |
| Bug fix | Test that reproduces the bug now passes |
| Whole feature | Full test suite + build + smoke test |

Don't commit broken code to "fix it later." Each commit should be deployable.

## Progress reporting

**During work**: only report genuine blockers. Don't send updates like "finished the API route, starting the client function." The user can see commits.

**At completion**: summarize what was done, what was verified, and link to commits/issues.

Example final report:
```
Completed #47, #48, #49.

- Added grill-me skill (SKILL.md + README, 0 em-dashes)
- Added autonomous-task skill (SKILL.md + README)
- Added Lancache skill (setup, troubleshooting, Pi-hole integration)

Verified: 0 tsc errors, 0 em-dashes across all files, trigger-first descriptions.

Commits: 4e3930d, a1b2c3d, d4e5f6g
All issues closed.
```

## Anti-patterns

| Anti-pattern | Fix |
|--------------|-----|
| Stopping to ask "should I create a helper function?" | Just create it with a clear name |
| Running `npm test` fails, immediately asking for help | Read the error, try one fix, then ask if stuck |
| Committing 10 files at once with "feat: add feature" | Commit each logical unit separately |
| Asking "which variable name?" | Pick the clearest one (prefer `userId` over `id`, `fetchUserById` over `get`) |
| Reporting progress every 10 minutes | Work silently, report completion or blockers only |
| Skipping verification because "it looks right" | Run tests/build before committing |

## Handling ambiguity

When a requirement is vague:

1. **Check existing patterns** in the codebase (how do similar features work?)
2. **Pick the simplest reasonable interpretation** that solves the stated problem
3. **Document the choice** in the commit message or code comment
4. **Only ask** if the choice has significant architectural impact (e.g., adding a new database vs using existing tables)

## Multi-hour work

For tasks expected to take 2+ hours:

- Commit every 20-30 minutes (one logical unit)
- Push every hour so progress is visible
- If a blocker appears, report it immediately (don't wait until the end)
- If the task scope expands mid-work, note it in the next commit message

## When the task is genuinely done

- All tickets linked in the scope are resolved
- Tests pass (unit + integration if applicable)
- Typecheck clean
- Build succeeds
- Manual smoke test confirms the feature works end-to-end
- Commits pushed
- Issues closed with `Refs #N` in commit messages

Then report completion with evidence (commit SHAs, test output, verification steps taken).

## Example: good autonomous flow

**Task**: Implement #50 (add budget alerts)

1. Read issue, check related code (`src/lib/budget.ts`, existing alert patterns)
2. Plan: backend check function → API route → client hook → UI notification → tests
3. Write `checkBudgetThreshold()` in `budget.ts`, add unit test, verify passes, commit `Refs #50`
4. Write `POST /api/budgets/check` route, test with `curl`, commit `Refs #50`
5. Write `useBudgetAlert` hook, build succeeds, commit `Refs #50`
6. Add notification UI, visually verify in browser, commit `Refs #50`
7. Run full test suite (479 tests pass), `tsc --noEmit` (0 errors), `pnpm build` (succeeds)
8. Manual smoke: create budget, trigger threshold, see notification
9. Push all 4 commits, close #50
10. Report: "Completed #50. Budget alerts working end-to-end. Commits: abc123, def456, ghi789, jkl012. Verified: tests pass, typecheck clean, build ok, notification triggers correctly."

**Time to completion**: 90 minutes. User interruptions: 0.
