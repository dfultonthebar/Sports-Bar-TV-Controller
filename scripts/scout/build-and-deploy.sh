#!/usr/bin/env bash
# Per-location Scout APK build + sideload + configure (v2.82.42).
#
# Builds the Scout APK with THIS box's LAN IP baked in as the Scout serverUrl, sideloads it to every
# Fire TV / NVIDIA Shield registered at the location, and sends the CONFIG broadcast + enables the
# accessibility service — so Scout reports its play-results back to THIS box (each location → its
# own IP). Run after adding/replacing streaming devices, or to push a new Scout build.
#
# Prereq: the Android SDK (run scripts/scout/install-build-tools.sh once per box first).
# Usage:  bash scripts/scout/build-and-deploy.sh [--device <ip>]   (no --device = all DB devices)
set -uo pipefail
REPO=/home/ubuntu/Sports-Bar-TV-Controller
SCOUT=$REPO/firestick-scout
ADB=/usr/bin/adb
PORT=3001
DB=/home/ubuntu/sports-bar-data/production.db
export ANDROID_HOME=${ANDROID_HOME:-/home/ubuntu/android-sdk}
export ANDROID_SDK_ROOT=$ANDROID_HOME

ONE_DEVICE=""
[ "${1:-}" = "--device" ] && ONE_DEVICE="${2:-}"

# 1. This box's LAN IP — the address the Fire TVs / Shield reach us at (skip Tailscale 100.x).
BOXIP=$(hostname -I | tr ' ' '\n' | grep -E '^(10|172|192|168)\.' | grep -v '^100\.' | head -1)
[ -z "$BOXIP" ] && { echo "ERROR: could not detect a LAN IP for this box"; exit 1; }
SURL="http://$BOXIP:$PORT/api/firestick-scout"
echo "==> Scout serverUrl for this location: $SURL"

# 2. Build the APK with the location IP baked into SERVER_URL_DEFAULT.
echo "==> building Scout APK…"
( cd "$SCOUT" && ./gradlew assembleDebug -PscoutServerUrl="$SURL" --console=plain ) \
  || { echo "ERROR: gradle build failed (run install-build-tools.sh?)"; exit 1; }
APK="$SCOUT/app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK" ] || { echo "ERROR: no APK produced"; exit 1; }
VER=$(cd "$SCOUT" && grep -m1 versionName app/build.gradle | sed 's/.*"\(.*\)".*/\1/')
echo "==> built Scout $VER"

# 3. Device IPs (Fire TVs + Shield) from the DB, or the single --device arg.
if [ -n "$ONE_DEVICE" ]; then IPS="$ONE_DEVICE"; else
  IPS=$(sqlite3 "$DB" "SELECT ipAddress FROM FireTVDevice WHERE ipAddress IS NOT NULL AND ipAddress != ''" 2>/dev/null)
fi
[ -z "$IPS" ] && { echo "ERROR: no devices found"; exit 1; }

SVC="com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService"
for ip in $IPS; do
  echo "-- $ip --"
  $ADB connect "$ip:5555" >/dev/null 2>&1; sleep 1
  if ! $ADB -s "$ip:5555" shell true >/dev/null 2>&1; then echo "   unreachable — skip"; continue; fi
  $ADB -s "$ip:5555" install -r "$APK" 2>&1 | tail -1
  # Point Scout at THIS box, and ensure its accessibility service is enabled (preserve any others).
  $ADB -s "$ip:5555" shell "am broadcast -a com.sportsbar.scout.CONFIG --es server_url '$SURL' -n com.sportsbar.scout/.ConfigReceiver" >/dev/null 2>&1
  cur=$($ADB -s "$ip:5555" shell "settings get secure enabled_accessibility_services" 2>/dev/null | tr -d '\r')
  [ "$cur" = "null" ] && cur=""
  case "$cur" in *com.sportsbar.scout*) NEW="$cur";; "") NEW="$SVC";; *) NEW="$cur:$SVC";; esac
  $ADB -s "$ip:5555" shell "settings put secure enabled_accessibility_services $NEW; settings put secure accessibility_enabled 1" >/dev/null 2>&1
  inst=$($ADB -s "$ip:5555" shell "dumpsys package com.sportsbar.scout | grep versionName" 2>/dev/null | tr -d ' \r' | head -1)
  echo "   installed + configured → $inst, reports to $SURL"
done
echo "==> done. Scout on this location's devices now reports play-results to $SURL/play-result"
