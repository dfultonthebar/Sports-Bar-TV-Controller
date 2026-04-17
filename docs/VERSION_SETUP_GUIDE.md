# Version Setup Guide

**Purpose:** This file tells Claude (and operators) what each version
release REQUIRES to work correctly at a location — new software to install,
DB rows to seed, env vars to set, verification steps to run.

It is different from `LOCATION_UPDATE_NOTES.md`:

- **`LOCATION_UPDATE_NOTES.md`** answers "should this auto-update proceed?"
  (GO/CAUTION/STOP risk assessment per commit).
- **`VERSION_SETUP_GUIDE.md`** (this file) answers "what do I need to DO
  for this version to function correctly?" (prescriptive setup tasks).

**How Claude uses it:**

During Checkpoint B of auto-update, after reading `LOCATION_UPDATE_NOTES.md`,
Claude reads the entry for every version between `PRE_MERGE_VERSION` and
`POST_MERGE_VERSION` in this file. For each entry with a "Required Manual
Step", Claude must either:

1. Verify the step was completed at this location (check the verification
   command), OR
2. Perform the step automatically if safe (`sqlite3 INSERT`, file seed, etc.), OR
3. Flag it in the checkpoint response so the operator knows to do it post-update.

**How to add an entry:**

Prepend a new section below the "Current entries" marker when bumping the
version on main. Keep entries under ~30 lines. If a version is purely
additive (no setup required), still include an entry saying "No setup
required" so Claude can confirm it read the doc.

**Cutoff:** entries older than 2 major versions can be pruned. Git history
is the archive.

---

## Current entries

### v2.19.0 — Per-league duration learning + Atlas endpoint guards
**Released:** 2026-04-17

**What changed (two independent features, bundled at minor bump):**

1. **Atlas endpoint guards.** Every `/api/atlas/*` endpoint that opens a
   TCP client now calls `requireAtlasProcessor()` before touching the
   processorIp. Locations using dbx ZonePRO or BSS London (but not Atlas)
   no longer get endless reconnect-loop errors when the audio UI is open —
   the endpoint returns 404 and the Atlas client is never constructed.
   New helper: `apps/web/src/lib/atlas-guard.ts`.

2. **Per-league game duration learning.** ESPN sync now populates
   `game_schedules.duration_minutes` when both `actual_start` and
   `actual_end` timestamps are known. The scheduler's bartender-schedule
   endpoint uses the per-league historical average (5+ samples required,
   5-minute cache) to default `expected_free_at` instead of the hardcoded
   3-hour value. New helper: `apps/web/src/lib/game-duration-stats.ts`.
   Each sport converges to its real duration over a few completed games,
   which gives the scheduler tighter allocation windows (NBA ~2h15m
   instead of 3h, NFL ~3h30m instead of 3h, etc.).

**Schema changes:** None. Uses existing `duration_minutes` column.

**Required manual steps:**
- [ ] **Backfill historical durations** (one-time, safe):
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" "UPDATE game_schedules
    SET duration_minutes = CAST(ROUND((actual_end - actual_start)/60.0) AS INTEGER)
    WHERE actual_start IS NOT NULL AND actual_end IS NOT NULL
      AND duration_minutes IS NULL
      AND (actual_end - actual_start)/60 BETWEEN 20 AND 360;"
  ```
  Rows outside 20-360 min are treated as outliers (cancelled / sync
  glitches) and left NULL. Durations will accrue naturally from new
  games going forward.

**Verification:**
```bash
# Show current per-league averages once enough samples exist:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT league, COUNT(*) AS n, ROUND(AVG(duration_minutes),0) AS avg_min
   FROM game_schedules WHERE duration_minutes IS NOT NULL
   GROUP BY league HAVING n >= 5 ORDER BY n DESC;"
