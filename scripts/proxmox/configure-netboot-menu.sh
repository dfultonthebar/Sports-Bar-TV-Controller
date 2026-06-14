#!/bin/bash
#
# configure-netboot-menu.sh — runs INSIDE the netboot LXC.
# Downloads the latest Sports-Bar-TV-Controller ISO from GitHub Releases,
# reassembles the 2-part split, verifies SHA256, writes the iPXE menu,
# and configures dnsmasq for proxy-DHCP + TFTP.
#
# Idempotent — safe to re-run when a new ISO ships (replaces the old one,
# archives prior to /var/www/html/iso/archive/).
#
# Required: this LXC must have internet access to reach GitHub Releases.
#
# Optional flags:
#   --release v3.0-YYYY-MM-DD     pin a specific release tag (default: latest)
#   --tailscale-url URL           use Holmgren's Tailscale URL as ISO source
#                                 instead of GitHub Releases (skips the 2-part
#                                 reassembly — single .iso file). Requires
#                                 Tailscale Serve enabled on Holmgren + this
#                                 LXC to be on Tailscale.
#

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
info() { echo -e "${CYAN}[i]${NC} $*"; }

RELEASE_TAG=""
TAILSCALE_URL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --release)        RELEASE_TAG="$2"; shift 2 ;;
        --tailscale-url)  TAILSCALE_URL="$2"; shift 2 ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        *) err "Unknown option: $1"; exit 1 ;;
    esac
done

if [ "$(id -u)" -ne 0 ]; then
    err "Run as root (sudo bash $0)"
    exit 1
fi

REPO="dfultonthebar/Sports-Bar-TV-Controller"
ISO_DIR=/var/www/html/iso
MENU_DIR=/var/www/html/menu
ARCHIVE_DIR=$ISO_DIR/archive
TFTP_DIR=/var/lib/tftpboot

mkdir -p "$ISO_DIR" "$MENU_DIR" "$ARCHIVE_DIR" "$TFTP_DIR"

# Detect LXC's own IP (this is what NUCs need to reach)
LXC_IP=$(ip -4 addr show eth0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1)
if [ -z "$LXC_IP" ]; then
    err "Couldn't detect this LXC's IP on eth0. Fix networking first."
    exit 1
fi
log "This LXC IP: $LXC_IP"

# Resolve the release tag if not pinned
if [ -z "$RELEASE_TAG" ] && [ -z "$TAILSCALE_URL" ]; then
    log "Resolving latest release tag from GitHub ..."
    RELEASE_TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])" 2>/dev/null || true)
    if [ -z "$RELEASE_TAG" ]; then
        err "Couldn't resolve latest release. Pass --release v3.0-YYYY-MM-DD explicitly."
        exit 1
    fi
fi

# Build the ISO from source
ISO_NAME="sports-bar-tv-controller-${RELEASE_TAG}.iso"
ISO_PATH="$ISO_DIR/$ISO_NAME"

# Archive prior ISO (if exists + different)
if [ -f "$ISO_DIR/current.iso" ]; then
    PRIOR=$(readlink -f "$ISO_DIR/current.iso")
    if [ -n "$PRIOR" ] && [ "$(basename "$PRIOR")" != "$ISO_NAME" ]; then
        info "Archiving prior ISO: $(basename "$PRIOR")"
        mv "$PRIOR" "$ARCHIVE_DIR/" 2>/dev/null || true
        rm -f "${PRIOR}".md5 "${PRIOR}".sha256 2>/dev/null || true
    fi
fi

# Fetch ISO
if [ -n "$TAILSCALE_URL" ]; then
    log "Downloading single ISO from Tailscale URL: $TAILSCALE_URL"
    curl -fL --retry 3 -o "$ISO_PATH" "$TAILSCALE_URL"
elif [ ! -f "$ISO_PATH" ]; then
    log "Downloading split parts from GitHub release $RELEASE_TAG ..."
    BASE="https://github.com/$REPO/releases/download/$RELEASE_TAG"
    cd "$ISO_DIR"
    for part in part-aa part-ab; do
        curl -fL --retry 3 -O "$BASE/${ISO_NAME}.${part}"
        curl -fL --retry 3 -O "$BASE/${ISO_NAME}.${part}.md5"
    done
    curl -fL --retry 3 -O "$BASE/${ISO_NAME}.sha256"

    log "Verifying part md5s ..."
    md5sum -c "${ISO_NAME}.part-aa.md5"
    md5sum -c "${ISO_NAME}.part-ab.md5"

    log "Reassembling ..."
    cat "${ISO_NAME}.part-"* > "$ISO_NAME"

    log "Verifying combined sha256 ..."
    sha256sum -c "${ISO_NAME}.sha256"
    log "ISO verified: $ISO_PATH"

    # Clean up parts (keep the sha256 for re-verify)
    rm -f "${ISO_NAME}.part-"* "${ISO_NAME}.part-"*.md5
