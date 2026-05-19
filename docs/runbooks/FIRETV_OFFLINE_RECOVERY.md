# Fire TV Offline Recovery Runbook

**Purpose:** Recover a Fire TV Cube that has dropped offline (ADB unreachable, app launches fail) — covering ADB authkey backup/restore, port 5555 persistence, manual re-authorization, and static IP requirements.
**Audience:** operators, admins, Claude Code agents.
**Read time:** ~12 minutes.

## When to use this runbook

- Bartender remote shows a Fire TV input as "offline" or app launches return HTTP 500.
- `pm2 logs` shows repeated `device not found` or `unauthorized` errors against a Fire TV IP.
- `adb devices` from the host shows the Fire TV as `offline` or `unauthorized` (not `device`).
- After a Fire TV reboot (manual or OTA), it no longer responds to ADB on port 5555.
- After a router/network change, the Fire TV moved to a new IP and the DB still has the old one.
- A Cube is being replaced — restore ADB trust without making the operator click "Allow" on the Cube screen each boot.

## Pre-flight checks

- [ ] You have physical or remote-eyes access to the Fire TV (someone at the bar with a phone camera if needed).
- [ ] You know the Fire TV's IP from the location's reference doc (Holmgren: `10.11.3.49–10.11.3.51`, `10.11.3.48` for Atmosphere TV).
- [ ] The Fire TV is on a STATIC IP (DHCP reservation in the router OR a manually configured static lease). Dynamic IPs break us — see "Static IP requirement" below.
- [ ] You have an ADB client on the host: `which adb` → `/usr/bin/adb` (or wherever `apt install adb` put it).
- [ ] The host can reach the Fire TV on port 5555: `nc -zv 10.11.3.49 5555`. If this times out, see Step 3 (network path).

## Architecture context

