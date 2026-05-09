# Operator DB Health Reference

**Purpose:** describe every database row + JSON file that must be in a particular state for the bartender remote, AI Suggest, and Auto Pilot to work end-to-end at a location. Plus how to detect each gap, what's the fix, and what symptom each gap causes.

**Audience:** anyone setting up a new location, troubleshooting a Cube-having location, or auditing fleet state.

**When to read:** if any location's bartender remote streaming guide is empty, partially empty, full of noise, or routing to the wrong games — this doc names the specific tables/rows to check.

---

## TL;DR — The Five Things That Must Be Right

1. **`Location` row + `LOCATION_ID` env var** — auth bootstrap (see `docs/NEW_LOCATION_SETUP.md`).
2. **`AuthPin` rows for ADMIN + STAFF** — operator login (same doc).
3. **`MatrixConfiguration.outputOffset`** — wrong value silently mis-routes every TV (see CLAUDE.md "outputOffset" section).
4. **`FireTVDevice` rows + `inputChannel`** — Scout walker indexes by deviceId; bartender API queries by inputChannel.
5. **`input_sources.available_networks`** — JSON array of friendly app names; walker's first gate. Empty `[]` → walker silently skips the Cube.

If any of these five are wrong, the rest of the system can pass health checks but the bartender remote will appear broken.

---

## Tables + JSON files needed per location

### 1. `Location` (from `apps/web/src/db/schema.ts:locations`)

**Required:** one row per location. Created by `scripts/bootstrap-new-location.sh`.

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, timezone, isActive FROM Location;"
```

**Expect:** one active row with the location's display name. `timezone` is typically `America/Chicago` for the Wisconsin/Illinois fleet.

**If missing:**
```bash
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/bootstrap-new-location.sh \
  --name "Your Bar Name" --admin-pin 7819 --staff-pin 1234
```

**Symptom if missing:** every login attempt returns "Invalid PIN" regardless of which PIN is entered.

---

### 2. `AuthPin` rows + `Session` table healthy

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, role, isActive, description FROM AuthPin WHERE isActive=1;"
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT COUNT(*), MIN(datetime(createdAt)), MAX(datetime(createdAt)) FROM Session WHERE isActive=1;"
```

**Expect:** at least one ACTIVE pin per role (ADMIN, STAFF). Active sessions count > 0 if anyone's logged in.

**If `AuthPin` empty:** re-run the bootstrap script (idempotent — safe to re-run).

**Symptom if missing:** PIN login screen rejects every input.

---

### 3. `MatrixConfiguration` + `MatrixInput` + `MatrixOutput`

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, ipAddress, outputOffset, audioOutputCount FROM MatrixConfiguration WHERE isActive=1;"
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT channelNumber, label, deviceType, isActive FROM MatrixInput WHERE isActive=1 ORDER BY channelNumber;"
```

**Expect:** one active MatrixConfiguration. Per-location values for `outputOffset` and `audioOutputCount` per CLAUDE.md "outputOffset" table:

| Location | outputOffset | audioOutputCount |
|---|---|---|
| Holmgren Way | per card | 4 (audio outputs 37-40) |
| Graystone | +32 for audio card | 4 |
| Lucky's 1313 | **0 (single-card)** | **0** |
| Stoneyard Appleton | per card | 4 |
| Stoneyard Greenville | per card | 4 |
| Leg Lamp | **0** | 0 |

**Symptom if outputOffset wrong:** routing succeeds API-side but lands on wrong TV. CLAUDE.md "outputOffset" describes the Lucky's-1313-shipping-with-26 incident in detail.

**Symptom if MatrixInput rows missing:** bartender remote shows no input chips/tabs.

---

### 4. `FireTVDevice` rows + `inputChannel` populated

**Required for Cube-having locations:** one `FireTVDevice` row per Cube, with `ipAddress` (LAN IP) AND `inputChannel` (matching the corresponding `MatrixInput.channelNumber`).

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, ipAddress, inputChannel, port FROM FireTVDevice WHERE name NOT LIKE '%REPLAC%';"
```

**Expect:** every Cube has both `ipAddress` and `inputChannel` set. If `inputChannel` is empty, the channel-guide API can't be queried for that Cube and the bartender remote shows nothing.

