#!/bin/bash
#
# Sports Bar TV Controller - ISO Builder v3.0
#
# Creates a bootable ISO with install modes:
#   1. Install        - clones from GitHub + setup wizard
#   2. Live (No Install) - boot into RAM for testing
#   3. Safe Mode      - nomodeset for display compatibility
#
# Usage:
#   sudo ./build-sports-bar-iso.sh [--skip-snapshot] [--no-upload] [--build-dir /path]
#
# Run on: Leg Lamp server ONLY (this server's DB is baked into snapshot mode)
# DO NOT run on Graystone — that is a separate server, completely unaffected.
#

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
info() { echo -e "${CYAN}[i]${NC} $*"; }
step() { echo -e "\n${BOLD}${GREEN}=== $* ===${NC}"; }

# ─── Configuration ────────────────────────────────────────────────────────────
BUILD_DATE=$(date +%Y-%m-%d)
VERSION="v3.0"
ISO_NAME="sports-bar-tv-controller-${VERSION}-${BUILD_DATE}.iso"

BUILD_DIR="${BUILD_DIR:-/home/ubuntu/iso-build}"
CHROOT_DIR="${BUILD_DIR}/chroot"
ISO_STAGING="${BUILD_DIR}/iso"
LOG_FILE="${BUILD_DIR}/build-${BUILD_DATE}.log"

# Source paths (on THIS server - Leg Lamp)
APP_SOURCE="/home/ubuntu/Sports-Bar-TV-Controller"
DB_SOURCE="/home/ubuntu/sports-bar-data/production.db"
SCRIPTS_SOURCE="$(cd "$(dirname "$0")" && pwd)"

# Chroot paths
SNAPSHOT_DIR="/opt/sports-bar-snapshot"    # Inside chroot

# Ubuntu 22.04 LTS
UBUNTU_SUITE="jammy"
UBUNTU_MIRROR="http://archive.ubuntu.com/ubuntu"

# ─── Flags ────────────────────────────────────────────────────────────────────
SKIP_SNAPSHOT=false
NO_UPLOAD=false
SKIP_DEBOOTSTRAP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-snapshot)   SKIP_SNAPSHOT=true; shift ;;
        --no-upload)       NO_UPLOAD=true; shift ;;
        --skip-debootstrap) SKIP_DEBOOTSTRAP=true; shift ;;  # Resume after failed build
        --build-dir)       BUILD_DIR="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: sudo $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-snapshot     Skip baking app/DB into ISO (fresh-mode only)"
            echo "  --no-upload         Build ISO but don't upload to GitHub Releases"
            echo "  --skip-debootstrap  Resume build (skip debootstrap if chroot exists)"
            echo "  --build-dir <path>  Custom build directory (default: /home/ubuntu/iso-build)"
            echo ""
            echo "Environment:"
            echo "  BUILD_DIR           Override build directory"
            exit 0 ;;
        *)
            err "Unknown option: $1"; exit 1 ;;
    esac
done

# ─── Reconfigure variables after flag parsing ─────────────────────────────────
CHROOT_DIR="${BUILD_DIR}/chroot"
ISO_STAGING="${BUILD_DIR}/iso"
LOG_FILE="${BUILD_DIR}/build-${BUILD_DATE}.log"

# ─── Redirect output ──────────────────────────────────────────────────────────
mkdir -p "$BUILD_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Sports Bar TV Controller - ISO Builder ${VERSION}${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
echo "  Build date:    $BUILD_DATE"
echo "  ISO name:      $ISO_NAME"
echo "  Build dir:     $BUILD_DIR"
echo "  Skip snapshot: $SKIP_SNAPSHOT"
echo "  No upload:     $NO_UPLOAD"
echo ""

# ─── Must run as root ─────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    err "This script must be run as root: sudo $0"
    exit 1
fi