```

**Caveats:**
- Before v2.19.0 ESPN sync overwrote `actual_start` with `scheduled_start`
  on every sync. Historical durations are relative to scheduled time, not
  real tune-in time, and will be slightly inflated (often 20-40 min) for
  late-starting games. Data from v2.19.0+ is accurate.
- First 5 completed games per league use the 3-hour default; after that
  the learned average kicks in.

---

### v2.18.0 — Override-learn hook for bartender matrix changes
**Released:** 2026-04-17

**What changed:**
`POST /api/matrix/route` now closes the scheduler's feedback loop. When
a bartender issues a manual route within 10 min of an active scheduled
allocation, the route handler patches that allocation's `tv_output_ids`
to reflect the correction so the hourly pattern-analyzer learns from it.
Home-team overrides (teams in the `HomeTeam` table) log at `warn` level
for stronger filtering.

**Schema changes:** None. Uses existing `input_source_allocations`,
`HomeTeam`, `SchedulerLog`, `input_sources`, `MatrixInput`.

**Required manual steps:** None. Hook activates on next `pm2 restart`
after the build completes.

**Verification:**
```bash
# After a bartender manually reroutes a scheduled TV, watch SchedulerLog:
sqlite3 /home/ubuntu/sports-bar-data/production.db <<SQL
SELECT datetime(createdAt,'unixepoch','localtime') AS ts,
       level, operation, message
FROM SchedulerLog
WHERE component='override-learn'
ORDER BY createdAt DESC LIMIT 10;
SQL
```

**Home team readiness (optional per-location):**
The hook flags overrides as `isHomeTeam=true` only when the team name
appears in the `HomeTeam` table. Lucky's 1313 has Brewers, Bucks, and
Badgers seeded; **Packers is not currently seeded** at Lucky's. To add:
```sql
INSERT INTO HomeTeam (id, teamName, sport, league, category, location, conference, isPrimary, isActive, priority, matchingStrategy, minMatchConfidence, minTVsWhenActive, autoPromotePlayoffs)
VALUES (lower(hex(randomblob(16))), 'Green Bay Packers', 'football', 'nfl', 'professional', 'Green Bay', 'NFC North', 1, 1, 0, 'fuzzy', 0.7, 1, 1);
```

**Why this matters:** Pattern-analyzer reads `tv_output_ids` hourly to
build per-team routing patterns. Bartender corrections within 10 min of
a scheduled tune are the highest-quality training signal the system can
capture — the bartender knows which sight-lines serve which teams best.

---

### v2.17.0 — Dep major upgrades (Tailwind 4, lucide-react 1, eslint 10)
**Released:** 2026-04-17

**New dependencies:**
- **`@tailwindcss/postcss`** installed as the replacement PostCSS plugin
  for Tailwind v4. `autoprefixer` was removed (baked into the new plugin).

**Dependencies removed:**
- **`sqlite3`** (the legacy package, not better-sqlite3). It was listed as
  a dependency but not imported anywhere in source — only appeared as a
  string literal in a shell-command allowlist. Removing it killed ~7
  security advisories that lived under its cacache/tar transitive tree.

**Schema changes:** None.

**Required manual steps:**
- [ ] **Tailwind CSS** — `apps/web/src/app/globals.css` no longer uses
  `@tailwind base/components/utilities` directives; it now uses
  `@import 'tailwindcss'` + `@theme { ... }`. If a location has custom
  CSS that extends Tailwind utilities, verify those still work after
  the upgrade. The `tailwind.config.js` file was retired — all theme
  customization lives inline in `globals.css` via `@theme`.
- [ ] **lucide-react 0.x → 1.x** — icon naming stable across this range,
  but any location that pinned to a specific 0.x version in its own code
  should re-verify renders. All icons used in the bartender remote and
  admin UI were confirmed working at Lucky's.

**Verification:**
```bash
# Build must succeed — any Tailwind class that v4 removed (e.g.,
# rounded default→rounded-sm) will surface here:
NODE_ENV=development npm run build

# verify-install 7/7
bash scripts/verify-install.sh

