---
name: readme-generator  
description: Use when a repo has no README or needs a refresh. Scans code and generates accurate docs.
---

Read the repo's structure, main source files, package.json/pyproject.toml/Cargo.toml, and any existing partial README, then generate a complete README.md.

## Structure

Every README must have these sections in order, with content grounded in the actual codebase:

### 1. Title + one-line description
Project name (from package manifest) + what it actually does in 10 words or less.

### 2. What it does
3-5 bullets stating real capabilities found in the code. No marketing speak. If it's a library, list the exported functions. If it's an app, list the user-facing features.

### 3. Install
Real commands from the actual build system. Check for:
- `package.json` → `npm install` / `pnpm install`  
- `pyproject.toml` / `requirements.txt` → `pip install` or `uv pip install`
- `Cargo.toml` → `cargo install`
- `go.mod` → `go install`

Include prerequisites (Node version, Python version, system deps) only if they're in a config file or caught your attention in the code.

### 4. Run it / Quick start
The minimal code to actually use the project. For a library: import + basic usage. For an app: start command + first action. Pull from tests or examples/ if they exist.

### 5. Structure (optional, for multi-dir projects)
Flat list of top-level directories + their purpose, derived from actual contents. Skip for single-file libraries.

### 6. Configuration (optional)
Environment variables, config files, or CLI flags only if you see them parsed in the code. Never invent them.

### 7. License
State the license from LICENSE file or package manifest. "MIT" or "No license file found."

## Rules

1. **Never hallucinate features.** If you don't see it in the code or tests, it's not in the README. "Planned features" or "roadmap" sections are banned unless explicitly requested.

2. **Runnable examples only.** Every code block must be real code that would actually run. If the example needs setup, say so: "Assumes Redis is running on localhost:6379."

3. **Skip boilerplate.** No "Table of Contents", no "Contributing" section (unless CONTRIBUTING.md exists), no "Star this repo" appeals.

4. **Language matches the project.** TypeScript example for a TS project, Python for Python. Never mix unless the project is polyglot.

5. **Badge minimalism.** Include badges only for: CI status (if .github/workflows/ exists), npm/PyPI version (if published), license. Skip download counts, "awesome" badges, and vanity metrics.

## Verification checklist

Before outputting the README:
- Can someone copy-paste the install command and have it work?  
- Does every feature claim have a file path you can point to as evidence?
- If someone runs the "Quick start" block, will it actually do something?

If any check fails, revise.

## Example output pattern

```markdown
# project-name

One-line description from package.json or the dominant source file's docstring.

## What it does

- Feature A (found in src/module-a.ts)
- Feature B (found in src/module-b.ts)  
- Feature C (tests show this working)

## Install

\`\`\`bash
npm install project-name
\`\`\`

Requires Node 18+.

## Quick start

\`\`\`typescript
import { mainFunction } from 'project-name';

const result = mainFunction({ input: 'value' });
console.log(result);
\`\`\`

## Structure

- `src/` - core library
- `tests/` - vitest suite  
- `examples/` - runnable demos

## License

MIT
```

## Anti-patterns to avoid

- ❌ "This project aims to..." (just state what it does)
- ❌ "Easy to use" / "Powerful" / "Modern" (let the code speak)
- ❌ Installation instructions for 6 different package managers (pick the one package.json uses)
- ❌ Animated demo GIFs unless they already exist in the repo
- ❌ "See [documentation](url)" with no inline examples (dead links rot)
