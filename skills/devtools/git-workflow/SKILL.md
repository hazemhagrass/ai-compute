---
name: git-workflow
description: "Use when committing, branching, or fixing git state. Enforces one-change commits, why-focused messages, pre-commit checks, and safe history recovery."
---

# Git Workflow

Rules for producing a history that can be read, bisected, reverted, and trusted.

## Commit Scope

- Put exactly one logical change in one commit. A commit that does two things
  cannot be reverted without losing one of them, so `git revert` stops being a
  safe tool the moment you mix a bug fix with a rename.
- Split accidental mixed changes with `git add -p` before committing, choosing
  `y`/`n`/`s`/`e` per hunk, because staging the whole file is what created the
  mixed commit in the first place:

  ```bash
  git add -p src/auth.py      # stage only the fix hunks
  git commit -m "fix: reject expired refresh tokens"
  git add -p src/auth.py      # stage the rename/cleanup hunks
  git commit -m "refactor: rename tok -> token for readability"
  ```

- Check what you are about to commit with `git diff --cached` every time. The
  staged set, not the working tree, is what lands in history.
- Keep formatting-only churn in its own commit. Mixing reformatting with logic
  hides the logic change inside hundreds of noise lines during review and blame.

## Commit Messages

- Write the subject in the imperative, under ~72 characters, prefixed by type
  (`fix:`, `feat:`, `refactor:`, `chore:`, `docs:`, `test:`). The imperative
  reads correctly in generated changelogs and in `git log --oneline`.
- Use the body to explain WHY: the constraint, the bug symptom, the tradeoff
  rejected. The diff already shows WHAT changed, so a body that restates the
  diff adds nothing a reader could not get from `git show`.
- Record the non-obvious: why a slower algorithm was chosen, why a workaround
  exists, what breaks if someone "simplifies" it later. That is the context no
  tool can reconstruct six months on.

  ```
  fix: retry token refresh once on 503

  The identity provider returns 503 for ~2s during its rolling deploys,
  which logged users out mid-session. A single retry with 500ms backoff
  covers the observed window without masking real outages (a second
  failure still surfaces as an auth error).
  ```

- Never write `Closes #N` or `Fixes #N` in a commit message unless you intend
  GitHub to auto-close that issue the instant the commit merges to the default
  branch. Use `Refs #N` when a human should verify before the issue closes.
  This is a real trap: an automated commit carrying `Fixes #N` silently closed
  a ticket nobody had reviewed, and the remaining work vanished from the board.
- Prefer `Refs #N` as the default link, and promote to `Closes #N` only when
  the commit genuinely completes every acceptance criterion on the issue.

## Before Every Commit

- Run the linter and the full relevant test suite BEFORE each commit, not once
  before the final push. A broken commit in the middle of a branch breaks
  `git bisect` forever, and bisect is the tool you will want most when a
  regression appears months later.

  ```bash
  npm run lint && npm test        # or: ruff check . && pytest -q
  git commit
  ```

- Wire the check into `.git/hooks/pre-commit` (or `pre-commit` framework) so a
  hurried commit cannot skip it. Reserve `--no-verify` for genuine emergencies
  and fix the commit immediately after, because a habit of bypassing hooks
  turns the whole guarantee off.
- Test the staged state, not the dirty tree, when they differ:
  `git stash push --keep-index --include-untracked`, run the suite, then
  `git stash pop`.

## History Rewriting

- Never rewrite history that has been published to a shared branch. Anyone who
  pulled the old commits gets a divergent history, and their next `git pull`
  either creates duplicate commits or silently drops work.
- The one exception: a short-lived branch owned by you alone, typically a PR
  branch nobody else has checked out. Rebase and squash freely there.
- When you must force-push that personal branch, use the safe form so you do
  not clobber a teammate's push you have not fetched:

  ```bash
  git push --force-with-lease origin feature/token-retry
  ```

- If someone else may have based work on the branch, announce it before the
  force-push (channel/PR comment), name the branch and the new base commit,
  and tell them the exact recovery command:

  ```bash
  git fetch origin
  git rebase --onto origin/feature/token-retry <old-base> <their-branch>
  ```

- Clean up your own branch before review with an interactive rebase, so the
  reviewer reads intent rather than your debugging trail:

  ```bash
  git rebase -i origin/main
  ```

## Merge vs Rebase

