#!/bin/bash
#
# install-android-build-env.sh
#
# Idempotent installer that sets up everything needed to rebuild the
# firestick-scout Android APK on a fresh Ubuntu 22.04+ host.
#
# Why this exists:
#   At Stoneyard Appleton we discovered the installed firestick-scout APK
#   had a hardcoded server URL that needed to be changed. Rebuilding from
#   source required ~10 minutes of copy-pasted setup commands. This script
#   automates that setup so future installs run with one command.
#
# Usage:
#   bash scripts/install-android-build-env.sh
#   bash scripts/install-android-build-env.sh --sdk-dir /opt/android-sdk
#
# Prerequisite:
#   Passwordless sudo (run scripts/setup-passwordless-sudo.sh first) OR
#   run `sudo -v` immediately before invoking this script.
#

set -euo pipefail

# ---------- Colored logging ----------
if [ -t 1 ]; then
    C_GREEN=$'\033[1;32m'
    C_BLUE=$'\033[1;34m'
    C_YELLOW=$'\033[1;33m'
    C_RED=$'\033[1;31m'
    C_RESET=$'\033[0m'
else
    C_GREEN=""; C_BLUE=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi

log_step() { echo "${C_GREEN}==>${C_RESET} ${C_BLUE}$*${C_RESET}"; }
log_info() { echo "    $*"; }
log_skip() { echo "    ${C_YELLOW}skip:${C_RESET} $*"; }
log_err()  { echo "${C_RED}!!  $*${C_RESET}" >&2; }

# ---------- Arg handling ----------
ANDROID_HOME_DEFAULT="${HOME}/android-sdk"
ANDROID_HOME="${ANDROID_HOME_DEFAULT}"

while [ $# -gt 0 ]; do
    case "$1" in
        --sdk-dir)
            if [ $# -lt 2 ]; then
                log_err "--sdk-dir requires a path argument"
                exit 1
            fi
            ANDROID_HOME="$2"
            shift 2
            ;;
        --sdk-dir=*)
            ANDROID_HOME="${1#--sdk-dir=}"
            shift
            ;;
        -h|--help)
            sed -n '2,22p' "$0"
            exit 0
            ;;
        *)
            log_err "unknown argument: $1"
            exit 1
            ;;
    esac
done

export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# ---------- Pinned versions ----------
CMDLINE_TOOLS_ZIP="commandlinetools-linux-11076708_latest.zip"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP}"
SDK_PACKAGES=(
    "platform-tools"
    "platforms;android-33"
    "build-tools;33.0.2"
)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIRESTICK_DIR="${REPO_ROOT}/firestick-scout"
LOCAL_PROPERTIES="${FIRESTICK_DIR}/local.properties"

log_step "firestick-scout Android build environment installer"
log_info "ANDROID_HOME = ${ANDROID_HOME}"
log_info "repo root    = ${REPO_ROOT}"

# ---------- Step 1: OpenJDK 17 ----------
log_step "Step 1/5: Ensure OpenJDK 17 is installed"
if command -v java >/dev/null 2>&1 && java -version 2>&1 | grep -q 'version "17'; then
    log_skip "JDK 17 already installed ($(java -version 2>&1 | head -n1))"
else
    log_info "installing openjdk-17-jdk-headless and unzip via apt"
    sudo apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
        openjdk-17-jdk-headless \
        unzip \
        curl
fi

# Make sure unzip and curl are present even if java was already installed
if ! command -v unzip >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
    log_info "installing unzip / curl"
    sudo apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y unzip curl
fi

# ---------- Step 2: Android command-line tools ----------
log_step "Step 2/5: Ensure Android command-line tools are installed"
CMDLINE_LATEST="${ANDROID_HOME}/cmdline-tools/latest"
if [ -d "${CMDLINE_LATEST}" ] && [ -x "${CMDLINE_LATEST}/bin/sdkmanager" ]; then
    log_skip "cmdline-tools already present at ${CMDLINE_LATEST}"
