# v2.33.1 Per-Location Testing Checklist

**Goal:** After auto-update lands v2.33.1, confirm the bartender remote streaming guide is working end-to-end.

**Who this is for:** Anyone at a fleet location after the nightly auto-update or after running `bash scripts/auto-update.sh --triggered-by=manual_cli`.

**Time:** ~5 minutes.

---

## Quick reference — which locations care about which fixes

**Every location EXCEPT Leg Lamp has Amazon Fire TV Cubes** and should run the full streaming-guide test (Steps 1-5). Leg Lamp runs a shorter test (Steps 1 + 6) since it has no Cubes.

| Location | Has Fire TV Cubes? | What to test |
|---|---|---|
| Graystone | YES | Full bartender streaming + per-Cube guide (Steps 1-5) |
| Holmgren Way | YES | Already verified during v2.33.1 release; still re-run Steps 1-5 after the auto-update lands |
| Lucky's 1313 | YES | Full bartender streaming + per-Cube guide (Steps 1-5) |
| Stoneyard Appleton | YES | Full bartender streaming + per-Cube guide (Steps 1-5) |
| Stoneyard Greenville | YES | Full bartender streaming + per-Cube guide (Steps 1-5) |
| Leg Lamp | NO | Just confirm cable/satellite guide still works (Step 1 + Step 6) |

**Why the "(0 Fire TV devices)" footnote you may have seen during v2.33.1 release was wrong:** the per-location `apps/web/data/firetv-devices.json` file is a SEED template that's empty by default. The actual Cube records live in each location's database (see CLAUDE.md → "Device DB source of truth"). Don't trust the JSON for "does this location have Cubes" — query the DB:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, ipAddress FROM FireTVDevice WHERE name NOT LIKE '%REPLAC%';"
```

---

## Step 1 — Confirm v2.33.1 actually landed

On the location host, run:

```bash
grep '"version"' /home/ubuntu/Sports-Bar-TV-Controller/package.json | head -1
curl -s http://localhost:3001/api/health | jq -r '.status, .uptime'
pm2 status sports-bar-tv-controller | grep sports-bar-tv-controller
```

**Expect:**
- `"version": "2.33.1"`
- `healthy` and a non-zero uptime
- PM2 status `online`

**If version is still 2.32.x or 2.33.0:** the auto-update hasn't run yet. Trigger it:

```bash
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh --triggered-by=manual_cli
```

This typically takes 60-120 seconds. Re-run the version check above.

---

## Step 2 (only if location has Fire TV Cubes) — Verify Scout catalog has fresh data

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT app, COUNT(*) tiles, datetime(MAX(capturedAt),'unixepoch','localtime') latest FROM firetv_streaming_catalog GROUP BY app;"
```

**Expect:** rows for Prime Video and ESPN, latest within the last ~8 hours (walker runs at 04:00, 12:00, 17:00 local).

**If empty or stale:** force a refresh:

```bash
curl -s -X POST http://localhost:3001/api/firestick-scout/catalog/walk -H "Content-Type: application/json" -d '{}'
```

Wait ~75 seconds. Re-run the SELECT. You should see fresh rows.

---

## Step 3 (only if location has Fire TV Cubes) — Confirm guide returns Scout-only with day/time

Find a Cube's input number + deviceId:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT mi.channelNumber AS input_num, mi.label, isr.device_id FROM MatrixInput mi JOIN input_sources isr ON isr.matrix_input_id = mi.id WHERE mi.deviceType='Fire TV' AND mi.isActive=1 ORDER BY mi.channelNumber LIMIT 5;"
```

Pick the FIRST Fire TV row (let's call it INPUT_NUM and DEVICE_ID). Then:

```bash
curl -s -X POST http://localhost:3001/api/channel-guide \
  -H "Content-Type: application/json" \
  -d "{\"inputNumber\":<INPUT_NUM>,\"deviceType\":\"streaming\",\"deviceId\":\"<DEVICE_ID>\"}" \
  | jq '.programs[] | {title:.homeTeam,away:.awayTeam,day,time,isLive,score:[.liveData.awayScore,.liveData.homeScore],deepLink:(.channel.deepLink|tostring|.[0:50])}'
```

**Expect:**
- Several streaming programs (depending on what's live now). Each has:
  - A `title` and `away` (or just `title` for individual events like F1)
  - A `day` field — `LIVE` for in-progress, `Sat`/`Sun`/etc for upcoming, `On demand` for tiles without a time anchor
  - A `time` field — `LIVE`, a clock time like `7:30 PM CDT`, or empty
  - A `deepLink` — should NOT be empty for streaming (NFHS may have empty deepLink, that's expected)
- For live games matched against ESPN's sync, a `score` array `[awayScore, homeScore]` with real numbers
- NO programs with these noisy titles: `Audio languages`, `Subtitles`, `How do I choose languages?`, `Spanish, English`, `Season 2026`, `ESPN+`, `SECN+`, `SportsCenter`, `All ACC ACCN`
- NO program description containing the string `(deep-linkable)`

**If you see any noise titles:** delete them and force a re-walk:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "DELETE FROM firetv_streaming_catalog WHERE contentTitle IN ('Audio languages','Subtitles','Season 2026','ESPN+','SECN+','SportsCenter') OR contentTitle LIKE 'Season %' OR contentTitle LIKE 'How do%';"
curl -s -X POST http://localhost:3001/api/firestick-scout/catalog/walk -d '{}'
```

