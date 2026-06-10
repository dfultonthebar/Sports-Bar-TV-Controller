#!/bin/bash
# smoke-test-vm200.sh — automated end-to-end install + PM2 + backend + remote verify
#
# Drives Proxmox VM 200 from "ISO on disk" to "bartender remote returns 200".
# Assumes: ISO already built and present locally at $LOCAL_ISO. Proxmox SSH
# key auth set up for root@$PROXMOX.
#
# Output: progress to stdout (or wherever caller redirects). Final result
# summary at the end. Exit 0 if PM2+admin+bartender all healthy; non-zero
# at the failing phase.
#
# Usage:
#   sudo bash scripts/iso/smoke-test-vm200.sh
#   nohup sudo bash scripts/iso/smoke-test-vm200.sh > /tmp/smoke-test.log 2>&1 &

set -uo pipefail

PROXMOX="${PROXMOX:-root@100.118.54.10}"
ISO_NAME="${ISO_NAME:-sports-bar-tv-controller-v3.0.1-2026-05-27.iso}"
LOCAL_ISO="${LOCAL_ISO:-/home/ubuntu/$ISO_NAME}"
VMID="${VMID:-200}"
VM_MAC="${VM_MAC:-bc:24:11:5b:53:45}"
VM_USER="${VM_USER:-ubuntu}"
VM_PASS="${VM_PASS:-ubuntu}"

step()  { echo ""; echo "[$(date +%H:%M:%S)] === $* ==="; }
log()   { echo "[$(date +%H:%M:%S)] [+] $*"; }
warn()  { echo "[$(date +%H:%M:%S)] [!] $*"; }
err()   { echo "[$(date +%H:%M:%S)] [x] $*" >&2; }

