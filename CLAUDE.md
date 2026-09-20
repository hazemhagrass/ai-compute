# Working in ai-computer

This repo holds agent skills and AI tooling config. Changes here take effect on
the next agent session, so correctness matters more than speed.

## Layout rules

- A skill lives at `skills/<category>/<name>/SKILL.md`. Never nest deeper than
  category/name. If a skill needs more than one file, use `references/`,
  `scripts/`, or `templates/` inside its own directory.
- Never add a skill directly to `~/.hermes/skills` or `~/.claude/skills`. Those
  are symlinks into this repo. Edit here, commit here.
- `apps/` entries are self-contained. Do not hoist an app's dependency into a
  root `package.json`; there is no workspace root on purpose.
- Config under `hermes/` and `claude/` mirrors the real dotfile layout exactly,
  so `install.sh` stays a pure symlink operation with no transformation step.

## Secrets

Never commit an API key, token, or `.env` with real values. Keys belong in the
router app's encrypted SQLite database or in the shell environment. If a config
file needs a key, reference it as `${VAR_NAME}` and document the variable in
this repo's README.

`apps/*/data/` is gitignored: it holds the SQLite database and the
auto-generated `.secret` master key. Losing `.secret` makes stored keys
unrecoverable, so back it up outside git.

## Writing skills

Write lessons, not logs. One rule per line, imperative mood, and state the
reason when the rule looks arbitrary. No PR numbers, no dates, no narration of
the incident that taught you the rule.

The description's first 57 characters are what a model matches on. Lead with the
trigger: `Use when <trigger>. <behavior>.`

Before adding a new reference file, check whether an existing one covers the
topic and extend it instead. Many small references fragment worse than one long
one.

## Style

No em-dashes in committed markdown; use commas, colons, or parentheses.