# Pages load with CSS intact
curl -s http://localhost:3001/remote | grep -c "tailwindcss"   # should be 0 (v4 inlines styles)
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3001/remote   # 200
```

**Rollback:** If Tailwind 4 breaks UI at a location, the rollback tag
`pre-dep-upgrade-YYYYMMDD-HHMMSS` (see `git tag | grep pre-dep`) captures
the pre-upgrade state. `git reset --hard <tag>` + `npm ci` + `npm run build`
restores Tailwind 3.

**Remaining vulnerabilities:** 11 (all in drizzle-kit + next-pwa dev
dependencies; upstream maintainers haven't released fixes). These are
build-time only, not exposed to runtime attackers, and cannot currently
be patched.

---

### v2.16.x — dbx ZonePRO audio + single-card Wolf Pack support
**Released:** 2026-04-17

**New dependencies:** None.

**Schema changes:** None.

**Required manual steps:**
- [ ] **If this location uses a dbx ZonePRO (not Atlas):** verify
  `AudioProcessor.processorType = 'dbx-zonepro'` in production.db. Set if
  missing:
  ```bash
  sqlite3 $DB "UPDATE AudioProcessor SET processorType='dbx-zonepro' WHERE model LIKE 'ZonePRO%';"
  ```
- [ ] **If single-card Wolf Pack (WP-8X8/16X16/36X36):** verify
  `MatrixConfiguration.outputOffset = 0` and `audioOutputCount = 0` (unless
  Wolf Pack outputs are wired to speakers). See CLAUDE.md §5a.
- [ ] **Populate `input_sources` table** if empty — AI Suggest requires rows.
  Seed from `IRDevice` (cable boxes) and `FireTVDevice` (streaming) via
  `/api/scheduling/input-sources` POST or direct SQL.

**Verification:**
```bash
# 1. Audio control reaches correct device
curl -s http://localhost:3001/api/audio-processor | grep processorType

# 2. Matrix routing lands on expected outputs (no outputOffset drift)
bash scripts/verify-install.sh   # matrix_config layer catches single-card drift

# 3. AI Suggest returns non-empty suggestions
curl -s -b cookiejar http://localhost:3001/api/scheduling/ai-suggest | jq .suggestions
```

---

### v2.15.x — Ollama-powered AI scheduling suggestions
**Released:** 2026-04-16

**New dependencies:**
- **Ollama CLI + `llama3.1:8b` model (~4.7GB)** required on the host.
  Auto-update.sh's `ollama_model` step runs `scripts/ensure-ollama-model.sh`
  which pulls the model on first run. First-run update extends by ~4-6
  minutes while the model downloads.

**Schema changes:** None.

**Required manual steps:**
- [ ] **Install Ollama if not already present.** Ubuntu 22+:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```
  The `ensure-ollama-model.sh` script will then pull `llama3.1:8b`
  automatically on the first update after installation.
- [ ] **Verify Ollama is running:**
  ```bash
  curl -s http://localhost:11434/api/tags | jq '.models[].name'
  # Expect to see "llama3.1:8b"
  ```

**Verification:**
```bash
# Manual probe
ollama run llama3.1:8b "Say ok" --verbose
# Should respond with a short "ok" within ~3s of first run

# AI Suggest via API
curl -s -b cookiejar http://localhost:3001/api/scheduling/ai-suggest
```

**If Ollama fails:** AI Suggest degrades gracefully — the endpoint returns
`suggestions: []` with an explanatory message. Other app features continue
to work. Ollama is non-fatal.

---

### v2.12.x — Auto-update hardening + bidirectional memory sync
**Released:** 2026-04-16

**New dependencies:** None.

**Schema changes:**
- Added `MatrixConfiguration.chassisId` (nullable TEXT) for multi-card
  support. Auto-applied by drizzle-kit push.

**Required manual steps:**
- [ ] **Install the auto-update systemd timer** (one-time per host):
  ```bash
  bash scripts/install-auto-update-timer.sh
  sudo loginctl enable-linger ubuntu   # headless hosts
  ```
