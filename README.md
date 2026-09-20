# ai-computer

Everything that makes my machine an AI machine, in one repo: agent skills, Hermes
and Claude Code configuration, and the apps I built to run the whole thing.

One repo, one clone, one install script. Nothing important lives only in a
dotfile directory that a reinstall would wipe.

```
ai-computer/
├── skills/                  # portable agent skills (the crown jewels)
│   └── <category>/<name>/
│       ├── SKILL.md         # frontmatter + body — the skill itself
│       ├── agents/openai.yaml   # optional: Codex/OpenAI harness metadata
│       ├── references/      # deep docs the skill points at, loaded on demand
│       ├── scripts/         # executable helpers the skill calls
│       └── templates/
├── hermes/                  # Hermes runtime config (mirrors ~/.hermes)
│   ├── config.yaml          # model routing, providers, fallback chain
│   ├── profiles/            # per-profile overrides
│   ├── plugins/
│   └── cron/                # scheduled jobs
├── claude/                  # Claude Code config (mirrors ~/.claude)
│   ├── CLAUDE.md            # global memory, applies to every project
│   ├── commands/            # /slash commands
│   ├── agents/              # custom subagents
│   └── settings.json        # permissions + hooks
├── apps/                    # real applications, each self-contained
│   └── ai-model-router/     # Next.js: providers, keys, routing, cost analytics
├── scripts/
│   ├── install.sh           # symlink skills + config into ~/.hermes and ~/.claude
│   └── doctor.sh            # verify every link and binary resolves
├── docs/                    # long-form notes that aren't skills
├── .claude-plugin/          # lets this repo be installed as a Claude Code plugin
├── AGENTS.md -> CLAUDE.md   # Codex reads AGENTS.md, Claude reads CLAUDE.md
└── CLAUDE.md                # how agents should work *in this repo*
```

## Why this shape

**`skills/` is flat by category, not by tool.** A skill is a markdown file with
frontmatter; Hermes, Claude Code, and Codex all read the same format. Splitting
by tool would mean three copies of the same knowledge drifting apart. Split by
subject instead, and let the install script point every tool at the same tree.

**Config is version-controlled here and symlinked out**, never the reverse.
`~/.hermes/skills` and `~/.claude/skills` become symlinks into this repo, so
editing a skill mid-session and committing it are the same action.

**`apps/` holds real software, not scripts.** Each app has its own
`package.json` and is independently runnable and deployable. `scripts/` is only
for repo plumbing.

**Secrets never enter this repo.** API keys live in the app's encrypted SQLite
database (`apps/ai-model-router/data/`, gitignored) or in your shell env. The
config files here reference keys by name, never by value.

## Install

```bash
git clone <this-repo> ~/workspace/ai-computer
cd ~/workspace/ai-computer
./scripts/install.sh          # symlinks skills + config into ~/.hermes and ~/.claude
./scripts/doctor.sh           # verify
```

`install.sh` backs up anything it would overwrite to `~/.hermes/backups/`.

## Apps

### ai-model-router

One page for every AI provider you use: paste in OpenAI / Anthropic / Fireworks /
Groq / DeepSeek keys, point it at your Ollama box by IP or domain, and it tells
you which model to use for planning, code review, debugging, or anything you
describe in plain English. Logs every prompt, answer, token count, and cent, and
charts where your spend actually goes.

```bash
cd apps/ai-model-router
pnpm install
pnpm dev        # http://localhost:3000
```

Stack: Next.js 16 (App Router), SQLite via better-sqlite3 (one file, no ORM,
no migrations tool), AES-256-GCM encryption for keys at rest, Tailwind v4.
See `apps/ai-model-router/README.md`.

## Adding a skill

```bash
mkdir -p skills/engineering/my-skill
$EDITOR skills/engineering/my-skill/SKILL.md
```

Frontmatter that both harnesses understand:

```yaml
---
name: my-skill
description: "Use when <trigger>. <one-line behavior>."
---
```

The first 57 characters of `description` are the trigger the model matches
against, so put the *when* first. Body rules: imperative lessons, one rule per
line, no incident logs or dates. Deep material goes in `references/`, named by
topic, and gets linked from the body so it loads only when needed.

Then re-run `./scripts/install.sh` (or nothing at all, if the category directory
is already symlinked).
