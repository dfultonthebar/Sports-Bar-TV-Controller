# Channel Resolver Consolidation Plan

**Status:** v2 — post Plan-review corrections applied. Approved by user. No code changes yet.
**Target version:** 2.5.0 (minor bump — architectural change)
**Scope:** Consolidate six separate channel-resolution code paths into a single source of truth backed by the `channel_presets` + `station_aliases` tables, fixing the channel-number divergence across location branches as a side effect.

**Changes from v1 (2026-04-13 Plan-review pass):**
- Swapped Phase 2 and Phase 4: migration now starts with `live-dashboard` (simplest route, 297 lines, 2 hardcoded dicts) and ends with `channel-guide` (most complex route, 914 lines, 4 resolution layers). The easier route proves the pattern in production before the hard one is touched.
- Added explicit `STREAMING_STATION_MAP` reconciliation step to Phase 1 — three different copies of this map exist in the codebase today and must be merged into one canonical version before any consumer is migrated.
- Added transitional DB-empty fallback to the shared resolver so a corrupted/wiped `channel_presets` table doesn't silently blank every live-sports UI.
- Moved unit test delivery into Phase 1 (was deferred to a separate "testing requirements" section).
- Clarified Phase 6 rollback semantics: per-location branch state tracing after a merge revert.

---

## 1. Problem statement

Today we have **six independent routes** that each answer the question "what local channel number carries this game/broadcast?", and each one uses its own logic:

| Route | Resolution approach | Data source |
|---|---|---|
| `/api/channel-guide` | Inline `normalizeStation` + `stationToPreset` map + `station_aliases` fallback + `local_channel_overrides` injection + `game_schedules` fallback | Rail Media + DB |
| `/api/scheduling/games` | Shared `network-channel-resolver` (v2.4.8) | `game_schedules` + DB |
| `/api/schedules/ai-game-plan` | Inline `normalizeNetworkName` + `networkToCableChannel`/`networkToDirectvChannel` maps, then shared resolver as fallback | Rail Media + ESPN + DB |
| `/api/sports-guide/live-dashboard` | Hardcoded `NETWORK_TO_CABLE`/`NETWORK_TO_DIRECTV` dicts (42 + 38 entries) | ESPN + hardcoded constants |
| `/api/sports-guide/live-by-channel` | Hardcoded dicts (52 cable + 55 DirecTV entries) + `channel_presets` as a post-filter | ESPN + hardcoded constants + DB |
| `/api/sports-guide` | None (pure Rail Media passthrough) | Rail Media |

**Consequences of the current state:**

1. **Bug fixes have to land in multiple places.** Today's "Brewers on 308" bug required six commits across `channel-guide`, `network-channel-resolver`, `scheduling/games`, `ai-game-plan`, `station_aliases` seed data, and `channel_presets`. The `live-dashboard` and `live-by-channel` routes still have the old hardcoded data.

2. **Location branches have divergent — and partially wrong — hardcoded channel numbers.** The branch audit found:
   - `main`, `graystone`, and `holmgren-way` still have **Madison Spectrum channel numbers** hardcoded in `live-dashboard/route.ts` (ESPN=24, MLB Network=84) despite all three serving **Green Bay area** locations. This is an active production bug at Graystone and Holmgren, not just tech debt.
   - `live-by-channel/route.ts` on `main`, `stoneyard`, `graystone`, `holmgren` all use Green Bay numbers labeled "Holmgren Way"; only `lucky-s-1313` has the correct Madison numbers for that file.
   - `ai-game-plan/route.ts` on `graystone`, `holmgren`, and `lucky-s-1313` is older than stoneyard's — no `resolveChannelsForNetworks` fallback, no `-TV` suffix fix, no DRTV key fix.
   - `channel-guide/route.ts` on all non-stoneyard branches is missing the `game_schedules` fallback block (144 lines).

3. **`channel_presets` has no seeding mechanism.** `seed-from-json.ts` seeds DirecTV devices, Fire TV devices, and station_aliases — but NOT channel presets. A fresh install starts with zero presets. Stoneyard's 62 cable + 54 DirecTV presets were entered through the UI. This is a critical blocker for consolidating to DB-backed resolution: if we delete the hardcoded dicts and a location's DB has no presets, all live-sports UIs go blank.

4. **`packages/config/src/hardware-config.ts` says "Holmgren Way"** on every branch except Stoneyard. Venue name and Atlas IP are baked into source code.

5. **`packages/dbx-zonepro/src/dbx-protocol.ts` hardcodes Lucky's 1313 ZonePRO object IDs** in a shared package. Not runtime-configurable.

## 2. Target architecture