- [ ] **Sync memory with CLAUDE.md Rule 7** — Checkpoint B reads this
  section and saves any missing entries to host memory automatically.

**Verification:**
```bash
# Timer armed
systemctl --user list-timers sports-bar-autoupdate.timer

# verify-install 7/7 (includes matrix_config layer added in v2.16.x)
bash scripts/verify-install.sh
```

---

### v2.11.x — Drizzle schema push resilience
**Released:** 2026-04-16

**New dependencies:** None.

**Schema changes:** Iterative + bulk-regenerate fallback added to handle
drizzle-kit push's atomic-rollback-on-duplicate-index behavior at
locations with months of pre-existing indexes.

**Required manual steps:** None — fully automatic. If a location's
auto-update hangs at the `schema_push` step, check logs for
`[SCHEMA] bulk-regenerate fallback` — that's the new path kicking in.

**Verification:**
```bash
# Verify schema is in sync
NODE_ENV=development npx drizzle-kit push
# Expect clean success OR the documented benign "already exists" warning
```

---

### v2.8.x — Samsung model probe + TV power audit trail
**Released:** 2026-04-15

**New dependencies:** None.

**Schema changes:**
- New `ChannelTuneLog` table — auto-applied by drizzle-kit push. If
  missing after an update, see CLAUDE.md Gotcha #7 for manual CREATE.

**Required manual steps:**
- [ ] **If Samsung TVs present:** run the model probe once after first
  update to populate the `model` column with real identifiers:
  ```bash
  curl -sS -b cookiejar -X POST http://localhost:3001/api/tv-discovery/probe-models
  ```
  (Runs automatically every 4 hours via instrumentation.ts after v2.8.0.)
- [ ] **If LG TVs present:** each TV must accept a one-time pairing
  dialog to populate `clientKey`. Triggered by the first power command
  from the bartender remote.

**Verification:**
```bash
sqlite3 $DB "SELECT ipAddress, brand, model, CASE WHEN authToken IS NULL THEN 'unpaired' ELSE 'paired' END FROM NetworkTVDevice;"
```

---

## Known Errors & Fixes

Append entries here whenever a location hits an error that was non-obvious
to diagnose. Format:

- **Symptom:** what the operator/UI showed
- **Root cause:** why it happened
- **Fix:** the exact SQL/command/code change that resolved it
- **Verification:** how to confirm the fix worked
- **Applies to:** `all locations` or a specific location tag
- **First seen:** YYYY-MM-DD at which location

The goal: every other location inheriting this file from main should find
the answer here instead of re-debugging from scratch. Per CLAUDE.md Rule
8, you MUST add an entry when you fix a non-trivial error.

### Atlas endpoint reconnect loop on dbx/BSS locations

- **Symptom:** PM2 error log fills with thousands of
  `[ERROR] [CONNECTION] Failed to connect to Atlas processor at X.X.X.X:5321`
  messages per minute. Happens at locations that use **dbx ZonePRO** or
  **BSS Soundweb London** for audio (not Atlas). The X.X.X.X is the
  real audio processor's IP, but port 5321 is the Atlas TCP port — the
  non-Atlas device rejects the connection immediately and the Atlas
  client-manager retries forever.
- **Root cause:** Atlas endpoints (`/api/atlas/meters/stream`,
  `/api/atlas/output-meters`, etc.) didn't check the AudioProcessor's
  `processorType` before handing the IP to `getAtlasClient()`. Any
  component that polled `/api/atlas/*` on page load (audio meters,
  sources UI) started a persistent retry loop.
- **Fix (code — v2.19.0):** new helper `apps/web/src/lib/atlas-guard.ts`
  added to every Atlas endpoint. It looks up the AudioProcessor row by
  IP and returns 404 unless `processorType='atlas'`. Eliminates the
  loop at the source — no Atlas client is ever constructed for a
  non-Atlas processor.