- Fire TV control uses ADB over TCP/IP — port **5555**.
- The host (production server) holds an RSA keypair at `/home/ubuntu/.android/adbkey` + `adbkey.pub`. The Fire TV stores trusted host fingerprints in `/data/misc/adb/adb_keys`.
- First `adb connect` to a fresh Fire TV pops a "Allow USB debugging from this computer?" dialog on the Fire TV screen. Operator must click **Allow** (and check **Always allow**) once. After that, the Fire TV remembers the host's pubkey across reboots — UNTIL the Fire TV is factory-reset or the `adb_keys` file is wiped by an OTA.
- ADB over network MUST be enabled on the Fire TV (Settings → My Fire TV → Developer Options → ADB Debugging = ON). This setting is normally persistent but some Fire OS OTAs reset it.
- Port 5555 must be active on the Fire TV. On most Cubes, enabling Developer Options auto-binds 5555. On some Fire OS builds you must explicitly run `setprop service.adb.tcp.port 5555 && stop adbd && start adbd` once via USB ADB; after that it's persistent.
- The app uses `packages/firecube` with an `adbClient` singleton on `globalThis` (CLAUDE.md Gotcha #10). Stale auth keys, dead sockets, or new pubkeys on the host will cascade across every route.

## Step 1 — Confirm the Fire TV is alive

Walk through these from cheap to expensive.

```bash
# Cheap: ping the device.
ping -c 3 10.11.3.49
```
**Expected:** `0% packet loss`. If 100% loss, the Fire TV is powered off, network-disconnected, or on a different IP. Walk to the bar.

```bash
# Slightly less cheap: TCP probe port 5555.
nc -zv 10.11.3.49 5555
```
**Expected:** `Connection to 10.11.3.49 5555 port [tcp/*] succeeded!`. If the port is closed or filtered, port 5555 isn't bound — see Step 4.

```bash
# Direct adb probe.
adb disconnect 10.11.3.49:5555 2>/dev/null
adb connect 10.11.3.49:5555
adb devices
```

**Possible outputs:**
- `10.11.3.49:5555    device` → ADB is working. The "offline" report from the app is misleading; go to Step 6 (app-layer diagnosis).
- `10.11.3.49:5555    unauthorized` → host pubkey is not trusted. Go to Step 2 (re-authorize).
- `10.11.3.49:5555    offline` → ADB daemon on the Cube is wedged. Reboot the Cube remotely (`adb -s 10.11.3.49:5555 reboot` if you can; otherwise unplug power). If reboot fixes it but it goes offline again within hours, the device is failing — schedule replacement (see Holmgren's pending Fire Cube replacement list in `~/.claude/.../memory/project_holmgren_firecube_replacement.md`).
- `error: failed to connect` → port 5555 is not bound or the Cube blackholes the SYN. Step 4.

## Step 2 — Re-authorize (unauthorized state)

The host's pubkey was wiped from `/data/misc/adb/adb_keys` on the Cube. Causes: factory reset, certain Fire OS OTAs, manual "Revoke USB debugging authorizations" in Developer Options.

**Path A — Operator clicks Allow on the Cube screen:**
1. Tell the operator: "Look at the TV connected to Fire TV [N]. You'll see a dialog 'Allow USB debugging from this computer?' Check the box 'Always allow from this computer' and click OK."
2. From the host, re-run:
   ```bash
   adb disconnect 10.11.3.49:5555
   adb connect 10.11.3.49:5555
   adb devices
   ```
3. Within 30 seconds of the operator clicking Allow, the state should flip to `device`.

**Path B — Operator is unavailable, but you have a host backup of the pubkey:**
1. Verify host pubkey hasn't changed:
   ```bash
   sha256sum /home/ubuntu/.android/adbkey.pub
   ```
   Record this. If your backup tooling has the prior pubkey, compare. If they differ, the host's adb keypair was regenerated — every Fire TV needs re-authorization. Restore from backup:
   ```bash
   cp /home/ubuntu/.android/adbkey.backup /home/ubuntu/.android/adbkey
   cp /home/ubuntu/.android/adbkey.pub.backup /home/ubuntu/.android/adbkey.pub
   chmod 600 /home/ubuntu/.android/adbkey
   adb kill-server
   adb start-server
   adb connect 10.11.3.49:5555
   ```
2. There is no remote path to add a new pubkey to the Cube WITHOUT either an existing ADB trust OR a physical Allow click. If the host key changed and no operator is available, you're stuck until someone is on-site.

**Always-recommended backup of the host adbkey** (so a host rebuild doesn't kill ADB trust on every Fire TV):
```bash
cp /home/ubuntu/.android/adbkey /home/ubuntu/.android/adbkey.backup
cp /home/ubuntu/.android/adbkey.pub /home/ubuntu/.android/adbkey.pub.backup
# Mirror to the data volume that backs up off-site:
cp /home/ubuntu/.android/adbkey.backup /home/ubuntu/sports-bar-data/secrets/
```

## Step 3 — Network path failure (ping fails, but Cube is on)

If `ping` fails:

1. Check the Cube's Wi-Fi (Cube 2nd gen Atmosphere TV ones at Holmgren use Wi-Fi, not Ethernet on some installs). From the Cube remote: **Settings → Network → My Network**. Confirm SSID and signal.
2. Confirm DHCP reservation in the router. Cubes that drop reservation and pick a new IP are the #1 cause of "offline" reports.
3. If the Cube's IP changed, the DB still has the old one. Update:
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db \
     "UPDATE FireTVDevice SET ipAddress='10.11.3.55' WHERE id='firetv-1';"
   pm2 restart sports-bar-tv-controller
   ```
   Better fix: pin the Cube to its original IP via the router's DHCP reservation table.

## Step 4 — Port 5555 not bound

If ping works but `nc -zv ...:5555` fails, ADB-over-network is off on the Cube.

**On the Cube screen (operator):**
1. **Settings → My Fire TV → About → Build** — click 7 times to unlock Developer Options (only needed if Developer menu is hidden).
2. **Settings → My Fire TV → Developer Options → ADB Debugging** = ON.
3. **Apps from Unknown Sources** = ON (only needed if installing scout APK separately).

**Verify port comes up:**
```bash
sleep 5
nc -zv 10.11.3.49 5555
```

Some Fire OS builds need an explicit kick after enabling. If still closed after 30s, the Cube needs a USB-ADB session to run `setprop service.adb.tcp.port 5555 && stop adbd && start adbd`. This is a one-time operation per Cube; once set, it persists across reboots until factory reset.

## Step 5 — ADB shell timeout silently truncates (CLAUDE.md memory)

A common false symptom: ADB works fine for `adb devices`, but `uiautomator dump` returns "empty dump" via our app, while running directly via `adb shell` it succeeds.

**Root cause:** `packages/firecube/src/adb-client.ts:executeShellCommand` has a default 3000ms timeout. On Fire TV Cube foregrounded on the launcher home screen with rail-tile carousels, `uiautomator dump` takes 3-7 seconds. The 3s timeout SIGKILLs the adb process, stdout is empty, the wrapper returns `""` instead of throwing.

**Confirm:**
```bash
# This should succeed in ~5-7s.
adb -s 10.11.3.49:5555 shell "uiautomator dump /sdcard/test.xml && cat /sdcard/test.xml | wc -c"
```

If direct adb works (>5000 chars output) but the app reports empty dump, that's the timeout, NOT a Cube problem. Fix: pass `timeoutMs >= 10000` in the calling code. The walker (`packages/scheduler/src/firetv-catalog-walker.ts`) already does this (v2.32.89+).

**Verification recipe for the timeout fix:**
```bash
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"firetv-1","command":"uiautomator dump /sdcard/test.xml","ipAddress":"10.11.3.49","timeoutMs":10000}'
```

**Expected response:**
```json
{"success": true, "result": "UI hierchary dumped to: /sdcard/test.xml"}
```
(The "hierchary" typo is from Android itself, not us.)

## Step 6 — App-layer diagnosis (ADB works, app still reports offline)

If `adb devices` shows `device` but the bartender remote still shows the Fire TV as offline:

1. **PM2 needs to re-initialize the adbClient.** Because of CLAUDE.md Gotcha #10, the singleton on `globalThis` may have cached a dead socket from before the Cube recovered. Restart:
   ```bash
   pm2 restart sports-bar-tv-controller
   ```

2. **Health check via the app's own endpoint:**
   ```bash
   curl -s http://localhost:3001/api/firetv-devices/firetv-1/current-app | jq .
   ```
   **Expected:** `{"success": true, "package": "com.amazon.firebat", "activity": "..."}`.

3. **If `current-app` returns 500 but `adb shell dumpsys window` works directly,** there is a path-specific bug. Capture and escalate.

## Step 7 — Prime Video / app launch returns "package not found"

Specific to Fire TV Cube 2nd gen (model AFTR, Fire OS 7.7 with PVFTV builds):

**`com.amazon.avod` does NOT exist on these Cubes.** Prime Video is hosted by the Fire TV launcher (`com.amazon.firebat`). Settings → Manage Installed Applications shows a "Prime Video" entry with version `PVFTV-215.5200-L` — that's the LAUNCHER, branded as "Prime Video" in the user-facing list. Don't waste time hunting for the AVOD package.

**Diagnose:**
```bash
adb -s 10.11.3.49:5555 shell "pm path com.amazon.avod"
# Expected on AFTR/PVFTV Cubes: "package not found"

adb -s 10.11.3.49:5555 shell "cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER com.amazon.firebat"
# Expected: com.amazon.firebat/com.amazon.firebatcore.deeplink.DeepLinkRoutingActivity
```

**Fix already in code** (v2.28.8+): `packages/streaming/src/streaming-apps-database.ts` lists `com.amazon.firebat` as a `packageAlias` for the `amazon-prime` catalog entry. `streamingManager.launchApp('amazon-prime')` falls through correctly. If you find a NEW Cube where this still fails, verify the alias is still in the catalog.

**Generalize this** to other Amazon-branded apps (Music, Photos) — they may also be launcher-hosted on certain Fire OS builds. Always verify with `pm path` before trusting the catalog.

## Static IP requirement

Fire TV Cubes MUST have static IPs (or rock-solid DHCP reservations) because:
- The DB stores the IP per device row.
- ADB trust is keyed to host pubkey, not device IP — but our app calls `adb connect <ip>:5555` using the DB row's IP, so an IP change = device unreachable until the row is updated.
- We do not auto-discover Cubes; there is no mDNS scan.

**To pin a Cube's IP via DHCP reservation** (preferred over manually setting a static IP on the Cube — Fire TVs handle DHCP reservations cleanly, but static IPs on the device frequently get reset by OTAs):
1. Capture the Cube's MAC: `adb -s 10.11.3.49:5555 shell "ip link show wlan0 | grep ether"`.
2. Open the router admin UI → DHCP → Address Reservations → Add: MAC = captured, IP = desired.
3. Reboot the Cube to force a fresh DHCP lease: `adb -s 10.11.3.49:5555 reboot`.
4. After reboot, verify: `ping -c 3 <expected-ip>`.

## Verification

After applying any fix:

1. **ADB online:** `adb -s 10.11.3.49:5555 shell echo OK` returns `OK` within 2s.
2. **App reports online:** `curl -s http://localhost:3001/api/firetv-devices/firetv-1/current-app | jq .success` returns `true`.
3. **Launch test:**
   ```bash
   curl -X POST http://localhost:3001/api/streaming/launch \
     -H 'Content-Type: application/json' \
     -d '{"deviceId":"firetv-1","appId":"espn"}'
   ```
   Returns `{"success": true}` and the operator confirms ESPN opened on the TV.
4. **Walker can dump UI:** see Step 5 verification recipe.

## If still broken

- **`adb devices` cycles between `device` and `offline`:** the Cube's adbd is crashing. Reboot the Cube. If it recurs, the Cube hardware is failing — replace.
- **ADB works but `current-app` 500s with stack trace mentioning `EHOSTUNREACH`:** the singleton has a wedged socket and PM2 restart didn't release it. Force `pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js` (see `PM2_RESTART_RUNBOOK.md`).
- **Two Cubes share an IP:** check `ip neigh` on the host. Duplicate MAC/IP pairs cause intermittent ADB failures.

## Escalation path

1. Capture: `adb devices > /tmp/adb-devices.txt`.
2. Capture: `for ip in 10.11.3.48 10.11.3.49 10.11.3.50 10.11.3.51; do echo "=== $ip ==="; ping -c 1 -W 1 $ip; nc -zv $ip 5555 2>&1; done > /tmp/firetv-network.txt`.
3. Capture: `pm2 logs sports-bar-tv-controller --lines 100 --err > /tmp/firetv-errors.txt`.
4. Check the Holmgren replacement list — Fire TV 1 (10.11.3.49) and Atmosphere TV (10.11.3.48) are on the swap list as of 2026-05-18; intermittent ADB errors there are failing hardware, not code.

## Cross-references

- **CLAUDE.md §7** — Hardware Control Layer, `@sports-bar/firecube`.
- **CLAUDE.md Gotcha #9** — Prime Video launcher-hosted on Fire TV Cubes.
- **CLAUDE.md Gotcha #10** — Per-bundle singleton; why PM2 restart is needed after ADB recovery.
- **`packages/firecube/README.md`** — ADB client architecture, retry semantics.
- **Memory file:** `feedback_firetv_prime_video_launcher_hosted.md` — origin of the launcher-hosted Prime Video discovery + diagnostic recipe.
- **Memory file:** `feedback_adb_shell_timeout.md` — origin of the 3s timeout silent truncation.
- **Memory file:** `project_holmgren_firecube_replacement.md` — current swap list for Holmgren Cubes.
- **Memory file:** `feedback_sshpass_heredoc_unreliable.md` — when remoting into a fleet box to diagnose, use single-line ssh+adb instead of heredocs.
- **Related runbook:** `PM2_RESTART_RUNBOOK.md` for the delete+start escalation.
- **Related runbook:** `MATRIX_INPUT_SWITCH.md` for routing a recovered Fire TV to a TV.
- **Source:** `packages/firecube/src/adb-client.ts` — `executeShellCommand` + timeout default.
- **Source:** `packages/scheduler/src/firetv-catalog-walker.ts` — example of correct timeout passing.
- **Source:** `apps/web/src/app/api/firetv-devices/send-command/route.ts` — schema cap of 30000ms.
