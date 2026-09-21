# env-doctor

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

Diagnoses why a project fails to run on a given machine and emits an ordered, copy-pasteable fix-it checklist instead of a vague guess.

## What it does

`env-doctor` walks a fixed seven-step diagnostic sequence against the repository in front of it and stops at the first genuine failure:

1. **Runtime version** - reads the pinned version from `.nvmrc`, `.node-version`, `.python-version`, `pyproject.toml`, `.ruby-version` or `go.mod`, then compares it against what is actually installed.
2. **Package manager** - if a lockfile implies a tool (`pnpm-lock.yaml`, `poetry.lock`, `Gemfile.lock`) that is not on PATH, it names the exact install command.
3. **Installed dependencies** - checks for `node_modules/`, `.venv/`, `venv/`, `vendor/` and suggests the install command that matches the detected package manager.
4. **System libraries** - greps the codebase for imports that need native headers (`better-sqlite3`, `psycopg2`, `sharp`, `Pillow`) and prints the real package name per platform (apt, brew, pacman).
5. **Environment variables** - greps for `process.env.`, `os.getenv`, `ENV.fetch` and cross-references `.env.example`, the README configuration section, and Docker Compose `environment:` blocks to list every variable referenced but unset.
6. **Running services** - detects `redis://`, `mongodb://`, `postgresql://` and `localhost:9200` connection strings, probes them (`redis-cli ping`, `pg_isready`, `mongosh --eval "db.version()"`) and suggests a Docker one-liner when the service is down.
7. **File permissions** - triggered by `EACCES` or `permission denied`: checks the executable bit and flags binding to a port below 1024 without elevated privileges.

The output is a numbered checklist ordered shortest-fix-first, followed by the single command to retry.

## When to use this

Use it when:

- A fresh clone fails on the first `npm start`, `pytest`, or `bundle exec` and the error is about a missing module, binary, or variable.
- Someone says "it works on my machine" and you need the delta between the two machines named concretely.
- You switched branches and the app stopped booting (a lockfile or an env var almost certainly changed).
- You are writing onboarding docs and want the real list of prerequisites rather than the list someone remembered in 2023.
- CI passes but local fails, or the reverse.

Do not use it when:

- The stack trace points at your own application logic. The skill explicitly ends with "Environment looks correct. This is likely a code issue, not a setup issue." That is the hand-off point.
- You already know the fix. The sequence is for diagnosis, not ceremony.

## Quick start

A teammate clones a Node service and hits this:

```
$ npm start
> service@1.2.0 start
> node dist/server.js

Error: Cannot find module 'better-sqlite3'
```

Invoke the skill on the repository. It runs the sequence and stops reporting once it has a complete picture:

```
Environment diagnosis for billing-service

Issue found: Error: Cannot find module 'better-sqlite3'

Fix checklist:
1. Install pnpm: npm install -g pnpm
2. Install system deps: sudo apt-get install libsqlite3-dev build-essential
3. Install dependencies: pnpm install
4. Set required env vars:
   export DATABASE_URL=postgresql://localhost/billing   # from .env.example
   export STRIPE_SECRET_KEY=<your-key>                  # get from Stripe dashboard > Developers > API keys
5. Start Postgres: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16

Then retry: pnpm start
```

Why each line is there, traced back to the sequence:

- Step 2 found `pnpm-lock.yaml` in the repo but `pnpm` missing from PATH. The original `npm start` was the wrong command in the first place, and it installed nothing.
- Step 4 saw `better-sqlite3` in `package.json` and mapped it to `libsqlite3-dev`. Native module builds also need a compiler, so `build-essential` is named rather than implied.
- Step 5 grepped `process.env.DATABASE_URL` and `process.env.STRIPE_SECRET_KEY` and found neither in the shell. `DATABASE_URL` had a usable default in `.env.example`, so it is filled in. `STRIPE_SECRET_KEY` is a secret, so it stays as a placeholder with a pointer to where to obtain it.
- Step 6 parsed the `postgresql://` URL, ran `pg_isready`, got a refused connection, and suggested a container.

The checklist is ordered so that the cheapest, most-likely-blocking fix runs first. Installing dependencies before the system library would have failed the native build, so the library install is sequenced ahead of it.

## Key concepts

### Stop at the first failure, report the whole picture

The diagnostic sequence halts at the first failing check for the purpose of deciding the root cause, but the output still enumerates every problem it observed along the way. A user who fixes one thing at a time and re-runs seven times has been failed by the tool.

### Evidence over inference

Every line in the checklist traces to a file on disk or a command that returned a non-zero status. A lockfile exists or it does not. `redis-cli ping` answers or it does not. The skill never adds a step because the problem "smells like" a firewall.

