---
name: env-doctor
description: Use when "it works on my machine" or a fresh clone breaks. Diagnoses missing deps and env vars.
---

When a project won't run after cloning or switching branches, diagnose the environment and produce a fix-it checklist.

## Diagnostic sequence

Run these checks in order and stop at the first failure:

### 1. Check runtime version
Read the version constraint from:
- `.nvmrc` / `.node-version` → Node  
- `.python-version` / `pyproject.toml` → Python
- `.ruby-version` → Ruby
- `go.mod` → Go

Compare against `node --version`, `python3 --version`, etc. If mismatched, output the install command for the correct version.

### 2. Check package manager lockfile
If `pnpm-lock.yaml` exists but `pnpm` isn't installed: `npm install -g pnpm`  
If `poetry.lock` exists but `poetry` isn't found: `pip install poetry`  
If `Gemfile.lock` but no `bundle`: `gem install bundler`

### 3. Check dependencies installed
Look for:
- `node_modules/` (if package.json exists but node_modules doesn't: `pnpm install`)
- `.venv/` or `venv/` (if pyproject.toml exists but no venv: `python3 -m venv .venv && source .venv/bin/activate && pip install -e .`)
- `vendor/` (if Gemfile but no vendor: `bundle install`)

### 4. Check system dependencies
Grep the codebase for common system libs:
- `import sqlite3` / `better-sqlite3` → needs libsqlite3-dev
- `import psycopg2` → needs libpq-dev + postgresql
- `sharp` (Node) → needs libvips
- `Pillow` (Python) → needs libjpeg-dev zlib1g-dev

Output install commands:
- Debian/Ubuntu: `sudo apt-get install <pkg>`
- macOS: `brew install <pkg>`
- Arch: `sudo pacman -S <pkg>`

### 5. Check required environment variables
Grep for `process.env.`, `os.getenv`, `ENV.fetch`, and similar. List every env var referenced but not set.

Check these common files for required vars:
- `.env.example` or `.env.template`
- `README.md` (Configuration section)
- Docker Compose `environment:` blocks

Output a checklist:
```bash
export VAR_NAME=<value>  # purpose from code comment or readme
```

### 6. Check running services
If code imports or connects to:
- `redis://` → check `redis-cli ping` (suggest `docker run -d -p 6379:6379 redis` if not running)
- `mongodb://` → check `mongosh --eval "db.version()"` (suggest Docker if missing)
- `postgresql://` → check `pg_isready` (suggest Docker if missing)
- `localhost:9200` → probably Elasticsearch (suggest Docker)

### 7. Check file permissions
If the error mentions `EACCES` or `permission denied`:
- Is the script executable? (check `ls -l`, suggest `chmod +x <file>`)
- Is a port < 1024 being bound without sudo? (suggest using port >= 1024)

## Output format

Produce a numbered fix-it list, shortest fixes first:

```
Environment diagnosis for <project-name>

Issue found: <the error or symptom>

Fix checklist:
1. Install pnpm: npm install -g pnpm
2. Install dependencies: pnpm install
3. Set required env vars:
   export DATABASE_URL=postgresql://localhost/dbname
   export API_KEY=<your-key>
4. Start Redis: docker run -d -p 6379:6379 redis
5. Run migrations: pnpm run migrate

Then retry: pnpm start
```

## What NOT to do

- Don't guess at env var values. State they're required and point to where the user should get them.
- Don't suggest reinstalling the OS or "it might be a firewall issue" (too vague).
- If a system lib is missing, name the actual package, not "install the development headers" (useless).

## If everything checks out

If all checks pass but it still doesn't work:
1. Show the exact error message (don't paraphrase)
2. Show the command that produced it  
3. Show the relevant config file (package.json, tsconfig.json, or the file the error points at)
4. State "Environment looks correct. This is likely a code issue, not a setup issue."
