# New Location Setup Guide

End-to-end runbook for deploying Sports Bar TV Controller to a fresh bar
location. Assumes a clean Ubuntu 22.04+ host with at least 8 GB RAM and
network access to the LAN devices (matrix, Fire TVs, DirecTV receivers,
Atlas audio processor, etc.) the location uses.

This guide covers everything this morning's deployment work uncovered —
auth bootstrap, `LOCATION_ID` binding, cookie flag on HTTP LANs, and the
`AuthPin` seeding step that used to be invisible. See also:

- `docs/AUTO_UPDATE_SETUP.md` — auto-update system state location and operator runbook
- `docs/HARDWARE_CONFIGURATION.md` — physical hardware setup (IRs, matrix, audio)
- `CLAUDE.md` — architecture reference and branch strategy

## 0. Prerequisites

On the target host before starting:

```bash
sudo apt update && sudo apt install -y git nodejs npm sqlite3 build-essential
sudo npm install -g pm2
node --version    # ≥ 18.17
```

The target host needs:
- Internet access for `git pull` and `npm ci`
- LAN access to the venue hardware (matrix, TVs, Fire TVs, audio processor)
- Inbound TCP 3001 open for bartender access (plus 3002 if using the
  nginx/node bartender proxy)
- ~20 GB free disk for logs and future builds

## 1. Clone and initial build

```bash
cd /home/ubuntu
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
git checkout main

# Install deps and do a first build (takes ~3 minutes)
npm ci
npm run build
```

At this point `main` is the clean template — empty location data files,
all software up to date.

## 2. Create the `/home/ubuntu/sports-bar-data` directory

```bash
mkdir -p /home/ubuntu/sports-bar-data/{backups,update-logs,logs}
```

The first app start will create `production.db` inside this directory.

## 3. First app start (creates DB)

```bash
pm2 start ecosystem.config.js
sleep 8
pm2 logs sports-bar-tv-controller --lines 40 --nostream | tail
```

Verify the app is up:

```bash
curl -sS http://localhost:3001/api/system/health | head -c 200
```

Should return JSON with `"status":"healthy"`. If you see connection
refused, check `pm2 list` and `pm2 logs` for startup errors. Most
startup errors on a fresh host are about missing optional config —
the app should start anyway and report hardware as offline.

## 4. Bootstrap auth + location binding

This is the step that was missing before today. It:

1. Creates the `Location` row in `production.db`.
2. Writes `LOCATION_ID` + `LOCATION_NAME` + `AUTH_COOKIE_SECURE=false`
   into `.env` at the repo root.
3. Seeds `AuthPin` rows for STAFF and ADMIN roles with bcrypt-hashed
   PINs.
4. Optionally creates the `location/<slug>` git branch off `main`.

```bash
bash scripts/bootstrap-new-location.sh
```

The script prompts for:
- Location display name (e.g. "Holmgren Way")
- Location slug (auto-derived from name if omitted)
- Timezone (default `America/Chicago`)
- Admin PIN (4 digits, 1000-9999)
- Staff PIN (4 digits)

Or pass them non-interactively:

```bash
bash scripts/bootstrap-new-location.sh \
  --name "Holmgren Way" \
  --slug holmgren-way \
  --timezone America/Chicago \
  --admin-pin 7819 \
  --staff-pin 1234 \
  --non-interactive \
  --create-branch
```

