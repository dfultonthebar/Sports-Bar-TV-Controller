#!/bin/bash
# build-autoinstall-iso.sh — Sports Bar TV Controller v3.1.0
#
# Builds a custom Ubuntu 24.04.4 LTS server autoinstall ISO. Replaces the
# v3.0.1 hand-rolled debootstrap + disk-installer.sh chain that hit 7 bug
# iterations on 2026-05-27 (parted/unsquashfs/grub silent fails/kernel
# copy/bios_boot partition/...). v3.1 architecture:
#
#   1. Download stock Ubuntu Server 24.04.4 ISO (cached)
#   2. 7z-extract it to a working dir
#   3. Inject /server/{user-data,meta-data} (subiquity autoinstall config)
#   4. Inject /sports-bar/{first-boot-fresh.sh,sports-bar-first-boot.service}
#   5. Edit grub.cfg + isolinux.cfg to add the autoinstall kernel arg
#   6. xorriso-repack the dir back into a bootable BIOS+UEFI hybrid ISO
#
# Curtin (subiquity's installer engine) handles ALL the things our hand-rolled
# disk-installer.sh was failing at: GPT+bios_boot+EFI partitioning, fstab UUIDs,
# kernel install + initramfs regen, GRUB embed for BIOS and UEFI both.
#
# Requirements on build host (Ubuntu 22.04+):
#   sudo apt-get install -y p7zip-full xorriso openssl wget
#
# Usage:
#   bash scripts/iso/build-autoinstall-iso.sh
#   bash scripts/iso/build-autoinstall-iso.sh --build-dir /tmp/iso-build
#   bash scripts/iso/build-autoinstall-iso.sh --skip-download   # reuse cached stock ISO
#   bash scripts/iso/build-autoinstall-iso.sh --password mypass # set ubuntu user password

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────
VERSION="v3.1.0"
UBUNTU_VERSION="24.04.4"
UBUNTU_CODENAME="noble"
STOCK_ISO_NAME="ubuntu-${UBUNTU_VERSION}-live-server-amd64.iso"
STOCK_ISO_URL="https://releases.ubuntu.com/${UBUNTU_CODENAME}/${STOCK_ISO_NAME}"
STOCK_ISO_SHA256_URL="https://releases.ubuntu.com/${UBUNTU_CODENAME}/SHA256SUMS"

BUILD_DIR="${BUILD_DIR:-/home/ubuntu/iso-autoinstall-build}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

OUTPUT_ISO_NAME="sports-bar-tv-controller-${VERSION}-$(date +%Y-%m-%d).iso"
OUTPUT_ISO="/home/ubuntu/${OUTPUT_ISO_NAME}"
ISO_CACHE_DIR="/home/ubuntu/iso-cache"

# v2.55.3: default to the FLEET-STANDARD password (operator rule: every box
# is ubuntu / 6809233DjD$$). Single-quoted so the $$ stays literal (not PID).
# Override with --password for one-off test builds.
UBUNTU_PASSWORD="${UBUNTU_PASSWORD:-}"
[ -z "$UBUNTU_PASSWORD" ] && UBUNTU_PASSWORD='6809233DjD$$'
SKIP_DOWNLOAD=false

# ─── Arg parsing ───────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
    case "$1" in
        --build-dir) BUILD_DIR="$2"; shift 2 ;;
        --skip-download) SKIP_DOWNLOAD=true; shift ;;
        --password) UBUNTU_PASSWORD="$2"; shift 2 ;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \?//' | head -30
            exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

# ─── Helpers ───────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
step() { echo -e "\n${BOLD}${GREEN}=== $* ===${NC}\n"; }

# ─── Banner ────────────────────────────────────────────────────────────────
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Sports Bar TV Controller — Autoinstall ISO Builder ${VERSION}${NC}"
echo -e "${BOLD}============================================================${NC}"
echo
echo "  Stock base:   Ubuntu Server ${UBUNTU_VERSION} (${UBUNTU_CODENAME})"
echo "  Output ISO:   ${OUTPUT_ISO}"
echo "  Build dir:    ${BUILD_DIR}"
echo "  ISO cache:    ${ISO_CACHE_DIR}"
echo

