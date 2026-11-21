#!/usr/bin/env bash
# Serve the production build against a throwaway data dir.
# The temp dir keeps the run away from apps/ai-model-router/data and makes
# every e2e run start from a freshly seeded database.
set -euo pipefail

export AMR_DATA_DIR="$(mktemp -d "${TMPDIR:-/tmp}/amr-e2e-data-XXXXXX")"
echo "e2e throwaway AMR_DATA_DIR=${AMR_DATA_DIR}"

# The Hermes tab reads ${HERMES_HOME:-~/.hermes}; point it at a throwaway dir
# so the run is hermetic and never touches the real Hermes config.
export HERMES_HOME="$(mktemp -d "${TMPDIR:-/tmp}/amr-e2e-hermes-XXXXXX")"
echo "e2e throwaway HERMES_HOME=${HERMES_HOME}"

cd "$(dirname "$0")/.."
exec pnpm exec next start --port "${E2E_PORT:-3105}"
