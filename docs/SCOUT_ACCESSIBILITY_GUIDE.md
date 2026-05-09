# Scout AccessibilityService — Install & Operations Guide

**TL;DR for operators:** Run this on each location's host machine, **once**:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git pull
bash scripts/install-scout-accessibility.sh
```

The script auto-discovers your local Fire TV Cubes from `production.db`, builds + installs the new APK on each, and enables the AccessibilityService. Idempotent. Re-run any time. **You do not need to know your Cube IPs** — they're already in your DB.

---

## What this is

Scout v1.5.0+ adds a `PlaybackAutomationService` (an Android `AccessibilityService`) that does in-app playback automation for ESPN, NFHS Network, and Prime Video. When the bartender clicks Watch on a streaming game, Scout's service finds the matching tile in the app's UI and clicks it directly via `AccessibilityNodeInfo.performAction(ACTION_CLICK)` — far more reliable than the old DPAD navigation, and it works without any per-event deep linking (which is gated behind Amazon Comrade for ESPN).

Without Scout v1.5.0 + AS enabled, the bartender Watch button still works via the v2.32.97 host-side text-targeted-tap fallback. **Installing this is an upgrade, not a fix.** Cubes that don't have it run the old (functional but less reliable) path.

## Per-location IPs are auto-discovered (no hardcoding)

Each location has different Cube IPs (e.g. Holmgren uses 10.11.3.50/.51; Greenville uses 10.40.10.92; Graystone uses 192.168.5.131; etc.). The install script reads each location's local `production.db`'s `FireTVDevice` table. **Do not hardcode IPs.** The DB is the source of truth — the same source the rest of the host code uses.

## Per-location server URL is auto-configured

Scout's heartbeat server URL is set TWICE (belt-and-suspenders):

1. **Build-time** — the script auto-writes `scoutServerUrl=http://<host-LAN-IP>:3001/api/firestick-scout` into `firestick-scout/local.properties` if missing. The APK is built with this URL embedded.
2. **Runtime** — after install, the script broadcasts `com.sportsbar.scout.CONFIG --es server_url <url>` to each Cube, which writes the URL to SharedPreferences. The runtime value wins over the build-time default.

The script auto-detects the host's LAN IP via `hostname -I`. Tailscale addresses (100.x.x.x) are skipped; the first real LAN IPv4 wins. **Run the script on the location's host machine, not from a remote shell** — `hostname -I` needs to return that location's LAN IP. (If you SSH to the location and run it there, you're fine.)

## SDK prerequisite

The script needs JDK 17 + Android SDK + adb at `/home/ubuntu/android-sdk`. **Status by location** (as of 2026-05-08):

| Location | SDK present | Ready to run script |
|---|---|---|
| Holmgren | ✓ | Yes |
| Graystone | ✓ | Yes |
| Stoneyard Appleton | ✓ | Yes |
| Leg Lamp | ✗ | Run `bash scripts/install-android-build-env.sh` first |
| Lucky's 1313 | ✗ | Same |
| Greenville | ✗ | Same |

For SDK-less locations: either install the SDK (one-time per host, ~5 minutes), OR copy a pre-built APK from another location:

```bash
# Run on the SDK-less host, copying from Holmgren:
scp ubuntu@holmgren-way:/home/ubuntu/Sports-Bar-TV-Controller/firestick-scout/app/build/outputs/apk/debug/app-debug.apk \
    /home/ubuntu/Sports-Bar-TV-Controller/firestick-scout/app/build/outputs/apk/debug/app-debug.apk
bash scripts/install-scout-accessibility.sh --skip-build
```

## What the script does

1. **Builds the APK** (`firestick-scout/app/build/outputs/apk/debug/app-debug.apk`) via `./gradlew assembleDebug`. Takes ~10 seconds on a warm cache.
2. **Queries `production.db`** for every `FireTVDevice` row that's NOT a placeholder (excludes names containing `REPLAC`, `Atmosphere`, `Epson`).
3. **For each Cube IP:**
   1. `adb connect <ip>:5555`
   2. Compares the installed APK's `versionName` with the new APK's. Skips if same.
   3. `adb install -r <apk>` — non-destructive upgrade install.
   4. Broadcasts `com.sportsbar.scout.CONFIG` with the location's host LAN IP so Scout reports heartbeats to the right server (per-location runtime config overrides build-time default).
   5. `settings put secure enabled_accessibility_services com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService`
   6. `settings put secure accessibility_enabled 1`
   7. Verifies the AS is bound by polling `dumpsys accessibility` for the `FireStick` label (up to 10s).
