# Dotfiles Sync

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for managing shell and tool configuration across multiple machines: choosing between a bare git repo and a symlink manager, bootstrapping a fresh box with one command, keeping host-specific values and secrets out of the shared set, and testing changes without breaking your live shell.

## What it does

`SKILL.md` gives an agent (or a human) a concrete rule set for running a dotfiles repo, covering seven areas:

- **Choosing the mechanism.** Bare repo for plain files at fixed paths, GNU stow when you want per-tool install and uninstall units, chezmoi when the same file must differ per machine by data. Never two managers over the same files.
- **Bootstrapping.** One HTTPS command a tired person can type, with conflicting existing files backed up rather than overwritten by `checkout -f`.
- **Idempotent install scripts.** Same end state on run 1 and run 50: `mkdir -p`, `ln -sfn`, `grep -qxF || echo`, `set -euo pipefail`.
- **Machine-specific config.** `includeIf` and a trailing `[include]` in `.gitconfig`, an `Include` line first in `.ssh/config`, a sourced `.local` file at the end of every rc.
- **Linux and macOS in one repo.** Branch on `uname -s`, guard platform-only commands with `command -v`, do not assume GNU flag syntax.
- **Secrets.** Public half yes, private half never; a deny list in `.gitignore`; values fetched from a secret manager at shell start; rotate first and scrub second if one lands.
- **Testing and pinning.** Syntax-check before sourcing, validate the bootstrap in a container, pin the tools and plugin managers your config assumes.

It ends with a short checklist to run before committing a dotfiles change.

## When to use this

Load this skill when any of these are true:

- You are setting up a dotfiles repo for the first time and choosing between bare repo, stow, and chezmoi.
- You just got a new laptop and need your existing config on it.
- A config file must differ between your work machine and your personal one.
- You are writing or fixing an `install.sh` that has to be safe to rerun.
- The same dotfiles must work on both Linux and macOS.
- You are about to `git add` something under `~/.ssh`, `~/.aws`, or `~/.config` and are unsure what is safe to commit.
- A key or token has already been committed to your dotfiles repo.
- Your shell prints errors at startup on one machine but not another.
- A bootstrap that worked last year fails now because an upstream tool changed.

Do not load it for repository-level git questions such as commit scope, rebasing, or branch strategy.

## Quick start

A realistic session: you have a working `~/.zshrc`, `~/.gitconfig`, `~/.ssh/config`, and a Neovim config on your personal Linux box, and you want all of it on a new work MacBook without leaking your personal email or your SSH key.

**1. Create the bare repo and the alias.**

```bash
git init --bare "$HOME/.dotfiles"
alias config='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
config config --local status.showUntrackedFiles no
```

Without that last line, `config status` lists every file in your home directory.

**2. Persist the alias inside the tracked config, not in a stray file.**

```bash
echo "alias config='git --git-dir=\$HOME/.dotfiles --work-tree=\$HOME'" >> ~/.zshrc
```

**3. Block the things that must never be committed, before the first `add`.**

```bash
cat > ~/.gitignore <<'IGN'
.ssh/id_*
!.ssh/id_*.pub
.aws/credentials
.netrc
*.pem
*.key
.env
IGN
config add ~/.gitignore
```

**4. Split the parts that differ per machine out of the shared file.**

```ini
# ~/.gitconfig (tracked)
[user]
    name = Your Name
    email = me@personal.example
[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work
[include]
    path = ~/.gitconfig.local
```

```
# ~/.ssh/config (tracked) - Include first, because ssh takes the FIRST match
Include ~/.ssh/config.local

Host github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
```

```bash
# ~/.zshrc, last line
[ -f ~/.zshrc.local ] && source ~/.zshrc.local
```

**5. Make the platform difference explicit rather than keeping two copies.**

```bash
case "$(uname -s)" in
  Darwin) export PATH="/opt/homebrew/bin:$PATH" ;;
  Linux)  export PATH="$HOME/.local/bin:$PATH"  ;;
esac
command -v pbcopy >/dev/null && alias clip=pbcopy
command -v xclip  >/dev/null && alias clip='xclip -selection clipboard'
```

