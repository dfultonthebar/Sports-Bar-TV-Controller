# NVIDIA Shield TV — Control & Capability Reference ("the PhD")

The definitive reference for controlling, automating, monitoring, and reasoning about the
NVIDIA Shield TV in the Sports-Bar-TV-Controller fleet. Written so the local AI / Hermes can
answer **any** operational question about the Shield. First deployed: Lime Kiln, 2026-06-24.

---

## 1. Identity (live-probed)
- **Model:** NVIDIA SHIELD Android TV **Pro** — codename **`mdarcy`** (2019 generation).
- **OS:** Android **11** (API/SDK 30). Tegra X1+, arm64-v8a, 4 cores, **~3 GB RAM** (Pro; Tube is 2 GB).
- **First unit:** Lime Kiln, IP **192.168.5.134**, MAC `ac:3a:e2:54:37:c3` (NVIDIA OUI), ADB `:5555`.
- In the DB it is a `FireTVDevice` row with **`manufacturer='nvidia'`** — that column keys the device DRIVER (see §7).

## 2. Verdict — is it better than Fire TV for control?
**Yes, meaningfully**, with one caveat:
- ✅ **Scout (our AccessibilityService automation) runs cleanly** — Android 11 has **no** Android-13 "restricted settings" sideload-accessibility lockdown, so the service binds normally (verified bound + receiving window events).
- ✅ **Ad-free, replaceable launcher** → deterministic navigation (Fire TV shoves full-screen ads on wake, which makes tile-clicking fragile).
- ✅ **Granular HDMI-CEC** (Turn-on-TV / set-input / turn-off-TV) → real TV power control.
- ✅ **Faster hardware** (3 GB Pro) → snappier `uiautomator` dumps, fewer autoplay race conditions.
- ✅ **Open** (unlockable bootloader / root) as an escape hatch — Fire TV is locked.
- ⚠️ **CAVEAT — ADB-over-network stability:** the Shield is documented to drop/timeout `:5555` **especially during active playback** and around sleep. For a 24/7 box this is the #1 operational risk → rely on per-device reconnect+backoff, keep it awake, prefer wired Ethernet.

## 3. Control surface (live-probed)
- **ADB transport:** identical to Fire TV (`adb connect <ip>:5555`). Enable on device: Settings → Device Preferences → About → tap **Build** 7× → Developer options → **Network debugging** (NOT just "USB debugging" — only Network debugging opens 5555). First connect pops an RSA "Allow network debugging?" prompt → accept "Always allow". The toggle/auth can reset after reboot/IP change → re-enable + re-accept on recovery.
- **Automation toolkit present:** `screencap`, `screenrecord`, `uiautomator`, `monkey`, `input`, `am`, `pm`, `cmd` — full kit.
- **Sideloading:** allowed (`settings get secure install_non_market_apps` = 1). `adb install -r <apk>` works directly (no Amazon Appstore gatekeeping).
- **Root:** none by default (`su` absent) — not needed for ADB + Scout.
- **HDMI-CEC:** `hdmi_control` service present, `cec:true` on the HDMI port. Use CEC for TV power/input. **Gotcha:** disable "Sleep Shield when TV powers off" / "...when TV input changes" or the control box sleeps out from under your ADB session.
- **Stay-awake:** set `adb shell svc power stayon true` (we do this on connect) + max/disable the screensaver. `stay_on_while_plugged_in=3`, `mWakefulness=Awake` when healthy.
- **Google Play:** present + signed-in (com.android.vending) → apps install from Play.

