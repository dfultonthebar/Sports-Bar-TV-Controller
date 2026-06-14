#!/bin/bash
#
# Sports Bar TV Controller — OS Hygiene + Trim (v2.54.60)
#
# Idempotent script that brings every fleet box (Intel NUC, headless,
# Ubuntu 24.04/22.04) into the documented optimal state for the
# Next.js + PM2 + Nginx + IPEX-LLM Ollama + SQLite + rtl_sdr + adb +
# Tailscale workload.
#
# Modeled on scripts/enforce-gotcha11-hardening.sh — set -e + ERR trap,
# distinct exit codes per layer, color PASS/SKIP/FAIL.
#
# What it does (all idempotent — safe to re-run every fleet sync):
#   1. journald retention cap (500 MB, 14d) — bounds log growth on iGPU
#      boxes where Ollama already pressures 16+ GB RAM
#   2. vm.swappiness=10 + vm.vfs_cache_pressure=50 — IPEX-LLM Ollama is
#      a heavy resident set; default swappiness=60 thrashes
#   3. Disable services with no hardware/use on the fleet:
#      ModemManager, apport, whoopsie, motd-news.timer,
#      apt-daily-upgrade.timer (we have auto-update.sh — Standing Rule #6)
#   4. Purge old kernel images (keep running + latest only)
#   5. Sweep caches: apt clean, npm cache clean, pip cache purge,
#      /tmp/*.log older than 3 days
#   6. Purge sports-bar-data/backups/pre-update-*.db older than 14d
#      (closes the unbounded-growth gap that produced 81 GB of backups
#      on Holmgren — see v2.54.60 ship notes)
#
# What it does NOT do (operator decision required, see ship notes):
#   - snapd removal (5-7 GB but may break Chromium snap usage)
#   - xrdp removal (no active sessions but operator may RDP in)
#   - Ollama model audit (Standing Rule #10: every model stays latest)
#
# Usage:
#   sudo bash scripts/optimize-os.sh           # apply
#   sudo bash scripts/optimize-os.sh --check   # dry-run, exit 0 if all OK
#
# Wired into:
#   - install.sh (PHASE 13, runs after Gotcha #11 hardening)
#   - auto-update.sh (called on weekly checkpoint to keep fleet drift-free)
#   - verify-install.sh (--check mode confirms applied state)

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

CHECK_MODE=false
if [ "${1:-}" = "--check" ]; then
    CHECK_MODE=true
fi

LAYER=""
trap 'echo -e "${RED}✗ FAILED at layer: $LAYER${NC}"; exit 99' ERR

pass()  { echo -e "  ${GREEN}✓ $*${NC}"; }
skip()  { echo -e "  ${YELLOW}⊝ $*${NC}"; }
fail()  { echo -e "  ${RED}✗ $*${NC}"; }
info()  { echo -e "  ${CYAN}ⓘ $*${NC}"; }
layer() { LAYER="$1"; echo -e "\n${BOLD}${CYAN}▸ $1${NC}"; }

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root (sudo bash $0)"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
layer "Layer 1: journald retention cap (500 MB, 14 days)"

JOURNALD_DROPIN=/etc/systemd/journald.conf.d/99-fleet-trim.conf
DESIRED_CONFIG="[Journal]
SystemMaxUse=500M
SystemKeepFree=2G
MaxRetentionSec=14day
"

if [ -f "$JOURNALD_DROPIN" ] && diff -q <(echo "$DESIRED_CONFIG") "$JOURNALD_DROPIN" >/dev/null 2>&1; then
    skip "journald drop-in already in place"
else
    if $CHECK_MODE; then
        fail "journald drop-in missing or stale: $JOURNALD_DROPIN"
        exit 2
    fi
    mkdir -p "$(dirname "$JOURNALD_DROPIN")"
    echo "$DESIRED_CONFIG" > "$JOURNALD_DROPIN"
    systemctl restart systemd-journald
    journalctl --vacuum-time=14d >/dev/null 2>&1 || true
    pass "journald capped at 500 MB / 14 days"
fi

# ─────────────────────────────────────────────────────────────────────────────
layer "Layer 2: vm.swappiness=10 + vm.vfs_cache_pressure=50"

SYSCTL_DROPIN=/etc/sysctl.d/99-fleet-memory.conf
DESIRED_SYSCTL="vm.swappiness=10
vm.vfs_cache_pressure=50
"
if [ -f "$SYSCTL_DROPIN" ] && diff -q <(echo "$DESIRED_SYSCTL") "$SYSCTL_DROPIN" >/dev/null 2>&1; then
    skip "sysctl drop-in already in place"
