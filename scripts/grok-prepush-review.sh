#!/usr/bin/env bash
# scripts/grok-prepush-review.sh
#
# Phase 4 of the self-monitoring architecture (docs/HOOK_COVERAGE.md).
# Invoked by .githooks/pre-push when the push range touches a critical-path
# file. Runs Grok over the diff for an independent-review second opinion
# before allowing the push to proceed.
#
# Soft block: shows Grok's finding and requires --no-verify or
# GROK_PREPUSH_DISABLE=1 to bypass.
#
# Standalone test:
#   bash scripts/grok-prepush-review.sh <remote_sha> <local_sha>

set -u

REMOTE_SHA="${1:-}"
LOCAL_SHA="${2:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_FILE=/tmp/grok-prepush-cache.json
GROK_LOG=/tmp/sports-bar-grok-prepush.log
TIMEOUT=120  # seconds

# ─── Guard: disable modes ────────────────────────────────────────────
if [[ "${GROK_PREPUSH_DISABLE:-}" == "1" ]]; then
  echo "  [grok-prepush] GROK_PREPUSH_DISABLE=1 — skipping review" >&2
  exit 0
fi

if ! command -v grok &>/dev/null; then
  echo "  [grok-prepush] grok CLI not found — skipping review (degraded mode)" >&2
  exit 0
fi

if [[ -z "$REMOTE_SHA" || -z "$LOCAL_SHA" ]]; then
  echo "  [grok-prepush] missing SHA args — skipping" >&2
  exit 0
fi

# ─── Identify which critical-path globs fired ────────────────────────
# Per Phase 4 architect agent — these are the files where a silent-fail
# change auto-deploys to the fleet and would silently bite production.
CRITICAL_PATHS=(
  "packages/database/src/schema.ts"
  "apps/web/src/db/schema.ts"
  "drizzle/"
  "scripts/auto-update.sh"
  "scripts/bootstrap-drizzle-migrations.sh"
  "scripts/verify-install.sh"
  "scripts/iso/"
  "scripts/proxmox/"
  "apps/web/src/instrumentation.ts"
  "apps/web/next.config.js"
  "ecosystem.config.js"
  ".githooks/pre-push"
  "scripts/grok-prepush-review.sh"
)

# Grok-flagged bug fix (HIGH, self-review of v2.55.27 commit): the existing
# .githooks/pre-push handles an all-zero remote_sha (brand-new branch on the
# remote) by treating "the range" as just $local_sha. We need to mirror that
# — otherwise the script crashes / silent-fails on first push of a new branch
# exactly when verification matters most.
if [[ "$REMOTE_SHA" =~ ^0+$ ]]; then
  RANGE="$LOCAL_SHA"
else
  RANGE="${REMOTE_SHA}..${LOCAL_SHA}"
fi
ALL_CHANGED=$(git diff --name-only "$RANGE" 2>/dev/null || true)
# Total file count across the WHOLE push — Grok wants context on "what else
# changed" so it can spot e.g. a schema migration shipped alongside a
# seemingly-unrelated route deletion.
ALL_CHANGED_COUNT=$(echo "$ALL_CHANGED" | grep -c . || echo "0")

matched_files=""
for path in "${CRITICAL_PATHS[@]}"; do
  hits=$(echo "$ALL_CHANGED" | grep "^${path}" || true)
  [[ -n "$hits" ]] && matched_files+="$hits"$'\n'
done
matched_files=$(echo "$matched_files" | sort -u | grep . || true)

if [[ -z "$matched_files" ]]; then
  exit 0  # Nothing critical changed — silent pass.
fi