**6. Write an install script that is safe to rerun.**

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p ~/.config
ln -sfn ~/.dotfiles-src/nvim ~/.config/nvim
grep -qxF 'source ~/.aliases' ~/.zshrc || echo 'source ~/.aliases' >> ~/.zshrc
command -v fzf >/dev/null || { echo "missing: fzf" >&2; exit 1; }
```

**7. Check syntax in a throwaway shell before trusting it.**

```bash
zsh -n ~/.zshrc && zsh -c 'source ~/.zshrc; echo ok'
```

**8. Scan the staged set, then commit and push.**

```bash
config diff --cached | grep -Ei 'BEGIN .* PRIVATE KEY|api[_-]?key|secret|token' && echo BLOCKED
config add ~/.zshrc ~/.gitconfig ~/.ssh/config ~/.config/nvim
config commit -m "feat: portable shell, git, ssh, and nvim config"
config remote add origin https://github.com/you/dotfiles.git
config push -u origin main
```

**9. Bootstrap the MacBook with the fresh-machine path.**

```bash
git clone --bare https://github.com/you/dotfiles.git "$HOME/.dotfiles"
mkdir -p "$HOME/.dotfiles-backup"
git --git-dir="$HOME/.dotfiles" --work-tree="$HOME" checkout 2>&1 \
  | awk '/^\t/{print $1}' \
  | xargs -I{} mv "$HOME/{}" "$HOME/.dotfiles-backup/{}"
git --git-dir="$HOME/.dotfiles" --work-tree="$HOME" checkout
git --git-dir="$HOME/.dotfiles" --work-tree="$HOME" config --local status.showUntrackedFiles no
```

**10. Fill in only the local overrides on that machine.**

```bash
printf '[user]\n    email = you@corp.example\n' > ~/.gitconfig-work
printf 'Host bastion\n    HostName 10.0.0.9\n    User you\n' > ~/.ssh/config.local
```

Result: one repo, two machines, identical shared behaviour, zero secrets in history, and the work email and internal hosts present only where they belong.

## Key concepts

**The bare repo trades features for zero dependencies.** `git init --bare $HOME/.dotfiles` plus a `config` alias tracks files where they already live. Nothing is symlinked and nothing is templated, so recovery on a broken machine needs only `git`.

**`status.showUntrackedFiles no` is what makes the bare repo usable.** Your work tree is your entire home directory. Without that setting every file in `$HOME` shows as untracked, and the usual reaction (a blanket ignore rule) also hides real changes later.

**Stow's unit is the package directory.** One directory per tool, symlinked into `$HOME`, so `stow -D tmux` removes that tool's config cleanly. Buy stow when install and uninstall as a unit is what you want. **chezmoi's unit is the template**: buy it when the same file must differ per machine by a value (hostname, work email, proxy) rather than by whole-file substitution, because neither bare repo nor stow can express that.

**A shared file with host-specific content is a merge conflict factory.** Each machine edits it, and the edit either gets committed and breaks the other machine or stays uncommitted forever. Conditional and trailing includes remove the reason to edit it at all.

**`ssh_config` takes the first match, `gitconfig` takes the last.** This inverts where the override line goes: `Include ~/.ssh/config.local` belongs at the TOP of the ssh config, `[include] path = ~/.gitconfig.local` belongs at the BOTTOM of the git config.

**Idempotence is what makes a script rerunnable, and rerunnable is what makes it real.** A script that only works on a virgin machine never gets exercised, so it rots until the day you need it most.

**A dotfiles repo is the most common place a personal key leaks.** `git add -A` from `$HOME` sweeps `.ssh` and `.aws` without you reading the list. Track the public half and the structure; fetch values from a secret manager at runtime.

**Rotation beats scrubbing.** Once pushed, assume the credential is cloned, cached, and indexed. `git filter-repo` cleans history; only revoking the credential stops the damage.

**A broken rc file can lock you out of the machine you are fixing it from.** Syntax-check with `zsh -n` or `bash -n`, test in a subshell, and keep a second terminal open.

## Common pitfalls

**Skipping the untracked-files setting**

```bash
# Bad: config status lists every file in your home directory
git init --bare "$HOME/.dotfiles"
config status
# Good: the repo reports only what it tracks
config config --local status.showUntrackedFiles no
```

**Forcing the first checkout on a new machine**

```bash
# Bad: silently destroys the machine's existing rc and ssh config with no copy
git --git-dir=$HOME/.dotfiles --work-tree=$HOME checkout -f
# Good: move the conflicts aside, then check out cleanly
mkdir -p ~/.dotfiles-backup && mv ~/.zshrc ~/.dotfiles-backup/
git --git-dir=$HOME/.dotfiles --work-tree=$HOME checkout
```

**An SSH clone URL in the bootstrap path**

```bash
# Bad: on a fresh machine no key exists yet, so step one fails
git clone --bare git@github.com:you/dotfiles.git "$HOME/.dotfiles"
# Good: HTTPS to bootstrap, switch the remote to SSH after keys are in place
git clone --bare https://github.com/you/dotfiles.git "$HOME/.dotfiles"
```

**A non-idempotent install script**

```bash
# Bad: second run errors on mkdir and appends a duplicate source line
mkdir ~/.config/nvim
echo 'source ~/.aliases' >> ~/.zshrc
# Good: identical end state no matter how many times it runs
mkdir -p ~/.config/nvim
grep -qxF 'source ~/.aliases' ~/.zshrc || echo 'source ~/.aliases' >> ~/.zshrc
```

**Relinking a directory with plain `ln -s`**

```bash
# Bad: creates ~/.config/nvim/nvim inside the existing link
ln -s ~/dotfiles/nvim ~/.config/nvim
# Good: replaces the link itself instead of descending into it
ln -sfn ~/dotfiles/nvim ~/.config/nvim
```

**Committing one shared file for two identities**

```ini
# Bad: the work machine edits this locally forever, or commits and breaks home
[user]
    email = you@corp.example