else
    if $CHECK_MODE; then
        fail "sysctl drop-in missing: $SYSCTL_DROPIN"
        exit 3
    fi
    echo "$DESIRED_SYSCTL" > "$SYSCTL_DROPIN"
    sysctl -p "$SYSCTL_DROPIN" >/dev/null
    pass "swappiness=10, vfs_cache_pressure=50 set (live + persistent)"
fi

# ─────────────────────────────────────────────────────────────────────────────
layer "Layer 3: disable always-on bloat services"

# Services that fire but do nothing useful on a headless NUC. Disable
# the service unit (not purge) — leaves the package installed so an
# operator can re-enable interactively without re-apt.
SERVICES_TO_DISABLE=(
    ModemManager.service           # no cellular modem hardware
    apport.service                 # crash GUI, headless box
    whoopsie.service               # Ubuntu error daemon, headless
    motd-news.timer                # remote-news MOTD — server doesn't show MOTD
    apt-daily-upgrade.timer        # we have auto-update.sh (Standing Rule #6)
    apt-daily.timer                # noisy cousin of above
    cups-browsed.service           # printer discovery, no printers
)

for svc in "${SERVICES_TO_DISABLE[@]}"; do
    if ! systemctl list-unit-files "$svc" --no-pager 2>/dev/null | grep -q "$svc"; then
        skip "$svc not installed"
        continue
    fi
    if systemctl is-enabled "$svc" >/dev/null 2>&1; then
        if $CHECK_MODE; then
            fail "$svc still enabled"
            exit 4
        fi
        systemctl disable --now "$svc" 2>/dev/null || true
        pass "$svc disabled + stopped"
    else
        skip "$svc already disabled"
    fi
done

# motd-news also has an ENABLED= flag in /etc/default/motd-news
if [ -f /etc/default/motd-news ]; then
    if grep -q "^ENABLED=1" /etc/default/motd-news; then
        if $CHECK_MODE; then fail "motd-news ENABLED=1"; exit 5; fi
        sed -i 's/^ENABLED=1/ENABLED=0/' /etc/default/motd-news
        pass "motd-news ENABLED=0 in /etc/default/motd-news"
    else
        skip "motd-news already ENABLED=0"
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
layer "Layer 4: purge old kernel images (keep running + latest)"

RUNNING_KERNEL=$(uname -r)
LATEST_KERNEL=$(dpkg-query -W -f='${Package}\n' 'linux-image-*-generic' 2>/dev/null \
    | sed 's/linux-image-//;s/-generic$//' | sort -V | tail -1)

OLD_KERNELS=$(dpkg-query -W -f='${Package}\n' 'linux-image-*-generic' 'linux-modules-*-generic' 'linux-modules-extra-*-generic' 'linux-headers-*-generic' 2>/dev/null \
    | grep -v -E "^linux-(image|modules|modules-extra|headers)-${RUNNING_KERNEL}$" \
    | grep -v -E "^linux-(image|modules|modules-extra|headers)-${LATEST_KERNEL}$" \
    | grep -v -E "^linux-(image|modules|modules-extra|headers)-generic$" \
    || true)

if [ -z "$OLD_KERNELS" ]; then
    skip "no old kernel images to purge (running=$RUNNING_KERNEL, latest=$LATEST_KERNEL)"
else
    OLD_COUNT=$(echo "$OLD_KERNELS" | wc -l)
    info "$OLD_COUNT old kernel packages found:"
    echo "$OLD_KERNELS" | sed 's/^/    /'
    if $CHECK_MODE; then
        fail "$OLD_COUNT old kernel packages still present"
        exit 6
    fi
    # shellcheck disable=SC2086
    DEBIAN_FRONTEND=noninteractive apt-get -y purge $OLD_KERNELS >/dev/null 2>&1
    apt-get -y autoremove --purge >/dev/null 2>&1
    pass "purged $OLD_COUNT old kernel packages"
fi

# ─────────────────────────────────────────────────────────────────────────────
layer "Layer 5: sweep caches (apt + npm + pip + /tmp logs + snap cache)"

# apt cache
APT_CACHE_BEFORE=$(du -sb /var/cache/apt/archives 2>/dev/null | awk '{print $1}' || echo 0)
if [ "$APT_CACHE_BEFORE" -gt 10485760 ]; then  # >10 MB
    if $CHECK_MODE; then
        info "apt cache: $(($APT_CACHE_BEFORE / 1024 / 1024)) MB (would clean)"
    else
        apt-get clean >/dev/null
        pass "apt cache cleared ($(($APT_CACHE_BEFORE / 1024 / 1024)) MB)"
    fi