**One shared helper** at `apps/web/src/lib/network-channel-resolver.ts` (already exists from v2.4.8). It:

- Reads `channel_presets` and `station_aliases` from the DB (5-minute module-level cache).
- Exposes `normalizeStation()` — canonical name normalization (uppercase, strip spaces/dashes, strip `HD`/`NETWORK`/`CHANNEL`/`-TV` suffixes).
- Exposes `resolveChannelsForNetworks(networks, primaryNetwork)` — walks networks in priority order, returns `{cable, directv}` matches independently.
- **New in this plan:** also exposes `resolveChannelsForGame(game)` — takes a full game object (from `game_schedules` or Rail Media listing) and applies the sport-gated streaming logic currently duplicated in `ai-game-plan/route.ts`.
- **New in this plan:** also exposes `findLocalChannelOverride(teamName)` — checks `local_channel_overrides` table for a team-specific override.
- **New in this plan:** also exposes `getStreamingAppForStation(station, gameLeague)` — sport-gated streaming app resolution, consolidating `STREAMING_STATION_MAP` + `isStreamingStation` + sport-gate logic from `ai-game-plan`.

**All six routes become thin wrappers** around this helper. No route has its own `NETWORK_TO_CABLE` dictionary. No route has its own `normalizeStation` function. No route has its own `station_aliases` loop.

**The hardcoded dictionaries get deleted.** Permanently. Their data has already been migrated to DB tables for every location that actually runs the app.

## 3. Critical constraints — things that MUST NOT break

These are documented in `CLAUDE.md`, `docs/SCHEDULER_FIXES_APRIL_2026.md`, and `docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md`. Every phase of the plan preserves all of them:

1. **Wisconsin RSN split.** `FanDuelWI` (channel 40, Bucks + main WI RSN) and `BallyWIPlus` (channel 308, Brewers-only overflow) must remain separate `station_aliases` bundles. The comment in CLAUDE.md says explicitly: "Never combine them into a single alias bundle or Bucks games will wrongly route to 308."

2. **`normalizeStation` suffix order.** Uppercase → remove spaces → strip `-TV` → remove dashes → strip trailing `HD`/`NETWORK`/`CHANNEL`. The `-TV` strip MUST come before the general dash removal (or it strips the dash and loses context). Tested against `WLUK-TV` → `WLUK`, `WGBA-TV` → `WGBA`, `ESPN-HD` → `ESPN`.

3. **Sport-gated streaming codes.** `MLBEI` only matches MLB/baseball games, `NHLCI` only hockey, `NBALP` only basketball, `MLSDK` only soccer. Without this, hockey games get tagged as MLB.TV streaming (the v2.4.9 fix).

4. **`local_channel_overrides` injection.** The `channel-guide` route has a block (lines 344-412) that scans every Rail Media listing for team names matching the `local_channel_overrides` table and injects a synthetic program entry for the override channel. This runs AFTER the normal Rail matching so override entries coexist with Rail entries. The shared helper currently has no concept of overrides — this is the biggest behavioral delta we need to add.

5. **`game_schedules` fallback block.** The `channel-guide` route has a block (lines 421-550, added in v2.3.0) that queries `game_schedules` directly and injects any games Rail doesn't carry. Preserves the "Brewers game on ESPN's Brewers.TV code" path when Rail lacks it.

6. **Rail Media lineup keys.** `CAB` for cable, `DRTV` for DirecTV. Not `SAT` (v2.4.9 fix).

7. **League label mismatch tolerance.** Rail uses `"MLB Baseball"`, ESPN sync uses `"mlb"`. Don't match games by league string equality (v2.4.5 fix).

8. **`primaryNetwork` priority.** When walking broadcast networks, `primaryNetwork` goes first, then the rest. If `primaryNetwork` is `"MLB.TV"` (ESPN placeholder for streaming-only), fall through to the rest of the array for a concrete RSN.

9. **`bg-white` Card primitive avoidance.** Not a resolver concern, but any new UI built on top of the consolidated data must use bordered divs per CLAUDE.md section "UI Styling Guide".

## 4. Pre-work (before Phase 1 can start)

> **⚠ Cross-plan ordering dependency:** Pre-work 1 below creates `apps/web/data/channel-presets-cable.json` and `apps/web/data/channel-presets-directv.json`. The **Auto-Update System Plan** (`AUTO_UPDATE_SYSTEM_PLAN.md`) references these paths in its `update_from_github.sh` `LOCATION_PATHS_OURS` conflict-resolution array. **This plan's Pre-work 1 MUST merge before the Auto-Update Plan's Pre-work 1.** If Auto-Update Pre-work 1 is done first, the shell script will reference files that don't exist yet — not a hard error (the `--ours` resolution is a no-op on missing paths) but it's a confusing code smell. Merge order: (1) this Pre-work 1, (2) Auto-Update Pre-work 1, then either plan's Phase 1+ can proceed independently.

