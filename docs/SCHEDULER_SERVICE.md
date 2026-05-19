# Scheduler Service — the 60-Second Tick That Powers Continuous Monitoring

**Audience:** anyone debugging "why isn't the AI Game Monitor running" or "why aren't bartender-scheduled tunes firing" or "why isn't currentApp updating on the bartender remote."

**TL;DR:** `schedulerService.start()` registers a 60-second `setInterval` PLUS five other polling jobs that drive every continuous/scheduled feature in the app. If `instrumentation.ts` fails to import the package (as it did silently between the V2 monorepo split and v2.50.15), ALL these features stop without an obvious symptom — just stale data and "nothing's happening" complaints. See `docs/AUTO_UPDATE_TROUBLESHOOTING.md` for the broader failure-mode catalog; this doc focuses on what the scheduler actually does and how to verify it's running.

---

## How it's started

`apps/web/src/instrumentation.ts` (Next.js standard entry-point for background services) dynamically imports `@sports-bar/scheduler` once, on app startup, then calls `schedulerService.start()`. The dynamic import is the right pattern because the scheduler imports DB/logger packages that themselves run startup logic — keeping it lazy means the main Next.js process boots first and the scheduler starts a few seconds behind.

```typescript
// apps/web/src/instrumentation.ts (≈ line 82)
try {
  const { schedulerService } = await import('@sports-bar/scheduler')
  schedulerService.start()
  logger.info('[INSTRUMENTATION] ✅ Scheduler service started - monitoring for continuous schedules every 60 seconds')
} catch (error) {
  logger.error('[INSTRUMENTATION] ❌ Failed to initialize scheduler service:', error)
}
```