else
    info "ISO already present at $ISO_PATH (skipping download)"
fi

# Update the "current" symlink so the iPXE menu can stay stable
ln -sfv "$ISO_NAME" "$ISO_DIR/current.iso"

# ─── Extract kernel + initrd + autoinstall seed for the netboot menu ──────────
# v3.1.1 (2026-05-27): sanboot of the WHOLE ISO is a DEAD END for Ubuntu's
# casper-based live-server images — iPXE registers the ISO as a SAN disk, GRUB
# loads, but then casper errors "Unable to find a medium containing a live file
# system" (+ "can't find command 'grub_platform'"), in BOTH UEFI and BIOS.
# The working path (Ubuntu official netboot docs + confirmed live on VM 201):
# boot casper/vmlinuz + casper/initrd directly over HTTP and let casper fetch
# the ISO via the url= kernel param. So extract those + the autoinstall seed
# and serve them over HTTP alongside the ISO.
log "Extracting casper kernel/initrd + autoinstall seed for netboot ..."
CASPER_DIR="/var/www/html/casper"
SEED_DIR="/var/www/html/server"
mkdir -p "$CASPER_DIR" "$SEED_DIR"

# bsdtar (libarchive) reads ISO9660 without root/loop-mount — works even in an
# unprivileged LXC (mount -o loop often can't). Install if missing.
if ! command -v bsdtar >/dev/null 2>&1; then
    log "  Installing libarchive-tools (bsdtar) ..."
    apt-get update -qq && apt-get install -y -qq libarchive-tools