# Good: shared default plus a directory-scoped override
[user]
    email = me@personal.example
[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work
```

**Putting the ssh Include at the bottom**

```
# Bad: ssh takes the FIRST matching keyword, so the override never wins
Host github.com
    IdentityFile ~/.ssh/id_ed25519
Include ~/.ssh/config.local
# Good: local overrides are read before the shared defaults
Include ~/.ssh/config.local

Host github.com
    IdentityFile ~/.ssh/id_ed25519
```

**Unguarded platform-specific commands**

```bash
# Bad: prints an error on every shell start on the other OS
alias clip=pbcopy
# Good: the alias exists only where the binary does
command -v pbcopy >/dev/null && alias clip=pbcopy
```

**Committing the secret instead of the lookup**

```bash
# Bad: the value is now permanent, public, and in every clone
export OPENAI_API_KEY="sk-live-REDACTED"
# Good: the repo records how to fetch, never what was fetched
export OPENAI_API_KEY="$(pass show api/openai)"
```

**Scrubbing a leaked key before rotating it**

```bash
# Bad: history is clean, the key still opens every server that trusts it
git filter-repo --invert-paths --path .ssh/id_ed25519
git push --force
# Good: revoke at the source first, confirm the old value fails, then scrub
# 1. ssh-keygen a new pair, replace authorized_keys on every host
# 2. git filter-repo --invert-paths --path .ssh/id_ed25519
# 3. force-push, re-clone on every machine, audit access logs
```

**Testing an rc change by sourcing it in your only shell**

```bash
# Bad: a syntax error here can leave you unable to open a working shell
vim ~/.zshrc && source ~/.zshrc
# Good: parse check, then a subshell that cannot take you down with it
zsh -n ~/.zshrc && zsh -c 'source ~/.zshrc; echo ok'
```

**Cloning a plugin manager from a moving branch**

```bash
# Bad: a fresh bootstrap next year installs untested upstream HEAD
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
# Good: reproducible on any machine at any time
git clone --branch v3.1.0 --depth 1 https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
```

## See also

- `skills/engineering/git-workflow/SKILL.md` for commit scope, history rewriting, and the general secret-scrubbing process.
- `skills/engineering/security-audit/SKILL.md` for the wider credential-exposure and access-review process after a leak.
- `skills/productivity/env-doctor/SKILL.md` when a machine's environment misbehaves after a bootstrap.
- `skills/devops/docker-troubleshooting/SKILL.md` for debugging the container you use to test the bootstrap path.
- `git help config` (see `includeIf`), `man ssh_config` (see `Include` and `Match`), and the GNU stow and chezmoi docs for the underlying tools.