# ─── Cleanup trap ─────────────────────────────────────────────────────────────
cleanup_mounts() {
    log "Cleaning up mounts..."
    for mnt in proc sys dev/pts dev; do
        umount -lf "${CHROOT_DIR}/${mnt}" 2>/dev/null || true
    done
}
trap cleanup_mounts EXIT

# ═════════════════════════════════════════════════════════════════════════════
# STEP 0: Preflight Checks
# ═════════════════════════════════════════════════════════════════════════════
step "Step 0/10: Preflight Checks"

# Disk space check (100GB recommended for build)
AVAIL_GB=$(df -BG "$BUILD_DIR" | tail -1 | awk '{print $4}' | tr -d 'G')
if [ "${AVAIL_GB}" -lt 20 ]; then
    err "Insufficient disk space: ${AVAIL_GB}GB available, 20GB minimum required."
    exit 1
elif [ "${AVAIL_GB}" -lt 100 ]; then
    warn "Low disk space: ${AVAIL_GB}GB available. Recommended: 100GB+"
    if [ -t 0 ]; then
        read -p "  Continue anyway? (y/N): " -n 1 -r; echo ""
        [[ $REPLY =~ ^[Yy]$ ]] || exit 1
    fi
else
    log "Disk space: ${AVAIL_GB}GB available — OK"
fi

# Required tools
REQUIRED_TOOLS=(debootstrap xorriso mksquashfs grub-mkstandalone)
MISSING_TOOLS=()

for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" &>/dev/null; then
        MISSING_TOOLS+=("$tool")
    fi
done

# Map tools to packages for install hint
declare -A TOOL_PACKAGES=(
    [debootstrap]="debootstrap"
    [xorriso]="xorriso"
    [mksquashfs]="squashfs-tools"
    [grub-mkstandalone]="grub-efi-amd64-bin grub-pc-bin"
)

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    err "Missing required tools: ${MISSING_TOOLS[*]}"
    echo ""
    echo "Install with:"
    echo "  sudo apt install debootstrap xorriso squashfs-tools grub-efi-amd64-bin grub-pc-bin isolinux"
    exit 1
fi

# Check for isolinux files (BIOS boot)
ISOLINUX_BIN=""
for candidate in /usr/lib/ISOLINUX/isolinux.bin /usr/lib/syslinux/isolinux.bin; do
    if [ -f "$candidate" ]; then
        ISOLINUX_BIN="$candidate"
        break
    fi
done
if [ -z "$ISOLINUX_BIN" ]; then
    err "isolinux.bin not found. Install: sudo apt install isolinux"
    exit 1
fi

ISOHDPFX_BIN=""
for candidate in /usr/lib/ISOLINUX/isohdpfx.bin /usr/lib/syslinux/isohdpfx.bin; do
    if [ -f "$candidate" ]; then
        ISOHDPFX_BIN="$candidate"
        break
    fi
done

# Check app source
if [ ! -d "$APP_SOURCE/.git" ]; then
    err "App source not found at $APP_SOURCE (expected a git repo)"
    exit 1
fi

# Check DB source (only required for snapshot mode)
if [ "$SKIP_SNAPSHOT" = false ] && [ ! -f "$DB_SOURCE" ]; then
    warn "Database not found at $DB_SOURCE — snapshot will have no DB baked in."
fi

# Check first-boot scripts
if [ ! -f "${SCRIPTS_SOURCE}/first-boot-fresh.sh" ] || [ ! -f "${SCRIPTS_SOURCE}/first-boot-snapshot.sh" ]; then
    err "First-boot scripts not found in $SCRIPTS_SOURCE"
    err "Expected: first-boot-fresh.sh, first-boot-snapshot.sh"
    exit 1
fi

log "All preflight checks passed."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 1: Debootstrap - Clean Ubuntu 22.04 Base
# ═════════════════════════════════════════════════════════════════════════════
step "Step 1/10: Building Clean Ubuntu 22.04 Base (debootstrap)"

if [ "$SKIP_DEBOOTSTRAP" = true ] && [ -d "${CHROOT_DIR}/usr" ]; then
    log "Skipping debootstrap — existing chroot found."
