# Autonomous Task

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Enable the AI to work on complex, multi-step tasks without stopping for permission at every decision. Work continues until completion or genuine blocker, minimizing interruptions.

## What it does

Executes long-running implementation work (features, refactors, bug fixes) with sustained focus. Makes reasonable judgment calls on minor decisions (variable names, file structure, helper functions), commits in logical units, verifies as it goes, and reports only when genuinely stuck.

## When to use it

- **Multi-hour implementation** while you're away from keyboard (meetings, sleep, other work)
- Tasks with **obvious next steps** (implement 5 tickets in the same module, refactor a subsystem, add test coverage)
- You've already made the **architectural decisions** (framework, patterns, structure) and want execution
- **Batch work**: "finish all phase 3 tickets", "add tests to every file in `src/lib/`"

## When NOT to use it

- ❌ Exploratory work requiring frequent course correction
- ❌ Architectural decisions still open (microservice boundaries, schema design, framework choice)
- ❌ High-stakes changes to production systems without a safety net
- ❌ Work that legitimately needs user input every 15 minutes (ambiguous requirements, API design feedback)

## How it works

### 1. Understand scope
Reads ticket(s), related code, docs, tests. Identifies dependencies and logical chunks.

### 2. Plan chunks
Breaks work into commit-sized pieces: "backend route → client function → UI → tests" or "ticket #47 → #48 → #49".

### 3. Execute + verify + commit
For each chunk:
- Implement
- Run minimum verification (tests for new function, `curl` for API route, build for UI)
- Commit with `Refs #N`
- Push every hour

### 4. Final verification
After all chunks: full test suite, typecheck, build, manual smoke test.

### 5. Report completion
What was done, what was verified, commit SHAs, issues closed.

## Verification ladder

| Change type | Minimum verification |
|-------------|---------------------|
| New function/module | Unit tests pass |
| API route | Integration test or manual `curl` |
| UI component | Build succeeds, visual check |
| Refactor | Existing tests still pass |
| Bug fix | Reproducing test now passes |
| Whole feature | Full suite + build + smoke test |

Never commit broken code to "fix later."

## When to stop and ask

**Do stop** for:
- Missing credentials/keys/prod URLs
- Architectural decisions with multiple valid approaches
- Conflicts with existing codebase patterns
- Test/build failures after one genuine fix attempt
- Ambiguous requirements ("add analytics" = 10 interpretations)

**Don't stop** for:
- ✅ Obvious next file to edit
- ✅ Choosing variable/function names (pick clear ones)
- ✅ Failing test due to typo (fix it)
- ✅ Linter complaint (fix it)
- ✅ Need to read docs/code (read it)
- ✅ 3 similar tickets (do all, commit each)

## Progress reporting

**During work**: silence unless blocked. User can see commits.

**At completion**:
```
Completed #47, #48, #49.

- Added grill-me skill (SKILL.md + README)
- Added autonomous-task skill (SKILL.md + README)
- Added Lancache skill (setup + troubleshooting)

Verified: 0 tsc errors, all tests pass, build ok.
Commits: 4e3930d, a1b2c3d, d4e5f6g
```

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| Asking "should I create a helper?" | Just create it |
| Test fails → immediately ask | Read error, try one fix |
| 10 files in one commit | Commit logical units |
| Reporting progress every 10 min | Report completion/blockers only |
| "It looks right" (skip verification) | Run tests before commit |

## Handling ambiguity

1. Check existing codebase patterns
2. Pick simplest reasonable interpretation
3. Document choice in commit message
4. Only ask if architecturally significant

## Multi-hour work checklist

- [ ] Commit every 20-30 minutes (one logical unit)
- [ ] Push every hour
- [ ] Report blockers immediately
- [ ] Note scope expansion in commit messages

## Example: budget alerts (#50)

**Scope**: Implement budget threshold alerts

**Plan**:
1. Backend check function
2. API route
3. Client hook
4. UI notification
5. Tests

**Execution** (90 minutes, 0 interruptions):
1. `checkBudgetThreshold()` in `budget.ts` + test → commit `Refs #50`
2. `POST /api/budgets/check` + `curl` test → commit `Refs #50`
3. `useBudgetAlert` hook + build → commit `Refs #50`
4. Notification UI + browser check → commit `Refs #50`
5. Full suite (479 pass), typecheck (0 errors), build (ok)
6. Smoke: create budget, trigger threshold, see alert
7. Push 4 commits, close #50

**Report**:
```
Completed #50. Budget alerts working end-to-end.
Commits: abc123, def456, ghi789, jkl012
Verified: tests pass, typecheck clean, build ok, notification triggers correctly.
```

## Tips for successful autonomous sessions

1. **Set clear scope upfront**: "finish phase 3 tickets" beats "make progress on the app"
2. **Ensure prereqs are met**: tests pass before starting, architecture decided, credentials available
3. **Trust the process**: resist the urge to check in every 20 minutes
4. **Review commits after**: the commit history is the session log

## What "done" means

- [ ] All tickets in scope resolved
- [ ] Tests pass (unit + integration)
- [ ] Typecheck clean
- [ ] Build succeeds
- [ ] Manual smoke test confirms feature works
- [ ] Commits pushed
- [ ] Issues closed with `Refs #N`

Then the AI reports with evidence (SHAs, test output, verification log).
