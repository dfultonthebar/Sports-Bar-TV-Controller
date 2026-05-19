# Current Channel Lookup Runbook

**Purpose:** Find which channel (or app, or content) is currently playing on each TV — covering bartender Guide tab, Sports Guide API, DirecTV tuner parsing, Fire TV app detection, and the catalog walker.
**Audience:** operators, admins, Claude Code agents.
**Read time:** ~10 minutes.

## When to use this runbook

- A bartender asks "what's on TV 7 right now?"
- The Sports Guide UI shows stale or wrong data and you need to confirm against the actual device.
- The auto-allocator/scheduler is making wrong decisions and you need to know what it thinks each TV is on.
- A regional sports network game (Brewers on BallyWIPlus, Bucks on FanDuelWI) isn't showing up in the channel guide.
- Debugging override-learn: did the bartender's manual switch get recorded against the right schedule?

## Pre-flight checks

- [ ] PM2 is up: `pm2 status | grep sports-bar`.
- [ ] At least one DirecTV box is reachable: `curl -s -o /dev/null -w "%{http_code}\n" http://10.11.3.42:8080/info/getOptions` returns `200`.
- [ ] Fire TV walker has run within the last 24 hours: `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT MAX(scanned_at) FROM firetv_catalog_entries;"` returns something within 24h.
- [ ] Sports Guide API key is configured: `grep SPORTS_GUIDE_USER_ID .env` returns a value.

## Architecture context: where each piece of "current channel" data comes from

| Source type | "Current channel" comes from | Update mechanism |
|---|---|---|
| **Cable Box** | Last IR command sent + the routing log (we are blind to actual tuner state; CEC is dead — see CLAUDE.md §5) | Updated on each IR command (`/api/ir-devices/send-command`); the DB stores the last commanded channel only |
| **DirecTV** | DirecTV HTTP API `/tv/getTuned` on port 8080 | Polled live on every call to `/api/matrix/current-channels`; also batch-polled by `packages/scheduler/src/directv-probe.ts` every minute for PPV alerting |
| **Fire TV** | `dumpsys window windows \| grep mCurrentFocus` via ADB → resolves to current package + activity | Walked daily at 04:00 by `firetv-catalog-walker.ts`; on-demand via `/api/firetv-devices/<id>/current-app` |
| **Sports Guide** | Rail Media API + ESPN sync → `game_schedules` DB table | Cron every 10min for Rail; ESPN sync 30s after startup + every 60min |
| **Channel Guide UI** | `/api/channel-guide` — merges Rail games + `game_schedules` fallback (`packages/scheduler/src/espn-sync-service.ts`) | On-demand per page load; cached for ~5 minutes |

## Step 1 — Bartender Guide tab (the operator's path)

For most "what's on" questions, just open `http://<host>:3002/remote` → **Guide** tab. This shows:
- Each TV (output) with its current input source.
- For cable/DirecTV: the channel number + program title from `current-channels`.
- For Fire TV: the foreground app name (Prime Video, ESPN, YouTube TV, etc.).

The Guide tab merges live data from `/api/matrix/current-channels` (per-output) with the Sports Guide rail (`/api/sports-guide`). The Sports Guide rail shows what GAMES are on which channels right now, regardless of which TVs are tuned.

## Step 2 — `/api/matrix/current-channels` (per-output view)

```bash
curl -s 'http://localhost:3001/api/matrix/current-channels' | jq '.[] | {outputNumber, outputName, inputName, sourceType, currentChannel, currentProgram}'
```

**Expected per-source behavior:**

- **DirecTV inputs:** `currentChannel` is the live tuner state via `getTuned`. `currentProgram` is the program title DirecTV reports (e.g., `"NBA: Lakers @ Celtics"`).
- **Cable Box inputs:** `currentChannel` is the LAST commanded IR channel; if the bartender used the physical remote in front of the bar instead of the app, this will be stale. There is no read-back path.
- **Fire TV inputs:** `currentChannel` is `null`; `currentProgram` is the foreground app's display name + (sometimes) the content title parsed from the Watch deep link.

If `currentChannel` is missing for a DirecTV input, the device is offline. Confirm: `curl -s http://10.11.3.42:8080/info/getOptions`.