else
    rm -rf "${CHROOT_DIR}"
    mkdir -p "${CHROOT_DIR}"

    log "Running debootstrap (Ubuntu ${UBUNTU_SUITE})..."
    debootstrap \
        --arch=amd64 \
        --components=main,restricted,universe,multiverse \
        "${UBUNTU_SUITE}" \
        "${CHROOT_DIR}" \
        "${UBUNTU_MIRROR}" 2>&1

    log "Base system created."
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 2: Mount chroot filesystems
# ═════════════════════════════════════════════════════════════════════════════
step "Step 2/10: Preparing chroot environment"

mount -t proc  none "${CHROOT_DIR}/proc"
mount -t sysfs none "${CHROOT_DIR}/sys"
mount -o bind  /dev "${CHROOT_DIR}/dev"
mount -t devpts none "${CHROOT_DIR}/dev/pts"

# Helper: run commands in chroot as root
chr() { chroot "${CHROOT_DIR}" /bin/bash -c "$*"; }

# Configure APT sources
cat > "${CHROOT_DIR}/etc/apt/sources.list" << EOF
deb ${UBUNTU_MIRROR} ${UBUNTU_SUITE} main restricted universe multiverse
deb ${UBUNTU_MIRROR} ${UBUNTU_SUITE}-updates main restricted universe multiverse
deb ${UBUNTU_MIRROR} ${UBUNTU_SUITE}-security main restricted universe multiverse
EOF

# Avoid interactive prompts
cat > "${CHROOT_DIR}/etc/apt/apt.conf.d/99-no-prompt" << EOF
APT::Get::Assume-Yes "true";
Dpkg::Options "--force-confold";
EOF

export DEBIAN_FRONTEND=noninteractive

log "Updating APT..."
chr "apt-get update -qq"

log "chroot environment ready."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 3: Install Software in chroot
# ═════════════════════════════════════════════════════════════════════════════
step "Step 3/10: Installing software in chroot"

log "Installing base packages..."
chr "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    linux-image-generic \
    linux-headers-generic \
    casper \
    openssh-server \
    curl \
    wget \
    git \
    sqlite3 \
    logrotate \
    locales \
    tzdata \
    ca-certificates \
    gnupg \
    lsb-release \
    net-tools \
    iputils-ping \
    iproute2 \
    nmap \
    2>&1" | tail -20

# adb and cec-utils installed separately (universe, may be named differently)
log "Installing adb and cec-utils..."
chr "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends adb 2>&1 || true"
chr "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cec-utils 2>&1 || true"

# Realtek WiFi drivers + wireless tools
log "Installing Realtek WiFi drivers and wireless tools..."
chr "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    linux-firmware \
    rtl8821ce-dkms \
    r8168-dkms \
    wpasupplicant \
    wireless-tools \
    rfkill \
    2>&1 || true"
# Note: rtl8812au-dkms fails in chroot (needs running kernel) — installed on first boot instead

log "Installing Node.js 22 (NodeSource)..."
chr "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -"
chr "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs"

log "Node.js version: $(chr "node --version")"
log "npm version:     $(chr "npm --version")"

log "Installing PM2 globally..."
chr "npm install -g pm2"

log "Installing Ollama AI runtime..."
chr "curl -fsSL https://ollama.com/install.sh | sh" || warn "Ollama install failed (non-fatal)"

log "Installing Claude Code CLI (native)..."
chr "curl -fsSL https://claude.ai/install.sh | sh" || warn "Claude Code CLI install failed (non-fatal)"

log "Installing GitHub CLI (gh)..."
chr "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg" || true
chr "echo 'deb [arch=amd64 signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main' > /etc/apt/sources.list.d/github-cli.list" || true
chr "apt-get update -qq && apt-get install -y gh" || warn "GitHub CLI install failed (non-fatal)"