# ─── Step 0: Prereq check ──────────────────────────────────────────────────
step "Step 0/6: Prerequisite check"
MISSING=()
for tool in 7z xorriso wget openssl; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        MISSING+=("$tool")
    fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
    err "Missing tools: ${MISSING[*]}"
    err "Install with: sudo apt-get install -y p7zip-full xorriso wget openssl"
    exit 1
fi
log "All build tools present: 7z xorriso wget openssl"

# Also need our two payload files
PAYLOAD_FIRST_BOOT="${SCRIPT_DIR}/first-boot-fresh.sh"
PAYLOAD_SERVICE="${SCRIPT_DIR}/sports-bar-first-boot.service"
PAYLOAD_AUTOINSTALL="${SCRIPT_DIR}/autoinstall.yaml.template"
for f in "$PAYLOAD_FIRST_BOOT" "$PAYLOAD_SERVICE" "$PAYLOAD_AUTOINSTALL"; do
    [ -f "$f" ] || { err "Missing payload: $f"; exit 1; }
done
log "Payload files present"

# ─── Step 1: Download stock ISO (cached) ───────────────────────────────────
step "Step 1/6: Stock Ubuntu Server ISO"
mkdir -p "$ISO_CACHE_DIR"
STOCK_ISO_PATH="${ISO_CACHE_DIR}/${STOCK_ISO_NAME}"

if [ "$SKIP_DOWNLOAD" = "true" ] && [ -f "$STOCK_ISO_PATH" ]; then
    log "Reusing cached stock ISO: $STOCK_ISO_PATH"
elif [ -f "$STOCK_ISO_PATH" ]; then
    log "Cached stock ISO found: $STOCK_ISO_PATH ($(du -h "$STOCK_ISO_PATH" | cut -f1))"
    log "(Use --skip-download to force-reuse without re-verify)"

    # Verify sha256 against upstream
    log "Verifying sha256 against ${STOCK_ISO_SHA256_URL}..."
    EXPECTED_SHA=$(wget -qO- "$STOCK_ISO_SHA256_URL" | grep "$STOCK_ISO_NAME" | awk '{print $1}')
    if [ -z "$EXPECTED_SHA" ]; then
        warn "Could not fetch expected sha256 (network down?). Skipping verify."
    else
        ACTUAL_SHA=$(sha256sum "$STOCK_ISO_PATH" | awk '{print $1}')
        if [ "$EXPECTED_SHA" = "$ACTUAL_SHA" ]; then
            log "sha256 OK: $ACTUAL_SHA"
        else
            warn "sha256 mismatch — re-downloading"
            rm -f "$STOCK_ISO_PATH"
        fi
    fi
fi

if [ ! -f "$STOCK_ISO_PATH" ]; then
    log "Downloading stock ISO (~3 GB, may take 5-20 min)..."
    wget -O "$STOCK_ISO_PATH" "$STOCK_ISO_URL" || { err "Download failed"; rm -f "$STOCK_ISO_PATH"; exit 1; }
    log "Download complete: $(du -h "$STOCK_ISO_PATH" | cut -f1)"
fi

# ─── Step 2: Extract stock ISO ─────────────────────────────────────────────
step "Step 2/6: Extract stock ISO"

# Clean prior build dir
if [ -d "$BUILD_DIR" ]; then
    log "Removing prior build dir: $BUILD_DIR"
    sudo rm -rf "$BUILD_DIR"
fi
mkdir -p "$BUILD_DIR"

cd "$BUILD_DIR"
log "Extracting via 7z (this takes ~30-60s)..."
7z -y x "$STOCK_ISO_PATH" -osource-files >/dev/null
log "Extracted. Contents:"
ls source-files/ | head -10

# Move [BOOT] dir out so xorriso can re-use the boot images
if [ -d "source-files/[BOOT]" ]; then
    mv "source-files/[BOOT]" BOOT
    log "Boot images preserved at: ${BUILD_DIR}/BOOT/"
