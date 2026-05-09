#!/usr/bin/env bash
# install-scout-accessibility.sh
#
# Builds the Scout v1.5.0+ APK and installs it on every Fire TV Cube
# at THIS location, enabling the AccessibilityService for in-app
# playback automation. Idempotent — safe to re-run.
#
# Each location has different Cube IPs. This script does NOT hardcode
# any. It queries the local production.db (FireTVDevice table) which
# is the same source of truth the host code uses.
#
# Usage (run on the location's host machine):
#
#   bash scripts/install-scout-accessibility.sh
#
# Optional flags:
#
#   --skip-build    Use the most recent APK at firestick-scout/app/
#                   build/outputs/apk/debug/app-debug.apk; don't rebuild.
#   --cube <ip>     Install only on this specific Cube IP (skip the
#                   per-Cube DB lookup).
#   --dry-run       Print what would be done; don't install/enable.
#
# Prerequisites:
#   - bash scripts/install-android-build-env.sh has been run once
#     (gives you JDK 17 + Android SDK + adb in PATH)
#   - production.db is at /home/ubuntu/sports-bar-data/production.db
#   - Cubes are LAN-reachable from the host
#
# This script:
#   1. Builds the APK (unless --skip-build)
#   2. For each Fire TV Cube row in production.db (excluding rows whose
#      name contains 'REPLAC', 'Atmosphere', 'Epson'):
#      a. adb connect <ip>:5555
#      b. Compares the installed APK's versionName against the new APK's
#         versionName; skips if same or newer
#      c. adb install -r <apk>
#      d. Sets enabled_accessibility_services + accessibility_enabled
#      e. Verifies the AccessibilityService binds (waits up to 10s)
#   3. Prints a per-Cube success/skip/fail summary
#
# Safe to re-run any time. The settings put secure commands are
# idempotent; the install is a no-op upgrade if the APK matches.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOUT_DIR="${REPO_ROOT}/firestick-scout"
APK_PATH="${SCOUT_DIR}/app/build/outputs/apk/debug/app-debug.apk"
DB_PATH="/home/ubuntu/sports-bar-data/production.db"
SERVICE_COMPONENT="com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService"

SKIP_BUILD=0
SPECIFIC_CUBE=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1 ;;
    --cube) SPECIFIC_CUBE="$2"; shift ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "unknown flag: $1"; exit 1 ;;
  esac
  shift
done

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY] $*"
  else
    eval "$@"
  fi
}

echo "[INSTALL-SCOUT-AS] Repo: $REPO_ROOT"
echo "[INSTALL-SCOUT-AS] APK: $APK_PATH"
echo "[INSTALL-SCOUT-AS] DB:  $DB_PATH"
echo "[INSTALL-SCOUT-AS] Service component: $SERVICE_COMPONENT"
echo "[INSTALL-SCOUT-AS] Dry run: $DRY_RUN"
echo

