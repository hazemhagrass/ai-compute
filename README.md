# AI Productivity Skill Library

A comprehensive collection of 30+ battle-tested agent skills for developers, researchers, content creators, and knowledge workers. Each skill is a portable markdown file that teaches AI agents how to handle real-world tasks — from debugging Docker to writing academic papers to optimizing Excel dashboards.

**80+ more skills in active development** (see [issues](https://github.com/hazemhagrass/ai-compute/issues)).

```
ai-computer/
├── skills/                     # 30+ portable agent skills (the core value)
│   ├── engineering/            # 12 skills: refactoring, security, SQL, API integration
│   ├── productivity/           # 9 skills: planning, grill-me, autonomous tasks, git commits
│   ├── devops/                 # 3 skills: Docker, Kubernetes, CI/CD debugging
│   ├── homelab/                # 3 skills: Lancache, Unraid, AdGuard Home (coming)
│   ├── ai/                     # 2 skills: prompt engineering, model selection
│   └── software-development/   # 1 skill: SmythOS SDK
├── apps/                       # Real applications built with these skills
│   └── ai-model-router/        # Next.js: route prompts to the right model, track cost
├── hermes/                     # Hermes config (model routing, providers, fallback chain)
├── claude/                     # Claude Code config (symlinks to Hermes)
├── scripts/
│   ├── install.sh              # Symlink skills into ~/.hermes and ~/.claude
│   ├── doctor.sh               # Verify all links resolve
│   └── create-skill-issues.sh  # Batch-create skill tracking issues
└── docs/                       # Plans, operations guides, ADRs
```

## What's a skill?

A skill is a markdown file that teaches an AI agent a workflow, not just facts. It contains:
- **When to use it** (trigger-first description in the frontmatter)
- **Rules and anti-patterns** (imperative lessons from real failures)
- **Scripts** (`scripts/` directory) for automation
- **References** (`references/` directory) for deep technical details
- **Templates** (`templates/` directory) for config files, docs, etc.

Example: [`skills/engineering/sql-optimization/SKILL.md`](skills/engineering/sql-optimization/SKILL.md) teaches an agent to read EXPLAIN plans, suggest indexes, and rewrite slow queries. [`skills/productivity/grill-me/SKILL.md`](skills/productivity/grill-me/SKILL.md) teaches relentless interviewing to stress-test plans before you commit.

## Skill categories

### Engineering (12 skills)
Code quality, security audits, debugging, refactoring, API design, frontend architecture, SQL optimization, API integration, test strategy, database design, performance profiling, code review.

### Productivity (9 skills)
Planning, skill authoring, technical writing, git commit messages, README generation, environment diagnostics, spec-first development, truth-first fact-checking, grill-me interviews, autonomous long-running tasks.

### DevOps (3 skills)
Docker troubleshooting, Kubernetes debugging, CI/CD pipeline failures.

### Homelab (3 skills)
Lancache (game caching), Unraid (NAS server management), AdGuard Home (DNS blocking, in progress).

### AI (2 skills)
Prompt engineering, model selection.

### Software Development (1 skill)
SmythOS SDK (building agents with the SmythOS platform).

## Quick start

```bash
git clone https://github.com/hazemhagrass/ai-compute.git ~/workspace/ai-computer
cd ~/workspace/ai-computer
./scripts/install.sh    # Symlinks skills into ~/.hermes/skills and ~/.claude/skills
./scripts/doctor.sh     # Verifies every symlink resolves
```

`install.sh` backs up anything it would overwrite to `~/.hermes/backups/`.

## Using skills with Hermes or Claude Code

Skills are auto-loaded when their trigger matches your request. The first 57 characters of the `description` field are the trigger.

```yaml
---
name: sql-optimization
description: Use when a query is slow. Find the bottleneck with EXPLAIN, fix indexes, rewrite the query.
---
```

When you say "this query is slow", the agent loads the SQL optimization skill and follows its workflow.

## Apps

### ai-model-router

Routes prompts to the right AI model based on requirements (speed, cost, quality). Tracks every token and cent spent across 15+ providers (OpenAI, Anthropic, DeepSeek, local Ollama). Built with Next.js 16, SQLite, AES-256-GCM key encryption.

```bash
cd apps/ai-model-router
pnpm install && pnpm build && pnpm start -p 3000
```

See [`apps/ai-model-router/README.md`](apps/ai-model-router/README.md) for features, API routes, and deployment.

**Status:** Production-ready. 479 tests passing, 46/46 tickets closed, Docker ready, local Ollama verified.

## Creating a new skill

```bash
mkdir -p skills/productivity/my-skill
cat > skills/productivity/my-skill/SKILL.md <<'EOF'
---
name: my-skill
description: Use when <trigger situation>. <one-line behavior>.
---

# My Skill

What it does and why it exists.

## When to use

- Trigger condition 1
- Trigger condition 2

## Rules

- Do X because Y. Anti-pattern: doing Z causes A.
- Always B before C. Trap: skipping B leads to D.

## Example workflow

1. Read the actual state first (never assume)
2. Make the change
3. Verify it worked (grep/curl/test, not trust)

## Common pitfalls

- Pitfall 1: the symptom and the real cause
- Pitfall 2: the workaround that breaks later

## See also

- Related skill: `other-skill`
- Reference: `references/deep-dive.md`
EOF

# Optional: add scripts
mkdir -p skills/productivity/my-skill/scripts
echo '#!/bin/bash' > skills/productivity/my-skill/scripts/automate.sh

# Optional: add references
mkdir -p skills/productivity/my-skill/references
echo '# Deep dive into X' > skills/productivity/my-skill/references/deep-dive.md

# Optional: add templates
mkdir -p skills/productivity/my-skill/templates
echo 'config template here' > skills/productivity/my-skill/templates/config.yaml

./scripts/install.sh  # Re-symlink if needed
```

## Skill authoring conventions

1. **Trigger-first descriptions.** The first 57 chars are what the model matches on: `"Use when <trigger>. <behavior>."`
2. **Rules, not logs.** Write imperative lessons with the reason attached. No PR numbers, no dates, no incident narration.
3. **Anti-patterns paired with the rule.** Show the wrong way and why it fails.
4. **Real commands.** `grep`, `curl`, `docker logs`, not placeholders.
5. **Zero em-dashes.** Use commas, colons, or parentheses instead (verified before commit).
6. **Progressive disclosure.** Core rules in the SKILL.md body, deep details in `references/`, loaded on demand.

See [`skills/productivity/skill-authoring/SKILL.md`](skills/productivity/skill-authoring/SKILL.md) for the complete meta-skill.

## Contributing

**80+ skills in the backlog.** See [open issues](https://github.com/hazemhagrass/ai-compute/issues) for what's planned:
- Excel mastery (formulas, pivot tables, VBA, Power Query, dashboards)
- Resume building (LaTeX, Word, ATS optimization)
- Research workflows (literature reviews, citations, academic writing)
- Content creation (blog posts, video scripts, newsletters, podcasts)
- Data analysis (Tableau, Power BI, Pandas)
- Security audits (OWASP Top 10, auth, crypto, secrets)
- Design & UX (accessibility, usability heuristics, design systems)
- And 60+ more across code review, monitoring, documentation, career development, learning systems, personal finance, and creative tools.

Pick an issue, implement the skill with real examples and scripts, open a PR. Every skill should be immediately usable by an AI agent with zero additional context.

## Why this shape

**Skills are portable across tools.** Hermes, Claude Code, and Codex all read the same markdown format. One skill file, three harnesses.

**Config is version-controlled and symlinked out.** `~/.hermes/skills` becomes a symlink to this repo, so editing a skill and committing it are the same action.

**Apps are self-contained.** Each has its own `package.json` and runs independently. No workspace root, no hoisting.

**Secrets never enter the repo.** API keys live in encrypted SQLite (`apps/ai-model-router/data/`, gitignored) or shell env. Config files reference keys by name (`${VAR_NAME}`), never by value.

## License

MIT. Skills are meant to be copied, adapted, and shared.
