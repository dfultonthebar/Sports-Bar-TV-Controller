# Amazon Fire TV — ADB Control Reference

**Canonical sources:**
- Amazon Fire TV Remote Input: <https://developer.amazon.com/docs/fire-tv/remote-input.html>
- Fire TV Deep Linking: <https://developer.amazon.com/docs/fire-tv/deep-linking-featured-content.html>
- Fire TV Developer Tools Menu: <https://developer.amazon.com/docs/fire-tv/developer-tools.html>
- Android KeyEvent reference: <https://developer.android.com/reference/android/view/KeyEvent>
- ADB intent examples (community): <https://gist.github.com/mcfrojd/9e6875e1db5c089b1e3ddeb7dba0f304>
- python-firetv (canonical APP/KEYS dicts): <https://github.com/happyleavesaoc/python-firetv/blob/master/firetv/__init__.py>
- Fire TV ADB remote input cheat sheet: <https://gist.github.com/kibotu/76be44aaa1174bdd252a49a1cd7a02f9>

Companion: `FIRETV_QUICK_REFERENCE.md` (in this directory) — bar-specific cheat sheet.
This file is the protocol reference.

---

## Transport — ADB over TCP 5555

Fire TV devices expose Android Debug Bridge (ADB) over the LAN once developer mode + ADB-debugging are enabled.

**Enable ADB** (one-time, per device):
1. `Settings → My Fire TV → About` — click the device-name row **7 times** to unlock Developer Options
2. `Settings → My Fire TV → Developer Options`
   - Set `ADB debugging` = ON
   - Set `Apps from Unknown Sources` = ON (only if sideloading)

**Connect:**
```bash
adb connect <fire-tv-ip>:5555
adb devices            # confirm "device" (not "unauthorized")
adb shell <command>    # one-shot
adb -s <ip>:5555 shell <command>   # multi-device
```

First connection prompts a "Allow USB debugging from..." dialog on the TV — operator must click **Always allow from this computer** on the physical screen with the actual remote.

**Persistence note:** ADB over TCP is enabled until reboot OR until ADB-debugging is toggled off in Settings. After a reboot, the device automatically restarts the ADB-over-TCP listener if the setting is still ON — no operator intervention needed for Fire OS 7+. On Fire OS 6 and earlier the listener does NOT auto-resume after reboot; not relevant for current Cube/Stick hardware.

---

## Key event injection

```bash
adb shell input keyevent <code>
```

Codes from `android.view.KeyEvent`:

