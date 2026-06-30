#!/usr/bin/env bash
# who-hit-3002.sh — summarize who has connected to the bartender remote (:3002).
# Reads the durable MAC-enriched audit log written by conn-track-3002-enrich.sh.
#
# Usage:
#   scripts/who-hit-3002.sh            # summary table, all time
#   scripts/who-hit-3002.sh --wan      # only WAN (internet) connections
#   scripts/who-hit-3002.sh --today    # only today
#   scripts/who-hit-3002.sh --raw      # tail the raw per-request nginx log
set -euo pipefail

LOG="/home/ubuntu/sports-bar-data/logs/bartender-3002-connections.log"
RAW="/var/log/nginx/bartender-3002.log"

[ "${1:-}" = "--raw" ] && { sudo tail -40 "$RAW" 2>/dev/null || tail -40 "$RAW"; exit 0; }
[ -f "$LOG" ] || { echo "No connections recorded yet ($LOG missing). Cron may not have run."; exit 0; }

filter='cat'
[ "${1:-}" = "--wan" ]   && filter='grep "scope=WAN"'
[ "${1:-}" = "--today" ] && filter="grep \"^$(date +%Y-%m-%d)\""

# Aggregate the audit log by IP: total hits, first seen, last seen, MAC, scope, last UA.
eval "$filter \"$LOG\"" | awk -F' \\| ' '
  {
    split($1, t, "+"); ts=$1
    ip=$2; sub(/ip=/,"",ip)
    mac=$3; sub(/mac=/,"",mac)
    scope=$4; sub(/scope=/,"",scope)
    h=$5; sub(/hits=/,"",h)
    ua=$7; sub(/ua="/,"",ua); sub(/"$/,"",ua)
    if (!(ip in first)) first[ip]=ts
    last[ip]=ts; HITS[ip]+=h; MAC[ip]=mac; SCOPE[ip]=scope; UA[ip]=ua
  }
  END {
    printf "%-16s %-8s %-18s %8s  %-19s  %-19s\n","IP","SCOPE","MAC","HITS","FIRST SEEN","LAST SEEN"
    printf "%-16s %-8s %-18s %8s  %-19s  %-19s\n","--","-----","---","----","----------","---------"
    for (i in HITS)
      printf "%-16s %-8s %-18s %8d  %-19.19s  %-19.19s\n", i, SCOPE[i], MAC[i], HITS[i], first[i], last[i]
  }
' | { read -r h1; read -r h2; echo "$h1"; echo "$h2"; sort -k5; }

echo
echo "Tip: --wan (internet only) · --today · --raw (per-request). Full audit: $LOG"
