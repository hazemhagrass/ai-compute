# Git Workflow

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill that enforces a git history you can read, bisect, revert, and trust: one logical change per commit, messages that explain why, checks that run before every commit, and safe recovery when things go wrong.

## What it does

`SKILL.md` gives an agent (or a human) a concrete rule set for day-to-day git work, covering seven areas:

- **Commit scope.** One logical change per commit, split mixed work with `git add -p`, keep formatting churn separate.
- **Commit messages.** Typed imperative subject under ~72 chars, body explaining the constraint or tradeoff, `Refs #N` by default instead of `Closes #N`.
- **Pre-commit checks.** Lint and tests green on the *staged* state before each commit, not once before the push.
- **History rewriting.** Rebase freely on a branch you alone own, never on a shared one, and force-push only with `--force-with-lease`.
- **Merge vs rebase.** Rebase the feature branch, merge with `--no-ff`, never rebase `main`/`develop`/release branches.
- **Recovering lost work.** `git reflog` first, `git fsck --lost-found` second, snapshot before anything destructive.
- **Secrets and artifacts.** Ignore build output, never commit credentials, and if one lands: rotate first, scrub second.

It ends with a six-line pre-commit checklist you can run through in a few seconds.

## When to use this

Load this skill when any of these are true:

- You are about to stage and commit changes, especially if `git status` shows more than one kind of change.
- You are writing a commit message and unsure what belongs in the subject versus the body.
- A commit message is about to reference an issue number and you do not know whether it should auto-close.
- You need to clean up a messy branch before opening a PR (interactive rebase, squash, reorder).
- You are about to force-push and want to know whether it is safe.
- You just ran `git reset --hard`, aborted a rebase badly, or deleted a branch, and work seems gone.
- You are deciding between merging and rebasing onto the target branch.
- A secret, `.env` file, or build artifact may have been committed.
- Every file shows as modified with only mode changes (`100644` to `100755`) on WSL, a Docker bind mount, or a network share.

Do not load it for read-only git work like `git log` archaeology or `git blame`.

## Quick start

A realistic session: you fixed an auth bug, and while in the file you also renamed a variable and reformatted a block. Three things, one dirty tree.

**1. See what is actually there.**

```bash
git status --short
# M  src/auth.py
# M  src/auth_test.py
```

**2. Stage only the fix hunks, not the whole file.**

```bash
git add -p src/auth.py src/auth_test.py
# y = stage this hunk, n = skip, s = split further, e = edit by hand
```

**3. Verify the staged set, because the staged set is what lands in history.**

```bash
git diff --cached
```

**4. Test the staged state, not the dirty tree.**

```bash
git stash push --keep-index --include-untracked
ruff check . && pytest -q
git stash pop
```

**5. Commit with a body that explains why.**

```bash
git commit -F - <<'MSG'
fix: retry token refresh once on 503

The identity provider returns 503 for ~2s during its rolling deploys,
which logged users out mid-session. A single retry with 500ms backoff
covers the observed window without masking real outages (a second
failure still surfaces as an auth error).

Refs #412
MSG
```

**6. Commit the leftovers separately.**

```bash
git add -p src/auth.py       # the rename hunks
git commit -m "refactor: rename tok -> token for readability"

git add src/auth.py          # the formatting-only hunks
git commit -m "chore: reformat auth module with black"
```

**7. Rebase onto the target, retest, push safely.**

```bash
git fetch origin
git rebase origin/main
ruff check . && pytest -q    # a rebase can produce a broken intermediate state
git push --force-with-lease origin feature/token-retry
```

Result: three revertable commits, each green on its own, on a linear branch that `git bisect` can walk.

## Key concepts

**The staged set is the unit of truth.** `git status` shows your intent; `git diff --cached` shows what will actually be recorded. Only the second one matters at commit time.

**Revertability drives commit scope.** The test for "is this one commit?" is not size, it is whether `git revert` on it would undo exactly one decision. A bug fix bundled with a rename cannot be reverted without losing the rename.

**Bisectability drives the pre-commit check.** Running tests once before the final push leaves broken commits in the middle of the branch. `git bisect` then lands on them and reports garbage, months later, when you need it most.

**The diff shows WHAT, the message must show WHY.** Anything `git show` can tell the reader is wasted body text. The constraint you worked around, the faster algorithm you rejected, the thing that breaks if someone "simplifies" it: that is the content no tool can reconstruct.