### Pre-work 1: Channel presets seeding strategy

**Problem:** `seed-from-json.ts` doesn't seed `channel_presets`. Fresh installs start empty. Once we delete the hardcoded dicts, a location with an empty presets table has no channel data at all.

**Three options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A** | Add `STANDARD_CABLE_PRESETS_GREEN_BAY` and `STANDARD_CABLE_PRESETS_MADISON` constants to `seed-from-json.ts`, seed the right set based on a `LOCATION_MARKET` env var | Self-contained, no external data | Adds location-specific config to a "universal" file; env var is a new dependency |
| **B** | Add per-location JSON seed files: `apps/web/data/channel-presets-cable.json`, `apps/web/data/channel-presets-directv.json`. Each location commits its own version | Matches existing convention for device JSON files; easy to edit | Another file to maintain per location; no schema validation |
| **C** | Export the current `channel_presets` table from Stoneyard (62 cable + 54 DirecTV rows) as a SQL seed file, commit one per location on its own branch | Fastest, reuses existing data | Location data in .sql files is awkward; DB migration tooling would need to handle it |

**Recommendation:** **Option B.** It matches the existing multi-location convention. We'd:
- Export the current `channel_presets` rows from each location's DB into a JSON file on that location's branch.
- Add `seedChannelPresets()` to `seed-from-json.ts` that reads `apps/web/data/channel-presets-cable.json` + `channel-presets-directv.json` and inserts into `ChannelPreset` if the table is empty.
- Commit the Stoneyard JSON to `location/stoneyard-greenville`, Madison JSON to `location/lucky-s-1313`, etc.
- Leave `main` with empty arrays so fresh installs fail loudly during setup rather than silently showing wrong data.

**Pre-work 1 output:** new files `apps/web/data/channel-presets-{cable,directv}.json`, seed function in `seed-from-json.ts`, documentation in CLAUDE.md.

### Pre-work 2: Fix divergent branches before consolidation

Right now `graystone` and `holmgren-way` carry Madison numbers in `live-dashboard/route.ts` (wrong for their markets). The consolidation plan will DELETE this file's hardcoded dict entirely — but if we don't fix the branches first, the cutover moment for those locations might briefly re-introduce the wrong data during the merge.

**Pre-work 2 output:** For each location branch, export the current `channel_presets` rows from the location's production DB to the JSON files from pre-work 1. This happens before any code change to the route files. Locations are now DB-sourced for cable numbers even though the routes still have the hardcoded dicts — this is safe because the DB data matches the hardcoded data for each location (except graystone/holmgren where the DB is correct and the code is wrong — see pre-work 3).

### Pre-work 3: Graystone + Holmgren reality check

The audit says graystone/holmgren still have Madison numbers hardcoded in `live-dashboard`. But both locations have been running in production for months. **Are they actually broken?** Possibilities:

- **Option 1:** The `live-dashboard` bug has been latent and nobody noticed because the bartender remote doesn't render `live-dashboard` data anywhere visible. Verify by checking what UI consumes it.
- **Option 2:** The branches have been updated but the audit didn't see it (maybe the git show was on stale `origin/` refs). Re-verify with `git log origin/location/graystone -- apps/web/src/app/api/sports-guide/live-dashboard/route.ts`.
- **Option 3:** They're actually broken and nobody's complained because the bartender-facing view is `live-by-channel` (which has the Green Bay numbers labeled "Holmgren Way").

**Pre-work 3 output:** A single paragraph in the plan confirming which case it is. If Option 3, we send an alert to the user before touching anything — this is a production bug that predates this refactor and might need an immediate hotfix before the larger consolidation runs.

## 5. Phase-by-phase execution

Every phase is a separate commit. Every phase builds + restarts PM2 + runs a verification checklist before the next phase starts. All phases happen on `main` first; each location branch gets them by merging `main` in.

### Phase 1 — Expand the shared resolver API + unit tests + STREAMING_STATION_MAP reconciliation

**Files changed:** `apps/web/src/lib/network-channel-resolver.ts`, `apps/web/src/lib/__tests__/network-channel-resolver.test.ts` (new), and a one-time reconciliation step for `STREAMING_STATION_MAP` before it lands in the helper.

**Pre-step — STREAMING_STATION_MAP reconciliation (BLOCKING per plan review):**

