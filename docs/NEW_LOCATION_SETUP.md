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

## 8a. Install and authorize ADB for Fire TV control

Fire TV Cubes (and Amazon Fire TV sticks) are controlled via ADB by the
`@sports-bar/firecube` package. There are two undocumented gotchas that
will make Fire TV control silently fail on a fresh host — both bit us at
Stoneyard Appleton — so do this BEFORE configuring Fire TVs in the UI.

### Prereq: install the `adb` binary

The `firecube` package shells out to the system `adb` binary. Ubuntu
22.04 does NOT ship it by default. If it's missing, the package's
`ADBClient` floods PM2 logs with `[ADB CLIENT] Connection error:` lines
that have **empty error messages** (because `exec()` of a missing binary
returns no useful stderr).

```bash
sudo apt install -y android-tools-adb
adb version
# Expect: Android Debug Bridge version 1.0.41 (or similar)
```

### First-time authorization (once per Fire TV)

Each Fire TV on the LAN must be authorized ONCE before this host can
control it. ADB authorization is per-(host-key, device) — the Fire TV
has to physically display a confirmation popup and someone with the Fire
TV remote must walk to each TV and accept it.

1. **Start the ADB server on the host.** This auto-generates
   `~/.android/adbkey` and `~/.android/adbkey.pub` (2048-bit RSA) the
   first time it runs:

   ```bash
   adb start-server
   ```

2. **Try to connect to each Fire TV IP.** Expect `unauthorized` on the
   first attempt — that's the trigger that fires the on-screen popup:

   ```bash
   adb connect 192.168.4.49:5555
   # Expect: connected to 192.168.4.49:5555  (status: unauthorized)
   ```

3. **The Fire TV displays an on-screen dialog** titled "Allow USB
   debugging from this computer?" showing the host's RSA key
   fingerprint. The dialog times out after ~30 seconds — if it does,
   re-run `adb connect` to re-show it.

4. **Walk to each Fire TV with its physical remote.** This step cannot
   be done from the host; it must be done at the TV:

   - **CHECK the "Always allow from this computer" checkbox.** If you
     skip this, the popup re-appears every time the Fire TV reboots and
     the system effectively breaks every power cycle.
   - Click **OK** / **Allow**.

5. **Re-run `adb connect` from the host.** It should now succeed
   cleanly:

   ```bash
   adb connect 192.168.4.49:5555
   # Expect: connected to 192.168.4.49:5555
   ```

6. **Verify all Fire TVs are authorized:**

   ```bash
   adb devices
   ```

   Each authorized Fire TV must show as `device`. If it shows as
   `unauthorized` or `offline`, repeat steps 2-5 for that IP.

Repeat for every Fire TV / Fire Cube / Atmosphere TV at the location.
For Holmgren Way that's 4 devices (192.168.4.48-.51); for a 20+ Fire TV
install it's a per-TV walk — budget time for it.

### Preserve `~/.android/` across reinstalls

This is the part that bites you on a reprovision. The ADB key pair on
the host (`~/.android/adbkey` + `~/.android/adbkey.pub`) IS the host's
identity to every Fire TV it has ever been authorized against. If those
files are deleted or regenerated, every Fire TV at the location must be
re-authorized manually with the physical remote. For a 20+ TV install
that's a full evening of walking around with a Fire TV remote.

Things to know:

- `~/.android/adbkey` (private) and `~/.android/adbkey.pub` (public)
  together form the host's unique ADB identity. Lose either and you're
  re-authorizing every TV.
- A fresh OS install, a different Linux user account running adb, or
  someone running `rm -rf ~/.android/` all wipe the identity.
- The existing location backup flow (System Admin → Location → Backup
  to Git) does **NOT** capture `~/.android/` — it lives outside the
  repo and is a host-level concern that operators must handle
  separately.
- Back up `~/.android/` alongside `/home/ubuntu/sports-bar-data/`
  during any system migration or reprovision.

