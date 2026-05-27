#!/bin/bash
# smoke-test-autoinstall.sh — end-to-end test of v3.1.0 autoinstall ISO
#
# Drives Proxmox VM 200 (UEFI/q35/virtio-scsi-pci) from "fresh ISO on disk"
# to "bartender remote returns 200" with ZERO manual intervention.
#
# This replaces smoke-test-vm200.sh (which tested the v3.0.x hand-rolled
# installer with its wizard-walking sendkey YES + Enter dance). The v3.1.0
# autoinstall ISO needs no sendkey input at all — subiquity/curtin handles
# everything from the autoinstall.yaml.
#
# Requirements:
#   - VM 200 already reconfigured to OVMF/q35/virtio-scsi-pci with EFI disk
#   - Autoinstall ISO present at /home/ubuntu/sports-bar-tv-controller-v3.1.0-*.iso
#   - Tailscale SSH access to root@100.118.54.10 (Proxmox)
#   - sshpass installed locally for VM-side SSH
#
# Usage:
#   bash scripts/iso/smoke-test-autoinstall.sh
#   nohup bash scripts/iso/smoke-test-autoinstall.sh > /tmp/smoke-autoinstall.log 2>&1 &

set -uo pipefail

PROXMOX="${PROXMOX:-root@100.118.54.10}"
ISO_PATTERN="sports-bar-tv-controller-v3.1.*.iso"
LOCAL_ISO_GLOB="/home/ubuntu/${ISO_PATTERN}"
VMID="${VMID:-200}"
VM_MAC="${VM_MAC:-bc:24:11:5b:53:45}"
VM_USER="${VM_USER:-ubuntu}"
VM_PASS="${VM_PASS:-ubuntu}"

step()  { echo ""; echo "[$(date +%H:%M:%S)] === $* ==="; }
log()   { echo "[$(date +%H:%M:%S)] [+] $*"; }
warn()  { echo "[$(date +%H:%M:%S)] [!] $*"; }
err()   { echo "[$(date +%H:%M:%S)] [x] $*" >&2; }

px() { ssh -o BatchMode=yes -o StrictHostKeyChecking=no "$PROXMOX" "$@"; }

# ─────────────────────────────────────────────────────────────────
# Phase 1: Find the autoinstall ISO
# ─────────────────────────────────────────────────────────────────
step "Phase 1/8: Locate autoinstall ISO"
LOCAL_ISO=$(ls -t $LOCAL_ISO_GLOB 2>/dev/null | head -1)
[ -n "$LOCAL_ISO" ] && [ -f "$LOCAL_ISO" ] || { err "No autoinstall ISO matching $LOCAL_ISO_GLOB"; exit 1; }
ISO_NAME=$(basename "$LOCAL_ISO")
LOCAL_MD5=$(md5sum "$LOCAL_ISO" | awk '{print $1}')
LOCAL_SIZE=$(stat -c %s "$LOCAL_ISO")
log "Local ISO:  $LOCAL_ISO ($((LOCAL_SIZE/1024/1024)) MB)"
log "Local md5:  $LOCAL_MD5"

# ─────────────────────────────────────────────────────────────────
# Phase 2: SCP to Proxmox (skip if md5 already matches)
# ─────────────────────────────────────────────────────────────────
step "Phase 2/8: SCP ISO to Proxmox"
REMOTE_MD5_BEFORE=$(px "md5sum /var/lib/vz/template/iso/$ISO_NAME 2>/dev/null" | awk '{print $1}' || true)
if [ "$REMOTE_MD5_BEFORE" = "$LOCAL_MD5" ]; then
    log "Proxmox already has this exact ISO — skipping SCP"
else
    log "Copying ISO to Proxmox..."
    scp -o BatchMode=yes "$LOCAL_ISO" "$PROXMOX:/var/lib/vz/template/iso/" || { err "SCP failed"; exit 1; }
    REMOTE_MD5=$(px "md5sum /var/lib/vz/template/iso/$ISO_NAME" | awk '{print $1}')
    [ "$LOCAL_MD5" = "$REMOTE_MD5" ] || { err "md5 mismatch after SCP"; exit 1; }
    log "md5 match: $LOCAL_MD5"
fi

