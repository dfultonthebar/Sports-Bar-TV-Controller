#!/usr/bin/env bash
#
# One-time SDR install — apt install rtl-sdr + blacklist the kernel
# DVB-USB driver that would otherwise grab the dongle before our
# user-space tools can. After this runs, plugging an RTL-SDR (NESDR
# Smart or compatible) into any USB port auto-detects within ~5 min
# without an app restart.
#
# Idempotent — safe to re-run after kernel updates or to verify state.
#
# Requires sudo. Optionally rebooting once afterwards is the cleanest
# way to ensure the DVB driver blacklist is applied to the running
# kernel, but `rmmod` is attempted if a reboot is undesirable.
#
# Usage:
#   sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-sdr.sh
#   sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-sdr.sh --no-rmmod
#
# After completion, plug in the RTL-SDR dongle. The SDR watcher will
# auto-detect and start streaming within 5 min (no PM2 restart needed
# — the watcher polls for the dongle when SDR_ENABLED is unset/auto).

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "[setup-sdr] ✗ Must be run as root: sudo bash $0"
  exit 1
fi

BLACKLIST_FILE="/etc/modprobe.d/blacklist-rtl.conf"
ENV_FILE="/home/ubuntu/Sports-Bar-TV-Controller/.env"
NO_RMMOD=false
for arg in "$@"; do
  [[ "$arg" == "--no-rmmod" ]] && NO_RMMOD=true
done

echo "[setup-sdr] Step 1/5: install rtl-sdr package"
if ! command -v rtl_test >/dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rtl-sdr
  echo "[setup-sdr] ✓ rtl-sdr installed"
else
  echo "[setup-sdr] ✓ rtl-sdr already installed ($(rtl_test -t 2>&1 | head -1 || true))"
fi

echo "[setup-sdr] Step 2/5: blacklist kernel DVB-USB driver"
if [[ ! -f "$BLACKLIST_FILE" ]] || ! grep -q "dvb_usb_rtl28xxu" "$BLACKLIST_FILE"; then
  cat > "$BLACKLIST_FILE" <<'EOF'
# Auto-installed by setup-sdr.sh — keeps the kernel DVB-USB driver
# from grabbing the RTL-SDR dongle before user-space rtl_power /
# rtl_test can claim it. Without this, dmesg shows "dvb_usb_rtl28xxu"
# attaching to the USB device and rtl_test reports "usb_claim_interface
# error -6" / "Failed to open rtlsdr device".
blacklist dvb_usb_rtl28xxu
blacklist rtl2832
blacklist rtl2830
blacklist e4000
blacklist rtl2838
EOF
  echo "[setup-sdr] ✓ wrote $BLACKLIST_FILE"
  BLACKLIST_NEW=true
else
  echo "[setup-sdr] ✓ blacklist already in place"
  BLACKLIST_NEW=false
fi

echo "[setup-sdr] Step 3/5: unload any currently-loaded DVB modules (live, no reboot)"
if [[ "$NO_RMMOD" == "false" ]]; then
  for mod in dvb_usb_rtl28xxu rtl2832 rtl2830; do
    if lsmod | grep -q "^$mod"; then
      rmmod "$mod" 2>/dev/null && echo "[setup-sdr]   unloaded $mod" || echo "[setup-sdr]   $mod busy or already gone"
    fi
  done
else
  echo "[setup-sdr] ✓ skipped rmmod (--no-rmmod). Reboot if a DVB module is loaded."
fi

echo "[setup-sdr] Step 4/5: ensure SDR_ENABLED handling in .env"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^SDR_ENABLED=" "$ENV_FILE"; then
    CURRENT=$(grep "^SDR_ENABLED=" "$ENV_FILE" | tail -1 | cut -d= -f2)
    echo "[setup-sdr] ✓ .env has SDR_ENABLED=$CURRENT"
    if [[ "$CURRENT" == "false" ]]; then
      echo "[setup-sdr]   NOTE: SDR is explicitly disabled. Change to 'auto' or 'true' to start the watcher."
    fi
  else
    # Default to auto — start watcher only when a dongle is detected.
    echo "SDR_ENABLED=auto" >> "$ENV_FILE"
    echo "[setup-sdr] ✓ appended SDR_ENABLED=auto to .env"
    ENV_CHANGED=true
  fi
else
  echo "[setup-sdr]   $ENV_FILE not found — skip (operator must set SDR_ENABLED=auto manually)"
fi

echo "[setup-sdr] Step 5/5: verify dongle detection"
if rtl_test -t 2>&1 | grep -qE "Found 1|Found [2-9]"; then
  echo "[setup-sdr] ✓ RTL-SDR dongle detected — SDR watcher will start within 5 min"
  rtl_test -t 2>&1 | head -10 | sed 's/^/[setup-sdr]   /'
else
  echo "[setup-sdr] ⓘ No dongle currently connected — plug one in any time. The watcher polls every 5 min and will auto-start when it sees the device."
fi

echo ""
echo "[setup-sdr] ✅ Done."
if [[ "${BLACKLIST_NEW:-false}" == "true" ]]; then
  echo "[setup-sdr]   ⚠ Blacklist was newly created — a reboot is recommended to ensure DVB modules don't reload."
fi
if [[ "${ENV_CHANGED:-false}" == "true" ]]; then
  echo "[setup-sdr]   ⚠ .env changed — restart PM2 to pick up SDR_ENABLED: pm2 restart sports-bar-tv-controller --update-env"
fi
echo "[setup-sdr]   Status: curl http://localhost:3001/api/sdr/status | python3 -m json.tool"
