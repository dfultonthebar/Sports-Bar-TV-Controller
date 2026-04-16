# Scheduler & Sports Sync Fixes — April 2026

**Version:** 2.3.0
**Date:** 2026-04-10
**Branch:** location/stoneyard-greenville (for PR to main)

This doc covers four related fixes that landed together, all discovered while debugging why a bartender-scheduled Wisconsin Badgers Frozen Four game at Stoneyard Greenville worked on the way in but left the TV stranded on ESPN2 after the game ended, and why the AI scheduler and channel guide had ancillary problems.

---

## 1. Auto-reallocator did not tune cable boxes back to default

**Symptom:** Bartender-scheduled tune at 3:55 PM tuned Cable 4 to channel 28 (ESPN2) for the Badgers/North Dakota game. When the auto-reallocator ended the allocation at 7:31 PM, it marked the input source as free but did **not** tune Cable 4 back to its default channel. The TV sat on ESPN2 until a bartender manually re-tuned it.

**Root cause:** `packages/scheduler/src/auto-reallocator.ts` already had a `revertTVsToDefaults()` function, and it correctly ran. It loaded the default-sources config, parsed TV output IDs, and reached the cable-box default lookup at the bottom of the function. But the lookup used `defaults.cableBoxDefaults[inputSource.deviceId]` — where `inputSource.deviceId` is a string ID like `"ir-cable-4"`. The `cableBoxDefaults` object, however, is keyed by **matrix input number** as a string (`"1"`, `"2"`, `"3"`, `"4"`) — the same convention the `/api/settings/default-sources` POST "apply now" endpoint uses. So the lookup always returned `undefined` and the revert silently no-op'd.

**Fix:** In `revertTVsToDefaults()`, load the `IRDevice` row by `inputSource.deviceId` to get its `matrixInput` number, then use `String(irDevice.matrixInput)` as the key into `cableBoxDefaults`. Also added:

- A guard when the IR device lookup fails or `matrixInput` is null (logged as a warn).
- A guard when no default channel is configured for that matrix input (logged as info — not an error, just nothing to do).
- Structured `schedulerLogger` entries for every outcome (success, skipped-upcoming-game, no-default, IR-device-missing, tune-failed) so the revert activity is visible in the `SchedulerLog` database table. PM2 logs get rotated, but `SchedulerLog` persists.
- Correlation ID threading from `performReallocationCheck` → `endAllocation` → `revertTVsToDefaults` so the end-of-allocation entry and the revert entries share a trace.