# Discover this host's LAN IP — Scout reports heartbeats to this address.
# `hostname -I` returns space-separated addresses (LAN IPs first, then
# Tailscale, etc.). We grab the first non-Tailscale (100.x), non-IPv6 one.
HOST_LAN_IP=$(hostname -I | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^100\.' | head -1)
if [ -z "$HOST_LAN_IP" ]; then
  HOST_LAN_IP=$(hostname -I | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
fi
SCOUT_SERVER_URL="http://${HOST_LAN_IP}:3001/api/firestick-scout"
echo "[INSTALL-SCOUT-AS] Detected host LAN IP: $HOST_LAN_IP"
echo "[INSTALL-SCOUT-AS] Will configure Scout to report to: $SCOUT_SERVER_URL"
echo

# Auto-create/update local.properties so the build embeds the right URL.
# A pre-existing scoutServerUrl is left alone (operator may have customized).
LOCAL_PROPS="$SCOUT_DIR/local.properties"
if ! grep -q '^scoutServerUrl=' "$LOCAL_PROPS" 2>/dev/null; then
  echo "[INSTALL-SCOUT-AS] Writing scoutServerUrl into $LOCAL_PROPS"
  if [ "$DRY_RUN" = "0" ]; then
    echo "scoutServerUrl=$SCOUT_SERVER_URL" >> "$LOCAL_PROPS"
  fi
fi
if ! grep -q '^sdk.dir=' "$LOCAL_PROPS" 2>/dev/null; then
  if [ -d /home/ubuntu/android-sdk ]; then
    echo "[INSTALL-SCOUT-AS] Writing sdk.dir into $LOCAL_PROPS"
    if [ "$DRY_RUN" = "0" ]; then
      echo "sdk.dir=/home/ubuntu/android-sdk" >> "$LOCAL_PROPS"
    fi
  fi
fi

# Build APK if needed.
if [ "$SKIP_BUILD" = "0" ]; then
  if [ ! -d /home/ubuntu/android-sdk ] && [ "$DRY_RUN" = "0" ]; then
    echo "[INSTALL-SCOUT-AS] FATAL: Android SDK not at /home/ubuntu/android-sdk"
    echo "  Either run: bash scripts/install-android-build-env.sh"
    echo "  OR copy a pre-built APK from another location's host:"
    echo "      scp <other-host>:$APK_PATH $APK_PATH"
    echo "  AND re-run with --skip-build"
    exit 1
  fi
  echo "[INSTALL-SCOUT-AS] Building APK..."
  # Always do a `clean` first — without it, gradle's incremental build
  # cache can serve a stale APK that's missing newly-added manifest
  # entries (services, receivers). This bit us during the v1.5.0 rollout
  # at Lucky's: PlaybackAutomationService didn't appear in the installed
  # APK's manifest until we forced a clean rebuild.
  # Gradle 8.0 needs JDK 17 (not 21+ — class file major version 65
  # is unsupported). Pin JAVA_HOME if a JDK 17 install is present.
  GRADLE_JAVA_HOME="${JAVA_HOME:-}"
  if [ -d /usr/lib/jvm/java-17-openjdk-amd64 ]; then
    GRADLE_JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
  fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY] cd $SCOUT_DIR && JAVA_HOME=$GRADLE_JAVA_HOME ./gradlew --no-daemon clean assembleDebug"
  else
    (cd "$SCOUT_DIR" && JAVA_HOME="$GRADLE_JAVA_HOME" ./gradlew --no-daemon clean assembleDebug 2>&1 | tail -3)
  fi
fi

if [ ! -f "$APK_PATH" ] && [ "$DRY_RUN" = "0" ]; then
  echo "[INSTALL-SCOUT-AS] FATAL: APK not found at $APK_PATH"
  echo "  Build failed, or run without --skip-build"
  exit 1
fi

# Read the new APK's versionName from build.gradle for comparison.
NEW_VERSION=$(grep -E 'versionName "' "$SCOUT_DIR/app/build.gradle" | head -1 | sed 's/.*versionName "\(.*\)".*/\1/')
echo "[INSTALL-SCOUT-AS] New APK versionName: $NEW_VERSION"

# Discover Cubes.
if [ -n "$SPECIFIC_CUBE" ]; then
  CUBES="$SPECIFIC_CUBE"
  echo "[INSTALL-SCOUT-AS] Targeting one Cube: $SPECIFIC_CUBE"
else
  if [ ! -f "$DB_PATH" ]; then
    echo "[INSTALL-SCOUT-AS] FATAL: $DB_PATH not found. Run on a location host, or pass --cube <ip>"
    exit 1
  fi
  # Filter out non-Cube Fire TV rows (Atmosphere streams, Epson projectors,
  # REPLAC tagged dead hardware) — same exclusion the firestick-scout
  # walker uses.
  CUBES=$(sqlite3 "$DB_PATH" "
    SELECT ipAddress FROM FireTVDevice
    WHERE ipAddress IS NOT NULL
      AND ipAddress != ''
      AND name NOT LIKE '%REPLAC%'
      AND name NOT LIKE '%Atmosphere%'
      AND name NOT LIKE '%Epson%'
  ")
  if [ -z "$CUBES" ]; then
    echo "[INSTALL-SCOUT-AS] No Fire TV Cubes found in $DB_PATH. Nothing to do."
    exit 0
  fi
  echo "[INSTALL-SCOUT-AS] Discovered Cubes:"
  echo "$CUBES" | sed 's/^/  - /'
fi
echo

OK_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0

for CUBE_IP in $CUBES; do
  echo "================================================================"
  echo "[$CUBE_IP] Processing"
  echo "================================================================"

  # Connect.
  run "adb connect ${CUBE_IP}:5555 >/dev/null 2>&1"
  STATE=$(adb -s "${CUBE_IP}:5555" get-state 2>/dev/null || echo "unknown")
  if [ "$STATE" != "device" ]; then
    echo "[$CUBE_IP] adb state = $STATE — SKIP (Cube not reachable / unauthorized)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  # Compare installed version.
  CURRENT=$(adb -s "${CUBE_IP}:5555" shell "dumpsys package com.sportsbar.scout 2>/dev/null | grep -m1 versionName" 2>/dev/null | sed 's/.*versionName=//' | tr -d '\r' || echo "<not installed>")
  echo "[$CUBE_IP] Currently installed: $CURRENT"
  if [ "$CURRENT" = "$NEW_VERSION" ]; then
    echo "[$CUBE_IP] Same version — skipping APK install"
    INSTALLED_OK=1
  else
    echo "[$CUBE_IP] Installing APK..."
    if [ "$DRY_RUN" = "0" ]; then
      RESULT=$(adb -s "${CUBE_IP}:5555" install -r "$APK_PATH" 2>&1 | tail -3)
      echo "$RESULT" | sed "s/^/[$CUBE_IP]   /"
      if echo "$RESULT" | grep -q Success; then
        INSTALLED_OK=1
      elif echo "$RESULT" | grep -q INSTALL_FAILED_UPDATE_INCOMPATIBLE; then
        # Signature mismatch — different host built this APK with a
        # different debug keystore. Each host's
        # `~/.android/debug.keystore` is generated independently. The
        # only way to upgrade across keystores is uninstall + install
        # fresh. We lose the previous scout_config.xml (server URL),
        # which is re-broadcast below; transient mailbox state is
        # also wiped. Both are fine to lose.
        echo "[$CUBE_IP]   Signature mismatch — uninstall + reinstall"
        adb -s "${CUBE_IP}:5555" shell "pm uninstall com.sportsbar.scout" 2>&1 | head -1 | sed "s/^/[$CUBE_IP]   /"
        RESULT2=$(adb -s "${CUBE_IP}:5555" install -r "$APK_PATH" 2>&1 | tail -1)
        echo "$RESULT2" | sed "s/^/[$CUBE_IP]   /"
        if echo "$RESULT2" | grep -q Success; then
          INSTALLED_OK=1
        else
          INSTALLED_OK=0
        fi
      else
        INSTALLED_OK=0
      fi
    else
      INSTALLED_OK=1
    fi
  fi

  if [ "${INSTALLED_OK:-0}" != "1" ]; then
    echo "[$CUBE_IP] APK install FAILED"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  # Send CONFIG broadcast to set the runtime server URL — this overrides
  # whatever URL was baked into the APK at build time, so a single APK
  # rebuilt at any location works at every location once configured.
  echo "[$CUBE_IP] Configuring Scout server URL → $SCOUT_SERVER_URL"
  run "adb -s ${CUBE_IP}:5555 shell 'am broadcast -a com.sportsbar.scout.CONFIG --es server_url \"$SCOUT_SERVER_URL\" -n com.sportsbar.scout/.ConfigReceiver' >/dev/null 2>&1"

  # Enable AccessibilityService.
  echo "[$CUBE_IP] Enabling PlaybackAutomationService..."
  run "adb -s ${CUBE_IP}:5555 shell 'settings put secure enabled_accessibility_services $SERVICE_COMPONENT' >/dev/null 2>&1"
  run "adb -s ${CUBE_IP}:5555 shell 'settings put secure accessibility_enabled 1' >/dev/null 2>&1"

  # Verify the AS bound (max 10s wait).
  if [ "$DRY_RUN" = "1" ]; then
    echo "[$CUBE_IP] DRY: would verify AS via dumpsys accessibility"
  else
    VERIFIED=0
    for _ in $(seq 1 10); do
      sleep 1
      if adb -s "${CUBE_IP}:5555" shell "dumpsys accessibility 2>&1 | grep -q FireStick" 2>/dev/null; then
        VERIFIED=1
        break
      fi
    done
    if [ "$VERIFIED" = "1" ]; then
      echo "[$CUBE_IP] AccessibilityService verified bound ✓"
      OK_COUNT=$((OK_COUNT + 1))
    else
      echo "[$CUBE_IP] WARNING — AS settings written but service not bound after 10s. Check Settings → Accessibility on the Cube."
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  fi
done

echo
echo "================================================================"
echo "[INSTALL-SCOUT-AS] Done. ok=$OK_COUNT skip=$SKIP_COUNT fail=$FAIL_COUNT"
echo "================================================================"

# Exit non-zero only if at least one Cube failed AND none succeeded.
if [ "$FAIL_COUNT" -gt 0 ] && [ "$OK_COUNT" = "0" ]; then
  exit 2
fi
exit 0