- **Verification:**
  ```bash
  # After restart, count Atlas errors in the last minute. Should be 0:
  pm2 logs sports-bar-tv-controller --err --lines 500 --nostream \
    | awk -v ts="$(date -u -d '-1 minute' '+%Y-%m-%d %H:%M:')" '$0 >= ts' \
    | grep -c "Atlas processor"
  ```
- **Applies to:** any location whose audio processor is NOT Atlas.
  Atlas-using locations are unaffected (the guard passes when the
  AudioProcessor row has `processorType='atlas'`).
- **First seen:** 2026-04-17 at Lucky's 1313 (dbx ZonePRO 1260m at
  192.168.10.50 — the Atlas client was hammering port 5321 on that IP
  while the dbx answered on 3804).

### Scheduler tunes the right channel but TVs never switch to the right input

- **Symptom:** A scheduled game fires — `scheduler-service/tune` log
  shows success, the cable box is confirmed on the correct channel —
  but the TVs that were assigned to that allocation are displaying
  something completely different (another sport, a menu, the previous
  input). The bartender has to go to the Video tab and manually move
  each TV onto the right input for every single scheduled game. This
  has been silently broken for the entire life of the bartender-
  scheduling feature; no one caught it because the tune itself always
  logged success and the channel change was visible on the cable box
  LEDs / TV-it-happened-to-land-on.
- **Root cause:** In `packages/scheduler/src/scheduler-service.ts` the
  matrix-routing loop inside `checkAndExecuteBartenderSchedules` did:
  ```ts
  const matrixInput = parseInt(inputSource.matrixInputId, 10);
  ```
  But `inputSource.matrixInputId` is a **UUID foreign key** to
  `MatrixInput.id`, not the physical input channel number.
  `parseInt("a9a2828b9eb...", 10)` returns `NaN`, and
  `parseInt("99ad5b127e...", 10)` returns `99` (reads leading digits
  until the letter). Either result gets passed as `input:` to
  `/api/matrix/route`. The Wolf Pack silently rejects NaN / out-of-range
  values OR routes the output to an unrelated physical input. Either
  way the TV ends up on the wrong source.
