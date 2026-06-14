#!/bin/bash
#
# setup-netboot-lxc.sh — Creates a Debian 12 LXC on a Proxmox host
# pre-loaded with dnsmasq + lighttpd + curl, ready to serve PXE-boot
# the Sports-Bar-TV-Controller ISO.
#
# RUN THIS ON THE PROXMOX HOST (as root or via sudo).
# DO NOT run this on a fleet box (Holmgren, Graystone, etc.) — it's
# Proxmox-host-only and uses `pct` (Proxmox container toolkit).
#
# Usage:
#   bash setup-netboot-lxc.sh                        # defaults: CTID=200, name=sports-bar-netboot
#   bash setup-netboot-lxc.sh --ctid 250 --storage local-lvm
#
# After this completes, run scripts/proxmox/configure-netboot-menu.sh
# INSIDE the new LXC to download the ISO + write the iPXE menu.
#
# See docs/PROXMOX_PXE_SETUP.md for the full operator runbook.
#

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
info() { echo -e "${CYAN}[i]${NC} $*"; }

# Defaults
CTID=200
NAME="sports-bar-netboot"
STORAGE="local-lvm"
BRIDGE="vmbr0"
TEMPLATE_STORAGE="local"
DEBIAN_TEMPLATE="debian-12-standard"
DISK_GB=8
RAM_MB=512
CORES=1

while [[ $# -gt 0 ]]; do
    case "$1" in
        --ctid)    CTID="$2"; shift 2 ;;
        --name)    NAME="$2"; shift 2 ;;
        --storage) STORAGE="$2"; shift 2 ;;
        --bridge)  BRIDGE="$2"; shift 2 ;;
        --disk-gb) DISK_GB="$2"; shift 2 ;;
        --ram-mb)  RAM_MB="$2"; shift 2 ;;
        -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
        *) err "Unknown option: $1"; exit 1 ;;
    esac
done

# Sanity checks
if ! command -v pct >/dev/null 2>&1; then
    err "pct not found — this script must run on a Proxmox host."
    exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
    err "Run as root (sudo bash $0)"
    exit 1
fi
if pct status "$CTID" >/dev/null 2>&1; then
    err "Container $CTID already exists. Use --ctid <other> or destroy the existing one: pct destroy $CTID"
    exit 1
fi

# Find the latest Debian 12 template
log "Looking for $DEBIAN_TEMPLATE template..."
TEMPLATE=$(pveam available --section system 2>/dev/null \
    | awk -v p="$DEBIAN_TEMPLATE" '$2 ~ p {print $2}' | sort | tail -1 || true)
if [ -z "$TEMPLATE" ]; then
    err "No $DEBIAN_TEMPLATE template available. Run: pveam update; pveam available --section system | grep debian"
    exit 1
fi
TEMPLATE_PATH="$TEMPLATE_STORAGE:vztmpl/$TEMPLATE"

# Download template if not present
if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
    log "Downloading template $TEMPLATE ..."
    pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
else
    info "Template $TEMPLATE already in $TEMPLATE_STORAGE"
fi

# Create the container
log "Creating LXC $CTID ($NAME) ..."
pct create "$CTID" "$TEMPLATE_PATH" \
    --hostname "$NAME" \
    --cores "$CORES" \
    --memory "$RAM_MB" \
    --swap 256 \
    --rootfs "$STORAGE:$DISK_GB" \
    --net0 "name=eth0,bridge=$BRIDGE,ip=dhcp" \
    --ostype debian \
    --unprivileged 1 \
    --features nesting=0,keyctl=0 \
    --start 0 \
    --onboot 1 \
    --description "Sports Bar TV Controller PXE boot server. See docs/PROXMOX_PXE_SETUP.md."

log "Container $CTID created. Starting ..."
pct start "$CTID"
sleep 3  # let networking come up

# Confirm container is up
if ! pct status "$CTID" | grep -q running; then
    err "Container $CTID failed to start. Check: pct status $CTID; pct config $CTID"
    exit 1
fi

# Wait for DHCP-assigned IP
log "Waiting for DHCP IP ..."
for i in {1..15}; do
    CT_IP=$(pct exec "$CTID" -- ip -4 addr show eth0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 || true)
    [ -n "$CT_IP" ] && break
    sleep 2
done
if [ -z "$CT_IP" ]; then
    warn "No IP yet. Check: pct exec $CTID -- ip addr"
    CT_IP="<not yet assigned>"
fi
log "Container IP: $CT_IP"

# Install dnsmasq + lighttpd + curl inside the LXC
log "Installing dnsmasq + lighttpd + curl + ipxe inside LXC ..."
pct exec "$CTID" -- bash -c "
    set -e
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq dnsmasq lighttpd curl wget ipxe ca-certificates >/dev/null
    systemctl stop dnsmasq 2>/dev/null || true
    systemctl stop lighttpd 2>/dev/null || true
    mkdir -p /var/www/html/iso /var/www/html/menu /var/lib/tftpboot
    # Copy iPXE binaries into TFTP root
    if [ -d /usr/lib/ipxe ]; then
        cp -v /usr/lib/ipxe/*.efi /var/lib/tftpboot/ 2>/dev/null || true
        cp -v /usr/lib/ipxe/undionly.kpxe /var/lib/tftpboot/ 2>/dev/null || true
    fi
    ls /var/lib/tftpboot/
"

echo
echo "================================================================="
echo
log "LXC $CTID ($NAME) is up at $CT_IP"
echo
echo "Next steps:"
echo
echo "  1. SSH/console into the LXC:"
echo "       pct enter $CTID"
echo
echo "  2. Run the menu configurator INSIDE the LXC:"
echo "       wget -O /root/configure-netboot-menu.sh \\"
echo "         https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/proxmox/configure-netboot-menu.sh"
echo "       bash /root/configure-netboot-menu.sh"
echo
echo "  3. PXE-boot a NUC on the same network. See docs/PROXMOX_PXE_SETUP.md."
echo
echo "  LXC mgmt:"
echo "       pct enter $CTID         # console"
echo "       pct stop $CTID          # stop"
echo "       pct start $CTID         # start"
echo "       pct destroy $CTID       # delete (warning: irreversible)"
