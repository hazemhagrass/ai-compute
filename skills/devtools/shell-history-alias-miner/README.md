# shell-history-alias-miner

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Mines a shell history file for commands that actually repeat, then proposes a short list of aliases and functions with the evidence attached to each one.

## What it does

`shell-history-alias-miner` reads `~/.bash_history`, `~/.zsh_history`, or `~/.local/share/fish/fish_history`, normalises the format-specific noise out of it, counts real repetition, and returns two lists: proposals and refusals.

1. **Parse** - strips zsh's `: <epoch>:<elapsed>;` prefixes, bash's `#<epoch>` timestamp lines, and fish's `- cmd:` YAML records down to one command per line.
2. **Normalise** - collapses repeated whitespace so `git  status` and `git status` count as the same habit rather than two near-misses.
3. **Count** - tallies both full command lines and `command + subcommand` pairs, so families like `git commit` and `docker compose` surface even when their tails differ.
4. **Filter** - applies frequency, keystroke-saving, and stability thresholds, and rejects destructive, machine-specific, or secret-bearing commands outright.
5. **Shape** - decides alias versus function based on where the variable argument sits.
6. **Install** - writes everything to a single `~/.aliases` file and adds one source line to the shell rc, never more.
7. **Verify** - syntax-checks the file, sources it in a fresh shell, and confirms each name resolves.

Every proposal carries its observed count. Every rejection carries its reason.

## When to use this

Use it when:

- Someone complains that a command is long and they type it constantly.
- You are provisioning a new machine and want the shell config to reflect real habits instead of a decade-old dotfile.
- An existing `.aliases` file has grown past the point where anyone remembers what is in it and needs an evidence-based audit.
- A team is standardising shell setup and wants the shortcuts justified by data rather than by taste.

Do not use it when:

- The command is project-scoped. `npm run build && npm test` belongs in `package.json` as a script, where teammates and CI can both find it.
- The command ran a lot on exactly one day. That is a project, not a habit, and the alias will be dead weight next month.
- The shortcut already exists. Aliasing `gco` when git already defines a `co` alias adds a second name for one behaviour.

## Quick start

Point the skill at a zsh history:

```
Mined 8,412 commands from ~/.zsh_history

Proposed (5):
  gst    214x  git status --short --branch
  gcan    96x  git commit --amend --no-edit
  dcu     61x  docker compose up -d
  k       58x  kubectl
  gco()   44x  git checkout -b "$1" && git push -u origin "$1"

Rejected (3):
  git push --force-with-lease   43x  destructive; keep it typed in full
  ssh deploy@10.0.3.14          31x  machine-specific host
  npm run build && npm test     12x  belongs in package.json as `npm run ci`

Write to ~/.aliases and add `[ -f ~/.aliases ] && . ~/.aliases` to ~/.zshrc? (y/n)
```

The resulting file is self-documenting:

```bash
# --- git ---
# git status --short --branch  (used 214x)
alias gst='git status --short --branch'

# git commit --amend --no-edit  (used 96x)
alias gcan='git commit --amend --no-edit'

# git checkout -b <branch> && git push -u origin <branch>  (used 44x)
gco() { git checkout -b "$1" && git push -u origin "$1"; }
```

`gco` is a function rather than an alias because the branch name appears twice and neither position is the end of the line. An alias cannot express that.

## Key concepts

### Frequency is the argument

A proposal without a count is an opinion. With `214x` attached, the user can decide in one second and the skill never has to defend its taste. The thresholds exist so that the answer is reproducible: at least 10 uses, or 3 uses if the command exceeds 40 characters, and at least 8 keystrokes saved.

### Normalise before you count

Whitespace variation is the single biggest source of undercounting. A habit typed 40 times across four spacing variants shows up as four entries of 10 and may fall under the threshold entirely. Collapsing whitespace is not cosmetic; it changes the result.

### Shortening a dangerous command makes it more likely

`rm -rf`, `git push --force`, `kubectl delete`, and `DROP TABLE` are refused regardless of frequency. The friction of typing them in full is the last check before an irreversible action, and an alias removes it. The refusal is reported rather than silently dropped, so the user knows the skill saw the pattern and made a decision.

### Alias or function is determined by argument position