log "Cleaning up APT cache..."
chr "apt-get clean"
chr "apt-get autoremove -y"
rm -rf "${CHROOT_DIR}/var/cache/apt/archives/"*
rm -rf "${CHROOT_DIR}/var/lib/apt/lists/"*

log "Software installation complete."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 4: System Configuration
# ═════════════════════════════════════════════════════════════════════════════
step "Step 4/10: Configuring chroot system"

# Hostname
echo "sports-bar-controller" > "${CHROOT_DIR}/etc/hostname"

# Locale
chr "locale-gen en_US.UTF-8"
chr "update-locale LANG=en_US.UTF-8"

# Ubuntu user (same as live server)
chr "id ubuntu &>/dev/null || useradd -m -s /bin/bash -G sudo ubuntu"
chr "echo 'ubuntu:ubuntu' | chpasswd"
echo "%sudo ALL=(ALL) NOPASSWD:ALL" > "${CHROOT_DIR}/etc/sudoers.d/ubuntu-nopasswd"

# Create data directory placeholder
mkdir -p "${CHROOT_DIR}/home/ubuntu/sports-bar-data"
chr "chown -R ubuntu:ubuntu /home/ubuntu"

# SSH: permit root + ubuntu user but require key for root
mkdir -p "${CHROOT_DIR}/etc/ssh"
cat >> "${CHROOT_DIR}/etc/ssh/sshd_config" << 'EOF'

# Sports Bar TV Controller SSH configuration
PasswordAuthentication yes
PermitRootLogin no
EOF

log "System configuration complete."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 5: First-Boot Systemd Service
# ═════════════════════════════════════════════════════════════════════════════
step "Step 5/10: Installing first-boot systemd service"

# Copy first-boot scripts
install -m 755 "${SCRIPTS_SOURCE}/first-boot-fresh.sh"    "${CHROOT_DIR}/usr/local/bin/first-boot-fresh.sh"
install -m 755 "${SCRIPTS_SOURCE}/first-boot-snapshot.sh" "${CHROOT_DIR}/usr/local/bin/first-boot-snapshot.sh"
install -m 755 "${SCRIPTS_SOURCE}/location-setup-wizard.sh" "${CHROOT_DIR}/usr/local/bin/location-setup-wizard.sh"
install -m 755 "${SCRIPTS_SOURCE}/disk-installer.sh"       "${CHROOT_DIR}/usr/local/bin/disk-installer.sh"

# Dispatcher script: reads kernel cmdline to pick fresh vs snapshot
cat > "${CHROOT_DIR}/usr/local/bin/sports-bar-first-boot.sh" << 'DISPATCHER_EOF'
#!/bin/bash
#
# First-boot dispatcher: reads sports_bar_mode from kernel cmdline
# and invokes the appropriate first-boot script.
#

LOG_FILE="/var/log/sports-bar-first-boot.log"
DONE_MARKER="/var/lib/sports-bar-first-boot-done"

exec > >(tee -a "$LOG_FILE") 2>&1

if [ -f "$DONE_MARKER" ]; then
    echo "[$(date)] First-boot already done. Exiting."
    exit 0
fi

# Read kernel cmdline parameter
MODE=$(grep -oP 'sports_bar_mode=\K\S+' /proc/cmdline || echo "fresh")

echo "[$(date)] Boot mode: $MODE"

case "$MODE" in
    install)
        # Disk install mode — launch interactive installer on tty1
        echo "[$(date)] Install mode detected — launching disk installer on tty1"
        # The disk-installer systemd service handles TTY access
        systemctl start sports-bar-disk-installer.service 2>/dev/null || \
            /usr/local/bin/disk-installer.sh
        exit 0
        ;;
    snapshot)
        exec /usr/local/bin/first-boot-snapshot.sh
        ;;
    fresh|*)
        exec /usr/local/bin/first-boot-fresh.sh
        ;;
esac
DISPATCHER_EOF
chmod +x "${CHROOT_DIR}/usr/local/bin/sports-bar-first-boot.sh"

