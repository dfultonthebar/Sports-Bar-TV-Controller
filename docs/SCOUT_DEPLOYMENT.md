# Scout — Build, Deploy & Monitoring (per-location)

Scout (`com.sportsbar.scout`) is the on-device AccessibilityService that auto-plays live games by
clicking the right tile inside streaming apps on Fire TV + NVIDIA Shield. As of **v2.2.12** Scout
reports every play outcome back to its location's box, and **each location builds + deploys its own
APK** (so the report-back URL is that location's IP). This is the runbook — referenced by
new-location provisioning (`docs/NEW_LOCATION_SETUP.md`).

## How report-back works (each location → its own IP)
- The APK bakes `SERVER_URL_DEFAULT` at build time from `-PscoutServerUrl` (gradle), and
  `ConfigReceiver` can override it at runtime. Both resolve to `http://<box-LAN-IP>:3001/api/firestick-scout`.
- After every `PLAY_GAME` attempt, Scout POSTs the outcome to `<serverUrl>/play-result`
  (`apps/web/src/app/api/firestick-scout/play-result/route.ts`) → logged + pushed to the Honcho ops
  flywheel (`peer=hermes-scout-results`). The system finally SEES whether Scout actually played the
  game; Hermes learns which titles/apps/devices reliably reach playback.
- Because the URL is the **local box**, a Fire TV at Lime Kiln reports to Lime Kiln, Holmgren to
  Holmgren, etc. — no central server, works on each LAN.

## One-time per box: install build tools
Each location builds its own APK, so the box needs the Android SDK + JDK 17:
```bash
bash scripts/scout/install-build-tools.sh    # installs ~/android-sdk, JDK 17, build-tools 33; idempotent
```
(Holmgren already has it. Lime Kiln + any new box needs this once.)

## Build + deploy to the location's devices
```bash
bash scripts/scout/build-and-deploy.sh        # detects box LAN IP → builds → sideloads → configures
# or a single device:  bash scripts/scout/build-and-deploy.sh --device 192.168.5.134
```
It: detects this box's LAN IP, builds the APK with that IP baked in, then for every Fire TV / Shield
in the `FireTVDevice` table: `adb install -r`, sends the `CONFIG` broadcast (`server_url`), and
enables Scout's accessibility service (appending — preserves any other a11y services).

## Monitoring (Hermes, all locations)
Three independent signals — no device is a black box:
1. **`firetv-probe` Hermes cron** (every 4h, all locations): reports `scout=bound@<version>` per
   device, **self-heals** Scout when it finds it installed-but-not-bound (re-enables the service),
   and surfaces **Scout-version drift** across the fleet. → flywheel `hermes-firetv-profiler`.
2. **Scout heartbeat** (`/api/firestick-scout`): each device sends `scoutVersion` + current app on a
   30s interval — the box's live view of every device.
3. **Play-result flywheel** (`/api/firestick-scout/play-result`): every play outcome
   (`clicked` / `click_failed` / `no_match`) → `hermes-scout-results`. Hermes learns reliability.

The Shield additionally has a deep monitor (`scripts/hermes/shield-probe.py`, every 2h).

## v2.2.12 reliability changes
- **Result-report POST** (above) — closes the fire-and-forget feedback gap.
- **Click retry** — `ACTION_CLICK` retried 3× with backoff (transient un-focusable moments no longer
  burn the whole attempt budget on one click).
- **Longer host window** — `sendScoutPlayGameBroadcast` default `maxAttempts` 60→120.
- **Prime now triggers Scout** — was ESPN-only; Prime relied on DPAD alone.

## v2.2.13 reliability changes
- **Fuzzy tile-matching** — text + query tokens are normalized (punctuation stripped, whitespace
  collapsed) so `ESPN+`↔`espn`, `St. Louis`↔`St Louis`, `team@team`↔`team team` match; plus a
  conservative word-prefix match for longer tokens (len≥4) to catch plurals/truncations. Kept
  intentionally conservative to preserve the tuned confidence thresholds (Pat-McAfee reject +
  Navy/Bucknell accept verified unchanged).
- **On-device playback verification** — after a successful click, Scout watches for a player window
  within 8s and reports **`clicked_verified`** (reached the player) or **`clicked_unverified`** (click
  registered but no player) to the flywheel. The system now learns whether a click actually played
  the game, not just that ACTION_CLICK returned true. Functional risk nil — only the reported
  outcome changes, never what Scout clicks.

## New location / ISO provisioning
A fresh box (subiquity ISO) comes up without the Android SDK. When the location's Fire TVs / Shield
are added: (1) `scripts/scout/install-build-tools.sh`, (2) `scripts/scout/build-and-deploy.sh`. The
Hermes `firetv-probe` cron then monitors Scout there automatically (it iterates `FireTVDevice` rows).