## Step 3 — DirecTV deep-dive: parsing tuner state

The `packages/directv` client wraps `/tv/getTuned`. The raw response from DirecTV looks like:

```json
{
  "callsign": "ESPN",
  "date": "20260518",
  "duration": 7200,
  "isOffAir": false,
  "isPclocked": 3,
  "isPpv": false,
  "isRecording": false,
  "isVod": false,
  "major": 206,
  "minor": 65535,
  "offset": 1200,
  "programId": "12345678",
  "rating": "TV-14",
  "startTime": 1747632000,
  "stationId": 7654321,
  "status": {"code": 200, "commandResult": 0, "msg": "OK.", "query": "/tv/getTuned"},
  "title": "NBA: Lakers @ Celtics"
}
```

**Direct probe** (bypassing our cache):
```bash
curl -s http://10.11.3.42:8080/tv/getTuned | jq '{major, minor, callsign, title, isOffAir, isPpv}'
```

`major` is the channel number you see in operator tables (206 = ESPN). `minor` is `65535` for non-multicast channels.

### PPV detection — why we care

`packages/scheduler/src/directv-probe.ts` polls every box every minute and writes any PPV-like channel to a dedicated table. PPV detection logic:
- `callsign === 'PPV'`, OR
- `major` between 100-199 AND `title.trim()` is non-empty.

This catches unauthorized PPV purchases before the operator's monthly bill arrives.

**Check recent PPV events:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT ts, deviceName, major, minor, callsign, title FROM DirecTVPpvSeen ORDER BY ts DESC LIMIT 20;"
```

## Step 4 — Fire TV deep-dive: app detection

The bartender Guide tab shows "Prime Video" or "ESPN" for Fire TV inputs. Where does that come from?

**Live probe of the current Fire TV foreground app:**
```bash
curl -s 'http://localhost:3001/api/firetv-devices/firetv-2/current-app' | jq .
```

**Expected:**
```json
{
  "success": true,
  "package": "com.amazon.firebat",
  "activity": "com.amazon.tv.launcher.ui.HomeActivity_vNext",
  "displayName": "Fire TV Home",
  "deepLink": null,
  "title": null
}
```

The endpoint wraps `adb shell dumpsys window windows | grep mCurrentFocus`, then resolves the package against `packages/streaming/src/streaming-apps-database.ts` to get the user-facing display name.

**If `package` is `com.amazon.firebat` but operator says Prime Video is open**, that's the launcher-hosted Prime Video case — see `FIRETV_OFFLINE_RECOVERY.md` Step 7 and CLAUDE.md Gotcha #9. The display name resolves correctly via the `packageAlias` mapping, but the package name itself looks misleading.

### Per-Fire-TV content catalog (what's available, not what's playing)

The catalog walker (`packages/scheduler/src/firetv-catalog-walker.ts`) is a different concept: it runs at 04:00 daily and walks each Fire TV through each installed sports app, dumping the tile carousels via `uiautomator dump` and POSTing them to `/api/firestick-scout/catalog`. This gives the Sports Guide a per-box list of "what live sports content is offered."

**It does NOT tell you what is currently being watched** — it tells you what's AVAILABLE for the auto-allocator and the channel guide to pick from.

**Check catalog freshness:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceId, appPackage, COUNT(*) AS tiles, MAX(scanned_at) FROM firetv_catalog_entries GROUP BY deviceId, appPackage;"
```

If `scanned_at` is more than 26 hours old, the cron didn't fire — check `apps/web/src/lib/scheduler-cron-router.ts` for the 04:00 trigger.

### Why uiautomator dumps return empty (the 3s timeout gotcha)

If you see `"empty dump"` errors in PM2 logs during a walker run, the 3000ms default ADB shell timeout is killing `uiautomator dump` on the launcher home screen (which takes 3-7s to walk the rail tiles). The walker (v2.32.89+) passes `timeoutMs=10000` to work around this. Lower-level callers may not. See `FIRETV_OFFLINE_RECOVERY.md` Step 5 for the diagnostic recipe and `feedback_adb_shell_timeout.md` for full context.

## Step 5 — Sports Guide API (what GAMES are on right now)

This is the operator's "show me all live games and what channels they're on" question.

