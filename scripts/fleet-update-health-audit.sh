#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fleet-update-health-audit.sh — detect boxes whose AUTO-UPDATE is STALLED or
#                                CRIPPLED (companion to fleet-deps/security/
#                                schema audits)
# ---------------------------------------------------------------------------
# Version-lag is NOT the signal we care about here — a box one or two minors
# behind is benign (it just hasn't hit its next cron cycle). The dangerous
# states are:
#   * STALLED   — the auto-update timer has not had a successful run in > 7
#                 days. Usually one of the four Gotcha-#11 install-time stalls
#                 (linger off, node-not-on-PATH, ollama group, rollback/conflict
#                 left unresolved) is silently blocking every run.
#   * CRIPPLED  — the "last success" is SYNTHETIC: it was written by an
#                 ssh-propagation / no-verify path (verifyInstall._source
#                 contains "no-verify" or "ssh-propagation"), or verifyInstall
#                 did not actually PASS. The box reports a recent successAt and
#                 looks healthy to the dashboard, but verify-install never ran,
#                 so the box may be 10+ versions behind on un-verified code.
#                 (This is exactly Lime Kiln's state: on `main`, v2.55.x, last
#                 "success" runId = ssh-propagation-*, _source = ssh-propagation-
#                 no-verify. See the data shape baked into the classifier.)
#
# Reads, on each box:
#   /home/ubuntu/Sports-Bar-TV-Controller/.auto-update-last-success.json  (repo, per-branch)
#   /home/ubuntu/sports-bar-data/.auto-update-last-success.json           (sidecar, survives branch switch)
#   /home/ubuntu/sports-bar-data/.auto-update-last-attempt.json           (last attempt + outcome)
#   git HEAD / origin location branches / rollback-* tags
#   loginctl linger, /usr/local/bin/npx, `groups ubuntu` (ollama), update logs
#
# CHECKS:
#   1. version-stall classifier          REPORT  (HEALTHY / STALLED / CRIPPLED)
#   2. branch-drift                       ESCALATE (never auto git-checkout; lime-kiln on main is whitelisted)
#   3a. linger                            AUTO-FIX (--fix: loginctl enable-linger)
#   3b. node-on-PATH                      AUTO-FIX (--fix: symlink from nvm IF nvm-installed)
#   3c. ollama group                      AUTO-FIX (--fix: usermod -aG ollama ubuntu)
#   3d. rollback/conflict in update log   ESCALATE (manual conflict resolution)
#   4. rollback-tag count                 REPORT  (repeated-failure signal)
#
# Usage:
#   FLEET_SSH_PW=... bash scripts/fleet-update-health-audit.sh           # report only
#   FLEET_SSH_PW=... bash scripts/fleet-update-health-audit.sh --fix     # apply the safe idempotent fixes (3a/3b/3c)
#
# Exit: 0 = every box HEALTHY (after any --fix), 2 = stall/cripple/finding or
#       escalation remains, 1 = setup error.
# Output: human report + /tmp/fleet-update-health-audit.json
# ---------------------------------------------------------------------------
set -uo pipefail

OUT_JSON="/tmp/fleet-update-health-audit.json"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=12 -o BatchMode=no"
REPO="/home/ubuntu/Sports-Bar-TV-Controller"
DATA_DIR="/home/ubuntu/sports-bar-data"
FIX=0; [ "${1:-}" = "--fix" ] && FIX=1

# Roster copied from fleet-deps-audit.sh (keep in sync). Each entry also carries
# the canonical location-branch slug so the branch-drift check can look for the
# RIGHT origin/location/<slug> (the roster key != branch slug for several boxes).
# Format: name=ip:branchslug   (branchslug "main" = intentionally-on-main box)
DEFAULT_HOSTS="holmgren=100.117.155.98:holmgren-way leg-lamp=100.101.200.82:leg-lamp luckys=100.77.85.89:lucky-s-1313 graystone=100.93.130.14:graystone greenville=100.112.255.60:stoneyard-greenville appleton=100.107.223.47:stoneyard-appleton lime-kiln=100.89.6.80:main"
HOSTS="${FLEET_HOSTS:-$DEFAULT_HOSTS}"