**Critical:** the `try/catch` swallows any import/start failure. If the import path is wrong (as it was — pointing at the pre-V2 `./lib/scheduler-service` location which doesn't exist after monorepo split), the catch logs only the bare message without the Error object's stack. The "Failed to initialize" line accumulates in PM2 errors every restart but looks cosmetic. **It is not — when this fails, every scheduled feature listed below silently stops.**

## What `schedulerService.start()` runs

Five concurrent polling jobs, registered via `registerPoll()` (which tracks intervals centrally so `stop()` can clear all of them — v2.31.8 fix for the per-interval leak that the per-job-handles approach had).

### 1. `checkAndExecuteSchedules` — every 60 seconds (the primary tick)

Reads the `Schedule` table. For each enabled row whose `startTime` is now (within tolerance), it executes the scheduled action — primarily channel changes for `scheduleType='continuous'` (the AI Game Monitor) and one-shot bartender tunes (`scheduleType='bartender'`).

On startup, the tick is sequenced AFTER `flagMissedBartenderSchedules()` — a one-shot pass that finds bartender-scheduled tunes that should have fired during downtime and flags them as `pending_confirmation` instead of auto-executing. This prevents a "just came back from a 4-hour outage, now auto-tuning to a game that ended 3 hours ago" race.

The AI Game Monitor schedule is a continuous-type row: `name='AI Game Monitor', scheduleType='continuous', enabled=1`. Each minute it fires `checkAndExecuteSchedules` increments its `executionCount` and updates `lastExecuted`. **If this row's executionCount stops incrementing for more than 2 minutes, the scheduler is dead.** Quick test:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name, executionCount, lastExecuted FROM Schedule WHERE name='AI Game Monitor';"
# wait 60+ seconds, run again
# executionCount MUST have incremented; if not, the scheduler isn't ticking
```

**The full game lifecycle this tick handles** (operator's mental model):

The tick is the engine that runs the "monitor scheduled games + auto-tune + restore to defaults" loop. Each game has an `inputSourceAllocations` row (pending → active → completed) tying it to specific TV inputs:

1. **Pre-game (5 min before scheduled start):** the tick finds pending allocations with `allocatedAt - 5min ≤ now` and executes the channel change on the assigned TV input(s). Status flips `pending → active`. Operators see the bartender remote tile update + the TV actually tune.
2. **Game runs:** while active, the tick is a no-op for that allocation (game is doing its thing).
3. **Game ends (status='completed'/'final'/'postponed'/'canceled' OR wall-clock past `estimatedEnd + 30min`):** the **revert sweep** (separate code path within `checkAndExecuteBartenderSchedules`) finds active allocations whose game is now over, restores the input to its configured default source, status flips `active → completed`, `actuallyFreedAt` is stamped. **This is what "go back to system defaults after the game is over" means in practice.**
4. **Edge case — game already ended BEFORE the pre-game tune fired:** the tick catches it (case 2 doesn't fire in time, allocation is still pending, status check shows ended), cancels the allocation with status='cancelled' + `qualityNotes='Cancelled before tune: game already ended'`. **v2.28.6 added this guard after a 2026-04-21 incident where a stuck Celtics@76ers allocation pointed at DirecTV ch 220 (NBCSN — doesn't exist on DirecTV) racked up 2,094 failed tunes over 41 hours.** Without the guard, the allocation could never reach `active`, so the revert sweep had nothing to revert, and the doomed tune kept retrying forever.

So when an operator says "the system isn't going back to default after the game is over," the diagnostic chain is:
- Is the tick running? (executionCount of AI Game Monitor incrementing?)
- Did the allocation reach `active`? (check `inputSourceAllocations.status`)
- Did the game status update to `completed` (check `gameSchedules.status` — depends on ESPN sync running, which is a different scheduler in instrumentation.ts:132)
- Did `estimatedEnd` get set? (the wall-clock fallback only works if game has a sane estimate)

Most often if step 3 silently fails, ESPN sync isn't pushing game.status updates — that's a separate independent bug class.

### 2. `pollTVStatus` — every 5 minutes (TV health monitoring)

Pings every `FireTVDevice`, `DirecTVDevice`, and other registered TV/STB. Updates `status` column to `online`/`offline`/`reconnecting`/`down`. Feeds the System Admin dashboard's device-status grid.

Side-effects: writes `[HEALTH MONITOR]` log lines for each transition (online → offline triggers an `🚨 ALERT` after 5 min of sustained down). This is the source of Holmgren's recurring Epson Projector and failing-Fire-Cube alerts.

### 3. `runPpvProbe` — every 10 minutes (DirecTV PPV discovery)

Per CLAUDE.md §9, ESPN doesn't reliably surface PPV broadcast info for UFC/boxing events. So the probe asks each DirecTV box "what are you tuned to right now?" via `getTuned` and upserts any "PPV"-callsigned or 100-199 channel-range result into `discovered_ppv_channels`. Operators can then pin those channels to scheduled events when ESPN is silent.

### 4. `runFiretvAppSync` — every 5 minutes (Fire TV app catalog → input_sources)

Per CLAUDE.md §8, walks each Fire TV's `pm list packages` output and maps it through the streaming-apps-database (Catalog walker per `packages/scheduler/src/firetv-catalog-walker.ts`). Updates `input_sources` so the channel-guide can know "which streaming apps are installed on which Fire TV" for the per-box routing logic at `apps/web/src/app/api/channel-guide/route.ts`.

### 5. `pollFiretvCurrentApp` — every 60 seconds (bartender remote app indicator)

Per CLAUDE.md §9, asks each Fire TV's foreground activity via ADB `dumpsys window`. Caches the result. The bartender remote's per-TV tile reads this cache to show "currently watching: Prime Video / ESPN+ / Disney+ / etc." If the scheduler is dead, this indicator goes stale within 5-10 minutes and bartenders see incorrect app names.

### 6. `maybeRunCatalogWalk` — every 5 minutes (Fire TV catalog walker)

Conditional catalog walker — only runs if `firestick_scout_catalog` hasn't been refreshed recently. Keeps the per-box streaming-app catalog current without burning ADB cycles when the catalog is fresh.

---

## How to verify it's actually running

There are 4 independent signals — check at least 2:

**Signal 1 — startup log line (post-PM2-restart):**
```bash
pm2 logs sports-bar-tv-controller --lines 500 --nostream | grep -E "Scheduler service started|Failed to initialize scheduler"
# Want to see:  ✅ Scheduler service started - monitoring for continuous schedules every 60 seconds
# NEVER want:   ❌ Failed to initialize scheduler service:
```

**Signal 2 — `AI Game Monitor` executionCount incrementing:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, executionCount, lastExecuted FROM Schedule WHERE name='AI Game Monitor';"
# wait 90s
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, executionCount, lastExecuted FROM Schedule WHERE name='AI Game Monitor';"
# executionCount MUST have gone up by 1-2; lastExecuted MUST be within the last minute
```

**Signal 3 — SchedulerLog rows from `scheduler-service` component:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT timestamp, level, message FROM SchedulerLog WHERE component='scheduler-service' ORDER BY timestamp DESC LIMIT 5;"
# Want recent rows (within last 10 minutes)
```

**Signal 4 — pollFiretvCurrentApp keeps the bartender remote tiles fresh:**
- Open `/remote` in a browser
- Note the "currently watching X" text on a Fire TV tile
- Change the app on that Fire TV (or use the iPad remote to switch it)
- Within 60-120 seconds, the tile should update to reflect the new app

---

## Why this broke and how it was fixed (the v2.50.15 saga)

**Regression introduced:** commit `641ec2d3` ("Phase 48") — the V2 monorepo split. Scheduler code moved from `apps/web/src/lib/scheduler-service.ts` to `packages/scheduler/src/scheduler-service.ts`. The dynamic import in `instrumentation.ts` was never updated.

**Symptoms (silent, accumulating):**
- AI Game Monitor `executionCount` stopped incrementing — operators noticed delayed channel changes during games but blamed network/ESPN issues
- DirecTV PPV discovery dropped to zero — UFC nights had stale channel suggestions, blamed on ESPN
- Fire TV `currentApp` indicator went stale, bartenders saw wrong app names — blamed on ADB flakiness (which is a real problem too, just not the source here)
- `[HEALTH MONITOR]` alerts kept firing because the OTHER startup path (auto-reallocator worker, line 75 in instrumentation.ts — different import, different package) was running fine, MASKING the scheduler death

**Why the catch hid it:** `logger.error('[INSTRUMENTATION] ❌ Failed to initialize scheduler service:', error)` passes `error` as a positional arg that the logger drops. Only the bare message landed in logs. No stack, no module name, no path. Looked like one more cosmetic startup warning.

**v2.50.15 fix:** change line 84 from `await import('./lib/scheduler-service')` to `await import('@sports-bar/scheduler')` — same pattern as line 132 (ESPN sync block, never broke). After the fix lands and PM2 restarts:
```
[INSTRUMENTATION] ✅ Scheduler service started - monitoring for continuous schedules every 60 seconds
[SCHEDULER-SERVICE] ✅ Scheduler service started successfully
```

Found by parallel-agent investigation per operator's "use multiple agents" directive (2026-05-19). ~67 seconds of agent time replaced months of silent regression.

---

## Operational notes

- **Memory footprint:** the 5 polling jobs + 60s tick add ~50 MB to the PM2 process. If `node --max-old-space-size=512` is the limit (per `ecosystem.config.js`), no scheduler-related OOMs have been seen at the fleet, but worth flagging if memory usage trends up.
- **Stop semantics:** `schedulerService.stop()` is rarely called outside test contexts; on graceful PM2 reload the Node process exits and intervals die with it. The v2.31.8 centralized `polls` Map means `stop()` is now correct (previously leaked the ppv/firetv handles).
- **Concurrency:** all 5 polls + the tick run in the same Node event loop. Each call is async — slow polls don't block the others. But a `checkAndExecuteSchedules()` that takes 2+ minutes (large batch of due schedules) WOULD overlap the next tick — the code accepts this and uses `isRunning` guards.
- **Logging tag:** every scheduler-originated log line has `[SCHEDULER]`, `[SCHEDULER-SERVICE]`, or `[INSTRUMENTATION]` prefix. Grep these to trace scheduler activity in PM2 logs.

## Related files

- `packages/scheduler/src/scheduler-service.ts` — the SchedulerService class + 5 poll registrations + `checkAndExecuteSchedules` + `checkAndExecuteBartenderSchedules`
- `packages/scheduler/src/scheduler-logger.ts` — the database-backed `schedulerLogger` (writes to SchedulerLog table for SystemAdmin / AI Hub visibility)
- `apps/web/src/instrumentation.ts` — the Next.js startup hook that imports + starts the service
- `apps/web/src/db/schema.ts` → `packages/database/src/schema.ts` — `Schedule` table definition
- `docs/AUTO_UPDATE_TROUBLESHOOTING.md` — broader failure-mode catalog including this one and 13 others