```bash
curl -s 'http://localhost:3001/api/sports-guide' | jq '.live[] | {league, homeTeam, awayTeam, networks, channels, startTime}'
```

**Expected:**
```json
{
  "league": "nba",
  "homeTeam": "Boston Celtics",
  "awayTeam": "Los Angeles Lakers",
  "networks": ["ESPN", "TNT"],
  "channels": ["206", "245"],
  "startTime": "2026-05-18T19:30:00Z"
}
```

The list is built by `/api/channel-guide` which:
1. Calls Rail Media API for live programs.
2. Queries `game_schedules` (populated by ESPN sync) for the same time window.
3. Merges and dedups (channel + team).
4. Resolves network names → channel numbers via `network-channel-resolver.ts` + `stationToPreset`.

**Regional sports network gotcha (CRITICAL):**

Rail Media misses regional games (Brewers on Brewers.TV, Bucks on FanDuel SN WI). The `game_schedules` fallback path picks them up. But for the resolver to bind a `ChannelPreset` to its station alias, the preset's name MUST normalize to one of the alias bundle members.

**Holmgren example (v2.32.58 fix):**
- Channel 308 = BallyWIPlus = Brewers-only.
- The alias bundle members all end with `+` (`"Bally Sports Wisconsin+"`, `"BSWI+"`, etc.).
- The preset MUST be named `"Bally Sports Wisconsin+"` (with the trailing `+`).
- Without the `+`, BREWERS.TV → BallyWIPlus → preset never connects and Brewers games silently miss the bartender remote at game-time.

**Check your presets:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT channelNumber, name, source FROM ChannelPreset WHERE channelNumber IN ('40','308') ORDER BY channelNumber;"
```

Channel 40 should be `"FanDuel SN WI"` or similar bundle member. Channel 308 MUST end with `+`.

## Step 6 — ESPN sync (`game_schedules` table)

ESPN sync runs from `apps/web/src/instrumentation.ts` 30s after startup + every 60min. Covers MLB/NBA/NHL/NFL/CFB/MCBB/WCBB → `game_schedules` table.

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT league, home_team, away_team, broadcast_networks, start_time FROM game_schedules WHERE start_time > datetime('now', '-1 hour') AND start_time < datetime('now', '+4 hour') ORDER BY start_time;"
```

**If `broadcast_networks` is blank for a game,** ESPN didn't return network info for that broadcast yet (often happens for late-add games or RSN-only games). The channel-guide fallback will still match by team if a preset is named for the team's home RSN.

**Re-run ESPN sync manually:**
```bash
curl -X POST 'http://localhost:3001/api/scheduling/espn-sync' | jq .
```

## Step 7 — Override-learn check (did the bartender's change get logged?)

When a bartender manually switches a TV via the bartender remote, the `override-learn` flow (v2.18.0) attempts to attach the switch to the active schedule allocation if it happened within 10 minutes.

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT ts, level, message, metadata FROM SchedulerLog WHERE component='override-learn' AND ts > datetime('now', '-1 hour') ORDER BY ts DESC LIMIT 10;"
```

**Look for:**
- `op=add` — bartender switched a TV TO the input matching an active allocation (home-team upgrade, etc.).
- `op=remove` — bartender switched AWAY from an allocation's input (de-allocation).
- `level=warn` — home-team override (logged at warn for visibility).

If you see no log rows but the bartender insists they switched something, the 10-min window expired between the allocation and the switch — treated as an unrelated manual change.

## Verification

After diagnosing a channel-lookup question:

1. **DirecTV live check:**
   ```bash
   curl -s http://10.11.3.42:8080/tv/getTuned | jq '{major, callsign, title}'
   ```
2. **Fire TV live check:**
   ```bash
   curl -s http://localhost:3001/api/firetv-devices/firetv-2/current-app | jq .
   ```
3. **Sports Guide live games:**
   ```bash
   curl -s http://localhost:3001/api/sports-guide | jq '.live | length'
   ```
   Expected: ≥1 during normal sports hours.
4. **Channel guide for a specific game time:**
   ```bash
   curl -X POST http://localhost:3001/api/channel-guide \
     -H 'Content-Type: application/json' \
     -d '{"hours": 2}' | jq '.programs | length'
   ```

## If still broken

- **DirecTV box returns no current channel:** `/tv/getTuned` returned an error. Check `curl -s http://<dtv_ip>:8080/info/getOptions`. If 200 but `getTuned` fails, the box may be off — DirecTV requires power on to tune.
- **Sports Guide shows no live games but ESPN.com does:** ESPN sync didn't run or returned errors. Re-run manually (Step 6). Check `pm2 logs sports-bar-tv-controller --lines 100 | grep ESPN-SYNC`.
- **Channel-guide skips a regional game:** preset name doesn't match alias bundle. Check Step 5's gotcha. Rename the preset, restart PM2, retest.
- **Fire TV `current-app` returns wrong package after Prime Video changes:** see CLAUDE.md Gotcha #9 and `FIRETV_OFFLINE_RECOVERY.md` Step 7 — the package alias mapping may need updating.
- **Catalog walker output is empty for some apps:** see `feedback_adb_shell_timeout.md` — the 3s default ADB timeout silently truncates dumps. The walker passes `timeoutMs=10000`; if you're calling `executeShellCommand` from new code, do the same.

