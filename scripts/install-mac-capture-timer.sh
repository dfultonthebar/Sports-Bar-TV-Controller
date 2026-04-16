#!/bin/bash
# =============================================================================
# Sports Bar TV Controller — Install systemd user timer for MAC capture
# =============================================================================
# Generates and enables a systemd user service + timer that fires
# scripts/capture-tv-macs.sh twice a day to catch any NetworkTVDevice
# rows that still have no macAddress and resolve them via ARP when the
# TV is powered on.
#
# Default schedule: 15:00 and 22:00 local time — picked for a sports bar
# rhythm (pre-open 3pm walk-through, late-evening check-in). Each run
# wraps the script in `timeout 600s` so a single run can poll for up to
# 10 minutes, giving mid-boot TVs time to settle into ARP.
#
# Safe to re-run: every step is idempotent. If you want different times,
# edit SCHEDULES below and re-run.
#
# Usage:
#   bash scripts/install-mac-capture-timer.sh              # defaults (3pm, 10pm)
#   bash scripts/install-mac-capture-timer.sh --disable    # stop and remove
#
# Exit codes:
#   0 — timer installed and armed (or disabled on --disable)
#   1 — prerequisite error
#   2 — systemctl --user operation failed
# =============================================================================
set -euo pipefail

REPO_ROOT="/home/ubuntu/Sports-Bar-TV-Controller"
USER_UNIT_DIR="$HOME/.config/systemd/user"
SERVICE_UNIT="$USER_UNIT_DIR/sports-bar-mac-capture.service"
TIMER_UNIT="$USER_UNIT_DIR/sports-bar-mac-capture.timer"
CAPTURE_SCRIPT="$REPO_ROOT/scripts/capture-tv-macs.sh"

# Schedule. Add/remove lines here to change when it fires. The America/Chicago
# suffix is needed because our hosts run on UTC (systemd 255+ accepts a
# timezone token at the end of OnCalendar expressions). Change the zone if a
# location is in a different timezone.
SCHEDULES=(
  "*-*-* 18:00:00 America/Chicago"
)

# Per-run timeout and polling interval. The script exits early once all
# pending TVs are resolved, so on quiet days this just pings once and leaves.
RUN_TIMEOUT_SEC=600
POLL_INTERVAL_SEC=10

die()  { echo "[mac-timer-install] ERROR: $*" >&2; exit 1; }
info() { echo "[mac-timer-install] $*"; }

# Handle --disable up front
if [ "${1:-}" = "--disable" ]; then
  info "Stopping and disabling sports-bar-mac-capture.timer"
  systemctl --user disable --now sports-bar-mac-capture.timer 2>&1 || true
  rm -f "$TIMER_UNIT" "$SERVICE_UNIT"
  systemctl --user daemon-reload 2>&1 || true
  info "Removed. Re-run without --disable to reinstall."
  exit 0
fi

# Prereqs
command -v systemctl >/dev/null 2>&1 || die "systemctl not available"
command -v timeout >/dev/null 2>&1 || die "GNU timeout (coreutils) required"
[ -x "$CAPTURE_SCRIPT" ] || die "capture-tv-macs.sh not found or not executable at $CAPTURE_SCRIPT"

mkdir -p "$USER_UNIT_DIR"

# Service unit — a single bounded run of the capture script
cat > "$SERVICE_UNIT" <<EOF
[Unit]
Description=Sports Bar TV Controller — scheduled NetworkTVDevice MAC capture
# No network-online gate; ARP is local and doesn't need the internet,
# plus we want this to run as early as possible to catch TVs that are
# already on when the timer fires.

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
ExecStart=/usr/bin/timeout ${RUN_TIMEOUT_SEC}s /bin/bash $CAPTURE_SCRIPT --interval $POLL_INTERVAL_SEC
# Expected exits: 0 (resolved or partial) or 124 (timeout hit) — both are fine.
SuccessExitStatus=0 124
TimeoutStartSec=$((RUN_TIMEOUT_SEC + 30))
StandardOutput=journal
StandardError=journal
EOF

info "Wrote $SERVICE_UNIT"

# Timer unit — multiple OnCalendar lines trigger at each scheduled time
{
  echo "[Unit]"
  echo "Description=Sports Bar TV Controller — twice-daily MAC capture timer"
  echo ""
  echo "[Timer]"
  for sched in "${SCHEDULES[@]}"; do
    echo "OnCalendar=$sched"
  done
  echo "# Catch up on a missed run if the machine was off"
  echo "Persistent=true"
  echo "# Randomize by 30s across locations so we don't all ping at the exact same tick"
  echo "RandomizedDelaySec=30"
  echo "Unit=sports-bar-mac-capture.service"
  echo ""
  echo "[Install]"
  echo "WantedBy=timers.target"
} > "$TIMER_UNIT"

info "Wrote $TIMER_UNIT"
info "Schedules:"
for sched in "${SCHEDULES[@]}"; do info "  - $sched (local)"; done

info "systemctl --user daemon-reload"
systemctl --user daemon-reload || { echo "[mac-timer-install] daemon-reload failed" >&2; exit 2; }

info "systemctl --user enable --now sports-bar-mac-capture.timer"
systemctl --user enable --now sports-bar-mac-capture.timer || { echo "[mac-timer-install] enable/start failed" >&2; exit 2; }

echo
info "=== Timer installed ==="
systemctl --user list-timers sports-bar-mac-capture.timer --no-pager 2>&1 || true

echo
info 'If this host is headless, ensure "sudo loginctl enable-linger ubuntu"'
info "has been run (once; the auto-update installer may have done it already)."
echo
info "Watch a live run with: journalctl --user -u sports-bar-mac-capture.service -f"
info "Force a run now with:  systemctl --user start sports-bar-mac-capture.service"
info "Disable:               bash scripts/install-mac-capture-timer.sh --disable"