**Corrected per second-pass review (local Plan agent, 2026-04-13):** there are **two** copies in the codebase today, not three:
1. `apps/web/src/app/api/schedules/ai-game-plan/route.ts` line 22 — 14 entries (includes sport-specific codes NBALP, NHLCI, MLBEI, and NFHS)
2. `apps/web/src/app/api/channel-guide/route.ts` line 76 — 15 entries (also includes NFHS)
3. The shared helper `network-channel-resolver.ts` — has NO streaming map and exports zero streaming-related functions today.

Phase 1 ADDS a third location (the canonical one in the helper) by writing `getStreamingAppForStation()` and reconciling the content of the two existing copies INTO it. The two existing maps have substantially similar content (both include NFHS) but differ in entry count and ordering. Before implementing the new helper API, `diff` the two existing maps side-by-side and produce a single canonical union that includes every package-name + app-name pairing from both sources. If the two maps disagree on any entry (e.g., different package arrays for the same station code), the plan author must decide the canonical entry — do NOT silently pick one. Document the reconciliation in the commit message and in a code comment inside the helper.

**Verification at end of Phase 1:** grep for `STREAMING_STATION_MAP` across the codebase — should find exactly 1 location (the helper) once the Phase 5 channel-guide migration completes. During Phase 1 itself, grep finds 3 (2 old + 1 new canonical). During Phases 2-4 it finds 3. At end of Phase 5 it finds 1.