- Default: rebase your feature branch onto the target branch before merging,
  then merge with `--no-ff`. This is not a matter of taste. A linear branch
  history makes `git bisect` meaningful and `git log --first-parent` readable,
  while the merge commit preserves the fact that a set of commits shipped as
  one unit.

  ```bash
  git fetch origin
  git rebase origin/main
  # run lint + tests again, rebase can produce a broken intermediate state
  git push --force-with-lease
  ```

- Exception: never rebase a shared long-lived branch (`main`, `develop`,
  release branches). Merge into those, because rewriting them breaks every
  clone.
- Resolve rebase conflicts hunk by hunk and rerun the tests afterwards. A
  conflict resolution that compiles is not evidence that it is correct.

## Recovering Lost Work

- Check `git reflog` FIRST, always, before anything destructive. Nearly every
  "I lost my commits" situation (bad reset, botched rebase, deleted branch) is
  recoverable because the old tips stay in the reflog for ~90 days.

  ```bash
  git reflog                       # find the sha you were on
  git reset --hard HEAD@{3}        # or: git checkout -b rescue <sha>
  ```

- Recover a deleted branch by pointing a new branch at the old tip:

  ```bash
  git branch recovered-work <sha-from-reflog>
  ```

- Recover commits that the reflog does not show with `git fsck --lost-found`,
  which lists dangling commits and blobs still in the object store.
- Before running anything destructive (`reset --hard`, `clean -fd`, a rebase on
  messy state), snapshot first so recovery is trivial:

  ```bash
  git stash push --include-untracked -m "pre-reset snapshot"
  # or
  git branch backup/$(date +%s)
  ```

- Never run `git clean -fd` without `-n` first. Untracked files have no objects
  in the repo, so the reflog cannot bring them back.

## Ignoring Artifacts and Handling Secrets

- `.gitignore` build output, dependency directories, local env files, and
  editor state (`node_modules/`, `dist/`, `.venv/`, `*.log`, `.env`,
  `.DS_Store`). Committed artifacts bloat clones and generate conflicts on
  every build.
- Keep machine-specific ignores out of the shared file: put them in
  `.git/info/exclude` or a global ignore file, since your editor's clutter is
  not the repo's concern.

  ```bash
  git config --global core.excludesfile ~/.gitignore_global
  ```

- Never commit a secret: keys, tokens, passwords, certificates, connection
  strings. Commit a `.env.example` with empty values instead, and load real
  values from the environment or a secret manager.
- Scan before committing (`git diff --cached | grep -Ei 'api[_-]?key|secret|
  password|BEGIN .* PRIVATE KEY'`) or install a scanner hook. Cheap check,
  permanent consequence if missed.
- The moment you realise a secret WAS committed, rotate it first, scrub second.
  Scrubbing does not un-leak the secret: if the commit was ever pushed, assume
  it is already cloned, cached by the forge, and indexed. Revoking the
  credential is the only action that actually stops the damage.

  1. Revoke/rotate the credential at its source (provider console, KMS, CI
     secrets) and confirm the old value now fails.
  2. Remove it from history:

     ```bash
     git filter-repo --invert-paths --path config/secrets.yml
     # or targeted replacement:
     git filter-repo --replace-text secrets.txt
     ```

  3. Force-push the rewritten branches and tags, tell every collaborator to
     re-clone (their old clones still contain the secret), and ask the forge to
     expire cached views of the old commits.
  4. Audit access logs for use of the leaked credential during its exposure
     window.

## Local Configuration

- Set `core.fileMode=false` when the filesystem produces spurious 644/755
  churn (Windows mounts, WSL, network shares, Docker bind mounts). Git tracks
  only the executable bit, and a filesystem that misreports it makes every file
  look modified, which buries real changes and causes accidental mode-only
  commits:

  ```bash
  git config core.fileMode false          # this repo only
  ```

  Set it per repo, not globally, because on a correct filesystem the
  executable bit is real information you want tracked (scripts must stay
  executable).
- Set `pull.rebase=true` (`git config --global pull.rebase true`) so a routine
  `git pull` stops injecting noise merge commits into your feature branch, and
  `rerere.enabled true` so repeated conflict resolutions during long rebases
  are replayed automatically.

## Quick Checklist

- One logical change staged? (`git diff --cached`)
- Lint and tests green on the staged state?
- Subject imperative and typed, body explaining why?
- `Refs #N` unless you truly mean `Closes #N`?
- No secrets, no build artifacts in the diff?
- Rebased onto the target branch, force-pushed only with `--force-with-lease`?