### Named packages, not categories

"Install the development headers" is not actionable. `sudo apt-get install libpq-dev` is. The mapping from import name to OS package is the substantive value the skill provides, and it is platform-specific: the same dependency is `libpq-dev` on Debian, `libpq` on Homebrew, and `postgresql-libs` on Arch.

### Secrets are pointers, never values

An env var with a safe default (a local database URL, a dev port) is filled in. A credential is left as `<your-key>` with a sentence explaining where to obtain it. The skill never invents a plausible-looking API key, because a wrong value produces a worse error than a missing one.

### Ordering encodes dependencies

The checklist is sorted shortest-fix-first, but real ordering constraints win. System libraries precede a dependency install that compiles against them. Services start before migrations. Migrations run before the app.

### The negative result is a result

If all seven checks pass, that is a finding, not a failure. The skill then surfaces the exact error text, the exact command, and the relevant config file, and states plainly that the environment is correct. This redirects effort to the actual bug instead of another round of reinstalling things.

## Common pitfalls

### Paraphrasing the error

Bad:

```
It's throwing some kind of module not found error, probably a dependency issue.
```

Good:

```
Error: Cannot find module 'better-sqlite3'
Require stack:
- /home/dev/billing-service/dist/db.js
Command: npm start
```

The exact module name is what maps to the system package. A paraphrase discards it.

### Guessing at secret values

Bad:

```bash
export STRIPE_SECRET_KEY=sk_test_1234567890abcdef
```

Good:

```bash
export STRIPE_SECRET_KEY=<your-key>  # Stripe dashboard > Developers > API keys
```

A fabricated key produces a 401 from a live API, which looks like a completely different bug and costs an hour.

### Vague system dependency advice

Bad:

```
You may need to install the relevant development headers for your platform.
```

Good:

```
Debian/Ubuntu: sudo apt-get install libpq-dev
macOS:         brew install libpq
Arch:          sudo pacman -S postgresql-libs
```

### Suggesting a nuclear option

Bad:

```
Try deleting node_modules, clearing the npm cache, reinstalling Node,
and if that doesn't work it might be a firewall or antivirus issue.
```

Good:

```
pnpm-lock.yaml is present but pnpm is not installed, so `npm install`
produced a partial tree. Install pnpm and reinstall:
  npm install -g pnpm
  rm -rf node_modules && pnpm install
```

One cause, one fix, stated as a claim that can be checked.

### Using the wrong package manager for the repo

Bad:

```bash
npm install   # in a repo containing pnpm-lock.yaml
```

Good:

```bash
pnpm install  # lockfile is pnpm-lock.yaml
```

Mixing managers resolves a different dependency graph than CI resolved, which reproduces as "works in CI, fails locally" and wastes the next debugging session.

### Declaring victory without a retry command

Bad:

```
Fix checklist:
1. Install dependencies
2. Set env vars
```

Good:

```
Fix checklist:
1. pnpm install
2. export DATABASE_URL=postgresql://localhost/billing

Then retry: pnpm start
```

The retry line is what turns a diagnosis into a verification. Without it, nobody confirms the fix worked.

### Treating a code bug as an environment bug

Bad: adding a speculative eighth check and suggesting a clean reinstall when all seven pass.

Good:

```
Environment looks correct. This is likely a code issue, not a setup issue.

Error:   TypeError: Cannot read properties of undefined (reading 'id')
Command: pnpm test src/invoice.test.ts
File:    src/invoice.ts:42
```

## See also

Sibling skills in `skills/productivity/`:

- [`readme-generator`](../readme-generator/SKILL.md) - once the environment is diagnosed, the prerequisites list you produced belongs in the project README.
- [`technical-writing`](../technical-writing/SKILL.md) - for writing the setup section so the next person does not need this skill at all.
- [`truth-first`](../truth-first/SKILL.md) - the evidence-over-inference principle above, applied generally.
- [`spec-first-development`](../spec-first-development/SKILL.md) - pinning runtime versions and documenting required env vars up front prevents most of what this skill diagnoses.
- [`git-commit-writer`](../git-commit-writer/SKILL.md) - for committing the `.nvmrc`, `.env.example` or lockfile change that fixes the problem for everyone else.
- [`planning`](../planning/SKILL.md) - when the diagnosis turns up more work than a checklist can hold.
- [`autonomous-task`](../autonomous-task/SKILL.md) - for running the full sequence unattended across several repositories.
- [`grill-me`](../grill-me/SKILL.md) - to pressure-test a diagnosis you are not confident in.
- [`skill-authoring`](../skill-authoring/SKILL.md) - for extending the system library mapping table with dependencies your stack uses.