### Navigation / system
| Code | Constant | Notes |
|---|---|---|
| 3 | KEYCODE_HOME | Home. Cannot be intercepted by apps; always returns to launcher |
| 4 | KEYCODE_BACK | Back |
| 19 | KEYCODE_DPAD_UP | |
| 20 | KEYCODE_DPAD_DOWN | |
| 21 | KEYCODE_DPAD_LEFT | |
| 22 | KEYCODE_DPAD_RIGHT | |
| 23 | KEYCODE_DPAD_CENTER | Select / "OK" — **the only way to advance ESPN GTV Watch CTA** (see Gotcha #2 below) |
| 26 | KEYCODE_POWER | |
| 66 | KEYCODE_ENTER | |
| 67 | KEYCODE_DEL | Backspace |
| 82 | KEYCODE_MENU | Long-press equivalent on Fire TV remotes |
| 84 | KEYCODE_SEARCH | Voice/search button on remote (cannot be intercepted by apps) |
| 111 | KEYCODE_ESCAPE | |
| 122 | KEYCODE_MOVE_HOME | |
| 123 | KEYCODE_MOVE_END | |
| 176 | KEYCODE_SETTINGS | Opens Settings |
| 223 | KEYCODE_SLEEP | Standby |
| 224 | KEYCODE_WAKEUP | Wake from standby |

### Media transport
| Code | Constant |
|---|---|
| 85 | KEYCODE_MEDIA_PLAY_PAUSE |
| 86 | KEYCODE_MEDIA_STOP |
| 87 | KEYCODE_MEDIA_NEXT |
| 88 | KEYCODE_MEDIA_PREVIOUS |
| 89 | KEYCODE_MEDIA_REWIND |
| 90 | KEYCODE_MEDIA_FAST_FORWARD |
| 126 | KEYCODE_MEDIA_PLAY |
| 127 | KEYCODE_MEDIA_PAUSE |
| 130 | KEYCODE_MEDIA_RECORD | On Fire TV remotes this fires the voice-search overlay |

### Volume (most Fire TV devices route these via CEC; not all hardware accepts them)
| Code | Constant |
|---|---|
| 24 | KEYCODE_VOLUME_UP |
| 25 | KEYCODE_VOLUME_DOWN |
| 164 | KEYCODE_VOLUME_MUTE |

### Numeric (used for PIN entry; not for channel-tuning — Fire TV apps don't accept channel digits)
| Code | Constant |
|---|---|
| 7 | KEYCODE_0 |
| 8–16 | KEYCODE_1 through KEYCODE_9 |

### Channel (mostly no-ops on Fire TV — included for completeness)
| Code | Constant |
|---|---|
| 166 | KEYCODE_CHANNEL_UP |
| 167 | KEYCODE_CHANNEL_DOWN |

Send a long press by spamming `keyevent` in a loop, or use `sendevent` with a held DOWN state. For typing text into search boxes use `adb shell input text "Foo Bar"`.

---

## App launching

### Generic launcher-route resolution (handles the AFTR Prime Video case — see Gotcha #1)
```bash
adb shell cmd package resolve-activity --brief \
  -c android.intent.category.LEANBACK_LAUNCHER \
  <package_name>
```
Returns the package/activity that should be invoked for that catalog entry on this firmware build. **Always trust this output over a hard-coded activity name** — Fire OS rebrands the launcher across firmware updates.

### Launch by package + activity
```bash
adb shell am start -n <package>/<activity>
```

### Launch by intent action (preferred when the app advertises a public deep-link)
```bash
adb shell am start -a android.intent.action.VIEW -d "<deep_link_uri>"
```

### Force-stop an app
```bash
adb shell am force-stop <package>
```

### Foreground inspection (diagnostic)
```bash
adb shell dumpsys window windows | grep mCurrentFocus
adb shell dumpsys activity activities | grep "mResumedActivity"
adb shell pm path <package>          # confirms package is installed; "package:/system/.../base.apk"
adb shell pm list packages | grep -i <name>
```

---

## Known streaming app launches

### Prime Video
| Hardware build | Package | Activity | Notes |
|---|---|---|---|
| Standard | `com.amazon.avod` | `.MainActivity` | Works on Fire TV Stick 4K, Lite, Max, older Cubes |
| **AFTR Cube 2nd gen (PVFTV builds)** | `com.amazon.firebat` | `com.amazon.firebatcore.deeplink.DeepLinkRoutingActivity` | **Prime Video is hosted by the launcher itself — `com.amazon.avod` is not installed.** See `CLAUDE.md` Gotcha #9 |

Deep-link form: `https://www.amazon.com/gp/video/detail/<ASIN>`. Action `android.intent.action.VIEW`.

### Netflix
- Package: `com.netflix.ninja`
- Activity: `.MainActivity`
- Watch deep link: `adb shell am start -a android.intent.action.VIEW -n com.netflix.ninja/.MainActivity -d "http://www.netflix.com/watch/<TITLE_ID>" -f 0x10808000`
- The `-f 0x10808000` clears the back stack so Back returns to Fire TV home, not a stale Netflix screen.

### ESPN / ESPN+
- Package (Fire TV Google TV-branded app): `com.espn.gtv`
- Activity: `com.espn.score_center.ui.SplashActivity`
- **Watch CTA gotcha:** The detail-page "Watch" button **rejects synthetic touch events** (`input tap`, `dispatchGesture`). Only `KEYCODE_DPAD_CENTER` advances to `PlayerActivity`. See `feedback_espn_watch_dpad_only.md`. Fixed in app code v2.32.99.

### Hulu
- Package: `com.hulu.livingroomplus` (Fire TV variant)
- Activity: `.MainActivity`

### Sling TV
- Package: `com.sling`
- Activity: `com.sling.launchactivities.MainActivity`

### YouTube TV
- Package: `com.google.android.youtube.tv` or `com.google.android.youtube.tvunplugged` (varies)
- Activity (regular YouTube): `com.google.android.apps.youtube.tv.activity.ShellActivity`

### Disney+ / Max / Paramount+ / Peacock
| App | Package | Activity |
|---|---|---|
| Disney+ | `com.disney.disneyplus` | `.MainActivity` |
| Max (was HBO Max) | `com.wbd.stream` | `com.wbd.beam.BeamActivity` |
| Paramount+ | `com.cbs.ott` | `com.cbs.app.tv.ui.activity.SplashActivity` |
| Peacock | `com.peacocktv.peacockandroid` | `.MainActivity` |

Deep-link pattern when the app exposes one: `am start -a android.intent.action.VIEW -d "<provider-specific-URL>" -f 0x10808000`. Most accept HTTPS URLs to their content pages; some use custom URI schemes (`primevideo://`, `disneyplus://`, `netflix://`). Confirm by reading the app's manifest:
```bash
adb shell pm dump <package> | grep -A2 "android.intent.action.VIEW"
```

---

## Fire OS version differences

| Fire OS | Common devices | Notes |
|---|---|---|
| 5.x (AOSP 5.1) | Fire TV Stick 1st/2nd gen | Mostly retired; Cubes are not this version |
| 6.x (AOSP 7.1) | Fire TV Stick 4K, Cube 1st gen | ADB-over-TCP listener does NOT auto-resume after reboot |
| **7.x (AOSP 9)** | **AFTR Cube 2nd gen, Stick 4K Max, Stick Lite/4K (recent)** | Launcher-hosted Prime Video (see Gotcha #1). ADB-over-TCP auto-resumes after reboot. **This is the fleet baseline.** |
| 8.x (AOSP 11+) | Cube 3rd gen, newer Stick 4K Max 2nd gen, Omni QLED | Vega-OS variant on Omni QLED is **NOT Android-based** — ADB does not apply; use Alexa Voice Service / CEC instead. Standard Fire OS 8 on Cube 3rd gen is Android-based and behaves like 7.x for our purposes |

**Fleet-relevant call-out:** the Holmgren Cubes are AFTR (Fire OS 7.7, PVFTV-215 build). Any reference to "the Prime Video package" in fleet code MUST go through the `packageAliases` mechanism in `packages/streaming/src/streaming-apps-database.ts` (added v2.28.8). Hard-coding `com.amazon.avod` will fail silently on these Cubes.

---

## Gotchas

### 1. Launcher-hosted Prime Video on AFTR / PVFTV builds
On Fire TV Cube 2nd gen (AFTR, Fire OS 7.7) and other PVFTV-build Cubes, `com.amazon.avod` is **not installed as a standalone APK** — `pm list packages` won't show it, `pm path com.amazon.avod` returns failure. Prime Video is hosted entirely inside `com.amazon.firebat` (the launcher). Resolving the LEANBACK_LAUNCHER intent for firebat returns `livingroom.landing.LandingActivity` (the Prime Video browse screen).

Fix: include `com.amazon.firebat` as an alias for the `amazon-prime` catalog entry. Always fall through to `cmd package resolve-activity` rather than hard-coding the activity name. Full diagnostic flow in `CLAUDE.md` Gotcha #9.

### 2. ESPN GTV Watch CTA is DPAD-only
The Watch button on ESPN GTV detail pages cannot be activated by `input tap` or accessibility-service synthetic gestures. Only `adb shell input keyevent 23` (DPAD_CENTER) advances to PlayerActivity. See `feedback_espn_watch_dpad_only.md` (~6h debugging cost before discovery).

### 3. `dumpsys window windows` 3-second default timeout truncates launcher dumps
`adb-client.ts executeShellCommand` defaults to 3000ms which silently truncates `uiautomator dump` output on launcher home screens. Pass 10000ms explicitly for any dump command. Fixed v2.32.89; see `feedback_adb_shell_timeout.md`.

### 4. Compose UI elements inside Fire TV apps are NOT click=true focus=true
Fire TV launcher tabs are accessibility-clickable. Compose-built tabs INSIDE apps (e.g. Prime Video's own navigation) are not — the AccessibilityService sees them as decorative. Use DPAD navigation only for in-app traversal. See `feedback_scout_compose_tab_limit.md`.

### 5. ADB connection drops after ~12h idle
The TCP socket times out from the device side. Wrap `adb connect` retries around every command; don't assume one `connect` lasts forever. `adb-client.ts` already handles this.

### 6. Voice button is uninterceptable
Like KEYCODE_HOME, KEYCODE_SEARCH (the microphone) cannot be remapped or intercepted by third-party apps or our control software. Don't waste cycles trying.

---

## Reference implementations we depend on

- `@sports-bar/firecube` — our wrapper package
- `apps/web/src/lib/adb-client.ts` — connection management + per-device serialized command queue
- `packages/streaming/src/streaming-apps-database.ts` — catalog with `packageAliases` for the AFTR/launcher case
