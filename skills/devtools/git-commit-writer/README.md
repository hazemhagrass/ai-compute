# Git Commit Writer

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Generates conventional commit messages from staged git changes. Reads your `git diff --cached`, analyzes the changes, and writes clear, searchable commit messages that explain what changed and why.

## What It Does

This skill takes staged git changes and produces structured commit messages following the Conventional Commits specification. It focuses on:

- **Clarity:** Commit messages that explain the intent and impact, not implementation details
- **Searchability:** Specific subjects you can grep months later
- **Consistency:** Standardized format across your entire project
- **Quality:** Enforces one logical change per commit

The output follows a strict format that tools can parse and humans can read.

## When to Use

Use this skill **before every commit**. Specifically:

- **Before running `git commit`:** Let it read `git diff --cached` and generate the message
- **During code review:** When a commit message is vague or missing context
- **When splitting commits:** If changes are mixed, it will flag "SPLIT REQUIRED"
- **On team projects:** To maintain consistent commit history standards

**Do not use** for merge commits, automated tool updates, or when the default message is sufficient (e.g., `git revert`).

## Quick Start

### Example 1: Adding a Feature

**Git diff:**
```diff
diff --git a/src/auth/login.js b/src/auth/login.js
index abc123..def456 100644
--- a/src/auth/login.js
+++ b/src/auth/login.js
@@ -12,6 +12,10 @@ export async function login(email, password) {
+  if (email.includes('+')) {
+    email = email.toLowerCase();
+  }
+
   const user = await db.users.findOne({ email });
```

**Generated commit message:**
```
feat(auth): support plus-addressing in email login

Gmail and other providers allow user+tag@example.com for filtering.
Previously these emails were rejected during normalization. Now we
preserve the full address and only lowercase for comparison.

Fixes #342
```

### Example 2: Fixing a Bug

**Git diff:**
```diff
diff --git a/src/validators/input.js b/src/validators/input.js
index 111222..333444 100644
--- a/src/validators/input.js
+++ b/src/validators/input.js
@@ -5,7 +5,7 @@ export function validateEmail(email) {
-  if (!email) {
+  if (!email || email.trim() === '') {
     throw new Error('Email is required');
   }
```

**Generated commit message:**
```
fix(validators): reject whitespace-only email input

validateEmail accepted strings of only spaces, causing downstream
errors in the auth service. Now we trim and check for empty strings.
```

### Example 3: Mixed Changes (Split Required)

**Git diff:**
```diff
diff --git a/src/auth/login.js b/src/auth/login.js
(adds OAuth support)

diff --git a/src/ui/button.css b/src/ui/button.css
(fixes button padding)
```

**Generated output:**
```
SPLIT REQUIRED

Group 1 (auth):
  - src/auth/login.js: adds OAuth2 PKCE flow

Group 2 (ui):
  - src/ui/button.css: fixes button padding regression

These are unrelated changes. Stage and commit them separately:
  git reset
  git add src/auth/login.js
  git commit
  git add src/ui/button.css
  git commit
```

## Key Concepts

### Conventional Commits Format

Every commit follows this structure:

```
<type>(<scope>): <subject>

<body>

[BREAKING CHANGE: <description>]
```

#### Type

The kind of change being made. Use these types:

- **feat:** New feature for the user (not a build script feature)
- **fix:** Bug fix for the user (not a CI fix)
- **refactor:** Code change that neither fixes a bug nor adds a feature
- **docs:** Documentation only changes
- **test:** Adding or fixing tests
- **chore:** Maintenance tasks (dependency updates, etc.)
- **perf:** Performance improvement
- **style:** Code style changes (formatting, semicolons, no logic change)
- **build:** Changes to build system or dependencies
- **ci:** Changes to CI configuration files and scripts

#### Scope

The module, component, or area affected by the change. Examples:

- `auth` for authentication code
- `api` for API endpoints
- `ui` for user interface
- `db` for database layer
- `docs` for documentation

**Scope rules:**

1. Use the most specific scope that covers all changes
2. If changes span multiple unrelated scopes, suggest splitting the commit
3. Omit scope only for truly global changes (e.g., `chore: upgrade Node to v20`)

#### Subject Line

The first line is the most important. Rules:

- **50 characters maximum**
- **Imperative mood:** "add" not "added", "fix" not "fixes"
- **Lowercase** after the colon
- **No period** at the end
- **Searchable:** Be specific enough that grep will find this commit

**Good subjects:**
```
feat(auth): add OAuth2 PKCE flow for mobile clients
fix(parser): handle escaped quotes in JSON strings
refactor(cache): extract Redis client into separate module
```

