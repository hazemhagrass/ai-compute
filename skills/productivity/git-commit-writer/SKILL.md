---
name: git-commit-writer
description: Use when about to commit. Writes conventional commit messages from staged changes.
---

Read `git diff --cached` and write a conventional commit message that states what changed and why, not how.

## Format

```
<type>(<scope>): <subject>

<body>

[BREAKING CHANGE: <description>]
```

**Type:** feat, fix, refactor, docs, test, chore, perf, style, build, ci.

**Scope:** The changed module/file/component. If changes span multiple logical areas, suggest splitting into separate commits.

**Subject:** Imperative mood ("add X", not "added X"), 50 chars max, no period.

**Body:** Why the change was needed. What it fixes or enables. 72-char wrapped lines.

**Breaking:** Call out API/behavior changes that require user action.

## Rules

1. **One logical change per commit.** If `git diff --cached` mixes unrelated changes (e.g. bugfix + new feature), output "SPLIT REQUIRED" and list the logical groups.

2. **Subject must be searchable.** "fix bug" is useless; "fix null pointer in validateInput when email is empty" is searchable.

3. **Omit obvious information.** "Changed line 47" or "Updated variable name" adds no value. State the user-facing result: "fix validation rejecting valid emails with plus signs".

4. **Breaking changes go in both the footer AND the type.** `feat!: remove deprecated /v1 API` plus `BREAKING CHANGE: /v1 endpoints deleted, migrate to /v2`.

5. **No generic AI-style filler.** Skip "This commit", "In this change", "Here we". Start with the verb.

## Examples

**Good:**
```
feat(auth): add OAuth2 PKCE flow for mobile clients

The implicit flow is deprecated and unsafe for public clients.
PKCE (RFC 7636) eliminates the need for client secrets on mobile.

Fixes #127
```

**Bad:**
```
update: changes to auth

Made some improvements to the authentication system to make it
better and more secure. Updated several files.
```

## Before outputting

Run these checks:
1. Can someone grep the subject 6 months from now and find this commit?
2. Does the body explain *why*, not *what* (the diff is the what)?
3. If someone reverts this commit, will they know what behavior they're reverting?

If any check fails, rewrite.
