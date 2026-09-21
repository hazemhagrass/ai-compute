---
name: dotfiles-sync
description: "Use when syncing dotfiles across machines. Chooses bare-repo vs symlink manager, keeps host-specific config and secrets out, and bootstraps a new machine idempotently."
---

# Dotfiles Sync

Rules for a dotfiles repo that survives a second machine, a second operating
system, and a leaked key.

## Choosing The Mechanism

- Default to the bare repo when your dotfiles are plain files at fixed paths
  under `$HOME`. No dependency, no symlinks, no templating, so a fresh machine
  needs only `git`:

  ```bash
  git init --bare "$HOME/.dotfiles"
  alias config='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
  config config --local status.showUntrackedFiles no
  ```

- Set `status.showUntrackedFiles no` before anything else. Without it
  `config status` lists every file in your home directory, which pushes people
  into blanket `.gitignore` rules that later hide real changes.
- Put the alias in the rc file you actually track, never in a file present on
  only one machine, or the repo becomes unmanageable exactly where you most
  need it:

  ```bash
  # in the tracked ~/.zshrc or ~/.bashrc
  alias config='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
  ```

- Choose GNU stow instead when you want each tool's files grouped in a
  directory you can install or remove as a unit. Its model is one package
  directory per tool, symlinked into `$HOME`:

  ```bash
  cd ~/dotfiles && stow nvim tmux git      # link in; stow -D tmux unlinks one
  ```

- Choose chezmoi when the same file must differ per machine by DATA rather than
  by whole file: hostname, work email, proxy. Templating is what you are
  buying, and neither bare repo nor stow has it:

  ```bash
  # ~/.local/share/chezmoi/dot_gitconfig.tmpl
  email = {{ if eq .chezmoi.hostname "work" }}me@corp{{ else }}me@home{{ end }}
  ```

- Do not mix two managers over the same files. A stow symlink and a bare-repo
  checkout of one path fight silently: the diff you see stops matching the file
  the tool actually reads.
## Bootstrapping A Fresh Machine

- Make bootstrap one command a tired person can type from memory; anything
  longer gets improvised, and improvised bootstraps are how drift starts.

  ```bash
  git clone --bare https://github.com/you/dotfiles.git "$HOME/.dotfiles"
  git --git-dir="$HOME/.dotfiles" --work-tree="$HOME" checkout
  ```

- Expect that first `checkout` to fail because `.zshrc` already exists. Back
  the conflicts up rather than forcing, so the machine's original state stays
  recoverable:

  ```bash
  alias config='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
  mkdir -p "$HOME/.dotfiles-backup"
  config checkout 2>&1 | awk '/^\t/{print $1}' \
    | xargs -I{} mv "$HOME/{}" "$HOME/.dotfiles-backup/{}"
  config checkout
  ```

- Never bootstrap with `checkout -f`. It overwrites existing config with no
  copy kept, and on a work laptop that destroys an IT-provisioned `.ssh/config`
  or proxy setting you cannot recreate.
- Keep the bootstrap clone URL HTTPS, not SSH. On a fresh machine your key does
  not exist yet, so an SSH remote makes step one fail; switch afterwards.

## Idempotent Install Scripts

- Write `install.sh` so running it twice changes nothing the second time. A
  script that only works on a virgin system is one nobody dares rerun.
- Guard every mutation with an existence check:

  ```bash
  # Bad: fails on the second run, or silently stacks duplicates
  mkdir ~/.config/nvim
  ln -s ~/dotfiles/nvim ~/.config/nvim
  echo 'source ~/.aliases' >> ~/.zshrc
  ```

  ```bash
  # Good: same end state on run 1 and run 50
  mkdir -p ~/.config
  ln -sfn ~/dotfiles/nvim ~/.config/nvim
  grep -qxF 'source ~/.aliases' ~/.zshrc || echo 'source ~/.aliases' >> ~/.zshrc
  ```

- Use `ln -sfn`, not `ln -s`, for directory links. Plain `ln -s` onto an
  existing directory symlink creates the link *inside* it, producing
  `~/.config/nvim/nvim`.
- Start with `set -euo pipefail` so a failed step stops the run instead of
  continuing against a half-installed system.
## Machine-Specific Configuration

- Never commit a file that must differ per host as one shared version. The next
  machine edits it locally, and that edit either gets committed and breaks the
  first machine or stays uncommitted forever and rots.
- Split git identity with a directory-keyed conditional include, keeping one
  tracked `.gitconfig` correct everywhere:

  ```ini
  # ~/.gitconfig (tracked)
  [user]
      name = Your Name
      email = me@personal.example
  [includeIf "gitdir:~/work/"]
      path = ~/.gitconfig-work
  ```

  ```ini
  # ~/.gitconfig-work (NOT tracked, or tracked per-host)
  [user]
      email = you@corp.example
  ```

- Add `[include]` with `path = ~/.gitconfig.local` as the LAST lines of the
  tracked config, so any machine can override anything without a conflict. Git
  takes the last value for a key, so a trailing include always wins.

- Do the same in SSH, with the `Include` at the TOP: `ssh_config` takes the
  FIRST matching value for a keyword, not the last:

  ```
  # ~/.ssh/config (tracked) - Include must come first to win
  Include ~/.ssh/config.local

  Host github.com
      User git
      IdentityFile ~/.ssh/id_ed25519
  ```

- Keep hostnames, internal IPs, and jump hosts in the untracked `config.local`.
  They are not credentials, but publishing your internal topology hands an
  attacker a map.