# Systemd one-shot service
cat > "${CHROOT_DIR}/etc/systemd/system/sports-bar-first-boot.service" << 'SERVICE_EOF'
[Unit]
Description=Sports Bar TV Controller First Boot Setup
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/var/lib/sports-bar-first-boot-done

[Service]
Type=oneshot
ExecStart=/usr/local/bin/sports-bar-first-boot.sh
RemainAfterExit=yes
StandardOutput=journal+console
StandardError=journal+console
TimeoutStartSec=1800

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Enable the service
chr "systemctl enable sports-bar-first-boot.service"

# Disk installer service (interactive on tty1, for install mode)
cat > "${CHROOT_DIR}/etc/systemd/system/sports-bar-disk-installer.service" << 'DISKEOF'
[Unit]
Description=Sports Bar TV Controller - Disk Installer
After=multi-user.target
ConditionKernelCommandLine=sports_bar_mode=install

[Service]
Type=oneshot
ExecStart=/usr/local/bin/disk-installer.sh
StandardInput=tty
StandardOutput=tty
StandardError=tty
TTYPath=/dev/tty1
TTYReset=yes
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
DISKEOF

chr "systemctl enable sports-bar-disk-installer.service"

log "First-boot and disk-installer services installed and enabled."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 6: Snapshot - Bake in App Code + Database
# ═════════════════════════════════════════════════════════════════════════════
step "Step 6/10: Snapshot Mode (DISABLED in v3.0)"
log "Snapshot mode removed in v3.0 — this ISO is location-independent."
log "The setup wizard will configure devices after first boot."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 7: Clean up chroot
# ═════════════════════════════════════════════════════════════════════════════
step "Step 7/10: Cleaning up chroot"

# Remove SSH host keys (will be regenerated on first boot)
rm -f "${CHROOT_DIR}/etc/ssh/ssh_host_"*

# Clear machine-id (will be regenerated on first boot)
echo "" > "${CHROOT_DIR}/etc/machine-id"
rm -f "${CHROOT_DIR}/var/lib/dbus/machine-id"

# Clear logs and temp files
find "${CHROOT_DIR}/var/log" -type f -exec truncate -s 0 {} \; 2>/dev/null || true
rm -rf "${CHROOT_DIR}/tmp/"*
rm -rf "${CHROOT_DIR}/var/tmp/"*
rm -f "${CHROOT_DIR}/root/.bash_history" 2>/dev/null || true

# Remove APT prompt config (not needed in installed system)
rm -f "${CHROOT_DIR}/etc/apt/apt.conf.d/99-no-prompt"

# Unmount before squash
cleanup_mounts

log "chroot cleaned."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 8: Build SquashFS
# ═════════════════════════════════════════════════════════════════════════════
step "Step 8/10: Compressing filesystem (XZ — this takes 20-40 min)"

mkdir -p "${ISO_STAGING}/casper"

SQUASH_FILE="${ISO_STAGING}/casper/filesystem.squashfs"

log "Running mksquashfs..."
mksquashfs "${CHROOT_DIR}" "$SQUASH_FILE" \
    -comp xz \
    -b 1M \
    -Xdict-size 100% \
    -noappend \
    -e boot \
    2>&1 | grep -E "^(Parallel|Filesystem|mksquashfs|[0-9]+%)" || true

SQUASH_SIZE=$(du -h "$SQUASH_FILE" | cut -f1)
log "Squashfs created: $SQUASH_FILE ($SQUASH_SIZE)"

# Kernel + initrd
log "Copying kernel and initrd..."
KERNEL_FILE=$(ls "${CHROOT_DIR}/boot/vmlinuz-"* 2>/dev/null | sort -V | tail -1)
INITRD_FILE=$(ls "${CHROOT_DIR}/boot/initrd.img-"* 2>/dev/null | sort -V | tail -1)

if [ -z "$KERNEL_FILE" ] || [ -z "$INITRD_FILE" ]; then
    err "Kernel or initrd not found in chroot. Check that linux-image-generic was installed."
    exit 1