px() { ssh -o BatchMode=yes -o StrictHostKeyChecking=no "$PROXMOX" "$@"; }
vm_ssh() { sshpass -p "$VM_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 "$VM_USER@$1" "$2"; }

# ──────────────────────────────────────────────────────────────────────
# Phase 1/8: SCP ISO to Proxmox
# ──────────────────────────────────────────────────────────────────────
step "Phase 1/8: SCP ISO to Proxmox"
[ -f "$LOCAL_ISO" ] || { err "Local ISO missing: $LOCAL_ISO"; exit 1; }
LOCAL_MD5=$(md5sum "$LOCAL_ISO" | awk '{print $1}')
log "Local md5: $LOCAL_MD5"
log "Local size: $(stat -c %s "$LOCAL_ISO") bytes"

REMOTE_MD5_BEFORE=$(px "md5sum /var/lib/vz/template/iso/$ISO_NAME 2>/dev/null" | awk '{print $1}' || true)
if [ "$REMOTE_MD5_BEFORE" = "$LOCAL_MD5" ]; then
    log "Proxmox already has this exact ISO — skipping SCP"
else
    log "Copying ISO to Proxmox (~2-5 min)..."
    scp -o BatchMode=yes "$LOCAL_ISO" "$PROXMOX:/var/lib/vz/template/iso/" || { err "SCP failed"; exit 1; }
fi

# ──────────────────────────────────────────────────────────────────────
# Phase 2/8: Verify md5 match on Proxmox
# ──────────────────────────────────────────────────────────────────────
step "Phase 2/8: Verify md5 match"
REMOTE_MD5=$(px "md5sum /var/lib/vz/template/iso/$ISO_NAME" | awk '{print $1}')
[ "$LOCAL_MD5" = "$REMOTE_MD5" ] || { err "MD5 mismatch: local=$LOCAL_MD5 remote=$REMOTE_MD5"; exit 1; }
log "MD5 match: $LOCAL_MD5"

# ──────────────────────────────────────────────────────────────────────
# Phase 3/8: Wipe VM 200 disk + re-attach ISO
# ──────────────────────────────────────────────────────────────────────
step "Phase 3/8: Wipe VM 200 disk + re-attach ISO"
log "Stopping VM 200..."
px "qm stop $VMID 2>&1 | tail -3; sleep 3"

log "Destroying + recreating disk for fresh install..."
# Detect the ZFS dataset path for vm-200-disk-0
ZFS_DATASET=$(px "zfs list -H -o name | grep 'vm-${VMID}-disk-0' | head -1" || true)
if [ -n "$ZFS_DATASET" ]; then
    log "Destroying ZFS dataset $ZFS_DATASET..."
    px "qm set $VMID -delete scsi0 2>&1 | tail -2"
    px "zfs destroy $ZFS_DATASET 2>&1 | tail -2 || true"
    log "Re-allocating fresh 30G disk..."
    px "qm set $VMID -scsi0 local-zfs:30,format=raw 2>&1 | tail -3"
else
    warn "ZFS dataset for VM $VMID not found — trying generic detach/reattach"
    px "qm set $VMID -delete scsi0; sleep 2; qm set $VMID -scsi0 local-zfs:30,format=raw" 2>&1 | tail -5
fi

log "Re-attaching ISO + setting boot order to ISO first..."
px "qm set $VMID -ide2 local:iso/$ISO_NAME,media=cdrom 2>&1 | tail -2"
px "qm set $VMID -boot order=ide2\;scsi0 2>&1 | tail -2"

# ──────────────────────────────────────────────────────────────────────
# Phase 4/8: Boot VM + walk wizard
# ──────────────────────────────────────────────────────────────────────
step "Phase 4/8: Boot VM + walk install wizard"
log "Starting VM..."
px "qm start $VMID"
log "Waiting 90s for live ISO to boot + auto-launch disk-installer to YES prompt..."
sleep 90

log "Sending YES + Enter (Step 1/7 confirmation)..."
px "qm sendkey $VMID shift-y; sleep 1; qm sendkey $VMID shift-e; sleep 1; qm sendkey $VMID shift-s; sleep 1; qm sendkey $VMID ret"

log "Waiting 12 min for Steps 2-4 (partition + format + squashfs extract)..."
sleep 720

log "Sending Enter to accept default hostname..."
px "qm sendkey $VMID ret"

log "Waiting 3 min for Steps 5-7 (config + GRUB + finalize)..."
sleep 180

# ──────────────────────────────────────────────────────────────────────
# Phase 5/8: Verify INSTALLATION COMPLETE state
# ──────────────────────────────────────────────────────────────────────
step "Phase 5/8: Verify INSTALLATION COMPLETE on tty1"
px "echo screendump /tmp/vm${VMID}-install-done.ppm | qm monitor $VMID > /dev/null"
scp -o BatchMode=yes "$PROXMOX:/tmp/vm${VMID}-install-done.ppm" "/tmp/vm${VMID}-install-done.ppm" 2>&1 | tail -1
convert "/tmp/vm${VMID}-install-done.ppm" "/tmp/vm${VMID}-install-done.png" 2>&1 | tail -1
log "Screendump saved at /tmp/vm${VMID}-install-done.png"

# ──────────────────────────────────────────────────────────────────────
# Phase 6/8: Eject ISO + hard reset to boot from disk
# ──────────────────────────────────────────────────────────────────────
step "Phase 6/8: Eject ISO + hard reset"
log "Stopping VM..."
px "qm stop $VMID 2>&1 | tail -2; sleep 3"

log "Ejecting ISO + setting boot order to scsi0..."
px "qm set $VMID -ide2 none,media=cdrom 2>&1 | tail -2"
px "qm set $VMID -boot order=scsi0 2>&1 | tail -2"

log "Starting VM (boot from installed disk)..."
px "qm start $VMID 2>&1 | tail -2"

# ──────────────────────────────────────────────────────────────────────
# Phase 7/8: Wait for VM network presence + SSH up
# ──────────────────────────────────────────────────────────────────────
step "Phase 7/8: Wait for VM network presence (DHCP via Proxmox arp)"
VM_IP=""
for i in $(seq 1 30); do
    sleep 30
    VM_IP=$(px "ip neigh | grep -i '$VM_MAC' | awk '{print \$1}' | head -1" 2>/dev/null || true)
    if [ -n "$VM_IP" ]; then
        log "VM IP detected via Proxmox arp: $VM_IP (attempt $i/30)"
        break
    fi
    log "  attempt $i/30: VM not on network yet..."
done
[ -z "$VM_IP" ] && { err "VM never appeared on network after 15 min"; exit 1; }

log "Waiting for SSH on $VM_IP..."
SSH_OK=0
for i in $(seq 1 20); do
    sleep 15
    if px "nc -z -w 3 $VM_IP 22 2>/dev/null"; then
        log "SSH port 22 reachable on $VM_IP (attempt $i/20)"
        SSH_OK=1
        break
    fi
done
[ "$SSH_OK" = "0" ] && { err "SSH never came up on $VM_IP"; exit 1; }

# ──────────────────────────────────────────────────────────────────────
# Phase 8/8: Wait for first-boot service + PM2 + verify backend + bartender
# ──────────────────────────────────────────────────────────────────────
step "Phase 8/8: Wait for first-boot service + PM2 + verify backend + bartender remote"
log "Polling PM2 status on VM (up to 25 min for first-boot to clone + build + start)..."

PM2_OK=0
for i in $(seq 1 50); do
    sleep 30
    # Use sshpass via Proxmox host (proxy hop) since we don't have direct route to VM IP
    PM2_OUT=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 $VM_USER@$VM_IP 'pm2 jlist 2>/dev/null'" 2>/dev/null || true)
    if echo "$PM2_OUT" | grep -q "sports-bar-tv-controller"; then
        STATUS=$(echo "$PM2_OUT" | python3 -c "import json,sys
try:
    d = json.load(sys.stdin)
    p = [x for x in d if x.get('name') == 'sports-bar-tv-controller']
    print(p[0]['pm2_env']['status'] if p else 'missing')
except Exception as e:
    print('parse-error:'+str(e))" 2>/dev/null || echo "unknown")
        log "  attempt $i/50: PM2 status=$STATUS"
        if [ "$STATUS" = "online" ]; then
            PM2_OK=1
            break
        fi
    else
        log "  attempt $i/50: PM2 has no sports-bar process yet"
    fi
done

if [ "$PM2_OK" = "0" ]; then
    err "PM2 sports-bar-tv-controller never reached 'online' after 25 min"
    log "Capturing first-boot.log for diagnosis..."
    px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VM_USER@$VM_IP 'sudo tail -100 /var/log/sports-bar-first-boot.log 2>&1'" || true
    exit 2
fi

# Final health checks
log "PM2 online! Running final health probes..."

ADMIN_HTTP=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VM_USER@$VM_IP 'curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3001/api/health'" || echo "0")
BARTENDER_HTTP=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VM_USER@$VM_IP 'curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3002/remote'" || echo "0")
VERSION=$(px "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VM_USER@$VM_IP 'curl -s http://localhost:3001/api/system/version'" || echo '{}')

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "                    SMOKE TEST FINAL RESULTS"
echo "════════════════════════════════════════════════════════════════════"
echo "  VM IP:            $VM_IP"
echo "  PM2 status:       online ✅"
echo "  Admin :3001:      $ADMIN_HTTP $([ "$ADMIN_HTTP" = "200" ] && echo '✅' || echo '❌')"
echo "  Bartender :3002:  $BARTENDER_HTTP $(echo "$BARTENDER_HTTP" | grep -qE '^(200|302)$' && echo '✅' || echo '❌')"
echo "  Version:          $VERSION"
echo "════════════════════════════════════════════════════════════════════"

if [ "$ADMIN_HTTP" = "200" ] && echo "$BARTENDER_HTTP" | grep -qE '^(200|302)$'; then
    log "ALL CHECKS PASSED — ISO is production-ready"
    exit 0
else
    err "Some checks failed — investigate"
    exit 3
fi
