#!/bin/bash
# =============================================================================
# Sports Bar TV Controller — Install systemd user timer for auto-update
# =============================================================================
# Generates and enables a systemd user service + timer that fires
# scripts/auto-update.sh --triggered-by=cron on the schedule currently
# stored in auto_update_state.schedule_cron.
#
# Why systemd user units instead of cron?
#   - No root or sudoers edit required (per-user unit dir)
#   - Restart policy + journal integration
#   - `systemctl --user enable` is idempotent
#   - `loginctl enable-linger` (one-time, needs sudo) lets the timer
#     fire without an active login session.
#
# Safe to re-run: every step is idempotent. If the DB schedule changes,
# re-run this script to regenerate the .timer unit with the new time.
#
# Usage:
#   bash scripts/install-auto-update-timer.sh
#
# Exit codes:
#   0 — timer installed and enabled
#   1 — prerequisite error (sqlite3/systemctl missing, bad cron string)
#   2 — systemctl --user operation failed
# =============================================================================

set -euo pipefail

REPO_ROOT="/home/ubuntu/Sports-Bar-TV-Controller"
DB_PATH="/home/ubuntu/sports-bar-data/production.db"
USER_UNIT_DIR="$HOME/.config/systemd/user"
SERVICE_UNIT="$USER_UNIT_DIR/sports-bar-autoupdate.service"
TIMER_UNIT="$USER_UNIT_DIR/sports-bar-autoupdate.timer"
AUTO_UPDATE_SCRIPT="$REPO_ROOT/scripts/auto-update.sh"

die() {
  echo "[timer-install] ERROR: $*" >&2
  exit 1
}

info() { echo "[timer-install] $*"; }

# ---------------------------------------------------------------------------
# Prereqs
# ---------------------------------------------------------------------------
command -v sqlite3 >/dev/null 2>&1 || die "sqlite3 not installed"
command -v systemctl >/dev/null 2>&1 || die "systemctl not available"
[ -f "$DB_PATH" ] || die "production.db not found at $DB_PATH"
[ -x "$AUTO_UPDATE_SCRIPT" ] || die "auto-update.sh not found or not executable at $AUTO_UPDATE_SCRIPT"

# ---------------------------------------------------------------------------
# Read schedule from DB
# ---------------------------------------------------------------------------
SCHEDULE_CRON=$(sqlite3 "$DB_PATH" "SELECT schedule_cron FROM auto_update_state WHERE id=1;" 2>/dev/null || echo "")
[ -z "$SCHEDULE_CRON" ] && die "auto_update_state.schedule_cron is empty — enable auto-update in the Sync tab first"

info "Current DB schedule: $SCHEDULE_CRON"

# Parse the cron string as 5 fields: min hour dom mon dow
# This installer only handles the simple "M H * * *" daily pattern. Weekly
# and more exotic patterns are out of scope for v1 — the DB lets you store
# any cron string, but the timer generator requires a plain daily one.
read -r MIN HR DOM MON DOW <<<"$SCHEDULE_CRON"
if ! [[ "$MIN" =~ ^[0-9]+$ ]] || ! [[ "$HR" =~ ^[0-9]+$ ]]; then
  die "schedule_cron '$SCHEDULE_CRON' does not start with numeric min/hour — only 'M H * * *' daily schedules are supported"
fi
if [ "$DOM" != "*" ] || [ "$MON" != "*" ] || [ "$DOW" != "*" ]; then
  die "schedule_cron '$SCHEDULE_CRON' is not a plain daily schedule (dom/mon/dow must all be *)"
fi
if [ "$MIN" -ge 60 ] || [ "$HR" -ge 24 ]; then
  die "schedule_cron '$SCHEDULE_CRON' has out-of-range min/hour"
fi

# Format for systemd OnCalendar: "*-*-* HH:MM:00"
printf -v ON_CALENDAR '*-*-* %02d:%02d:00' "$HR" "$MIN"
info "systemd OnCalendar: $ON_CALENDAR (local time)"

# ---------------------------------------------------------------------------
# Generate service unit
# ---------------------------------------------------------------------------
mkdir -p "$USER_UNIT_DIR"

cat > "$SERVICE_UNIT" <<EOF
[Unit]
Description=Sports Bar TV Controller — scheduled auto-update run
# Don't start if the network isn't up (we need github.com)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
# The script internally re-execs itself via \`setsid -f\` to detach from
# any parent process group, but when invoked by systemd we're already
# in systemd's own session, so the re-exec is a no-op guarded by the
# AUTO_UPDATE_DETACHED env flag.
ExecStart=/usr/bin/env AUTO_UPDATE_DETACHED=1 $AUTO_UPDATE_SCRIPT --triggered-by=cron
# Longer timeout than the default 90s — a full run with Claude
# checkpoints + npm ci + build can take 5+ minutes.
TimeoutStartSec=15min
# Keep journal entries per run
StandardOutput=journal
StandardError=journal
EOF

info "Wrote $SERVICE_UNIT"

# ---------------------------------------------------------------------------
# Generate timer unit
# ---------------------------------------------------------------------------
cat > "$TIMER_UNIT" <<EOF
[Unit]
Description=Sports Bar TV Controller — daily auto-update timer

[Timer]
# Daily at the time stored in auto_update_state.schedule_cron
OnCalendar=$ON_CALENDAR
# If the machine was off when the timer should have fired, run on boot
Persistent=true
# Randomize by up to 60s so a fleet of locations doesn't hammer github
# at the exact same second
RandomizedDelaySec=60
Unit=sports-bar-autoupdate.service

[Install]
WantedBy=timers.target
EOF

info "Wrote $TIMER_UNIT"

# ---------------------------------------------------------------------------
# Reload + enable + start
# ---------------------------------------------------------------------------
info "systemctl --user daemon-reload"
systemctl --user daemon-reload || { echo "[timer-install] systemctl daemon-reload failed" >&2; exit 2; }

info "systemctl --user enable --now sports-bar-autoupdate.timer"
systemctl --user enable --now sports-bar-autoupdate.timer || { echo "[timer-install] enable/start failed" >&2; exit 2; }

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
echo
info "=== Timer installed ==="
systemctl --user list-timers sports-bar-autoupdate.timer --no-pager 2>&1 || true
echo
info "=== Service unit ==="
systemctl --user status sports-bar-autoupdate.timer --no-pager 2>&1 | head -8 || true
echo
info "Next scheduled run:"
systemctl --user show sports-bar-autoupdate.timer -p NextElapseUSecRealtime --value 2>&1 || true

echo
info "If this host is headless (no active login), also run ONCE (needs sudo):"
info "  sudo loginctl enable-linger ubuntu"
info "That lets the user timer fire even when nobody is logged in."
echo
info "To update the schedule: change it in the Sync tab UI, then re-run"
info "this installer. The DB is the source of truth; the .timer unit is"
info "regenerated from it."
echo
info "To disable: bash scripts/install-auto-update-timer.sh --disable"
info "(not implemented yet — for now: systemctl --user disable --now sports-bar-autoupdate.timer)"

exit 0