fi

cp "$KERNEL_FILE" "${ISO_STAGING}/casper/vmlinuz"
cp "$INITRD_FILE" "${ISO_STAGING}/casper/initrd"

log "Kernel: $(basename "$KERNEL_FILE")"
log "Initrd: $(basename "$INITRD_FILE")"

# Filesystem size (for installer)
chr() { chroot "${CHROOT_DIR}" /bin/bash -c "$*" 2>/dev/null || true; }
printf $(du -sx --block-size=1 "${CHROOT_DIR}" | cut -f1) > "${ISO_STAGING}/casper/filesystem.size"

# ═════════════════════════════════════════════════════════════════════════════
# STEP 9: Build Boot Configuration (GRUB + ISOLINUX)
# ═════════════════════════════════════════════════════════════════════════════
step "Step 9/10: Building bootloader configuration"

# ─── GRUB (UEFI) ──────────────────────────────────────────────────────────────
mkdir -p "${ISO_STAGING}/boot/grub"

cat > "${ISO_STAGING}/boot/grub/grub.cfg" << 'GRUB_EOF'
set default="0"
set timeout=30
set timeout_style=menu

insmod part_gpt
insmod part_msdos
insmod fat
insmod ext2
insmod gfxterm
insmod png

if loadfont unicode; then
    set gfxmode=auto
    terminal_output gfxterm
fi

set menu_color_normal=white/black
set menu_color_highlight=black/light-gray

menuentry "1. Install to Disk  (full OS + app install)" {
    linux  /casper/vmlinuz boot=casper quiet splash sports_bar_mode=install ---
    initrd /casper/initrd
}

menuentry "2. Live (No Install)  - boot into RAM for testing" {
    linux  /casper/vmlinuz boot=casper toram quiet splash sports_bar_mode=fresh ---
    initrd /casper/initrd
}

menuentry "3. Safe Mode  (nomodeset, for display issues)" {
    linux  /casper/vmlinuz boot=casper nomodeset quiet splash sports_bar_mode=install ---
    initrd /casper/initrd
}
GRUB_EOF

# Build GRUB EFI image
log "Building GRUB EFI image..."
mkdir -p "${ISO_STAGING}/EFI/BOOT"

grub-mkstandalone \
    --format=x86_64-efi \
    --output="${ISO_STAGING}/EFI/BOOT/BOOTx64.EFI" \
    --locales="" \
    --fonts="" \
    "boot/grub/grub.cfg=${ISO_STAGING}/boot/grub/grub.cfg"

# Create EFI disk image (for xorriso)
mkdir -p "${BUILD_DIR}/efi_work"
dd if=/dev/zero of="${ISO_STAGING}/boot/grub/efi.img" bs=1M count=4 status=none
mkfs.vfat -F 12 "${ISO_STAGING}/boot/grub/efi.img"
mmd -i "${ISO_STAGING}/boot/grub/efi.img" ::/EFI ::/EFI/BOOT
mcopy -i "${ISO_STAGING}/boot/grub/efi.img" "${ISO_STAGING}/EFI/BOOT/BOOTx64.EFI" ::/EFI/BOOT/

log "GRUB EFI image built."

# ─── ISOLINUX (BIOS) ──────────────────────────────────────────────────────────
mkdir -p "${ISO_STAGING}/isolinux"

cp "$ISOLINUX_BIN" "${ISO_STAGING}/isolinux/isolinux.bin"

# Copy required syslinux modules
for mod_dir in /usr/lib/syslinux/modules/bios /usr/lib/syslinux/bios; do
    if [ -d "$mod_dir" ]; then
        for f in ldlinux.c32 libcom32.c32 libutil.c32 vesamenu.c32 libgfxboot.c32; do
            [ -f "${mod_dir}/${f}" ] && cp "${mod_dir}/${f}" "${ISO_STAGING}/isolinux/" 2>/dev/null || true
        done
        break
    fi