- Source a local file at the end of the tracked rc, and commit an empty
  template so the source never fails on a fresh box:

  ```bash
  [ -f ~/.zshrc.local ] && source ~/.zshrc.local
  ```

## Linux And macOS In One Repo

- Branch on `uname -s` inside the tracked file rather than keeping two copies.
  Copies drift, and the drift is invisible until one machine breaks.

  ```bash
  case "$(uname -s)" in
    Darwin) export PATH="/opt/homebrew/bin:$PATH" ;;
    Linux)  export PATH="$HOME/.local/bin:$PATH"  ;;
  esac
  ```

- Guard platform-only commands with `command -v`. An unguarded call errors on
  every shell start, and people learn to ignore startup errors, which is how
  the real one gets missed:

  ```bash
  command -v pbcopy >/dev/null && alias clip=pbcopy
  command -v xclip  >/dev/null && alias clip='xclip -selection clipboard'
  ```

- Respect the path difference: macOS apps often want `~/Library/Application
  Support/...` where Linux uses `~/.config/...`. Link both from one canonical
  tracked directory rather than duplicating content.
- Do not assume GNU flags: BSD `sed` on macOS needs `sed -i ''` where GNU
  `sed` needs `sed -i`, so a script that works on one errors or leaves stray
  backup files on the other.

## Secrets

- Never commit private keys, API tokens, `.netrc`, cloud credentials, or cookie
  jars. A dotfiles repo is the most common place a personal key leaks, because
  `git add -A` in `$HOME` sweeps up `.aws` and `.ssh` unread.
- Track the public half and the structure, not the secret half:
  `id_ed25519.pub` yes, `id_ed25519` never; `.aws/config` yes,
  `.aws/credentials` never.
- Put an explicit deny list in `.gitignore` at the top of the repo, since the
  default in a home directory is to track everything:

  ```gitignore
  .ssh/id_*
  !.ssh/id_*.pub
  .aws/credentials
  .netrc
  .config/gh/hosts.yml
  *.pem
  *.key
  .env
  ```

- Pull real values from a secret manager at shell start, so the repo holds the
  command and never the value:

  ```bash
  # Good: the repo records how to fetch, not what was fetched
  export OPENAI_API_KEY="$(pass show api/openai)"
  # or: op read "op://Personal/openai/credential"
  ```

- Scan before every commit; the alternative is a permanent public leak:

  ```bash
  config diff --cached | grep -Ei 'BEGIN .* PRIVATE KEY|api[_-]?key|secret|token' && echo BLOCKED
  ```

- If a key already landed, rotate FIRST and scrub second. If the repo was ever
  pushed, assume the key is cloned and indexed; only revocation stops damage.

  1. Revoke at the source (new `ssh-keygen` pair replaced on every server, or
     the token deleted in the provider console) and confirm the old credential
     now fails.
  2. Remove it from history with
     `git filter-repo --invert-paths --path .ssh/id_ed25519`, or
     `git filter-repo --replace-text secrets.txt` for a targeted value.
  3. Force-push, then re-clone on every other machine, because those clones
     still contain the old objects.
  4. Check the provider's access log for use during the exposure window.

## Testing Changes Safely

- Never edit a tracked rc file and reload it as your only test. A syntax error
  in `.zshrc` can leave you unable to open a shell on the machine you are
  fixing it from.
- Test in a throwaway shell first, which fails harmlessly:

  ```bash
  # Bad: breaks the shell you are typing in
  vim ~/.zshrc && source ~/.zshrc
  ```

  ```bash
  # Good: syntax check, then a subshell that exits on its own
  zsh -n ~/.zshrc && zsh -c 'source ~/.zshrc; echo ok'
  ```

- Keep a second terminal open while editing login shell files, so a broken rc
  does not lock you out of the box.
- Validate the whole bootstrap in a container before trusting it on hardware.
  A container is the only cheap way to exercise the fresh-machine path:

  ```bash
  docker run --rm -it -v "$PWD":/dotfiles ubuntu:24.04 \
    bash -c 'apt-get update -qq && apt-get install -y git && /dotfiles/install.sh'
  ```

## Pinning Assumed Tools

- Record every external tool your dotfiles assume, with a version, in a
  manifest the install script reads. An rc file calling `fzf` or `starship` is
  a broken shell on any machine that lacks it.

  ```
  # tools.txt
  fzf 0.55.0
  starship 1.20.1
  neovim 0.10.2
  ```

- Fail early in `install.sh` when a pinned tool is missing, rather than letting
  the shell discover it at startup:

  ```bash
  command -v fzf >/dev/null || { echo "missing: fzf" >&2; exit 1; }
  ```

- Pin plugin managers to a tag, not a moving branch, so a bootstrap six months
  later installs the version you tested:

  ```bash
  # Bad: HEAD of main, untested, may break your config today
  git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

  # Good: reproducible
  git clone --branch v3.1.0 --depth 1 https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
  ```

## Quick Checklist

- Mechanism chosen, no second manager over the same files, and
  `status.showUntrackedFiles no` set on the bare repo?
- Bootstrap is one HTTPS command that backs up conflicts instead of forcing?
- `install.sh` idempotent and safe to rerun, host-specific values in `.local`
  includes rather than the shared file?
- Platform branches on `uname -s`, optional tools guarded by `command -v`?
- No private keys or tokens in the diff, secrets fetched at runtime?
- Change syntax-checked and container-tested before commit?