**New API additions:**
- `resolveChannelsForGame(game, options?)` — full game resolution including sport-gated streaming.
- `findLocalChannelOverride(teamName)` — reads `local_channel_overrides` table, 5-min cache.
- `getStreamingAppForStation(station, gameLeague)` — sport-gated streaming app lookup, using the reconciled canonical `STREAMING_STATION_MAP`.
- `getStationToPresetMaps()` — exposes internal lookup maps for consumers that need to walk them directly (channel-guide's listing loop). **Return type:** `{cable: Map<string, {channelNumber, name}>, directv: Map<string, {channelNumber, name}>}` where keys are the pre-normalized station-to-preset resolution strings. Both the raw `channel_presets` rows and the `station_aliases`-derived entries populate these maps. The contract is documented in the helper's TSDoc so future consumers know what shape to expect.

**Transitional DB-empty fallback (added per plan review):**

The helper's `loadResolverData()` function now logs a WARN and serves an in-memory fallback when `channel_presets` returns zero rows. The fallback is a small hardcoded set of "universal safe defaults" (MLB Network, ESPN, ESPN2, Fox) that keeps the bartender remote partially functional while a human reseeds the DB. The WARN includes a clear message: `[CHANNEL-RESOLVER] channel_presets table is empty — serving in-memory fallback. Seed the table via seed-from-json.ts or the admin UI.` This prevents a corrupted/wiped DB from silently blanking every live-sports UI.

**Unit tests in the same commit as the API additions (per plan review — NOT deferred):**

New file `apps/web/src/lib/__tests__/network-channel-resolver.test.ts` with test cases:
- Direct preset match: `Brewers.TV` → cable 308 (via `BallyWIPlus` alias)
- Wisconsin RSN split: `Bucks.TV` → cable 40, `Brewers.TV` → cable 308, must be different entries
- `-TV` suffix strip: `WLUK-TV` → `WLUK` preset, `WGBA-TV` → `WGBA` preset
- Primary network priority: `primaryNetwork: "MLB.TV"` fallthrough to array for `Brewers.TV`
- Empty inputs: `resolveChannelsForNetworks([])` → `{cable: null, directv: null}` without error
- Sport-gated streaming: hockey game with `MLBEI` station → no streaming app, but baseball game with same station → MLB.TV
- DB-empty fallback: when mock DB returns 0 presets, helper logs WARN and returns fallback entries
- `local_channel_overrides` lookup by team name
- Cache TTL: same call within 5 min hits cache, call after expiry re-fetches

**No route changes in this phase.** The helper gets richer APIs and a test suite; nothing consumes them yet. This is the additive scaffolding phase.

**Verification:**
- `npx tsc` clean across all packages
- `npm test apps/web/src/lib/__tests__/network-channel-resolver.test.ts` — all tests pass
- `/api/scheduling/games` (the only existing consumer of the v2.4.8 helper) still returns the same shape
- Grep confirms three `STREAMING_STATION_MAP` locations have been reduced to one canonical definition

**Risk:** LOW. Pure additions + test coverage.

**Rollback:** Revert the single commit.

### Phase 2 — Migrate `/api/sports-guide/live-dashboard` (SIMPLE ROUTE FIRST)

*(Was Phase 4 in v1 of this plan. Swapped with `channel-guide` per plan review: start the migration with the simplest route to prove the pattern in production before touching the complex one.)*

**Files changed:** `apps/web/src/app/api/sports-guide/live-dashboard/route.ts`.

**Why this is the best starting point:**
- Only 297 lines, pure two-dict lookup, no multi-tier fallback chain.
- Hardcoded `NETWORK_TO_DIRECTV` (42 entries) and `NETWORK_TO_CABLE` (38 entries) are the entire resolution logic. Deleting them is mechanical.
- On Stoneyard, the data these dicts contain already matches the `channel_presets` table (pre-work 1 ensures this).
- On Graystone and Holmgren the hardcoded dicts are WRONG (they still have Madison numbers). This phase automatically fixes those locations as a side effect when the branches are merged in Phase 6.

**Changes:**
- **Delete `NETWORK_TO_DIRECTV` dict (lines 36-64).** Use `resolveChannelsForNetworks()`.
- **Delete `NETWORK_TO_CABLE` dict (lines 67-89).** Use `resolveChannelsForNetworks()`.
- **Keep `NETWORK_TO_STREAMING_APP` dict (lines 91-116) in this phase** — Phase 1 reconciled `STREAMING_STATION_MAP` which is a superset; this dict can be removed in a follow-up micro-commit after confirming `getStreamingAppForStation()` covers all 16 entries.
- Delete helper functions `findChannelFromNetworks`, `findStreamingAppFromNetworks`, `findChannel`, `findStreamingApp`. Replace with shared helper calls.
- Response shape stays the same (`{liveNow, comingUp, todaySchedule}` with per-game channel fields).

**Verification checklist:**
- Stoneyard: Brewers game shows cable 308 (via `Brewers.TV` → `BallyWIPlus` alias). **Wisconsin RSN split must survive.**
- Stoneyard: Bucks game shows cable 40 (via `Bucks.TV` → `FanDuelWI` alias).
- Stoneyard: ESPN game shows cable 27.
- Stoneyard: `LiveSportsDashboard` component on the bartender remote renders without visual regression.
- Run against test game data to confirm `primaryNetwork` priority is preserved (MLB.TV first, then fall through to Brewers.TV).

**Risk:** MED — bartender-facing via `LiveSportsDashboard` (real *impact*), but *likelihood* is low: Phase 1's test suite is a hard gate — if the helper does not reproduce every dict entry this route currently resolves, Phase 2 does not merge. The route itself is simple (297 lines, 2 dicts). Downgraded from HIGH in v2 because contained-blast-radius × gated-correctness = MED. Worst case (blank live scores) is visible immediately on the dashboard widget and trivially reverted.

**Rollback:** Revert the commit. Hardcoded dicts return. No DB impact.

### Phase 3 — Migrate `/api/sports-guide/live-by-channel` (MED-COMPLEXITY ROUTE)

**Files changed:** `apps/web/src/app/api/sports-guide/live-by-channel/route.ts`.

**Changes:**
- Delete `NETWORK_TO_DIRECTV` dict (lines 25-134, 55 entries).
- Delete `NETWORK_TO_CABLE` dict (lines 136-227, 52 entries).
- Delete the inline `networkMapping[network]` lookup + case-insensitive fallback (lines 355-378). Use the shared helper.
- **Keep** the `presetChannels` post-filter (line 375). The shared helper resolves, but the route needs to filter to only channels that exist in user's preset grid — that filter stays in the route.
- Keep the DirecTV guide fetch path (lines 406-447) — different concern.

**Verification checklist:**
- Stoneyard: `ChannelPresetGrid` still shows live game overlays on the correct channels.
- Lucky's (Madison): Preset grid still shows correct Madison channels via its own DB presets.
- **CRITICAL:** This route is consumed by **four** different bartender remote variants (`ChannelPresetGrid` → `EnhancedChannelGuideBartenderRemote`, `BartenderRemoteSelector`, `BartenderRemoteSelector-Enhanced`, `BartenderRemoteControl`). Test all four variants on Stoneyard before merging.

**Risk:** HIGH — widest blast radius of any route, but the change is conceptually the same as Phase 2's `live-dashboard` migration (swap hardcoded dict for DB-backed resolver).

**Rollback:** Revert the commit.

### Phase 4 — Migrate `/api/schedules/ai-game-plan` (COMPLEX, MULTI-TIER FALLBACK)

**Files changed:** `apps/web/src/app/api/schedules/ai-game-plan/route.ts`.

**Changes:**
- Delete the inline `normalizeNetworkName` function (lines 343-351). This function diverges from the canonical helper (lowercases instead of uppercases, omits `-TV` strip). Replacing it with the shared `normalizeStation` fixes latent bugs for local broadcast stations like `WLUK-TV` / `WGBA-TV`.
- Delete the inline `networkToCableChannel` / `networkToDirectvChannel` maps (lines 353-368).
- Delete the Tier 1 station matching loop (lines 420-451). Replace with a single `resolveChannelsForGame(listing)` call from the shared helper.
- Delete `STREAMING_STATION_MAP` from this file (lines 20-36) — Phase 1 reconciled it into the helper; this file now imports `getStreamingAppForStation()`.
- Delete the inline sport-gate code (lines 571-599). Now in the helper.
- **Keep** the Rail Media HTTP call (line 377) and the Tier 3 channel-number direct-match fallback (lines 484-525) — those serve a different purpose (raw Rail channel numbers vs network name resolution).
- **Preserve** the v2.4.9 fix that propagates `cableChannel`/`directvChannel`/`streamingApp` onto the "currently showing" game objects.

**Verification checklist:**
- `/api/schedules/ai-game-plan` still returns ~60 games on a typical day.
- Brewers game still resolves to cable 308 (regression check after moving from inline normalization to canonical).
- Hockey games still have 0 `MLB.TV` mislabelings (v2.4.9 sport-gate fix must survive).
- Schedule tab + AIGamePlanModal both render correctly with no visual regression.

**Risk:** HIGH. Bartender-facing via `AIGamePlanModal` + `ScheduledGamesPanel`. The inline-to-canonical normalization switch is a behavioral delta — tests must confirm every current Stoneyard game still resolves the same way.

**Rollback:** Revert the commit.

### Phase 5 — Migrate `/api/channel-guide` (HARDEST ROUTE, LAST)

*(Was Phase 2 in v1 of this plan. Moved to last per plan review: this is the most complex route with the highest bartender-facing blast radius. By the time we get here, Phases 2-4 have proven the shared helper in production and we have confidence in all its edge cases.)*

**Files changed:** `apps/web/src/app/api/channel-guide/route.ts`.

**Why this is last, not first:**
- 914 lines, 4 resolution layers (station name → `stationToPreset` → aliases → `local_channel_overrides` → `game_schedules` fallback).
- Has its own `normalizeStation`, `stationToPreset` builder, `local_channel_overrides` injection block (70 lines), and `game_schedules` fallback block (130 lines).
- On the bartender remote's critical path — the Guide tab is what bartenders use constantly.
- If anything goes wrong here, the bartender remote Guide tab goes silent.

**Changes:**
- Delete the inline `normalizeStation` function (lines 207-215). Import from helper.
- Delete the inline `stationToPreset` builder (lines 216-236). Use `getStationToPresetMaps()` from the helper.
- Keep the Rail Media loop structure, but replace the station-matching logic (lines 252-340) with direct map lookups from `getStationToPresetMaps()`.
- Keep the `local_channel_overrides` injection block (lines 344-412) BUT replace its inline team-name check with `findLocalChannelOverride()`.
- Keep the `game_schedules` fallback block (lines 421-550) BUT replace its inline `stationToPreset` usage with `resolveChannelsForNetworks()`.
- Delete `STREAMING_STATION_MAP` from this file (Phase 1 reconciled it). Import `getStreamingAppForStation()`.

**Verification checklist:**
- `/api/channel-guide` returns the same program count for a test query (Stoneyard expected: ~41 programs including Brewers on 308).
- Brewers game still shows channel 308 (via `Brewers.TV` → `BallyWIPlus` alias → preset). **CRITICAL — the route that the bartender remote depends on most heavily.**
- Bucks game still shows channel 40 (via `Bucks.TV` → `FanDuelWI` alias → preset). Wisconsin RSN split must survive.
- Yankees game still shows channel 326 (MLB Network direct preset match).
- `WLUK-TV`-labeled game still matches `WLUK` preset (the `-TV` strip).
- Fire TV streaming path still returns package lists for MLB.TV, Peacock, etc.
- `local_channel_overrides` injection path still works (test with at least one override row in the DB).
- `game_schedules` fallback path still injects Brewers when Rail doesn't carry it.
- The bartender remote Guide tab renders and is fully interactive.

**Risk:** HIGHEST. Biggest route in the codebase, most bartender-facing blast radius. Must be tested on Stoneyard for a full evening of operation before merging to main.

**Rollback:** Revert the commit. Old inline logic comes back. DB data unchanged.

### Phase 6 — Merge main → location branches

**Process:**
1. Merge `main` → `location/stoneyard-greenville`. Test at Stoneyard.
2. Merge `main` → `location/graystone`. Test at Graystone (verify the Madison-numbers bug is now fixed — `live-dashboard` now reads from the graystone DB's Green Bay presets, not the deleted hardcoded dict).
3. Merge `main` → `location/holmgren-way`. Test at Holmgren (same verification).
4. Merge `main` → `location/lucky-s-1313`. Test at Lucky's (verify Madison numbers still work — they're now coming from lucky-s's own DB `channel_presets`, not the previously-hardcoded dict).

**Conflict resolution rules:**
- `apps/web/data/channel-presets-cable.json`, `apps/web/data/channel-presets-directv.json`: always `git checkout --ours` (location's version wins).
- `apps/web/data/tv-layout.json`, `directv-devices.json`, `firetv-devices.json`, etc.: `--ours` (existing convention).
- `package-lock.json`: always `git checkout --theirs` then re-run `npm ci`. Using `--ours` would lose any new dependencies main added since the last sync.
- Route files (`channel-guide/route.ts`, `live-dashboard/route.ts`, etc.): `--theirs` (main's version wins because those are the files being migrated in Phases 2-5 and location branches have no legitimate customizations in them).

**Risk:** HIGH for graystone/holmgren where the `live-dashboard` behavior changes the moment the merge completes (wrong Madison numbers → correct Green Bay numbers). Someone needs to visually verify each location immediately after its merge.

**Rollback semantics (per plan review — explicit branch state tracing):**

A Phase 6 merge on a given location branch is a single merge commit. Reverting it with `git revert -m 1 <merge-sha>` has these effects per branch:

- **location/stoneyard-greenville:** Revert restores the pre-merge state of stoneyard-greenville, which is the branch state before Phases 1-5 landed on main. But Phases 1-5 only landed on main — stoneyard was the target of merge, not the source. Reverting the merge removes Phases 1-5 from stoneyard's effective state even though they remain on main. The bartender remote at stoneyard reverts to pre-consolidation behavior. **Result:** stoneyard works exactly as it did before the consolidation started.
- **location/graystone:** Same pattern. Reverting the merge removes Phases 1-5's changes from graystone's effective state. **Important:** this ALSO means graystone goes back to its pre-merge state where `live-dashboard/route.ts` still has the hardcoded Madison numbers — the production bug returns. This is not a new break; it's a restoration of the pre-consolidation state. The plan acknowledges this: reverting Phase 6 at graystone re-exposes a latent pre-existing bug, it does not create a new one. To fix the Madison-numbers bug WITHOUT running the consolidation, someone would have to manually cherry-pick the dict-deletion portion of Phase 2's commit onto graystone — that's a separate operation outside this plan.
- **location/holmgren-way:** Same as graystone.
- **location/lucky-s-1313:** Same pattern, but the pre-merge state is correct for Madison (lucky-s's hardcoded dict has Madison numbers). Reverting the merge at lucky-s restores working Madison-number behavior. **Result:** lucky-s still works after a revert.

**Per-location rollback procedure:**
```bash
# On the broken location's server:
cd /home/ubuntu/Sports-Bar-TV-Controller
git revert -m 1 <merge-commit-sha>
rm -rf apps/web/.next
npm run build
pm2 restart sports-bar-tv-controller
scripts/verify-install.sh  # from the auto-update plan pre-work 2
```

If graystone or holmgren needs rollback AND the Madison-numbers bug needs to stay fixed, do a manual cherry-pick of Phase 2's dict deletion onto those branches separately — don't revert the full consolidation to fix a downstream bug.

### Phase 7 — Documentation + cleanup

**Changes:**
- Update CLAUDE.md: section "Live Channel Mapping" now says "all resolution goes through `network-channel-resolver.ts`; do not add hardcoded `NETWORK_TO_CABLE` dictionaries to new routes".
- Create `docs/CHANNEL_RESOLVER_ARCHITECTURE.md` with a diagram and consumer list.
- Delete any now-dead helper functions left over in the migrated routes.
- Delete `docs/SCHEDULER_FIXES_APRIL_2026.md` section 5a's "do not collapse the WI RSN aliases" warning — MOVE it to the canonical architecture doc where future maintainers will actually find it.
- `packages/config/src/hardware-config.ts` "Holmgren Way" fix on every branch — not part of this plan but flag as immediate follow-up.
- `packages/dbx-zonepro/src/dbx-protocol.ts` hardcoded Lucky's object IDs — flag as tech debt.

**Risk:** NONE. Docs only.

## 6. Risk summary (phase ordering per v2)

| Phase | Scope | Risk | Why | Worst-case failure |
|---|---|---|---|---|
| 0 (pre-work) | Seed file strategy + branch audit + schema validation | MED | New seed file affects fresh installs | Fresh install at a new location has no channel presets |
| 1 (API scaffold + tests + MAP reconciliation) | Shared helper additions | LOW | Additive, test-covered, no route changes | No user-visible impact |
| **2 (live-dashboard) — simple, pattern-prover** | One route, 2 dicts, ~80 lines removed | MED | Bartender-facing live scores, but gated by Phase 1 test suite | Live scores go blank — contained to the dashboard widget, trivial revert |
| **3 (live-by-channel) — widest blast radius** | Four bartender remote variants consume it | HIGH | Bartender-facing preset grids | Preset buttons show no live game overlay |
| **4 (ai-game-plan) — complex multi-tier** | Three-tier fallback + sport-gate + normalization | HIGH | Normalization behavior delta | AI Auto Pilot fails; Schedule tab shows wrong channels |
| **5 (channel-guide) — hardest, last** | 914-line route, 4 resolution layers, Guide tab critical path | HIGHEST | Most complex route, largest bartender impact | Bartender remote Guide tab goes silent |
| 6 (branch merges) | Per-location cutover | HIGH | Each location becomes a real-world test | Per-location breakage visible at that bar |
| 7 (docs + cleanup) | Non-behavioral | LOW | Content migration only | Future readers lose context on the WI RSN split warning |

**Why the phase order changed (v1 → v2):** v1 put the hardest route (`channel-guide`) first as Phase 2. v2 puts the simplest route (`live-dashboard`) first, proves the shared helper works in production for a week, then progressively tackles more complex routes. If anything blows up in Phase 2 it's a small, contained widget — not the main bartender workflow.

## 7. Rollback strategy

Every phase is a single commit. Phases 2-5 each have a bartender-facing risk, so each one lands in its own dedicated session and gets its own evening-trial period before the next one starts.

**Emergency rollback procedure** for any phase:
```bash
git revert <commit-sha>
npm run build
pm2 restart sports-bar-tv-controller
```

**Rollback verification:** curl the relevant endpoint, confirm it returns data (even if from the pre-migration path). Bartender remote visual check.

**Schema rollback:** None needed. This plan touches zero DB schemas. `channel_presets`, `station_aliases`, `local_channel_overrides`, `game_schedules` all stay unchanged.

## 8. Testing requirements

- **Unit tests:** Add tests for the shared helper at `apps/web/src/lib/__tests__/network-channel-resolver.test.ts`. Cover: direct preset match, alias fallback, `-TV` suffix, Wisconsin RSN split (both 40 and 308), `primaryNetwork` priority, empty inputs, sport-gated streaming codes.
- **Integration tests:** Keep the existing tests in `tests/integration/api.test.ts` passing (they're currently `describe.skip`).
- **Manual smoke tests per phase:** One test query per route, checked against expected channel output. Document in each phase's commit message.
- **Cross-branch verification for Phase 6:** After merging `main` into each location branch, run the same manual smoke test on that location's staging or production server.

## 9. Deferred items (NOT in this plan)

- `packages/config/src/hardware-config.ts` venue name / Atlas IP fix on graystone, holmgren, lucky-s branches. This is a separate single-file cleanup that should happen before Phase 6 to avoid conflicting with branch merges.
- `packages/dbx-zonepro/src/dbx-protocol.ts` ZonePRO object ID runtime-configurability. Affects only Lucky's; not on the bartender critical path.
- Merging `/api/sports-guide` raw passthrough into the consolidated path — it's a proxy, there's nothing to consolidate.
- Adding a channel-preset-editor UI to the Sports Guide admin's Channels tab (currently just a placeholder after v2.4.7).
- Bulk-import mechanism for initial channel preset population at new locations.

## 10. Open questions for user approval

1. **Option A/B/C for seeding?** The plan recommends B (per-location JSON files). Confirm or redirect.
2. **Phase 6 rollout order:** plan says Stoneyard → Graystone → Holmgren → Lucky's. Is that the right evening-trial order, or is there a location where breakage would be most catastrophic (avoid last) or most tolerable (test first)?
3. **Graystone and Holmgren Madison-numbers bug:** is this actually a live bug or has someone silently fixed it? The branch audit says the code still has Madison numbers. Confirm via a direct query on those locations' servers before Phase 4.
4. **Timing:** this is a 5-commit refactor minimum, spread across 5-7 sessions with evening trials between phases. Is that pace acceptable or do you want it compressed?
5. **Version bump:** plan says 2.5.0. Agree?

---

**Next step after approval:** start with Pre-work 1 (channel presets seeding). No phase can begin until the seed mechanism exists because the plan deletes hardcoded data that fresh installs would otherwise depend on.
