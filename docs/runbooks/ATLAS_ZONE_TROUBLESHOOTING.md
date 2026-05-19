# Atlas Zone Troubleshooting Runbook

**Purpose:** Walk an operator step-by-step from "bartender says Zone X is too quiet / silent / dropping" through bartender Audio tab → Atlas web GUI → meter readings → priority overrides → firmware 4.5 Custom Priority Volume gotcha.
**Audience:** operators, admins, Claude Code agents.
**Read time:** ~10 minutes.

## When to use this runbook

- A bartender reports a zone is silent, muted, "stuck quiet," or oscillating volume.
- The amber Atlas priority banner is stuck up on the bartender remote Audio tab.
- The `atlas_drop_events` table has 10+ rows for the same zone in the last hour (the "50-zone-drop incident pattern").
- Volume meter on a zone reads `-∞ dB` when it should be playing music.
- After an Atlas firmware update, zones randomly snap quiet during mic/page events and recover when the mic releases.

## Pre-flight checks

- [ ] You have a recent `pm2 logs sports-bar-tv-controller --lines 100` open in another terminal.
- [ ] You can reach the Atlas web GUI at `http://<atlas_ip>` (Holmgren: `http://10.11.3.246`, verify in DB for other locations).
- [ ] You know the zone number you are debugging (1-4 for AZM4, 1-8 for AZM8).
- [ ] You have the location's reference doc open: `.claude/locations/<branch>.md`.
- [ ] You have the operator on the phone or at the bar; you may need them to confirm what they physically hear.

## Architecture context (so the next steps make sense)