else
    err "Expected [BOOT] dir in extracted ISO — not found"
    ls -la source-files/ | head
    exit 1
fi

# ─── Step 3: Build autoinstall.yaml from template ──────────────────────────
step "Step 3/6: Build autoinstall.yaml from template"
mkdir -p "${BUILD_DIR}/source-files/server"

# Hash the ubuntu password with sha512
log "Hashing password with openssl sha512..."
PASSWORD_HASH=$(openssl passwd -6 -salt "$(openssl rand -hex 8)" "$UBUNTU_PASSWORD")
log "Hash: ${PASSWORD_HASH:0:30}..."

# Substitute the placeholder in the template
sed "s|{{UBUNTU_PASSWORD_HASH}}|${PASSWORD_HASH}|g" \
    "$PAYLOAD_AUTOINSTALL" > "${BUILD_DIR}/source-files/server/user-data"
touch "${BUILD_DIR}/source-files/server/meta-data"
log "user-data written: ${BUILD_DIR}/source-files/server/user-data"
log "meta-data (empty): ${BUILD_DIR}/source-files/server/meta-data"

# ─── Step 4: Inject our payload (first-boot script + systemd unit) ────────
step "Step 4/6: Inject sports-bar payload"
mkdir -p "${BUILD_DIR}/source-files/sports-bar"
cp "$PAYLOAD_FIRST_BOOT"  "${BUILD_DIR}/source-files/sports-bar/first-boot-fresh.sh"
cp "$PAYLOAD_SERVICE"     "${BUILD_DIR}/source-files/sports-bar/sports-bar-first-boot.service"
chmod +x "${BUILD_DIR}/source-files/sports-bar/first-boot-fresh.sh"
log "Payload: $(ls "${BUILD_DIR}/source-files/sports-bar/")"

# ─── Step 5: Add autoinstall entry to grub.cfg (BIOS+UEFI both) ────────────
step "Step 5/6: Add autoinstall entry to grub.cfg"

GRUB_CFG="${BUILD_DIR}/source-files/boot/grub/grub.cfg"
[ -f "$GRUB_CFG" ] || { err "grub.cfg not found at $GRUB_CFG"; exit 1; }

# v2.54.92: rewrite grub.cfg ENTIRELY using a single-quoted heredoc.
# Single-quoted EOF disables ALL shell escaping — guarantees the kernel
# cmdline lands on disk exactly as written, no awk/sed escape bugs.
#
# Uses QUOTED form for ds=nocloud — Grok + research agent both confirmed
# this is immune to escape-strip bugs (the v1 build had `\;` get stripped
# by awk -v, breaking GRUB's understanding of the kernel cmdline).
#
# timeout=0 + default=0 = TRULY hands-off (no key press needed).
# Stock 24.04.4 menuentries kept BELOW ours as fallback if operator
# needs to interrupt boot.
log "Writing new grub.cfg with autoinstall as default (truly hands-off)..."
# Preserve the upstream entries (set as fallback after ours)
UPSTREAM_GRUB=$(cat "$GRUB_CFG")
cat > "$GRUB_CFG" << 'GRUB_EOF'
set timeout=0
set default=0
loadfont unicode
set menu_color_normal=white/black
set menu_color_highlight=black/light-gray

menuentry "Sports Bar TV Controller — Autoinstall (default)" {
    set gfxpayload=keep
    linux   /casper/vmlinuz quiet autoinstall "ds=nocloud;s=/cdrom/server/" ---
    initrd  /casper/initrd
}

GRUB_EOF
# Append upstream fallback entries (Try/Install Ubuntu, HWE kernel, etc) — strip their original `set timeout` + `set default` lines so ours wins
echo "$UPSTREAM_GRUB" | grep -vE '^(set timeout|set default)' >> "$GRUB_CFG"
log "grub.cfg rewritten — quoted ds=nocloud form + timeout=0 + default=0"

