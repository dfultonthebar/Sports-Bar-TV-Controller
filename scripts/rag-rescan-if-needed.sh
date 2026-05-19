#!/usr/bin/env bash
# rag-rescan-if-needed.sh — kick off a RAG re-scan IFF the recent merge
# touched a path that scan-system-docs.ts or scan-code-docs.ts indexes.
#
# Called by scripts/auto-update.sh after every successful merge. Standing
# Rule 11 (CLAUDE.md): every commit touching RAG-indexed content MUST end
# with a re-scan so the AI Hub sees the updated knowledge.
#
# Skips scan if no relevant files changed (fast path — no Ollama cycles
# wasted on dep-only or non-doc commits).
#
# Usage:
#   bash scripts/rag-rescan-if-needed.sh [--force] [--since <ref>]
#
# Default --since: HEAD~5 (covers a small batch of recent commits). Override
# with the actual previous successful merge SHA from auto-update.
#
# Output: writes to /tmp/rag-rescan-$(date +%s).log; does not block on
# scan completion (~25-40 min on iGPU). Operators are notified via the
# AI Hub status panel showing fresher chunk counts after the scan settles.

set -euo pipefail

cd /home/ubuntu/Sports-Bar-TV-Controller

FORCE=""
SINCE_REF="HEAD~5"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE="yes"; shift ;;
    --since) SINCE_REF="$2"; shift 2 ;;
    *) echo "[rag-rescan] unknown arg: $1"; exit 2 ;;
  esac
done

# Path globs that match what scan-system-docs.ts + scan-code-docs.ts index.
# Keep this list in sync with those scripts' collectors.
RAG_PATHS_REGEX='^(CLAUDE\.md|docs/.*\.(md|pdf|html)$|\.claude/locations/.*\.md$|packages/[^/]+/README\.md$|packages/[^/]+/docs/.*\.(md|pdf)$|packages/[^/]+/src/.*\.(ts|tsx)$|apps/web/src/(app/api/[^/]+/route\.ts|app/[^/]+/page\.tsx|app/[^/]+/layout\.tsx|lib/[^/]+\.ts|db/schema\.ts|components/.*\.tsx)$|apps/web/drizzle/.*\.(sql|json)$|next\.config\.js|ecosystem\.config\.js|turbo\.json|apps/web/drizzle\.config\.ts|scripts/(setup-.*|bootstrap-new-location|auto-update|verify-install|install)\.sh)$'

if [[ "$FORCE" == "yes" ]]; then
  CHANGED=("(forced)")
else
  # List files changed between SINCE_REF and HEAD that match the RAG glob
  mapfile -t CHANGED < <(
    git diff --name-only "$SINCE_REF...HEAD" 2>/dev/null \
      | grep -E "$RAG_PATHS_REGEX" || true
  )
fi

if [[ ${#CHANGED[@]} -eq 0 ]]; then
  echo "[rag-rescan] no RAG-indexed paths changed since $SINCE_REF — skipping scan"
  exit 0
fi

echo "[rag-rescan] ${#CHANGED[@]} RAG-indexed path(s) changed:"
for f in "${CHANGED[@]:0:10}"; do echo "  - $f"; done
[[ ${#CHANGED[@]} -gt 10 ]] && echo "  ... and $((${#CHANGED[@]} - 10)) more"

LOGFILE="/tmp/rag-rescan-$(date +%s).log"
echo "[rag-rescan] kicking off background scan → $LOGFILE"
echo "[rag-rescan] (scan runs ~25-40 min; this script does NOT block)"

# Run in background so auto-update.sh can return promptly
nohup npx tsx scripts/scan-system-docs.ts > "$LOGFILE" 2>&1 &
SCAN_PID=$!
echo "[rag-rescan] scan PID: $SCAN_PID"

# If code paths changed too, also queue the code scan (in series — Ollama
# embedding endpoint can't handle parallel scans).
if printf '%s\n' "${CHANGED[@]}" | grep -qE '\.(ts|tsx)$'; then
  echo "[rag-rescan] TypeScript paths changed — queuing scan-code-docs.ts after doc scan"
  (
    # Wait for doc scan to finish (poll PID), then start code scan
    while kill -0 "$SCAN_PID" 2>/dev/null; do sleep 60; done
    nohup npx tsx scripts/scan-code-docs.ts >> "$LOGFILE" 2>&1 &
    echo "[rag-rescan] code scan PID: $!" >> "$LOGFILE"
  ) &
fi

echo "[rag-rescan] done — scan running in background. Tail: tail -f $LOGFILE"
exit 0
