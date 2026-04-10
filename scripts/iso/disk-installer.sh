#!/bin/bash
#
# Sports Bar TV Controller - Disk Installer
#
# Installs Ubuntu + Sports Bar TV Controller to the NUC's internal SSD.
# Runs from the Casper live environment after booting the ISO.
#
# What it does:
#   1. Detects the target disk (NVMe SSD or SATA)
#   2. Partitions: EFI (512MB) + Root (rest)
#   3. Formats: FAT32 (EFI) + ext4 (root)
#   4. Extracts the live filesystem (squashfs) to disk
#   5. Installs GRUB bootloader (UEFI + BIOS)
#   6. Configures fstab, hostname, networking, users
#   7. Copies first-boot service for app setup on reboot
#   8. Reboots into the installed system
#
# Usage: sudo bash /usr/local/bin/disk-installer.sh
#

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
info() { echo -e "${CYAN}[i]${NC} $*"; }
step() { echo -e "\n${BOLD}${GREEN}=== $* ===${NC}\n"; }

# ─── Configuration ───────────────────────────────────────────────────────────
TARGET_DISK=""
EFI_PART=""
ROOT_PART=""
MOUNT_DIR="/mnt/target"
SQUASHFS_PATH="/cdrom/casper/filesystem.squashfs"
HOSTNAME_DEFAULT="sports-bar-controller"

# ─── Must run as root ────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    err "This script must be run as root: sudo $0"
    exit 1
fi

# ─── Cleanup trap ────────────────────────────────────────────────────────────
cleanup() {
    log "Cleaning up mounts..."
    umount -lf "${MOUNT_DIR}/boot/efi" 2>/dev/null || true
    umount -lf "${MOUNT_DIR}/proc" 2>/dev/null || true
    umount -lf "${MOUNT_DIR}/sys" 2>/dev/null || true
    umount -lf "${MOUNT_DIR}/dev/pts" 2>/dev/null || true
    umount -lf "${MOUNT_DIR}/dev" 2>/dev/null || true
    umount -lf "${MOUNT_DIR}/run" 2>/dev/null || true
    umount -lf "${MOUNT_DIR}" 2>/dev/null || true
}
trap cleanup EXIT

# ─── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}   SPORTS BAR TV CONTROLLER${NC}"
echo -e "${BOLD}   Disk Installer v3.0${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo "  This will install Ubuntu 22.04 + Sports Bar TV Controller"
echo "  to this computer's internal drive."
echo ""
echo -e "  ${RED}${BOLD}WARNING: This will ERASE the target disk!${NC}"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
# STEP 1: Detect Target Disk
# ═════════════════════════════════════════════════════════════════════════════
step "Step 1/7: Detecting Disks"

# Find all non-USB, non-loop block devices
echo "  Available disks:"
echo ""

declare -a DISKS=()
while IFS= read -r line; do
    local_disk=$(echo "$line" | awk '{print $1}')
    local_size=$(echo "$line" | awk '{print $2}')
    local_model=$(echo "$line" | awk '{$1=$2=""; print $0}' | xargs)

    # Skip USB drives (removable) and loop devices
    if [[ -f "/sys/block/$(basename "$local_disk")/removable" ]]; then
        removable=$(cat "/sys/block/$(basename "$local_disk")/removable" 2>/dev/null || echo "0")
        [[ "$removable" == "1" ]] && continue
    fi

    DISKS+=("$local_disk")
    printf "    ${BOLD}%d.${NC} %-12s %-8s %s\n" "${#DISKS[@]}" "$local_disk" "$local_size" "$local_model"
done < <(lsblk -dno NAME,SIZE,MODEL | grep -E '^(sd|nvme|vd)' | sed 's|^|/dev/|')

echo ""