else
    log_info "downloading ${CMDLINE_TOOLS_URL}"
    mkdir -p "${ANDROID_HOME}/cmdline-tools"
    TMPDIR_DL="$(mktemp -d)"
    trap 'rm -rf "${TMPDIR_DL}"' EXIT
    curl -fSL -o "${TMPDIR_DL}/${CMDLINE_TOOLS_ZIP}" "${CMDLINE_TOOLS_URL}"
    log_info "extracting cmdline-tools zip"
    unzip -q "${TMPDIR_DL}/${CMDLINE_TOOLS_ZIP}" -d "${TMPDIR_DL}/extract"
    # The zip contains a top-level `cmdline-tools/` dir; sdkmanager expects it
    # to be renamed to `latest`.
    mkdir -p "${CMDLINE_LATEST}"
    # Move contents (including hidden) into latest/
    mv "${TMPDIR_DL}/extract/cmdline-tools/"* "${CMDLINE_LATEST}/"
    rm -rf "${TMPDIR_DL}"
    trap - EXIT
fi

SDKMANAGER="${CMDLINE_LATEST}/bin/sdkmanager"
if [ ! -x "${SDKMANAGER}" ]; then
    log_err "sdkmanager not found at ${SDKMANAGER} after install"
    exit 1
fi

# ---------- Step 3: Accept SDK licenses ----------
log_step "Step 3/5: Accept Android SDK licenses"
LICENSES_DIR="${ANDROID_HOME}/licenses"
if [ -d "${LICENSES_DIR}" ] && [ -n "$(ls -A "${LICENSES_DIR}" 2>/dev/null || true)" ]; then
    log_skip "licenses directory already populated at ${LICENSES_DIR}"
else
    log_info "running: yes | sdkmanager --licenses"
    yes | "${SDKMANAGER}" --sdk_root="${ANDROID_HOME}" --licenses >/dev/null || true
fi

# ---------- Step 4: Install required SDK packages ----------
log_step "Step 4/5: Install required SDK packages"
INSTALLED_LIST="$("${SDKMANAGER}" --sdk_root="${ANDROID_HOME}" --list_installed 2>/dev/null || true)"

needs_install=()
for pkg in "${SDK_PACKAGES[@]}"; do
    # sdkmanager --list_installed prints the package id in the first column.
    if echo "${INSTALLED_LIST}" | awk '{print $1}' | grep -Fxq "${pkg}"; then
        log_skip "${pkg} already installed"
    else
        needs_install+=("${pkg}")
    fi
done

if [ "${#needs_install[@]}" -gt 0 ]; then
    log_info "installing: ${needs_install[*]}"
    yes | "${SDKMANAGER}" --sdk_root="${ANDROID_HOME}" "${needs_install[@]}"
else
    log_skip "all required SDK packages already installed"
fi

# ---------- Step 5: Write firestick-scout/local.properties ----------
log_step "Step 5/5: Configure firestick-scout/local.properties"
if [ ! -d "${FIRESTICK_DIR}" ]; then
    log_err "firestick-scout directory not found at ${FIRESTICK_DIR}"
    log_err "skipping local.properties write; clone the repo first"
else
    if [ -f "${LOCAL_PROPERTIES}" ] && grep -q "^sdk.dir=" "${LOCAL_PROPERTIES}"; then
        existing="$(grep '^sdk.dir=' "${LOCAL_PROPERTIES}" | head -n1)"
        log_skip "${LOCAL_PROPERTIES} already has ${existing}"
    else
        log_info "writing sdk.dir=${ANDROID_HOME} to ${LOCAL_PROPERTIES}"
        {
            echo "# Generated by scripts/install-android-build-env.sh"
            echo "sdk.dir=${ANDROID_HOME}"
        } > "${LOCAL_PROPERTIES}"
    fi
fi

# ---------- Final verification ----------
log_step "Verification"
echo "    java     : $(java -version 2>&1 | head -n1)"
echo "    javac    : $(javac -version 2>&1 | head -n1)"
if [ -x "${ANDROID_HOME}/platform-tools/adb" ]; then
    echo "    adb      : $(${ANDROID_HOME}/platform-tools/adb --version 2>&1 | head -n1)"
else
    echo "    adb      : ${C_RED}NOT FOUND${C_RESET}"
fi
echo "    sdkmanager: $(${SDKMANAGER} --version 2>&1 | head -n1)"
if [ -f "${LOCAL_PROPERTIES}" ]; then
    echo "    local.properties: $(grep '^sdk.dir=' "${LOCAL_PROPERTIES}" | head -n1)"
else
    echo "    local.properties: ${C_YELLOW}not written (firestick-scout dir missing)${C_RESET}"
fi

log_step "Done. You can now build the APK from ${FIRESTICK_DIR}"