It's safe to re-run — every step is idempotent. It will never overwrite
an existing Location row or existing active PINs (you'll see a "not
overwriting" line in the output).

**Important:** the `AUTH_COOKIE_SECURE=false` flag is deliberate. The
bartender remote uses plain HTTP on the venue LAN (no TLS). Browsers
silently reject Secure cookies over http:// origins, so logging in
would appear to succeed but every subsequent request would be
unauthenticated. Only set `AUTH_COOKIE_SECURE=true` if you put a real
HTTPS reverse proxy (nginx + Let's Encrypt, or Cloudflare Tunnel) in
front of the app.

## 5. Restart PM2 to pick up the new env

```bash
pm2 restart sports-bar-tv-controller --update-env
```

`--update-env` tells PM2 to re-read `ecosystem.config.js`, which loads
the `.env` file via the dotenv shim at the top.

## 6. Verify the login flow end-to-end

```bash
# 1. Check we're unauthenticated:
curl -sS http://localhost:3001/api/auth/whoami
# Expect: {"authenticated":false,"reason":"no session cookie present in request",...}

# 2. Log in with the admin PIN you just seeded:
curl -sS -c /tmp/cookie.txt -X POST -H "Content-Type: application/json" \
  -d '{"pin":"<ADMIN_PIN>"}' http://localhost:3001/api/auth/login
# Expect: {"success":true,"session":{"role":"ADMIN",...}}

# 3. Verify the session is recognized:
curl -sS -b /tmp/cookie.txt http://localhost:3001/api/auth/whoami
# Expect: {"authenticated":true,"role":"ADMIN",...}

# 4. Hit an admin-gated endpoint:
curl -sS -b /tmp/cookie.txt http://localhost:3001/api/system/auto-update/status | head -c 200
# Expect: 200 OK with state JSON
```

If step 2 returns `{"success":false,"error":"Invalid PIN"}`:
- Check `LOCATION_ID` in `.env` matches the `id` column in the `Location`
  table (`sqlite3 production.db "SELECT id FROM Location;"`).
- Check there's an active AuthPin row for that location:
  `sqlite3 production.db "SELECT role, isActive FROM AuthPin WHERE locationId='...';"`
- Re-run the bootstrap script.

If step 3 returns `{"authenticated":false}` despite step 2 succeeding:
- That's the **HTTP Secure cookie** problem. Confirm
  `AUTH_COOKIE_SECURE=false` is in `.env` and that `pm2 env <id>` shows
  it in the process environment.

## 7. Run verify-install

```bash
bash scripts/verify-install.sh
```

Should report **PASS (6/6 checks)**. If it fails on any layer, fix that
before proceeding.

## 8. Point a browser at the host

From a laptop or tablet on the same LAN:

```
http://<host-ip>:3001/system-admin
```

You should see the System Admin page with an amber "⚠ Not signed in"
banner at the top. Click "Log in", enter your admin PIN, and the banner
turns green. Navigate to the Sync tab and you'll see the Auto Update
panel.

The bartender remote for this location is at `http://<host-ip>:3001/remote`
or through the restricted port-3002 proxy if installed.

## 9. Configure hardware in the UI

Use the UI to add your real hardware — NOT the JSON data files directly.
The UI writes to the database, which is the source of truth. The JSON
files are only seed-data inputs on first startup (when the DB tables are
empty); after first run they become inert.

Hardware setup order that's worked for us:

1. **TV layout** — System Admin → Layout tab. Upload a floor plan image,
   place TVs on it, assign zones. This populates the DB tables that the
   matrix routing UI reads from.
2. **Wolf Pack matrix** — Matrix Control page. Add the matrix IP, port,
   chassis model. Inputs come from the matrix's own config; assign
   labels.
3. **Fire TV / DirecTV / IR devices** — Device Config page. Add each
   device with its IP and credentials. Test the connection.
4. **Audio processor** — Audio Control page. Add the Atlas/BSS/dbx IP
   and TCP port. Test and pull zones.
5. **Channel presets** — Bartender remote → Add Channel. Seeds the
   `ChannelPreset` table.
6. **Station aliases** — auto-seeded from the built-in list on first
   startup. Add custom ones via the Channel Presets admin.

Once everything is configured, export the populated state to the
location's JSON files (or just commit the updated files directly if
you edit them) and push to the location branch for backup.

## 10. Commit location data to the location branch

```bash
git add apps/web/data/
git commit -m "feat(<slug>): initial hardware configuration"
git push -u origin location/<slug>
```

**Never merge the location branch back into main.** Location data must
stay on its own branch per the strategy in `CLAUDE.md`.

## 11. Enable auto-update (optional, recommended)

Once the location has been stable for at least one evening of service:

1. Log in as ADMIN at `/system-admin?tab=sync`
2. In the Auto Update panel, toggle **Enabled** on
3. Pick a time (default 02:30 local)
4. Click **Save**
5. Click **Run Update Now** once to validate the full pipeline
6. Watch the log modal — it should show Checkpoint A (Claude Code
   pre-update review) pass, then the merge, build, verify, and
   Checkpoint C all complete successfully

After that, the orchestrator runs automatically at the scheduled time
every day. See `docs/AUTO_UPDATE_SYSTEM_PLAN.md` for the full design
and rollback procedures.

**Note on the systemd timer:** Phase 4 of the auto-update plan
(per-location rollout) recommends installing a systemd user timer so
the scheduled run fires without requiring cron. Until that's automated,
you can either (a) leave the DB-only toggle enabled and fire it
manually from the UI, or (b) hand-install a systemd user timer
pointing at `scripts/auto-update.sh --triggered-by=cron`.

## 12. Rotate the bootstrap PINs

The bootstrap script seeds PINs with descriptions like "Admin PIN —
rotate via Device Config". These are starter values for first-day
deployment. As soon as the venue is live:

1. Add proper STAFF/ADMIN PINs via the UI (when that's built) or via
   direct SQL using `hashPIN` from `packages/auth/src/pin.ts`
2. Mark the bootstrap PINs inactive:
   ```sql
   UPDATE AuthPin SET isActive=0
     WHERE description LIKE '% — rotate via Device Config';
   ```

## Troubleshooting

### "Nothing happens after login"
→ `AUTH_COOKIE_SECURE=true` with HTTP. Check `.env` and restart PM2.

### "Invalid PIN" despite seeding
→ `LOCATION_ID` mismatch. Check `.env` and the `Location` table match.

### Sync tab shows "You must be signed in" even after login
→ Browser has stale JS from before the deep-link fix. Hard refresh
  (Ctrl+Shift+R) or clear site data.

### Auto Update panel Save button stays disabled
→ Fixed as of `9bd78364` — the 15s poll was resetting drafts mid-edit.
  If you're on older code, pull main.

### Auto-update Checkpoint A always returns STOP
→ Fixed as of `9d1f05e3` — the prompt now trusts `LOCATION_PATHS_OURS`
  auto-resolve. If you see this on older code, pull main.

### Bartender remote won't load on port 3002
→ Start the nginx or node proxy. See `apps/web/bartender-proxy.js`.

## Quick reference

- **Admin login** → `/login` with the admin PIN
- **Force unauth check** → `/api/auth/whoami`
- **Sync tab** → `/system-admin?tab=sync` (deep-links directly after login)
- **Auto Update run** → Sync tab → "Run Update Now" → log modal auto-opens
- **Current version** → `/api/system/health` → top-level `"version"` field
- **Verify deploy** → `bash scripts/verify-install.sh` → expect PASS 6/6
- **Main archive backup** → `git push origin main-archive-20260414:main --force-with-lease` rolls main back to pre-reconcile state
