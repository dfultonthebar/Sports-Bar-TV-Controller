#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# checkpoint-hermes.sh — SHADOW fleet-update checkpoint reviewer (Hermes / T4)
# ---------------------------------------------------------------------------
# Part of the #359 "Hermes tracks + reviews fleet updates" work. This is the
# Layer 3 SHADOW reviewer: it asks the shared T4 Ollama model (the "Hermes"
# ops-reviewer role) for its own GO/CAUTION/STOP verdict on an auto-update
# checkpoint, grounded by the box's retrieve-only RAG over the version docs +
# gotchas. It is *advisory only* — auto-update.sh logs its verdict next to the
# real (deterministic / Claude) decision so we accumulate an agreement record,
# but it NEVER gates the update. Once shadow data proves Hermes agrees, a later
# slice flips it to primary with Claude as fallback.
#
# Usage:   checkpoint-hermes.sh <label> <prompt_file>
# Output:  a single line on stdout:  DECISION: GO|CAUTION|STOP|UNAVAILABLE <reason>
# Exit:    always 0 — a shadow reviewer must never fail the caller.
#
# Activation: runs only when OLLAMA_REMOTE_BASE (the shared T4 Ollama) is set,
# unless HERMES_SHADOW_ENABLED=false force-disables it. Boxes with no T4
# configured are unaffected (clean no-op → DECISION: UNAVAILABLE).
# ---------------------------------------------------------------------------
set -uo pipefail

LABEL="${1:-?}"
PROMPT_FILE="${2:-}"

emit() { printf 'DECISION: %s\n' "$1"; exit 0; }

# --- activation gate -------------------------------------------------------
if [ "${HERMES_SHADOW_ENABLED:-auto}" = "false" ]; then
  emit "UNAVAILABLE shadow disabled (HERMES_SHADOW_ENABLED=false)"
fi
# Prefer the shared T4 (OLLAMA_REMOTE_BASE) when configured; otherwise use the
# box's OWN local Ollama (localhost:11434) so every fleet box can self-review
# its update with no external dependency (no cloud, no central GPU required).
REMOTE_BASE="${OLLAMA_REMOTE_BASE:-http://localhost:11434}"
if [ -z "$PROMPT_FILE" ] || [ ! -f "$PROMPT_FILE" ]; then
  emit "UNAVAILABLE prompt file missing"
fi
command -v curl >/dev/null 2>&1 || emit "UNAVAILABLE curl not found"

# Default to the SMALL model (llama3.1:8b, ~4.9GB) everywhere — on the shared T4
# it co-resides with the trading bot's phi4-trader (9.1GB) + nomic (0.3GB) =
# 14.3GB < 15GB, so the checkpoint NEVER evicts "Phil" even if it runs during
# market hours. It's the fleet-standard model present on every box's local
# Ollama too. Override with HERMES_CHECKPOINT_MODEL=qwen2.5:14b for a stronger
# review during off-hours when Phil isn't resident.
MODEL="${HERMES_CHECKPOINT_MODEL:-llama3.1:8b}"
LOCAL_API="${LOCAL_API_URL:-http://localhost:3001}"
PROMPT_BODY="$(cat "$PROMPT_FILE")"

# --- best-effort RAG grounding (retrieve-only, no LLM hop) ------------------
# Pull the most relevant version-guide / gotcha chunks so Hermes judges with
# the same institutional knowledge the docs hold. Fully optional: any failure
# (app down, route missing, timeout) just drops the context silently.
RAG_CONTEXT=""
RAG_QUERY="auto-update checkpoint ${LABEL}: what must be verified before a fleet update is safe to proceed; rollback and conflict gotchas"
RAG_JSON="$(curl -s --max-time 10 -X POST "${LOCAL_API}/api/rag/query" \
  -H 'content-type: application/json' \
  -d "$(printf '{"query":%s,"retrieveOnly":true,"topK":3}' "$(printf '%s' "$RAG_QUERY" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')")" \
  2>/dev/null || true)"
if [ -n "$RAG_JSON" ]; then
  RAG_CONTEXT="$(printf '%s' "$RAG_JSON" | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
    ctx = (d.get("data") or {}).get("rawContext") or ""
    print(ctx[:2500])
except Exception:
    pass
