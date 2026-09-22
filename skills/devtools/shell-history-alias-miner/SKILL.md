---
name: shell-history-alias-miner
description: Use when typing the same long command repeatedly or tuning a shell config. Mines history into aliases.
---

Turn a shell history file into a small set of aliases and functions that are worth
keeping, then install them in one sourced file that can be deleted without breaking
anything.

## When to use

- The user says a command is long, repetitive, or annoying to retype.
- Setting up a new machine and the shell config should carry over real habits.
- Auditing an `.aliases` file that has grown past what anyone remembers using.
- Not for: one-off commands, or project scripts that belong in `package.json`,
  `Makefile`, or `justfile` where teammates can find them.

## Read the history

Pick the source by shell, because format differs:

- bash: `~/.bash_history`, one command per line (or `#<epoch>` lines interleaved when `HISTTIMEFORMAT` is set).
- zsh: `~/.zsh_history`, extended format `: <epoch>:<elapsed>;<command>`, with
  multi-line commands continued by a trailing `\`.
- fish: `~/.local/share/fish/fish_history`, YAML-ish `- cmd: <command>` records.

Normalise to one command per line before counting:

```bash
# zsh extended history -> plain commands
strings ~/.zsh_history | sed -E 's/^: [0-9]+:[0-9]+;//' > /tmp/hist.txt
# bash with timestamps
grep -v '^#' ~/.bash_history > /tmp/hist.txt
# fish
sed -n 's/^- cmd: //p' ~/.local/share/fish/fish_history > /tmp/hist.txt
```

Use `strings` on zsh history, because zsh writes metafied bytes that break `grep`
on histories containing non-ASCII commands.

## Count what actually repeats

```bash
# full command lines, most frequent first
sort /tmp/hist.txt | sed -E 's/[[:space:]]+/ /g; s/^ | $//g' | sort | uniq -c | sort -rn | head -40

# command + first subcommand, to catch families like `git commit`, `docker compose`
awk '{print $1, $2}' /tmp/hist.txt | sort | uniq -c | sort -rn | head -40
```

Rules for counting:

- Collapse repeated whitespace before counting, or `git  status` and `git status`
  split into two entries and neither crosses the threshold.
- Count over the whole history, not the last 100 lines, because habits show up
  over months.
- Report `n` alongside every candidate. A suggestion without its frequency cannot
  be judged.

## Selection thresholds

Propose an alias only when all of these hold:

- Used at least 10 times, or at least 3 times if the command is over 40 characters.
- Saves at least 8 keystrokes, counted as original length minus alias length.
- The invocation is stable: the same flags each time, with at most a trailing
  argument that varies.
- The name is free. Check with `type -a <name>` and `command -v <name>`, and reject
  if either resolves.

Reject, and say why, when:

- The command is destructive (`rm -rf`, `git push --force`, `DROP TABLE`, `kubectl delete`).
  An alias shortens the distance to an accident.
- The frequency comes from a single burst on one day, which is a project, not a habit.
- The command already has a short form (`git co` when `co` is a git alias already).
- The command embeds a secret, token, host, or absolute path from one machine.

## Alias or function

Use an alias when the command takes zero or trailing arguments:

```bash
alias gst='git status --short --branch'
```

Use a function when an argument goes anywhere other than the end, or when more
than one statement is needed:

```bash
# wrong: gcm "msg" expands to `git commit -m` "msg" only by luck of position
gco() { git checkout -b "$1" && git push -u origin "$1"; }
```

Function rules:

- Quote every expansion (`"$1"`, `"$@"`), because unquoted arguments break on spaces.
- Use `"$@"` when forwarding all arguments; `$*` joins them into one word.
- Return the wrapped command's exit status; do not swallow it with a trailing `true`.
- Do not name a function after the command it wraps unless it calls `command <name>`,
  or it recurses infinitely.

## Install as one sourced file

Write candidates to `~/.aliases` (or `~/.config/fish/conf.d/aliases.fish`) and source
it from the shell rc, rather than appending to `.bashrc` or `.zshrc` directly.

```bash
# in ~/.bashrc or ~/.zshrc, once
[ -f ~/.aliases ] && . ~/.aliases
```

- Never edit the user's rc file in place beyond adding that single source line.
- Group entries by tool with a comment header, so the file stays auditable.
- Annotate each entry with the original command and the observed count:

```bash
# git status --short --branch  (used 214x)
alias gst='git status --short --branch'
```

## Verify

1. `bash -n ~/.aliases` (or `zsh -n`) to catch syntax errors before sourcing.
2. `source ~/.aliases` in a new shell, not the current one, so a broken file does
   not leave the session unusable.
3. `type gst` and confirm it resolves to the new definition.
4. Run each new alias once with a harmless target and confirm identical output to
   the original command.

## Output format

```
Mined 8,412 commands from ~/.zsh_history

Proposed (7):
  gst   214x  git status --short --branch
  gcan   96x  git commit --amend --no-edit
  dcu    61x  docker compose up -d
  k      58x  kubectl
  ...

Rejected (3):
  git push --force-with-lease   43x  destructive; keep it typed in full
  ssh deploy@10.0.3.14          31x  machine-specific host
  npm run build && npm test     12x  belongs in package.json as `npm run ci`

Write to ~/.aliases and add `[ -f ~/.aliases ] && . ~/.aliases` to ~/.zshrc? (y/n)
```

## Counter-examples

Vague: "You run a lot of git commands, consider adding some aliases."
Actionable: "`git status --short --branch` ran 214 times; alias it to `gst` (saves 27 characters)."

Vague: "Be careful with dangerous aliases."
Actionable: "Refuse to alias any command containing `rm -rf`, `--force`, `DROP`, or `kubectl delete`, and state the refusal in the report."