# Validation BEFORE xorriso — catches escape bugs immediately
log "Validating grub.cfg + user-data on disk before repack..."
echo "  --- grub.cfg autoinstall menuentry ---"
grep -A 4 'Sports Bar TV Controller' "$GRUB_CFG" | head -6 | sed 's/^/    /'
if ! grep -qE 'autoinstall.*ds=nocloud.*s=/cdrom/server/' "$GRUB_CFG"; then
    err "grub.cfg validation FAILED: autoinstall + ds=nocloud + /cdrom/server/ not all present on same line"
    err "The line:"
    grep autoinstall "$GRUB_CFG" | head -3 | sed 's/^/    /' >&2
    exit 1
fi
log "grub.cfg validation PASS"

echo "  --- user-data first 20 lines ---"
head -20 "${BUILD_DIR}/source-files/server/user-data" | sed 's/^/    /'
if ! head -1 "${BUILD_DIR}/source-files/server/user-data" | grep -q '^#cloud-config'; then
    err "user-data MUST start with '#cloud-config' header"
    exit 1
fi
if ! grep -qE '^autoinstall:' "${BUILD_DIR}/source-files/server/user-data"; then
    err "user-data MUST contain top-level 'autoinstall:' key"
    exit 1
fi
log "user-data validation PASS"

# ─── Step 6: Repack as BIOS+UEFI hybrid bootable ISO ───────────────────────
step "Step 6/6: Repack with xorriso (BIOS+UEFI hybrid bootable)"

cd "${BUILD_DIR}/source-files"

# Verify boot images exist before xorriso
[ -f "../BOOT/1-Boot-NoEmul.img" ] || { err "Missing ../BOOT/1-Boot-NoEmul.img"; exit 1; }
[ -f "../BOOT/2-Boot-NoEmul.img" ] || { err "Missing ../BOOT/2-Boot-NoEmul.img"; exit 1; }

log "Running xorriso (this takes ~1-3 min)..."
xorriso -as mkisofs -r \
    -V "SPORTSBAR ${VERSION}" \
    -o "$OUTPUT_ISO" \
    --grub2-mbr "../BOOT/1-Boot-NoEmul.img" \
    -partition_offset 16 \
    --mbr-force-bootable \
    -append_partition 2 28732ac11ff8d211ba4b00a0c93ec93b "../BOOT/2-Boot-NoEmul.img" \
    -appended_part_as_gpt \
    -iso_mbr_part_type a2a0d0ebe5b9334487c068b6b72699c7 \
    -c '/boot.catalog' \
    -b '/boot/grub/i386-pc/eltorito.img' \
        -no-emul-boot -boot-load-size 4 -boot-info-table --grub2-boot-info \
    -eltorito-alt-boot \
    -e '--interval:appended_partition_2:::' \
    -no-emul-boot \
    . 2>&1 | tail -20

if [ ! -f "$OUTPUT_ISO" ]; then
    err "xorriso did not produce output ISO"
    exit 1
fi

SIZE=$(du -h "$OUTPUT_ISO" | cut -f1)
MD5=$(md5sum "$OUTPUT_ISO" | awk '{print $1}')
SHA256=$(sha256sum "$OUTPUT_ISO" | awk '{print $1}')

# Write checksum files for verification
echo "${MD5}  ${OUTPUT_ISO_NAME}" > "${OUTPUT_ISO}.md5"
echo "${SHA256}  ${OUTPUT_ISO_NAME}" > "${OUTPUT_ISO}.sha256"

# ─── Final banner ──────────────────────────────────────────────────────────
echo
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  BUILD COMPLETE!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo
echo "  ISO:    $OUTPUT_ISO ($SIZE)"
echo "  MD5:    $MD5"
echo "  SHA256: $SHA256"
echo
echo "  Default user: ubuntu / ${UBUNTU_PASSWORD}"
echo "  Default hostname: sports-bar-controller (interactive override)"
echo
echo "Next steps:"
echo "  1. Verify: md5sum -c ${OUTPUT_ISO}.md5"
echo "  2. Test VM (Proxmox): qm set <vmid> -ide2 local:iso/${OUTPUT_ISO_NAME},media=cdrom"
echo "  3. Write USB: sudo dd if=${OUTPUT_ISO} of=/dev/sdX bs=4M status=progress oflag=sync"
echo
