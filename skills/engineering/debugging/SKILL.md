---
name: debugging
description: "Use when chasing a bug or unexplained failure. Reproduce first, binary search the change set, input and code path, and fix the root cause instead of the symptom."
---

# Debugging: find the cause, not a patch that hides it

A symptom patch is a bug that comes back wearing a different hat. The job is
not "make the red go away", it is "explain the failure well enough that the fix
is obvious". If you cannot say why the bug happened, you have not fixed it.

## Reproduce before you change anything

- Get a deterministic repro before touching a single line, because a fix
  validated against an intermittent repro is a coincidence, not a fix.
- Write the repro down as a command, not as a memory. `pytest tests/t.py::test_x -x`
  or `curl -s localhost:3000/api/orders | jq .total` is reproducible next week;
  "click around the settings page" is not.
- Run the repro at least three times before you believe it. If it fails 2 of 3,
  treat flakiness itself as the bug to explain first (see race conditions below).
- Pin the environment: same commit, same env vars, same data snapshot, same
  clock if time matters. Bugs that vanish when you change environments are
  telling you the environment is the variable.
- Turn the repro into a failing test as soon as you can. The test becomes the
  fix's proof and the regression guard in one artifact.

```bash
# freeze the inputs so the repro is honest
export TZ=UTC LANG=C.UTF-8
git stash list && git rev-parse --short HEAD
pytest -x -q tests/test_orders.py::test_total_rounding
```

## Read the error message completely

- Read every line of the error, top to bottom, before scrolling to the stack
  trace. Most of the time the answer is in the message text, and the reflex is
  to skip straight to the frames.
- Read the innermost cause on wrapped exceptions (`Caused by:`, `during handling
  of the above exception`). The outer layer is usually a generic wrapper.
- Note the exact values quoted in the message: a path, a column name, a type, a
  port. `KeyError: 'user_id'` and `KeyError: 'userId'` are two different bugs.
- Search the literal error string in your own codebase first, not the web. If
  your code raised it, the raising branch tells you the precondition that failed.
- Check for a truncated or swallowed error above the one you are looking at.
  Logs often show the real cause 40 lines earlier, then a cascade of noise.

## Binary search three different things

Binary search is the highest leverage debugging tool and it applies to more
than code. Halve the search space, do not scan it.

### 1. The change set: git bisect

Under-used, and it finds causes you would never have guessed. Use it whenever
"it worked last week".

```bash
git bisect start
git bisect bad                      # current commit is broken
git bisect good v1.4.0              # last known good tag or sha
# git checks out a midpoint; test it, then:
git bisect good      # or: git bisect bad
# repeat until git prints "<sha> is the first bad commit"
git bisect reset
```

Automate it when the test is scriptable, which turns 10 manual rounds into one
command:

```bash
git bisect start HEAD v1.4.0
git bisect run pytest -x -q tests/test_orders.py::test_total_rounding
# exit code 0 = good, 1-124 = bad, 125 = skip (untestable commit)
git bisect reset
```

- Mark unbuildable commits with `git bisect skip` instead of guessing, because a
  wrong `good`/`bad` answer poisons the whole search.
- Bisect on a script that exits nonzero, never on eyeballing output, so the
  result is reproducible.

### 2. The input

- Halve the failing input until you have the smallest thing that still fails.
  A 4 line CSV that reproduces the crash tells you more than the 200MB original.
- Delete, do not edit, while minimising. Editing introduces new variables.
- When minimisation stops reducing, whatever remains is the trigger. Read it
  character by character, including invisible ones (`cat -A`, `xxd | head`).

### 3. The code path

- Bisect the pipeline, not the file: assert the shape of the data at the middle
  stage, then move to the middle of whichever half was wrong.
- One well placed assertion beats five print statements, because it fails at the
  first wrong value instead of letting you read logs of a corrupted downstream.

```python
assert isinstance(total, Decimal), (type(total), total)  # halfway through
```

## Question both assumptions

- First question the assumption that the bug is in your dependency. It usually
  is not. Popular libraries have millions of runs behind their happy path and
  your new code has a dozen.
- Then question the assumption that the bug is not in the dependency. Version
  bumps, transitive upgrades, platform specific wheels, and native extensions do
  break, and lockfile drift is invisible until you look.
- Check the boundary before blaming either side: log exactly what you send and
  exactly what comes back, byte for byte. Most "library bug" reports are
  contract misreadings at the boundary.
- Read the dependency's source when in doubt. It is on disk in `node_modules/`
  or `site-packages/` and reading it is faster than theorising about it.

## Stop guessing, start instrumenting

Two failed guesses is the limit. After that, add observation instead of another
speculative edit, because guessing has no convergence property.