4. **Prints per-Cube success / skip / fail summary.**

The `settings put secure` commands work on AFTR Fire OS 7.7 (Android 9 / API 28) without root. **Verified on Holmgren Cube 3 — persists across reboots.** Older Fire OS builds may differ; if `dumpsys accessibility` after install does NOT show `FireStick Scout` in the `services:{...}` block, fall back to the manual-enable workflow at the bottom of this doc.

## Prerequisites

The script needs Android SDK + JDK 17 + the `adb` CLI on PATH. If your host has been used to deploy Scout before, you have all of this. If this is a fresh host:

```bash
bash scripts/install-android-build-env.sh
```

(One-time per host. Idempotent.)

## Flags

```bash
# Skip the build step — use whatever's at firestick-scout/app/build/outputs/apk/debug/app-debug.apk
bash scripts/install-scout-accessibility.sh --skip-build

# Install on only a specific Cube (skip DB lookup)
bash scripts/install-scout-accessibility.sh --cube 10.11.3.51

# Print what would happen, don't actually do it
bash scripts/install-scout-accessibility.sh --dry-run
```

## Verifying it works

After the install completes:

```bash
# 1. Verify the AS is active on a Cube
adb -s <CUBE_IP>:5555 shell 'dumpsys accessibility' | head -5
# Expected: services:{Service[label=FireStick Scout, ...]}

# 2. Send a test broadcast and watch the mailbox
adb -s <CUBE_IP>:5555 shell "am broadcast \
  -a com.sportsbar.scout.PLAY_GAME \
  --es target_package com.espn.gtv \
  --es game_title 'TestGame' \
  --es match_tokens 'mariners,white,sox' \
  -n com.sportsbar.scout/.PlayCommandReceiver"

# 3. Open ESPN; the AS sees the window event and clicks
adb -s <CUBE_IP>:5555 shell 'am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER com.espn.gtv/com.espn.startup.presentation.StartupActivity'
sleep 18

# 4. Read the mailbox to see the result
adb -s <CUBE_IP>:5555 shell 'run-as com.sportsbar.scout cat /data/data/com.sportsbar.scout/shared_prefs/scout_play_mailbox.xml'
# Expected last_result=clicked, last_matched_text=<the actual tile that was clicked>
```

## Operator-side experience

