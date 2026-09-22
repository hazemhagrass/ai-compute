#!/usr/bin/env bash
# Symlink this repo's skills and config into the places Hermes and Claude read.
# Idempotent: safe to re-run after every pull.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/.ai-computer-backups/$STAMP"

info() { printf '\033[36m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }

# link <source-in-repo> <destination-in-home>
link() {
  local src="$1" dst="$2"

  [ -e "$src" ] || { warn "skip (missing in repo): $src"; return 0; }

  # Already pointing where we want it.
  if [ -L "$dst" ] && [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
    info "ok   $dst"
    return 0
  fi

  # Something real is in the way: move it aside, never delete.
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

# Skills: one symlink per SKILL, not per category.
#
# Linking the category directory looks tidier but is destructive: if the user
# already has ~/.hermes/skills/<category>/ as a real directory holding their
# own skills, a category-level symlink replaces the whole directory and every
# unrelated skill inside it disappears from the agent's view. Per-skill links
# let this repo's skills sit beside skills from any other source.
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

# Hermes config
link "$REPO/hermes/config.yaml" "$HOME/.hermes/config.yaml"
link "$REPO/hermes/plugins"     "$HOME/.hermes/plugins"
link "$REPO/hermes/cron"        "$HOME/.hermes/cron"

# Claude Code config
link "$REPO/claude/CLAUDE.md"     "$HOME/.claude/CLAUDE.md"
link "$REPO/claude/commands"      "$HOME/.claude/commands"
link "$REPO/claude/agents"        "$HOME/.claude/agents"
link "$REPO/claude/settings.json" "$HOME/.claude/settings.json"

if [ -d "$BACKUP" ]; then
  warn "Replaced files were backed up to $BACKUP"
fi

info "Done. Run ./scripts/doctor.sh to verify."
