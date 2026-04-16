#!/bin/bash
# =============================================================================
# Sports Bar TV Controller — Network TV MAC address capture
# =============================================================================
# Watches for NetworkTVDevice rows that have no macAddress and tries to
# resolve a MAC via ping + ARP as those TVs come online. Writes discovered
# MACs back to the DB so Wake-on-LAN ("All On" on the bartender remote)
# has the address it needs.
#
# Intended workflow: turn the TVs on one by one (or all at once). This
# script sits in the background, pings each still-unresolved IP every few
# seconds, and the moment a TV answers ARP it grabs the MAC and commits.
#
# Safe to re-run. Only touches rows where macAddress IS NULL or ''. Will
# never overwrite an already-populated MAC. Exits cleanly on SIGINT (^C)
# and on completion (all known IPs resolved).
#
# Usage:
#   bash scripts/capture-tv-macs.sh                 # watch all brands
#   bash scripts/capture-tv-macs.sh --brand samsung # filter to one brand
#   bash scripts/capture-tv-macs.sh --interval 10   # poll every 10s
#   bash scripts/capture-tv-macs.sh --once          # single pass, exit
#
# Requires: sqlite3, ping, ip (from iproute2). Same host as the DB.
# =============================================================================
set -euo pipefail

DB="${DB:-/home/ubuntu/sports-bar-data/production.db}"
INTERVAL=5
BRAND_FILTER=""
ONE_SHOT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --brand)    BRAND_FILTER="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --once)     ONE_SHOT=1; shift ;;
    --db)       DB="$2"; shift 2 ;;
    -h|--help)  sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

if ! command -v sqlite3 >/dev/null; then echo "sqlite3 not found" >&2; exit 1; fi
if [ ! -f "$DB" ]; then echo "db not found: $DB" >&2; exit 1; fi

build_query() {
  local brand_clause=""
  if [ -n "$BRAND_FILTER" ]; then
    brand_clause="AND LOWER(brand)=LOWER('$BRAND_FILTER')"
  fi
  echo "SELECT id, ipAddress, COALESCE(name, ''), brand FROM NetworkTVDevice WHERE (macAddress IS NULL OR macAddress='') $brand_clause ORDER BY ipAddress;"
}

pending_count() {
  sqlite3 "$DB" "$(build_query)" | wc -l
}

trap 'echo ""; echo "[mac-capture] interrupted, exiting"; exit 0' INT

ROUND=0
INITIAL=$(pending_count)
echo "[mac-capture] DB=$DB brand=${BRAND_FILTER:-any} interval=${INTERVAL}s pending=$INITIAL"
if [ "$INITIAL" -eq 0 ]; then
  echo "[mac-capture] nothing to do — all rows already have a MAC"
  exit 0
fi

while true; do
  ROUND=$((ROUND+1))
  RESOLVED=0
  STILL_PENDING=0

  # Snapshot pending set for this round
  while IFS='|' read -r id ip name brand; do
    [ -z "$ip" ] && continue
    # Prime ARP — one fast ping. Don't care if it succeeds at IP level;
    # we only need the L2 reply to hit the neighbor table.
    ping -c 1 -W 1 "$ip" >/dev/null 2>&1 || true
    # Read the neighbor table entry. An unresolved entry shows up as
    # "FAILED" or "INCOMPLETE" with no lladdr.
    MAC=$(ip neigh show "$ip" 2>/dev/null | awk '/lladdr/ {for (i=1;i<=NF;i++) if ($i=="lladdr") print $(i+1)}' | head -1)
    if [ -n "$MAC" ]; then
      # Normalize to upper-case colon form (matches Samsung/LG probe conventions)
      MAC_UP=$(echo "$MAC" | tr 'a-f' 'A-F')
      sqlite3 "$DB" "UPDATE NetworkTVDevice SET macAddress='$MAC_UP', updatedAt=datetime('now') WHERE id='$id' AND (macAddress IS NULL OR macAddress='');"
      echo "[mac-capture] [round $ROUND] $ip ${name:+($name) }-> $MAC_UP"
      RESOLVED=$((RESOLVED+1))
    else
      STILL_PENDING=$((STILL_PENDING+1))
    fi
  done < <(sqlite3 "$DB" "$(build_query)")

  TOTAL_DONE=$((INITIAL - STILL_PENDING))
  echo "[mac-capture] [round $ROUND] resolved_this_round=$RESOLVED pending=$STILL_PENDING total_resolved=$TOTAL_DONE/$INITIAL"

  if [ "$STILL_PENDING" -eq 0 ]; then
    echo "[mac-capture] all TVs resolved — done"
    exit 0
  fi

  if [ "$ONE_SHOT" -eq 1 ]; then
    echo "[mac-capture] --once specified, exiting with $STILL_PENDING still pending"
    exit 0
  fi

  sleep "$INTERVAL"
done