After install, the bartender Watch button on ESPN/NFHS games does the same UI flow. The improvement is invisible to the operator unless something fails — and now when something fails, the failure is more accurate (the matched_text in the result is exactly what was clicked, so we know what's playing).

## Troubleshooting

### `dumpsys accessibility` doesn't show FireStick Scout after enable

The settings write succeeded but the AS didn't bind. Possible causes:

- The Cube's Fire OS doesn't honor programmatic AS enable. Workaround: enable manually via Settings → My Fire TV → Developer Options → ADB Debugging → confirm. Then go to Settings → Accessibility → FireStick Scout → toggle on.
- The APK install signed certificate doesn't match the previously-installed Scout. Uninstall + reinstall: `adb shell pm uninstall com.sportsbar.scout && adb install -r <apk>`.

### AccessibilityService is bound but doesn't fire on ESPN events

Look at `logcat` from the Scout process:

```bash
adb -s <CUBE_IP>:5555 shell "logcat -d --pid=$(adb -s <CUBE_IP>:5555 shell pidof com.sportsbar.scout)" | grep PlaybackAutomation
```

Expected on first connect: `PlaybackAutomation: Connected (Scout v1.5.0). Watching ESPN/NFHS/firebat.`

If that line is missing, the service didn't start. Most common cause: `enabled_accessibility_services` is empty or has a different component string. Re-run the install script.

### Click happens but ESPN goes to PageControllerActivity, not PlayerActivity

The click landed correctly but ESPN routed to a detail page. Common when:
- The tile is for an ESPN Unlimited subscription content the Cube isn't logged into.
- ESPN's flow includes a pre-game info card before playback starts.
- The game hasn't started yet (Cube clicked a "View pregame" tile, not the Watch tile).

This is ESPN's behavior post-click, not a bug in the automation. The mailbox `last_matched_text` confirms what was clicked; the operator can see the actual content surfaced.

### Re-enabling after a `settings put secure enabled_accessibility_services ''` accidental clear

If something cleared the AS list (e.g. someone ran the test scripts in this repo's older versions), re-run:

```bash
bash scripts/install-scout-accessibility.sh --skip-build
```

The `--skip-build` flag avoids rebuilding when the APK is unchanged. Just the install + settings + verify steps run.

## Manual install (only if the script fails on your host)

```bash
cd firestick-scout
./gradlew assembleDebug
APK="$(pwd)/app/build/outputs/apk/debug/app-debug.apk"

# Replace 10.11.3.X with each of YOUR Cube IPs (find them via:
#   sqlite3 /home/ubuntu/sports-bar-data/production.db 'SELECT ipAddress FROM FireTVDevice WHERE ipAddress IS NOT NULL;'
# )
for IP in 10.11.3.50 10.11.3.51; do
  adb connect $IP:5555
  adb -s $IP:5555 install -r "$APK"
  adb -s $IP:5555 shell settings put secure enabled_accessibility_services com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService
  adb -s $IP:5555 shell settings put secure accessibility_enabled 1
  echo "$IP done"
done
```

## Rollback

If a future Scout version regresses, roll back to the previous APK. The previous build is preserved at:

```
firestick-scout/app/build/outputs/apk/debug/app-debug.apk
```

every time you build, so keep a copy of the known-good APK before upgrading. Or tag git releases for the APK source. To disable just the AccessibilityService without uninstalling:

```bash
adb -s <CUBE_IP>:5555 shell "settings put secure enabled_accessibility_services ''"
```

The host-side code falls back to the v2.32.97 text-targeted-tap autoplay automatically when the AS isn't running.

## When to roll out to a new location

After confirming v2.32.98 host code is at the location (`grep version /home/ubuntu/Sports-Bar-TV-Controller/package.json` shows `2.32.98` or later), run the install script. Any time. The host already fires the PLAY_GAME broadcast on every Watch click; until the script runs, it's a no-op.

## Currently provisioned (full fleet — 2026-05-08)

| Location | Cubes with v2.1.5 + AS enabled |
|---|---|
| Holmgren | 2/2 (10.11.3.50, 10.11.3.51) ✓ |
| Graystone | 4/4 (192.168.5.131-134) ✓ |
| Stoneyard Appleton | 3/3 (10.40.10.92-94) ✓ |
| Lucky's 1313 | 4/4 (192.168.10.42-45) ✓ |
| Greenville | 3/3 (10.40.10.92-94) ✓ |
| Leg Lamp | N/A (no Amazon Cubes) |

**Fleet total:** 16/16 Amazon Cubes provisioned with Scout v2.1.5-accessibility-automation. Bartender Watch button on ESPN/NFHS games will use the in-app PlaybackAutomationService click path on every Cube, falling through to the v2.32.97 host-side autoplay if anything goes wrong with the AS path.

## Lessons learned during the initial rollout

Two gotchas surfaced (and were folded into the install script):

1. **Stale gradle cache produces APKs without new manifest entries.** The script now always runs `./gradlew --no-daemon clean assembleDebug` (not just `assembleDebug`). Without the `clean`, a previous build's incremental cache can serve an APK whose merged manifest predates the new service/receiver entries.
2. **Each host has its own debug keystore.** When an APK built on one host tries to upgrade-install over an APK built on another, Android rejects with `INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match`. The script now detects this and falls back to `pm uninstall com.sportsbar.scout` + `adb install` (clean install). Loses the previous SharedPreferences (server URL + transient mailbox), which the script re-broadcasts immediately. Both fine to lose.

Re-running the script on a fully-provisioned Cube is a fast no-op (version match + AS already bound).

## Runbook for rolling out to a new location

```bash
# SSH to the location's host
ssh ubuntu@<location-host>

# Pull latest code (auto-update.sh handles this nightly, but you can
# force it now)
cd /home/ubuntu/Sports-Bar-TV-Controller && git pull origin location/<branch>

# If first time on this host: install the Android build env (skip if
# already done)
[ -d /home/ubuntu/android-sdk ] || bash scripts/install-android-build-env.sh

# Run the install — auto-discovers Cubes, builds, installs, enables AS,
# configures heartbeat URL
bash scripts/install-scout-accessibility.sh

# Verify (~30 seconds for a sanity check)
# Replace <CUBE_IP> with one of the Cubes from the install output:
adb -s <CUBE_IP>:5555 shell 'dumpsys accessibility | head -5'
# Should show: services:{Service[label=FireStick Scout, ...]}
```

Total time per location: ~3 minutes including the build. Idempotent — safe to re-run.