**Bad subjects:**
```
update stuff
fixed bug
changes
improved code quality
various updates
```

#### Body

Explain **why** the change was made, not how. The diff shows how. Use the body to answer:

- Why was this change necessary?
- What problem does it solve?
- What did the old behavior do wrong?
- What does the new behavior do instead?

**Body rules:**

- Wrap lines at 72 characters
- Separate from subject with a blank line
- Use multiple paragraphs if needed
- Reference issue numbers (Fixes #123)

#### Breaking Changes

If the change breaks existing behavior:

1. Add `!` after the type: `feat(api)!: remove /v1 endpoints`
2. Add a `BREAKING CHANGE:` footer explaining what breaks and how to migrate

Example:
```
feat(api)!: remove deprecated /v1 authentication endpoints

The /v1 auth endpoints were deprecated 6 months ago and are now
removed to simplify maintenance.

BREAKING CHANGE: /v1/auth/login and /v1/auth/register are deleted.
Migrate to /v2/auth (see docs/migration-v2.md).
```

### One Logical Change Per Commit

A commit should represent **one logical change**. Not one file, not one hour of work, but one idea.

**Single logical change:**
```
fix(auth): add rate limiting to login endpoint
  - adds rate limiter middleware
  - adds tests for rate limiting
  - updates API docs
```

**Multiple logical changes (should be split):**
```
WRONG:
  - adds rate limiting to login
  - fixes typo in README
  - updates button styles
```

If `git diff --cached` shows unrelated changes, the skill outputs `SPLIT REQUIRED` with instructions.

## Common Pitfalls

### 1. Describing Implementation Instead of Intent

**Bad:**
```
refactor(auth): change variable name from 'u' to 'user'
```

**Good:**
```
refactor(auth): clarify user object naming in login flow

Short variable names like 'u' made the OAuth integration code hard
to follow. Using 'user' consistently improves readability.
```

**Why:** The diff shows the variable rename. The commit message should explain why it matters.

### 2. Generic Subjects That Are Unsearchable

**Bad:**
```
fix: update code
fix: address feedback
fix: various improvements
```

**Good:**
```
fix(parser): handle null bytes in UTF-8 input
fix(api): validate email format before database lookup
```

**Why:** Six months from now, "fix bug" tells you nothing. "fix null pointer in validateInput" is searchable.

### 3. Mixing Unrelated Changes

**Bad:**
```
feat(auth): add OAuth and fix button color and update README
```

This should be three commits. The skill will detect this and output `SPLIT REQUIRED`.

### 4. Using Past Tense

**Bad:**
```
feat(api): added new endpoint for user search
```

**Good:**
```
feat(api): add endpoint for user search by email
```

**Why:** Conventional Commits use imperative mood. The commit applies the change, so "add" not "added".

### 5. Omitting the Why

**Bad:**
```
refactor(auth): extract helper function
```

**Good:**
```
refactor(auth): extract token validation into reusable helper

Token validation logic was duplicated in 3 endpoints. Extracting
to validateToken() makes it easier to add refresh token support.
```

**Why:** The diff shows the extraction. The message should explain the motivation.

### 6. AI Filler Language

**Bad:**
```
feat(auth): implement OAuth2 support

This commit implements OAuth2 support for the authentication system.
In this change, we add the necessary code to enable OAuth2 flows.
```

**Good:**
```
feat(auth): add OAuth2 PKCE flow for mobile clients

The implicit flow is deprecated and unsafe for public clients.
PKCE (RFC 7636) eliminates the need for client secrets on mobile.
```

**Why:** Skip "This commit", "In this change", "Here we". Start with the verb.

### 7. Breaking Changes Without Migration Path

**Bad:**
```
feat!: remove old API

BREAKING CHANGE: The old API is gone.
```

**Good:**
```
feat(api)!: remove deprecated /v1 endpoints

BREAKING CHANGE: /v1 endpoints are deleted. Migrate to /v2:
  - /v1/users -> /v2/users
  - /v1/auth/login -> /v2/auth/token
See docs/migration-v2.md for full details.
```

**Why:** Breaking changes need actionable migration instructions.

## Workflow

1. Stage your changes: `git add <files>`
2. Invoke the skill: "Write a commit message for my staged changes"
3. The skill reads `git diff --cached`
4. Review the generated message
5. Commit: `git commit -m "<message>"`

If the skill outputs `SPLIT REQUIRED`, unstage and commit changes separately.

## See Also

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://cbea.ms/git-commit/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- Skill: `code-review` (use before committing to catch issues)
- Skill: `incremental-commits` (commit strategy for large changes)
