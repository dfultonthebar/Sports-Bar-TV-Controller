#!/usr/bin/env bash
# bounce-memory-to-honcho.sh
#
# Pushes Claude's project memory files (the hard-won lessons/gotchas/standing-rules in
# ~/.claude/projects/<proj>/memory/*.md) into Honcho as corpus, so the off-hours deriver
# turns them into observations — high-signal training data for the fleet-ops-LLM and
# queryable knowledge for the local AI. Lands in workspace=sports-bar, peer=claude-memory,
# session=claude-memory-sync, with observe_me=true so derivation actually fires.
#
# Idempotent-ish: re-running re-posts (memory grows slowly; run occasionally). No LLM/T4 in
# this script itself — just message POSTs; the deriver does the LLM work off-hours.
#
# THERMAL CAVEAT (fanless T4, until the fan PSU lands): a bulk bounce of 100+ files creates a
# big derive backlog, and derivation is GENERATIVE (each msg spawns child tasks). The deriver
# runs qwen-trader at 100% and spikes the card to ~83C in ~60s. Run this only off-hours, and
# expect to thermal-govern the drain (burst → cool → repeat); see the governor pattern in
# memory/feedback_t4_gpu_sharing_rules.md. The proper fix is the fan PSU or a smaller deriver
# model (llama3.2:3b) — the latter needs trading-Claude coordination (shared deriver config).
set -u
H="${HONCHO_BASE:-http://100.90.175.125:8000}"
WS="sports-bar"; PEER="claude-memory"; SESS="claude-memory-sync"
MEMDIR="${MEMDIR:-/home/ubuntu/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory}"
[ -d "$MEMDIR" ] || { echo "no memory dir: $MEMDIR"; exit 1; }

# 1. ensure peer + session, then turn ON derivation for this peer
curl -s -o /dev/null --max-time 8 -X POST "$H/v3/workspaces/$WS/peers"    -H 'Content-Type: application/json' -d "{\"id\":\"$PEER\"}" 2>/dev/null
curl -s -o /dev/null --max-time 8 -X POST "$H/v3/workspaces/$WS/sessions" -H 'Content-Type: application/json' -d "{\"id\":\"$SESS\",\"peers\":{\"$PEER\":{\"observe_me\":true}}}" 2>/dev/null
curl -s -o /dev/null --max-time 8 -X POST "$H/v3/workspaces/$WS/sessions/$SESS/peers" -H 'Content-Type: application/json' -d "{\"$PEER\":{\"observe_me\":true}}" 2>/dev/null

# 2. build one message per memory file (skip the MEMORY.md index itself) + POST in batches
posted="$(MEMDIR="$MEMDIR" PEER="$PEER" H="$H" WS="$WS" SESS="$SESS" python3 - <<'PY'
import os, json, glob, urllib.request
memdir, peer = os.environ["MEMDIR"], os.environ["PEER"]
url = f"{os.environ['H']}/v3/workspaces/{os.environ['WS']}/sessions/{os.environ['SESS']}/messages"
files = sorted(f for f in glob.glob(os.path.join(memdir, "*.md")) if os.path.basename(f) != "MEMORY.md")
msgs = []
for f in files:
    try:
        body = open(f, encoding="utf-8").read().strip()
    except Exception:
        continue
    if not body:
        continue
    # cap any single fact to keep messages sane
    if len(body) > 8000:
        body = body[:8000] + "\n…(truncated)"
    msgs.append({"peer_id": peer, "content": f"[claude-memory: {os.path.basename(f)}]\n{body}"})
ok = 0
for i in range(0, len(msgs), 25):
    chunk = msgs[i:i+25]
    data = json.dumps({"messages": chunk}).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        urllib.request.urlopen(req, timeout=30); ok += len(chunk)
    except Exception as e:
        print(f"batch {i//25} failed: {e}")
print(f"{ok}/{len(msgs)}")
PY
)"
echo "memory files bounced to Honcho: $posted (workspace=$WS peer=$PEER session=$SESS, observe_me=true)"

# 3. log to the flywheel
curl -sS -m 8 -X POST -H 'Content-Type: application/json' \
  "$H/v3/workspaces/$WS/sessions/fleet-ops-log/messages" \
  -d "$(printf '%s' "bounced Claude project memory ($posted files) into Honcho (peer=claude-memory, observe_me=true) — the gotchas/standing-rules/lessons corpus is now derivable by the off-hours deriver for the fleet-ops-LLM" | python3 -c 'import sys,json; print(json.dumps({"messages":[{"peer_id":"fleet-ops","content":sys.stdin.read()}]}))')" >/dev/null 2>&1 || true