Suggested one-liner backup (run after the first-time authorization is
complete and store the tarball somewhere durable — off-host, S3, USB,
location's password manager, etc.):

```bash
tar czf ~/android-keys-backup-$(date +%Y%m%d).tar.gz \
  ~/.android/adbkey ~/.android/adbkey.pub
```

To restore on a fresh host (BEFORE running `adb start-server` for the
first time, otherwise it generates a new key pair you don't want):

```bash
mkdir -p ~/.android
tar xzf ~/android-keys-backup-YYYYMMDD.tar.gz -C /
chmod 600 ~/.android/adbkey
adb start-server
adb devices   # all previously-authorized TVs should come back as `device`
```

### Troubleshooting (Fire TV / ADB)

- **`which adb` returns nothing** → `android-tools-adb` package isn't
  installed. `sudo apt install -y android-tools-adb`.
- **PM2 logs show `[ADB CLIENT] Connection error:` with an empty
  message** → same root cause: the `adb` binary is missing. The
  `firecube` package's `exec('adb connect ...')` call fails with no
  stderr because the binary itself can't be found. Install
  `android-tools-adb` and restart PM2.
- **`unauthorized` persists after clicking OK on the TV** → either the
  Fire TV display dimmed/timed out before the popup was tapped, or the
  "Always allow from this computer" checkbox wasn't ticked. Re-run
  `adb connect <ip>:5555` from the host (this re-shows the popup) and
  re-tap with the checkbox ticked.
- **`adb devices` shows `device offline`** → the keep-alive was
  interrupted (Fire TV rebooted, network blip, etc.). Bounce the
  connection:
  ```bash
  adb disconnect 192.168.4.49:5555 && adb connect 192.168.4.49:5555
  ```
- **All Fire TVs re-prompt for authorization after a host reboot** →
  `~/.android/` got wiped, or a different Linux user account is running
  adb than the one that did the original authorization. Check
  `ls -la ~/.android/adbkey*`. If the files are gone, restore from
  backup (above) before re-authorizing every TV by hand.

### Reference links

- Android Debug Bridge official docs: https://developer.android.com/tools/adb
- `@sports-bar/firecube` package source: `packages/firecube/`

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

## 9a. Probe Samsung TVs for real model + verify reachability

Samsung TVs hand out their actual hardware identity over the REST API
at `http://<tv-ip>:8001/api/v2/`. The response includes `modelName`
(e.g. `UN55DU7200DXZA`), `PowerState`, MAC, firmware, etc. The app
uses this to populate `NetworkTVDevice.model` and to make bulk-power
decisions. **You should run the probe once after adding TVs to the
UI** — it catches a few classes of bug early.

Run the probe manually:

```bash
curl -sS -X POST http://localhost:3001/api/tv-discovery/probe-models \
  | python3 -m json.tool
```

Expected response:

```json
{
  "success": true,
  "probed": 20,
  "updated": 10,
  "unreachable": 0
}
```

- `probed` — total Samsung TV rows in the DB
- `updated` — rows where the live `modelName` differed from what was
  stored and was overwritten
- `unreachable` — TVs that didn't respond on :8001 (fully off,
  wrong IP, or behind a router)

**If `unreachable` > 0**, either the TVs are powered off (fully, not
standby — modern Samsungs keep :8001 alive in network standby), or
their IP/MAC in `NetworkTVDevice` is wrong. For fully-off TVs, wake
them first with a bulk power-on and re-run the probe:

```bash
curl -sS -X POST http://localhost:3001/api/tv-control/bulk-power \
  -H "Content-Type: application/json" -d '{"action":"on"}'
# wait ~5 seconds
curl -sS -X POST http://localhost:3001/api/tv-discovery/probe-models \
  | python3 -m json.tool
```

The probe runs automatically at startup (45s delay) and every 4 hours
thereafter, so the model catalog self-heals over a day as TVs cycle
through standby/on states. But running it manually on day-1 tells you
immediately whether every configured IP is reachable.

**Check the result:**

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, ipAddress, model, macAddress FROM NetworkTVDevice \
   WHERE brand='samsung' ORDER BY CAST(SUBSTR(ipAddress, INSTR(ipAddress,'.')+1) AS INT);"
```

Every row should show a real Samsung model string like
`UN55DU7200DXZA` or `UN65TU700DFXZA`. If any row still shows a bogus
value like `LG WebOS` or `Samsung TV` (the latter being the literal
default string, not a real model), that TV was unreachable during the
probe — fix its IP/MAC and re-run.

**MAC address sanity check.** Samsung's vendor-prefix OUIs are the
first 6 hex chars of the MAC: common Samsung prefixes include
`2c:99:75`, `1c:86:9a`, `28:af:42`, `c8:a6:ef`, `b8:b4:09`. A
non-Samsung OUI on a row you believe to be a Samsung TV usually means
the MAC was populated from a non-TV device on the same IP (wrong
static lease, or a previous host) — WoL will fail silently. Fix the
MAC via Device Config in the UI and re-run the probe.

**What the probe protects against** (all hit in production):

1. **Bogus `model` strings.** Stoneyard Appleton had 19 of 20 Samsung
   TVs labeled `"LG WebOS"` in the DB — pasted in by an earlier
   discovery path and never corrected. The probe overwrites them with
   the real modelName.
2. **Silent WoL failures.** If a TV's MAC in the DB has a non-Samsung
   OUI, WoL magic packets go to the wrong device and the TV never
   wakes. The MAC mismatch jumps out when you run the probe and see
   the real `wifiMac` from the JSON response (visible in
   `sqlite3 '...SELECT json FROM ...'` if you also dump the raw
   response, but just comparing OUI prefixes catches most of it).
3. **IP drift.** DHCP lease changes move a TV to a different IP; the
   probe's `unreachable` count spikes and points at the row that
   needs updating.

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

### Bartender remote returns Connection refused after a reboot
→ The PM2 systemd auto-start unit was never installed. On the target
  host run:

    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

  This installs `/etc/systemd/system/pm2-ubuntu.service`. Immediately
  recover with `pm2 resurrect` which restores from `~/.pm2/dump.pm2`
  (must be populated via a prior `pm2 save`). All new installs should
  do this as part of the runbook — see
  `docs/NEW_LOCATION_CLAUDE_PROMPT.md` Step 10b.

### Wolf Pack beeps twice on every bartender route click
→ Fixed in v2.5.x. Symptom: bartender taps to route an input to an
  output, Wolf Pack beeps for the route command (expected), then beeps
  again ~5 seconds later for seemingly no reason. The second beep was
  our `/api/matrix/routes` cache being invalidated on the successful
  POST, forcing the next 15s poll to re-query the hardware. Fix: the
  POST handler now calls `updateRoutesCache(outputNum, inputNum)`
  instead of `invalidateRoutesCache()`, mutating the cached entry in
  place with the already-known new state and refreshing the TTL so the
  next poll returns cached data without touching the Wolf Pack.

  If you still see double-beeps, either the cache wasn't populated yet
  (first route after a restart, expected once) or there are multiple
  clients hitting the endpoint simultaneously. Check
  `/api/matrix/routes` returns `"source":"cache-hit"` on back-to-back
  GETs within the 30s TTL.

### Routing tab checkmark disappears for a few seconds after a click
→ Fixed in v2.5.x alongside the double-beep. Symptom: click to route
  an input to an output, the green checkmark appears briefly, then
  disappears, then reappears 10–15 seconds later. This was the Wolf
  Pack's 0xFFFF "settling window" sentinel leaking through: for ~500ms
  after a route command, the read-only `o2ox` query can return 65535
  for the just-changed output, which our server normalizes to -1 and
  filters out of the response. The client then did a fresh
  `new Map()` replace and any output missing from the response got
  dropped from `currentSources`, blanking the checkmark.

  Fix: `loadCurrentRoutes()` now MERGES into the existing map rather
  than replacing — missing outputs preserve their last-known value.

  Combined with the beep-fix above, a bartender click now fires one
  beep (the actual route), updates the UI instantly from local state,
  and the next 30s of polls are cache-hits with no Wolf Pack traffic.

### Samsung TV keeps turning itself off
Investigate in this order, easiest first:

1. **Eco Solution settings** (most common). Samsung → **Settings** →
   **General** → **System Manager** → **Eco Solution**. Turn OFF:
   - **Auto Power Off** (time-based N-hour idle shutoff)
   - **No Signal Power Off** (shuts down on black HDMI input; default
     ~15 min on 2021+ models)
   - **Ambient Light Detection** (dims then offs in dark rooms)

2. **Time menu schedules**. Samsung → **Settings** → **System** (or
   **General**) → **Time**. Turn OFF:
   - **Sleep Timer** (one-shot N-minute countdown — easy to leave on
     accidentally via the remote)
   - **On/Off Timer** (daily schedule — can shut off at 2 AM even in
     mid-service)

3. **Anynet+ (HDMI-CEC)**. Samsung → **Settings** → **General** →
   **External Device Manager** → **Anynet+ (HDMI-CEC)** → **Off**.
   With Anynet+ on, the TV follows CEC standby messages from the
   Wolf Pack matrix or any cable box in the chain. Some Wolf Pack
   firmwares emit CEC standby when a routing change happens, which
   will power-cycle every TV with Anynet+ enabled.

4. **Our app is sending unwanted commands**. Grep the PM2 log:

       grep -E '10\.40\.10\.X' /home/ubuntu/.pm2/logs/sports-bar-tv-controller-out.log | \
         grep -E 'Power toggle|KEY_POWER|bulk-power'

   Count the entries. A `KEY_POWER` is a TOGGLE on Samsung, so if our
   app sends it when the TV is on the TV turns off. Look for patterns
   that don't correspond to operator-initiated bulk-power or per-TV
   taps.

5. **`sendKey('KEY_POWER')` vs `sendKey('KEY_POWEROFF')`**. Samsung's
   `sendKey` API does NOT expose a non-toggle `KEY_POWEROFF` —
   `KEY_POWER` is the only verb and it's a toggle. The bulk-power
   route's off path:
   - Pre-probes every Samsung TV via REST at `:8001/api/v2/`
     (`probeSamsungTV` in `apps/web/src/lib/samsung-model-probe.ts`).
   - Reads the `PowerState` field: `"on"` → send `KEY_POWER` to
     toggle off; `"standby"` or REST unreachable → skip (already off).
   - Waits 6 seconds, re-probes, and retries once on any Samsung that
     didn't actually change state.

   The "on" path delegates to `SamsungTVClient.powerOn()` which sends
   WoL first and then a conditional `KEY_POWER` only if the post-WoL
   probe reports `standby`. See commits `946655e4` (action=on
   refactor) and `f54f25c0` (REST PowerState probe + model catalog).

   **Do NOT probe port 8002 to decide if a TV is on.** 2024+ Samsung
   models (e.g. DU7200 series) keep the WebSocket control port open
   in network standby so WoL still works. A TCP connection to 8002
   succeeding tells you only that the TV is network-reachable, not
   that its screen is lit. This was the root cause of the
   "bulk-power claims success but 7 TVs stay on" bug at Stoneyard
   Appleton — the verification layer had been reading 8002 and
   incorrectly concluding standby TVs were on.

### Fire TV `adb connect` shows "unauthorized" after every reboot
→ The host's `~/.android/adbkey` was deleted or the filesystem is
  ephemeral. Each Fire TV's authorization is keyed to the host's RSA
  key pair — wipe the keys, every TV re-prompts. Preserve
  `~/.android/adbkey` and `~/.android/adbkey.pub` across any OS
  reinstall. See §8a "Install and authorize ADB for Fire TV control".

## Quick reference

- **Admin login** → `/login` with the admin PIN
- **Force unauth check** → `/api/auth/whoami`
- **Sync tab** → `/system-admin?tab=sync` (deep-links directly after login)
- **Auto Update run** → Sync tab → "Run Update Now" → log modal auto-opens
- **Current version** → `/api/system/health` → top-level `"version"` field
- **Verify deploy** → `bash scripts/verify-install.sh` → expect PASS 6/6
- **Main archive backup** → `git push origin main-archive-20260414:main --force-with-lease` rolls main back to pre-reconcile state
