#!/usr/bin/env bash
# Design-token ratchet for apps/ai-model-router (see DESIGN.md).
#
# Counts raw hex colours and off-palette Tailwind colour classes in
# src/**/*.tsx (test files excluded). Fails when a count rises above its
# committed baseline. When you remove violations, lower the baseline in the
# same commit so the ratchet keeps the gain.
#
# Run from apps/ai-model-router: pnpm lint:design
set -euo pipefail

cd "$(dirname "$0")/.."

# Baselines measured on origin/main 7ab47bc (hex: 33, all #06070c; off-palette: 81
# across ComparePanel 33, PlaygroundPanel 38, DashboardPanel 4, SettingsPanel 4,
# AppShell 1, LogsPanel 1). Lower only, never raise.
HEX_BASELINE=33
OFF_PALETTE_BASELINE=81

HEX_RE='#[0-9a-fA-F]{3,8}\b'
OFF_PALETTE_RE='\b(text|bg|border|ring)-(zinc|gray|slate|neutral|red|green|blue|white|black)(-[0-9]{2,3})?(/[0-9]+)?\b'

# grep exits 1 for "no match" (fine) and 2+ for a real error (unreadable file,
# bad pattern). Only the first is tolerated, so a broken scan cannot pass.
scan() {
  local rc=0
  grep -rnoE --include='*.tsx' --exclude='*.test.*' "$1" src || rc=$?
  if [ "$rc" -gt 1 ]; then
    echo "::error::grep failed (exit $rc) while scanning src for $1" >&2
    exit "$rc"
  fi
}

hex_hits="$(scan "$HEX_RE")"
off_hits="$(scan "$OFF_PALETTE_RE")"

count() {
  if [ -z "$1" ]; then echo 0; else printf '%s\n' "$1" | wc -l | tr -d ' '; fi
}

hex_count="$(count "$hex_hits")"
off_count="$(count "$off_hits")"

echo "raw hex colours:        $hex_count (baseline $HEX_BASELINE)"
echo "off-palette Tailwind:   $off_count (baseline $OFF_PALETTE_BASELINE)"

status=0
if [ "$hex_count" -gt "$HEX_BASELINE" ]; then
  echo "::error::raw hex colours rose from $HEX_BASELINE to $hex_count. Use a DESIGN.md token (CSS variable) instead:"
  printf '%s\n' "$hex_hits"
  status=1
fi
if [ "$off_count" -gt "$OFF_PALETTE_BASELINE" ]; then
  echo "::error::off-palette Tailwind colour classes rose from $OFF_PALETTE_BASELINE to $off_count. Use a DESIGN.md token instead:"
  printf '%s\n' "$off_hits"
  status=1
fi

if [ "$status" -eq 0 ]; then
  if [ "$hex_count" -lt "$HEX_BASELINE" ] || [ "$off_count" -lt "$OFF_PALETTE_BASELINE" ]; then
    echo "Counts are below baseline: lower the baselines in scripts/check-design-tokens.sh to lock in the gain."
  fi
  echo "design tokens: ok"
fi
exit "$status"