- Add logging when the bug is timing dependent, remote, intermittent, or in
  production, since a breakpoint would change the timing you are measuring.
- Log values and identities, not milestones. `log.info("got here")` teaches you
  nothing; `log.info("order=%s total=%r type=%s", order.id, total, type(total))`
  ends the investigation.
- Use a debugger when the state is rich and local, because stepping beats
  round-tripping through log edits.

```bash
python -m pdb -c continue script.py     # break on the exception
node --inspect-brk ./server.js          # then open chrome://inspect
```

```python
breakpoint()        # Python 3.7+, honors PYTHONBREAKPOINT
# pdb: n step over, s step into, c continue, w stack, pp expr, u/d move frames
```

- Print the whole object, not the field you suspect (`pp vars(obj)`,
  `console.dir(obj, {depth: null})`). The surprise is usually in a field you
  were not watching.
- Reach for `strace`, `tcpdump`, `ltrace`, or the browser Network tab when the
  problem is at a process or network boundary and your logs both look correct.

## Change one thing at a time

- Make exactly one change, then rerun the repro. Two simultaneous changes make
  the result uninterpretable: if it passes you do not know which change worked,
  and if it fails you do not know whether one change helped and the other hurt.
- Revert failed attempts immediately (`git checkout -- path`), so accumulated
  dead edits never become part of the thing you are debugging.
- Keep a written list of hypotheses with outcomes. Without it you will retest
  the same theory twice and skip the one you meant to try.
- Resist "while I am in here" cleanups during a hunt. They add variables and
  they hide the real diff in review.

## Rubber-duck and write the report

- Explain the bug out loud, or to a colleague, or to an inanimate object. The
  act of forming complete sentences exposes the step you were skipping over.
- Write the bug report before asking for help. Stating the expected behaviour,
  the actual behaviour, and the minimal repro forces you to check each claim,
  and a surprising share of bugs die at the moment you type "expected: ...".
- Include the version, the platform, and the exact command in the report. If the
  bug is real you have filed it properly; if it is not, you found that out while
  writing.
- When you say "that should be impossible", stop and verify it rather than
  moving on. That sentence marks the false assumption holding the bug in place.

## Bug classes worth recognising on sight

Pattern matching a failure to a known class saves hours of blind search.

- **Off-by-one**: fails only on the first or last element, empty collections, or
  exactly-at-limit sizes. Check `<` versus `<=`, inclusive versus exclusive range
  ends, and any index arithmetic near a boundary.
- **Race condition**: passes alone, fails under load or in CI, or fixes itself
  when you add a log line (the log changed the timing). Look for shared mutable
  state, missing await, check-then-act sequences, and cleanup running before the
  work it guards.
- **Cold start**: the first call takes 110 seconds and times out, the second
  identical call returns in 447ms. This is not a broken integration and not a
  network problem. It is lazy initialization: model loading, connection pool
  warmup, JIT compilation, container start, lazy imports, or cache population on
  first access. Recognise it by the timing profile alone (huge first call, fast
  subsequent calls, identical inputs), because it is routinely misdiagnosed as
  connectivity and debugged for hours. Fix it by warming on startup with a
  health check that exercises the real path, raising the first-call timeout, or
  eager-loading at boot, never by retrying blindly.
- **Stale cache**: correct after a restart or a hard refresh, wrong again later;
  or correct for you and wrong for everyone else. Suspect any cache layer
  (in-process memo, Redis, CDN, HTTP cache headers, build artifacts, bundler
  cache) and check the invalidation key, which is usually missing a dimension.
- **Timezone**: off by exactly a whole number of hours, breaks near midnight,
  breaks only for some users, or breaks twice a year at DST transitions. Store
  and compute in UTC, convert only at the display edge, and never use naive
  local datetimes across a boundary.
- **Floating point**: `0.1 + 0.2 != 0.3`, totals drift by cents, equality
  comparisons fail on values that look identical. Use `Decimal` or integer minor
  units for money, and compare with a tolerance (`math.isclose`) everywhere else.
- **Encoding**: mojibake (`Ã©` for `é`), `UnicodeDecodeError`, lengths that
  disagree with what you see, or failures only on non-ASCII names. Pin UTF-8 on
  every read, write, and socket, and check for a BOM or CRLF in the input.

## Closing the loop

- State the root cause in one sentence before you write the fix. If you cannot,
  you are still symptom-patching.
- Confirm the fix by toggling it: revert it and watch the repro fail again, then
  reapply and watch it pass. That two-way check rules out an unrelated change.
- Land the failing test alongside the fix, so the same cause cannot return
  silently.
- Ask where else this class of bug lives. Root causes are rarely alone: the same
  missing timezone conversion or unkeyed cache usually exists in three places.