**`Closes #N` is an action, not a label.** It fires the instant the commit hits the default branch. `Refs #N` links without closing, which is what you want unless the commit genuinely satisfies every acceptance criterion.

**Ownership decides whether rewriting is safe.** Rewrite history only on a branch you alone have checked out. Shared branches get merges, never rebases, because a rewrite makes every existing clone divergent.

**`--force-with-lease` is the safe force.** Plain `--force` overwrites whatever is on the remote, including a teammate's push you have not fetched. The lease variant refuses if the remote moved since your last fetch.

**Reflog is a ~90 day safety net for commits only.** Reset, rebase, and deleted branches are almost always recoverable from it. Untracked files deleted by `git clean -fd` are not, because they were never objects in the repo.

**Rotation beats scrubbing for leaked secrets.** Once a secret is pushed, assume it is cloned, cached by the forge, and indexed. `git filter-repo` cleans history, but only revoking the credential stops the damage.

## Common pitfalls

**Committing the whole file when only part of it is the change**

```bash
# Bad: sweeps the fix, the rename, and the reformat into one unrevertable commit
git add src/auth.py
git commit -m "fix auth"
```

```bash
# Good: stage per hunk, commit per logical change
git add -p src/auth.py
git commit -m "fix: reject expired refresh tokens"
```

**A body that restates the diff**

```
# Bad
fix: update auth.py

Changed the refresh function to add a retry loop and a sleep call.
```

```
# Good
fix: retry token refresh once on 503

The IdP returns 503 for ~2s during rolling deploys, logging users out
mid-session. One retry with 500ms backoff covers the window without
masking real outages.
```

**Auto-closing an issue nobody reviewed**

```
# Bad: the ticket closes on merge and the remaining work vanishes from the board
fix: handle null user in session lookup

Fixes #412
```

```
# Good: links the work, leaves the close decision to a human
fix: handle null user in session lookup

Refs #412
```

**Testing at the end of the branch**

```bash
# Bad: commits 1-4 may each be broken, bisect is now useless
git commit -m "wip" && git commit -m "wip 2" && git commit -m "wip 3"
npm test && git push
```

```bash
# Good: green before each commit, enforced by a hook
npm run lint && npm test
git commit
```

**Plain force-push on a branch someone else may have fetched**

```bash
# Bad: silently discards a teammate's commits you never fetched
git push --force origin feature/token-retry
```

```bash
# Good: refuses if the remote moved since your last fetch
git fetch origin
git push --force-with-lease origin feature/token-retry
```

**Panicking after a bad reset**

```bash
# Bad: more destructive commands on top of a damaged state
git reset --hard origin/main
git clean -fd
```

```bash
# Good: reflog first, recover the old tip, only then continue
git reflog
git branch rescue HEAD@{3}
```

**Deleting untracked files blind**

```bash
# Bad: no objects exist for untracked files, so nothing can bring them back
git clean -fd
```

```bash
# Good: dry run, read the list, then delete
git clean -nd
git clean -fd
```

**Scrubbing a leaked key before rotating it**

```bash
# Bad: history is clean, the credential still works for whoever cloned it
git filter-repo --replace-text secrets.txt
git push --force
```

```bash
# Good: revoke at the provider first, confirm the old value fails, then scrub,
# then have every collaborator re-clone
# 1. rotate in the provider console / KMS / CI secrets
# 2. git filter-repo --invert-paths --path config/secrets.yml
# 3. force-push, notify collaborators, audit access logs
```

**Fixing spurious mode churn globally**

```bash
# Bad: hides the executable bit everywhere, including repos where it matters
git config --global core.fileMode false
```

```bash
# Good: scope it to the repo on the misbehaving filesystem
git config core.fileMode false
```

## See also

- `skills/productivity/git-commit-writer/SKILL.md` for drafting the message text itself.
- `skills/engineering/code-review/SKILL.md` for what reviewers look for in the commits this skill produces.
- `skills/engineering/security-audit/SKILL.md` for the wider secret-handling and credential-exposure process.
- `skills/devops/ci-cd-debugging/SKILL.md` when the pre-commit checks pass locally but the pipeline fails.
- `git help revert`, `git help rebase`, `git help reflog`, and the `git-filter-repo` docs for the underlying commands.
