#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# hermes-learn-scheduling-prefs.sh  —  #349 Wave 6 / Honcho inclusion
# ---------------------------------------------------------------------------
# Runs ON CT212 (the box that has the `hermes` CLI + Honcho access), NOT inside
# the Next.js app. Install it as a Hermes cron:
#
#   hermes cron create --name learn-scheduling-prefs --schedule "0 6 * * *" \
#       --command "/path/to/hermes-learn-scheduling-prefs.sh"
#
# What it does: pulls the bartender-override-learned scheduling preferences from
# a location's existing read-only digest endpoint (GET /api/override-learn/digest
# → byPattern[]) and feeds the stable (3+-occurrence) patterns into a one-shot
# Hermes turn. Hermes's deriver then writes those facts into the **sports-bar**
# Honcho workspace (domain-isolated; NEVER trading-bot). This mirrors the
# deterministic engine's learned prefs into durable, cross-session memory so the
# learning loop survives restarts and is recallable by future Hermes sessions.
#
# The repo adds NOTHING Honcho-specific (no hardcoded CT213 URL, no facts
# payload): Honcho I/O stays inside the `hermes` CLI, which is hard-bound to the
# sports-bar workspace, so domain isolation holds by construction. Fail-open:
# if the location is unreachable or hermes errors, nothing downstream breaks —
# the scheduler never depends on this.
# ---------------------------------------------------------------------------
set -uo pipefail

# Location whose learned prefs to mirror (Tailscale host). Override via env.
LOCATION_HOST="${SBC_DIGEST_HOST:-100.117.155.98}"   # default: Holmgren Way
LOCATION_PORT="${SBC_DIGEST_PORT:-3001}"
DIGEST_URL="http://${LOCATION_HOST}:${LOCATION_PORT}/api/override-learn/digest?days=60"

DIGEST_JSON="$(curl -s --max-time 20 "$DIGEST_URL" 2>/dev/null || true)"
if [ -z "$DIGEST_JSON" ]; then
  echo "[hermes-learn] digest endpoint unreachable ($DIGEST_URL) — skipping (fail-open)"
  exit 0
fi

# Compact the top stable patterns (occurrences >= 3) into one prose line.
SUMMARY="$(printf '%s' "$DIGEST_JSON" | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
    rows = [p for p in (d.get("byPattern") or []) if (p.get("occurrences") or 0) >= 3]
    rows = rows[:15]
    if not rows:
        print(""); sys.exit(0)
    parts = []
    for p in rows:
        team = p.get("team","?"); out = p.get("outputNum"); act = p.get("action","")
        occ = p.get("occurrences",0); home = " (home team)" if p.get("isHomeTeam") else ""
        parts.append(f"{team}{home}: {act} TV output {out} — seen {occ}x")
    print("; ".join(parts))
except Exception:
    print("")
' 2>/dev/null || true)"

if [ -z "$SUMMARY" ]; then
  echo "[hermes-learn] no stable (3+) patterns yet — nothing to record"
  exit 0
fi

PROMPT="Record to sports-bar memory — learned bartender TV-routing preferences (from override history, mirror of the scheduler's Wave-6 bias): ${SUMMARY}. These are durable facts about where this bar likes each team's games; recall them when reasoning about scheduling. sports-bar workspace ONLY."

if command -v hermes >/dev/null 2>&1; then
  hermes -z "$PROMPT" -m grok-4 2>&1 | tail -5
  echo "[hermes-learn] recorded $(printf '%s' "$SUMMARY" | tr ';' '\n' | wc -l) preference(s) to sports-bar Honcho memory"
else
  echo "[hermes-learn] 'hermes' CLI not found — run this ON CT212 where the CLI lives"
  exit 0
fi