fi
bsdtar -xOf "$ISO_PATH" casper/vmlinuz   > "$CASPER_DIR/vmlinuz"
bsdtar -xOf "$ISO_PATH" casper/initrd    > "$CASPER_DIR/initrd"
bsdtar -xOf "$ISO_PATH" server/user-data > "$SEED_DIR/user-data"
bsdtar -xOf "$ISO_PATH" server/meta-data > "$SEED_DIR/meta-data" 2>/dev/null || : > "$SEED_DIR/meta-data"
chmod 644 "$CASPER_DIR"/* "$SEED_DIR"/*
log "  vmlinuz=$(du -h "$CASPER_DIR/vmlinuz" | cut -f1) initrd=$(du -h "$CASPER_DIR/initrd" | cut -f1); seed served at /server/"

# Write the iPXE menu
log "Writing iPXE menu ..."
cat > "$MENU_DIR/sports-bar.ipxe" <<EOF
#!ipxe

# Sports Bar TV Controller PXE menu (kernel+initrd HTTP autoinstall)
# Generated by configure-netboot-menu.sh on $(date '+%Y-%m-%d %H:%M:%S')
# LXC IP: $LXC_IP   Release: $RELEASE_TAG

:start
menu Sports Bar TV Controller -- Boot Menu
item --gap --             Install
item install              Install Sports Bar TV Controller $RELEASE_TAG (writes to disk)
item live                 Live boot (no install -- test the ISO in RAM)
item --gap --             Tools
item shell                iPXE shell
item reboot               Reboot
choose --default install --timeout 60000 selected || goto install
goto \${selected}

# kernel+initrd over HTTP; casper fetches the ISO via url=; cloud-config-url=
# /dev/null is MANDATORY on 24.04 (without it subiquity ignores the ds= seed and
# drops to the interactive language prompt). Works UEFI + BIOS identically.
:install
echo Booting Sports Bar TV Controller installer (kernel+initrd over HTTP)...
kernel http://$LXC_IP/casper/vmlinuz
initrd http://$LXC_IP/casper/initrd
imgargs vmlinuz initrd=initrd ip=dhcp url=http://$LXC_IP/iso/current.iso autoinstall cloud-config-url=/dev/null ds=nocloud-net;s=http://$LXC_IP/server/ ---
boot || goto failed

:live
echo Booting Sports Bar live (RAM-only test, no install)...
kernel http://$LXC_IP/casper/vmlinuz
initrd http://$LXC_IP/casper/initrd
imgargs vmlinuz initrd=initrd ip=dhcp url=http://$LXC_IP/iso/current.iso cloud-config-url=/dev/null ---
boot || goto failed

:shell
echo Dropping to iPXE shell. Type 'exit' to return to menu.
shell
goto start

:reboot
reboot

:failed
echo Boot failed -- dropping to iPXE shell for diagnosis.
shell
goto start
EOF

# Write the iPXE chain script that NUCs hit first (TFTP-served)
cat > "$TFTP_DIR/sports-bar.ipxe" <<EOF
#!ipxe
chain http://$LXC_IP/menu/sports-bar.ipxe
EOF

# Configure dnsmasq for proxy-DHCP + TFTP
log "Configuring dnsmasq (proxy-DHCP + TFTP) ..."
SUBNET=$(echo "$LXC_IP" | cut -d. -f1-3).0
cat > /etc/dnsmasq.d/sports-bar-pxe.conf <<EOF
# Proxy-DHCP mode — does NOT replace your router's DHCP, just adds PXE info.
# Generated by configure-netboot-menu.sh on $(date '+%Y-%m-%d %H:%M:%S')

# Proxy DHCP (no IP handout; just PXE options + bootfile path)
dhcp-range=${SUBNET},proxy,255.255.255.0

# Disable DNS server (we only want DHCP/TFTP)
port=0

# Enable TFTP
enable-tftp
tftp-root=$TFTP_DIR

# Tag clients already running iPXE (DHCP user-class 175 = "iPXE")
dhcp-match=set:ipxe,175

# Stage 1 — firmware PXE (NOT yet iPXE): hand the right iPXE binary.
# CRITICAL: in PROXY-DHCP mode dnsmasq uses pxe-service= for the firmware boot
# stage, NOT dhcp-boot=. dhcp-boot= is silently ignored under proxy mode, so
# the firmware gets no offer -> "PXE-E16: No valid offer received". (dhcp-boot
# only works in authoritative DHCP mode.) Confirmed live on VM 201 2026-05-27.
pxe-service=tag:!ipxe,x86PC,"iPXE (BIOS)",undionly.kpxe
pxe-service=tag:!ipxe,BC_EFI,"iPXE (UEFI32)",ipxe.efi
pxe-service=tag:!ipxe,X86-64_EFI,"iPXE (UEFI64)",ipxe.efi

# Stage 2 — iPXE has loaded and re-requests (tag ipxe): chain to the HTTP menu.
pxe-service=tag:ipxe,x86PC,"Sports Bar menu",http://$LXC_IP/menu/sports-bar.ipxe
pxe-service=tag:ipxe,X86-64_EFI,"Sports Bar menu",http://$LXC_IP/menu/sports-bar.ipxe
dhcp-boot=tag:ipxe,http://$LXC_IP/menu/sports-bar.ipxe

# Uncomment to debug DHCP/PXE transactions:
# log-dhcp
EOF

# lighttpd needs no special config — defaults serve /var/www/html
# Just make sure docroot is right + restart
log "Configuring lighttpd ..."
sed -i 's|^server.document-root.*|server.document-root = "/var/www/html"|' /etc/lighttpd/lighttpd.conf 2>/dev/null || true

# Enable directory listing for /iso/ so operators can browse
mkdir -p /etc/lighttpd/conf-available
cat > /etc/lighttpd/conf-available/99-sports-bar.conf <<'EOF'
$HTTP["url"] =~ "^/iso/" {
    dir-listing.activate = "enable"
}
$HTTP["url"] =~ "^/menu/" {
    dir-listing.activate = "enable"
}
EOF
ln -sfv /etc/lighttpd/conf-available/99-sports-bar.conf /etc/lighttpd/conf-enabled/99-sports-bar.conf 2>/dev/null || true

# Restart services
log "Starting services ..."
systemctl enable --now dnsmasq lighttpd
systemctl restart dnsmasq lighttpd
sleep 1

# Verify
log "Verifying ..."
if systemctl is-active --quiet dnsmasq; then
    log "  ✓ dnsmasq active"
else
    err "  ✗ dnsmasq not active — check: journalctl -u dnsmasq -n 30"
fi
if systemctl is-active --quiet lighttpd; then
    log "  ✓ lighttpd active"
else
    err "  ✗ lighttpd not active — check: journalctl -u lighttpd -n 30"
fi
if curl -fsS "http://localhost/menu/sports-bar.ipxe" >/dev/null; then
    log "  ✓ menu reachable via HTTP"
else
    err "  ✗ menu not reachable at http://localhost/menu/sports-bar.ipxe"
fi
if [ -f "$ISO_DIR/current.iso" ]; then
    SIZE=$(du -h "$ISO_DIR/current.iso" | awk '{print $1}')
    log "  ✓ ISO present: $ISO_DIR/current.iso ($SIZE)"
fi

echo
echo "==================================================================="
log "Netboot LXC ready."
echo
echo "  Menu URL:    http://$LXC_IP/menu/sports-bar.ipxe"
echo "  ISO URL:     http://$LXC_IP/iso/current.iso ($(du -h "$ISO_DIR/current.iso" 2>/dev/null | awk '{print $1}'))"
echo "  Release:     $RELEASE_TAG"
echo
echo "To PXE-boot a NUC:"
echo "  1. Enable PXE boot in NUC BIOS, set network as first boot device"
echo "  2. Plug NUC into the same LAN as this LXC"
echo "  3. Power on — should see 'Sports Bar TV Controller Boot Menu'"
echo
echo "To update to a newer release:"
echo "  bash $0                          # auto-fetch latest"
echo "  bash $0 --release v3.0-YYYY-MM-DD  # pin a specific version"
echo
echo "Troubleshooting: docs/PROXMOX_PXE_SETUP.md"