# ─── Cache check: same SHA pair already reviewed today? ──────────────
# A re-push of the same commits in the same day shouldn't re-run Grok
# (60-120s) — but we DO want a fresh review every calendar day in case
# Grok improved or our briefing changed.
TODAY=$(date '+%Y-%m-%d')
CACHE_KEY="${REMOTE_SHA}__${LOCAL_SHA}"
if [[ -f "$CACHE_FILE" ]]; then
  cached=$(python3 -c "
import json, sys
try:
  d = json.load(open('$CACHE_FILE'))
  hit = d.get('$CACHE_KEY')
  if hit and hit.get('date') == '$TODAY':
    print(hit.get('verdict', 'UNKNOWN'))
except Exception:
  pass
" 2>/dev/null || true)
  if [[ -n "$cached" ]]; then
    echo "  [grok-prepush] cached result for this SHA range: $cached — skipping re-run" >&2
    [[ "$cached" == CLEAN* ]] && exit 0
    echo "" >&2
    echo "  Previous Grok finding (from cache):" >&2
    python3 -c "
import json
try:
  d = json.load(open('$CACHE_FILE'))
  print(d.get('$CACHE_KEY', {}).get('summary', '(no summary cached)'))
except Exception:
  print('(cache unreadable)')
" 2>/dev/null >&2
    exit 1
  fi
fi

echo "" >&2
echo "  [grok-prepush] Critical-path files changed — running Grok review (~${TIMEOUT}s)..." >&2
echo "  Files: $(echo "$matched_files" | tr '\n' ' ')" >&2

# ─── Build the Grok briefing ─────────────────────────────────────────
# Grok-flagged (MED, self-review): drizzle/*.sql migration files often have
# their most-important content (new CREATE INDEX / FK / NOT NULL clauses)
# at the BOTTOM. A naive `head -c 32000` cap would chop those silently.
# So: pull drizzle migration files FIRST and uncapped, then everything else
# capped to the remaining budget. Include an explicit truncation marker so
# Grok knows what it didn't see.
DIFF_BUDGET=32000
DIFF_CONTENT=""
drizzle_files=$(echo "$matched_files" | grep -E '^drizzle/' || true)
other_files=$(echo "$matched_files" | grep -vE '^drizzle/' || true)

if [[ -n "$drizzle_files" ]]; then
  drizzle_diff=$(git diff "$RANGE" -- $drizzle_files 2>/dev/null || true)
  drizzle_bytes=$(printf '%s' "$drizzle_diff" | wc -c)
  DIFF_CONTENT+="### drizzle/* migrations (full — critical, never truncated)"$'\n'"$drizzle_diff"$'\n\n'
  DIFF_BUDGET=$((DIFF_BUDGET - drizzle_bytes))
  [[ "$DIFF_BUDGET" -lt 2000 ]] && DIFF_BUDGET=2000  # always reserve ≥2KB for other files
fi

if [[ -n "$other_files" ]]; then
  other_diff=$(git diff "$RANGE" -- $other_files 2>/dev/null || true)
  other_bytes=$(printf '%s' "$other_diff" | wc -c)
  if [[ "$other_bytes" -gt "$DIFF_BUDGET" ]]; then
    DIFF_CONTENT+="### other critical-path files (truncated to ${DIFF_BUDGET}B of ${other_bytes}B — see file list above for full scope)"$'\n'
    DIFF_CONTENT+=$(printf '%s' "$other_diff" | head -c "$DIFF_BUDGET")$'\n'
    DIFF_CONTENT+="…[TRUNCATED — $(( other_bytes - DIFF_BUDGET )) bytes not shown]…"$'\n'
  else
    DIFF_CONTENT+="### other critical-path files (full)"$'\n'"$other_diff"$'\n'
  fi
fi

# Recent commit messages help Grok understand intent (e.g. distinguish
# "this DROP TABLE is intentional cleanup" from "this is an accident")
RECENT_COMMITS=$(git log --oneline -8 "$LOCAL_SHA" -- $matched_files 2>/dev/null || true)

# Auto-injected gotcha cross-reference — keyed off which critical-path
# patterns fired. Saves Grok the discovery step.
GOTCHA_HINT=""
echo "$matched_files" | grep -qE "schema\.ts|drizzle|bootstrap-drizzle" && \
  GOTCHA_HINT+="Gotchas #6 (drizzle-kit push silent abort on pre-existing indexes), #5 (DB is source of truth). "
echo "$matched_files" | grep -qE "auto-update|verify-install" && \
  GOTCHA_HINT+="Gotcha #11 (auto-update stall gap: linger, NVM PATH, ollama perms, modify-delete conflict). "
echo "$matched_files" | grep -qE "iso/|proxmox/|configure-netboot" && \
  GOTCHA_HINT+="Gotchas #14-19 (ISO: grub quoting, geoip hang, shutdown=poweroff, late-commands, DHCP lag, PXE sanboot dead-end). "
echo "$matched_files" | grep -qE "ecosystem\.config|next\.config|instrumentation" && \
  GOTCHA_HINT+="Gotcha #10 (Next.js per-bundle singletons need globalThis hoisting), #2 (PM2 delete+start when env changes). "

TMP_PROMPT=$(mktemp /tmp/grok-prepush-prompt-XXXXXX.md)
trap 'rm -f "$TMP_PROMPT"' EXIT

cat > "$TMP_PROMPT" <<PROMPT
## Pre-Push Critical-Path Review

You are reviewing a diff that, if pushed, will land on origin/main and
auto-deploy to every fleet box on the next auto-update cycle.

**Your job:** Find non-obvious failure modes that would SILENTLY bite production.
Start your response with **CLEAN** (if you find nothing concerning) or
**FINDING** (if you find something). Be specific — cite file:line. Skip
style / preference / naming feedback.

### Relevant Gotchas to check first
${GOTCHA_HINT:-(none auto-detected — use judgment from the diff)}

### Critical-path files changed in this push (the diff below is scoped to these)
$(echo "$matched_files" | sed 's/^/- /')

### All files changed in this push (broader context — ${ALL_CHANGED_COUNT} total)
\`\`\`
$(echo "$ALL_CHANGED" | head -50 | sed 's/^/  /')
$([ "$ALL_CHANGED_COUNT" -gt 50 ] && echo "  …and $((ALL_CHANGED_COUNT - 50)) more" || true)
\`\`\`
Hint: if a critical-path change is shipped alongside an obviously-unrelated change in the broader file list, that itself is worth flagging as suspicious.

### Recent commits on these files (intent signal)
\`\`\`
${RECENT_COMMITS:-(no prior commits on these files in the last 8)}
\`\`\`

### Diff (truncated to 32KB)
\`\`\`diff
${DIFF_CONTENT}
\`\`\`

Is there a non-obvious failure mode in this change that would silently bite production?
Be specific. If you find nothing, say **CLEAN** as your first word.
PROMPT

# ─── Run Grok with timeout ──────────────────────────────────────────
# Use the wrapper so the standing-rules briefing gets auto-prepended.
GROK_OUTPUT=""
GROK_EXIT=0
GROK_OUTPUT=$(timeout "$TIMEOUT" bash "$REPO_ROOT/scripts/grok-prime.sh" "$TMP_PROMPT" 2>/dev/null) || GROK_EXIT=$?

if [[ $GROK_EXIT -eq 124 ]]; then
  echo "  [grok-prepush] Grok timed out after ${TIMEOUT}s — soft-warn, allowing push" >&2
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] TIMEOUT range=$RANGE files=$(echo "$matched_files" | tr '\n' ',')" >> "$GROK_LOG"
  exit 0
fi

FIRST_WORD=$(echo "$GROK_OUTPUT" | awk 'NF{print $1; exit}' | tr -d '*' | tr -d ':')

# ─── Cache result ─────────────────────────────────────────────────────
SUMMARY_ESCAPED=$(echo "$GROK_OUTPUT" | head -8 | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
python3 - <<PYEOF 2>/dev/null || true
import json, os
f = '$CACHE_FILE'
d = json.load(open(f)) if os.path.exists(f) else {}
d['$CACHE_KEY'] = {'date': '$TODAY', 'verdict': '${FIRST_WORD}', 'summary': $SUMMARY_ESCAPED}
json.dump(d, open(f, 'w'))
PYEOF

echo "[$(date '+%Y-%m-%d %H:%M:%S')] verdict=${FIRST_WORD} range=$RANGE files=$(echo "$matched_files" | tr '\n' ',')" >> "$GROK_LOG"

if [[ "$FIRST_WORD" == "CLEAN" ]]; then
  echo "  [grok-prepush] Grok: CLEAN — no critical issues found" >&2
  exit 0
fi

# ─── FINDING: show output and soft-block ─────────────────────────────
cat >&2 <<BLOCK

╭───────────────────────────────────────────────────────────────────────╮
│  grok-prepush FINDING — critical-path diff flagged by Grok            │
╰───────────────────────────────────────────────────────────────────────╯

BLOCK
echo "$GROK_OUTPUT" >&2
cat >&2 <<BLOCK

Full output logged to: $GROK_LOG
To push anyway:           git push --no-verify
To suppress this check:   GROK_PREPUSH_DISABLE=1 git push

BLOCK
exit 1