- **Detection:** Check whether any output claimed by an active
  scheduled allocation is actually routed to that allocation's source:
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" <<'SQL'
  WITH alloc_outputs AS (
    SELECT s.name AS src, mi.channelNumber AS expected_input, j.value AS output
    FROM input_source_allocations a
    JOIN input_sources s ON s.id = a.input_source_id
    JOIN MatrixInput mi ON mi.id = s.matrix_input_id
    JOIN json_each(a.tv_output_ids) j
    WHERE a.status = 'active'
  )
  SELECT ao.src, ao.output, ao.expected_input AS expected, mr.inputNum AS actual,
         CASE WHEN ao.expected_input = mr.inputNum THEN 'ok' ELSE 'MIS-ROUTED' END AS state
  FROM alloc_outputs ao
  LEFT JOIN MatrixRoute mr ON mr.outputNum = ao.output
  ORDER BY ao.src, ao.output;
  SQL
  ```
  Any row showing `MIS-ROUTED` means the scheduler's matrix loop failed.
- **Fix (code — v2.18.2):** Replace the broken parseInt with a DB
  lookup that resolves the UUID to the actual `channelNumber`:
  ```ts
  const matrixInputRow = await db.select({
      channelNumber: schema.matrixInputs.channelNumber,
    })
    .from(schema.matrixInputs)
    .where(eq(schema.matrixInputs.id, inputSource.matrixInputId))
    .limit(1)
    .all();
  const matrixInput = matrixInputRow[0]?.channelNumber ?? NaN;
  ```
  After deploying v2.18.2, every future scheduled tune routes TVs
  correctly without bartender rescue.
- **Fix (live state for active games, tonight only):** While the new
  code only helps the NEXT tune, existing active games are still on
  the wrong inputs. Patch them directly via `/api/matrix/route` per
  output, using the correct input channel from `input_sources` →
  `MatrixInput.channelNumber`. Example for Cable Box 1 (input 1):
  ```bash
  for out in 1 3 5 6 8 10 12 13 14 16; do
    curl -s -X POST http://localhost:3001/api/matrix/route \
      -H 'Content-Type: application/json' \
      -d "{\"input\":1,\"output\":$out,\"source\":\"system\"}"
  done
  ```
- **Verification:** re-run the detection query above; `state` should
  be `ok` for every row. Also watch the next scheduled tune in
  `SchedulerLog`: `[OVERRIDE-LEARN]` entries will STOP appearing
  immediately after a schedule fires, because the bartender no longer
  needs to correct TVs — a quiet log here means the scheduler is
  doing its job.
- **Applies to:** all locations running any version prior to v2.18.2.
  The bug has been there for the entire life of the bartender-schedule
  feature — silently defeating every scheduled tune at every
  location.
- **First seen:** 2026-04-17 at Lucky's 1313. Noticed when investigating
  why the Brewers allocation on 10 TVs was only actually landing on 3,
  and confirmed on the SE Louisiana tune at 18:25 CDT — the channel
  fired correctly but all 4 TVs stayed on their prior inputs. The
  LSU tune earlier the same evening was partially correct by pure
  coincidence (one TV had already been manually routed to input 2).

### Scheduler shows cable box as "Idle" while a game is actively tuned on it

- **Symptom:** On the Sports Guide admin scheduler page, a Cable Box card
  shows "Idle" even though:
  - `input_source_allocations` has a row with `status='active'` for that box
  - The physical box is correctly tuned to the game's channel
  - `SchedulerLog` shows a successful `scheduler-service/tune` entry
  Other cable boxes in the same UI show their games correctly.
- **Root causes (two variants — check both):**
  1. **`input_sources.currently_allocated` / `current_channel` not set
     after tune.** Prior to v2.18.0, `scheduler-service.checkAndExecute
     BartenderSchedules()` flipped the allocation to `active` but never
     updated the `input_sources` row. The UI reads both tables — if the
     source row is stale, the card renders as idle. Fixed in v2.18.0,
     but existing rows need one-time backfill.
  2. **`InputCurrentChannel.inputLabel` mismatch.** The scheduler UI
     joins allocations to current-channel rows by exact string match on
     `inputLabel`. Historical rows may have a shortened label like
     `"Cable 1"` while the allocation returns `"Cable Box 1"` (from
     `input_sources.name`). The join fails → card shows idle. Other
     boxes with matching labels render correctly. No automated UI
     surface reveals the mismatch — you have to diff the two API
     responses.
- **Diagnostic commands:**
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  # Variant 1: any active allocation whose source row is still idle?
  sqlite3 "$DB" "SELECT s.name, s.currently_allocated, a.status, a.channel_number
    FROM input_source_allocations a
    JOIN input_sources s ON s.id = a.input_source_id
    WHERE a.status = 'active';"
  # (currently_allocated should be 1 — if it's 0, variant 1 applies)

  # Variant 2: does InputCurrentChannel.inputLabel match input_sources.name?
  sqlite3 "$DB" "SELECT icc.inputNum, icc.inputLabel AS channel_label,
    s.name AS source_name,
    CASE WHEN icc.inputLabel = s.name THEN 'match' ELSE 'MISMATCH' END AS status
    FROM InputCurrentChannel icc
    LEFT JOIN input_sources s ON s.matrix_input_id = (
      SELECT id FROM MatrixInput WHERE channelNumber = icc.inputNum LIMIT 1)
    ORDER BY icc.inputNum;"
  ```