' 2>/dev/null || true)"
fi

# --- build the chat request ------------------------------------------------
SYSTEM_PROMPT='You are Hermes, the local fleet-ops reviewer for a sports-bar TV control system (Next.js + SQLite, deployed across ~7 locations via scripts/auto-update.sh). You are running in SHADOW mode: your verdict is advisory and does NOT gate this update. Review the auto-update checkpoint context and decide whether the update is safe.

IMPORTANT: You CANNOT run commands. Judge ONLY from the evidence already present in the context (verify-install markers, log excerpts, file/table counts, git state). Do not ask to run anything and do not refuse for lack of tool access — a missing piece of evidence is at most a CAUTION, not a STOP.

OUTPUT FORMAT — STRICT: The VERY FIRST line of your reply MUST be exactly one of:
DECISION: GO
DECISION: CAUTION - <one-line reason>
DECISION: STOP - <one-line reason>
Write NO preamble before it — do not start with "Based on..." or any sentence. After that first DECISION line you may add up to 3 short sentences of justification. The updater greps the FIRST line matching ^DECISION: and ignores the rest, so if the DECISION line is missing or not first, the update FAILS. Default to GO for additive/source/doc changes; STOP only for a real blocker you actually see.'

# Checkpoint A's stock prompt (checkpoint-a.txt) is written for an AGENTIC
# reviewer with bash tools — it tells the reviewer to run `git log -p
# HEAD..origin/main` to SEE the diff. The local model has no tools and the diff
# is NOT in the prompt, so it can't judge and never emits a parseable DECISION
# (observed: 4-min run → UNAVAILABLE on graystone, v2.73.3). Fix: for LABEL=A we
# gather the actual diff evidence ourselves (we run in the repo) and hand the
# model a concise, non-agentic judge task instead of the verbose agentic prompt.
if [ "$LABEL" = "A" ]; then
  GH_COMMITS="$(git log --oneline HEAD..origin/main 2>/dev/null | head -40)"
  GH_STAT="$(git diff --stat HEAD..origin/main 2>/dev/null | tail -60)"
  GH_SCHEMA="$(git diff HEAD..origin/main -- 'packages/database/src/schema.ts' 'apps/web/src/db/schema.ts' 2>/dev/null | head -250)"
  GH_PKG="$(git diff HEAD..origin/main -- package.json 2>/dev/null | head -60)"
  USER_CONTENT="You are reviewing a pending git merge from origin/main onto a location branch of the Sports Bar TV Controller. Decide GO / CAUTION / STOP from the evidence below. You CANNOT run commands — everything you need is already provided.

