# Channel Resolver Consolidation Plan

**Status:** Plan only, awaiting approval. No code changes yet.
**Target version:** 2.5.0 (minor bump — architectural change)
**Scope:** Consolidate six separate channel-resolution code paths into a single source of truth backed by the `channel_presets` + `station_aliases` tables, fixing the channel-number divergence across location branches as a side effect.

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

### Phase 1 — Expand the shared resolver API

**Files changed:** `apps/web/src/lib/network-channel-resolver.ts` only.

**Additions:**
- `resolveChannelsForGame(game, options?)` — full game resolution including sport-gated streaming.
- `findLocalChannelOverride(teamName)` — reads `local_channel_overrides` table, 5-min cache.
- `getStreamingAppForStation(station, gameLeague)` — sport-gated streaming app lookup. Moves `STREAMING_STATION_MAP` from `ai-game-plan/route.ts` into the helper.
- `getStationToPresetMaps()` — exposes the internal lookup maps for consumers that need to walk them directly (channel-guide's listing loop).

**No route changes in this phase.** The helper gets richer APIs; nothing consumes them yet. This is the additive scaffolding phase.

**Verification:** `npx tsc` clean, all existing tests pass, `/api/scheduling/games` still returns the same shape it does today.

**Risk:** LOW. Pure additions, no deletions.

**Rollback:** Revert the single commit.

### Phase 2 — Migrate `/api/channel-guide`

**Files changed:** `apps/web/src/app/api/channel-guide/route.ts`.

**Changes:**
- Delete the inline `normalizeStation` function (lines 207-215). Import from helper.
- Delete the inline `stationToPreset` builder (lines 216-236). Use `getStationToPresetMaps()`.
- Keep the Rail Media loop structure, but replace the station-matching logic (lines 252-340) with direct map lookups from the helper.
- Keep the `local_channel_overrides` injection block (lines 344-412) BUT replace its inline team-name check with `findLocalChannelOverride()`.
- Keep the `game_schedules` fallback block (lines 421-550) BUT replace its inline `stationToPreset` usage with `resolveChannelsForNetworks()`.
- Delete `STREAMING_STATION_MAP` from this file. Import `getStreamingAppForStation()` from helper.

**Verification checklist:**
- `/api/channel-guide` returns the same program count for a test query (Stoneyard expected: ~41 programs including Brewers on 308).
- Brewers game still shows channel 308 (via `Brewers.TV` → `BallyWIPlus` alias → preset).
- Bucks game still shows channel 40 (via `Bucks.TV` → `FanDuelWI` alias → preset). **Critical regression check — the Wisconsin RSN split must survive.**
- Yankees game still shows channel 326 (MLB Network direct preset match).
- WLUK-TV-labeled game still matches WLUK preset (the `-TV` strip).
- Fire TV streaming path still returns packages for MLB.TV, Peacock, etc.
- The bartender remote's Guide tab renders and is clickable.

**Risk:** HIGH. Biggest behavioral delta of any phase. Bartender-facing. Must be tested on Stoneyard before merging to main.

**Rollback:** Revert the commit. Old inline logic comes back. DB data unchanged.

### Phase 3 — Migrate `/api/schedules/ai-game-plan`

**Files changed:** `apps/web/src/app/api/schedules/ai-game-plan/route.ts`.

**Changes:**
- Delete the inline `normalizeNetworkName` function (lines 343-351). This function diverges from the canonical helper (lowercases instead of uppercases, omits `-TV` strip). Replacing it with `normalizeStation` will fix latent bugs for local broadcast stations.
- Delete the inline `networkToCableChannel`/`networkToDirectvChannel` maps (lines 353-368).
- Delete the Tier 1 station matching loop (lines 420-451). Replace with a single `resolveChannelsForGame(listing)` call.
- Delete `STREAMING_STATION_MAP` from this file (lines 20-36). Use `getStreamingAppForStation()`.
- Delete the inline sport-gate code (lines 571-599). It's now in the helper.
- Keep the Rail Media HTTP call (line 377) and the Tier 3 channel-number fallback (lines 484-525) since those serve a different purpose.
- Fix the inline normalization divergence: any test that matches on `-tv` suffix or case sensitivity may behave differently after migration.

**Verification checklist:**
- `/api/schedules/ai-game-plan` still returns the same game count (currently ~60).
- Brewers game still resolves to cable 308 (via shared helper → BallyWIPlus alias).
- Hockey games still have 0 `MLB.TV` mislabelings (v2.4.9 sport-gate fix must survive the helper migration).
- The "currently showing" games array still includes `cableChannel`, `directvChannel`, `streamingApp` fields (v2.4.9 fix).
- `AIGamePlanDashboard` UI renders correctly with the same channel info it showed before.

**Risk:** HIGH. Bartender-facing via `AIGamePlanModal` + `ScheduledGamesPanel`. The Tier 1 normalization change is a behavioral delta.

**Rollback:** Revert the commit.

### Phase 4 — Migrate `/api/sports-guide/live-dashboard`

**Files changed:** `apps/web/src/app/api/sports-guide/live-dashboard/route.ts`.

**Changes:**
- **Delete `NETWORK_TO_DIRECTV` dict (lines 36-64).** Use `resolveChannelsForNetworks()`.
- **Delete `NETWORK_TO_CABLE` dict (lines 67-89).** Use `resolveChannelsForNetworks()`.
- **Keep `NETWORK_TO_STREAMING_APP` dict (lines 91-116).** Until Phase 1's `getStreamingAppForStation` is proven safe and covers these 16 entries; if it does, delete this too and import.
- Delete the helper functions `findChannelFromNetworks`, `findStreamingAppFromNetworks`, `findChannel`, `findStreamingApp`. Replace with helper calls.
- The route's response shape stays the same (`{liveNow, comingUp, todaySchedule}` with per-game channel fields).

**Verification checklist:**
- Stoneyard's live-dashboard response still returns the right channels for today's games.
- Brewers game shows cable 308.
- Bucks game shows cable 40.
- ESPN game shows cable 27.
- **CRITICAL:** After merging to main, this change automatically fixes graystone/holmgren wrong-Madison-numbers bug. Verify this by running the route on graystone with its DB and confirming Green Bay numbers come back.

**Risk:** HIGH — bartender-facing via `LiveSportsDashboard` component.
**Blast radius:** Stoneyard, graystone, holmgren-way (all Green Bay Spectrum area). Lucky's still fine because its DB has Madison numbers.

**Rollback:** Revert the commit. Hardcoded dicts return. Note: revert does NOT restore the Madison-numbers bug at graystone/holmgren because the code change is per-branch and the merge conflict will surface it.

### Phase 5 — Migrate `/api/sports-guide/live-by-channel`

**Files changed:** `apps/web/src/app/api/sports-guide/live-by-channel/route.ts`.

**Changes:**
- Delete `NETWORK_TO_DIRECTV` dict (lines 25-134).
- Delete `NETWORK_TO_CABLE` dict (lines 136-227).
- Delete the inline `networkMapping[network]` lookup + case-insensitive fallback (lines 355-378). Use the helper.
- **Keep** the `presetChannels` post-filter (line 375). The shared helper resolves, but the route needs to filter to only channels that exist in user's preset grid — that filter stays in the route.
- Keep the DirecTV guide fetch path (lines 406-447) — that's a different concern.

**Verification checklist:**
- Stoneyard's `ChannelPresetGrid` still shows live game overlays on the correct channels.
- Lucky's Madison preset grid still shows correct Madison channels.
- **CRITICAL:** This route is consumed by four different bartender remote variants (`ChannelPresetGrid` → `EnhancedChannelGuideBartenderRemote`, `BartenderRemoteSelector`, `BartenderRemoteSelector-Enhanced`, `BartenderRemoteControl`). Test all four.

**Risk:** HIGH — widest blast radius of any route.

**Rollback:** Revert.

### Phase 6 — Merge main → location branches

**Process:**
1. Merge `main` → `location/stoneyard-greenville`. Test at Stoneyard.
2. Merge `main` → `location/graystone`. Test at Graystone (verify the Madison-numbers bug is now fixed).
3. Merge `main` → `location/holmgren-way`. Test at Holmgren (same verification).
4. Merge `main` → `location/lucky-s-1313`. Test at Lucky's (verify Madison numbers still work — they're now coming from the DB, not the hardcoded dict).

