#!/bin/bash
#
# ensure-ollama-model.sh
#
# Idempotent helper that guarantees the Ollama model required by the
# AI Suggest feature is available locally. Safe to run on every auto-update
# — it no-ops when the model is already pulled.
#
# Exit codes:
#   0 — model is available (already present, or pulled successfully)
#   1 — ollama daemon unreachable (warning — feature will be degraded,
#        but not a hard fail so the rest of the update can proceed)
#   2 — model pull attempted and failed (warning — same degradation)
#
# Usage: bash ensure-ollama-model.sh [MODEL]
#   MODEL defaults to llama3.1:8b (matches HARDWARE_CONFIG.ollama.model).

set -u

MODEL="${1:-llama3.1:8b}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

log() { echo "[ENSURE-OLLAMA] $*"; }

# 1. Check daemon reachability
if ! curl -fsS --max-time 5 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  log "WARNING: ollama daemon not reachable at $OLLAMA_URL"
  log "WARNING: AI Suggest scheduling will be unavailable until ollama is running"
  log "WARNING: to install: sudo systemctl enable --now ollama"
  exit 1
fi

# 2. Check if model is already present
if curl -fsS --max-time 5 "$OLLAMA_URL/api/tags" 2>/dev/null | grep -q "\"$MODEL\""; then
  log "Model $MODEL already available — no pull needed"
  exit 0
fi

# 3. Pull the model
log "Model $MODEL not found — pulling (this may take several minutes on first run)"
if ollama pull "$MODEL" 2>&1 | grep -v "pulling\|verifying\|writing" | tail -20; then
  log "Pull completed successfully"
  exit 0
else
  log "WARNING: ollama pull $MODEL failed — AI Suggest will not work until resolved"
  exit 2
fi
