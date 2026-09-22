#!/usr/bin/env bash
# Verify every symlink resolves and every expected tool is installed.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0

ok()   { printf '\033[32m  ok\033[0m   %s\n' "$*"; }
bad()  { printf '\033[31m  FAIL\033[0m %s\n' "$*"; FAIL=1; }
section() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# CI has no $HOME dotfiles to check, and the installed copies must not
# gate the repo itself; set DOCTOR_LOCAL=0 (or run on a machine with the
# install done) to skip this section.
if [ "${DOCTOR_LOCAL:-1}" = "1" ]; then
section "Symlinks"
check_link() {
  local dst="$1"
  if [ ! -L "$dst" ]; then
    bad "$dst is not a symlink"
  elif [ ! -e "$dst" ]; then
    bad "$dst is a broken symlink -> $(readlink "$dst")"
  elif [[ "$(readlink -f "$dst")" != "$REPO"* ]]; then
    bad "$dst points outside the repo: $(readlink -f "$dst")"
  else
    ok "$dst"
  fi
}

for category in "$REPO"/skills/*/; do
  [ -d "$category" ] || continue
  name="$(basename "$category")"
  check_link "$HOME/.hermes/skills/$name"
  check_link "$HOME/.claude/skills/$name"
done

for f in "$HOME/.hermes/config.yaml" "$HOME/.claude/CLAUDE.md"; do
  [ -e "$f" ] && check_link "$f"
done
fi  # DOCTOR_LOCAL

section "Skill frontmatter"
shopt -s nullglob
for skill in "$REPO"/skills/*/*/SKILL.md; do
  rel="${skill#"$REPO"/}"
  # The description contract: frontmatter description starts with "Use when "
  # and its first sentence (the trigger) fits in 57 chars, so the router
  # surfaces the right skill on the trigger alone. Goes through metadata.py
  # (stdlib yaml) rather than regex so quoted multi-word forms parse.
  desc_check="$(python3 - "$skill" <<'PYEOF'
import re, sys
t = open(sys.argv[1]).read()
m = re.match(r'---\n(.*?)\n---\n', t, re.S)
if not m:
    print("no frontmatter"); sys.exit()
fm = m.group(1)
dm = re.search(r'^description:\s*(.+)$', fm, re.M)
if not dm:
    print("no description"); sys.exit()
d = dm.group(1).strip()
if d.startswith('"') and d.endswith('"'):
    d = d[1:-1]
if not d.startswith("Use when "):
    print("description does not lead with 'Use when '")
    sys.exit()
trigger = re.split(r'(?<=[.!?])\s', d)[0]
if len(trigger) > 57:
    print(f"trigger sentence is {len(trigger)} chars; must close within 57")
PYEOF
)" 2>&1
  if ! command head -n1 "$skill" | grep -q '^---$'; then
    bad "$rel: missing YAML frontmatter"
  elif ! grep -qm1 '^name:' "$skill"; then
    bad "$rel: frontmatter has no name:"
  elif ! grep -qm1 '^description:' "$skill"; then
    bad "$rel: frontmatter has no description:"
  elif [ -n "$desc_check" ]; then
    bad "$rel: $desc_check"
  else
    ok "$rel"
  fi
done

section "Skill structure"
for skill in "$REPO"/skills/*/*/SKILL.md; do
  dir="$(dirname "$skill")"
  rel="${dir#"$REPO"/}"
  problems=""
  [ -f "$dir/README.md" ]        || problems="$problems no-README"
  [ -f "$dir/assets/robot.svg" ] || problems="$problems no-robot"
  grep -qm1 '<!-- robot-banner -->' "$dir/README.md" 2>/dev/null || problems="$problems no-banner"
  if grep -qlm1 '—' "$skill" "$dir/README.md" 2>/dev/null; then
    problems="$problems em-dash"
  fi
  # the category must be documented in TAXONOMY.md
  cat_name="$(basename "$(dirname "$dir")")"
  grep -qm1 "^| \`$cat_name\`" "$REPO/skills/TAXONOMY.md" || problems="$problems undocumented-category"
  if [ -n "$problems" ]; then
    bad "$rel:$problems"
  else
    ok "$rel"
  fi
done

section "Robot art"
if python3 "$REPO/scripts/gen-robot.py" --check >/dev/null 2>&1; then
  ok "every skill has a unique robot"
else
  bad "$(python3 "$REPO/scripts/gen-robot.py" --check 2>&1 | head -n3)"
fi

section "Tooling"
# CI validates skill content only; the router app's own job installs pnpm.
# The local machine check still demands all three since install.sh uses them.
if [ "${DOCTOR_LOCAL:-1}" != "0" ]; then
  TOOL_BINS="node pnpm git"
else
  TOOL_BINS="git"
fi
for bin in $TOOL_BINS; do
  if command -v "$bin" >/dev/null 2>&1; then
    ok "$bin ($(command -v "$bin"))"
  else
    bad "$bin not found in PATH"
  fi
done

section "Secrets hygiene"
if git -C "$REPO" ls-files --error-unmatch '**/.env' >/dev/null 2>&1; then
  bad "a .env file is tracked by git"
else
  ok "no tracked .env files"
fi
if git -C "$REPO" grep -qIn -E 'sk-[A-Za-z0-9]{20,}' -- . ':!*doctor.sh' ':!*.test.ts' ':!*.spec.ts' 2>/dev/null; then
  bad "possible API key committed, run: git grep -n 'sk-'"
else
  ok "no obvious API keys in tracked files"
fi

echo
[ "$FAIL" -eq 0 ] && printf '\033[32mAll checks passed.\033[0m\n' || printf '\033[31mSome checks failed.\033[0m\n'
exit "$FAIL"