else
    skip "apt cache already small ($(($APT_CACHE_BEFORE / 1024 / 1024)) MB)"
fi

# npm cache (per ubuntu user)
NPM_CACHE_BEFORE=$(sudo -u ubuntu du -sb /home/ubuntu/.npm 2>/dev/null | awk '{print $1}' || echo 0)
if [ "$NPM_CACHE_BEFORE" -gt 1073741824 ]; then  # >1 GB
    if $CHECK_MODE; then
        info "npm cache: $(($NPM_CACHE_BEFORE / 1024 / 1024)) MB (would clean)"
    else
        sudo -u ubuntu npm cache clean --force >/dev/null 2>&1 || true
        pass "npm cache cleared ($(($NPM_CACHE_BEFORE / 1024 / 1024)) MB)"
    fi
else
    skip "npm cache already small"
fi

# pip cache (per ubuntu user)
if [ -d /home/ubuntu/.cache/pip ]; then
    PIP_CACHE_BEFORE=$(du -sb /home/ubuntu/.cache/pip 2>/dev/null | awk '{print $1}' || echo 0)
    if [ "$PIP_CACHE_BEFORE" -gt 524288000 ]; then  # >500 MB
        if $CHECK_MODE; then
            info "pip cache: $(($PIP_CACHE_BEFORE / 1024 / 1024)) MB (would clean)"
        else
            rm -rf /home/ubuntu/.cache/pip
            pass "pip cache cleared ($(($PIP_CACHE_BEFORE / 1024 / 1024)) MB)"
        fi
    else
        skip "pip cache already small"
    fi
fi

# /tmp logs older than 3 days
OLD_TMP_LOGS=$(find /tmp -maxdepth 1 -name '*.log' -mtime +3 2>/dev/null | wc -l)
if [ "$OLD_TMP_LOGS" -gt 0 ]; then
    if $CHECK_MODE; then
        info "$OLD_TMP_LOGS /tmp/*.log older than 3 days (would delete)"
    else
        find /tmp -maxdepth 1 -name '*.log' -mtime +3 -delete 2>/dev/null || true
        pass "$OLD_TMP_LOGS /tmp/*.log older than 3 days deleted"
    fi
else
    skip "no stale /tmp/*.log files"
fi

# snap disabled-revision cache (if snapd present)
if [ -d /var/lib/snapd/cache ]; then
    SNAP_CACHE_BEFORE=$(du -sb /var/lib/snapd/cache 2>/dev/null | awk '{print $1}' || echo 0)
    if [ "$SNAP_CACHE_BEFORE" -gt 524288000 ]; then  # >500 MB
        if $CHECK_MODE; then
            info "snap cache: $(($SNAP_CACHE_BEFORE / 1024 / 1024)) MB (would clean)"
        else
            rm -rf /var/lib/snapd/cache/* 2>/dev/null || true
            pass "snap cache cleared ($(($SNAP_CACHE_BEFORE / 1024 / 1024)) MB)"
        fi
    else
        skip "snap cache already small"
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
layer "Layer 6: purge pre-update DB backups older than 14 days"

BACKUP_DIR=/home/ubuntu/sports-bar-data/backups
if [ -d "$BACKUP_DIR" ]; then
    OLD_BACKUPS=$(find "$BACKUP_DIR" -name 'pre-update-*.db' -mtime +14 2>/dev/null | wc -l)
    if [ "$OLD_BACKUPS" -gt 0 ]; then
        TOTAL_BYTES=$(find "$BACKUP_DIR" -name 'pre-update-*.db' -mtime +14 -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')
        if $CHECK_MODE; then
            info "$OLD_BACKUPS pre-update backups older than 14d ($((TOTAL_BYTES / 1024 / 1024)) MB)"
        else
            find "$BACKUP_DIR" -name 'pre-update-*.db' -mtime +14 -delete 2>/dev/null || true
            pass "purged $OLD_BACKUPS old pre-update backups ($((TOTAL_BYTES / 1024 / 1024)) MB)"
        fi
    else
        skip "no pre-update backups older than 14 days"
    fi
else
    skip "no backups dir at $BACKUP_DIR"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo
if $CHECK_MODE; then
    echo -e "${GREEN}${BOLD}✓ optimize-os.sh: all layers in desired state${NC}"
else
    echo -e "${GREEN}${BOLD}✓ optimize-os.sh: complete${NC}"
    DF_AFTER=$(df -BG / | tail -1 | awk '{print $4}')
    echo -e "  Disk free after sweep: ${BOLD}$DF_AFTER${NC}"
fi