**Cross-check against ADB:** every IP must respond to `adb -s <ip>:5555 get-state` with `device`. If it returns `unauthorized` or `no-state`, the Cube needs `adb pair` / `adb connect` rerun via the Device Config UI.

**Symptom if `inputChannel` is missing:** API returns 404 for that input; bartender shows "no guide data."

---

### 5. `input_sources` rows + `available_networks` populated (the most common gap)

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, type, device_id, json_array_length(available_networks) AS app_count FROM input_sources WHERE type='firetv';"
```

**Expect:** every Fire TV input has `app_count >= 2` (at minimum the apps the walker can extract from: ESPN + Prime Video). Empty `[]` = `app_count=0`.

**WHAT BREAKS WHEN EMPTY:** the catalog walker logs `[FIRETV-CATALOG] Amazon N: no walkable apps in available_networks` and skips the Cube entirely. Bartender remote shows 0 streaming games for that input.

**FIX recipe (from the Lucky's 1313 v2.33.2 fleet rollout, 2026-05-09):**

For each Fire TV input, list installed user apps via ADB, then populate `available_networks` accordingly:

```bash
# Step 1 — find what's installed on each Cube:
for ip in <cube-ip-1> <cube-ip-2> ...; do
  echo "== $ip =="
  adb -s $ip:5555 shell "pm list packages -3" | sed 's/package://' | tr -d '\r' | grep -iE "espn|firebat|peacock|fubo|sling|youtube|appletv|paramount|hulu|playon|max"
done

# Step 2 — system-installed Prime Video host (firebat) check; ALL Cubes have this:
for ip in <cube-ip-1> ...; do
  has_firebat=$(adb -s $ip:5555 shell "pm path com.amazon.firebat" 2>&1 | grep -c "package:")
  echo "$ip firebat=$has_firebat"
done

# Step 3 — UPDATE per Cube. JSON array of friendly names that MATCH APP_WALK_RULES keys:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE input_sources SET available_networks = json_array('ESPN', 'Prime Video', 'Peacock', 'Hulu') WHERE id = '<input_source_id>';"
```

**Friendly-name → package mapping** (used to decide what to put in `available_networks`):

| Friendly name | Package(s) | Walker-extractable? |
|---|---|---|
| `ESPN` | com.espn.gtv | YES |
| `Prime Video` | com.amazon.firebat (system, on every Fire TV) | YES |
| `Peacock` | com.peacock.peacockfiretv | NO (WebView) |
| `Hulu` | com.hulu.plus | NO (WebView) |
| `Apple TV+` | com.apple.atve.amazon.appletv | NO (a11y-blind) |
| `fuboTV` | com.fubo.firetv.screen | NO (WebView/sign-in wall) |
| `Sling` | com.sling | NO (signed-out tier has no sports) |
| `YouTube TV` | com.google.android.youtube.tvunplugged | NO (Cobalt runtime) |
| `YouTube` | com.amazon.firetv.youtube | NO (Cobalt) |
| `Fox Sports` | com.foxsports.videogo / com.fox.foxone | NO (stub redirect) |
| `NFHS Network` | com.playon.nfhslive | NO (separate sync via /api/nfhs) |
| `Paramount+` | com.cbs.ott | NO |
| `Netflix` | com.netflix.ninja | NO (no sports) |

**Why list non-walkable apps too?** The bartender remote's "Available Apps" tab reads `available_networks` to populate the app-launcher buttons. So even Peacock + Hulu should be listed — they just won't get walker-tile entries in the streaming guide.

**Verify the fix worked** (after triggering a manual walk):
```bash
curl -s -X POST http://localhost:3001/api/firestick-scout/catalog/walk -H "Content-Type: application/json" -d '{}'
sleep 90
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT app, COUNT(*) tiles FROM firetv_streaming_catalog GROUP BY app;"
```

**Expect:** rows for ESPN and Prime Video with non-zero tile counts.

---

### 6. `firetv_streaming_catalog` (populated by the walker, never directly written)

Source of truth for the bartender's per-Cube streaming guide. Populated by the walker on a 3x daily schedule (04:00, 12:00, 17:00 local) AND on demand via the bartender refresh button.

**Verify:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT app, COUNT(*) tiles, datetime(MAX(capturedAt),'unixepoch','localtime') latest FROM firetv_streaming_catalog GROUP BY app;"
```

