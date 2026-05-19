# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY — Stop the Server-Action Stale-Tab Spam

**Audience:** anyone touching the .env on a fleet box, or setting up a new location.

**TL;DR:** generate one base64 AES-256 key, add `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<key>` to `.env` at every fleet box, rebuild + restart. After this lands, Server Action IDs become stable across redeploys and the `Failed to find Server Action "x"` log spam (132 errors / 3 hours observed on graystone, 2026-05-19) stops bleeding from stale browser tabs.

---

## Why

Per parallel-agent investigation 2026-05-19 (see `docs/AUTO_UPDATE_TROUBLESHOOTING.md` if a Mode #15 lands later):

Next.js 16 App Router uses encrypted Server Action IDs. By default Next.js auto-generates a fresh encryption key at every build, which means every redeploy invalidates browser-cached action references. Any browser tab open at the moment of redeploy starts spamming the new server with old action IDs and gets back `Error: Failed to find Server Action "x". This request might be from an older or newer deployment.`

The error is **cosmetic** — the failed call returns 404-equivalent to the client, no server state corruption — but it pollutes PM2 error logs at 1-2 errors per minute per stale tab. Graystone showed 132 of these in 3 hours from a single stale operator-laptop tab.

The fix is documented at https://nextjs.org/docs/messages/failed-to-find-server-action — set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time to make the key stable across deploys. Action IDs then persist; stale tabs work, or fail gracefully if the action was actually removed (a real signal vs. the spam).

**Note on app code:** there are ZERO `'use server'` directives in `apps/web/src/` or `packages/` — the Server Actions in the bundle come from vendored deps (Drizzle Studio, NextAuth admin, or similar). We don't author Server Actions but we ship code that does. Setting the key is still the right fix.

---

## How (per location, ~5 minutes)

The key MUST be set at BUILD time — runtime-only doesn't help (Next.js bakes it into the bundle). So this is a sequence: set the env var, rebuild, restart.

```bash
ssh ubuntu@<host>     # e.g. ssh ubuntu@graystone-tvcontroller

# 1. Generate a new base64 AES-256 key (32 random bytes)
KEY=$(openssl rand -base64 32)
echo "generated: $KEY"   # save this elsewhere if you need to reproduce

# 2. Append to .env (NOT commit — .env is gitignored)
grep -q "^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=" /home/ubuntu/Sports-Bar-TV-Controller/.env && \
  echo "ALREADY SET, aborting" || \
  echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY" >> /home/ubuntu/Sports-Bar-TV-Controller/.env

# 3. Confirm exactly one entry exists
grep -c "^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=" /home/ubuntu/Sports-Bar-TV-Controller/.env
#       1

# 4. Force-rebuild and restart (auto-update.sh would do this on next merge, but
#    this is a .env-only change so manual is faster)
cd /home/ubuntu/Sports-Bar-TV-Controller
rm -rf apps/web/.next
npm run build
pm2 restart sports-bar-tv-controller --update-env   # --update-env critical to pick up .env

# 5. Verify the key landed in the build
grep -r "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" apps/web/.next/server/ 2>/dev/null | head -1
# Should match (Next.js bakes the value into the server bundle)
```

After step 4, force-reload any open browser tab against this host — it'll pick up new action IDs that are now stable. From here on, redeploys (auto-update) won't invalidate them.

**One key per location vs. one key fleet-wide?** Each location's browser tabs only call that location's server. So a unique per-location key is fine and avoids a single-secret blast radius. If a key leaks, rotate JUST that location.

---

## Verification

After installing the key on a location, the PM2 error log should stop accumulating "Failed to find Server Action" entries from THAT location's browser tabs. Existing pre-key tabs will still spam until they reload — typically self-resolves overnight as the operator-laptop tab sleeps and reopens. To force immediate clearing: in any open browser tab pointing at the location, hard-refresh (Cmd-Shift-R / Ctrl-Shift-R).

```bash
ssh ubuntu@<host>
# Count Server Action errors in the last 10 minutes
pm2 logs sports-bar-tv-controller --lines 1000 --nostream --err 2>/dev/null \
  | grep "Failed to find Server Action" \
  | awk -v cutoff="$(date -d '10 minutes ago' '+%Y-%m-%d %H:%M:%S')" '$0 ~ cutoff' \
  | wc -l
# Expected: 0 after all open tabs have reloaded
```

If the count stays > 0 for 30+ minutes after every browser tab has been refreshed, the key didn't bake into the build — re-run `npm run build` after confirming `.env` has the key.

---

## Bulk fleet rollout

For applying to all 6 boxes in one session via Tailscale SSH:

```bash
# Run from the dev/canary box (Holmgren or wherever you have Tailscale + sudo)
for HOST in hw-sports-bar-tv-controller leglamp-tvcontroller luckys1313 \
            graystone-tvcontroller greenville-stoneyard stoneyard-appleton; do
  echo "=== $HOST ==="
  ssh -o ConnectTimeout=5 ubuntu@${HOST} '
    KEY=$(openssl rand -base64 32)
    cd ~/Sports-Bar-TV-Controller
    if ! grep -q "^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=" .env; then
      echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY" >> .env
      echo "key added"
      rm -rf apps/web/.next
      npm run build > /tmp/build-server-action-key.log 2>&1 &
      echo "build kicked off (PID=$!) — pm2 restart after it completes"
    else
      echo "already set"
    fi
  '
done
# After all 6 build, sweep again to pm2 restart:
for HOST in hw-sports-bar-tv-controller leglamp-tvcontroller luckys1313 \
            graystone-tvcontroller greenville-stoneyard stoneyard-appleton; do
  ssh -o ConnectTimeout=5 ubuntu@${HOST} 'pm2 restart sports-bar-tv-controller --update-env'
done
```

Add to `docs/NEW_LOCATION_SETUP.md` §0 prerequisites — every new install should set this key BEFORE the first `npm run build`, otherwise the first redeploy spams.

---

## Related

- `docs/AUTO_UPDATE_TROUBLESHOOTING.md` — the broader failure-mode catalog
- `docs/SCHEDULER_SERVICE.md` — the 60-sec scheduler tick (the OTHER thing that broke silently on fleet for months)
- Next.js docs: https://nextjs.org/docs/messages/failed-to-find-server-action
- Next.js docs: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions#encryption-key
