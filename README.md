# AI Productivity Skill Library

<div align="center">
<img src="assets/hero-robot.svg" alt="AI skill library robots" width="380" />

**A comprehensive collection of battle-tested agent skills for developers, researchers, content creators, and knowledge workers.**

[![Issues](https://img.shields.io/github/issues/hazemhagrass/ai-compute)](https://github.com/hazemhagrass/ai-compute/issues)
[![Skills](https://img.shields.io/badge/skills-30-blue)](https://github.com/hazemhagrass/ai-compute/tree/main/skills)

</div>

---

Each skill is a portable markdown file that teaches AI agents how to handle real-world tasks, from debugging Docker to writing academic papers to optimizing Excel dashboards.

**80+ more skills in active development** (see [issues](https://github.com/hazemhagrass/ai-compute/issues)).

```
ai-computer/
├── skills/                     # 38 portable agent skills (the core value)
│   ├── TAXONOMY.md             # Which category a skill belongs in, and why
│   ├── engineering/            # Writing and reviewing code: API design, refactoring, testing
│   ├── devtools/               # The developer's own toolchain: git, tmux, dotfiles, regex
│   ├── devops/                 # Running systems: Docker, Kubernetes, CI/CD
│   ├── security/               # Finding and preventing vulnerabilities
│   ├── data/                   # Analysis and querying: pandas, SQL for analysts
│   ├── ai/                     # Working with models: prompting, model choice, agent SDKs
│   ├── workflow/               # How work gets planned and driven to done
│   ├── writing/                # Prose for humans: docs, blogs, email
│   ├── design/                 # What the user sees: slides, UX, accessibility
│   ├── research/               # Finding and verifying information
│   ├── office/                 # Document and spreadsheet formats: xlsx, docx, pptx
│   ├── career/                 # Resumes, interviews, negotiation
│   ├── finance/                # Personal money modelling
│   ├── learning/               # Acquiring and retaining knowledge
│   ├── homelab/                # Self-hosted infrastructure
│   └── meta/                   # Skills about maintaining this repo
├── apps/                       # Real applications built with these skills
│   └── ai-model-router/        # Next.js: route prompts to the right model, track cost
├── hermes/                     # Hermes config (model routing, providers, fallback chain)
├── claude/                     # Claude Code config (symlinks to Hermes)
├── scripts/
│   ├── install.sh              # Symlink skills into ~/.hermes and ~/.claude
│   ├── doctor.sh               # Verify all links resolve
│   ├── gen-robot.py            # Generate each skill's unique robot SVG
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

Example: [`skills/engineering/sql-optimization/SKILL.md`](skills/engineering/sql-optimization/SKILL.md) teaches an agent to read EXPLAIN plans, suggest indexes, and rewrite slow queries. [`skills/workflow/grill-me/SKILL.md`](skills/workflow/grill-me/SKILL.md) teaches relentless interviewing to stress-test plans before you commit.

## Skill categories

98 skills across 19 categories. Each lives at `skills/<category>/<name>/` with a `SKILL.md`, a `README.md`, and its own
generated robot. `skills/TAXONOMY.md` defines what belongs where.

### Ai (3 skills)

- **[model-selection](skills/ai/model-selection/)** Use when choosing which AI model to use for a task.
- **[prompt-engineering](skills/ai/prompt-engineering/)** Use when writing prompts for an LLM.
- **[smythos-sdk](skills/ai/smythos-sdk/)** Use when code imports @smythos/sdk.

### Career (12 skills)

- **[cover-letter-generator](skills/career/cover-letter-generator/)** Use when writing a cover letter for a job application.
- **[creative-resume-design](skills/career/creative-resume-design/)** Use when designing a visually distinctive resume.
- **[infographic-resume](skills/career/infographic-resume/)** Use when charts or skill graphics go on a resume.
- **[interactive-web-resume](skills/career/interactive-web-resume/)** Use when shipping a resume as a web page.
- **[interview-prep](skills/career/interview-prep/)** Use when preparing for a job interview.
- **[latex-resume](skills/career/latex-resume/)** Use when building a resume in LaTeX.
- **[linkedin-profile-optimizer](skills/career/linkedin-profile-optimizer/)** Use when optimising a LinkedIn profile for search.
- **[portfolio-website-builder](skills/career/portfolio-website-builder/)** Use when building a portfolio site to get hired.
- **[resume-storytelling](skills/career/resume-storytelling/)** Use when a resume reads as a job list, not a story.
- **[salary-negotiation](skills/career/salary-negotiation/)** Use when negotiating a job offer or compensation.
- **[video-resume](skills/career/video-resume/)** Use when an application wants a video introduction.
- **[word-resume-optimizer](skills/career/word-resume-optimizer/)** Use when optimising a .

### Data (5 skills)

- **[data-visualization-principles](skills/data/data-visualization-principles/)** Use when building a chart.
- **[powerbi-reports](skills/data/powerbi-reports/)** Use when building a Power BI model.
- **[python-pandas-analysis](skills/data/python-pandas-analysis/)** Use when analyzing data with pandas.
- **[sql-for-analysts](skills/data/sql-for-analysts/)** Use when writing analytical SQL.
- **[tableau-dashboard-builder](skills/data/tableau-dashboard-builder/)** Use when building a Tableau dashboard.

### Design (2 skills)

- **[accessibility-audit](skills/design/accessibility-audit/)** Use when auditing a web UI.
- **[presentation-design](skills/design/presentation-design/)** Use when building slides or a deck.

### Devops (3 skills)

- **[ci-cd-debugging](skills/devops/ci-cd-debugging/)** Use when a pipeline fails or tests flake.
- **[docker-troubleshooting](skills/devops/docker-troubleshooting/)** Use when a container won't start or a build breaks.
- **[kubernetes-debugging](skills/devops/kubernetes-debugging/)** Use when a pod won't start, stays pending, or crashes.

### Devtools (9 skills)

- **[code-graph](skills/devtools/code-graph/)** Use when navigating a codebase too big to grep.
- **[dotfiles-sync](skills/devtools/dotfiles-sync/)** Use when syncing dotfiles across machines.
- **[env-doctor](skills/devtools/env-doctor/)** Use when a fresh clone breaks.
- **[git-commit-writer](skills/devtools/git-commit-writer/)** Use when about to commit.
- **[git-workflow](skills/devtools/git-workflow/)** Use when committing, branching, or fixing git state.
- **[regex-builder](skills/devtools/regex-builder/)** Use when writing a regex.
- **[repo-snippet-extractor](skills/devtools/repo-snippet-extractor/)** Use when a doc embeds code from a repo.
- **[shell-history-alias-miner](skills/devtools/shell-history-alias-miner/)** Use when typing one long command repeatedly.
- **[tmux-workspace](skills/devtools/tmux-workspace/)** Use when a terminal job must survive an SSH drop.

### Engineering (14 skills)

- **[api-design](skills/engineering/api-design/)** Use when designing or changing an HTTP API.
- **[api-integration](skills/engineering/api-integration/)** Use when integrating a third-party API.
- **[architecture-review](skills/engineering/architecture-review/)** Use when reviewing an architecture or design document.
- **[code-review](skills/engineering/code-review/)** Use when reviewing a diff or pull request.
- **[code-review-automation](skills/engineering/code-review-automation/)** Use when CI bots or AI reviewers comment on PRs.
- **[code-review-checklist](skills/engineering/code-review-checklist/)** Use when reviewing a PR.
- **[database-design](skills/engineering/database-design/)** Use when designing a schema or writing a migration.
- **[debugging](skills/engineering/debugging/)** Use when chasing a bug or unexplained failure.
- **[frontend-architecture](skills/engineering/frontend-architecture/)** Use when structuring a React or Next.
- **[performance-profiling](skills/engineering/performance-profiling/)** Use when something is slow.
- **[refactoring](skills/engineering/refactoring/)** Use when restructuring existing code.
- **[refactoring-safety-checks](skills/engineering/refactoring-safety-checks/)** Use when verifying a refactor did not change behaviour.
- **[sql-optimization](skills/engineering/sql-optimization/)** Use when a query is slow.
- **[test-strategy](skills/engineering/test-strategy/)** Use when writing tests or planning coverage.

### Finance (3 skills)

- **[budget-tracker](skills/finance/budget-tracker/)** Use when building or fixing a personal budget.
- **[investment-portfolio-analyzer](skills/finance/investment-portfolio-analyzer/)** Use when analyzing a portfolio's return and risk.
- **[retirement-calculator](skills/finance/retirement-calculator/)** Use when modelling a retirement projection.

### Homelab (3 skills)

- **[adguard-home](skills/homelab/adguard-home/)** Use when deploying network-wide DNS filtering.
- **[lancache](skills/homelab/lancache/)** Use when setting up game caching for LANs or homelabs.
- **[unraid](skills/homelab/unraid/)** Use when managing Unraid servers.

### Knowledge (3 skills)

- **[airtable-database-builder](skills/knowledge/airtable-database-builder/)** Use when designing an Airtable base.
- **[obsidian-zettelkasten](skills/knowledge/obsidian-zettelkasten/)** Use when an Obsidian vault stops paying off.
- **[onenote-knowledge-base](skills/knowledge/onenote-knowledge-base/)** Use when OneNote is your knowledge base.

### Learning (2 skills)

- **[course-creation](skills/learning/course-creation/)** Use when designing a course or lesson.
- **[spaced-repetition](skills/learning/spaced-repetition/)** Use when building flashcards for spaced repetition.

### Meta (2 skills)

- **[readme-generator](skills/meta/readme-generator/)** Use when a repo has no README or needs a refresh.
- **[skill-authoring](skills/meta/skill-authoring/)** Use when writing or editing an agent skill file.

### Office (10 skills)

- **[excel-dashboards](skills/office/excel-dashboards/)** Use when building an Excel dashboard or KPI sheet.
- **[excel-data-cleaning](skills/office/excel-data-cleaning/)** Use when cleaning a messy spreadsheet.
- **[excel-financial-modeling](skills/office/excel-financial-modeling/)** Use when building a three-statement model or DCF.
- **[excel-formulas](skills/office/excel-formulas/)** Use when writing or auditing Excel formulas.
- **[excel-macros-vba](skills/office/excel-macros-vba/)** Use when writing or fixing an Excel macro.
- **[google-sheets-advanced](skills/office/google-sheets-advanced/)** Use when a Sheet is slow or QUERY misfires.
- **[pivot-tables](skills/office/pivot-tables/)** Use when summarising data with a pivot table.
- **[power-query-etl](skills/office/power-query-etl/)** Use when a Power Query refresh is slow or breaks.
- **[powerpoint-automation](skills/office/powerpoint-automation/)** Use when generating a .
- **[word-documents](skills/office/word-documents/)** Use when creating or editing .

### Presentation (1 skill)

- **[slide-deck-designer](skills/presentation/slide-deck-designer/)** Use when planning the content of a talk or a deck.

### Productivity (1 skill)

- **[email-efficiency](skills/productivity/email-efficiency/)** Use when an inbox is out of control.

### Research (8 skills)

- **[academic-paper-writing](skills/research/academic-paper-writing/)** Use when writing or revising a paper for peer review.
- **[citation-manager](skills/research/citation-manager/)** Use when managing a .
- **[grant-proposal-writing](skills/research/grant-proposal-writing/)** Use when writing or revising a grant proposal.
- **[literature-review](skills/research/literature-review/)** Use when reviewing literature on a topic.
- **[research-data-analysis](skills/research/research-data-analysis/)** Use when analysing research data or testing a hypothesis.
- **[survey-design](skills/research/survey-design/)** Use when writing a survey or questionnaire.
- **[systematic-web-research](skills/research/systematic-web-research/)** Use when web research needs verified, defensible answers.
- **[truth-first](skills/research/truth-first/)** Use when making factual claims or citing sources.

### Security (5 skills)

- **[api-security-audit](skills/security/api-security-audit/)** Use when auditing a deployed HTTP API for security bugs.
- **[authentication-audit](skills/security/authentication-audit/)** Use when auditing authentication.
- **[cryptography-audit](skills/security/cryptography-audit/)** Use when code calls a crypto API.
- **[secrets-management-audit](skills/security/secrets-management-audit/)** Use when auditing secrets.
- **[security-audit](skills/security/security-audit/)** Use when auditing code for vulnerabilities.

### Workflow (4 skills)

- **[autonomous-task](skills/workflow/autonomous-task/)** Use when a long task must proceed uninterrupted.
- **[grill-me](skills/workflow/grill-me/)** Use when stress-testing a plan or design.
- **[planning](skills/workflow/planning/)** Use when making or updating an engineering plan.
- **[spec-first-development](skills/workflow/spec-first-development/)** Use when building a feature from scratch.

### Writing (8 skills)

- **[blog-post-writer](skills/writing/blog-post-writer/)** Use when writing a blog post.
- **[newsletter-writer](skills/writing/newsletter-writer/)** Use when writing or reviewing an email newsletter issue.
- **[podcast-production](skills/writing/podcast-production/)** Use when producing a podcast episode.
- **[review-comment-phrasing](skills/writing/review-comment-phrasing/)** Use when phrasing review feedback.
- **[social-media-scheduler](skills/writing/social-media-scheduler/)** Use when planning or scheduling social posts.
- **[technical-writing](skills/writing/technical-writing/)** Use when writing docs, a README, or a changelog.
- **[video-script-writer](skills/writing/video-script-writer/)** Use when scripting a video.
- **[youtube-seo-optimizer](skills/writing/youtube-seo-optimizer/)** Use when publishing on YouTube.

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
mkdir -p skills/workflow/my-skill
cat > skills/workflow/my-skill/SKILL.md <<'EOF'
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
mkdir -p skills/workflow/my-skill/scripts
echo '#!/bin/bash' > skills/workflow/my-skill/scripts/automate.sh

# Optional: add references
mkdir -p skills/workflow/my-skill/references
echo '# Deep dive into X' > skills/workflow/my-skill/references/deep-dive.md

# Optional: add templates
mkdir -p skills/workflow/my-skill/templates
echo 'config template here' > skills/workflow/my-skill/templates/config.yaml

./scripts/install.sh  # Re-symlink if needed
```

## Skill authoring conventions

1. **Trigger-first descriptions.** The first 57 chars are what the model matches on: `"Use when <trigger>. <behavior>."`
2. **Rules, not logs.** Write imperative lessons with the reason attached. No PR numbers, no dates, no incident narration.
3. **Anti-patterns paired with the rule.** Show the wrong way and why it fails.
4. **Real commands.** `grep`, `curl`, `docker logs`, not placeholders.
5. **Zero em-dashes.** Use commas, colons, or parentheses instead (verified before commit).
6. **Progressive disclosure.** Core rules in the SKILL.md body, deep details in `references/`, loaded on demand.

See [`skills/meta/skill-authoring/SKILL.md`](skills/meta/skill-authoring/SKILL.md) for the complete meta-skill.

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

## Why these skills exist

The skill ecosystem is saturated, so every skill here has to justify
itself against the well-known alternative. `docs/PRIOR-ART.md` names the
prior art per skill and states the edge, and it lists the skills removed
for having no edge to defend.

The short version: claims in this library are executed before they are
written down. SQL failures are re-run, contrast ratios are computed,
ffmpeg commands are measured, and parser behaviour is tested.

## Security and audit posture

A skill is not passive documentation. When an agent loads `SKILL.md`, that text
becomes instructions, and any bundled script may be executed on the reader's
machine. Published skill libraries are therefore a supply chain, and this one is
checked on every push before it can be installed anywhere.

`scripts/scan-skills.py` runs in CI and fails the build on:

- **Prompt injection in prose**: instruction overrides ("ignore previous
  instructions"), attempts to extract a system prompt, and text telling the
  agent to conceal an action from the user.
- **Runtime fetching**: prose instructing the agent to download and execute
  remote content. A skill that genuinely needs this must say why in the file
  and carry the marker `security-scan: runtime-fetch allowed`.
- **Exfiltration in bundled scripts**: uploads of local data, netcat with
  command execution, base64-decoded payloads piped to a shell.
- **Dangerous constructs**: `eval`, `exec`, `shell=True`, `pickle.loads`.
- **Secret access**: reads of `.env`, `~/.ssh`, cloud credential paths, or
  credential environment variables.
- **Unpinned installs** in scripts, which let a dependency change under you.

Teaching examples are exempt by design: the scanner ignores fenced code blocks
and inline backticked spans, so a security skill can show an attack without
tripping its own gate. The rules were validated against a fixture containing
known-bad payloads before being switched on, and the whole library is scanned
on every push along with structure, trigger contract, manifest freshness, and
robot uniqueness.

Audit it yourself:

```bash
python3 scripts/scan-skills.py          # whole library
python3 scripts/scan-skills.py security/security-audit
```

## License

MIT. Skills are meant to be copied, adapted, and shared.
