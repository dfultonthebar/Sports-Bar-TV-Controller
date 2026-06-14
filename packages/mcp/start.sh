#!/usr/bin/env bash
# Launch the Sports-Bar MCP stdio server. Used as the `--command` Hermes Agent
# spawns. Resolves the repo root relative to this script so it's portable across
# fleet boxes (repo is always at /home/ubuntu/Sports-Bar-TV-Controller, but we
# derive it anyway). Uses the repo-local tsx so no global install is needed.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"
exec "$REPO/node_modules/.bin/tsx" "$REPO/packages/mcp/src/server.ts"
