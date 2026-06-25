#!/usr/bin/env bash
# Install the Android SDK needed to build the Scout APK on a location box (v2.82.42).
#
# Each location builds its OWN Scout APK (so the box IP is baked in as the report-back serverUrl —
# see build-and-deploy.sh). That requires the Android SDK + JDK 17 on the box. This installs them
# to ~/android-sdk and points firestick-scout/local.properties at it. Idempotent — safe to re-run.
# Lime Kiln + any box that doesn't already have the SDK needs this once.
set -uo pipefail
SDK=/home/ubuntu/android-sdk
REPO=/home/ubuntu/Sports-Bar-TV-Controller
CLT_VER=11076708   # cmdline-tools build; bump if Google retires it
export ANDROID_HOME=$SDK ANDROID_SDK_ROOT=$SDK

echo "==> JDK 17"
if ! java -version 2>&1 | grep -q "17\."; then
  sudo apt-get update -qq && sudo apt-get install -y openjdk-17-jdk unzip wget || { echo "JDK install failed"; exit 1; }
fi

echo "==> Android cmdline-tools"
if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  mkdir -p "$SDK/cmdline-tools"
  ZIP="/tmp/commandlinetools-linux-${CLT_VER}_latest.zip"
  wget -q "https://dl.google.com/android/repository/commandlinetools-linux-${CLT_VER}_latest.zip" -O "$ZIP" \
    || { echo "ERROR: cmdline-tools download failed"; exit 1; }
  unzip -q -o "$ZIP" -d "$SDK/cmdline-tools"
  # the zip extracts to cmdline-tools/cmdline-tools — sdkmanager expects .../latest
  [ -d "$SDK/cmdline-tools/cmdline-tools" ] && mv -f "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -f "$ZIP"
fi

SDKMGR="$SDK/cmdline-tools/latest/bin/sdkmanager"
echo "==> accepting licenses + installing platform-tools / android-33 / build-tools 33.0.2"
yes | "$SDKMGR" --sdk_root="$SDK" --licenses >/dev/null 2>&1 || true
"$SDKMGR" --sdk_root="$SDK" "platform-tools" "platforms;android-33" "build-tools;33.0.2" >/dev/null 2>&1 \
  || { echo "ERROR: sdkmanager package install failed"; exit 1; }

# Point the Scout build at this SDK.
LP="$REPO/firestick-scout/local.properties"
grep -q "sdk.dir=$SDK" "$LP" 2>/dev/null || { grep -v '^sdk.dir=' "$LP" 2>/dev/null > "$LP.tmp" || true; echo "sdk.dir=$SDK" >> "$LP.tmp"; mv "$LP.tmp" "$LP"; }

echo "==> Android SDK ready at $SDK. This box can now build Scout:"
echo "    bash scripts/scout/build-and-deploy.sh"