# ─────────────────────────────────────────────────────────────────
# Phase 3: Wipe VM 200 disk + attach ISO + set boot order
# ─────────────────────────────────────────────────────────────────
step "Phase 3/8: Wipe VM 200 + attach ISO"
log "Stopping VM 200..."
px "qm stop $VMID 2>&1 | tail -2; sleep 3"

# Destroy + recreate root disk for fresh install
ZFS_DATASET=$(px "zfs list -H -o name | grep 'vm-${VMID}-disk-0' | head -1" || true)
if [ -n "$ZFS_DATASET" ]; then
    log "Destroying ZFS dataset $ZFS_DATASET for fresh install..."
    px "qm set $VMID -delete scsi0 2>&1 | tail -2"
    px "zfs destroy $ZFS_DATASET 2>&1 | tail -2 || true"
    log "Re-allocating fresh 30G disk with discard+writeback..."
    px "qm set $VMID -scsi0 local-zfs:30,format=raw,discard=on,cache=writeback,ssd=1 2>&1 | tail -3"
fi

log "Attaching autoinstall ISO + setting boot order ide2->scsi0..."
px "qm set $VMID -ide2 local:iso/$ISO_NAME,media=cdrom 2>&1 | tail -2"
px "qm set $VMID -boot order=ide2\;scsi0 2>&1 | tail -2"

# ─────────────────────────────────────────────────────────────────
# Phase 4: Boot VM + let autoinstall run unattended
# ─────────────────────────────────────────────────────────────────
step "Phase 4/8: Boot VM + autoinstall (FULLY UNATTENDED)"
log "Starting VM 200..."
px "qm start $VMID"
log "Autoinstall is now running. subiquity will:"
log "  - boot Ubuntu Server 24.04.4 live env"
log "  - read /cdrom/server/user-data (our autoinstall.yaml)"
log "  - partition disk (GPT + bios_boot + EFI + ext4 root via curtin)"
log "  - install Ubuntu base + linux-image-generic + our extra packages"
log "  - regenerate initramfs (curtin handles this)"
log "  - install GRUB for BIOS+UEFI both"
log "  - run late-commands (copy our first-boot script + enable service)"
log "  - reboot into installed system"
log "Total expected time: ~15-25 min (subiquity refresh + install + reboot)"

# Capture progress screendump every 5 min for debugging
SCREENDUMP_DIR="/tmp/smoke-autoinstall-screens"
mkdir -p "$SCREENDUMP_DIR"

# ─────────────────────────────────────────────────────────────────
# Phase 5: Wait for installed system to boot + appear on network
# ─────────────────────────────────────────────────────────────────
step "Phase 5/8: Wait for installed system on network (deadline 30 min)"
VM_IP=""
DEADLINE=$(( $(date +%s) + 1800 ))
ATTEMPTS=0
SHOTS=0
while [ $(date +%s) -lt $DEADLINE ]; do
    ATTEMPTS=$((ATTEMPTS + 1))
    IP=$(px "ip -4 neigh | grep -i '$VM_MAC' | awk '{print \$1}' | head -1" 2>/dev/null || true)
    if [ -n "$IP" ]; then
        VM_IP="$IP"
        log "🎉 VM 200 on network at $IP (attempt $ATTEMPTS)"
        break
    fi
    # Periodic screendump for debugging if install hangs
    if [ $((ATTEMPTS % 12)) -eq 0 ]; then
        SHOTS=$((SHOTS + 1))
        log "  attempt $ATTEMPTS — no VM yet (capturing screen $SHOTS)"
        px "echo screendump /tmp/smoke-vm${VMID}-${SHOTS}.ppm | qm monitor $VMID > /dev/null" 2>/dev/null || true
        scp -o BatchMode=yes "$PROXMOX:/tmp/smoke-vm${VMID}-${SHOTS}.ppm" "$SCREENDUMP_DIR/" 2>/dev/null || true
        which convert >/dev/null 2>&1 && convert "$SCREENDUMP_DIR/smoke-vm${VMID}-${SHOTS}.ppm" "$SCREENDUMP_DIR/smoke-vm${VMID}-${SHOTS}.png" 2>/dev/null || true
    fi
    sleep 30
done

