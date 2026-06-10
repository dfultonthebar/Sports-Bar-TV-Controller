#!/usr/bin/env bash
# scripts/grok-prepush-review.sh
#
# Phase 4 of the self-monitoring architecture (docs/HOOK_COVERAGE.md).
# Invoked by .githooks/pre-push when the push range touches a critical-path
# file. Runs Grok over the diff for an independent-review second opinion
# before allowing the push to proceed.
#
# v2.55.29 hardening (task #329 — 4 fixes from the v2.55.27 self-review):
#   1. Build the Grok prompt via printf-from-vars (no unquoted heredoc).
#      The original heredoc would re-evaluate `$(...)` or backticks
#      embedded in the diff content as bash commands. Switched to
#      a quoted heredoc template + python placeholder substitution,
#      which is shell-injection-safe.
#   2. Robust verdict extraction. Prior `awk 'NF{print $1}'` was fooled
#      by Markdown formatting (**CLEAN!**, FINDING:, narrative
#      preamble). Now uses `grep -m1 -oE '\b(CLEAN|FINDING)\b'` which
#      finds the verdict ANYWHERE in the first 20 lines.
#   3. Timeout fails CLOSED for the highest-risk paths (drizzle/,
#      schema.ts, auto-update.sh, bootstrap-drizzle-migrations.sh). A
#      Grok call that times out on these now blocks instead of
#      soft-warning. Other critical paths still soft-warn on timeout.
#   4. GROK_PREPUSH_NO_SELF_REVIEW=1 escape for iterating on the hook
#      itself — without it, every fix to grok-prepush-review.sh
#      triggers a fresh review of the fix, which can iterate unbounded.
#
# Soft block (other paths): shows Grok's finding and requires --no-verify
# or GROK_PREPUSH_DISABLE=1 to bypass.
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

# v2.55.29 fix #4: self-review escape valve. When iterating on the hook
# itself, every fix triggers a fresh Grok review of the fix → potentially
# unbounded loop. GROK_PREPUSH_NO_SELF_REVIEW=1 skips Grok IF the only
# matched paths are the hook itself.
if [[ "${GROK_PREPUSH_NO_SELF_REVIEW:-}" == "1" ]]; then
  hook_only=$(echo "$matched_files" | grep -vE '^(\.githooks/pre-push|scripts/grok-prepush-review\.sh)$' || true)
  if [[ -z "$hook_only" ]]; then
    echo "  [grok-prepush] GROK_PREPUSH_NO_SELF_REVIEW=1 — skipping self-review of hook-only changes" >&2
    exit 0
  fi
fi

# v2.55.29 fix #3: classify whether timeout should fail-closed or
# soft-warn. The highest-risk paths land schema/auto-update changes
# directly on the fleet — a silent allow on Grok timeout there is
# unacceptable. Other critical paths (UI config, hook) soft-warn so a
# flaky Grok API doesn't permanently block work.
TIMEOUT_FAILS_CLOSED=0
if echo "$matched_files" | grep -qE '^(drizzle/|packages/database/src/schema\.ts|apps/web/src/db/schema\.ts|scripts/auto-update\.sh|scripts/bootstrap-drizzle-migrations\.sh)'; then
  TIMEOUT_FAILS_CLOSED=1
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

# v2.55.29 fix #1: shell-injection-safe prompt assembly.
# Original heredoc was unquoted, so `$(…)` or backticks in the diff
# content would be evaluated by bash. A commit message containing
# "see `rm -rf /` here" would have caused command injection inside the
# pre-push hook. Now use printf with quoted args (data, never re-parsed).
# The mandated machine-readable verdict line is added below.
{
  printf '%s\n' "## Pre-Push Critical-Path Review"
  printf '\n'
  printf '%s\n' "You are reviewing a diff that, if pushed, will land on origin/main and"
  printf '%s\n' "auto-deploy to every fleet box on the next auto-update cycle."
  printf '\n'
  printf '%s\n' "**Your job:** Find non-obvious failure modes that would SILENTLY bite production."
  printf '%s\n' "Be specific — cite file:line. Skip style / preference / naming feedback."
  printf '\n'
  printf '%s\n' "**IMPORTANT — machine-readable verdict.** On a line BY ITSELF in your response, include exactly one of:"
  printf '%s\n' "  \`VERDICT: CLEAN\`   (no critical issues found)"
  printf '%s\n' "  \`VERDICT: FINDING\` (one or more critical issues found)"
  printf '%s\n' "Put the line FIRST in your response. Then explain (if FINDING) below it."
  printf '\n'
  printf '%s\n' "### Relevant Gotchas to check first"
  printf '%s\n' "${GOTCHA_HINT:-(none auto-detected — use judgment from the diff)}"
  printf '\n'
  printf '%s\n' "### Critical-path files changed in this push (the diff below is scoped to these)"
  printf '%s\n' "$matched_files" | sed 's/^/- /'
  printf '\n'
  printf '%s\n' "### All files changed in this push (broader context — ${ALL_CHANGED_COUNT} total)"
  printf '%s\n' '```'
  printf '%s\n' "$ALL_CHANGED" | head -50 | sed 's/^/  /'
  [ "$ALL_CHANGED_COUNT" -gt 50 ] && printf '%s\n' "  …and $((ALL_CHANGED_COUNT - 50)) more"
  printf '%s\n' '```'
  printf '%s\n' "Hint: if a critical-path change is shipped alongside an obviously-unrelated change in the broader file list, that itself is worth flagging as suspicious."
  printf '\n'
  printf '%s\n' "### Recent commits on these files (intent signal)"
  printf '%s\n' '```'
  printf '%s\n' "${RECENT_COMMITS:-(no prior commits on these files in the last 8)}"
  printf '%s\n' '```'
  printf '\n'
  printf '%s\n' "### Diff"
  printf '%s\n' '```diff'
  printf '%s' "$DIFF_CONTENT"
  printf '\n%s\n' '```'
  printf '\n'
  printf '%s\n' "Remember: VERDICT: CLEAN or VERDICT: FINDING as the FIRST line of your response."
} > "$TMP_PROMPT"