**Config required for this to actually do anything:**
```
SystemSettings / default_sources:
  cableBoxDefaults:
    "1": { channelNumber: "27", channelName: "ESPN" }
    "2": { channelNumber: "28", channelName: "ESPN2" }
    "3": { channelNumber: "303", channelName: "ESPN U" }
    "4": { channelNumber: "14", channelName: "Golf" }
```
Stoneyard Greenville already has these. If `outputDefaults` and `roomDefaults` are both empty `{}`, the auto-reallocator will still tune the cable box back to its default channel (which covers the bartender's primary concern), but it won't re-route TVs to a different source. To get full revert behavior (e.g. TVs flip back to Atmosphere after a game), populate `outputDefaults` or `roomDefaults` via the default-sources settings UI.

**Files changed:**
- `packages/scheduler/src/auto-reallocator.ts` — cable box lookup fix + scheduler logger calls.

---

## 2. AI Auto Pilot returned 404 "AI game monitor schedule not found"

**Symptom:** Clicking "AI Auto Pilot" in the scheduling page returned:
```json
{"success": false, "error": "AI Game Monitor schedule not found"}
```

**Root cause:** `GET /api/schedules/ai-game-plan` expected a row in the `Schedule` table with `scheduleType = 'continuous'`. **No code anywhere in the repo creates one.** It was an implicit setup step with no initialization path — new installations would hit a 404 and have no way to recover short of hand-editing the database.

**Fix (Option A — auto-create on first use):** In the GET handler, when the continuous schedule lookup returns null, insert one with sensible defaults, then re-fetch and continue. The new row is:

| Field | Value |
|---|---|
| `name` | `'AI Game Monitor'` |
| `description` | `'Auto-created continuous home-team monitoring schedule. Edit to change priorities.'` |
| `scheduleType` | `'continuous'` |
| `enabled` | `true` |
| `recurring` | `false` |
| `monitorHomeTeams` | `true` |
| `autoFindGames` | `true` |
| `homeTeamIds` | JSON array of `HomeTeam.id` values matching "packers", "bucks", "brewers", "badgers" (case-insensitive LIKE) |

The insert is concurrency-safe: if two Auto Pilot clicks fire at once and both see null, the `catch` block swallows the unique-violation error and a defensive re-fetch returns whichever row won the race. Only if the re-fetch is still null do we return a 500 (true failure).

**HomeTeam dependency:** If the `HomeTeam` table is empty at the time Auto Pilot is first clicked, the auto-create falls back to `homeTeamIds: "[]"` and logs a warning:
```
[AI_GAME_PLAN] No matching home teams (Packers/Bucks/Brewers/Badgers) found in HomeTeam table — home-team prioritization will be inactive until teams are configured
```
Auto Pilot still works — it just doesn't prioritize home teams until someone populates `HomeTeam` (via whatever existing UI or DB tool manages it). Once home teams are added, the admin can edit the auto-created Schedule row and re-save `homeTeamIds` — no code change needed.

**At Stoneyard Greenville as of 2026-04-10:** The `HomeTeam` table is empty, so the auto-create saved `homeTeamIds: "[]"`. Auto Pilot still returned 173 games and set 4 channels successfully because non-prioritized game selection fell back to ESPN priority ranks. Configure home teams (Packers / Bucks / Brewers / Badgers) separately when convenient.

**Files changed:**
- `apps/web/src/app/api/schedules/ai-game-plan/route.ts` — lines ~649-720: replaced 404-on-missing with upsert-on-missing.

---

## 3. Approve AI suggestion persisted zero TV outputs

**Symptom:** Bartender clicked "Approve" on an AI-suggested game and got an error. Even when the request superficially succeeded, the created `inputSourceAllocations` row had `tvOutputIds: "[]"` — meaning no TVs were actually assigned, which then broke downstream (scheduler-service filters out zero-output allocations, and the auto-reallocator can't revert them).

**Root cause:** Two bugs.
1. `POST /api/schedules/bartender-schedule` route hardcoded `tvOutputIds: JSON.stringify([])` in the insert. The Zod body schema did not even accept a `tvOutputIds` field. The frontend was already sending it (since a prior commit) — the route threw it away.
2. When the team-name + start-time lookup against `game_schedules` returned zero matches, the route silently continued with a phantom game reference. This was the error the bartender was actually seeing — it surfaced downstream as a cryptic 500.

**Fix:**
- Added `tvOutputIds: z.array(z.number().int().min(0)).min(1, 'At least one TV output must be assigned to the schedule')` to the request body Zod schema.
- Replaced the hardcoded `tvOutputIds: JSON.stringify([])` with `tvOutputIds: JSON.stringify(bodyValidation.data.tvOutputIds)` and set `tvCount: tvOutputIds.length`.
- Replaced the silent "continue with phantom game" branch with an explicit 404 returning `'No matching game schedule found for <away> @ <home> at <time>. The MLB/sports sync may not have imported this game yet.'` This makes the error actionable — it tells the bartender exactly what's wrong (and points at the MLB sync, which is the most common cause).

**Note on the frontend:** `apps/web/src/components/ScheduledGamesPanel.tsx` already sent `tvOutputIds` in the POST body (it reads `modifyOutputs[suggestion.gameId] ?? suggestion.suggestedOutputs`) and already surfaced server error messages. Only the route needed changes.

**Type convention:** `tvOutputIds` is stored as a JSON-stringified `number[]` of matrix output channel numbers. This matches how `scheduler-service.ts`, `auto-reallocator.ts`, and the existing `patchScheduleSchema` in the same file already treat it. One internal interface in `smart-input-allocator.ts` still types them as `string[]` — that's inconsistent but outside the approve path and deliberately not touched.

**Files changed:**
- `apps/web/src/app/api/schedules/bartender-schedule/route.ts` — Zod schema, body destructure, 404 branch, insert line.

---

## 4. ESPN sports sync was never running

**Symptom:** The bartender's channel guide at Stoneyard Greenville was missing today's Brewers game (and essentially every other MLB game). Direct DB check showed the entire `game_schedules` table contained only 2 MLB rows — a Cubs/Pirates game from today and a months-old Angels/Braves row — both of which had been hand-created by the `bartender-schedule` approve endpoint, not synced from ESPN.

**Root cause:** `espnSyncService.syncLeague()` existed in `@sports-bar/scheduler` and worked correctly, but **it was never invoked**. No startup hook, no cron, no interval. The only trigger was a manual `POST /api/scheduling/sync` that nothing was calling. New installations and restarts left `game_schedules` empty until a human happened to hit that endpoint.

**Fix:** Added an ESPN sync block to `apps/web/src/instrumentation.ts` (the Next.js startup hook) that:
- Waits 30 seconds after process startup (lets the app finish warming up).
- Runs an initial sync for all seven leagues: `baseball/mlb`, `basketball/nba`, `hockey/nhl`, `football/nfl`, `football/college-football`, `basketball/mens-college-basketball`, `basketball/womens-college-basketball`.
- Re-runs the same sync on a 60-minute interval.
- Logs each league's result as `[INSTRUMENTATION][ESPN SYNC] <league>: +N new, ~N updated, N errors`.

**Verification (2026-04-10 after restart):**
```
[ESPN SYNC] Completed sync for baseball/mlb: +0 new, ~100 updated, 0 errors
```
and:
```sql
SELECT home_team_name, away_team_name, primary_network
FROM game_schedules
WHERE home_team_name LIKE '%rewer%' OR away_team_name LIKE '%rewer%'
ORDER BY scheduled_start LIMIT 5;
```
returned:
```
Milwaukee Brewers | Washington Nationals | MLB.TV | 2026-04-10 18:40:00
Milwaukee Brewers | Washington Nationals | MLB.TV | 2026-04-11 18:10:00
Milwaukee Brewers | Washington Nationals | MLB.TV | 2026-04-12 13:10:00
Milwaukee Brewers | Toronto Blue Jays    | MLB.TV | 2026-04-14 18:40:00
Milwaukee Brewers | Toronto Blue Jays    | MLB.TV | 2026-04-15 18:40:00
```

**Known follow-ups (not blocking):**
1. MBB / WBB syncs throw errors from the ESPN endpoint on the wide date range call. The tighter "today only" calls succeed. Likely a seasonal or date-format edge case in the college basketball scoreboard endpoint. File a follow-up if the AI scheduler ever needs CBB reliably.
2. `primary_network` for most MLB games comes back as `"MLB.TV"` (ESPN's default when no broadcast is assigned). The live-by-channel network mapping recognizes `MLB Network`, RSN variants like `FanDuel SN WI`, and local affiliates, but not `"MLB.TV"` itself. This means some Brewers games may not surface in the bartender's live-games section until ESPN returns a concrete RSN value closer to game time. If this turns into a recurring complaint, add a `"MLB.TV"` → `"326"` (MLB Network on Spectrum) fallback to `NETWORK_TO_CABLE` and `"MLB.TV"` → `"213"` to `NETWORK_TO_DIRECTV`.
3. League label inconsistency: new ESPN-synced rows use lowercase `"mlb"`; legacy bartender-created rows use `"MLB Baseball"`. Consumers already normalize via `leagueLower.includes('mlb')`, so this is non-blocking — but worth knowing if you write new queries.

**Files changed:**
- `apps/web/src/instrumentation.ts` — added the startup-and-interval sync block.

---

---

## 5. Channel Guide tab (bartender remote) missed most games — in particular Brewers

**Symptom:** Bartender opened the Guide tab in the bartender remote, Brewers game not listed. Tried scheduling Brewers from other tabs, scheduler did not add it.

**Data path discovery:** The bartender remote Guide tab calls `POST /api/channel-guide`, NOT `/api/sports-guide/live-dashboard` or `/api/sports-guide/live-by-channel`. The `channel-guide` route is backed by **The Rail Media API** (`guide.thedailyrail.com/api/v1`) as its sole data source — it does not read from `game_schedules` at all. Fixing the ESPN sync (Fix #4 above) had no effect on this tab.

**Three concrete problems, fixed together:**

### 5a. Wisconsin RSNs unmatched — FSN alias bundle didn't map to any preset

`channel_guide/route.ts` builds a `stationToPreset` lookup from the `channelPresets` table plus the `station_aliases` table. The FSN alias row had `["FSNHD","FOX SPORTS NORTH","FSNWI","BSWI","BALLY WI","BSSWI","BSNOR"]` — none of which normalize to any preset name in use. So FSN-family aliases never linked to a preset, and Rail's `FSWI` station code landed in the "unmatched stations" log forever.

**Also critically:** The Wisconsin RSNs at Green Bay Spectrum are **two different channels**:
- **Channel 40** ("Fan Duel") — the main WI RSN, carries Bucks and general WI sports
- **Channel 308** ("Bally Sports WI") — the **Brewers-only** overflow feed, used when Brewers air concurrently with something else on the main WI RSN

A single alias bundle that lumps them together wrongly routes Bucks games to 308.

**Fix:** Split the Wisconsin RSN aliases into two separate standard entries:
- `FanDuelWI` with aliases `["Fan Duel","FanDuel","FSWI","BSWI","Bally Sports Wisconsin","Bally Sports WI Main","FanDuel Sports Wisconsin","FanDuel SN WI","FanDuel SN Wisconsin","FOX Sports Wisconsin","Bucks.TV"]` — links to preset "Fan Duel" (channel 40). The `"Fan Duel"` alias normalizes to `FANDUEL`, which matches the preset name normalized.
- `BallyWIPlus` with aliases `["Bally Sports WI","Bally Sports WI+","Bally Sports Wisconsin+","BSWI+","FSWI+","FanDuel SN WI+","FanDuel Sports WI+","Brewers.TV"]` — links to preset "Bally Sports WI" (channel 308). The `"Bally Sports WI"` alias normalizes to `BALLYSPORTSWI`, matching the preset.
- `FSN` was trimmed down to just `["FSNHD","FOX SPORTS NORTH","FSNWI","BSNOR"]` since there's no local preset named "FSN" — the row is left for historical compatibility but no longer tries to claim WI RSNs.

Applied via SQL to this location's DB and also updated `apps/web/src/lib/seed-from-json.ts` so new installations seed the corrected aliases automatically on first run.

### 5b. Local broadcast `-TV` suffix stations unmatched

The `normalizeStation()` helper strips trailing `HD`, `NETWORK`, and `CHANNEL`, but not `-TV`. So Rail's `WLUK-TV` normalized to `WLUKTV` and didn't match the preset `WLUK`, and `WGBA-TV` similarly missed `WGBA`. These stations carry local-broadcast MLB games (Brewers on WGBA, Packers on WLUK, etc.).

**Fix:** added `.replace(/-TV$/i, '')` to `normalizeStation()` in `apps/web/src/app/api/channel-guide/route.ts`. Now `WLUK-TV` → `WLUK` and `WGBA-TV` → `WGBA`, both matching existing presets.

### 5c. The Rail Media API doesn't carry every game — Brewers game tonight wasn't in their feed at all

The Rail Media sports guide only covers nationally-televised games and a subset of RSN broadcasts. Tonight's Brewers @ Nationals game (airing on Brewers.TV, the Bally Sports WI+ overflow feed) is genuinely absent from Rail's response — confirmed by inspecting the raw feed. No amount of alias or normalization tuning can surface a game that isn't in the upstream data.

**Fix:** Added a `game_schedules` fallback block to `apps/web/src/app/api/channel-guide/route.ts`. After the Rail Media loop finishes, the route now queries our local `game_schedules` table for games in the request's time window, walks each game's `broadcast_networks` JSON array, and injects a program entry using the same `stationToPreset` lookup (with alias fallback) that the Rail loop uses. Games that Rail already included are deduplicated by channel + team matchup. Games that don't resolve to any preset channel are silently skipped (those are truly streaming-only with no linear cable carriage).

For tonight's Brewers game:
- `broadcast_networks = ["MLB.TV","Brewers.TV","Nationals.TV"]`
- Walk → `MLB.TV` doesn't match → `Brewers.TV` matches via `BallyWIPlus` alias → preset "Bally Sports WI" / channel 308
- Program entry is injected with `id: "gs-<uuid>"`, league "mlb", home "Milwaukee Brewers", away "Washington Nationals", game time "6:40 pm", channel 308

**Verification (post-fix):**
- `channel-guide` response now includes the Brewers game on channel 308
- Bucks games on Rail with station `FSWI` correctly land on channel 40, not 308
- Total program count went from 36 → 41 after the fallback injected 5 additional local games

### 5e. League label mismatch between Rail Media and ESPN sync blocked all Rail-sourced scheduling

**Symptom (post 5d):** After fixing `tvOutputIds` to be optional, scheduling from the Guide tab still failed with 404 "No matching game schedule found" for Rail-sourced programs (Yankees @ Rays, Bucks vs Nets, etc.) — but worked fine for the Brewers game injected by the `game_schedules` fallback.

**Root cause:** The bartender-schedule route matches the UI's `gameInfo` to an existing `game_schedules` row using team names + league + time window. The Rail Media API returns league labels like `"MLB Baseball"`, `"NBA Basketball"`, `"NHL Hockey"` (from `listing_groups[].group_title`), but the ESPN sync writes lowercase short codes like `"mlb"`, `"nba"`, `"nhl"`. The `eq(schema.gameSchedules.league, gameInfo.league)` check compared `"mlb" === "MLB Baseball"` and failed every time.

**Fix:** Dropped the `league` field from the match criteria entirely. Team names + a ±1 hour start time window are unique enough — two different teams named "Tampa Bay Rays" and "New York Yankees" playing each other at the same hour is not a realistic collision. The comment in the code explains the mismatch for future readers.

### 5d. Guide tab schedule button broke after the earlier bartender-schedule tightening

Fix #3 above added `tvOutputIds: z.array(...).min(1)` to the `bartender-schedule` POST schema. But the Guide tab's schedule flow intentionally POSTs without `tvOutputIds` — it creates the allocation first, then PATCHes in the TV outputs auto-copied from a previous allocation on the same device. My `.min(1)` requirement broke this, so the Guide tab's Schedule button silently failed with a validation error.

**Fix:** Changed `tvOutputIds` to `z.array(...).optional().default([])` on the POST schema. The AI-suggestion approve flow (which sends outputs inline) still works. The Guide tab flow (POST empty, then PATCH) also works. Brand-new installs with no prior allocations may still end up with an empty-outputs allocation, but that matches pre-existing behavior and is out of scope for this fix.

**Files changed for all of 5a-5d:**
- `apps/web/src/app/api/channel-guide/route.ts` — `normalizeStation` adds `-TV` stripping; new `game_schedules` fallback block after the Rail loop
- `apps/web/src/lib/seed-from-json.ts` — updated `STANDARD_ALIASES` to split WI RSNs into `FanDuelWI` and `BallyWIPlus`
- `apps/web/src/app/api/schedules/bartender-schedule/route.ts` — `tvOutputIds` optional with default empty array
- `station_aliases` table — SQL update applied directly to this location's DB

**Deployment note:** Other locations (Holmgren Way, Graystone, Lucky's) will get the new seed entries on fresh installs, but existing DBs won't auto-update because `seedStationAliases()` skips if the table already has rows. To propagate to an existing location DB, run:
```sql
UPDATE station_aliases SET aliases='["FSNHD","FOX SPORTS NORTH","FSNWI","BSNOR"]' WHERE standard_name='FSN';
INSERT OR REPLACE INTO station_aliases (id,standard_name,aliases) VALUES
  ('fanduel-wi-alias','FanDuelWI','["Fan Duel","FanDuel","FSWI","BSWI","Bally Sports Wisconsin","Bally Sports WI Main","FanDuel Sports Wisconsin","FanDuel SN WI","FanDuel SN Wisconsin","FOX Sports Wisconsin","Bucks.TV"]'),
  ('bally-wi-plus-alias','BallyWIPlus','["Bally Sports WI","Bally Sports WI+","Bally Sports Wisconsin+","BSWI+","FSWI+","FanDuel SN WI+","FanDuel Sports WI+","Brewers.TV"]');
```
or simply delete all rows from `station_aliases` and restart — the seed-from-json block will repopulate with the current source-of-truth list.

---

## Channel Mapping Reference — Green Bay Area Spectrum (Wisconsin RSNs)

| Channel | Preset Name | Purpose | ESPN / Rail Station Code |
|---|---|---|---|
| **40** | Fan Duel | Main Wisconsin RSN — Bucks, general WI sports | `FSWI`, `Bucks.TV` |
| **308** | Bally Sports WI | **Brewers-only** overflow feed — used when Brewers air at same time as something else on 40 | `Brewers.TV` |

Do not confuse these. Channel 308 is not "the Wisconsin RSN" — it's specifically the Brewers-only feed. Bucks games never air on 308; Brewers games air on 308 (and only on 308 when there's a conflict on the main WI RSN at 40).

## Deployment Notes

- Version bumped from 2.2.2 → 2.3.0 (feature additions: instrumentation sync, Auto Pilot auto-create; plus bug fixes).
- All four fixes are safe to merge to main and then into other location branches — none of them are location-specific.
- After merging to a location, the first PM2 restart will trigger the ESPN sync automatically, so `game_schedules` will populate without manual intervention.
- The first Auto Pilot click after deploy creates the `Schedule` row automatically, so no manual seeding is required.