- **ONE persistent `ExtendedAtlasClient` per processor IP:port**, managed by `atlasClientManager` (hoisted to `globalThis` per CLAUDE.md Gotcha #10).
- TCP **5321** for JSON-RPC commands (volume set, source set, scene recall).
- UDP **3131** for subscribed meter pushes (`SourceMeter_N`, `ZoneMeter_N`, `GroupMeter_N` in dB).
- Two background watchers run from `instrumentation.ts`:
  - `atlas-drop-watcher` polls every 30s, fires `drop_event` when zone gain delta ≥15 lands ≤10.
  - `atlas-priority-watcher` polls input meters every 5s, fires when any input matching `/\b(mic|juke|page|intercom|priority)\b/i` crosses −45 dB.
- Both write to `atlas_drop_events` / `atlas_priority_events` SQLite tables.

## Step 1 — Confirm the symptom in the UI

```bash
# What does the bartender remote show?
curl -s 'http://localhost:3001/api/atlas-priority?active=true' | jq .
curl -s 'http://localhost:3001/api/atlas-drops?limit=20' | jq '.[] | {ts, zoneId, prev_volume, live_volume, event_type, gap_seconds}'
```

**Expected when healthy:** priority returns `[]`, drops returns rows that are spaced minutes/hours apart.
**Expected when in the "50-zone-drop incident pattern":** drops shows the same `zoneId` with `event_type: "silent_drop"` rows every 30 seconds, `gap_seconds` incrementing 30, 60, 90, ...

If you see the staircase pattern, **stop, this is the watcher cache bug — see Step 6 directly.**

## Step 2 — Check the live meter cache

The bartender Audio tab reads from the meter cache, not directly from Atlas. If the cache is stale you get a wrong picture.

```bash
curl -s 'http://localhost:3001/api/atlas/meters/snapshot' | jq '.zones[] | {id, name, volume_db, source, source_label, lastSeenAgoMs}'
```

**Expected:** `lastSeenAgoMs` should be `< 2000` for every zone. If it's `>10000` for one zone, that zone's UDP meter stopped pushing — likely a network blip or the Atlas rebooted. Wait 30s and re-curl; if still stale, see Step 7 (Atlas client reset).

## Step 3 — Cross-check against the Atlas web GUI

Open `http://<atlas_ip>` in a browser (Holmgren: `http://10.11.3.246`). Log in if prompted (default Atlas creds are in the location's `.claude/locations/<branch>.md`).

1. Navigate to **Zones** → click the offending zone.
2. Note the **Volume** slider position (0-100 scale, NOT dB).
3. Note the **Source** dropdown — what input is the zone listening to?
4. Look at the level meter on the right of the zone strip.

**If GUI shows low volume + dB meter shows signal:** the volume IS low; bartender is right. Either someone moved a wall remote, or a priority/scene change pinned it low. Go to Step 4.

**If GUI shows normal volume + bartender hears nothing:** the problem is downstream of Atlas (amplifier muted, speaker disconnected, BSS/dbx ducker engaged). Atlas is doing its job — this runbook can't help. Check `packages/bss-blu/README.md` or `packages/dbx-zonepro/README.md`.

**If GUI volume oscillates (rises then snaps back every few seconds):** a priority is firing repeatedly. Go to Step 5.

## Step 4 — Check Custom Priority Volume (firmware 4.5+ ONLY)

**This is the #1 cause of "stuck quiet zone" complaints on Atlas firmware 4.5.x — added July 2025, shipped to fleet ~May 2026.**

In the Atlas web GUI:

1. Navigate to **Sources** → **Priority** (NOT Zones).
2. For each priority-tagged input (mic, page, GPI, X-ZPS, etc.):
   - Look for a **"Custom Volume"** or **"Custom Level"** field next to that input.
   - Note the value. If set to a low percentage (e.g. `5%`, `-50 dB`) AND that priority input is currently firing → **that is your "drop."** It is not a bug; it's the configured ducking level.

**Fix options:**
- Raise the Custom Volume to a less-jarring level (try `40%` / `-15 dB`).
- Switch the field back to "Zone Volume" (legacy ducking behavior — duck by a fixed dB offset relative to current zone level).
- Or accept that drops on that zone are intentional and add the zone to the watcher's ignore list (see `apps/web/src/lib/atlas-drop-watcher.ts` — comment the zone out of the polled list).

**Why this matters for the drop watcher:** Custom Priority Volume produces EXACTLY the drop signature the watcher looks for (≥15 point delta landing ≤10). Until the operator changes Custom Volume settings, the watcher WILL keep flagging these as `silent_drop` — but they're real, intended firmware behavior, not a glitch.

## Step 5 — Identify which priority is firing

```bash
curl -s 'http://localhost:3001/api/atlas-priority?active=true' | jq .
```

**Expected output when a mic is hot:**
```json
[
  {
    "ts": "2026-05-18T19:42:11Z",
    "processorId": "atlas-holmgren-main",
    "input": "Mic 1",
    "input_meter_db": -32.1,
    "event_type": "mic_active",
    "noted_source_override": "Zone 3"
  }
]
```

**Investigate:**
- Is someone actually using a microphone? Look at the floor.
- Is the mic input phantom-power-bumped or a stuck cable causing constant signal above the −45 dBFS threshold? Unplug XLR at the wall plate; priority should clear within 5s.
- Is a jukebox / GPI input wired to a priority slot? Check the Atlas GUI **Sources → Priority** tab.
- Is a Shure SLX-D ghost carrier triggering the mic? Run:
  ```bash
  curl -s 'http://localhost:3001/api/shure-rf?active=true' | jq .
  ```
  If this returns rows AND the priority event has `event_type: "rf_induced_mic_active"`, the receiver is hearing interference — not a real mic. See `packages/shure-slxd/README.md` for RF coordination.

## Step 6 — Diagnose the watcher cache bug (50-drop incident)

If Step 1 showed the staircase pattern (same zone, 30s gap, gap_seconds incrementing), the `atlas-drop-watcher` is in a stuck-cache loop. Confirmed root cause from v2.42.1:

The watcher updates `lastSeen` AT THE END of its per-zone loop, AFTER conditional INSERTs into `atlas_drop_events` and `atlas_priority_events`. If an INSERT throws (column mismatch, FK violation, anything), `lastSeen.set(key, live)` never runs. Next poll reads a stale `prev`, compares against unchanged `live`, fires the SAME drop event. Repeat every 30s.

**Confirm:**
```bash
pm2 logs sports-bar-tv-controller --lines 200 | grep -E 'atlas-drop|atlas-priority' | tail -40
```

If you see repeated `INSERT INTO atlas_*_events` errors, that's the loop.

**Immediate stop:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "DELETE FROM atlas_drop_events WHERE event_type='silent_drop' AND ts > datetime('now', '-1 hour');"
```

**Permanent fix:** Confirm you're on v2.42.1+. The pattern is:
```ts
// GOOD (v2.42.1+):
const prev = lastSeen.get(key)
const live = await readLive()
lastSeen.set(key, live)   // cache IMMEDIATELY, before any conditional INSERT
if (prev) { /* INSERT logic that may throw */ }
```

If the watcher in `apps/web/src/lib/atlas-drop-watcher.ts` still sets `lastSeen` at the END of the function, this version was reverted or a regression slipped in. Fix and bump version.

A per-zone cooldown is the belt-and-suspenders fix — even if cache logic breaks again, the same key can't re-fire within 5 minutes. Confirm `COOLDOWN_MS = 5 * 60 * 1000` is present at the top of the watcher file.

## Step 7 — Atlas client reset (last resort)

If meters are stale across ALL zones AND restart didn't help, the persistent `ExtendedAtlasClient` may have wedged. Because of CLAUDE.md Gotcha #10, force-restart PM2 (not just the route):

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
pm2 restart sports-bar-tv-controller
sleep 10
curl -s 'http://localhost:3001/api/atlas/meters/snapshot' | jq '.zones[0] | {name, volume_db, lastSeenAgoMs}'
```

`lastSeenAgoMs` should drop to `< 2000` within 10 seconds. If not:

1. Check Atlas is reachable: `nc -zv 10.11.3.246 5321` (TCP) and `nc -zvu 10.11.3.246 3131` (UDP).
2. Check the Atlas hasn't rebooted itself: open the web GUI, look at uptime in **System → Status**.
3. Check the host's UDP socket is bound: `sudo ss -ulnp | grep 3131` — should show `node` listening on 3131.

## Verification

After applying any fix:

1. **No active priority:**
   ```bash
   curl -s 'http://localhost:3001/api/atlas-priority?active=true' | jq 'length'
   ```
   Expected: `0`.

2. **No new drops for 5 minutes:**
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT COUNT(*) FROM atlas_drop_events WHERE ts > datetime('now', '-5 minutes');"
   ```
   Expected: `0` (after the cooldown window passes).

3. **Bartender sees normal levels:** open the bartender remote Audio tab, confirm the amber banner is gone and zone volumes look right.

4. **Operator confirms audio:** ask the bartender if music is back in the zone.

## If still broken

- **Custom Priority Volume tweak didn't help and operator insists no mic is active:** capture `curl 'http://localhost:3001/api/atlas-priority?active=true&hours=4'` and `curl 'http://localhost:3001/api/atlas/meters/snapshot' > /tmp/meters.json` for review.
- **Multiple zones affected simultaneously:** likely a scene recall or all-call page. Check **Atlas GUI → Scenes** for recent recall history.
- **Atlas web GUI itself is unresponsive:** the unit is wedged. Power-cycle it (rack PDU or pull power). On boot it auto-recalls Scene 1, which restores last-known good zone state for our integrations.
- **After power cycle, dbx still wedged:** dbx ZonePRO has its own failsafe-mode escape — see `packages/dbx-zonepro/README.md` re: "auto-recall Scene 1 on connect to escape failsafe-mode source-shift."

## Escalation path

1. Snapshot: `curl -s 'http://localhost:3001/api/atlas/meters/snapshot' > /tmp/atlas-meters-$(date +%s).json`.
2. Snapshot: `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT * FROM atlas_drop_events ORDER BY ts DESC LIMIT 100;" > /tmp/atlas-drops.txt`.
3. Snapshot: `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT * FROM atlas_priority_events ORDER BY ts DESC LIMIT 100;" > /tmp/atlas-priorities.txt`.
4. Atlas firmware version: GUI → **System → About** → record version.
5. Open issue / page operator with snapshots + firmware version.

## Cross-references

- **CLAUDE.md §7** — Atlas TCP+UDP architecture, `atlasClientManager` singleton.
- **CLAUDE.md §7 (Atlas audit tables)** — `atlas_drop_events` and `atlas_priority_events` schemas + watcher behavior.
- **CLAUDE.md Gotcha #10** — Next.js per-bundle singleton pattern; why `atlasClientManager` lives on `globalThis`.
- **`packages/atlas/README.md`** — full protocol reference, JSON-RPC verbs, port numbers.
- **Memory file:** `feedback_atlas_firmware_4_5_custom_priority_volume.md` — origin of the Custom Priority Volume gotcha.
- **Memory file:** `feedback_watcher_cache_after_action.md` — origin of the 50-drop watcher cache bug + the cooldown belt-and-suspenders fix.
- **Memory file:** `feedback_atlas_azm8_no_priority_param.md` — why we infer priority from input meters instead of querying a parameter (60+ candidate verbs probed, none worked).
- **Related runbook:** `PM2_RESTART_RUNBOOK.md` for the Atlas client reset step.
- **Source:** `apps/web/src/lib/atlas-drop-watcher.ts` — the watcher with the fixed cache pattern.
- **Source:** `apps/web/src/lib/atlas-priority-watcher.ts` — the priority watcher + RF correlation.
- **Source:** `apps/web/src/app/api/atlas-drops/route.ts` — drop event history endpoint.
- **Source:** `apps/web/src/app/api/atlas-priority/route.ts` — priority event endpoint.