**Conflict resolution rule:** On any conflict involving `apps/web/data/channel-presets-{cable,directv}.json`, ALWAYS `git checkout --ours` — location-specific data wins.

**Risk:** HIGH for graystone/holmgren where the behavior will change immediately (wrong Madison → correct Green Bay) and someone needs to visually verify.

**Rollback:** Per-location. Each merge is a separate merge commit; revert the merge on whichever location breaks.

### Phase 7 — Documentation + cleanup

**Changes:**
- Update CLAUDE.md: section "Live Channel Mapping" now says "all resolution goes through `network-channel-resolver.ts`; do not add hardcoded `NETWORK_TO_CABLE` dictionaries to new routes".
- Create `docs/CHANNEL_RESOLVER_ARCHITECTURE.md` with a diagram and consumer list.
- Delete any now-dead helper functions left over in the migrated routes.
- Delete `docs/SCHEDULER_FIXES_APRIL_2026.md` section 5a's "do not collapse the WI RSN aliases" warning — MOVE it to the canonical architecture doc where future maintainers will actually find it.
- `packages/config/src/hardware-config.ts` "Holmgren Way" fix on every branch — not part of this plan but flag as immediate follow-up.
- `packages/dbx-zonepro/src/dbx-protocol.ts` hardcoded Lucky's object IDs — flag as tech debt.

**Risk:** NONE. Docs only.

## 6. Risk summary

| Phase | Risk | Why | Worst-case failure |
|---|---|---|---|
| 0 (pre-work) | MED | New seed file affects fresh installs | Fresh install at a new location has no channel presets |
| 1 (API scaffold) | LOW | Additive only | No user-visible impact |
| 2 (channel-guide) | HIGH | Bartender-facing, most complex route | Guide tab blank, bartender can't see games |
| 3 (ai-game-plan) | HIGH | Bartender-facing, normalization behavior delta | AI Auto Pilot fails; Schedule tab shows wrong channels |
| 4 (live-dashboard) | HIGH | Bartender-facing live scores | Live scores go blank |
| 5 (live-by-channel) | HIGH | Four bartender remote variants | Preset buttons show no live game overlay |
| 6 (branch merges) | HIGH | Each location becomes a real-world test | Per-location breakage visible at that bar |
| 7 (docs) | NONE | Docs only | N/A |

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