done

# Fallback: ldlinux.c32 is required
if [ ! -f "${ISO_STAGING}/isolinux/ldlinux.c32" ]; then
    warn "ldlinux.c32 not found — BIOS boot may not work. Install: apt install syslinux-common"
fi

cat > "${ISO_STAGING}/isolinux/isolinux.cfg" << 'ISOLINUX_EOF'
DEFAULT vesamenu.c32
TIMEOUT 300
PROMPT 0

MENU TITLE Sports Bar TV Controller v3.0

LABEL install
  MENU LABEL 1. Install to Disk  (full OS + app install)
  KERNEL /casper/vmlinuz
  APPEND initrd=/casper/initrd boot=casper quiet splash sports_bar_mode=install ---

LABEL live
  MENU LABEL 2. Live (No Install) - boot into RAM
  KERNEL /casper/vmlinuz
  APPEND initrd=/casper/initrd boot=casper toram quiet splash sports_bar_mode=fresh ---

LABEL safe
  MENU LABEL 3. Safe Mode (nomodeset)
  KERNEL /casper/vmlinuz
  APPEND initrd=/casper/initrd boot=casper nomodeset quiet splash sports_bar_mode=fresh ---
ISOLINUX_EOF

log "ISOLINUX (BIOS) config written."

# ─── Filesystem manifest ──────────────────────────────────────────────────────
mkdir -p "${ISO_STAGING}/.disk"
echo "Sports Bar TV Controller ${VERSION} - ${BUILD_DATE}" > "${ISO_STAGING}/.disk/info"
touch "${ISO_STAGING}/.disk/base_installable"

# ─── casper md5sum.txt (suppresses casper-md5check failure) ───────────────────
log "Generating casper md5sum.txt..."
(cd "${ISO_STAGING}" && find . -type f \
    ! -path './isolinux/isolinux.bin' \
    ! -path './boot/grub/efi.img' \
    ! -path './md5sum.txt' \
    -print0 | xargs -0 md5sum > md5sum.txt)
log "md5sum.txt written ($(wc -l < "${ISO_STAGING}/md5sum.txt") files checksummed)"

# ═════════════════════════════════════════════════════════════════════════════
# STEP 10: Build Hybrid ISO
# ═════════════════════════════════════════════════════════════════════════════
step "Step 10/10: Building hybrid ISO (UEFI + BIOS)"

ISO_OUTPUT="/home/ubuntu/${ISO_NAME}"

XORRISO_ARGS=(
    xorriso -as mkisofs
    -iso-level 3
    -full-iso9660-filenames
    -volid "SportsBarTV"
    -output "$ISO_OUTPUT"
    # BIOS boot via ISOLINUX
    -eltorito-boot isolinux/isolinux.bin
    -eltorito-catalog isolinux/boot.cat
    -no-emul-boot
    -boot-load-size 4
    -boot-info-table
    # UEFI boot via EFI image
    -eltorito-alt-boot
    -e boot/grub/efi.img
    -no-emul-boot
    -isohybrid-gpt-basdat
)

# Add isohybrid MBR if available (makes it USB-bootable)
if [ -n "$ISOHDPFX_BIN" ]; then
    XORRISO_ARGS+=(-isohybrid-mbr "$ISOHDPFX_BIN")
    log "isohybrid MBR: $ISOHDPFX_BIN (USB-bootable)"
else
    warn "isohdpfx.bin not found — ISO may not boot from USB as-is. Install isolinux."
fi

XORRISO_ARGS+=("$ISO_STAGING")

log "Running xorriso..."
"${XORRISO_ARGS[@]}" 2>&1

ISO_SIZE=$(du -h "$ISO_OUTPUT" | cut -f1)
log "ISO created: $ISO_OUTPUT ($ISO_SIZE)"