**Expect:** ESPN + Prime Video rows, latest capture within the last ~8 hours.

**Common noise tiles** (should NOT be in the catalog if v2.33.2+ is running):
- `ESPN`, `ESPN+`, `ESPN Unlimited`, `ESPNU` — bare network names
- `SportsCenter`, `NFL Live`, `NBA Live`, `MLB Live` — show names
- `SECN+`, `ACCN`, `Big Ten Network` — channel/network labels
- `Recently watched`, `Live events for you`, `Sports for you` — section headers
- `ABC News`, `NBC News`, `Dateline NBC`, `Dateline 24/7` — news shows
- `Audio languages`, `Subtitles`, `Spanish, English`, `How do I choose languages?` — player UI labels
- `Season 2026`, `Episode 5`, bare year strings — series metadata
- `Rolling Loud`, `Coachella` — music events
- `RugbyPass TV` — channel shell

If you see any: walker version is < v2.33.2 (upgrade) OR the rows are pre-v2.33.2 orphans (delete them; next walk will be clean).

**One-shot manual cleanup of pre-v2.33.2 noise:**
```bash
DB=/home/ubuntu/sports-bar-data/production.db
for pattern in \
  "contentTitle IN ('ABC News','NBC News','Recently watched','Live events for you','Rolling Loud','Dateline NBC','Season 2026','ESPN','ESPN+','ESPN Unlimited','SportsCenter','SECN+','ACCN','RugbyPass TV')" \
  "length(contentTitle) > 89" \
  "contentTitle LIKE 'Season 20%'" \
  "contentTitle LIKE 'How do%'" \
  "contentTitle LIKE 'Audio language%'" \
  "contentTitle LIKE 'Subtitle%'"
do
  sqlite3 $DB "DELETE FROM firetv_streaming_catalog WHERE $pattern"
done
```

---

### 7. `game_schedules` populated by ESPN sync

Channel-guide enriches streaming tiles with start times + scores from `game_schedules`. ESPN sync runs every 10 minutes from `apps/web/src/instrumentation.ts` against ESPN's public scoreboard API.

**Verify:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT league, COUNT(*), MIN(datetime(scheduled_start,'unixepoch','localtime')), MAX(datetime(scheduled_start,'unixepoch','localtime')) FROM game_schedules WHERE scheduled_start > strftime('%s','now') GROUP BY league;"
```

**Expect:** rows for ~24 leagues (mlb, nba, nhl, nfl, college-football, college-baseball, soccer's usa.1/eng.1, racing's f1/nascar-premier/irl, golf, tennis, mma, lacrosse/pll, rugby/super-rugby, etc.). Min/max range covers the next 48h.

**If empty:** check `pm2 logs sports-bar-tv-controller --lines 100 | grep "ESPN SYNC"` for sync errors. ESPN's API occasionally returns 4xx for some leagues — that's logged but non-fatal.

---

### 8. JSON files (location-specific data)

These are seed templates on `main` (empty) and populated on each location branch:

| File | Required state | Symptom if blank/wrong |
|---|---|---|
| `apps/web/data/tv-layout.json` | Real zones + tvPositions + rooms | Bartender Video tab shows no TVs |
| `apps/web/data/directv-devices.json` | DirecTV receiver IPs (seed only; DB is source) | DirecTV Watch button can't tune |
| `apps/web/data/firetv-devices.json` | Same as DirecTV (seed only) | Fire TV not listed (DB is authoritative if seeded) |
| `apps/web/data/channel-presets-cable.json` | Per-location cable presets | Cable channel preset buttons missing |
| `apps/web/data/channel-presets-directv.json` | Per-location DirecTV presets | DirecTV preset buttons missing |
| `.env` | `LOCATION_ID`, `AUTH_COOKIE_SECURE=false`, API keys | Login fails / API calls fail |

**Verify file sizes after every merge from main** (auto-update has a guard but never hurts to double-check):
```bash
for f in apps/web/data/tv-layout.json apps/web/data/directv-devices.json apps/web/data/firetv-devices.json apps/web/data/channel-presets-cable.json apps/web/data/channel-presets-directv.json; do
  size=$(wc -c < /home/ubuntu/Sports-Bar-TV-Controller/$f 2>/dev/null)
  echo "  $f: $size bytes"