if [ -z "$VM_IP" ]; then
    err "VM 200 never appeared on network within 30 min"
    err "Screendumps in $SCREENDUMP_DIR"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────
# Phase 6: Wait for SSH on VM
# ─────────────────────────────────────────────────────────────────
step "Phase 6/8: Wait for SSH on $VM_IP"
for i in $(seq 1 20); do
    sleep 15
    if px "nc -z -w 3 $VM_IP 22 2>/dev/null"; then
        log "SSH reachable on $VM_IP:22"
        break
    fi
    [ "$i" = "20" ] && { err "SSH never came up"; exit 1; }
done

# Verify SSH credentials work
SSH_TEST=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 $VM_USER@$VM_IP 'whoami; uname -r'" 2>&1)
log "SSH test: $SSH_TEST"

# ─────────────────────────────────────────────────────────────────
# Phase 7: Wait for first-boot service + PM2
# ─────────────────────────────────────────────────────────────────
step "Phase 7/8: Wait for sports-bar-first-boot.service + PM2 (deadline 25 min)"
log "Polling PM2 status on VM (first-boot clones + builds, takes 10-15 min)..."
PM2_OK=0
for i in $(seq 1 50); do
    sleep 30
    PM2_OUT=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 $VM_USER@$VM_IP 'pm2 jlist 2>/dev/null'" 2>/dev/null || true)
    if echo "$PM2_OUT" | grep -q "sports-bar-tv-controller"; then
        STATUS=$(echo "$PM2_OUT" | python3 -c "import json,sys
try:
    d = json.load(sys.stdin)
    p = [x for x in d if x.get('name') == 'sports-bar-tv-controller']
    print(p[0]['pm2_env']['status'] if p else 'missing')
except Exception as e:
    print('parse-error')" 2>/dev/null || echo "unknown")
        log "  attempt $i/50: PM2 status=$STATUS"
        if [ "$STATUS" = "online" ]; then
            PM2_OK=1
            break
        fi
    else
        log "  attempt $i/50: PM2 has no sports-bar process yet (first-boot still running)"
    fi
done

if [ "$PM2_OK" = "0" ]; then
    err "PM2 sports-bar-tv-controller never reached 'online' in 25 min"
    log "Capturing first-boot.log for diagnosis..."
    px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VM_USER@$VM_IP 'sudo journalctl -u sports-bar-first-boot.service --no-pager | tail -80; echo ---; sudo tail -80 /var/log/sports-bar-first-boot.log 2>/dev/null || true'" || true
    exit 2
fi

# ─────────────────────────────────────────────────────────────────
# Phase 8: Final health checks (admin + bartender)
# ─────────────────────────────────────────────────────────────────
step "Phase 8/8: Final health checks"
ADMIN_HTTP=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VM_USER@$VM_IP 'curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3001/api/health'" 2>/dev/null || echo "0")
BARTENDER_HTTP=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VM_USER@$VM_IP 'curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3002/remote'" 2>/dev/null || echo "0")
VERSION=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VM_USER@$VM_IP 'curl -s http://localhost:3001/api/system/version'" 2>/dev/null || echo '{}')

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "        SMOKE TEST v3.1.0 AUTOINSTALL — FINAL RESULTS"
echo "════════════════════════════════════════════════════════════════════"
echo "  ISO:              $ISO_NAME (md5 $LOCAL_MD5)"
echo "  VM IP:            $VM_IP"
echo "  PM2 status:       online ✅"
echo "  Admin :3001:      $ADMIN_HTTP $([ "$ADMIN_HTTP" = "200" ] && echo '✅' || echo '❌')"
echo "  Bartender :3002:  $BARTENDER_HTTP $(echo "$BARTENDER_HTTP" | grep -qE '^(200|302)$' && echo '✅' || echo '❌')"
echo "  Version:          $VERSION"
echo "════════════════════════════════════════════════════════════════════"

if [ "$ADMIN_HTTP" = "200" ] && echo "$BARTENDER_HTTP" | grep -qE '^(200|302)$'; then
    log "ALL CHECKS PASSED — v3.1.0 autoinstall ISO is production-ready"
    exit 0
else
    err "Some checks failed — investigate"
    exit 3
fi