---

## Step 4 — Open the bartender remote in a browser

Navigate to:

```
http://<host-lan-ip>:3002/remote
```

Find the host's LAN IP if you don't know it:

```bash
hostname -I | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^100\.' | head -1
```

In the bartender remote UI:

1. **Find the input selector** (Amazon 1, Amazon 2, etc. for Cube-having locations; Cable Box 1-4 / DirecTV for all locations).
2. Pick **a Fire TV input** (Cube-having locations only).
3. Open the **Channel Guide** tab.
4. **Verify each game tile shows:**
   - Team names (e.g. "Lakers @ Thunder") or event name (e.g. "Michelin Grand Prix")
   - Day + time (e.g. "Sat 7:30 PM CDT") OR a "LIVE" badge with current score
   - The streaming app name (ESPN / Prime Video)
   - A green Watch button
5. **Verify NO tile shows:**
   - "(deep-linkable)" anywhere in description
   - Player UI labels: "Audio languages", "Subtitles", "How do I choose..."
   - Series labels: "Season 2026", bare network labels like "ESPN+", "SECN+"
6. **Click the Watch button on a live game.** Wait 25-35s. Check the corresponding TV — it should land on the actual game (PlayerActivity), not on the streaming app's home screen. Note: if the location isn't entitled to that game's league on that streaming service (e.g. ESPN+ MLB without subscription), it may land on a paywall — that's correct behavior.

---

## Step 5 — Verify completed games auto-disappear

This one's hard to test on demand because it requires a game to have ended. Instead, just confirm the filter is in place via the logs:

```bash
pm2 logs sports-bar-tv-controller --lines 200 --nostream | grep "completed games skipped"
```

**Expect:** at some point in the last hour, you should see a line like:

```
firetv_streaming_catalog injection for <deviceId>: +N from scout walker, M dedup, K enriched startTime from game_schedules, X completed games skipped
```

If `X > 0`, the filter is correctly removing finished games.

---

## Step 6 (Leg Lamp only — others can also run as a sanity check) — Cable/satellite untouched

Open the bartender remote (same URL as Step 4). Pick a cable or DirecTV input. Navigate to the channel guide. Confirm:

- Cable channels show with their preset numbers and live scores (if currently airing).
- DirecTV channels show with their preset numbers.
- No regressions vs. how the guide looked before this update.

---

## What to do if something is broken

| Symptom | Cause | Fix |
|---|---|---|
| Bartender shows "NO LIVE GAMES" but you know games are on | v2.33.0 rendering bug — auto-update didn't land v2.33.1 | Check Step 1; force a manual auto-update |
| All Cube tiles show "On demand" | Walker hasn't run since boot OR ESPN sync is stale | Step 2 manual walk; check `journalctl -u ollama-ipex` is fine; confirm ESPN sync is firing |
| Cube guide is empty | ADB connection broken to that Cube | `pm2 logs sports-bar-tv-controller \| grep "send-command HTTP 500"` — fix ADB on the failing Cube |
| Watch button opens app but not the game | Should be fixed in v2.32.99 + v2.33.1 — verify those versions | Step 1; if version is right, capture the foreground activity via `adb -s <cube_ip>:5555 shell "dumpsys window windows \| grep mCurrentFocus"` and report |
| Noise tiles ("Audio languages", "Season 2026") appear | Walker captured a non-home screen | Step 3 cleanup query + manual walk |
| Cable/satellite guide regressed | Should not happen — cable/sat paths untouched | File a bug; provide the deviceType + screenshot |

---

## What's specifically NEW in v2.33.1 (so you know what to look for)

- **Bartender streaming guide** is per-Cube now. Two Cubes at the same location can show different game lists based on what each Cube has captured locally.
- **Day + time** appear on each streaming tile.
- **Live scores + clock + status** appear when a game has an ESPN-synced match.
- **Completed games disappear** automatically (via game_schedules status).
- **Walker runs 3x daily** at 04:00, 12:00, 17:00 local. The bartender remote's refresh button forces an immediate walk.
- **Internal "(deep-linkable)" tag is gone** from descriptions.
- **Walker noise filter is tighter** — Audio languages / Subtitles / show names / network labels won't show as fake games.
- **AI Suggest + Auto Pilot** read streaming games from the same per-Cube catalog. Suggestions are guaranteed launchable.

---

## Reporting back

If anything fails the checklist, capture:

1. `grep '"version"' /home/ubuntu/Sports-Bar-TV-Controller/package.json`
2. `pm2 logs sports-bar-tv-controller --lines 50 --nostream | tail -50`
3. `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT app, COUNT(*) FROM firetv_streaming_catalog GROUP BY app;"`
4. The exact bartender remote URL + screenshot of the failing screen
5. Time of test in `America/Chicago`

Send to the channel where Sports-Bar-TV-Controller issues are tracked.