# Boxes that are INTENTIONALLY parked on `main` (do NOT flag branch-drift for
# these). lime-kiln is the v3.1.0 ISO canary and lives on main on purpose.
# NOTE: an on-main box is still classified CRIPPLED by check 1 if its last
# success is a synthetic ssh-propagation/no-verify record — the whitelist only
# suppresses the branch-drift finding, never the cripple classification.
ON_MAIN_WHITELIST=" lime-kiln "

STALL_SECONDS=$((7 * 24 * 3600))   # > 7 days with no real success = STALLED

if [ -z "${FLEET_SSH_PW:-}" ]; then echo "ERROR: set FLEET_SSH_PW." >&2; exit 1; fi
command -v sshpass >/dev/null 2>&1 || { echo "ERROR: sshpass not installed locally." >&2; exit 1; }

# --------------------------------------------------------------------------
# Remote probe (+fix). Built per-box because it needs $BOXNAME / $BRANCHSLUG /
# $WHITELISTED interpolated. Emits one line per finding:
#   OK / FINDING / FIXED / ESCALATE / REPORT <what> <detail>
# Absolute paths only (cwd-independent for systemd-fired contexts).
# Everything fail-soft: a missing file/dir/command => REPORT, never a crash.
# --------------------------------------------------------------------------
build_remote() {
  local boxname="$1" branchslug="$2" whitelisted="$3"
  cat <<REMOTE_EOF
set -uo pipefail
FIX=$FIX
REPO="$REPO"
DATA_DIR="$DATA_DIR"
BOXNAME="$boxname"
BRANCHSLUG="$branchslug"
WHITELISTED="$whitelisted"
STALL_SECONDS=$STALL_SECONDS
NOW=\$(date +%s)

# ---- helper: read a JSON string/number field via python3 (fail-soft) -------
jget() { # \$1=file \$2=dotted.path  -> value or empty
  [ -f "\$1" ] || { echo ""; return 0; }
  python3 - "\$1" "\$2" 2>/dev/null <<'PY' || echo ""
import json,sys
try:
    d=json.load(open(sys.argv[1]))
    for k in sys.argv[2].split('.'):
        if isinstance(d,dict) and k in d: d=d[k]
        else: print(""); sys.exit(0)
    print("" if d is None else d)
except Exception:
    print("")
PY
}

# ===========================================================================
# CHECK 1 — version-stall classifier  (REPORT: HEALTHY / STALLED / CRIPPLED)
# ===========================================================================
# Prefer the sidecar copy (survives branch switches) then the repo copy.
SUCCESS_JSON=""
for f in "\$DATA_DIR/.auto-update-last-success.json" "\$REPO/.auto-update-last-success.json"; do
  [ -f "\$f" ] && { SUCCESS_JSON="\$f"; break; }
done
if [ -z "\$SUCCESS_JSON" ]; then
  echo "REPORT classify (no .auto-update-last-success.json found — cannot classify; box may have never completed a verified update)"
else
  S_UNIX=\$(jget "\$SUCCESS_JSON" successAtUnix)
  S_VER=\$(jget  "\$SUCCESS_JSON" version)
  V_STATUS=\$(jget "\$SUCCESS_JSON" verifyInstall.status)
  V_SOURCE=\$(jget "\$SUCCESS_JSON" verifyInstall._source)
  RUNID=\$(jget   "\$SUCCESS_JSON" runId)
  # age (guard non-numeric)
  AGE="?"
  case "\$S_UNIX" in (*[!0-9]*|"") AGE_DAYS="?";; (*) AGE_DAYS=\$(( (NOW - S_UNIX) / 86400 ));; esac
  # CRIPPLED: synthetic / non-verifying last "success"
  CRIPPLED=0
  case "\$V_SOURCE" in (*no-verify*|*ssh-propagation*) CRIPPLED=1;; esac
  case "\$RUNID"    in (*ssh-propagation*)             CRIPPLED=1;; esac
  if [ -n "\$V_STATUS" ] && [ "\$V_STATUS" != "PASS" ]; then CRIPPLED=1; fi
  if [ "\$CRIPPLED" = "1" ]; then
    echo "FINDING classify (CRIPPLED: last 'success' is synthetic/non-verify — version=\${S_VER:-?} status=\${V_STATUS:-?} _source=\${V_SOURCE:-?} runId=\${RUNID:-?}; verify-install never actually ran)"
  elif [ "\$AGE_DAYS" = "?" ]; then
    echo "REPORT classify (no usable successAtUnix in heartbeat — cannot age; version=\${S_VER:-?})"
  elif [ "\$(( NOW - S_UNIX ))" -gt "\$STALL_SECONDS" ] 2>/dev/null; then
    echo "FINDING classify (STALLED: last real success was \${AGE_DAYS}d ago > 7d — version=\${S_VER:-?} status=\${V_STATUS:-?}; timer likely blocked, see checks 3a-3d)"
  else
    echo "OK classify (HEALTHY: verified success \${AGE_DAYS}d ago, version=\${S_VER:-?}, status=\${V_STATUS:-PASS})"
  fi
fi

# Last-attempt context (REPORT only) — distinguishes "tried + failed" from "never tried"
ATTEMPT_JSON="\$DATA_DIR/.auto-update-last-attempt.json"
if [ -f "\$ATTEMPT_JSON" ]; then
  A_OUT=\$(jget "\$ATTEMPT_JSON" outcome)
  A_UNIX=\$(jget "\$ATTEMPT_JSON" attempted_at)
  case "\$A_UNIX" in (*[!0-9]*|"") A_AGE="?";; (*) A_AGE=\$(( (NOW - A_UNIX) / 3600 ));; esac
  echo "REPORT attempt (last attempt outcome=\${A_OUT:-?} \${A_AGE}h ago)"
else
  echo "REPORT attempt (no .auto-update-last-attempt.json — auto-update may have never run on this box)"
fi

# ===========================================================================
# CHECK 2 — branch-drift  (ESCALATE; never auto git-checkout)
# ===========================================================================
if [ -d "\$REPO/.git" ]; then
  HEAD_BRANCH=\$(git -C "\$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
  if [ "\$HEAD_BRANCH" = "main" ]; then
    if [ -n "\$WHITELISTED" ]; then
      echo "OK branch (on main — INTENTIONAL for \$BOXNAME, whitelisted v3.1.0 ISO canary)"
    elif [ "\$BRANCHSLUG" != "main" ] && git -C "\$REPO" rev-parse --verify --quiet "origin/location/\$BRANCHSLUG" >/dev/null 2>&1; then
      echo "ESCALATE branch (DRIFT: on 'main' but origin/location/\$BRANCHSLUG exists — every cron run no-ops; do NOT auto-checkout, operator/Claude must restore the branch; see Gotcha #11 + auto-update.sh drift-recovery)"
    else
      echo "REPORT branch (on 'main', no origin/location/\$BRANCHSLUG branch found — cannot confirm canonical branch)"
    fi
  elif [ "\$HEAD_BRANCH" = "?" ]; then
    echo "REPORT branch (could not read HEAD — not a git repo?)"
  else
    echo "OK branch (\$HEAD_BRANCH)"
  fi
else
  echo "REPORT branch (no git repo at \$REPO)"
fi

# ===========================================================================
# CHECK 3 — the 4 Gotcha-#11 stall classes
# ===========================================================================
# 3a — linger (user systemd timer dies without it). AUTO-FIX idempotent.
if loginctl show-user ubuntu 2>/dev/null | grep -q 'Linger=yes'; then
  echo "OK linger (enabled)"
elif [ "\$FIX" = "1" ]; then
  if echo "$FLEET_SSH_PW" | sudo -S loginctl enable-linger ubuntu >/dev/null 2>&1 && loginctl show-user ubuntu 2>/dev/null | grep -q 'Linger=yes'; then
    echo "FIXED linger (enabled)"
  else
    echo "FINDING linger (DISABLED — enable-linger FAILED; user timer dies when SSH session ends; Gotcha #11.1)"
  fi
else
  echo "FINDING linger (DISABLED — user systemd timer dies when SSH session ends; --fix runs loginctl enable-linger; Gotcha #11.1)"
fi

# 3b — node/npx on /usr/local/bin (systemd-fired scripts need it). AUTO-FIX
#      ONLY if nvm-installed node exists (per feedback-fleet-node-install-method-drift:
#      apt/NodeSource boxes already have it in PATH; symlinking a non-existent
#      nvm path would create dangling links).
if ls /usr/local/bin/npx >/dev/null 2>&1; then
  echo "OK node-path (/usr/local/bin/npx present)"
else
  NVM_BIN=\$(ls -d \$HOME/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)
  if [ "\$FIX" = "1" ] && [ -n "\$NVM_BIN" ] && [ -x "\$NVM_BIN/npx" ]; then
    if echo "$FLEET_SSH_PW" | sudo -S ln -sfv "\$NVM_BIN/node" "\$NVM_BIN/npm" "\$NVM_BIN/npx" /usr/local/bin/ >/dev/null 2>&1 && ls /usr/local/bin/npx >/dev/null 2>&1; then
      echo "FIXED node-path (symlinked node/npm/npx from \$NVM_BIN -> /usr/local/bin)"
    else
      echo "FINDING node-path (npx not in /usr/local/bin; symlink from nvm FAILED; Gotcha #11.3)"
    fi
  elif [ -n "\$NVM_BIN" ]; then
    echo "FINDING node-path (npx not in /usr/local/bin; nvm node at \$NVM_BIN — --fix will symlink it; Gotcha #11.3)"
  else
    echo "REPORT node-path (npx not in /usr/local/bin and no nvm install found — likely apt/NodeSource; verify 'which npx' resolves for systemd-fired scripts; Gotcha #11.3)"
  fi
fi

# 3c — ollama group membership (else 'ollama pull' permission-denies). AUTO-FIX.
if command -v ollama >/dev/null 2>&1; then
  if id -nG ubuntu 2>/dev/null | tr ' ' '\n' | grep -qx ollama; then
    echo "OK ollama-group (ubuntu in ollama group)"
  elif [ "\$FIX" = "1" ]; then
    if echo "$FLEET_SSH_PW" | sudo -S usermod -aG ollama ubuntu >/dev/null 2>&1; then
      echo "FIXED ollama-group (added ubuntu to ollama group — re-login/restart for it to take effect)"
    else
      echo "FINDING ollama-group (ubuntu NOT in ollama group; usermod FAILED; 'ollama pull' will perm-deny; Gotcha #11.4)"
    fi
  else
    echo "FINDING ollama-group (ubuntu NOT in ollama group — 'ollama pull' perm-denies on partial blobs; --fix adds it; Gotcha #11.4)"
  fi
else
  echo "OK ollama-group (ollama not installed on this box — group check N/A)"
fi

# 3d — recent ROLLBACK / CONFLICT / modify-delete in the newest update log. ESCALATE.
LATEST_LOG=\$(ls -t "\$DATA_DIR/update-logs/"*.log 2>/dev/null | head -1)
if [ -z "\$LATEST_LOG" ]; then
  echo "REPORT updatelog (no update-logs/*.log found — auto-update may have never produced a log here)"
elif grep -qE 'ROLLBACK|CONFLICT|modify/delete' "\$LATEST_LOG" 2>/dev/null; then
  HIT=\$(grep -aoE 'ROLLBACK|CONFLICT|modify/delete' "\$LATEST_LOG" 2>/dev/null | sort -u | paste -sd, -)
  echo "ESCALATE updatelog (newest log \$(basename "\$LATEST_LOG") has [\$HIT] — last run rolled back / hit a merge conflict; manual resolution needed; Gotcha #11.2)"
else
  echo "OK updatelog (newest log clean)"
fi

# ===========================================================================
# CHECK 4 — rollback-tag count  (REPORT: repeated-failure signal)
# ===========================================================================
if [ -d "\$REPO/.git" ]; then
  RB=\$(git -C "\$REPO" tag -l 'rollback-*' 2>/dev/null | wc -l | tr -d ' ')
  if [ "\${RB:-0}" -ge 5 ] 2>/dev/null; then
    echo "REPORT rollbacks (\$RB rollback-* tags — repeated auto-update failures; inspect update-logs for the recurring failed step)"
  else
    echo "OK rollbacks (\${RB:-0} rollback-* tags)"
  fi
else
  echo "REPORT rollbacks (no git repo — cannot count rollback tags)"
fi
REMOTE_EOF
}

# --------------------------------------------------------------------------
# Per-box loop
# --------------------------------------------------------------------------
echo "============================================================"
echo "FLEET AUTO-UPDATE HEALTH AUDIT — $(date -Iseconds)  (fix=$FIX)"
echo "============================================================"
NEED=0; JSON=""
for entry in $HOSTS; do
  name="${entry%%=*}"; rest="${entry##*=}"
  ip="${rest%%:*}"; branchslug="${rest##*:}"
  [ "$branchslug" = "$ip" ] && branchslug="main"   # tolerate name=ip without :slug
  whitelisted=""; case "$ON_MAIN_WHITELIST" in (*" $name "*) whitelisted="1";; esac

  echo ""; echo "## $name ($ip)  branch-slug=$branchslug${whitelisted:+  [on-main whitelisted]}"
  REMOTE=$(build_remote "$name" "$branchslug" "$whitelisted")
  out=$(sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" "$REMOTE" 2>/dev/null)
  if [ -z "$out" ]; then
    echo "   [!] unreachable — skipped"
    JSON="${JSON}{\"box\":\"$name\",\"reachable\":false},"
    continue
  fi
  # Print everything except plain OK lines (signal only)
  echo "$out" | grep -vE '^OK ' | sed 's/^/   /'
  fnd=$(echo "$out" | grep -c '^FINDING'  || true)
  esc=$(echo "$out" | grep -c '^ESCALATE' || true)
  fxd=$(echo "$out" | grep -c '^FIXED'    || true)
  if [ "$fnd" -eq 0 ] && [ "$esc" -eq 0 ]; then echo "   ✅ auto-update healthy"; fi
  [ "$fxd" -gt 0 ] && echo "   (+${fxd} auto-fixed)"
  { [ "$fnd" -gt 0 ] || [ "$esc" -gt 0 ]; } && NEED=1

  fl=$(echo "$out" | grep '^FINDING '  | sed 's/^FINDING //;s/.*/"&"/' | paste -sd, -)
  el=$(echo "$out" | grep '^ESCALATE ' | sed 's/^ESCALATE //;s/.*/"&"/' | paste -sd, -)
  JSON="${JSON}{\"box\":\"$name\",\"reachable\":true,\"fixed\":$fxd,\"findings\":[${fl}],\"escalate\":[${el}]},"
done

printf '{"generatedAt":"%s","fixApplied":%s,"needsAttention":%s,"boxes":[%s]}\n' \
  "$(date -Iseconds)" "$([ $FIX -eq 1 ] && echo true || echo false)" \
  "$([ $NEED -eq 1 ] && echo true || echo false)" "${JSON%,}" > "$OUT_JSON"

echo ""; echo "------------------------------------------------------------"
if [ $NEED -eq 1 ]; then
  echo "RESULT: auto-update stall/cripple or escalation found. JSON -> $OUT_JSON"
  [ $FIX -eq 0 ] && echo "  Re-run with --fix to apply the safe idempotent fixes (linger / node-path / ollama-group)."
  echo "  CRIPPLED / DRIFT / updatelog-rollback findings are ESCALATE — they are NOT auto-fixed (operator/Claude must restore branch or resolve conflict, then re-trigger auto-update)."
  exit 2
else
  echo "RESULT: every reachable box has a healthy, verified auto-update. JSON -> $OUT_JSON"
  exit 0
fi
