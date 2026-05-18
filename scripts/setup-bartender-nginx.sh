#!/usr/bin/env bash
#
# setup-bartender-nginx.sh
#
# Installs Nginx as the bartender-remote reverse proxy on port 3002.
# Standardized across the fleet (replaces the Node bartender-proxy.js
# PM2 process at v2.32.57+).
#
# Idempotent: safe to re-run.
#
# What this does:
# 1. Installs `nginx` via apt if missing
# 2. Writes /etc/nginx/sites-available/bartender-remote with the
#    canonical bartender allow-list (admin pages blocked, scheduling
#    upstream timeout 300s for AI Suggest)
# 3. Symlinks into sites-enabled, validates, reloads nginx
# 4. Stops + deletes the Node `bartender-proxy` PM2 app if present
#    (so port 3002 doesn't conflict)
# 5. Verifies port 3002 returns 302 from /
#
# This is a one-time setup. Auto-update will NOT re-run it.
#
# Why Nginx over the Node proxy:
# - Slow upstream calls like /api/scheduling/ai-suggest (100s+ at locations
#   with iGPU Ollama) play nicely with Nginx's per-location proxy_read_timeout.
#   The Node proxy ties up its event loop on those requests.
# - OS-managed: survives PM2 restarts, comes up before the app does.
# - Declarative config — operators can grep/diff the allow-list directly.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { echo "[setup-bartender-nginx] $*"; }
fail() { echo "[setup-bartender-nginx] ❌ $*" >&2; exit 1; }

# --- 1. Install nginx ---
if ! command -v nginx >/dev/null 2>&1; then
    log "Installing nginx via apt"
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nginx
fi

# --- 2. Write the bartender-remote site config ---
log "Writing /etc/nginx/sites-available/bartender-remote"
sudo tee /etc/nginx/sites-available/bartender-remote >/dev/null <<'NGINX_CONF'
# Bartender Remote - Restricted proxy on port 3002
#
# Only allows access to the bartender remote page (/remote) and the API
# routes the bartender UI calls. All admin/setup pages return 403.
#
# Standardized config across the fleet — see scripts/setup-bartender-nginx.sh.
# Edit there, not here, so changes propagate when the script is re-run.

server {
    listen 3002;
    server_name _;

    # Redirect root to /remote
    location = / {
        return 302 /remote;
    }

    # Bartender remote page
    location = /remote {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Scheduler Corrections page (override-learn) — operator-facing
    # analytics of bartender corrections during the first 10 min after
    # a scheduled tune. Reachable via the bartender remote menu.
    location = /override-learn {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Next.js static assets
    location /_next/ { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }
    location /favicon.ico { proxy_pass http://127.0.0.1:3001; }
    location /uploads/ { proxy_pass http://127.0.0.1:3001; }

    # --- Allowed API routes ---
    location /api/channel-guide   { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/channel-presets { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/sports-guide/   { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    location /api/devices/         { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/directv-devices  { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/firetv-devices   { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/ir-devices       { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/ir/              { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/directv/         { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/globalcache/     { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    location /api/matrix/      { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/wolfpack/    { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    location /api/tv-control/   { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/tv-discovery/ { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    location /api/streaming/   { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    location /api/schedules/bartender-schedule { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/schedules/recovery           { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/override-learn/              { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    location /api/dmx/              { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/audio-processor   { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/bartender/        { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/soundtrack/       { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    # Atlas audio control: long-poll friendly, no buffering
    location /api/atlas/ {
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    # Atlas priority watcher banner — SEPARATE route from /api/atlas/*
    # (location prefix matching is greedy but the trailing slash on
    # /api/atlas/ means /api/atlas-priority doesn't match it). Powers
    # the amber priority-override banner on bartender Audio tab.
    location /api/atlas-priority { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    # Atlas drop watcher banner — same shape as atlas-priority.
    location /api/atlas-drops    { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    # Shure SLX-D wireless mic status — powers bartender LiveMicChips
    # (v2.38.0), ShureMicStatusPanel, cyan RF interference banner
    # (v2.34.0+). Holmgren 2026-05-18 install caught: missing from
    # the allow-list, so /remote loaded but every poll for shure-rf
    # state returned 403.
    location /api/shure-rf       { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/shure-rf/      { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    location /api/htd/             { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    # exact-match version avoids 301 redirect to /api/htd/
    location = /api/htd            { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    location /api/uploads/         { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }

    # Settings (read-only paths the bartender remote needs)
    location /api/settings/lighting        { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/settings/audio           { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/settings/audio-mapping   { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/settings/default-sources { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location /api/settings/dj-mode         { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

    # AI scheduling suggestions — Ollama inference can take 90-120s on iGPU,
    # 200-300s on CPU. Default proxy_read_timeout (60s) returns 504 before
    # the backend finishes. 300s covers both paths.
    location /api/scheduling/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # AI bartender features (shift-brief, distribution-plan, conflict-suggestion,
    # weekly-summary) — added in v2.21.0, served from /api/ai/*. Same Ollama
    # latency profile as /api/scheduling/, so same 300s timeout.
    location /api/ai/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Block everything else (admin pages, etc.)
    location / {
        default_type application/json;
        return 403 '{"error":"Access denied. This port is restricted to the bartender remote."}';
    }
}
NGINX_CONF

# --- 3. Enable + reload ---
log "Enabling site"
sudo ln -sf /etc/nginx/sites-available/bartender-remote /etc/nginx/sites-enabled/bartender-remote

# Remove the default nginx welcome page if it's still enabled — it'd bind :80
# and confuse anyone hitting the box on the wrong port.
sudo rm -f /etc/nginx/sites-enabled/default

log "Validating + reloading"
if ! sudo nginx -t; then
    fail "nginx config validation failed"
fi
sudo systemctl enable nginx >/dev/null 2>&1 || true
sudo systemctl reload nginx || sudo systemctl restart nginx

# --- 4. Stop + delete Node bartender-proxy if present ---
if pm2 list 2>/dev/null | grep -q '\bbartender-proxy\b'; then
    log "Stopping legacy Node bartender-proxy PM2 app"
    pm2 stop bartender-proxy 2>/dev/null || true
    pm2 delete bartender-proxy 2>/dev/null || true
    pm2 save 2>/dev/null || true
fi

# --- 5. Verify port 3002 ---
sleep 1
http_code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://127.0.0.1:3002/ || echo "000")
case "$http_code" in
    301|302)
        log "✅ Port 3002 → 302 redirect to /remote (verified)"
        ;;
    *)
        fail "port 3002 returned HTTP $http_code (expected 302); check 'sudo nginx -T' and 'sudo journalctl -u nginx'"
        ;;
esac

log "Done. Bartender proxy now served by Nginx on port 3002."