# ─── Run Grok with timeout ──────────────────────────────────────────
# Use the wrapper so the standing-rules briefing gets auto-prepended.
GROK_OUTPUT=""
GROK_EXIT=0
GROK_OUTPUT=$(timeout "$TIMEOUT" bash "$REPO_ROOT/scripts/grok-prime.sh" "$TMP_PROMPT" 2>/dev/null) || GROK_EXIT=$?

if [[ $GROK_EXIT -eq 124 ]]; then
  # v2.55.29 fix #3: highest-risk paths fail CLOSED on timeout, not soft-warn.
  # A Grok timeout on a drizzle/schema/auto-update diff is exactly the case
  # we DON'T want to wave through silently.
  if [[ "$TIMEOUT_FAILS_CLOSED" == "1" ]]; then
    echo "" >&2
    echo "  [grok-prepush] Grok timed out after ${TIMEOUT}s on a HIGH-RISK path (drizzle/schema/auto-update)." >&2
    echo "  Failing CLOSED — silent allow is unacceptable for these paths." >&2
    echo "" >&2
    echo "  Bypass: git push --no-verify   (only after manually validating the diff is safe)" >&2
    echo "  Or: GROK_PREPUSH_DISABLE=1 git push   (if Grok is genuinely unavailable)" >&2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] TIMEOUT-BLOCKED range=$RANGE files=$(echo "$matched_files" | tr '\n' ',')" >> "$GROK_LOG"
    exit 1
  fi
  echo "  [grok-prepush] Grok timed out after ${TIMEOUT}s — soft-warn, allowing push (no high-risk paths in this diff)" >&2
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] TIMEOUT range=$RANGE files=$(echo "$matched_files" | tr '\n' ',')" >> "$GROK_LOG"
  exit 0
fi

# v2.55.29 fix #2: robust verdict extraction. Earlier `awk NF{print $1}`
# extracted whatever appeared first (often `**FINDING**:` → `FINDING`
# after stripping `*` and `:`, but also vulnerable to narrative
# preamble like `Reviewing this diff…`). Now: scan first 30 lines for
# the mandated `VERDICT: CLEAN` or `VERDICT: FINDING` line. Fall back
# to a bare `CLEAN`/`FINDING` word match if Grok ignored the format.
# If neither pattern matches (the previous-cache failure mode), treat
# as inconclusive → exit 1 (better safe than silent-allow).
FIRST_WORD=$(echo "$GROK_OUTPUT" | head -30 | grep -m1 -oE 'VERDICT:[[:space:]]+(CLEAN|FINDING)' | grep -oE '(CLEAN|FINDING)' || true)
if [[ -z "$FIRST_WORD" ]]; then
  # Grok ignored the VERDICT: format. Try the bare-word fallback.
  FIRST_WORD=$(echo "$GROK_OUTPUT" | head -30 | grep -m1 -oE '\b(CLEAN|FINDING)\b' || true)
fi
if [[ -z "$FIRST_WORD" ]]; then
  FIRST_WORD="INCONCLUSIVE"
fi

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

if [[ "$FIRST_WORD" == "INCONCLUSIVE" ]]; then
  # Grok responded but didn't follow the verdict protocol. Treat as
  # FINDING by default (better safe than silent-allow) but show what
  # Grok DID say so the operator can decide.
  cat >&2 <<'BLOCK'

╭───────────────────────────────────────────────────────────────────────╮
│  grok-prepush INCONCLUSIVE — Grok did not return VERDICT: CLEAN/FINDING│
╰───────────────────────────────────────────────────────────────────────╯

Grok's actual response is below — interpret it manually. Treating as a
soft block by default (silent-allow on an unparseable verdict is the
exact pattern that bit Phase 4 v1 at the v2.55.28 push).

BLOCK
  echo "$GROK_OUTPUT" >&2
  cat >&2 <<BLOCK

Full output logged to: $GROK_LOG
To push anyway:           git push --no-verify
To suppress this check:   GROK_PREPUSH_DISABLE=1 git push

BLOCK
  exit 1
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