- **Fix:**
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db

  # Variant 1: backfill input_sources state from active allocations
  sqlite3 "$DB" "UPDATE input_sources
    SET currently_allocated = 1,
        current_channel = (SELECT a.channel_number FROM input_source_allocations a
                           WHERE a.input_source_id = input_sources.id
                             AND a.status = 'active'
                           ORDER BY a.allocated_at DESC LIMIT 1),
        updated_at = strftime('%s','now')
    WHERE EXISTS (SELECT 1 FROM input_source_allocations a
                  WHERE a.input_source_id = input_sources.id AND a.status = 'active');"

  # Variant 2: normalize InputCurrentChannel.inputLabel to match input_sources.name
  # For each mismatch row from the diagnostic above:
  sqlite3 "$DB" "UPDATE InputCurrentChannel SET inputLabel = 'Cable Box 1' WHERE inputNum = 1;"
  # Repeat per inputNum as needed. The UPDATE path in channel-presets/tune does
  # not touch inputLabel, so the corrected value persists across future tunes.
  ```
- **Verification:** refresh the Sports Guide admin scheduler page. The
  previously-idle box now shows the game's teams below the channel number.
  Also:
  ```bash
  diff <(curl -s http://localhost:3001/api/schedules/bartender-schedule | jq -r '.schedules[] | select(.status=="active") | .inputLabel') \
       <(curl -s http://localhost:3001/api/matrix/current-channels | jq -r '.channels | to_entries[] | .value.inputLabel')
  # Empty diff = all labels match.
  ```
- **Applies to:** all locations. Variant 1 affects any deployment with
  bartender allocations that activated before v2.18.0 upgrade. Variant 2
  affects any deployment with historical short-label rows in
  `InputCurrentChannel`.
- **First seen:** 2026-04-17 at Lucky's 1313. Variant 1 was found first
  (both cable boxes 1 and 2 affected); variant 2 was exposed after
  variant 1 was backfilled and Box 1 still showed idle while Box 2
  correctly displayed LSU game — the label diff between Box 1
  (`"Cable 1"`) and Box 2 (`"Cable Box 2"`) was the tell.

### AI Suggest returns `suggestions: []` with "No active input sources configured"

- **Symptom:** clicking "Get Suggestions" on the scheduler UI does
  nothing; `GET /api/scheduling/ai-suggest` returns empty with message
  `"No active input sources configured. Add cable boxes or streaming
  devices first."`
- **Root cause:** the `input_sources` table is empty. AI Suggest reads
  from this normalized table, which is supposed to be seeded from
  `IRDevice` + `FireTVDevice` + `DirecTVDevice` but the seed step was
  missed.
- **Fix:** populate `input_sources` from existing device tables. SQL
  template (adjust IDs to match your `IRDevice.id` and
  `MatrixInput.id` values):
  ```sql
  INSERT INTO input_sources (id, name, type, device_id, matrix_input_id,
    available_networks, is_active, currently_allocated, priority_rank,
    created_at, updated_at)
  VALUES ('is-cable-1','Cable Box 1','cable','<IRDevice-id>',
    '<MatrixInput-id>','[]',1,0,50, strftime('%s','now'), strftime('%s','now'));
  ```
- **Verification:** `curl -s -b cookiejar
  http://localhost:3001/api/scheduling/ai-suggest | jq '.suggestions | length'`
  should return > 0 when games are live.
- **Applies to:** all locations
- **First seen:** 2026-04-17 at Lucky's 1313

### Default Source Settings UI spinner forever

- **Symptom:** `/system-admin` → Default Source Settings tab loads
  indefinitely (perpetual spinner), never shows form.
- **Root cause:** `loadData()` sequentially awaits
  `/api/atlas/sources?processorIp=<ip>` with no timeout. The Atlas
  HiQnet probe hangs on a non-Atlas audio processor (e.g., dbx ZonePRO)
  because HiQnet isn't spoken by those devices.
- **Fix:** patched in v2.16.5 —
  `apps/web/src/components/DefaultSourceSettings.tsx` now checks
  `processor.processorType === 'atlas'` before probing + wraps the
  fetch in a 5s `AbortController`. If you hit this on a pre-v2.16.5
  location: either cherry-pick the patch, or temporarily unset the
  AudioProcessor row to skip the fetch path.
- **Verification:** open the page, it should render form controls
  within 3 seconds regardless of audio processor type.
- **Applies to:** all non-Atlas locations (dbx/BSS/etc.)
- **First seen:** 2026-04-17 at Lucky's 1313 (dbx ZonePRO 1260m)

### Matrix routing lands on wrong physical output

- **Symptom:** clicking "route to Output 1" on bartender remote
  changes the TV on output 27 (or wherever +26 lands). Operator sees
  "nothing happens" when the intended TV is actually fine; a different
  TV silently changed source.
- **Root cause:** `MatrixConfiguration.outputOffset` is set to a
  non-zero value on a single-card Wolf Pack (WP-8X8/16X16/36X36).
  `wolfpack-matrix-service.ts` adds the offset to every output number
  before sending the routing command. Single-card matrices route 1:1
  and must have `outputOffset=0`.
- **Fix:**
  ```sql
  UPDATE MatrixConfiguration SET outputOffset=0, audioOutputCount=0,
    updatedAt=datetime('now') WHERE model LIKE 'WP-%X%';
  ```
  (Only set `audioOutputCount=0` if audio is NOT wired to the Wolf
  Pack — Lucky's routes audio via dbx ZonePRO, not Wolf Pack outputs.)
  After the UPDATE, `pm2 restart sports-bar-tv-controller` to clear
  any cached route maps.
- **Verification:** v2.16.6+ adds `matrix_config` layer to
  `scripts/verify-install.sh` which FAILs if a single-card model has
  non-zero outputOffset. Also `[MATRIX-CONFIG] ⚠` is logged at every
  PM2 boot for the same condition. See CLAUDE.md §5a.
- **Applies to:** any location with a single-card Wolf Pack
- **First seen:** 2026-04-17 at Lucky's 1313 (`outputOffset=26` on
  WP-36X36 for weeks)

### `/api/bartender/layout` renders "No Layout Uploaded" despite layout existing

- **Symptom:** bartender remote Video tab shows "No Layout Uploaded"
  even though the DB has a `BartenderLayout` row with valid
  `imageUrl` and 20+ zones.
- **Root cause:** the API response uses `backgroundImage` but the
  `InteractiveBartenderLayout` component reads
  `layout.imageUrl || layout.professionalImageUrl` — name mismatch.
- **Fix:** patched in v2.16.7 —
  `apps/web/src/app/api/bartender/layout/route.ts` now returns both
  `imageUrl` and `professionalImageUrl` alongside `backgroundImage`
  for backward compat.
- **Verification:** `curl -s
  http://localhost:3001/api/bartender/layout | jq '.layout.imageUrl'`
  should be the `/api/uploads/layouts/...` path, not `null`.
- **Applies to:** all locations pre-v2.16.7
- **First seen:** 2026-04-17 at Lucky's 1313

### Auto-update schema_push never converges (350-iter cap hit)

- **Symptom:** `[SCHEMA] iterative retry hit cap (350) without
  converging` in the auto-update log. Run rolls back.
- **Root cause:** drizzle-kit push cycles through the same duplicate
  indexes at locations with many hotfix-era indexes. Iterative
  drop-and-retry never gets ahead of the cycling.
- **Fix:** v2.12.5 added a bulk-regenerate fallback — drop all
  user-defined indexes, run `drizzle-kit generate` to get the
  canonical CREATE list, apply `CREATE ... IF NOT EXISTS` in one
  transaction, final push reports benign already-exists (schema IS
  in sync). Pre-v2.12.5 locations: upgrade the auto-update.sh
  manually before the next run.
- **Verification:** auto-update log shows `[SCHEMA] bulk-apply:
  created N indexes from generate output` followed by `[SCHEMA]
  bulk-regenerate fallback: final push reports benign pre-existing
  objects — schema IS in sync`.
- **Applies to:** all locations
- **First seen:** 2026-04-16 at Lucky's 1313

---

## Archive

Older entries (>2 major versions back) pruned from this file. `git log docs/VERSION_SETUP_GUIDE.md` is the archive.
