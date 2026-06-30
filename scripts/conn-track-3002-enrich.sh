#!/usr/bin/env bash
# conn-track-3002-enrich.sh
# Reads new lines from the nginx bartender-remote (:3002) access log and writes a
# DURABLE, MAC-enriched connection audit log. Runs every minute via cron.
#
# WHY a cron and not just view-time lookup: MAC addresses live in the kernel ARP
# table (`ip neigh`) and EXPIRE a few minutes after a device goes quiet. To keep a
# permanent MAC record for LAN devices we must resolve the MAC within ~1 min of the
# connection, while the ARP entry is still fresh. WAN clients have no resolvable MAC
# (MAC doesn't survive a router hop) so they're recorded as scope=WAN mac=-.
#
# Added 2026-06-29 with the 3002 WAN exposure. Holmgren-local.
set -euo pipefail

RAW_LOG="/var/log/nginx/bartender-3002.log"
OUT_DIR="/home/ubuntu/sports-bar-data/logs"
OUT_LOG="$OUT_DIR/bartender-3002-connections.log"
STATE="$OUT_DIR/.bartender-3002.offset"
KNOWN_WAN="$OUT_DIR/.bartender-3002.known-wan"   # WAN IPs already alerted on (one per line)
ENV_FILE="/home/ubuntu/Sports-Bar-TV-Controller/.env"

mkdir -p "$OUT_DIR"

# Telegram alert on the FIRST sighting of a new WAN (internet) IP. Creds pulled
# narrowly from .env (not sourced — .env has unquoted values that break `source`).
# Degrades to a silent no-op if creds absent (e.g. other fleet boxes) — safe.
_tg() {
  local tok cid; tok=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'\''')
  cid=$(grep -E '^TELEGRAM_CHAT_ID=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'\''')
  [ -z "$tok" ] || [ -z "$cid" ] && return 0
  curl -sS -m 10 "https://api.telegram.org/bot${tok}/sendMessage" \
    --data-urlencode "chat_id=${cid}" \
    --data-urlencode "text=$1" \
    -d disable_web_page_preview=true >/dev/null 2>&1 || true
}
[ -f "$RAW_LOG" ] || exit 0

size=$(stat -c%s "$RAW_LOG")
offset=0
[ -f "$STATE" ] && offset=$(cat "$STATE" 2>/dev/null || echo 0)
# log rotated (file smaller than last offset) -> start from top
[ "$size" -lt "$offset" ] && offset=0

# nothing new
[ "$size" -le "$offset" ] && { echo "$size" > "$STATE"; exit 0; }

# pull only the new bytes
new=$(tail -c +"$((offset + 1))" "$RAW_LOG" 2>/dev/null || true)
echo "$size" > "$STATE"
[ -z "$new" ] && exit 0

# Collapse the new batch to ONE row per source IP (the remote polls many endpoints
# per second; we don't want a row per poll). Capture: hit count, last uri, last ua.
# awk emits: ip \t count \t last_uri \t last_ua
echo "$new" | awk '
  match($0, /ip=[^ ]+/)        { ip=substr($0,RSTART+3,RLENGTH-3) }
  match($0, /uri=[^ ]+/)       { uri=substr($0,RSTART+4,RLENGTH-4) }
  { ua=""; if (match($0, /ua="[^"]*"/)) ua=substr($0,RSTART+4,RLENGTH-5) }
  ip!="" { cnt[ip]++; lastu[ip]=uri; lastua[ip]=ua }
  END { for (i in cnt) printf "%s\t%d\t%s\t%s\n", i, cnt[i], lastu[i], lastua[i] }
' | while IFS=$'\t' read -r ip hits last_uri ua; do
    [ -z "$ip" ] && continue
    # scope + MAC
    if echo "$ip" | grep -qE '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)'; then
        scope="LAN"
        mac=$(ip neigh show "$ip" 2>/dev/null | grep -oE 'lladdr [0-9a-f:]+' | awk '{print $2}' | head -1)
        [ -z "$mac" ] && mac="unknown"   # LAN but ARP already expired / not yet populated
    else
        scope="WAN"
        mac="-"
    fi
    ts=$(date -Iseconds)
    printf '%s | ip=%s | mac=%s | scope=%s | hits=%s | last_uri=%s | ua="%s"\n' \
        "$ts" "$ip" "$mac" "$scope" "$hits" "$last_uri" "$ua" >> "$OUT_LOG"

    # NEW WAN IP -> alert once. (LAN devices are trusted/in-bar, not alerted.)
    if [ "$scope" = "WAN" ]; then
        touch "$KNOWN_WAN"
        if ! grep -qxF "$ip" "$KNOWN_WAN" 2>/dev/null; then
            echo "$ip" >> "$KNOWN_WAN"
            rdns=$(getent hosts "$ip" 2>/dev/null | awk '{print $2}' | head -1)
            host=$(hostname)
            _tg "🌐 New INTERNET connection to bartender remote (:3002)
Box: ${host}
IP: ${ip}${rdns:+ (${rdns})}
First hit: ${last_uri}
Browser: ${ua}
Time: ${ts}

If this isn't you, the port is being scanned/probed. Check: scripts/who-hit-3002.sh --wan"
        fi
    fi
done
