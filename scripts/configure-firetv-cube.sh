#!/usr/bin/env bash
# scripts/configure-firetv-cube.sh
#
# Applies the standard fleet-wide Fire TV Cube configuration:
#   - Screensaver disabled
#   - Sleep / display-off disabled
#   - Stay-on-while-powered enabled (7 = AC + USB + wireless)
#
# These settings make the catalog walker reliable. Without them, Cubes
# idle into screensaver after 5 minutes, and walker dumps capture the
# screensaver overlay (3-4KB, 0 content tiles) instead of actual app
# content. Lucky's 1313 had this issue undiagnosed for weeks before
# 2026-05-09; v2.33.3 added wake-key-press but the durable fix is to
# disable screensaver + sleep entirely so walks aren't fighting the
# OS to keep the screen alive.
#
# Run this:
#   - Once per Cube during initial setup
#   - After any factory-reset of a Cube
#   - As part of a fleet-wide config audit
#
# Usage:
#   bash scripts/configure-firetv-cube.sh <CUBE_IP>
#   bash scripts/configure-firetv-cube.sh 192.168.10.42
#
# Or fleet-wide from a host with adb access to all Cubes:
#   for ip in $(sqlite3 /home/ubuntu/sports-bar-data/production.db \
#       "SELECT ipAddress FROM FireTVDevice WHERE ipAddress IS NOT NULL AND name NOT LIKE '%REPLAC%';"); do
#     bash scripts/configure-firetv-cube.sh "$ip"
#   done

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <CUBE_IP>" >&2
  exit 1
fi

CUBE_IP="$1"
PORT="${2:-5555}"

# Connect (idempotent)
adb connect "${CUBE_IP}:${PORT}" >/dev/null 2>&1

# Verify the Cube is reachable
state=$(adb -s "${CUBE_IP}:${PORT}" get-state 2>/dev/null || echo "no-state")
if [ "$state" != "device" ]; then
  echo "ERROR: ${CUBE_IP}:${PORT} state=$state — cannot configure" >&2
  exit 2
fi

# Apply settings
adb -s "${CUBE_IP}:${PORT}" shell "settings put system screen_off_timeout 2147460000" >/dev/null
adb -s "${CUBE_IP}:${PORT}" shell "settings put secure screensaver_enabled 0" >/dev/null
adb -s "${CUBE_IP}:${PORT}" shell "settings put secure screensaver_activate_on_sleep 0" >/dev/null
adb -s "${CUBE_IP}:${PORT}" shell "settings put secure screensaver_activate_on_dock 0" >/dev/null
adb -s "${CUBE_IP}:${PORT}" shell "settings put global stay_on_while_plugged_in 7" >/dev/null
adb -s "${CUBE_IP}:${PORT}" shell "settings put secure sleep_timeout -1" >/dev/null

# Wake the Cube so settings take effect immediately (also dismisses any
# active screensaver from before this run).
adb -s "${CUBE_IP}:${PORT}" shell "input keyevent 224" >/dev/null # KEYCODE_WAKEUP
sleep 1
adb -s "${CUBE_IP}:${PORT}" shell "input keyevent 3" >/dev/null   # KEYCODE_HOME

# Verify
sot=$(adb -s "${CUBE_IP}:${PORT}" shell "settings get system screen_off_timeout" | tr -d '\r')
ss=$(adb -s "${CUBE_IP}:${PORT}" shell "settings get secure screensaver_enabled" | tr -d '\r')
acts=$(adb -s "${CUBE_IP}:${PORT}" shell "settings get secure screensaver_activate_on_sleep" | tr -d '\r')
stay=$(adb -s "${CUBE_IP}:${PORT}" shell "settings get global stay_on_while_plugged_in" | tr -d '\r')

if [ "$sot" -lt 86400000 ] || [ "$ss" != "0" ] || [ "$acts" != "0" ] || [ "$stay" != "7" ]; then
  echo "WARNING: ${CUBE_IP} settings did not stick:"
  echo "  screen_off_timeout=$sot (expected 2147460000)"
  echo "  screensaver_enabled=$ss (expected 0)"
  echo "  screensaver_activate_on_sleep=$acts (expected 0)"
  echo "  stay_on_while_plugged_in=$stay (expected 7)"
  exit 3
fi

echo "OK: ${CUBE_IP} configured (screensaver+sleep disabled, stay-on enabled)"