# ─── Checksums ────────────────────────────────────────────────────────────────
log "Generating checksums..."
(cd /home/ubuntu && md5sum    "$ISO_NAME" > "${ISO_NAME}.md5")
(cd /home/ubuntu && sha256sum "$ISO_NAME" > "${ISO_NAME}.sha256")

MD5_HASH=$(    cut -d' ' -f1 "/home/ubuntu/${ISO_NAME}.md5")
SHA256_HASH=$( cut -d' ' -f1 "/home/ubuntu/${ISO_NAME}.sha256")

# ─── GitHub Release upload ────────────────────────────────────────────────────
if [ "$NO_UPLOAD" = false ]; then
    if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
        log "Uploading to GitHub Releases..."
        # Run as ubuntu user (gh is configured for that user)
        sudo -u ubuntu bash "${SCRIPTS_SOURCE}/upload-github-release.sh" \
            "$ISO_OUTPUT" \
            --tag "${VERSION}-${BUILD_DATE}" \
            || warn "GitHub upload failed — ISO is still available locally."
    else
        warn "gh CLI not available or not authenticated — skipping GitHub upload."
        info "Upload manually with: ./iso-scripts/upload-github-release.sh $ISO_OUTPUT"
    fi
else
    info "Skipping GitHub upload (--no-upload)"
fi

# ─── Build Report ─────────────────────────────────────────────────────────────
REPORT_FILE="${BUILD_DIR}/BUILD_REPORT-${BUILD_DATE}.txt"

cat > "$REPORT_FILE" << REPORT_EOF
Sports Bar TV Controller - ISO Build Report
===========================================
Build Date:     $(date '+%Y-%m-%d %H:%M:%S')
Version:        ${VERSION}
ISO File:       ${ISO_OUTPUT}
ISO Size:       ${ISO_SIZE}
Squash Size:    ${SQUASH_SIZE}

Checksums:
  MD5:    ${MD5_HASH}
  SHA256: ${SHA256_HASH}

Boot Modes:
  1. Install          - pulls latest from GitHub + runs setup wizard
  2. Live (No Install)- run from RAM for testing
  3. Safe Mode        - nomodeset for display compatibility

Software Installed:
  - Ubuntu 22.04 LTS (jammy) - clean debootstrap base
  - Node.js 22.x + npm
  - PM2 process manager
  - Ollama AI runtime
  - Claude Code CLI (native install via claude.ai)
  - GitHub CLI (gh)
  - SQLite3
  - OpenSSH Server
  - ADB (Android Debug Bridge - Fire TV control)
  - cec-utils (HDMI-CEC cable box control)
  - nmap (network scanning)
  - Location Setup Wizard
  - git, curl, logrotate

VM Testing:
  qemu-system-x86_64 -cdrom ${ISO_NAME} -m 4G -enable-kvm -boot d

USB Write:
  sudo dd if=${ISO_OUTPUT} of=/dev/sdX bs=4M status=progress

Verification:
  md5sum -c /home/ubuntu/${ISO_NAME}.md5
  sha256sum -c /home/ubuntu/${ISO_NAME}.sha256

Build Log:
  ${LOG_FILE}

NOTE: Graystone server is unaffected — this build runs on Leg Lamp only.
REPORT_EOF

# ─── Final Summary ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  BUILD COMPLETE!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo ""
echo "  ISO:     $ISO_OUTPUT"
echo "  Size:    $ISO_SIZE"
echo ""
echo "  MD5:     $MD5_HASH"
echo "  SHA256:  $SHA256_HASH"
echo ""
echo "  Report:  $REPORT_FILE"
echo "  Log:     $LOG_FILE"
echo ""
echo "Next steps:"
echo "  1. Verify:    md5sum -c /home/ubuntu/${ISO_NAME}.md5"
echo "  2. Test VM:   qemu-system-x86_64 -cdrom $ISO_OUTPUT -m 4G -enable-kvm -boot d"
echo "  3. Write USB: sudo dd if=$ISO_OUTPUT of=/dev/sdX bs=4M status=progress"
echo ""
