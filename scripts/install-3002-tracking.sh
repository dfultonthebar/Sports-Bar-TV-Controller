#!/usr/bin/env bash
# install-3002-tracking.sh — activate bartender-remote (:3002) connection tracking
# on this box. Idempotent: safe to re-run. Sets up:
#   1. a dedicated nginx access log for the :3002 server block (per-request IP history)
#   2. a per-minute cron that writes a DURABLE, MAC-enriched audit log
#      (conn-track-3002-enrich.sh) + Telegram-alerts the first time a new WAN IP connects
#
# View results anytime with:  scripts/who-hit-3002.sh [--wan|--today|--raw]
#
# MAC note: MACs are only resolvable for LAN devices (same subnet). WAN/internet
# clients have no resolvable MAC (it doesn't survive a router hop) -> recorded as mac=-.
#
# Added 2026-06-29 alongside the Holmgren 3002 WAN exposure. Generic — runs on any box;
# boxes that keep :3002 firewalled to LAN/Tailscale still get useful LAN audit.
set -euo pipefail

REPO="/home/ubuntu/Sports-Bar-TV-Controller"
LOGFMT_CONF="/etc/nginx/conf.d/bartender-3002-log.conf"

echo "[3002-track] locating the :3002 nginx server block..."
SITE=$(grep -rl "listen 3002" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null | head -1 || true)
if [ -z "$SITE" ]; then
  echo "[3002-track] ERROR: no nginx site with 'listen 3002' found. Run setup-bartender-nginx.sh first."
  exit 1
fi
echo "[3002-track] site: $SITE"

# 1. log_format (http context via conf.d) — overwrite is fine (idempotent)
echo "[3002-track] installing log_format -> $LOGFMT_CONF"
sudo tee "$LOGFMT_CONF" >/dev/null <<'EOF'
# Dedicated access-log format for the bartender remote (port 3002).
# $remote_addr is the REAL client IP (clients hit nginx directly on 3002).
log_format bartender3002 '$time_iso8601 ip=$remote_addr method=$request_method uri=$uri status=$status ua="$http_user_agent"';
EOF

# 2. access_log directive in the server block (only if absent)
if sudo grep -q 'bartender-3002.log' "$SITE"; then
  echo "[3002-track] access_log already present in site — skipping"
else
  echo "[3002-track] adding access_log to the :3002 server block"
  # insert right after the 'server_name _;' line that follows 'listen 3002;'
  sudo sed -i '/listen 3002;/{n;/server_name/a\    access_log /var/log/nginx/bartender-3002.log bartender3002;
}' "$SITE"
fi

echo "[3002-track] nginx -t + reload"
sudo nginx -t && sudo systemctl reload nginx

# 3. per-minute enrichment cron (idempotent)
CRON_LINE="* * * * * $REPO/scripts/conn-track-3002-enrich.sh >/dev/null 2>&1"
if crontab -l 2>/dev/null | grep -q 'conn-track-3002-enrich.sh'; then
  echo "[3002-track] cron already installed"
else
  echo "[3002-track] installing per-minute cron"
  ( crontab -l 2>/dev/null; echo "$CRON_LINE" ) | crontab -
fi

chmod +x "$REPO/scripts/conn-track-3002-enrich.sh" "$REPO/scripts/who-hit-3002.sh" 2>/dev/null || true

echo "[3002-track] DONE. View with: $REPO/scripts/who-hit-3002.sh"
echo "[3002-track] (Telegram alerts on new WAN IPs require TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in $REPO/.env)"
