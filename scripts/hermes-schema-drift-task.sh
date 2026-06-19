#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# hermes-schema-drift-task.sh — Hermes fleet schema-consistency task
# ---------------------------------------------------------------------------
# Runs ON CT212 (the Hermes box) as a cron. Encodes the operator-approved
# two-tier flow for keeping every fleet box's DB STRUCTURE (tables + columns)
# identical — data stays location-specific and is never compared.
#
#   1. detect: scripts/fleet-schema-audit.sh  (read-only; exit 2 on drift)
#   2. tier-1 auto-fix (SAFE, no approval): for each drifted box run
#        scripts/fix-schema-drift.sh <box>  -> drizzle-kit migrate (committed
#        migrations only; never push, never DROP, never touch data).
#   3. tier-2 escalate: if tier-1 exits 3 (migrate ran but drift persists, or a
#        non-migration structural problem), hand the box + drift JSON to Claude
#        via ask_claude_code. Claude auto-applies SAFE DDL for the missing
#        tables/cols and escalates any DROP / data-affecting change for approval.
#
# Install as a Hermes cron (daily):
#   hermes cron create --name fleet-schema-drift --schedule "0 5 * * *" \
#       --command "/home/ubuntu/Sports-Bar-TV-Controller/scripts/hermes-schema-drift-task.sh"
#
# Required env (set in the cron environment, NEVER committed):
#   FLEET_SSH_PW    fleet SSH password (for the audit + remote fix)
#   ASK_CLAUDE_CMD  command that delegates to Claude Code; receives the prompt on
#                   stdin. Default: 'hermes -z' (the same ask_claude_code path the
#                   localworker profile uses). Override per your Hermes setup.
#
# Fail-open: any unreachable box or tool error is logged and skipped; the
# scheduler/app never depend on this task.
# ---------------------------------------------------------------------------
set -uo pipefail

REPO="${SBC_REPO:-/home/ubuntu/Sports-Bar-TV-Controller}"
AUDIT_JSON="/tmp/fleet-schema-audit.json"
ASK_CLAUDE_CMD="${ASK_CLAUDE_CMD:-hermes -z}"
LOG() { echo "[hermes-schema $(date -Iseconds)] $*"; }

cd "$REPO" || { LOG "repo not found at $REPO"; exit 0; }
if [ -z "${FLEET_SSH_PW:-}" ]; then LOG "FLEET_SSH_PW unset — cannot audit; skipping (fail-open)"; exit 0; fi

LOG "running fleet schema audit..."
FLEET_SSH_PW="$FLEET_SSH_PW" bash scripts/fleet-schema-audit.sh > /tmp/hermes-schema-audit.out 2>&1
rc=$?
tail -30 /tmp/hermes-schema-audit.out | sed 's/^/  /'

if [ "$rc" -ne 2 ]; then
  LOG "no actionable drift (audit rc=$rc). done."
  exit 0
fi

# Parse drifted boxes from the audit JSON.
boxes=$(python3 -c "
import json
try:
    d=json.load(open('$AUDIT_JSON'))
    print(' '.join(sorted({x['box'] for x in d.get('driftDetails',[])})))
except Exception:
    pass
" 2>/dev/null)
[ -z "$boxes" ] && { LOG "drift flagged but no boxes parsed from JSON — skipping"; exit 0; }
LOG "drifted boxes: $boxes"

for box in $boxes; do
  LOG "tier-1 safe migrate on $box ..."
  FLEET_SSH_PW="$FLEET_SSH_PW" bash scripts/fix-schema-drift.sh "$box" > "/tmp/hermes-fix-$box.out" 2>&1
  frc=$?
  tail -15 "/tmp/hermes-fix-$box.out" | sed 's/^/    /'
  if [ "$frc" -eq 0 ]; then
    LOG "$box: FIXED by tier-1 migrate."
    continue
  fi

  # tier-2 escalate to Claude via ask_claude_code
  LOG "$box: tier-1 did not resolve (rc=$frc) — escalating to Claude (ask_claude_code)."
  detail=$(python3 -c "
import json
d=json.load(open('$AUDIT_JSON'))
for x in d.get('driftDetails',[]):
    if x['box']=='$box': print('; '.join(x.get('missing',[])))
" 2>/dev/null)
  PROMPT="Fleet schema drift on sports-bar box '$box'. The safe tier (scripts/fix-schema-drift.sh -> drizzle-kit migrate of committed migrations) ran but did NOT resolve it. Missing structure vs the version cohort: ${detail}. Diagnose and AUTO-APPLY the safe DDL to create the missing tables/columns on $box's production DB (/home/ubuntu/sports-bar-data/production.db), matching packages/database/src/schema.ts and the committed drizzle migrations EXACTLY. Use CREATE TABLE / ALTER TABLE ADD COLUMN only. Do NOT use drizzle-kit push. Back up the DB first. ESCALATE for human approval (do not run) any DROP, data-affecting ALTER, or anything you are not certain mirrors the committed schema. Then re-run scripts/fleet-schema-audit.sh to confirm $box matches its cohort."
  printf '%s' "$PROMPT" | $ASK_CLAUDE_CMD 2>&1 | tail -20 | sed 's/^/    /' \
    || LOG "$box: ask_claude_code invocation failed (ASK_CLAUDE_CMD='$ASK_CLAUDE_CMD') — left for manual fix."
done

LOG "done."