done
```

**Expect:** `tv-layout.json` is typically 10-50KB at a configured location; the JSON files are 1-10KB each. If `tv-layout.json` is 61 bytes, that's the empty template — auto-update overwrote your data, restore from git: `git show HEAD~1:apps/web/data/tv-layout.json > apps/web/data/tv-layout.json`.

---

## Per-location verification checklist (5-minute audit)

Run all of these on a location host. Any failure points to which section of this doc to read.

```bash
DB=/home/ubuntu/sports-bar-data/production.db

echo "=== 1. Version + PM2 ==="
grep '"version"' /home/ubuntu/Sports-Bar-TV-Controller/package.json | head -1
curl -s http://localhost:3001/api/health | jq -r '.status'

echo "=== 2. Auth tables ==="
sqlite3 $DB "SELECT 'Location:', COUNT(*) FROM Location WHERE isActive=1;"
sqlite3 $DB "SELECT 'AuthPin (ADMIN):', COUNT(*) FROM AuthPin WHERE role='ADMIN' AND isActive=1;"
sqlite3 $DB "SELECT 'AuthPin (STAFF):', COUNT(*) FROM AuthPin WHERE role='STAFF' AND isActive=1;"

echo "=== 3. Matrix config ==="
sqlite3 $DB "SELECT 'outputOffset:', outputOffset, 'audioOutputCount:', audioOutputCount FROM MatrixConfiguration WHERE isActive=1;"
sqlite3 $DB "SELECT 'MatrixInput rows:', COUNT(*) FROM MatrixInput WHERE isActive=1;"

echo "=== 4. Fire TV devices (Cube-having locations) ==="
sqlite3 $DB "SELECT id, name, ipAddress, inputChannel FROM FireTVDevice WHERE name NOT LIKE '%REPLAC%';"

echo "=== 5. input_sources.available_networks (CRITICAL — empty = walker skip) ==="
sqlite3 $DB "SELECT name, json_array_length(available_networks) AS app_count FROM input_sources WHERE type='firetv';"

echo "=== 6. Catalog freshness ==="
sqlite3 $DB "SELECT app, COUNT(*) tiles, datetime(MAX(capturedAt),'unixepoch','localtime') latest FROM firetv_streaming_catalog GROUP BY app;"

echo "=== 7. ESPN sync state ==="
sqlite3 $DB "SELECT COUNT(*) AS upcoming_games FROM game_schedules WHERE scheduled_start BETWEEN strftime('%s','now') AND strftime('%s','now','+48 hours');"

echo "=== 8. JSON files (location data) ==="
for f in apps/web/data/tv-layout.json apps/web/data/directv-devices.json apps/web/data/firetv-devices.json; do
  echo "  $f: $(wc -c < /home/ubuntu/Sports-Bar-TV-Controller/$f 2>/dev/null) bytes"
done
```

---

## What needs operator action vs. what auto-update handles

| Concern | Auto-updates handle? |
|---|---|
| Code changes (bug fixes, features) | YES |
| Schema changes (`drizzle-kit push`) | YES |
| New tables seeded from JSON (channel-presets, etc.) on FIRST install | YES (seed-from-json.ts) |
| Existing-row schema migrations | YES (drizzle-kit push, one-shot) |
| **Backfill** of existing-but-empty rows (e.g. `available_networks` was never populated at install) | **NO — operator must populate** |
| Per-location matrix outputOffset / audioOutputCount values | NO — operator-set during install per CLAUDE.md table |
| Cube ADB pairing | NO — operator must `adb pair` once per Cube |
| Streaming app sign-ins (ESPN+, Prime, Peacock) on each Cube | NO — operator signs in via TV remote |

**Lesson from v2.33.2:** when shipping a feature that requires DB rows to be populated (like `available_networks` for the walker), the auto-update can't backfill — it needs an explicit operator step OR a seed-from-json fallback. v2.33.2 added the walker but Lucky's 1313's `available_networks` had been blank since install; nobody noticed until the bartender remote showed empty streaming guides. Always document the manual backfill recipe in the version-specific entry of `VERSION_SETUP_GUIDE.md`.
