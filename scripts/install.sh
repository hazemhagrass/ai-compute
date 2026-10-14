#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/.ai-computer-backups/$STAMP"

info() { printf '\033[36m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }

link() {
  local src="$1" dst="$2"

  [ -e "$src" ] || { warn "skip (missing in repo): $src"; return 0; }

  if [ -L "$dst" ] && [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
    info "ok   $dst"
    return 0
  fi

  if [ -e "$dst" ] || [ -L "$dst" ]; then
    mkdir -p "$BACKUP/$(dirname "${dst#"$HOME"/}")"
    mv "$dst" "$BACKUP/${dst#"$HOME"/}"
    warn "moved existing $dst -> $BACKUP/${dst#"$HOME"/}"
  fi

  mkdir -p "$(dirname "$dst")"
  ln -s "$src" "$dst"
  info "link $dst -> $src"
}

info "Installing from $REPO"

for category in "$REPO"/skills/*/; do
  [ -d "$category" ] || continue
  cat_name="$(basename "$category")"
  for skill in "$category"*/; do
    [ -f "$skill/SKILL.md" ] || continue
    skill_name="$(basename "$skill")"
    link "$skill" "$HOME/.hermes/skills/$cat_name/$skill_name"
    link "$skill" "$HOME/.claude/skills/$cat_name/$skill_name"
  done
done

link "$REPO/hermes/config.yaml" "$HOME/.hermes/config.yaml"
link "$REPO/hermes/plugins"     "$HOME/.hermes/plugins"
link "$REPO/hermes/cron"        "$HOME/.hermes/cron"

link "$REPO/claude/CLAUDE.md"     "$HOME/.claude/CLAUDE.md"
link "$REPO/claude/commands"      "$HOME/.claude/commands"
link "$REPO/claude/agents"        "$HOME/.claude/agents"
link "$REPO/claude/settings.json" "$HOME/.claude/settings.json"

if [ -d "$BACKUP" ]; then
  warn "Replaced files were backed up to $BACKUP"
fi

info "Done. Run ./scripts/doctor.sh to verify."