## Escalation path

1. Snapshot routing state: `curl -s http://localhost:3001/api/matrix/current-channels > /tmp/current-channels.json`.
2. Snapshot Sports Guide: `curl -s http://localhost:3001/api/sports-guide > /tmp/sports-guide.json`.
3. Snapshot game schedules: `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT * FROM game_schedules WHERE start_time > datetime('now','-1 hour') AND start_time < datetime('now','+4 hour');" > /tmp/games.txt`.
4. Snapshot channel presets: `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT * FROM ChannelPreset;" > /tmp/presets.txt`.
5. Compare against ESPN.com or Rail Media's published live list to identify which path is dropping the data.

## Cross-references

- **CLAUDE.md §5** — Cable Box Control (IR only — we are blind to actual tuner state).
- **CLAUDE.md §7** — Hardware Control Layer including DirecTV + Fire TV packages.
- **CLAUDE.md §9** — AI Scheduling Intelligence including ESPN sync + override-learn.
- **CLAUDE.md §9a** — Live Channel Mapping (`NETWORK_TO_CABLE` + `NETWORK_TO_DIRECTV` dicts).
- **CLAUDE.md §9** WI RSN split detail — Channel 40 (FanDuelWI / Bucks) vs Channel 308 (BallyWIPlus / Brewers, MUST end with `+`).
- **`docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md`** — all Sports Guide admin UI lives at `/sports-guide-admin`; old URLs redirect.
- **`packages/scheduler/src/firetv-catalog-walker.ts`** — daily walker that builds Fire TV per-box content catalog (architecture decision: server-side ADB driver, not in-APK AccessibilityService — full rationale in file header).
- **`packages/scheduler/src/directv-probe.ts`** — minute-cron polling `/tv/getTuned` + PPV detection.
- **`packages/scheduler/src/espn-sync-service.ts`** — ESPN game schedule sync that populates `game_schedules`.
- **Memory file:** `feedback_verify_all_injection_paths.md` — channel guide has 3+ injection paths (walker / broadcast_networks / Rail Media); fix one and the others still bite.
- **Memory file:** `feedback_adb_shell_timeout.md` — 3s timeout silently truncates uiautomator dumps.
- **Memory file:** `feedback_firetv_prime_video_launcher_hosted.md` — Prime Video lives in `com.amazon.firebat` on AFTR Cubes.
- **Related runbook:** `MATRIX_INPUT_SWITCH.md` for switching a TV's input source.
- **Related runbook:** `FIRETV_OFFLINE_RECOVERY.md` if `current-app` returns errors.
- **Source:** `apps/web/src/app/api/matrix/current-channels/route.ts` — main per-output current-channel endpoint.
- **Source:** `apps/web/src/app/api/channel-guide/route.ts` — merges Rail + ESPN sync + regional-game fallback.
- **Source:** `apps/web/src/lib/network-channel-resolver.ts` — `buildStationToPreset` (the alias-bundle → preset matcher).
- **Source:** `apps/web/src/lib/seed-from-json.ts` — canonical WI RSN alias bundle definitions.