if [[ ${#DISKS[@]} -eq 0 ]]; then
    err "No suitable disks found!"
    exit 1
fi

if [[ ${#DISKS[@]} -eq 1 ]]; then
    TARGET_DISK="${DISKS[0]}"
    echo -e "  Only one disk found: ${BOLD}${TARGET_DISK}${NC}"
else
    while true; do
        read -rp "  Select disk to install to [1]: " choice
        choice="${choice:-1}"
        if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#DISKS[@]} )); then
            TARGET_DISK="${DISKS[$((choice - 1))]}"
            break
        fi
        echo "  Invalid selection."
    done
fi

# Get disk size for display
DISK_SIZE=$(lsblk -dno SIZE "$TARGET_DISK" | xargs)
DISK_MODEL=$(lsblk -dno MODEL "$TARGET_DISK" | xargs)

# ─── Check for existing Ubuntu installation ──────────────────────────────────
EXISTING_UBUNTU=false
EXISTING_APP=false
echo ""

# Try to find and mount existing partitions to check
for part in $(lsblk -lno NAME,FSTYPE "$TARGET_DISK" | grep -E 'ext4|xfs|btrfs' | awk '{print $1}'); do
    TMP_MNT=$(mktemp -d)
    if mount -o ro "/dev/${part}" "$TMP_MNT" 2>/dev/null; then
        if [[ -f "${TMP_MNT}/etc/lsb-release" ]] || [[ -f "${TMP_MNT}/etc/os-release" ]]; then
            EXISTING_UBUNTU=true
            EXISTING_OS=$(cat "${TMP_MNT}/etc/lsb-release" 2>/dev/null | grep DESCRIPTION | cut -d'"' -f2 || echo "Linux")
            log "Found existing OS: ${EXISTING_OS} on /dev/${part}"

            if [[ -d "${TMP_MNT}/home/ubuntu/Sports-Bar-TV-Controller" ]]; then
                EXISTING_APP=true
                EXISTING_BRANCH=$(git -C "${TMP_MNT}/home/ubuntu/Sports-Bar-TV-Controller" branch --show-current 2>/dev/null || echo "unknown")
                log "Found existing Sports Bar TV Controller (branch: ${EXISTING_BRANCH})"
            fi
        fi
        umount "$TMP_MNT" 2>/dev/null || true
    fi
    rmdir "$TMP_MNT" 2>/dev/null || true
done

if [[ "$EXISTING_UBUNTU" == true ]]; then
    echo ""
    echo -e "  ${YELLOW}${BOLD}Existing installation detected on ${TARGET_DISK}!${NC}"
    if [[ "$EXISTING_APP" == true ]]; then
        echo -e "  ${YELLOW}Sports Bar TV Controller is already installed (branch: ${EXISTING_BRANCH})${NC}"
    fi
    echo ""
    echo "  Options:"
    echo "    1. Fresh install (ERASE everything and start clean)"
    echo "    2. Cancel (keep existing installation)"
    echo ""
    read -rp "  Selection [2]: " install_choice
    install_choice="${install_choice:-2}"
    if [[ "$install_choice" != "1" ]]; then
        info "Installation cancelled. Existing system preserved."
        echo ""
        echo "  To update the existing installation instead, boot from the SSD"
        echo "  and run:  cd ~/Sports-Bar-TV-Controller && git pull && npm run build"
        echo ""
        exit 0
    fi
    echo ""
fi

echo -e "  ${RED}${BOLD}ALL DATA ON ${TARGET_DISK} (${DISK_SIZE}, ${DISK_MODEL}) WILL BE ERASED!${NC}"
echo ""
read -rp "  Type 'YES' to continue: " confirm
if [[ "$confirm" != "YES" ]]; then
    info "Installation cancelled."
    exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# STEP 2: Partition Disk
# ═════════════════════════════════════════════════════════════════════════════
step "Step 2/7: Partitioning ${TARGET_DISK}"

# Wipe existing partition table
wipefs -af "$TARGET_DISK" &>/dev/null

# Create GPT partition table with EFI + root
parted -s "$TARGET_DISK" \
    mklabel gpt \
    mkpart "EFI" fat32 1MiB 513MiB \
    set 1 esp on \
    mkpart "root" ext4 513MiB 100%

sleep 2  # Wait for kernel to re-read partition table
partprobe "$TARGET_DISK" 2>/dev/null || true
sleep 1

# Determine partition names (nvme uses p1/p2, sata uses 1/2)
if [[ "$TARGET_DISK" == *"nvme"* ]]; then
    EFI_PART="${TARGET_DISK}p1"
    ROOT_PART="${TARGET_DISK}p2"
else
    EFI_PART="${TARGET_DISK}1"
    ROOT_PART="${TARGET_DISK}2"
fi

log "EFI partition: ${EFI_PART}"
log "Root partition: ${ROOT_PART}"

# ═════════════════════════════════════════════════════════════════════════════
# STEP 3: Format Partitions
# ═════════════════════════════════════════════════════════════════════════════
step "Step 3/7: Formatting Partitions"

log "Formatting EFI partition (FAT32)..."
mkfs.vfat -F 32 -n "EFI" "$EFI_PART" 2>&1 | tail -2

log "Formatting root partition (ext4)..."
mkfs.ext4 -L "sportsbar-root" -F "$ROOT_PART" 2>&1 | tail -2

log "Partitions formatted."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 4: Extract Filesystem
# ═════════════════════════════════════════════════════════════════════════════
step "Step 4/7: Installing System (this takes 5-10 minutes)"

# Mount root
mkdir -p "$MOUNT_DIR"
mount "$ROOT_PART" "$MOUNT_DIR"

# Mount EFI
mkdir -p "${MOUNT_DIR}/boot/efi"
mount "$EFI_PART" "${MOUNT_DIR}/boot/efi"

# Find squashfs
if [[ ! -f "$SQUASHFS_PATH" ]]; then
    # Try alternate locations
    for alt in /run/live/medium/casper/filesystem.squashfs /media/cdrom/casper/filesystem.squashfs; do
        if [[ -f "$alt" ]]; then
            SQUASHFS_PATH="$alt"
            break
        fi
    done
fi

if [[ ! -f "$SQUASHFS_PATH" ]]; then
    err "Cannot find filesystem.squashfs!"
    err "Looked in: /cdrom/casper/, /run/live/medium/casper/, /media/cdrom/casper/"
    exit 1
fi

log "Extracting filesystem from ${SQUASHFS_PATH}..."
unsquashfs -f -d "$MOUNT_DIR" "$SQUASHFS_PATH" 2>&1 | grep -E "^(Parallel|[0-9]+)" | tail -5

log "Filesystem extracted."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 5: Configure Installed System
# ═════════════════════════════════════════════════════════════════════════════
step "Step 5/7: Configuring Installed System"

# Mount virtual filesystems for chroot
mount -t proc  none "${MOUNT_DIR}/proc"
mount -t sysfs none "${MOUNT_DIR}/sys"
mount -o bind  /dev "${MOUNT_DIR}/dev"
mount -t devpts none "${MOUNT_DIR}/dev/pts"
mkdir -p "${MOUNT_DIR}/run"
mount -o bind  /run "${MOUNT_DIR}/run"

# Helper for chroot commands
chr() { chroot "$MOUNT_DIR" /bin/bash -c "$*"; }

# ─── fstab ───────────────────────────────────────────────────────────────────
ROOT_UUID=$(blkid -s UUID -o value "$ROOT_PART")
EFI_UUID=$(blkid -s UUID -o value "$EFI_PART")

cat > "${MOUNT_DIR}/etc/fstab" << FSTABEOF
# /etc/fstab - Sports Bar TV Controller
UUID=${ROOT_UUID}  /          ext4  errors=remount-ro  0  1
UUID=${EFI_UUID}   /boot/efi  vfat  umask=0077         0  1
FSTABEOF

log "fstab configured."

# ─── Hostname ────────────────────────────────────────────────────────────────
read -rp "  Hostname [${HOSTNAME_DEFAULT}]: " custom_hostname
custom_hostname="${custom_hostname:-$HOSTNAME_DEFAULT}"
echo "$custom_hostname" > "${MOUNT_DIR}/etc/hostname"
cat > "${MOUNT_DIR}/etc/hosts" << HOSTSEOF
127.0.0.1  localhost
127.0.1.1  ${custom_hostname}
HOSTSEOF

log "Hostname: ${custom_hostname}"

# ─── Networking (DHCP by default) ────────────────────────────────────────────
# Find the primary ethernet interface name inside the chroot
NET_IFACE=$(ip -o link show | grep -E 'enp|eth|eno' | awk -F': ' '{print $2}' | head -1)
NET_IFACE="${NET_IFACE:-enp0s31f6}"

mkdir -p "${MOUNT_DIR}/etc/netplan"
cat > "${MOUNT_DIR}/etc/netplan/01-netcfg.yaml" << NETEOF
network:
  version: 2
  renderer: networkd
  ethernets:
    ${NET_IFACE}:
      dhcp4: yes
NETEOF

log "Network: DHCP on ${NET_IFACE} (can configure static IP later via setup wizard)"

# ─── Timezone ────────────────────────────────────────────────────────────────
echo "America/Chicago" > "${MOUNT_DIR}/etc/timezone"
chr "ln -sf /usr/share/zoneinfo/America/Chicago /etc/localtime" 2>/dev/null || true
log "Timezone: America/Chicago (Central)"

# ─── User setup ──────────────────────────────────────────────────────────────
# Ensure ubuntu user exists with password 'ubuntu'
chr "id ubuntu &>/dev/null || useradd -m -s /bin/bash -G sudo ubuntu"
chr "echo 'ubuntu:ubuntu' | chpasswd"
echo "%sudo ALL=(ALL) NOPASSWD:ALL" > "${MOUNT_DIR}/etc/sudoers.d/ubuntu-nopasswd"
chmod 440 "${MOUNT_DIR}/etc/sudoers.d/ubuntu-nopasswd"

log "User: ubuntu (password: ubuntu)"

# ─── SSH ─────────────────────────────────────────────────────────────────────
chr "systemctl enable ssh" 2>/dev/null || true
log "SSH enabled."

# ─── Regenerate SSH host keys ────────────────────────────────────────────────
rm -f "${MOUNT_DIR}/etc/ssh/ssh_host_"*
chr "dpkg-reconfigure -f noninteractive openssh-server" 2>/dev/null || true

# ─── Machine ID ──────────────────────────────────────────────────────────────
rm -f "${MOUNT_DIR}/etc/machine-id" "${MOUNT_DIR}/var/lib/dbus/machine-id"
chr "systemd-machine-id-setup" 2>/dev/null || true

# ─── Create data directory ───────────────────────────────────────────────────
mkdir -p "${MOUNT_DIR}/home/ubuntu/sports-bar-data"
chr "chown -R ubuntu:ubuntu /home/ubuntu"

# ─── Enable first-boot service ──────────────────────────────────────────────
chr "systemctl enable sports-bar-first-boot.service" 2>/dev/null || true
log "First-boot service enabled — will clone app and build on first real boot."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 6: Install GRUB Bootloader
# ═════════════════════════════════════════════════════════════════════════════
step "Step 6/7: Installing GRUB Bootloader"

# Install GRUB packages in chroot if not present
chr "DEBIAN_FRONTEND=noninteractive apt-get install -y grub-efi-amd64 grub-pc-bin 2>&1" | tail -5

# Install GRUB to EFI
chr "grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=sportsbar --recheck 2>&1" || warn "EFI GRUB install failed — trying BIOS fallback"

# Also install GRUB for BIOS (legacy boot) if disk supports it
if [[ "$TARGET_DISK" != *"nvme"* ]]; then
    chr "grub-install --target=i386-pc ${TARGET_DISK} 2>&1" || warn "BIOS GRUB install skipped"
fi

# Generate GRUB config
chr "update-grub 2>&1" | tail -5

log "GRUB bootloader installed."

# ═════════════════════════════════════════════════════════════════════════════
# STEP 7: Finalize
# ═════════════════════════════════════════════════════════════════════════════
step "Step 7/7: Finalizing Installation"

# Ensure resolv.conf works after reboot
rm -f "${MOUNT_DIR}/etc/resolv.conf"
echo "nameserver 8.8.8.8" > "${MOUNT_DIR}/etc/resolv.conf"
echo "nameserver 8.8.4.4" >> "${MOUNT_DIR}/etc/resolv.conf"

# Remove casper-related packages (not needed on installed system)
chr "apt-get remove -y casper 2>/dev/null" || true
chr "apt-get autoremove -y 2>/dev/null" || true

# Clean up
chr "apt-get clean" 2>/dev/null || true

# Unmount everything
sync
cleanup

echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  INSTALLATION COMPLETE!${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo "  Installed to: ${TARGET_DISK}"
echo "  Disk size:    ${DISK_SIZE}"
echo "  User:         ubuntu (password: ubuntu)"
echo ""
echo "  On first boot from the SSD:"
echo "    1. System will auto-clone the app from GitHub"
echo "    2. Build and start the application (~10-15 min)"
echo "    3. Install Claude Code CLI"
echo "    4. Login and run: location-setup-wizard"
echo ""
echo -e "  ${YELLOW}Remove the USB drive and press Enter to reboot...${NC}"
read -r
reboot
