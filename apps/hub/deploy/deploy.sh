#!/bin/bash
# SBCC hub deployer (runs on CT211). Receives a pre-built Next.js standalone bundle at
# /root/bundle.tgz (built on a dev box, scp'd here), migrates the hub DB idempotently,
# and restarts the pm2 process. Secrets live in /root/.sbcc-hub.env (chmod 600, NOT in git).
#
# Idempotency: /root/migration.sql uses CREATE TABLE/INDEX IF NOT EXISTS, so re-running on an
# existing DB is a no-op (was the cause of every deploy aborting at migrate before the restart).
set -euo pipefail

[ -f /root/.sbcc-hub.env ] && . /root/.sbcc-hub.env
export HUB_DB_PATH="${HUB_DB_PATH:-/opt/sbcc-hub-data/hub.db}"
mkdir -p /opt/sbcc-hub /opt/sbcc-hub-data

# Rollback safety: snapshot the current app before overwriting it.
if [ -d /opt/sbcc-hub/apps ]; then
  rm -rf /opt/sbcc-hub.bak
  cp -a /opt/sbcc-hub /opt/sbcc-hub.bak
fi

tar xzf /root/bundle.tgz -C /opt/sbcc-hub
node /root/migrate.js   # idempotent (IF NOT EXISTS)

pm2 delete sbcc-hub >/dev/null 2>&1 || true
PORT=3010 HOSTNAME=0.0.0.0 HUB_DB_PATH="$HUB_DB_PATH" HUB_ADMIN_TOKEN="${HUB_ADMIN_TOKEN:-}" \
  pm2 start /opt/sbcc-hub/apps/hub/server.js --name sbcc-hub --update-env >/dev/null
pm2 save >/dev/null 2>&1

sleep 3
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3010/ || echo 000)
echo "DEPLOYED GET / http=$code"
if [ "$code" != "200" ]; then
  echo "⚠ hub not healthy (http=$code). Rollback:"
  echo "    rm -rf /opt/sbcc-hub && mv /opt/sbcc-hub.bak /opt/sbcc-hub && pm2 restart sbcc-hub"
  exit 1
fi
echo "OK — hub healthy on :3010"