An alias is textual prefix substitution. It works when the variable part is at the end and nowhere else. The moment an argument must land in the middle, or twice, or the body needs two statements, it becomes a function, with every expansion quoted and `"$@"` used for forwarding.

### One file, one source line

The skill writes `~/.aliases` and touches the rc file exactly once, to source it. This keeps the change reversible by deleting a file, keeps the rc readable, and means a syntax error in a mined alias never turns into an unusable login shell once the user removes the source line.

### Machine-specific commands do not transfer

Hosts, absolute paths, and tokens embedded in a frequent command make it frequent on one machine only. Those are rejected with the reason named, because copying them into a synced dotfile produces aliases that silently point at the wrong place on every other machine.

## Common pitfalls

### Counting the tail of history only

Bad:

```bash
tail -100 ~/.zsh_history | sort | uniq -c | sort -rn
```

Good:

```bash
strings ~/.zsh_history | sed -E 's/^: [0-9]+:[0-9]+;//' | sort | uniq -c | sort -rn
```

The last 100 lines describe this afternoon. Habits worth a permanent alias show up over months.

### Grepping zsh history without `strings`

Bad:

```bash
grep -v '^#' ~/.zsh_history
```

Good:

```bash
strings ~/.zsh_history | sed -E 's/^: [0-9]+:[0-9]+;//'
```

zsh writes metafied bytes for non-ASCII input. `grep` treats the file as binary and returns nothing useful, which reads as "no history" rather than "wrong tool".

### Unquoted arguments in functions

Bad:

```bash
mkcd() { mkdir -p $1 && cd $1; }
```

Good:

```bash
mkcd() { mkdir -p "$1" && cd "$1" || return; }
```

Unquoted, `mkcd "my project"` creates two directories and enters neither.

### Infinite recursion from same-name functions

Bad:

```bash
ls() { ls --color=auto "$@"; }
```

Good:

```bash
ls() { command ls --color=auto "$@"; }
```

Without `command`, the function calls itself until the shell dies.

### Appending directly to the rc file

Bad:

```bash
cat mined.sh >> ~/.zshrc
```

Good:

```bash
cp mined.sh ~/.aliases
grep -q '\.aliases' ~/.zshrc || echo '[ -f ~/.aliases ] && . ~/.aliases' >> ~/.zshrc
```

An rc file with 60 appended aliases is no longer auditable, and undoing the change means hand-editing a file the user depends on to log in.

### Sourcing into the live shell before syntax-checking

Bad:

```bash
source ~/.aliases   # in the shell you are currently using
```

Good:

```bash
zsh -n ~/.aliases && zsh -ic 'source ~/.aliases; type gst'
```

A stray quote in a mined function can make the current session unusable. Check first, test in a subshell, then adopt.

### Proposing an alias whose name is taken

Bad: `alias k='kubectl'` on a system where `k` is already a script on PATH.

Good:

```bash
type -a k >/dev/null 2>&1 && echo "name taken, skipping" || echo "alias k='kubectl'"
```

A shadowed binary breaks scripts that call it, and the breakage appears far from the alias that caused it.

## See also

Sibling skills in `skills/devtools/`:

- [`dotfiles-sync`](../dotfiles-sync/SKILL.md) - once `~/.aliases` exists, this is how it reaches every other machine.
- [`env-doctor`](../env-doctor/SKILL.md) - when a newly sourced alias fails because the underlying tool is not installed.
- [`git-workflow`](../git-workflow/SKILL.md) - the source of most mined candidates; check for an existing git alias before adding a shell one.
- [`git-commit-writer`](../git-commit-writer/SKILL.md) - for committing the dotfile change with a message that names what was added and why.
- [`regex-builder`](../regex-builder/SKILL.md) - for the `sed` and `awk` patterns that parse an unfamiliar history format.
- [`tmux-workspace`](../tmux-workspace/SKILL.md) - long-running sessions fragment history across panes; read it before trusting the counts.
- [`technical-writing`](../../writing/technical-writing/SKILL.md) - for annotating the alias file so the next reader knows what each entry replaced.
- [`skill-authoring`](../../meta/skill-authoring/SKILL.md) - for extending the rejection rules with patterns your environment considers dangerous.