## 4. Scout (our automation APK) on the Shield
- Package `com.sportsbar.scout`, accessibility service `com.sportsbar.scout/.PlaybackAutomationService` (label "FireStick Scout", capabilities=33, events TYPE_VIEW_FOCUSED / WINDOW_STATE_CHANGED / WINDOW_CONTENT_CHANGED).
- Install: `adb install -r app-debug.apk` (from `firestick-scout/app/build/outputs/apk/debug/`).
- Enable via ADB (no on-screen step on Android 11): `settings put secure enabled_accessibility_services com.sportsbar.scout/.PlaybackAutomationService; settings put secure accessibility_enabled 1`.
- Scout clicks tiles by **content** (UI-agnostic) → ports across the Shield's different app UIs. Future-proof: if NVIDIA ever bumps to Android 13+, add `appops set com.sportsbar.scout ACCESS_RESTRICTED_SETTINGS allow`.

## 5. Apps + packages + launch intents (Shield-specific, live-verified)
The Shield's app builds DIFFER from Fire TV — always use the Shield package:

| App | Shield package | Launch / notes |
|---|---|---|
| ESPN | `com.espn.score_center` | (Fire TV uses `com.espn.gtv`) — no stable deep-link; DPAD/Scout autoplay |
| Prime Video | `com.amazon.amazonvideo.livingroom.nvidia` | NVIDIA build, not `com.amazon.firebat` |
| Netflix | `com.netflix.ninja` | deep-link `am start -d http://www.netflix.com/watch/<id>` autoplays |
| Hulu | `com.hulu.livingroomplus` | (NOT `com.hulu.plus`) — installed at Lime Kiln |
| Peacock | `com.peacocktv.peacockandroid` | `GoogleMainActivity` |
| Paramount+ | `com.cbs.ott` | `UpsellHomeActivity` (sign-in screen) |
| NFHS Network | `com.playon.nfhslive.googletv` | launch `am start -n com.playon.nfhslive.googletv/com.playon.nfhstv.ui.activities.LaunchActivity`; **no public deep-link** → UI nav / Scout |
| Plex | `com.plexapp.android` | |
| YouTube TV | `com.google.android.youtube.tv` | |

**Launch strategy:** deep-links for Netflix/Prime (reliable); DPAD/Scout autoplay for ESPN + NFHS (no stable deep-link); generic launcher (`am start` resolve-activity) otherwise. Apps open to sign-in/intro screens until the bar's accounts are signed in.

## 6. Known gotchas (24/7 commercial)
1. ADB `:5555` timeouts/resets — worst during active playback. Reconnect+backoff is mandatory.
2. Network-debug auth prompt can recur after server/device restart → handle re-auth in recovery.
3. CEC self-sleep on TV input/power change → disable those CEC sleep triggers.
4. Screensaver/sleep on by default → extend/disable + `svc power stayon true`.
5. Forced, non-rollback OS updates → a future Android 13+ bump would reintroduce the accessibility-sideload restriction; consider blocking OTA if rooted.
6. Default launcher has ad rows → consider a clean third-party launcher (FLauncher) for deterministic Scout/DPAD navigation.

## 7. Integration in this system (device-driver architecture, v2.82.36–38)
- The Shield is controlled through `apps/web/src/lib/device-drivers` → `getDriver('nvidia')` → `NvidiaShieldDriver`.
- The driver provides Shield-specific package candidates (`appPackages`) and `usesFireTvAutoplay = false` (generic launch instead of the Fire-TV DPAD-autoplay dance).
- `streaming-service-manager.launchApp()` dispatches by `FireTVDevice.manufacturer` (default `amazon` → Fire TV unchanged).
- So the bartender remote + scheduler drive the Shield exactly like a Fire TV, but with its own packages.

## 8. Monitoring (Hermes)
- The Hermes `firetv-probe` cron (every 4h) probes all `FireTVDevice` rows incl. the Shield → Honcho flywheel (`peer=hermes-firetv-profiler`).
- A deeper Shield-specific probe additionally captures: Scout accessibility-bound state, CEC status, stay-awake, current foreground app, ADB-connection health, and the streaming-app inventory — so Hermes accumulates real Shield operational knowledge over time and can correlate ADB drops with playback.