DECISION RULES:
- STOP only if you actually SEE one of: (a) a NON-additive schema change to an EXISTING table — a new NOT NULL column WITHOUT a default added to a table that already has rows, a renamed column, or a DROP TABLE that still holds rows; (b) accidentally-committed secrets in source (*.pem, hardcoded API tokens/passwords); (c) deletion of scripts/auto-update.sh or scripts/verify-install.sh.
- A brand-new table, or a NOT NULL column on a brand-new table, is SAFE (no existing rows to violate) → GO, not STOP.
- CAUTION for: additive schema change (new table / new nullable column on existing table), an API-contract change, or a minor/patch dependency bump with no documented break.
- GO otherwise. Location data files (apps/web/data/*.json, .env, data/) and package.json / package-lock.json are auto-resolved by the updater — NEVER STOP for those.

=== PENDING COMMITS (HEAD..origin/main) ===
${GH_COMMITS:-(none)}

=== FILE CHANGE STAT ===
${GH_STAT:-(none)}

=== SCHEMA DIFF (main risk surface; empty means no schema change) ===
${GH_SCHEMA:-(no changes to schema.ts)}

=== package.json DIFF (dependency changes) ===
${GH_PKG:-(no changes)}"
  if [ -n "$RAG_CONTEXT" ]; then
    USER_CONTENT="${USER_CONTENT}"$'\n\n'"=== RELEVANT DOCS (gotchas, retrieved) ==="$'\n'"${RAG_CONTEXT}"
  fi
else
  USER_CONTENT="CHECKPOINT: ${LABEL}"$'\n\n'"=== CHECKPOINT PROMPT / EVIDENCE ==="$'\n'"${PROMPT_BODY}"
  if [ -n "$RAG_CONTEXT" ]; then
    USER_CONTENT="${USER_CONTENT}"$'\n\n'"=== RELEVANT DOCS (version guide / gotchas, retrieved) ==="$'\n'"${RAG_CONTEXT}"
  fi
fi

REQ="$(python3 -c '
import json,sys
sysmsg = sys.argv[1]; usermsg = sys.argv[2]; model = sys.argv[3]
print(json.dumps({
  "model": model,
  "stream": False,
  "keep_alive": "10m",
  "options": {"temperature": 0.2, "num_predict": 400},
  "messages": [
    {"role": "system", "content": sysmsg},
    {"role": "user", "content": usermsg},
  ],
}))
' "$SYSTEM_PROMPT" "$USER_CONTENT" "$MODEL" 2>/dev/null || true)"
[ -z "$REQ" ] && emit "UNAVAILABLE failed to build request"

# --- call the T4 model (bounded; never fatal) ------------------------------
RESP="$(curl -s --max-time "${HERMES_CHECKPOINT_TIMEOUT:-540}" -X POST "${REMOTE_BASE}/api/chat" \
  -H 'content-type: application/json' -d "$REQ" 2>/dev/null || true)"
[ -z "$RESP" ] && emit "UNAVAILABLE T4 model unreachable or timed out"

ANSWER="$(printf '%s' "$RESP" | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
    print((d.get("message") or {}).get("content") or "")
except Exception:
    pass
' 2>/dev/null || true)"
[ -z "$ANSWER" ] && emit "UNAVAILABLE empty model response"

# --- parse the DECISION line (tolerate markdown bold / leading prose) ------
LINE="$(printf '%s\n' "$ANSWER" | grep -m1 -iE 'DECISION:' || true)"
NORM="$(printf '%s' "$LINE" | sed -E 's/[^A-Za-z: ]//g' | tr '[:lower:]' '[:upper:]')"
case "$NORM" in
  *"DECISION: GO"*)      emit "GO ${ANSWER}" ;;
  *"DECISION: CAUTION"*) emit "CAUTION ${ANSWER}" ;;
  *"DECISION: STOP"*)    emit "STOP ${ANSWER}" ;;
esac

# Fallback — llama3.1:8b frequently omits the DECISION: line entirely (CLAUDE.md
# Gotcha #12: it ignores output-format rules ~50% of the time) even though its
# prose reasoning is sound. Scan the prose for an explicit verdict: STOP-first
# (conservative), then GO, then CAUTION. Safe because the deterministic checker
# already caught the hard-STOP conditions and only escalated AMBIGUOUS cases to
# us, and Checkpoints B/C + build-failure rollback remain as downstream nets.
PROSE="$(printf '%s' "$ANSWER" | tr '[:upper:]' '[:lower:]')"
case "$PROSE" in
  *"do not proceed"*|*"not safe to proceed"*|*"unsafe to proceed"*|*"recommend stop"*|*"should stop"*|*"must not proceed"*|*"abort the"*|*"would stop"*)
    emit "STOP ${ANSWER}" ;;
esac
case "$PROSE" in
  *"safe to proceed"*|*"no schema change"*|*"additive"*|*"proceed with the update"*|*"proceed with the merge"*|*"low risk"*|*"looks safe"*|*"is safe"*|*"appears safe"*)
    emit "GO ${ANSWER}" ;;
esac
case "$PROSE" in
  *"caution"*|*"monitor closely"*|*"proceed with care"*)
    emit "CAUTION ${ANSWER}" ;;
esac

# Default GO. We only reach here when the model gave a non-empty response (empty
# was caught upstream as UNAVAILABLE) that contains NO stop/caution signal. The
# local model's ROLE at Checkpoint A is purely a STOP-detector: the deterministic
# pre-check already escalated only AMBIGUOUS/additive cases (the dangerous ones it
# STOPs outright without AI), and Checkpoints B/C + build-failure rollback remain
# downstream. Returning UNAVAILABLE here would fall through to the dead cloud path
# and re-freeze the fleet on nothing more than llama3.1:8b's run-to-run phrasing
# variance (Gotcha #12). So: engaged + no STOP flagged → proceed.
emit "GO ${ANSWER}"
