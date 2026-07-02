# Location Update Notes

**Purpose:** This file is the per-release "what you need to know before you
update" changelog for location deployments. It is read by Claude Code during
auto-update Checkpoint A as required context, so whatever is documented here
will be factored into the GO/CAUTION/STOP decision on every location's
update run.

**Format:** newest entries at the top. Each entry documents a single push to
`main` (or a coherent group of related pushes) with:

- **Date + tip SHA** — for cross-reference with `git log`
- **What changed** — one-line summary of the user-visible changes
- **What could break at a location** — honest risk assessment per location
- **Manual steps required** — anything the auto-updater CAN'T do automatically
- **Rollback notes** — if this update proves bad, how to back out
- **Affected files** — so Claude can correlate with the incoming diff
- **`Checkpoint model: sonnet|opus`** — *optional, v2.32.33+*. Overrides the
  default Haiku for ALL three checkpoints during this update. Use when
  shipping a major refactor, schema migration, or cross-cutting change
  that needs deeper reasoning than Haiku 4.5 reliably provides. The flag
  applies until the next location auto-update lands; remove it once the
  risky update is across the fleet. Operator's `CLAUDE_API_MODEL` in
  `.env` overrides this flag.

**How to add an entry:**

```bash
bash scripts/add-update-note.sh
```

or manually prepend a new section below the "Current entries" marker.

**How Claude uses it:**

Checkpoint A reads the top 3-5 entries of this file (the most recent pushes
since the location last updated). If any entry's "What could break" section
mentions a risk that matches the incoming diff, Claude will flag it as
CAUTION or STOP with a direct citation. This is the mechanism by which
location-specific risks are surfaced BEFORE the merge touches disk.

**Cutoff:** entries older than 30 days can be pruned. This is a living
decision log, not a permanent archive. Git history is the archive.

---

## Current entries

### 2026-07-01 — v2.95.4 — FIX: auto-update.sh outcomes could look "finished" (and get misclassified) while still mid-run

- **Risk: GO (parsing/telemetry only, no behavior change to auto-update.sh itself).** `apps/web/src/lib/auto-update/log-parser.ts`, `apps/web/src/app/api/auto-update/live/route.ts`.
- **Why:** `parseLogFile()` set a run's `finishedUnix`/`finishedAt` from **whatever the last log line happened to be at parse time** — not from an actual completion marker. So a run only 35 seconds into a 4+ minute build looked exactly like a "finished" run to any caller checking `finishedUnix != null`. Combined with the fact that `auto-update.sh` tags a rollback-safety-net early in *every* run (success or not), a poll landing in that narrow early window classified the run as `'rollback'` before it ever reached its real outcome. Confirmed live: leg-lamp's real v2.95.3 canary succeeded cleanly (`SUCCESS: updated ... in 229s`), but the SBCC hub's fleet telemetry recorded that exact run as a fabricated 35-second `'rollback'` — because the hub also dedups inserts on `(location, runId)`, so the wrong early snapshot became permanent and the correct later poll was silently dropped (see the separate hub-side fix below).
- **Fix:** added a `terminal: boolean` field, set ONLY when a genuine terminal marker is seen — `SUCCESS: updated`, or one of the 4 lines `cleanup_on_error()` (the EXIT trap) logs as its own final action (`Rollback succeeded.`, `CRITICAL: rollback itself failed`, `CRITICAL: no rollback tag set`, or `Failure happened before any on-disk change. No rollback needed.`). `finishedUnix`/`finishedAt`/`totalDurationMs` are now gated on `terminal`. `packages/hub-agent/src/collect.ts`'s skip-guard now checks `!run.terminal` instead of the old unreliable proxy. Also fixed the same class of bug in `/api/auto-update/live`'s SSE stream (it treated bare `FAIL at step` as terminal and looked for a literal `ROLLED BACK` string that never actually appears in a real log).
- **Companion hub-side fix (not part of this app, no location action needed):** `apps/hub/src/lib/repo.ts`'s `insertFleetUpdate()` changed from `.onConflictDoNothing()` to `.onConflictDoUpdate()` on `(location_id, run_id)` — defense in depth so a later correct poll can still fix an earlier wrong snapshot, even if a future edge case slips past the parser fix.
- **No location action needed.** Purely fixes how run outcomes are read/reported; doesn't change what auto-update.sh does.
- **Affected files:** `apps/web/src/lib/auto-update/log-parser.ts`, `apps/web/src/app/api/auto-update/live/route.ts`, `packages/hub-agent/src/collect.ts` (hub-only, not deployed via fleet auto-update), `apps/hub/src/lib/repo.ts` (hub-only), `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-07-01 — v2.95.3 — FIX: Checkpoint B false-STOP on hub-only schema changes (rolled back a real leg-lamp update)

- **Risk: GO (one deterministic check, narrows scope only).** `scripts/checkpoint-deterministic.sh` only.
- **Why:** the new-table existence check (`git diff PRE..HEAD -- '*/schema.ts'`) matched **`apps/hub/src/db/schema.ts`** too — the SBCC central hub's own schema, which deploys to its own separate database on a different server (CT211's `hub.db`) and is NEVER applied to a fleet box's `production.db`. When the P1.3/P2.1 hub tables (`fleet_target`, `rollouts`, `rollout_boxes`) landed in the same diff window as an unrelated push, every fleet box's next auto-update hit Checkpoint B, saw those hub-only table names, correctly found them missing from `production.db` (they were never supposed to be there), and STOPped — triggering a full rollback of an otherwise-clean update. Confirmed live: leg-lamp's canary attempt at v2.95.2 built successfully, then rolled back cleanly at Checkpoint B with exactly this message.
- **Fix:** scoped the `git diff` pathspec to `apps/web/src/db/schema.ts` and `packages/database/src/schema.ts` only — the two files that actually govern what should exist in a fleet box's `production.db`. Verified locally: the same diff range now reports zero new tables (down from 3 false positives).
- **No location action needed.** Purely a Checkpoint B safety-check fix; doesn't touch any table or migration.
- **Affected files:** `scripts/checkpoint-deterministic.sh`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-30 — v2.90.2 — FIX: bartender-remote "update available" auto-refresh never fired on the bar iPad

- **Risk: GO (one component).** `UpdateAvailableBanner.tsx` only.
- **Why:** the remote already had an `UpdateAvailableBanner` that polls `/api/version` and reloads — but it relied solely on a 60s `setInterval`, which **Safari suspends when the tab is backgrounded or the iPad is locked**. A bar iPad sits idle behind the bar, so the timer almost never ran → updates were never detected → the iPad kept running a stale bundle (the root cause of today's "did the fix land?" confusion across the meter/tab/Source-Status fixes).
- **Fix:** re-check the version the instant the tab is foregrounded — added `visibilitychange` / `focus` / `pageshow` listeners that call the version check on wake. Also shortened idle auto-reload from 2 min → 45s so it fires during a normal lull once an update is detected.
- **Bootstrapping note:** the iPad still needs ONE manual refresh to load this fix; after that, future updates auto-detect on wake.
- **Affected files:** `apps/web/src/components/UpdateAvailableBanner.tsx`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-30 — v2.90.1 — HARDENING: apply path now rejects scheduling onto a downed source

- **Risk: GO (one guard).** `apps/web/src/app/api/schedules/bartender-schedule/route.ts` only.
- **Why:** the candidate/suggest paths (`ai-suggest/route.ts:461`, `smart-input-allocator`) correctly filter `is_active`, but the **apply** path (`bartender-schedule` line ~102) bound the input source by id with **no `is_active` guard**. So a stale AI-Suggest plan generated *before* a box was marked down could still commit an allocation onto the dead box. Surfaced at Greenville: Cable 1 was correctly disabled (`is_active=0`) yet stale suggestions kept proposing TV 1 → Cable 1; regenerating AI Suggest drops it, but the apply path was the remaining hole.
- **Fix:** after resolving the input source by id, return **409** if `inputSource.isActive === false` with a clear message ("…is marked down… Mark it Available again, or pick another source.").
- **Operator note:** when you mark a box Down, **regenerate AI Suggest** so live suggestions exclude it; this guard is the backstop for stale plans.
- **Affected files:** `apps/web/src/app/api/schedules/bartender-schedule/route.ts`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-30 — v2.90.0 — FEATURE: bartender-remote "Source Status" toggle (mark a box down → AI Suggest skips it)

- **Risk: GO (additive feature).** New component + new PATCH method; no existing behavior changed.
- **Why:** when a cable/DirecTV/Fire TV box is broken, the operator needs a no-SSH way to stop the auto-scheduler from routing games to it. Greenville's Cable 1 was down 2026-06-30 and there was no UI to exclude it.
- **What:** new collapsible **"Source Status"** panel at the top of the bartender remote's **Video tab** (`SourceAvailabilityPanel.tsx`, SafeBoundary-wrapped). Lists every input source with an **Available / Down** toggle. Toggling **Down** sets `input_sources.is_active = 0` → AI Suggest + the whole scheduler (distribution engine, conflict detector, smart allocator, Fire TV sync) skip it. Flipping back to **Available** re-enables it. **Manual matrix routing is unaffected** (that uses `MatrixInput`, not `input_sources`), so bartenders keep manual control/visibility of a down box.
- **API:** new `PATCH /api/scheduling/input-sources` `{id, isActive}` — lightweight toggle (no full upsert body). Under `/api/scheduling/` which is already nginx-allow-listed on :3002, so it works on the remote with no proxy change.
- **Greenville Cable 1:** already set `is_active=0` directly during the 2026-06-30 outage; this panel is how it's managed going forward (and re-enabled when fixed).
- **Verify on the remote:** Video tab → "Source Status" → toggle a box Down then Available; confirm the `N down` badge updates. Down boxes get skipped by AI Suggest's next run.
- **Affected files:** `apps/web/src/components/SourceAvailabilityPanel.tsx` (new), `apps/web/src/app/remote/page.tsx`, `apps/web/src/app/api/scheduling/input-sources/route.ts`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-30 — v2.89.6 — FIX: no output meters on the bartender remote at group-based locations (Stoneyards)

- **Risk: GO (one-line UI fix).** `BartenderRemoteAudioPanel.tsx` only. Safe for all locations (meters self-guard with `.length > 0`).
- **Bug:** the bartender Audio-tab meters showed nothing at the Stoneyards. `BartenderRemoteAudioPanel` passed `showGroups={false}` and `showOutputs={outputMetersEnabled}` to `AtlasRealtimeMeters`, but `showOutputs` renders **zone** meters (`ZoneMeter_N`). The Stoneyards are **group-based** (no zones) → zone outputs are empty AND group meters were suppressed → blank. Same zone-vs-group split as the v2.89.5 gain bug. The data pipeline was fine — the SSE stream (`/api/atlas/meters/stream`) and `useAtlasMetersSSE` already carry `groups`; only the panel suppressed them.
- **Fix:** `showGroups={outputMetersEnabled}` — at group-based locations the group meters ARE the output meters, gated by the same output-meters toggle. `AtlasRealtimeMeters` guards each section with `.length > 0`, so zone-based locations (empty `groups`) render nothing extra.
- **Verify on the remote:** open Audio tab → expand meters → group level meters (Main Bar/Dining/Outside) should now show live levels with a source playing.
- **Note:** this was a pre-existing gap (meters never worked at group-based locations), not a regression. If meters still don't appear after this, the live UDP subscription (port 3131) is the next suspect — plumbing checked OK (app listens on 3131, ufw allows 10.0.0.0/8).
- **Affected files:** `apps/web/src/components/BartenderRemoteAudioPanel.tsx`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-30 — v2.89.5 — FIX: bartender remote silently muted Atlas groups (dB sent as percent) — Stoneyard no-audio root cause

- **Risk: GO (one-line bugfix).** `apps/web/src/app/api/atlas/groups/route.ts` only. Affects group-based audio (Stoneyards); Holmgren uses zones, unaffected.
- **Root cause of the Appleton/Greenville "no audio":** the bartender remote's group slider (`AtlasGroupsControl.tsx`) is clamped to −80…0 **dB** and sends that dB value with `action: 'setGain'`. The `/api/atlas/groups` POST handler called `client.setGroupVolume(idx, value)` — and `setGroupVolume` defaults `usePct=true`, so the dB value (e.g. −74) was sent to the Atlas as a **percent** (`format:'pct'`). The Atlas clamps an out-of-range percent to its floor → `GroupGain_N` slammed to **−80 dB (silent)**. So every bartender volume nudge was *muting* the group, not setting it — which is why Main Bar was found parked at −80.
- **Not a firmware/DSP/hardware fault.** Confirmed live: operator controls the Atlas fine from its own admin UI; gains read back correctly in dB via `/api/atlas/groups` GET; watched `GroupGain_0` track admin-page moves −80→−40 in real time. The Atlas was always healthy.
- **Fix:** `setGain` now calls `setGroupVolume(groupIndexNum, valueNum, false)` → sends dB as `'val'`, matching the slider and the admin UI.
- **Index note:** the group index is correct as-is — `/api/atlas/groups` is 0-based (Main Bar = `GroupGain_0` = index 0) and the POST passes it straight through (no `-1`). The `-1` only exists in the *other* endpoint `/api/audio-processor/control` (1-based), which the remote does NOT use.
- **Verify on the remote:** move a group slider — the room volume should track it (and NOT drop to silent). Re-test at Greenville after it updates.
- **Affected files:** `apps/web/src/app/api/atlas/groups/route.ts`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-30 — v2.89.4 — FIX: bartender remote deselects Output N video source on tab switch

- **Risk: GO (bugfix).** Self-contained, additive (sessionStorage persist/restore). Affects the Video tab only.
- **Bug:** the Video tab is conditionally rendered (`{activeTab === 'video' && <InteractiveBartenderLayout/>}`), so leaving the tab UNMOUNTS the component and its `selectedZone` local state resets to null → switching tabs deselects the output you'd selected ("Output 1 video source deselects"). Reported at both Stoneyards (Appleton + Greenville) 2026-06-30. Was filed as a TODO months-perceived but **never actually fixed** (git: only `17aa3816` added a TODO entry, no fix commit).
- **Fix:** `InteractiveBartenderLayout` now persists `selectedZone` (by `outputNumber`) to sessionStorage and restores it on remount — selection survives tab switches. Cleared automatically after a route is applied (existing behavior).
- **Verify on the remote:** select a TV/output on the Video tab, switch to another tab and back — the output stays selected.
- **Affected files:** `apps/web/src/components/InteractiveBartenderLayout.tsx`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-30 — v2.89.3 — FIX: audio control 500'd at slug-id processor locations (Appleton no-audio)

- **Risk: GO (bugfix).** One-line validation relax. Affects audio-control endpoint only.
- **Bug:** `audioControlSchema.processorId` was `z.string().uuid()`, but `AudioProcessor.id` is a **slug** at JSON-seeded locations (e.g. `"atlas-stoneyard"` at the Stoneyards) vs a UUID at others (Holmgren). The strict `.uuid()` made EVERY audio-control command (volume/mute/source/group-volume) fail validation → 500 → **no audio control at slug-id locations.** Surfaced as the Appleton no-audio incident 2026-06-30 (compounded by Appleton being 2 versions behind + an Atlas control-port wedge needing a power-cycle).
- **Fix:** `processorId: z.string().min(1)` — accepts both slug and UUID ids; the processor lookup still validates existence.
- **Affected locations:** any with a slug audio-processor id (Greenville/Appleton Stoneyards most likely). Holmgren (UUID) was unaffected.
- **Affected files:** `packages/validation/src/schemas.ts`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-30 — v2.89.2 — DirecTV channel-health scan engine (monthly, Hermes-driven)

- **Risk: GO.** New read-only ops script, no app code. `scripts/scan-directv-channels.py`.
- **What:** reliable DirecTV preset audit — reads a box's directv presets + DirecTVDevice IPs, probes each channel **distributed one-per-receiver across all receivers** (DirecTV SHEF times out under concurrent load → a naive parallel scan false-flags valid channels as dead; this is the lesson from the 2026-06-30 Graystone cleanup). Reports COLLISIONS (DB-level, reliable) + CONFIRMED-DEAD (clean "Channel does not exist" only; HTTPError/timeout = inconclusive, never flagged). No-op on boxes without DirecTV. READ-ONLY (reports, never edits).
- **Scheduling:** a **Hermes monthly cron** (CT212) SSHes to each fleet box and runs it; output delivered by Hermes. Operator wanted Hermes to own the recurring scan.
- **Context:** built after a one-off cleanup found Graystone (only box w/ DirecTV) had 16 preset collisions + a defunct channel; monthly scan catches future drift. Manual run: `python3 scripts/scan-directv-channels.py` on any box.
- **Affected files:** `scripts/scan-directv-channels.py`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-29 — v2.89.1 — scheduler adoption nudge in shift-brief + "How to Schedule a Game" how-to

- **Risk: GO.** Purely additive. New bartender-help doc + a conditional shift-brief bullet. No schema, no deps, no env.
- **What changed:** (1) `docs/bartender-help/HOW_TO_SCHEDULE_A_GAME.md` — plain-language one-pager for crews not using the scheduler. (2) `shift-brief/route.ts` adds `schedulingTip` — a server-built (Gotcha #12) verbatim bullet that **only appears when a box has scheduled ZERO games in the last 7 days AND has games tonight**. Self-limiting: vanishes once they schedule anything, so it's silent at active boxes (Holmgren) and nudges dormant ones (Graystone/luckys/Appleton). Mirrored to `fallbackBrief`.
- **What could break:** nothing — the tip is null at any box that's scheduling. The query is one indexed count on `input_source_allocations`.
- **Why:** usage audit showed only Holmgren (38/7d) + Greenville (1) actively schedule; Graystone/luckys/Appleton are configured but unused (0 AI Suggest ever). This drives adoption without a deploy-per-location.
- **Affected files:** `apps/web/src/app/api/ai/shift-brief/route.ts`, `docs/bartender-help/HOW_TO_SCHEDULE_A_GAME.md`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-29 — v2.89.0 — AI Suggest `primary` solver mode (Wave 2 canary, default OFF)

- **Risk: GO.** Implements the stubbed `primary` mode of `AI_SUGGEST_SOLVER`. Flag **defaults to `off`** → zero behavior change for any box that doesn't opt in. `off`/`shadow` paths are byte-identical to before.
- **What changed:** `primary` = hybrid — the deterministic DistributionEngine produces cable/directv suggestions (the bartender-visible picks), the LLM still runs for Fire TV/streaming coverage + uncovered games, engine wins on shared games. Engine-vs-LLM shadow diff keeps logging during `primary`. `ai-suggest-solver-shadow.ts` refactored (engine-plan core extracted to a shared helper + new exported `computeEngineSuggestions`); `ai-suggest/route.ts` gained the primary merge block + fires the shadow diff for `primary` too.
- **What could break:** nothing unless a box sets `AI_SUGGEST_SOLVER=primary`. The primary block is try/catch-guarded → falls back to LLM-only on any engine error.
- **Canary:** Holmgren is running `primary` (its gitignored `.env` only — NOT propagated). Evaluate via override-learn acceptance over ~1 week before considering a fleet flip.
- **Manual step:** none. To opt a box in: `.env` `AI_SUGGEST_SOLVER=primary` + `pm2 delete && pm2 start ecosystem.config.js` (Gotcha #2). Rollback: set `shadow`, delete+start.
- **Affected files:** `apps/web/src/app/api/scheduling/ai-suggest/route.ts`, `apps/web/src/lib/scheduling/ai-suggest-solver-shadow.ts`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-29 — v2.88.0 — bartender-remote (:3002) connection tracking + new-WAN-IP Telegram alert

- **Risk: GO.** Purely additive ops tooling. No schema, no deps, no env, no app code. New `scripts/` only + doc entries.
- **What changed:** `scripts/install-3002-tracking.sh` (idempotent activator), `scripts/conn-track-3002-enrich.sh` (per-minute durable MAC-enriched audit log of :3002 connections + Telegram alert on first sighting of a NEW WAN IP), `scripts/who-hit-3002.sh` (viewer: `--wan`/`--today`/`--raw`).
- **What could break:** nothing at the app level — these scripts don't run unless a box runs the activator. The activator only touches nginx logging (adds an `access_log` line) + a crontab entry; both idempotent and reversible.
- **Context:** built when Holmgren's :3002 was opened to the WAN (Gotcha #20 exception, operator-accepted — the bartender remote is unauthenticated, so this is the audit/alert trail for it). Holmgren is already activated. Other boxes stay firewalled; activation there is optional LAN audit only.
- **Manual step:** OPTIONAL — `bash scripts/install-3002-tracking.sh` to turn it on per box. Telegram alerts use existing `.env` `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`.
- **Affected files:** `scripts/{install-3002-tracking,conn-track-3002-enrich,who-hit-3002}.sh`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

### 2026-06-29 — v2.84.3 / v2.85.0 / v2.86.0 — luckys hub-name fix, 4 AM morning-reset, default audio levels

- **Risk: GO.** Scheduler feature + verify-install fix. No schema/deps/env.
- **v2.84.3** — `verify-install.sh` `hub_agent_registered` derives the expected hub agent slug from the **git branch** (`location/<slug>`) instead of the typo-prone free-text `LOCATION_NAME` → fixes the false `WARN: no agent for lucky1313` (luckys registers as `agent-luckys-1313`); robust for all locations.
- **v2.85.0 — daily 4 AM (CT) morning-reset to defaults.** In-app scheduler job on every box: at ~04:00 CT it reverts every video TV output to its default input + tunes every cable/DirecTV box to its default channel (reads `SystemSettings.default_sources`; live-game protected; once-per-day guarded). Manual trigger: `POST /api/scheduling/morning-reset {dryRun}`. **Per-location dep:** only resets outputs/boxes with a configured default — a location with empty `default_sources` is a safe no-op. **Audio-matrix outputs are EXCLUDED** (set `isSchedulingEnabled=0`) so the video pass never routes audio to a video input. Greenville/Appleton currently have no video *routing* defaults → channels-only until their managers set routing in the Schedule-tab defaults UI.
- **v2.86.0 — default audio levels + source** in the SAME Schedule-tab defaults UI (`DefaultSourceSettings`): per-Atlas-zone 0–100% level + per-audio-output default source. The morning-reset's audio pass (Step 4.5) applies them via the shared Atlas client (`getAtlasClient`, Gotcha #10); the atlas-drop-watcher honors a `morning-reset` marker so deliberate 4 AM level-sets log EXPLAINED, never a false drop alert. **No-op until a manager sets values** (ships with none). Atlas-only for now (dbx/BSS extensible).
- **Operator action:** none required. Managers populate per-location routing/channel/audio defaults in the Schedule-tab defaults section.

### 2026-06-29 — v2.84.0–v2.84.2 — AI Suggest Fire TV grounding, schedule-end revert tighten, auto-update finalize fix

- **Risk: GO.** Scheduler/code + one shell fix. No schema/deps/env.
- **v2.84.0 — AI Suggest Fire TV grounding + collision repair** (`ai-suggest/route.ts`): a game only routes to a Fire TV if the game's streaming app is INSTALLED on that box (reads per-box `DeviceSubscription`); colliding/invalid picks get reassigned to an idle compatible input instead of hard-rejected. Fixes the all-rejected empty-slate bug (Greenville 06-28). **Depends on each box's `DeviceSubscription` being populated** (auto-refreshed since v2.83.3 — verified non-empty on all 5 boxes).
- **v2.84.1 — schedule-end revert window 30min→15min** (`auto-reallocator.ts`): when a game ends and nothing's scheduled for that box within 15 min, it reverts to defaults (TV routing + default channel; cable AND DirecTV via `default_sources.cableBoxDefaults`). Confirmed-live games never reverted (v2.82.52). Per-location: needs `default_sources.cableBoxDefaults` configured per box.
- **v2.84.2 — auto-update finalize fix** (`scripts/auto-update.sh`): post-push bookkeeping (`history_update_result`/`state_update`/`write_summary_json`) is now NON-FATAL. A transient exit there was rolling back an already-pushed, verify-passed update (Lime Kiln spurious rollback, v2.84.0 roll). Self-applies after this lands (the running script still pre-dates the fix on THIS roll, so a spurious rollback may still occur once more per box → re-trigger clears it).
- **Operator action:** none.

### 2026-06-28 — v2.83.6 — security: patch undici + form-data HIGH CVEs (overrides)

- **Risk: GO.** Dependency override only — no source/schema/env change, no native
  rebuild (both pure-JS transitive deps). Propagates via `npm ci` on auto-update.
- **What:** root `package.json` `overrides` pins undici `^7.28.0` + form-data
  `^4.0.6`, clearing all 3 HIGH npm vulns (undici TLS-bypass + Set-Cookie
  injection; form-data CRLF injection). Done via overrides because
  `npm audit fix` is guarded (would downgrade next/drizzle-kit/next-auth). Now
  0 HIGH / 0 CRITICAL; 5 moderates intentionally left (v2.55.13 auth chain).
- **Operator action:** none. Verified build 29/29 + health/login 200.

### 2026-06-28 — v2.83.5 — fleet-status "behind vs stuck" + broader LG pairing token

- **Risk: GO.** Two self-contained code changes, no schema/deps/env.
- **Fleet-status:** `/api/fleet/status` no longer flags a location `stuck` on
  version distance alone — `stuck` now needs a real failure signal (verify-install
  failed, or behind + no successful auto-update heartbeat in 72h). A behind box
  with a fresh heartbeat reads `warning — catching up`. Kills the false-alarm
  class that auto-filed the BOUNDPOND/GRAPES recovery todo.
- **LG pairing:** broader webOS manifest (standard lgtv2 perm set) so pairing can
  read the TV's model/serial/firmware (old 4-perm token → 401). Model saved to
  `NetworkTVDevice.model`. **Optional:** re-pair existing LG TVs once to capture
  model; old token still controls them.
- **Operator action:** none required. Re-pair LG TVs only if you want model info.

### 2026-06-28 — v2.83.4 — bartender docs: "which fix?" router + wireless-mic RF-banner refresh

- **Risk: GO. Docs-only** (docs/bartender-help/). No code/schema/deps. New
  fixing-wrong-tv-input.md router + MIC_NOT_WORKING.md RF-banner/clean-freq note.

### 2026-06-28 — v2.83.3 — auto-update lock-leak fix + Fire TV preset-list auto-refresh

- **Risk: GO.** One shell fix in `scripts/auto-update.sh` + one additive
  background job in the web app. No schema, no deps, no env, no API contract
  change.
- **Lock-leak fix:** auto-update left `/tmp/sports-bar-auto-update.lock` on disk
  after a clean SUCCESS; the pm2 daemon (respawned during restart) inherits the
  flock FD and keeps the old inode locked, so the next run's `flock -n` fails and
  the box silently stops updating (what froze all 5 boxes at the 13:32 roll).
  New `_release_lock()` removes the lock FILE on every exit path → next run gets
  a fresh inode. **Self-healing once landed; manual stopgap is still
  `rm -rf /tmp/sports-bar-auto-update.lock*` + re-trigger.**
- **Fire TV refresh:** new `firetv-subscription-refresh.ts` re-scans each Fire TV
  box's installed-app list (its scheduler preset list in `DeviceSubscription`) at
  boot+2min then every 12h. Failure-isolated (a box that's off keeps its
  last-good list). Fixes lists going months stale.
- **Operator action:** none. Lock fix applies on next auto-update; refresh starts
  on next PM2 boot.

### 2026-06-28 — v2.83.2 — Hermes shadow Checkpoint C evidence-grounded + hard-fail gate

- **Risk: GO (advisory-only).** Touches only the auto-update Hermes SHADOW
  reviewer (`scripts/checkpoint-hermes.sh`) + a one-line `export` in
  `auto-update.sh`. The shadow is advisory and NEVER gates an update — zero
  behavior change to the real GO/CAUTION/STOP path. No schema, no deps, no env.
- **What:** Shadow analysis (61 datapoints, all 5 boxes) showed Checkpoint C's
  shadow was judging blind (no evidence injected into the tool-less model's
  prompt) and rubber-stamping GO — it missed the only 2 real post-install
  failures on record (luckys 2026-06-27, `real=STOP/hermes=GO`). Now LABEL=C
  gathers the same evidence `run_c()` uses (health code, verify-install status,
  epoch-filtered fresh crash lines) and deterministically STOPs on any hard-fail
  before consulting the LLM (which is only asked the GO-vs-CAUTION holistic
  call). Inversion is now structurally impossible.
- **Operator action:** none. Each box's next auto-update exercises the new path
  and logs cleaner shadow data to `hermes-shadow/checkpoint-shadow.jsonl`.

### 2026-06-28 — v2.83.1 — maintenance-todo destructive-command guard

**Risk:** GO — defensive hardening, no schema/env/migration. Adds input-sanitization to an existing endpoint + tightens an MCP tool description.

**What changed:** `/api/maintenance-todo` now strips destructive shell commands (git clean -dxf / rm -r / git reset --hard / git push --force / origin-master / rebase --onto) from auto-filed todo descriptions, replacing the code block with a safety notice. The `create_maintenance_todo` MCP tool description discourages drafting them + over-filing fleet-recovery todos for boxes merely behind on version.

**What could break at a location:** Nothing — it only sanitizes free-text todo descriptions; legitimate todos are unaffected (the guard triggers only on destructive patterns). No change to hardware, scheduling, or update behavior.

**Manual steps required:** None.

**Rollback:** revert the v2.83.1 commit; auto-filed todos go back to storing raw (possibly destructive) text.

**Affected files:** `apps/web/src/app/api/maintenance-todo/route.ts`, `packages/mcp/src/server.ts`.

### 2026-06-28 — v2.83.0 — LG TV pairing (webOS) in-app

**Risk:** GO — additive feature, no schema/env/migration. The new code path only fires when an operator clicks the new "Pair TV" button for an LG TV; existing Samsung pairing and all power/routing paths are unchanged.

**What changed:** new `LGTVClient.pair()` (webOS PROMPT pairing — waits for the real `registered` accept frame, captures clientKey); `/api/tv-control/[deviceId]/pair` now handles LG (saves clientKey) in addition to Samsung (authToken); `TVNetworkDiscovery.tsx` shows "Unpaired" badge + "Pair TV" button for LG; pair timeout 60s; `tvPairSchema` max 120s.

**What could break at a location:** Nothing passive. The pair route was Samsung-only, so adding an LG branch can't affect Samsung/Roku/other brands. The UI button only appears for LG TVs lacking a clientKey. Power-ON (WoL) untouched.

**Manual steps required:** None. Locations with LG TVs can now pair them from Device Config → TV Network (click Pair, accept on the TV with the remote).

**Rollback:** revert the v2.83.0 commit; LG TVs simply lose the in-app pair button. No state to undo.

**Affected files:** `packages/tv-network-control/src/clients/lg-client.ts`, `apps/web/src/app/api/tv-control/[deviceId]/pair/route.ts`, `apps/web/src/components/tv-network/TVNetworkDiscovery.tsx`, `packages/validation/src/schemas.ts`.

### 2026-05-28 — v2.55.6–v2.55.9 — ISO hardware-prereqs + triple-$ password + PXE netboot fix

**Risk:** GO — **zero runtime impact for installed fleet boxes.** Every change in this batch is ISO-build / new-NUC-provisioning side. No app code, no schema, no PM2 service touched.

**What changed:**
- **v2.55.6** — baked hardware prereqs into the autoinstall ISO (packages `adb, rtl-sdr, nginx, nmap, arp-scan, sshpass, imagemagick, v4l-utils`; first-boot `.env` generation with fresh crypto secrets; `usermod -aG dialout,video,render,plugdev`; setup-sdr.sh + setup-bartender-nginx.sh). Closes the gap analysis vs Holmgren so new NUCs need minimal debugging.
- **v2.55.7** — fleet password fixed to `6809233DjD$$$` (THREE $, was two). Fixed the `$$`→PID expansion trap in smoke/audit test scripts.
- **v2.55.8** — PXE netboot fix: `sanboot`-the-whole-ISO never worked for Ubuntu casper (UEFI+BIOS both); now boots kernel+initrd over HTTP with casper fetching the ISO via `url=`. `configure-netboot-menu.sh` reworked; dnsmasq proxy fixed (`pxe-service=` not `dhcp-boot=`). Verified live on Proxmox VM 201. CLAUDE.md Gotcha #19.
- **v2.55.9** — VERSION_SETUP_GUIDE entries for the above.

**Where this matters:** new-NUC provisioning only (USB ISO + office PXE server). Installed fleet boxes never re-run the ISO/installer.

**Manual steps required (PXE server LXC only):** re-run `bash /root/configure-netboot-menu.sh` inside the netboot LXC so the new kernel+initrd menu + extracted casper files land. Fleet boxes: nothing. Full prescriptive steps in VERSION_SETUP_GUIDE.md v2.55.6–.8.

**Rollback:** revert the relevant commit; previous ISO builds are archived. No fleet-side state to undo.

**Affected files:** `scripts/iso/*`, `scripts/proxmox/configure-netboot-menu.sh`, `docs/PROXMOX_PXE_SETUP.md`, `docs/VERSION_SETUP_GUIDE.md`, `CLAUDE.md`.

### 2026-05-27 — v2.54.86 — disk-installer adds bios_boot partition (GPT+BIOS boot fix)

**Risk:** GO — zero runtime impact for installed fleet.

**What changed:** the 6th install-bug iteration this week. `disk-installer.sh` Step 2 now creates a `bios_boot` partition (1 MB, type ef02) as partition 1 before EFI (now part 2) + root (now part 3). On GPT disks booted in BIOS legacy mode, `grub-install --target=i386-pc` requires this partition to embed its core image. Without it, the MBR signature 0x55AA was present (v2.54.80 check passed) but GRUB stage 1 had no valid stage-2 pointer → VM hung at SeaBIOS "Booting from Hard Disk..." even though kernel + initrd + grub.cfg were all correctly placed (v2.54.84 + earlier fixes confirmed working at install time via disk inspection).

**Where this matters:** new-NUC installs only. Installed fleet boxes never re-run disk-installer.

**Manual steps required:** none. Next-NUC install with attempt-9 ISO should finally boot all the way through.

**Caveat for the v2.54.80 MBR check:** the 0x55AA signature is necessary but not sufficient validation — it's present on every formatted disk regardless of GRUB. A future hardening pass could read GRUB's identifying bytes from MBR. Not blocking; the bios_boot partition fix addresses the underlying cause.

**Rollback:** `git revert <SHA>` — no functional change to revert at any installed location.

**Pattern (6th iteration this week):** v2.54.76 + v2.54.79 + v2.54.80 + v2.54.81 + v2.54.84 + v2.54.86. Every handoff in the boot chain is now defensively validated where we know how to check it.

`Checkpoint model: opus`

---

### 2026-05-27 — v2.54.84 — disk-installer copies kernel+initrd from casper to /boot

**Risk:** GO — zero runtime impact for installed fleet.

**What changed:** the 5th install-bug iteration this week. `disk-installer.sh` Step 4 (squashfs extract) now also copies `/cdrom/casper/vmlinuz` + `initrd` to the target's `/boot/vmlinuz-${KERNEL_VER}` + `/boot/initrd.img-${KERNEL_VER}` with version-matching symlinks. The build script's `mksquashfs -e boot` deliberately excludes /boot/ from the squashfs (live-boot uses /casper/* instead), so the extracted filesystem had no kernel — and `update-grub` referenced non-existent kernel files. Installed VM hung at `Booting from Hard Disk...` for 4+ min with no DHCP. Disk inspection confirmed missing vmlinuz/initrd.

**Where this matters:** new-NUC installs only. Installed fleet boxes never re-run disk-installer.

**Manual steps required:** none. Next-NUC install with attempt-8 ISO will boot through to systemd + first-boot service.

**Rollback:** `git revert <SHA>` — no functional change to revert at any installed location.

**Pattern (5th iteration):** v2.54.76 (parted) + v2.54.79 (unsquashfs) + v2.54.80 (grub-install fatal) + v2.54.81 (5 silent-fail sites) + v2.54.84 (missing kernel). Each handoff in the boot path must have a positive existence check. Currently validated: MBR sig (v2.54.80), kernel file (v2.54.84). Next gap-class candidates: initrd-required modules, systemd unit symlinks, network config presence.

`Checkpoint model: opus`

---

### 2026-05-27 — v2.54.81 — disk-installer silent-fail sweep (5 critical sites)

**Risk:** GO — zero runtime impact for installed fleet.

**What changed:** swept `disk-installer.sh` for `|| true` patterns at install-critical steps. Removed silent-fail on 5 sites — partprobe, systemctl enable ssh, dpkg-reconfigure openssh-server, systemd-machine-id-setup, systemctl enable sports-bar-first-boot.service. Each now `exit 1` on failure with a clear error.

**Most important:** `systemctl enable sports-bar-first-boot.service` was silent-fail. If it failed, the installed system would boot cleanly but never clone the app, never start PM2, never serve bartender remote — appears "INSTALLATION COMPLETE!" but produces an empty box. This was likely the next bug we'd hit after v2.54.80 fixed GRUB.

**Where this matters:** new-NUC installs only. Installed fleet boxes never re-run disk-installer.

**Bonus:** `dpkg-reconfigure openssh-server` was silent-fail — meaning if it failed, every fleet install would ship with the SAME SSH host keys baked into the chroot. Fleet-wide MITM risk we'd never have noticed until first network capture. Now fatal.

**Manual steps required:** none. Install pipeline now fails LOUDLY at any disk-touching, bootloader-programming, identity-generating, or boot-service-enabling step.

**Rollback:** `git revert <SHA>` — no functional change to revert at any installed location.

**Pattern (4th iteration this week):** v2.54.76 + v2.54.79 + v2.54.80 + v2.54.81. Disk-installer.sh now systematically loud. Future contributors must NOT add `|| true` to disk/boot/identity steps — only `cleanup()` trap is exempt.

`Checkpoint model: opus`

---

### 2026-05-27 — v2.54.80 — disk-installer GRUB hardening: fatal-fail + MBR signature verify

**Risk:** GO — zero runtime impact for installed fleet.

**What changed:** `scripts/iso/disk-installer.sh` Step 6 (GRUB install) is now fatal on dual-failure + verifies MBR boot signature 0x55AA post-BIOS install. Previously every grub-install call was wrapped in `|| warn` — silent failure mode where the installer said "INSTALLATION COMPLETE!" but the disk MBR was unprogrammed. Caught during VM 200 attempt-6 install: all 7 steps green but post-reboot SeaBIOS hung at "Booting from Hard Disk..."

**Where this matters:** ONLY new-NUC installs from v3.0.1 attempt-7 (or later) ISOs. Installed fleet boxes never run disk-installer again.

**Bonus:** new `scripts/iso/cleanup-chroot.sh` helper — safe replacement for the lazy-umount-then-rm pattern that hollowed Holmgren's /dev on 2026-05-27. Memorialized for future debootstrap chroot workflows.

**Manual steps required:** none for existing locations. Next-NUC install: same 7-step wizard, but Step 6 will now LOUDLY exit on failure instead of silently shipping a broken install.

**Rollback:** `git revert <SHA>` — no functional change to revert at any installed location.

**Pattern:** v2.54.76 (parted) + v2.54.79 (unsquashfs) + v2.54.80 (grub-install) — three ISO bugs of the same class. Disk-installer.sh now LOUD when disk-programming fails. Future audit: grep `disk-installer.sh` for remaining `|| warn` / `|| true` patterns at disk-touching steps.

`Checkpoint model: opus`

---

### 2026-05-27 — v2.54.79 — ISO chroot: add squashfs-tools (disk-installer Step 4/7 fix)

**Risk:** GO — zero runtime impact for installed fleet.

**What changed:** added `squashfs-tools` to the chroot apt install in `scripts/iso/build-sports-bar-iso.sh` so the live-ISO's `disk-installer.sh` can run `unsquashfs` at Step 4/7. Without it, VM 200 install pre-flight hung indefinitely with identical screendumps for 7+ minutes (silent because `disk-installer.sh` swallowed the "command not found").

**Where this matters:** ONLY when a new NUC is being installed from a v3.0.1 ISO. Installed fleet boxes never run disk-installer again (they're already on disk) so this commit is a no-op for them.

**Manual steps required:** none for existing locations. For new-NUC installs: download v3.0.1 attempt-6 ISO (or later) when posted to GitHub Releases. The 7-step wizard now completes Step 4/7 cleanly.

**Rollback:** `git revert <SHA>` — but no functional change to revert at any installed location.

**Pattern:** when `disk-installer.sh` shells out to any binary, that binary MUST be in the chroot install list (v2.54.76 caught parted/mkfs; v2.54.79 catches unsquashfs). Future ISO bugs in the same class: search `disk-installer.sh` for command invocations + cross-check against the chroot apt list.

`Checkpoint model: opus`

---

### 2026-05-18 → 2026-05-27 — v2.49.2 through v2.54.78 — CATCH-UP entry (per-release notes not maintained in this range)

**Risk:** GO — no STOP-grade incidents identified in this range. No location reported an auto-update rollback that required manual intervention beyond what's already captured in CLAUDE.md gotchas.

**Why this is a catch-up entry instead of 60+ individual ones:** the per-release LOCATION_UPDATE_NOTES.md entries were not kept up to date for this range. Full per-release prescriptive details ARE in `docs/VERSION_SETUP_GUIDE.md` (61 substantive entries from v2.54.42 forward). For the gap before v2.54.42 (v2.49.2 → v2.54.41), refer to `git log --oneline main` for the commit-level history; commit subjects follow the same "vX.Y.Z: <one-line summary>" pattern.

**Manually-actionable highlights from the gap** (versions that needed ANYTHING beyond auto-update):
- **v2.54.51** — Virgin installer Part 1 P0: introduces `bootstrap-new-location.sh` + DB migrate path. NEW LOCATIONS only; existing fleet unaffected.
- **v2.54.46** — commercial-lighting 19-route auth+rate-limit codemod. Auth-required for /api/commercial-lighting/** now; no operator action.
- **v2.54.41** — full Turbopack migration (dropped --webpack). Requires `serverExternalPackages` in next.config.js for native modules. Already in place; no operator action.
- **v2.54.38** — HOT FIX restoring webpack externals for native modules (canary fix during the Turbopack switch). No operator action.
- **v2.54.34** — removed next-pwa entirely (closes 5 HIGH vulns). PWA install / "Add to home screen" feature removed; service worker gone. No operator action; bartenders will use browser bookmarks instead.
- **v2.54.30** — zod 3→4 across monorepo. Breaking validation API changes confined to the package itself; no operator action.
- **v2.54.29** — typescript 5.9→6.0. No operator action; type-check passes.
- **v2.54.31** — tailwindcss 3→4. Minimal migration; no operator action.

**Everything else in the range** (~140 commits) is GO with no manual steps: bug fixes, log demotes, dep bumps (Rule 10), doc updates, dead-code removal, agent-batch UI polish.

**Per-release backfill deferred:** writing 140 individual entries from git log is a 2+ hour mechanical task with low marginal value (this catch-up entry covers the auto-update gate need). Can be revisited if a specific version's missing detail bites someone.

`Checkpoint model: opus`

---

### 2026-05-18 — v2.49.1 — chat-route audit BUG#1 fix + Q3 hedge tightening

**What changed:**

1. **Tool result session persistence** (chat-route audit BUG #1): both streaming and non-streaming paths now persist `toolResults` array on the assistant ChatMessage when sessions are loaded. Previously only the text response was saved — multi-turn debugging was blind to prior tool invocations + outputs. Refactored to use a typed `assistantMsg` builder rather than an inline-spread object (the spread approach had a backwards-compat trap and also dodged the typescript-narrow path).

2. **Q3 hedge fix (table extraction)**: added a "Table extraction rule" to the grounding prompt with an explicit CLAUDE.md §4 example showing the Lucky's 1313 row → outputOffset = 0. The prior model behavior was confident hedging ("the value is not explicit") even when retrieval returned the table chunk. Now refuses cleanly when uncertain rather than hallucinating a number.

3. **Template-literal nested-backtick bug** (caught during build): the v2.49.0 prompt addition used markdown inline-code `\`like this\`` inside a JS template-literal which terminated the outer template early and broke compilation. v2.49.1 strips inline-code backticks from prompt text. Lesson logged for future prompt edits.

**Verified live (Holmgren v2.49.1):**
- TX_MODEL question: still answers correctly with single-word response.
- Q3 outputOffset: model now refuses gracefully ("couldn't find any information") rather than fabricating "1" as it did briefly in v2.49.0. This is a llama3.1:8b limitation extracting from markdown tables — deeper fix (per-location-file retrieval boost OR qwen2.5:14b switch OR table-flattening pre-pass) deferred to v2.49.x.
- Build green (29/29 turbo tasks).

**Manual steps required:** none.

**Rollback:** `git revert <SHA>`.

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.49.0 — AI Hub game-changer pass (streaming UI + source cites + sessions + grounding fix)

**What changed (driven by 4-agent deep audit 2026-05-18):**

Massive AI Hub overhaul fixing 5 BROKEN + 3 design concerns identified by the agent audit:

**Backend (`apps/web/src/app/api/chat/route.ts`):**

1. **Source citations in BOTH paths.** Streaming emits new `sources` SSE event with `[{name, score, excerpt}]` after RAG retrieval. Non-streaming returns `sources` + `model` in the JSON response. Closes UX BROKEN-#3 (no source attribution).
2. **Grounding rules moved to absolute END of system prompt** (LLM recency — instruction at the end weights highest). Was previously mid-prompt; now last 30 lines.
3. **Anti-inversion rule** added: docs use "X (NOT Y)" pattern frequently (TX_MODEL not TX_TYPE, GROUP_CHANNEL not GROUP_CHAN, +18 offset NOT raw dB). Explicit example in prompt warns the LLM not to invert. **Verified fix:** TX_MODEL question now answers correctly (previous Q1 in fact-checker was hallucinating TX_TYPE).
4. **Extraction rule** softened: was "I don't see that" on any uncertainty → now "extract what's there and note the gap." Fixes Q3-style evasion (Lucky's outputOffset answer hedged despite being explicit in docs).
5. **Chunk size 1000→600 chars** for context-budget headroom (8 chunks × 1000 + persona + tools + history was approaching llama3.1:8b's 8K context window).
6. **operationLogger regex broadened** from narrow keyword match to "any non-trivial query (≥6 chars)" — fixes audit's "what happened last night?" miss.

**Frontend (`apps/web/src/app/ai-hub/page.tsx`):**

1. **Streaming SSE chat** — replaces `stream: false` with full SSE parser (frame-buffered, progressive token render, blinking cursor). Closes UX BROKEN-#1 (silent hangs).
2. **Session persistence** — sessionId is a UUID stored in localStorage, sent with every request. The chat-route persists messages keyed on this UUID via the `chatSessions` table, so the operator's debugging conversation survives page reloads. Includes a "New Session" button. Closes UX BROKEN-#2.
3. **Source citation UI** — every assistant message has a collapsible `<details>` panel showing the {name, score, excerpt} list of sources used. Click to expand. Closes UX BROKEN-#3 viewer side.
4. **Textarea input** (was single-line `<input>`) with Shift+Enter for newline + Enter for send. Operators can now paste multi-line logs/errors. Closes UX MISSING-OBVIOUS-#10.
5. **Elapsed-time indicator** — "Searching documentation… (4s)" while in-flight. Closes UX MISSING-OBVIOUS-#7.
6. **Model badge** in source panel — shows actual model (`llama3.1:8b`) per message, not the wrong `phi3:mini` from old error text. Closes UX BROKEN-#5.
7. **Status panel** with summary of what RAG has indexed + chunk count visible at idle.

**What could break:** zero — net additive plus a wholesale streaming switchover. Backwards-compatible: non-streaming response still includes `response` field (old shape) PLUS new `sources` + `model` fields.

**Manual steps required:** none beyond auto-update + the standing RAG re-scan from v2.48.x.

**Rollback:** `git revert <SHA>` restores v2.48.5 chat. The `chatSessions` table rows from new sessions stay (no orphan side effects).

**Verified live (Holmgren v2.49.0 smoke test):**
- TX_MODEL question: answered correctly with verbatim quote + source citation `SLX-D_Command_Strings_v2_2020-G.md` at 0.70 relevance (was hallucinating TX_TYPE).
- Streaming SSE parser handles frame buffering, sources event, content tokens, model event, error frame.
- Sessionid UUID generated on first visit + reused on reload.

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.48.5 — schema.ts cleanup: 11 unused tables removed (defs only — DB tables intact)

**What changed:**

Removed 11 unused `sqliteTable(...)` definitions from `packages/database/src/schema.ts` (191 lines deleted). All 11 were verified to have ZERO code references across `apps/web/src` + `packages/` + `scripts/` + `tests/` (the only hits were compiled `dist/` artifacts of the same schema file).

**Removed:** `tvLayouts`, `matrixConfigs`, `audioMessages`, `audioScenes`, `bartenderRemotes`, `deviceMappings`, `trainingDocuments`, `aiTvAvailability`, `aiGamePlanExecutions`, `schedulingPreferences`, `aiScheduleSuggestions`.

**CRITICAL — actual SQLite tables in `production.db` are NOT dropped.** Per Standing Rule 3, DB changes never ride alongside code changes. If a future commit wants to reclaim the disk space, it'd need to be a dedicated migration PR with explicit `DROP TABLE` statements + per-location verification + backup. The tables continue to exist in `/home/ubuntu/sports-bar-data/production.db` — they just can no longer be referenced from TypeScript.

**Why this matters for the AI Hub:** the schema is RAG-indexed (it's THE single source of truth for the data model per CLAUDE.md). Before this cleanup, the AI would see 11 phantom tables and hallucinate about features that don't exist. Now it sees only the live schema.

**Manual steps required:** none.

**Rollback:** `git revert <SHA>` restores all 11 table definitions.

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.48.4 — .npmrc cleanup (removed two pnpm-only options npm doesn't understand)

**What changed:**

Removed two lines from `.npmrc` that were producing the "Unknown project config" warnings on EVERY npm invocation:
- `strict-peer-dependencies=true` (pnpm-only)
- `dedupe=true` (pnpm-only)

The remaining `legacy-peer-deps=false` is sufficient for the "single React instance" goal (npm 7+ installs peer deps automatically and dedupes by default).

**What could break:** zero. These two flags were no-ops in npm.

**Manual steps required:** none.

**Rollback:** `git revert <SHA>` — but no functional change to revert.

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.48.3 — RAG indexes React component source (.tsx) too

**What changed:**

Extended `scripts/scan-code-docs.ts` to also collect:
- `apps/web/src/components/**/*.tsx` (135 component files)
- `apps/web/src/app/**/page.tsx` + `**/layout.tsx` (26 route entry files)

Total ~161 new `.tsx` files indexed = +2,500-3,500 RAG chunks expected (UI-layer code is denser than docs).

**Why:** AI Hub previously couldn't answer UI-layer questions ("where is the bartender remote rendered?", "what component owns the Atlas zone slider?"). Now it can. Closes the last big RAG coverage gap from the v2.48.0 audit.

**Manual steps required (per location):** after auto-update, re-run the code scanner to pick up the new file types:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npx tsx scripts/scan-code-docs.ts
# ~25-40 min on iGPU; adds ~2,500-3,500 chunks
```
Expected after BOTH scans (v2.48.0 doc rescan + v2.48.3 code rescan) complete: total chunks ~7,500-8,500.

**Risk:** zero — additive change to the scanner; doesn't touch any runtime path. Build green (no actual app code changed).

**Rollback:** `git revert <SHA>` — but no functional change to revert. Just edits a script that operators choose to run.

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.48.2 — full-sweep dead-routes pass (13 more, all 3-pass verified)

**What changed:**

Continued from v2.48.1 — instead of trusting the audit agent's 58-route sample, enumerated ALL 378 route.ts files and ran the same 3-pass verifier. Filtered to 18 high-confidence DEAD candidates, then hand-grep verified each: 5 kept (had hits the verifier missed: api/scheduled-commands could be external, api/wolfpack/ai-learning has 2 callers, api/file-system/manage has 42, api/commercial-lighting/{hue,systems}/discover have 15 each). 13 deleted.

**Deleted 13 more verified-dead routes:**
- `api/atlas-processors` (orphaned — active path is `/api/audio-processor/*`)
- `api/enhanced-chat` (predecessor to current /api/chat, replaced in v2.46.3 Option B)
- `api/rag/auto-index` (auto-indexer UI never built)
- `api/streaming-subscriptions`
- `api/generate-script`
- `api/tv-discovery/probe-models`
- `api/tv-discovery/probe-lg-models`
- `api/firestick-scout/can-show`
- `api/ir-devices/model-codes`
- `api/ir-devices/search-codes`
- `api/matrix/outputs-schedule`
- `api/firetv-devices/guide-data`
- `api/dmx/maestro/recall-preset`

**Cumulative dead-route cleanup across v2.48.1 + v2.48.2: 27 routes removed.**

**What could break:** zero — each verified 0 hits across literal `/api/<path>`, distinctive tail token, and full-path substring searches.

**Manual steps required:** none.

**Rollback:** `git revert <SHA>` restores all 13 routes.

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.48.1 — verified 14 truly-dead API routes deleted

**What changed:**

Continued the dead-routes cleanup from v2.48.0 with proper per-route verification (the earlier agent's 155-route list was unreliable — e.g. it claimed `/api/audio-processor/zones` was dead, but it IS called by 3 components). Built a 3-pass verification script: (1) literal `/api/<path>` callers, (2) tail-token search (e.g. `zones-status`), (3) hand-grep of the full path-fragment. Only deleted routes that returned 0 in ALL 3 passes.

**Deleted 14 verified-dead routes:**
- `api/ai-assistant/search-code`
- `api/audio-processor/[id]/adjustment-history`
- `api/audio-processor/[id]/ai-gain-control`
- `api/audio-processor/[id]/ai-monitoring`
- `api/audio-processor/input-levels`
- `api/audio-processor/matrix-routing`
- `api/directv-devices/guide-data`
- `api/directv-logs`
- `api/directv/probe-tuned`
- `api/firestick-scout/tree-dump`
- `api/firetv-devices/connection-status`
- `api/atlas/ai-learning`
- `api/atlas/meter-monitoring`
- `api/documents/reprocess`

**What could break:** zero — every one of these was verified to have zero literal-path callers AND zero distinctive-tail-token references in components, pages, lib, packages, scripts, tests, instrumentation, or scheduler-service. Build green (29/29 turbo tasks).

**Manual steps required:** none.

**Rollback:** `git revert <SHA>` restores all 14 routes.

**Affected files:** 14 route.ts files deleted (and their parent directories if empty).

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.48.0 — system audit cleanup (4 agents) + RAG coverage gap-fill

**What changed (driven by 4 parallel audit agents + 1 RAG-gap agent):**

- **Removed 5 unused npm deps** (~15-20 MB total):
  - `baseline-browser-mapping` (root devDep) — zero references anywhere
  - `vitest` + `@vitest/coverage-v8` + `@vitest/ui` (apps/web) — entire framework installed, never used (project uses Jest)
  - `node-mocks-http` (apps/web) — supertest is used for HTTP test mocking instead
- **Deleted 12 dead bridge files** in `apps/web/src/lib/` (all pure re-exports, 0 callers verified): atlas-ai-analyzer.ts, atlas-ai-training-data.ts, atlasControlService.ts, atlas-http-client.ts, atlas-realtime-meter-service.ts, file-lock.ts, gracenote-service.ts, scheduler-service.ts, spectrum-business-api.ts, sports-guide-ollama-helper.ts, unified-tv-guide-service.ts, wolfpack-ai-training-data.ts
- **Deleted 9 dead one-off scripts** in `scripts/`: cleanup-duplicate-qa, cleanup-planning-qa, create-test-layout, create-test-layout-image, generate-qa-with-claude, insert-critical-rules-qa, regenerate-professional-layout, seed-shure-test-events, test-validation-runtime
- **Extended `scan-system-docs.ts`** to fill RAG coverage gaps. Now also indexes:
  - Build/runtime config files (`next.config.js`, `ecosystem.config.js`, `turbo.json`, `apps/web/drizzle.config.ts`, `apps/web/jest.config.js`)
  - Drizzle migration `.sql` files under `apps/web/drizzle/` — captures schema EVOLUTION not just current state
  - Operator-facing shell scripts (`setup-iris-ollama.sh`, `setup-sdr.sh`, `setup-bartender-nginx.sh`, `bootstrap-new-location.sh`, `auto-update.sh`, `verify-install.sh`, `install.sh`)
  - Supported extensions expanded to `.sql, .sh, .json, .js, .ts` for these targeted picks

**Deferred to follow-up PRs (high risk, agent findings unreliable):**

- **155 "dead" API routes** flagged by the dead-routes agent — sample verification showed `/api/audio-processor/zones` IS called by 3 components (DJControlPanel, AtlasZoneControl, DbxZoneControl). Will tier by risk + verify each cluster.
- **11 dead DB tables** flagged by the data-audit agent (tvLayouts, matrixConfigs, audioMessages, audioScenes, bartenderRemotes, deviceMappings, trainingDocuments, aiTvAvailability, aiGamePlanExecutions, schedulingPreferences, aiScheduleSuggestions) — Standing Rule 3 forbids DB drops in same pass as code.

**Manual steps required (per-location):** after auto-update, re-run the system doc scanner to pick up the new file types:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npx tsx scripts/scan-system-docs.ts --clear
```
Expected: total chunks jumps from ~4,500 to ~5,500+ (config files + drizzle migrations + scripts add ~1,000 chunks).

**What could break:** zero expected runtime impact. Build verified green (35/35 turbo tasks).

**Rollback:** `git revert <SHA>` undoes the deletions. If you want a specific deleted file back: `git checkout HEAD~1 -- apps/web/src/lib/<file>.ts`.

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.47.1 — eslint 9→10 + pdf-parse 1→2 migrations (continued Rule 10 pass)

**What changed:**

- **`pdf-parse` 1.1.1 → 2.4.5** across all workspaces (root, apps/web, utils, tv-docs, rag-server). v2 replaced the v1 default-callable with a `PDFParse` class:
  - v1: `const data = await pdfParse(buffer); data.text / data.numpages`
  - v2: `const p = new PDFParse({ data: buffer }); const r = await p.getText(); r.text / r.total`
  - Migrated call sites: `packages/rag-server/src/doc-processor.ts:131`, `packages/utils/src/text-extractor.ts:30`
  - **v2 `TextResult` no longer exposes `.info`** — only `{ pages, text, total }`. If PDF metadata is needed in the future, call `parser.getMetadata()` separately.
- **`eslint` 9 → 10** (apps/web devDep). Required full migration:
  - Removed `apps/web/.eslintrc.json` + root `.eslintrc.json` (ESLint 10 removed legacy `.eslintrc.*` support entirely per release notes — `feat!: remove eslintrc support`).
  - Added `apps/web/eslint.config.js` (flat config) using `eslint-config-next/core-web-vitals` + `/typescript` + `typescript-eslint.configs.recommended/recommendedTypeChecked`.
  - Removed deprecated `--ext .ts,.tsx,.js,.jsx` flag from `lint` + `lint:fix` scripts (eslint 10 infers extensions from `files` patterns in flat config).

**What could break:**

- **`npm run lint` itself crashes** with `react/display-name: contextOrFilename.getFilename is not a function` — `eslint-config-next@16.2.6` ships a nested `eslint-plugin-react` that's not yet ESLint-10-compatible. **Build, type-check, unit tests, integration tests, and runtime are unaffected** — lint is a developer-only script not gated by any workflow. Tracked upstream; remove this caveat when `eslint-config-next` ships its compat update.
- **PDF ingestion** (RAG document scanning + utils text-extractor) now uses the v2 API. If any custom script imports pdf-parse with the v1 callable pattern, it must be migrated.

**Manual steps required:** none for code; auto-update handles `npm ci` + rebuild + restart.

**Rollback:** `git revert <SHA>` undoes everything. If you want to keep pdf-parse v2 but roll back eslint, revert `apps/web/eslint.config.js`, restore the two `.eslintrc.json` files, and re-pin `eslint@^9` in `apps/web/package.json`.

**Affected files:**
- `package.json` (version)
- `package-lock.json`
- `apps/web/package.json` (eslint ^10, pdf-parse ^2, scripts cleaned)
- `apps/web/eslint.config.js` (NEW — flat config)
- `apps/web/.eslintrc.json` (DELETED)
- `.eslintrc.json` (DELETED)
- `packages/rag-server/src/doc-processor.ts` (pdf-parse v2 migration)
- `packages/rag-server/package.json` (pdf-parse ^2.4.5 — already was)
- `packages/utils/src/text-extractor.ts` (pdf-parse v2 migration)
- `packages/utils/package.json`, `packages/tv-docs/package.json` (pdf-parse ^2)

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.47.0 — breaking-major dep bumps per new Standing Rule 10

**What changed:**

- **`@anthropic-ai/sdk` 0.71.2 → 0.96.0** (breaking-major; only one call site: `packages/services/src/qa-generator-processor.ts:444` uses `anthropic.messages.create()` — stable API, no code change needed).
- **`@types/node` (apps/web devDep) → ^25** (breaking-major in version number only — runtime impact zero; types only).
- **`@types/supertest` (apps/web devDep) → ^7** (breaking-major; test types only).
- **Skipped this pass** (worth their own verification cycle):
  - `eslint` 9 → 10 (rule deprecations may cascade)
  - `pdf-parse` 1.1 → 2.4 (rag-server uses dynamic `pdfParse.default(buffer).text` — needs API verification at major bump)
  - `npm audit fix --force` for the workbox/serialize-javascript chain — `--force` would DOWNGRADE `next-pwa` to 2.0.2 which violates Rule 10's "latest version" mandate. The serialize-javascript vuln is build-time only (no runtime exposure to attacker input), accepted until next-pwa ships a fix on top of workbox 7.

**What could break:** zero expected runtime impact. Build passes. The SDK 0.71→0.96 call surface (`messages.create({ model, max_tokens, temperature, messages })`) is unchanged.

**Manual steps required:** none for code; per-location auto-update handles `npm ci`.

**Rollback:** `git revert <SHA>` undoes the package.json + lockfile changes; rebuild + restart.

**Affected files:**
- `package.json` (version)
- `apps/web/package.json` (@anthropic-ai/sdk + @types/node + @types/supertest bumps)
- `packages/services/package.json` (@anthropic-ai/sdk bump)
- `package-lock.json`

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.46.3 — AI Hub Option B unification (RAG-grounded /api/chat) + tightened grounding + NEW Standing Rule 10 (always-latest)

**What changed:**

1. **AI Hub /api/chat now reads from the RAG vector store** (3,250 chunks across CLAUDE.md + docs/ + packages/*/README.md + .claude/locations/*.md + memory + vendor specs) instead of the separate older `enhanced-document-search`. AI Hub chat is now grounded in the same SME corpus the pattern-digest uses. Adapter `searchDocsViaRag()` falls back to `enhanced-document-search` if RAG is empty (fresh-install safety).
2. **Tightened grounding** based on fact-checker re-grill 2026-05-18 (4/14 PASS originally → expected significant improvement):
   - `topK` 5 → 8 (more concrete excerpts crowd out the LLM's training-set priors)
   - `temperature` 0.7 → 0.3 (lowers paraphrase rate)
   - Default model `phi3:mini` → `llama3.1:8b` (iGPU-accelerated, better grounding fidelity)
   - System prompt now includes CRITICAL rule: "quote verbatim when docs contain specific names/ports/properties; refuse rather than fabricate"
3. **NEW Standing Rule 10 — STRENGTHENED:** every npm dep, OS package, AND local AI model must stay on the latest available version "at any costs." Bump breaking-majors in the working PR + fix the breakage. See CLAUDE.md §"Standing Rules" #10 + `memory/feedback_always_latest_versions.md`.
4. **New `scripts/scan-code-docs.ts`** — adds TypeScript source files (route handlers + lib services + package source + DB schema, ~828 files) to the RAG store so the AI Hub can answer implementation-level questions ("show me the function that polls UDP meters"). Runs alongside `scan-system-docs.ts` (doesn't replace). ~25 min embedding pass on iGPU.

**What could break:**

- **Holmgren / any updated location:** AI Hub chat now uses RAG → if the location hasn't run `scripts/scan-system-docs.ts`, RAG is empty and chat falls back to `enhanced-document-search` (zero-risk, same behavior as before this version).
- **OLLAMA_MODEL env var:** previous default `phi3:mini` is faster but worse-grounded. If a location explicitly relied on phi3 for speed, override via `OLLAMA_MODEL=phi3:mini` in `.env`.

**Manual steps required:**

- Per Rule 10: after this update, run `npm update && npm audit fix` on every location, commit lockfile, push.
- Per Rule 10: re-pull Ollama models (`ollama pull llama3.1:8b nomic-embed-text qwen2.5:14b`) on every location.
- (Optional) Run `npx tsx scripts/scan-code-docs.ts` on every location after the doc-scan to add source-code grounding to the AI Hub.

**Rollback:** `git revert <SHA>` reverts the chat-route changes; RAG store untouched (no schema migration).

**Affected files:**
- `apps/web/src/app/api/chat/route.ts` — new `searchDocsViaRag()` adapter, swapped both call sites, tightened prompt + temp + model
- `scripts/scan-code-docs.ts` — NEW
- `CLAUDE.md` — Standing Rule 10 strengthened
- `memory/feedback_always_latest_versions.md` — NEW

`Checkpoint model: sonnet`

---

### 2026-05-18 — v2.38.0 → v2.45.1 — Shure channel-edit UI + LiveMicChips + SDR foundation + Day-4/5 polish + 7 critical fixes

**Big multi-version push covering Shure operator-edit features, SDR
spectrum monitoring foundation, and a stack of bug fixes caught by
live debugging + code-reviewer agent. Spans 16 commits.**

What changed (in order):

- **v2.38.0** — Per-channel edit UI in `/device-config → Audio →
  Wireless Mics`: rename channel, retune frequency, adjust audio
  gain. PATCH `/api/shure-rf/channel` (ADMIN, HARDWARE bucket).
  PLUS new `LiveMicChips` strip on bartender Audio tab showing
  "Mic 1 Live / Mic 2 Off" + battery as a persistent indicator
  independent of the speech-triggered priority banner.

- **v2.39.0/2.39.1** — Stage 1 AI pattern digest: POST
  `/api/shure-rf/pattern-digest` runs Ollama (llama3.1:8b on iGPU,
  ~40-180s) on the last 30 days of `shure_rf_events`, returns a
  natural-language summary identifying recurring patterns by
  channel/freq/time-of-day/day-of-week with mitigation suggestions.
  ADMIN-gated, AI rate-limit bucket, 1-hour cache. Plus baseline
  RSSI sampling every 10 min so the digest has data even during
  the May-August data-scarce window before preseason.
  v2.39.1 fixed an AUDIO_GAIN wire-protocol offset bug found by
  code review (was sending raw dB; receiver expects raw 0-60 with
  -18 offset).

- **v2.40.0/2.40.1/2.40.2** — Find Clean Freq (software equivalent
  of Shure's front-panel Group Scan, since SLX-D firmware 1.4.7.0
  does NOT expose scan over TCP — probed 16 candidate command
  variants, all returned `< REP ERR >`). Sweeps 12 G58 candidates,
  dwells 2.5s each, ranks by RSSI, drops gain to -18 dB during
  sweep for audio safety. v2.40.1 fixed wire-protocol property
  names (`TX_MODEL` not `TX_TYPE`, `GROUP_CHANNEL` not
  `GROUP_CHAN`) — CLAUDE.md §7a had them backwards, real receiver
  state never populated until v2.40.1. v2.40.2 added
  `/api/atlas-priority`, `/api/atlas-drops`, `/api/shure-rf` routes
  to the bartender nginx allow-list.

- **v2.41.0 — v2.45.1** — SDR spectrum monitoring foundation:
  `apps/web/src/lib/sdr-watcher.ts` spawns `rtl_power` subprocess,
  parses CSV, aggregates per-minute into `sdr_spectrum`, runs
  carrier-detection state machine writing `sdr_carriers`. NEW
  endpoints: `/api/sdr/status`, `/api/sdr/history`, `/api/sdr/stream`
  (Server-Sent Events), `/api/sdr/peak-stats`. NEW UI panel
  `ShureSdrSpectrumPanel` with canvas waterfall, click-on-column
  inspect, SSE live updates. `scripts/setup-sdr.sh` for one-time
  install (apt + DVB blacklist). `SDR_ENABLED=auto` mode means
  plug-and-play after the one-time setup. Cross-confirms with Shure
  RF events (purple "SDR-confirmed" badge on event history rows).
  Hardware (NESDR Smart) in transit; pipeline runs against tables
  whether dongle is present or not. v2.43.1 added SafeBoundary
  isolation for the panel. v2.43.2 fixed a TDZ ReferenceError that
  blew up `/device-config` (TDZ on `loadCachedDigest` referenced in
  useEffect deps before its declaration). v2.45.1 fixed 6 issues
  caught by code-reviewer agent (SSE timer leak, readline zombie,
  backoff race, flushAggregator over-call, status not honoring
  'auto', peak-stats N+1).

- **v2.42.1** — Atlas drop watcher cooldown fix. Holmgren operator
  hit 50 false-positive drop events in 28 min after the Atlas
  firmware update — one real drop (volume 45 → 5 at 10:22) got
  re-fired every 30 sec for 28 min because `lastSeen.set` was at
  the END of the per-zone try block, after an INSERT that could
  throw and skip the cache update. Plus the Atlas 4.5 firmware's
  new "Custom Priority Volume" feature pins zone gain to a fixed
  low level while priority is active — looks identical to the drop
  signature. Fix: per-zone 5-min cooldown + move `lastSeen.set` to
  immediately after the read.

What could break at a location:

- **CRITICAL — nginx allow-list re-run REQUIRED for v2.40.2+**
  features to work on the bartender remote. Run
  `sudo bash scripts/setup-bartender-nginx.sh` once per location
  after auto-update completes. Symptom if skipped: priority banner
  + LiveMicChips + Shure RF events show empty on the iPad even
  though backend is healthy (the polled endpoints return 403).
  Already done at Holmgren but new locations MUST run it.

- **NESDR Smart hardware not yet shipped to any location** — SDR
  pipeline runs idle (`SDR_ENABLED` defaults to `false`). No
  operator-visible effect at locations without a dongle. When
  hardware arrives, run `sudo bash scripts/setup-sdr.sh` for the
  one-time apt+DVB-blacklist install, set `SDR_ENABLED=auto` in
  .env, restart PM2. Watcher then auto-starts within 5 min of
  plugging in.

- **Atlas firmware ≥ 4.5 introduces Custom Priority Volume.**
  Operators who notice unexplained zone-gain drops should check
  the Atlas GUI → Sources → Priority for the new "Custom Volume"
  field on each priority-tagged input. If set low, it overrides
  zone volume during priority events. Our drop watcher's cooldown
  prevents alert spam but the underlying behavior is intentional
  Atlas firmware behavior, not a bug.

Manual steps required:

1. **Bartender nginx re-run** (Holmgren done; other locations TODO
   when they get a Shure receiver):
   ```
   sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-bartender-nginx.sh
   ```
2. **SDR install** (when NESDR Smart arrives):
   ```
   sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-sdr.sh
   pm2 restart sports-bar-tv-controller --update-env
   ```
3. **No DB migrations needed** — all new tables (`sdr_spectrum`,
   `sdr_carriers`, `sdr_rf_pattern_cache`, `shure_rf_events`) are
   lazy-created by their watchers on first run.

Rollback notes: revert to v2.37.2 if any of the above causes
operator-visible failure. The DB tables are additive — no schema
deletion required.

Affected files:
- `apps/web/src/lib/sdr-watcher.ts` (new)
- `apps/web/src/lib/shure-rf-watcher.ts` (cross-confirmation)
- `apps/web/src/lib/atlas-drop-watcher.ts` (cooldown fix)
- `apps/web/src/app/api/shure-rf/{channel,pattern-digest,find-clean-freq}/route.ts`
- `apps/web/src/app/api/sdr/{status,history,stream,peak-stats}/route.ts`
- `apps/web/src/components/{ShureWirelessMicAdmin,ShureSdrSpectrumPanel,LiveMicChips,SafeBoundary}.tsx`
- `packages/shure-slxd/src/shure-slxd-client.ts` (TX_MODEL fix, AUDIO_GAIN offset, setChannelName, setAudioGain)
- `scripts/setup-sdr.sh` (new)
- `scripts/setup-bartender-nginx.sh` (allow-list additions)
- `CLAUDE.md` §7a (corrected) + §7b (new SDR section)

### 2026-05-17 — v2.37.2 — Shure final-review fixes (preflight state race + reconnect race + doc consistency)

**Code fixes from the final-review pass** (4 parallel review agents
on the v2.34.0 → v2.37.1 arc):

- **CRITICAL: `runPreflightForExisting` raced against React state.**
  The "Run Pre-flight" button on each row in the Wireless Mics admin
  called `setForm({ipAddress: rec.ipAddress})` then
  `setTimeout(runPreflight, 0)`. `runPreflight` read `form.ipAddress`
  from its closure, which was still the previous value (or empty) —
  so the probe would target the wrong IP. Refactored to
  `runPreflightAgainst(ip, port)` taking explicit args; per-row button
  now passes `rec.ipAddress` / `rec.tcpPort` directly. No state-race.
- **IMPORTANT: Reconnect path in `shureSlxdClientManager.getClient`
  also had a race window.** If two concurrent callers found the same
  client `!isConnected()`, both called `client.connect()` and created
  duplicate sockets (same shape as the Atlas v2.33.50 bug). Wrapped
  the reconnect `await client.connect()` in the same in-flight
  Promise lock that the create path uses.
- **`evaluateChannel` hysteresis band comment.** The marginal-zone
  fall-through that resets both counters is intentional (hysteresis,
  prevents flapping while interference is real) but the code looked
  like a bug to the reviewer. Added explicit comment.

**Doc fixes from the final-review pass:**

- **VERSION_SETUP_GUIDE v2.34.0 step 4** updated to point at the
  canonical Wireless Mics tab (`/device-config → Audio → Wireless
  Mics`) instead of the legacy `/system-admin → Audio Processors`
  path. Cross-links to `packages/shure-slxd/README.md` for the SME
  briefing.
- **CLAUDE.md §10** (Next.js per-bundle singleton gotcha) now
  references `@sports-bar/shure-slxd` as the second example
  alongside Atlas + notes the v2.37.2 reconnect-path tightening.
- **CLAUDE.md §7a** adds a "Canonical operator home" line pointing
  at `/device-config → Audio → Wireless Mics` + cross-link to the
  package README.
- **packages/shure-slxd/README.md** adds:
  - Explicit "Firmware ≥ 1.1.0 required" under Connection model
  - Rationale for the 1000 ms METER_RATE choice (vs the Bitfocus
    5000 ms baseline) — game-day RF interference detection within ~3s
  - "Related project docs" section linking back to CLAUDE.md §7a,
    VERSION_SETUP_GUIDE, API_REFERENCE, LOCATION_UPDATE_NOTES

**Verified post-fix:**
- `npx tsx scripts/test-shure-parser.ts` — 6/6 scenarios PASS
- Production watcher: clean boot, 8 startup rows in `shure_rf_events`,
  dedicated log file writing
- All 9 monitored endpoints return 200
- Playwright UI audit: 8/8 device-config interactions PASS (Overview
  landing, category switching, sub-tab filtering, iPad viewport, no
  console errors)

**What could break:** nothing — fixes + doc updates only.

**Manual steps required:** none.

**Affected files:**
- Modified: `apps/web/src/components/ShureWirelessMicAdmin.tsx`
  (runPreflightAgainst refactor)
- Modified: `packages/shure-slxd/src/shure-slxd-client-manager.ts`
  (reconnect path in-flight lock)
- Modified: `apps/web/src/lib/shure-rf-watcher.ts` (hysteresis comment)
- Modified: `CLAUDE.md` (§10 cross-reference, §7a canonical home + link)
- Modified: `docs/VERSION_SETUP_GUIDE.md` (v2.34.0 step 4 URL update)
- Modified: `packages/shure-slxd/README.md` (firmware min, METER_RATE
  rationale, Related project docs section)

`Checkpoint model: haiku` — small targeted fixes + doc polish.

---

### 2026-05-17 — v2.37.1 — /device-config: standardized card pattern across all tabs

Every TabsContent in /device-config now starts with the same
`<SectionHeader />` helper instead of copy-pasted Card/CardHeader
blocks. The three tabs that previously skipped the header card
entirely (Sports Channels, Channel Finder, TV Discovery) now have
one too, so the visual rhythm down the page is uniform.

**Net diff:** +278 / −279 lines (no net code growth despite ~120
lines of dedup absorbed by the helpers, because three tabs that had
no header now have ~30 lines each of new headers).

**Two new helpers** (top of `apps/web/src/app/device-config/page.tsx`):
- `<SectionHeader icon iconColor title description aiEnabled? aiDescription? children? />`
  — wraps the title + AI badge + description in a Card. Optional
  children render as CardContent (info boxes, supported-hardware
  lists, etc.).
- `<BartenderRemoteToggle id controlName enabled loading onToggle />`
  — extracted the duplicated DMX + Smart Lighting toggle box (~25
  LOC each). Now one component, two call sites.

**Three tabs got new headers** (previously bare):
- Sports Channels — title + description
- DirecTV Channel Finder — title + description
- TV Discovery — title + description

**Renamed in this pass:** "Commercial Lighting Control" →
"Smart Lighting Control" (matches the tab label since v2.35.0).
"Supported Commercial Lighting Systems" → "Supported Smart Lighting
Systems".

**What could break:**
- Nothing breaks — additive + refactor only. No behavior, no schema,
  no API, no operator-facing copy other than the "Commercial → Smart"
  rename to match the already-renamed tab label.

**Manual steps required:** none.

**Affected files:**
- Modified: `apps/web/src/app/device-config/page.tsx` (SectionHeader +
  BartenderRemoteToggle helpers added; all 14 TabsContent blocks
  refactored to use them)

`Checkpoint model: haiku` — pure cosmetic dedup.

---

### 2026-05-17 — v2.37.0 — /device-config: two-level tab navigation (5 category groups)

**The big change:** 15 tabs in one horizontal row became 5 category
buttons + an active-category sub-tab row. Operator no longer scrolls
horizontally through a 15-wide list — they pick a category first
(Overview / Channels / Video / Audio / Hardware), then see only that
category's sub-tabs.

**Grouping:**
- **Overview** (1) — Overview
- **Channels** (3) — Channel Presets · Sports Channels · Channel Finder
- **Video** (5) — DirecTV · Fire TV · EverPass · TV Discovery · Subscriptions
- **Audio** (2) — Soundtrack · Wireless Mics
- **Hardware** (4) — Global Cache · IR Devices · DMX Lighting · Smart Lighting

Each top-level button shows a small count badge for groups with > 1
sub-tab so the operator knows what's nested. Overview is a single-tab
group, so when selected the second-level row is hidden entirely — the
overview content goes straight under the category buttons.

**Backward-compat:** existing bookmarks like `?tab=directv` still
work. The Tabs `value` is the individual sub-tab ID (unchanged from
v2.36.0); the category buttons are derived from `groupForTab(activeTab)`.
A bookmark to a specific sub-tab opens the right content AND the
right category gets visually selected at the top.

**Adding a new tab in the future** — append the new sub-tab ID to
`TAB_GROUPS.<category>.tabs` in `apps/web/src/app/device-config/page.tsx`,
then add a matching TabsTrigger + TabsContent. The trigger's `value`
MUST match the ID (otherwise the sub-tab row's filter silently hides
it). Adding a brand-new category needs an entry in `TAB_GROUPS` and
its ID appended to `GROUP_ORDER`.

**What could break:**
- Nothing breaks — pure layout restructure on top of the existing
  Tabs state machine. All TabsContent values + IDs are unchanged.
- Visual: the Quick AI Actions card now appears under whatever
  category is active (same as before — appears below the Tabs).

**Manual steps required:** none.

**Verification:**
```bash
# /device-config still renders 200, all sub-tabs reachable
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/device-config
```

**Affected files:**
- Modified: `apps/web/src/app/device-config/page.tsx` (TAB_GROUPS
  constant, GROUP_ORDER, groupForTab helper, two-row tab layout)

`Checkpoint model: haiku` — pure UX, no behavior or schema change.

---

### 2026-05-17 — v2.36.0 — /device-config Overview tab + collapsible Quick Actions

**The big change:** /device-config now lands on a new **Overview** tab
instead of "Channel Presets" (which is a niche feature). Operators
see system status first, configure-stuff second — closer to what
they actually open this page to find out.

**New OverviewPanel content** (auto-refreshes every 10s):
- **Alerts strip** — only renders when there's something to flag. A
  healthy bar shows a single green "All systems normal" pill. Alerts
  include: silent Atlas zone drops, active Atlas priority, RF-induced
  priority events (Shure-Atlas correlation), Shure RF interference,
  Shure low-battery, offline Fire TVs / DirecTV receivers. Each
  alert has a "View" button that warps the operator to the relevant
  tab.
- **Device count grid** — Audio Processors (online/total), Wireless
  Mics (count + interference/battery summary), Fire TV (online/total),
  DirecTV (online/total). Each card clickable → jumps to its tab.
- **Recent Activity** — Atlas zone drops (silent), Atlas priority
  events (with RF-induced highlight), Shure RF interference. Each
  shows count + latest "Xm ago" timestamp + a one-line hint of
  what the row means.
- **Audio Processors detail** — per-processor row with online/offline
  indicator, type tag, IP. Only renders if any are configured.
- **System info footer** — version, uptime, build date.

**Quick AI Actions made collapsible.** Previously the AI quick-action
card was always-expanded at the bottom of /device-config when AI was
enabled — ate 2 screen heights below the active tab content. Now
defaults to collapsed (chevron in header to expand). Operator opens
when they want to run an action, closes when they don't.

**What could break:**
- **Nothing breaks** — additive + the default tab change is muscle-
  memory friendly (the tab they want is still in the list, just no
  longer the default landing).
- **Existing deep-links** to /device-config?tab=channel-presets still
  work because the Tabs component still accepts that value. Operators
  with browser bookmarks land where they expected.

**Manual steps required:** none.

**Verification:**
```bash
# Overview tab loads:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/device-config

# Endpoints the Overview consumes — all should return 200 + a JSON
# payload (even if empty):
for path in /api/audio-processor /api/firetv-devices /api/directv-devices \
           /api/atlas-drops /api/atlas-priority /api/shure-rf /api/system/version; do
  echo "$path $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001$path)"
done
# Expect: each prints "200"
```

**Affected files:**
- New: `apps/web/src/components/device-config/DeviceConfigOverview.tsx` (~390 LOC)
- Modified: `apps/web/src/app/device-config/page.tsx` (added Overview tab as
  default, controlled-tab state for jump-to-tab from alerts, collapsible
  Quick Actions card)

`Checkpoint model: haiku` — additive UX, no schema, no API, no auth surface.

---

### 2026-05-17 — v2.35.0 — /device-config UX cleanup pass

**Critical fix:** TabsList had `gridTemplateColumns: 'repeat(13, ...)'`
hard-coded — when v2.34.2 added the Wireless Mics tab as the 14th, it
broke out of the grid row at 1024px/iPad widths (last tab wrapped off
screen). This is what an operator saw as "backend isn't loading
correctly" on 2026-05-17. Replaced the fixed grid with a horizontally-
scrollable flex layout that adapts to any number of tabs.

**Other UX improvements:**
- **Duplicate tab icons reassigned to unique ones.** Previously `Radio`
  was used 3× (Global Cache, IR Devices, Wireless Mics) and `Lightbulb`
  twice (DMX, Commercial). Now: `Wifi` for Global Cache (it's a
  network gateway), `Zap` for IR Devices (fast IR signals), `Mic2`
  for Wireless Mics (lucide's wireless mic glyph). DMX keeps
  `Lightbulb`, Smart Lighting (renamed from "Commercial") uses `Sun`.
- **Tab label clarity.** "Commercial" → "Smart Lighting" (the original
  label was ambiguous; an operator wouldn't know it controls Lutron/Hue).
- **AI badge extracted to `<AiHintBadge />` helper.** Replaced 9
  copy-paste occurrences of the same `{aiEnhancementsEnabled && <Badge>...</Badge>}`
  pattern. Net delta: ~50 lines of noise removed, every future tab now
  uses one line instead of six.
- **`describe(enabled, fallback, ai)` helper available** for the same
  AI-aware CardDescription pattern that repeats throughout. Not yet
  applied to existing call sites (leave as-is; the helper is in place
  for future tabs).

**What could break:**
- **Nothing breaks** — additive + cosmetic only. Tab IDs unchanged, all
  TabsContent values unchanged, no behavior moved.
- The horizontal scroll on TabsList means at very narrow widths
  (< ~640px) the user scrolls horizontally through tab triggers. This
  is the intended responsive behavior on phones; iPad operators see
  the full row.

**Manual steps required:** none.

**Verification:**
```bash
# Tabs render correctly at the operator viewport (1024px iPad)
curl -s http://localhost:3001/device-config -o /tmp/dc.html
grep -c "TabsTrigger\|tab-trigger" /tmp/dc.html
# Expect: 14 (one per tab — was off-by-one with the old grid)
```

**Affected files:**
- Modified: `apps/web/src/app/device-config/page.tsx` (TabsList
  layout, icon imports, label, `AiHintBadge` extraction, `describe`
  helper)

`Checkpoint model: haiku` — pure UX cleanup, no behavior or schema change.

---

### 2026-05-17 — v2.34.2 — Shure RF watcher bind-fix + dedicated admin tab under Device Config

**Critical fix:** Watcher silently failed to start at every restart since
v2.34.0. Cause: `shure-rf-logger.ts` destructured `logger.info` /
`logger.warn` / etc as `loggerFn` and called it with a lost `this`
binding — `Logger.prototype.info` reads `this.logWithData(...)` and
threw `TypeError: Cannot read properties of undefined (reading
'logWithData')` on the very first `writeEvent`. Caught by surfacing
the previously-swallowed Error via inline `error.message + stack` in
instrumentation.ts (the second-arg-as-LogOptions dropped Error
objects silently). Fixed by switch/case on entry.level calling
`logger.info(msg)` / `logger.warn(msg)` etc directly on the instance.
**Real symptom:** watcher never wrote follow-up events, no metering
ever started, /api/shure-rf returned the startup row only. Locations
that haven't deployed v2.34.0 yet: skip-to v2.34.2 directly.

**New: Dedicated Shure admin tab under /device-config.**
Replaces ad-hoc placement of Shure controls in AudioProcessorManager.
One place for everything Shure:
- Add receiver (with inline preflight)
- List of configured receivers with live status (per-channel battery,
  RSSI quality, frequency, TX type, runtime mins)
- Per-receiver "Run Pre-flight" button — re-tests against the live
  hardware without re-saving
- Edit / Delete actions per receiver
- Event history table (all / active / last-hour filters)
- Docs panel pointing at dedicated log file path + mock-receiver
  command for offline testing
Tab icon: Radio, alongside the existing 14 tabs. AudioProcessorManager
still supports Shure as a backup path (operators who go there can
still add).

**What could break:**
- Nothing — additive. Locations without a Shure receiver see the new
  tab with an empty state ("No Shure SLX-D receivers configured").
- The instrumentation error log was previously silent + cosmetic; the
  fix makes any future error VISIBLE in pm2 logs with full stack trace.

**Manual steps required:** none.

**Verification:**
```bash
# Watcher booted clean post-restart:
pm2 logs sports-bar-tv-controller --lines 50 --nostream \
  | grep -E "Shure RF watcher|SHURE-RF"
# Expect: [INSTRUMENTATION] ✅ Shure RF watcher started
# NOT:    [INSTRUMENTATION] ❌ Failed to start

# Dedicated log file should exist + have a startup line:
ls -lh /home/ubuntu/sports-bar-data/logs/shure-rf-$(date +%Y-%m-%d).log
tail -3 /home/ubuntu/sports-bar-data/logs/shure-rf-$(date +%Y-%m-%d).log

# New admin tab loads:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/device-config
```

**Affected files:**
- Modified: `apps/web/src/lib/shure-rf-logger.ts` (bind-fix in logShureRfEvent)
- Modified: `apps/web/src/lib/shure-rf-watcher.ts` (clearer error logs in catch)
- Modified: `apps/web/src/instrumentation.ts` (inline error.message + stack)
- New: `apps/web/src/components/ShureWirelessMicAdmin.tsx`
- Modified: `apps/web/src/app/device-config/page.tsx` (mount Shure tab)

`Checkpoint model: sonnet` — watcher fix is critical, validate post-restart.

---

### 2026-05-17 — v2.34.1 — Shure SLX-D Phase 2: battery UI + preflight + Atlas correlation + low-battery + mock receiver

**What changed:**
- **Live battery + RSSI tile on bartender Audio tab** (`ShureMicStatusPanel.tsx`).
  Per-receiver card, per-channel row showing channel name, frequency,
  RSSI quality (Excellent/Good/Marginal/Poor color coded), TX type
  (Handheld/Bodypack/Off), battery bars 0-5 with color tier, runtime
  minutes when available, last-seen relative time. Polls
  `/api/shure-rf/status` every 3s. Multi-receiver friendly. Hidden
  entirely when no Shure receiver configured. Renders ABOVE the
  Atlas priority banner.
- **`POST /api/shure-rf/preflight`** — pre-install check endpoint.
  Body `{ip, port}`, returns checklist: tcpReachable, third-party
  controls enabled (inferred from REP-within-2s), firmware ≥ 1.1.0,
  model detected. Catches the #1 install failure (BLOCKED gate)
  before the operator saves the receiver row.
- **Pre-flight UI button in `AudioProcessorManager`** — visible only
  for `processorType='shure-slxd'`. Operator runs the check, gets
  green/red checklist inline, auto-fills the Model field from the
  receiver's MODEL reply.
- **`GET /api/shure-rf/status`** — live per-receiver per-channel
  snapshot from the managed client cache. Powers the battery tile.
- **Atlas ↔ Shure correlation** — `atlas-priority-watcher` now queries
  `shure_rf_events` for a ±30s match before inserting a `mic_active`
  row. If correlated, writes `event_type='rf_induced_mic_active'` +
  note containing receiver/freq/RSSI. Banner copy already gestures
  at this; now the data row proves it. Operator stops chasing ghost
  overrides.
- **Low-battery watcher branch** — rising-edge event when
  `TX_BATT_BARS <= 1` (also fires below; clears when back above).
  Writes `event_type='low_battery'` with minutes-remaining note.
- **Mock SLX-D receiver script** (`scripts/mock-shure-receiver.ts`) —
  developer tool. Scriptable scenarios: `clean`,
  `interference-rising`, `tx-battery-dying`, `coalesced-frames`,
  `partial-frames`, `third-party-controls-disabled`. Per-session
  partial-frame queue (single drain loop) so concurrent send() calls
  can't interleave halves of different frames. Used by the
  integration test below.
- **Integration test** (`scripts/test-shure-parser.ts`) — spawns the
  mock for each scenario, drives the real `@sports-bar/shure-slxd`
  client, verifies the parser/cache/event surface. **6/6 scenarios
  PASS** — parser is verified before any hardware lands.
- **Dependency update** — `npm audit fix` applied. axios 1.15.0 →
  1.16.1 (CVE auth-bypass-via-prototype-pollution fix). Total open
  vulnerabilities: 17 → 13. Remaining 13 require breaking-major
  upgrades (drizzle-kit, next-pwa transitives) — deferred to
  dedicated PRs per new Standing Rule #10.

**What could break at a location:**
- **Locations without a Shure receiver** — battery tile renders
  nothing, preflight endpoint unused, watcher idles. Safe.
- **Locations with the existing Shure receiver added but the network
  not yet ready** — preflight will warn "TCP unreachable". Operator
  can defer enabling. No regression.
- **Atlas priority banner copy CHANGES SLIGHTLY** when an RF event is
  active — adds "(likely RF interference — see below)" suffix. Pure
  cosmetic; no behavior change.

**Manual steps required:**
None. All additive. Existing v2.34.0 setup steps in
`docs/VERSION_SETUP_GUIDE.md` still apply for the Shure receiver
itself — this batch only adds capabilities on top.

**Rollback notes:**
- New files are deletable cleanly. The new `event_type='rf_induced_mic_active'`
  value in `atlas_priority_events` will linger but is harmless —
  /api/atlas-priority filters by event_type in its summary count but
  doesn't choke on unknown values.
- Lockfile dep bumps are safe; rolling back requires `git revert`
  + `npm install`.

**Affected files:**
- New: `apps/web/src/app/api/shure-rf/status/route.ts`
- New: `apps/web/src/app/api/shure-rf/preflight/route.ts`
- New: `apps/web/src/components/ShureMicStatusPanel.tsx`
- New: `scripts/mock-shure-receiver.ts`
- New: `scripts/test-shure-parser.ts`
- Modified: `packages/shure-slxd/src/shure-slxd-client-manager.ts` (added `getSnapshots()`)
- Modified: `apps/web/src/lib/shure-rf-watcher.ts` (low-battery branch)
- Modified: `apps/web/src/lib/atlas-priority-watcher.ts` (Shure correlation)
- Modified: `apps/web/src/components/AtlasZoneControl.tsx` (mount panel)
- Modified: `apps/web/src/components/AudioProcessorManager.tsx` (preflight UI)
- Modified: `package-lock.json` (axios + 3 transitive bumps)
- Modified: `CLAUDE.md` (new Standing Rule #10 — keep deps updated)

`Checkpoint model: sonnet` — touches multiple watcher paths, schema-touching audit logic in priority watcher.

---

### 2026-05-17 — v2.34.0 — Shure SLX-D wireless mic RF interference detection

**What changed:**
- New `@sports-bar/shure-slxd` package: TypeScript TCP client for Shure
  SLX-D wireless mic receivers (port 2202, ASCII line protocol).
  Singleton hoisted to `globalThis` per Gotcha #10. Per-key in-flight
  Promise lock to close the same race window we fixed on Atlas v2.33.52.
- New watcher `apps/web/src/lib/shure-rf-watcher.ts` subscribes to RSSI
  meter pushes at 1 Hz, detects the ghost-carrier signature
  (`TX_TYPE=UNKNOWN` + `RSSI ≥ -85 dBm` for 3 consecutive samples),
  writes to new `shure_rf_events` audit table.
- New dedicated daily-rotating log file at
  `/home/ubuntu/sports-bar-data/logs/shure-rf-YYYY-MM-DD.log` with 30-day
  retention. Operator request to make RF history diffable across game
  days without grepping the entire app log.
- New `GET /api/shure-rf?active=true` endpoint drives a cyan
  "RF Interference Detected" banner on the bartender remote Audio tab.
  Appears ALONGSIDE the existing amber priority banner; when both fire
  simultaneously the priority event is labeled as RF-induced.
- New 'shure-slxd' processor type in Device Config UI (`AudioProcessorManager.tsx`).
- Comprehensive README at `packages/shure-slxd/README.md` documenting
  the full protocol, gotchas, RF coordination SME briefing.

**What could break at a location:**
- **Locations without a Shure SLX-D receiver** — watcher queries
  `audioProcessors WHERE processorType='shure-slxd'`, finds none,
  logs "no shure-slxd receivers configured — watcher idle", no-op.
  Safe. No regression possible.
- **Locations WITH a Shure receiver but VLAN/network not yet routed
  to the controller** — connect attempts will warn-log and trigger
  exponential-backoff reconnect (max 10 attempts before giving up).
  Operator action: route the receiver onto the controller's VLAN
  before adding the processor row in Device Config, or be ready to
  ignore the warn logs until routing is done.
- **First-install gotcha** — Shure receiver's front panel
  `Menu → Advanced → Network → Allow Third-Party Controls → Enable`
  MUST be on, or port 2202 accepts the TCP connection but silently
  drops every command (no error reaches us). Symptom: connection
  succeeds but state cache never populates.

**Manual steps required:**

| Step | Where | Required if |
|---|---|---|
| Route receiver onto controller VLAN | network switch | Adding a Shure receiver |
| Enable "Allow Third-Party Controls" on receiver front panel | Menu → Advanced → Network | Adding a Shure receiver |
| Confirm firmware ≥ 1.1.0 | Settings → About on receiver, OR `GET FW_VER` reply | Adding a Shure receiver |
| Confirm channel names on receiver | Settings → Channel Setup | Optional — operator-set labels surface in bartender banner |
| Add row to `audioProcessors` table via Device Config UI | http://controller:3001/system-admin → Audio Processors | Adding a Shure receiver |

**No manual steps required at locations without a Shure receiver.**

**Rollback notes:**
- New audit table `shure_rf_events` and new package are additive — no
  data lost on rollback. Roll back via `git revert <commit>` then
  `pm2 restart`. Leftover table is harmless.
- Cyan banner only renders when `/api/shure-rf?active=true` returns
  `active: true` — at locations without a Shure receiver the endpoint
  returns `active: false` and the banner never appears.

**Affected files:**
- New: `packages/shure-slxd/` (5 files + README)
- New: `apps/web/src/lib/shure-rf-logger.ts`
- New: `apps/web/src/lib/shure-rf-watcher.ts`
- New: `apps/web/src/app/api/shure-rf/route.ts`
- Modified: `apps/web/src/components/AtlasZoneControl.tsx` (added cyan banner)
- Modified: `apps/web/src/components/AudioProcessorManager.tsx` (added 'shure-slxd' processor type)
- Modified: `apps/web/src/instrumentation.ts` (started watcher)
- Modified: `apps/web/package.json` (added `@sports-bar/shure-slxd` dep)

`Checkpoint model: sonnet` — new package + new daily-rotating log file
warrant deeper-than-Haiku reasoning during Checkpoint B.

---

### 2026-05-17 — v2.33.46 through v2.33.55 — Atlas audio fix train (10 versions)

**Risk:** GO at every location with an Atlas processor. Backwards-compatible.
No schema migrations, no env vars. Two new audit tables auto-create via
`CREATE TABLE IF NOT EXISTS` on first watcher boot.

**What changed (highest impact first):**
- **Stuck-meter root fix** (v2.33.50): cross-bundle singleton via
  `globalThis` Symbol.for() for `atlasClientManager` and `atlasMeterManager`.
  Previously each Next.js route bundle had its own "singleton" → multiple
  UDP sockets bound to 3131 with SO_REUSEPORT → Atlas meter updates lost
  to whichever bundle the kernel hashed packets to. After fix: single TCP,
  single UDP, meters live in both bartender remote audio tab and admin Audio.
- **Stale DB cache fix** (v2.33.48): `audioZones.volume` was never written
  back from live ZoneGain. Slider rendered multi-day-stale values (Bathroom
  cached at 0 while Atlas hardware was at 45%). Drop watcher now syncs DB
  cache to hardware truth every 30s.
- **Slider/button debounce** (v2.33.46): bartender remote's
  `AtlasZoneControl.tsx` was firing 30-46 POSTs/sec during drags (v2.33.45
  fix had touched `AudioZoneControl.tsx`, the admin component).
- **Two new audit tables**: `atlas_drop_events` (zone gain crashes),
  `atlas_priority_events` (mic/page/jukebox activity + source overrides).
  Auto-created via `CREATE TABLE IF NOT EXISTS`. Amber banner appears at
  top of bartender remote audio tab while a priority input is hot.
- **Leak fixes**: TCP leak in `/api/atlas/sources|groups|configuration`
  (`.disconnect()` only in success path); `AtlasMeterManager.unsubscribe`
  refCount leak; `executeAtlasCommand` opening fresh TCP per command (now
  shares singleton); race in `getClient` between concurrent watcher boots
  (per-key in-flight Promise lock).
- **Dead code removal**: `packages/atlas/src/atlas-tcp-client.ts` deleted
  (zero callers, buggy `socket.once('data')`).
- **Priority input recognition**: name regex extended from `/mic/i` to
  `/\b(mic|juke|page|intercom|priority)\b/i` for venues with non-mic
  priority sources (Holmgren: Juke box on input 3).

**What could break at a location:**
- **Locations without an Atlas processor** — watchers iterate
  `audioProcessors WHERE processorType='atlas'`. None present → no-op
  loops, no errors. Safe.
- **Locations with a differently-named priority input** that doesn't
  match `mic|juke|page|intercom|priority` (case-insensitive, word-
  boundaried). Banner won't fire for that input until regex is extended
  at `apps/web/src/lib/atlas-priority-watcher.ts:35`. No regression —
  just doesn't gain the feature for that input.

**Manual steps required:** None.

**Rollback notes:** Revert any of v2.33.46-55 individually if needed —
each commit is independent. The two new tables can be dropped
(`DROP TABLE atlas_drop_events; DROP TABLE atlas_priority_events;`) but
cause no harm if left in place after rollback.

**Affected files:**
- `packages/atlas/src/atlas-client-manager.ts` (singleton + race lock)
- `packages/atlas/src/atlas-meter-manager.ts` (singleton + unsubscribe fix)
- `packages/atlas/src/atlasClient.ts` (intentional-disconnect flag +
  executeAtlasCommand → singleton)
- `packages/atlas/src/atlas-control-service.ts` (terminator fix)
- `packages/atlas/src/atlas-tcp-client.ts` (DELETED)
- `apps/web/src/lib/atlas-tcp-client.ts` (DELETED bridge)
- `apps/web/src/lib/atlas-drop-watcher.ts` (new + DB cache sync)
- `apps/web/src/lib/atlas-priority-watcher.ts` (new)
- `apps/web/src/lib/atlas-commanded-state.ts` (new)
- `apps/web/src/app/api/atlas-drops/route.ts` (new)
- `apps/web/src/app/api/atlas-priority/route.ts` (new)
- `apps/web/src/app/api/atlas/sources/route.ts` (try/finally disconnect)
- `apps/web/src/app/api/atlas/groups/route.ts` (try/finally disconnect)
- `apps/web/src/app/api/atlas/configuration/route.ts` (try/finally disconnect)
- `apps/web/src/app/api/audio-processor/control/route.ts` (matrix_audio
  guard + commanded-source recording)
- `apps/web/src/components/AtlasZoneControl.tsx` (slider/button debounce
  + priority banner)
- `apps/web/src/instrumentation.ts` (watcher startup)

**Checkpoint model:** sonnet — touches Atlas TCP/UDP socket lifecycle,
the bartender's primary audio surface, and adds new DB tables. Haiku's
risk assessment may miss a cross-cutting bundling issue.

---

## Current entries

### 2026-05-08 — v2.32.98 — Scout AccessibilityService for in-app playback automation

**Risk:** GO. Backwards-compatible. Host now sends an extra ADB broadcast (`com.sportsbar.scout.PLAY_GAME`) before each ESPN autoplay; Cubes without the new Scout APK ignore it harmlessly.

**What changed (host-side):**
- New `sendScoutPlayGameBroadcast` helper in `packages/firecube/src/adb-client.ts`
- `streaming-service-manager.ts` calls it right before `launchEspnToLiveContent` for any Watch click that has a search query

**What changed (Scout APK):** Scout v1.5.0 (versionCode 215, versionName 2.1.5-accessibility-automation) gains a new AccessibilityService and a new mailbox receiver. Source committed; APK NOT auto-deployed to Cubes via the auto-update pipeline (APK install is a separate per-Cube manual step).

**To activate the new path on a Cube** (per-Cube one-time, ~30 seconds):
```bash
cd firestick-scout && ./gradlew assembleDebug
adb connect <CUBE_IP>:5555
adb -s <CUBE_IP>:5555 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s <CUBE_IP>:5555 shell settings put secure enabled_accessibility_services com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService
adb -s <CUBE_IP>:5555 shell settings put secure accessibility_enabled 1
```

The `settings put secure` enables the AS programmatically (no manual operator action) — verified on AFTR Fire OS 7.7. Persists across reboots.

**Currently provisioned:** Holmgren Cube 3 (10.11.3.51). Verified live: API → broadcast → in-app click → authoritative confirmation of the matched tile text in mailbox. End-to-end ~17s.

**Other 5 locations:** host code shipped, APK not yet deployed. Bartender Watch button still uses the v2.32.97 text-targeted-tap fallback. Roll out APK to other Cubes when convenient (no urgency — fallback is functional).

**What could break:** Nothing. The PLAY_GAME broadcast is fire-and-forget; if the receiver class doesn't exist (no Scout v1.5.0+ on the Cube), `am broadcast` succeeds with a 0-result and the existing autoplay path runs unchanged. Multiple click-paths could race on a Cube WITH Scout AS, but the second-arriving click is on a non-tile area (PageControllerActivity / PlayerActivity) and is harmless.

**Manual steps required:** None for host. APK install is per-Cube (above) and only unlocks the new path; old path remains the fallback.

**Rollback:** `git revert` on the host commit cleanly removes the broadcast send. Scout APK rollback: `adb install -r firestick-scout-1.4.0.apk` if a known-good older APK exists, or just disable the AS via `settings put secure enabled_accessibility_services ''`.

---

### 2026-05-08 — v2.32.97 — Text-targeted tap + MEDIA_STOP

**Risk:** GO. Better-than-DPAD approach: scan all visible tiles for a content match, tap the matched tile by coordinates. Falls back to clear failure with diagnostic listing visible tiles when no match found.

**What changed:**
- ESPN autoplay no longer presses DPAD_DOWN + CENTER blindly. Dumps UI after search query is typed, scans every <node> with text/content-desc, groups by bounds (ESPN tiles are focusable parent + sibling at same bounds with description), token-matches against intended title, taps the highest-scoring match's bounds center.
- Pre-tune cleanup: KEYCODE_MEDIA_STOP + force-stop at start.

**What could break:** Same as v2.32.96 — when no tile matches, API returns success:false with diagnostic. Now the diagnostic is more useful (lists ALL visible tiles).

**Manual steps required:** None.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.96 — ESPN focused-tile verification gate

**Risk:** GO. Adds a pre-CENTER verification step that refuses to play the wrong game. Worst case for the operator: the API now returns success:false with a clear message instead of silently playing whatever tile was focused.

**What changed:**
- `adb-client.ts` `launchEspnToLiveContent` now does a uiautomator dump after DPAD_DOWN, finds the focused tile's bounds, and reads the accessibility content of any node within those bounds (the focused container is usually empty but a sibling at the same bounds carries the description). Fuzzy-matches tokens against the bartender's intended title.
- Match → fire CENTER (existing behavior).
- Mismatch → throw with explicit message ("wanted X, focused tile would have played Y").
- `streaming-service-manager.ts launchApp` re-throws on error so the API's outer try/catch can surface the message.

**What could break:** When the autoplay's DPAD navigation lands on the wrong screen (sometimes Featured instead of Search), Watch will now report failure instead of silently playing wrong content. That's the desired outcome — operator knows + can navigate manually.

**Manual steps required:** None.

**Rollback:** `git revert` clean.

**Why we can't bypass the DPAD on ESPN:** PlayerActivity is not-exported. Every `sportscenter://` deep link goes through StartupActivity → ESPN's Comrade resolver → home (partner-only). Verified empirically with showEvent/showWatch/showGame/showWatchStream variants. The DPAD-and-verify path IS the public surface.

---

### 2026-05-08 — v2.32.95 — All ESPN/Prime Video programs get per-game deepLinks (v2.32.94 verification gap)

**Risk:** GO. Operator-flagged bug. v2.32.94 fix only covered the walker-injected path; the broadcast_networks fallback and Rail Media streaming paths were missed → 39 of 45 ESPN programs in the bartender guide still had no per-game deepLink → Watch button fell through to ESPN's featured-tile autoplay (PGA quad-view today) for every NCAA / college-baseball / soccer / lacrosse game.

**What changed:**
- `apps/web/src/app/api/channel-guide/route.ts` Rail Media streaming injection now builds a per-program shallow copy with a per-game deepLink. Search query priority: `<awayTeam> <homeTeam>` → `listing.data['event']/['tour']` → `group.group_title`.
- Same path's broadcast_networks fallback fix: switched from `matchedAppInfo.app === 'ESPN'` to `appChannel.appId === 'espn-plus'` (handles ESPN+ broadcasts whose app value is "ESPN+" not "ESPN").

**What could break:** Nothing. Adding deepLinks to programs that previously had none — strictly additive. Old behavior (no deepLink → featured-tile fallback) is impossible to trigger now since every program has a deepLink.

**Manual steps required:** None.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.94 — ESPN search-by-title autoplay (specific games reach playback)

**Risk:** GO. Adds a new autoplay path for ESPN that types the game title into ESPN's in-app search. Backwards-compatible with old catalog rows (no `?q=` → falls back to v2.32.85 featured-tile path).

**What changed:**
- Walker now writes `sportscenter://x-callback-url/showHomeTab?q=<title>` per ESPN tile (was a generic home-tab URL).
- streaming-service-manager extracts `q` and passes to launchEspnToLiveContent.
- adb-client.launchEspnToLiveContent: when contentTitle is provided, runs DPAD_LEFT → DPAD_UP → DPAD_CENTER → `input text` → DPAD_DOWN → DPAD_CENTER. Lands on PlayerActivity for the specific game (verified live: McIlroy Featured Group → PlayerActivity, state=8 BUFFERING).

**What could break:** Nothing structural — the search path is gated on a non-empty contentTitle; old catalog rows without `?q=` use the existing featured-tile path. The next walker run after this update writes the new format for all ESPN tiles automatically.

**Manual steps required:** None.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.93 — Audit follow-ups (Max catalog, firebat in polling, longer adb-connect)

**Risk:** GO. Three small follow-ups to v2.32.92 from the code-reviewer audit. All bounded; all preserve prior defaults.

**What changed:**
- Streaming catalog: new `Max` entry (`id: 'max'`, `packageName: 'com.wbd.stream'`, alias `com.hbo.hbonow`).
- `network-map.ts`: TNT/TBS/truTV/'TNT Sports' → `'Max'` so allocator + conflict-detector match Cubes with Max installed for those broadcast networks.
- `subscription-polling.ts`: `com.amazon.firebat` → `'Amazon Prime Video'` in the device-config UI's subscription-detect map (was silently invisible on AFTR Cubes).
- `subscription-polling.ts`: `adb connect` timeout 8s → 12s to cover sleeping-Cube wake.

**What could break:** Nothing. Catalog gets a new entry (additive); network-map gets new mappings (additive — no existing key changed); subscription-polling map gets a new key (additive); the timeout went up, not down (still bounded, no genuine-hang risk). 10/10 sanity tests confirm regression-free.

**Manual steps required:** None.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.92 — Bug hunt batch (ESPN+ allocator, Paramount+, subscription-polling timeouts)

**Risk:** GO. Seven bug fixes from a multi-agent code audit, all in the same root-cause classes as today's earlier ships. Each is small and additive; together they close several latent silent-failure paths.

**What changed:**
- `packages/scheduler/src/network-map.ts` — NEW shared module with `availableNetworksMatch` for normalizing broadcast names to catalog names before checking `available_networks`.
- `smart-input-allocator.ts` + `conflict-detector.ts` — both import the new helper. Pre-fix any ESPN+ / NBC / CBS / FOX / FS1 game silently excluded every Fire TV from allocation candidates.
- `subscription-polling.ts` — explicit timeouts on `adb connect` (8s) and `pm list packages` (15s); pre-fix could hang 60-120s on unresponsive Cubes.
- `adb-client.ts launchParamountLiveTV` — DPAD_CENTER now passes `timeoutMs=8000` (matching Prime Video / ESPN per v2.32.91).
- `adb-client.ts getDeviceProperty` — accepts optional `timeoutMs` (default 3000 unchanged).
- `firetv-app-sync.ts hasPrimeAlready` — string mismatch fix; was wasting an ADB probe per sync per device.
- `scheduler-service.ts` — bare `catch {}` on tvOutputIds parse now `logger.warn`s the bad value.

**What could break:** Nothing. All changes are bounded — defaults preserved for any caller that doesn't opt in to the new behavior. The allocator/conflict-detector matching becomes more permissive (correctly so), so the only behavior delta is more Fire TVs eligible for ESPN+ games, which is the intended fix.

**Manual steps required:** None.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.91 — Walker walks Prime Video now + sendKey timeout fix

**Risk:** GO. Real operator-visible fix. Two interlocking bugs together meant the Watch button on the bartender remote did nothing for any Prime Video game (because no Prime Video games surfaced in the channel guide in the first place). After fix: walker captures Prime Video tiles end-to-end, /api/streaming/launch returns 200 with autoplay reaching at least Prime Video's search/landing.

**What changed:**
1. `firetv-catalog-walker.ts` — alias-aware matching of `available_networks` entries against `APP_WALK_RULES`. Pre-fix used exact string match; "Amazon Prime Video" never matched the rule keyed "Prime Video". Now resolves via `findStreamingAppByDisplayName` → catalogId → rule. Direct key match still wins.
2. `adb-client.ts` — `sendKey` accepts optional `timeoutMs`; `launchPrimeVideoToContent` + `launchEspnToLiveContent` pass 8000ms on every DPAD event. Pre-fix the 3s default fired mid-sequence while the Cube was rendering SearchResultsActivity / content rows; autoplay aborted; API returned 500.

**What could break:** Nothing. Both changes are additive — old code paths preserved as defaults, new behavior only triggers via opt-in path. Backwards-compatible at every call site.

**Manual steps required:** None. After auto-update merges, the next catalog walk run (cron-driven or manual via `POST /api/firestick-scout/catalog/walk`) will populate Prime Video rows for any Cube that has Prime Video listed in `available_networks`.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.90 — Walker rules: 3 sports apps documented as non-walkable

**Risk:** GO. Doc-only — adds three `APP_WALK_RULES` entries (Hulu, YouTube TV, Fox Sports) all with `usesWebView: true` flag → walker skips with an info log instead of attempting. Same pattern as fuboTV / Apple TV+ / Peacock. Behavior unchanged.

**What changed:** Three new entries in `packages/scheduler/src/firetv-catalog-walker.ts` between the fuboTV entry and the future-entries comment. Each carries a comment with the empirical probe result that determined `usesWebView: true`.

**What could break:** Nothing. Walker behavior is identical (these apps were already not being walked); only the log line shifts from silent skip to "info: <app> is webview-based, skipping" which is easier to see in `pm2 logs`.

**Manual steps required:** None.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.89 — Walker uiautomator dump 10s timeout

**Risk:** GO. Threads an optional `timeoutMs` parameter through the adb-shell stack. Default 3000ms preserved on every existing call site; the walker's `uiautomator dump` is the only one that overrides (10000ms). Capped at 30s so a runaway command can't pin a connection.

**What changed:** `packages/firecube/src/adb-client.ts` `executeShellCommand` accepts a second arg. Send-command POST schema accepts an optional `timeoutMs` (500-30000ms). Walker passes 10s on the dump call only.

**What could break:** Nothing. Default value preserved, optional override.

**Manual steps required:** None.

**Rollback:** `git revert` clean — defaults are back to 3000ms.

---

### 2026-05-08 — v2.32.88 — NFHS title V vs JV distinguishable

**Risk:** GO. Pure UI change in one component. Non-NFHS games unaffected (no other code path sets `sport` on programs in the channel-guide route).

**What changed:** `GameListing` TS interface in `EnhancedChannelGuideBartenderRemote.tsx` gains an optional `sport?: string` field. The title renderer appends ` — ${game.sport}` when present so "Pulaski @ West De Pere — Varsity Girls Soccer" and "Pulaski @ West De Pere — Junior Varsity Girls Soccer" stop colliding visually.

**What could break:** Nothing functional. Title strings get longer for NFHS games; line clamps already exist in the cards.

**Manual steps required:** None.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.87 — Watch button input-label instant update

**Risk:** GO. Pure additive code in `/api/streaming/launch` POST path. The mirror write is wrapped in try/catch and logged as a warning if it fails — won't block the launch response.

**What changed:** After a successful Fire TV app launch, the route now upserts a row in `inputCurrentChannels` with the launched app's friendly name. Previously this only happened on the 5-min `/api/firetv-devices/[id]/current-app` poll, so the bartender remote's input label stayed stale up to 5 min after each Watch click.

**What could break:** Nothing — same write shape as the existing polling endpoint.

**Manual steps required:** None.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.86 — NFHS catalog deepLinkSupport=false

**Risk:** GO. One catalog entry change.

**What changed:** Cleared the broken `nfhs://event/{eventId}` deepLinkFormat (the `com.playon.nfhslive` package registers no external scheme) and set `deepLinkSupport: false` so the launcher-only path is used. NFHS Watch still opens the app; lands on SubscribeActivity until the operator signs in once per Cube.

**What could break:** Nothing — the deeplink wasn't working in the first place.

**Manual steps required:** None at the code level. **Operator action one-time per Cube:** sign into NFHS Network through the TV remote so playback works. No code can bypass NFHS auth.

**Rollback:** `git revert` clean.

---

### 2026-05-08 — v2.32.85 — ESPN autoplay + Schedule deep-link pipe

**Risk:** GO with one ALTER TABLE step (see VERSION_SETUP_GUIDE.md). Same pattern as v2.32.84 (Prime Video) extended to ESPN + scheduled tunes. Verified live on Cube 3.

**What changed:** (1) ESPN catalog scheme corrected `espn://` → `sportscenter://`; new launchEspnToLiveContent autoplay sequence verified to reach `com.espn.video.dmp.PlayerActivity`. (2) Schedule button now stores per-event deep link in `input_source_allocations.deep_link` column; scheduler-service forwards at game-time so streaming tunes autoplay the specific game.

**What could break at a location:** Without the ALTER TABLE, schedule POST will fail with "no such column: deep_link" the moment a bartender hits Schedule. Watch button is unaffected.

**Manual steps required:**
```
sqlite3 /home/ubuntu/sports-bar-data/production.db "ALTER TABLE input_source_allocations ADD COLUMN deep_link TEXT;"
```

**Affected:** 9 files (see VERSION_SETUP_GUIDE.md). Schema, adb-client, walker, streaming-service-manager, channel-presets/tune, bartender-schedule POST, scheduler-service, bartender remote, streaming-apps-database.

**Rollback:** `git revert` clean. The new column is nullable and ignored by older code; safe to leave in place even if reverting.

---

### 2026-05-08 — v2.32.84 — Prime Video Watch button plays the game

**Risk:** GO with one ALTER TABLE step at install (see VERSION_SETUP_GUIDE.md). The fix is additive — non-Prime-Video paths unchanged. Verified live on Cube 3 reaching PlaybackActivity, MediaSession state=3 PLAYING.

**What changed:** Walker captures `deepLink` for every Prime Video tile. Streaming service manager runs a 5-DPAD autoplay sequence for amazon-prime (search → DOWN → CENTER → CENTER) so the bartender lands directly on the game's playback. `getCurrentApp` switched to alias-aware lookup. ADB shell quoting hardened (single-quote escaping for URLs with `&` or `'`).

**What could break at a location:** Bartender Watch button on a Prime Video game now triggers the autoplay nav sequence on the Fire TV Cube. If the operator was relying on the old "opens app, navigate manually" behavior, the new flow will move them past the home screen automatically. Backwards-compatible for non-amazon-prime apps.

**Manual steps required:** One-time per location:
```
sqlite3 /home/ubuntu/sports-bar-data/production.db "ALTER TABLE firetv_streaming_catalog ADD COLUMN startTime INTEGER;"
```
Without this the catalog walker silently fails ingest for any app and the channel guide shows zero streaming games. This is a v2.32.63 schema migration that `drizzle-kit push` skipped on installs that already had the catalog indexes (CLAUDE.md gotcha #6).

**Affected:** `packages/streaming/src/streaming-apps-database.ts`, `packages/scheduler/src/firetv-catalog-walker.ts`, `packages/firecube/src/adb-client.ts`, `apps/web/src/services/streaming-service-manager.ts`, `apps/web/src/app/api/channel-guide/route.ts`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` clean. The `startTime` column ALTER TABLE is non-destructive (additive column, default NULL) and doesn't need to be undone if the code reverts.

---

### 2026-05-08 — v2.32.82 — Drift recovery sidecar (completes v2.32.81)

**Risk:** GO — additive paths only. v2.32.81's drift-recovery code path was never triggered on the normal cron flow (where boxes are on their location branch). v2.32.82 makes drift-recovery actually work when triggered, by adding a heartbeat sidecar at `/home/ubuntu/sports-bar-data/.auto-update-last-success.json` that survives branch switches.

**What changed:** `scripts/auto-update.sh`:
- Drift block at lines 575-621 reads sidecar first, falls back to repo-root copy
- Heartbeat-write code (line ~1361) now copies to sidecar after every successful run
- `refresh_heartbeat_os_only()` (line ~299) keeps sidecar synced on no-op runs

**What could break at a location:** Effectively nothing — sidecar copy is a `cp -f ... 2>/dev/null || true` non-fatal line, and the drift-recovery block remains a no-op except when `BRANCH=main`.

**Manual steps required:** None on the normal path. For boxes currently sitting on main (drift), the sidecar must be seeded once before this fix can recover them. Operator one-liner:
```
git show origin/<your-location-branch>:.auto-update-last-success.json > /home/ubuntu/sports-bar-data/.auto-update-last-success.json
```
Once seeded, the next auto-update run (manual or cron) will detect drift and recover. After that, the sidecar self-maintains.

**Verified live on Holmgren** — drift simulated, recovery completed in 105s, full verify-install 7/7 PASS.

**Affected:** `scripts/auto-update.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` clean — single-file patch on top of v2.32.81.

---

### 2026-05-08 — v2.32.81 — Auto-update branch-drift recovery

**Risk:** GO — defensive guard added to `scripts/auto-update.sh` that fires only when `BRANCH=main`. Normal-path code is unchanged.

**What changed:** New drift-recovery block at lines 559-597 runs immediately after `BRANCH` is detected. When the box is sitting on `main` (an interactive Claude or operator session can leave it there), reads `.auto-update-last-success.json` to find the canonical branch and switches back. Without this guard the cron silently no-ops every night — pre-merge check at the FETCH phase sees "origin/main already merged into HEAD" because origin/main IS HEAD on a main checkout, and the script exits "no update available" — write a pass history row and skip the merge that should have happened.

**What could break at a location:** Effectively nothing for boxes on their location branch (the new code path is bypassed entirely). For boxes that ARE on main, the change moves silent no-op → loud recovery (best case) or loud failure (if recovery itself can't proceed, e.g. local working-tree has unrelated edits). Both are improvements over the prior silent miss.

**Manual steps required:** None. Auto-merges into every location.

**Affected:** `scripts/auto-update.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` clean — single-file patch.

---

### 2026-05-07 — v2.32.70 — Per-codename Intel apt repo (jammy + noble support)

**Risk:** GO — script-only change to `setup-iris-ollama.sh`. Auto-update merges the file; iGPU enablement isn't auto-triggered. Operators re-run the script when they want iGPU at their location. Docs catch-up included covering v2.32.65–v2.32.70 in VERSION_SETUP_GUIDE.md.

**What changed:** `scripts/setup-iris-ollama.sh` reads `lsb_release -cs` and writes the matching Intel apt repo line (jammy or noble). Earlier hardcoded `noble` broke installs at the 3 jammy fleet boxes (graystone/greenville/appleton — libc6 dep mismatch).

**What could break:** Nothing on auto-update — it's a script file. Locations on unsupported codenames (older than jammy, future ones not yet supported) get a warning and fall back to noble.

**Affected:** `scripts/setup-iris-ollama.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` clean.

---

### 2026-05-07 — v2.32.65 through v2.32.69 — iGPU rapid-fire fixes (catch-up)

Six versions, two hours, all targeting the iGPU enablement story. Each one fixed a specific failure mode found during the fleet rollout. All shipped with code changes; doc entries added retroactively in v2.32.70's commit.

| Ver | Fix |
|---|---|
| v2.32.65 | Revert qwen2.5:14b → llama3.1:8b (qwen2 not SYCL-supported); env-overridable |
| v2.32.66 | GPU meter freq fallback (engine busy% always 0 on Iris Xe via i915 perf) |
| v2.32.67 | setup-iris-ollama installs Intel level-zero userspace when missing; modprobe i915/xe if /dev/dri empty |
| v2.32.68 | Broadened Intel chip detection regex (matches `Device a7a0` unnamed PCI entries) |
| v2.32.69 | Group-add before clinfo gate + extended Intel package list (intel-igc-cm/libdrm-intel1/libigdfcl1/libigdgmm12) + reinstall intel-opencl-icd if .so missing |

See VERSION_SETUP_GUIDE.md → v2.32.65–v2.32.70 entry for full per-version detail.

**Rollback:** Each is `git revert`-clean independently.

---

### 2026-05-07 — v2.32.63 — Walker extracts game start times from Fire TV tiles

**Risk:** GO — additive walker change + new nullable schema column. Drizzle-kit push handles it. Existing rows have `startTime=NULL` and behavior is unchanged for them. Any new tile capture (next walker tick, 15 min) populates the column where the regex matches.

**What changed:** `firetv_streaming_catalog.startTime` (nullable INTEGER). Walker extracts time from ESPN bullet tail + Prime Video time suffix. Catalog ingest endpoint accepts the new field. Channel-guide injection prefers walker-extracted time over capturedAt for `gameTime` display.

**What could break:** The Prime Video strip-loop regex was widened to also drop time-suffix tokens; if any historical Prime tile titles contained legitimate trailing time-shaped text in the title (e.g. a show literally named "The 11:11 PM Hour"), it'd be over-stripped. Vanishingly rare; all real sports content is matchup-titled.

**Affected:** `packages/scheduler/src/firetv-catalog-walker.ts`, `packages/database/src/schema.ts`, `apps/web/src/app/api/firestick-scout/catalog/route.ts`, `apps/web/src/app/api/channel-guide/route.ts`.

**Rollback:** `git revert` is clean.

---

### 2026-05-07 — v2.32.62 — Stale in-progress games filtered out

**Risk:** GO — tightened filter logic in two existing query builders. No schema, no data, no migration. Same behavior for in-window upcoming games + actively-airing past-start games (estimated_end still in future); zombie past-end stuck-in-progress rows now correctly excluded.

**What changed:** AI Suggest and channel-guide filters now require `estimated_end > now` (channel-guide allows 6h grace) when including past-start in_progress games.

**Affected:** `apps/web/src/app/api/scheduling/ai-suggest/route.ts`, `apps/web/src/app/api/channel-guide/route.ts`, `package.json`.

**Rollback:** `git revert` is clean.

---

### 2026-05-07 — v2.32.59 — Intel iGPU GPU meter wired via intel_gpu_top

**Risk:** GO — pure additive change to `apps/web/src/app/api/system/metrics/route.ts`. The NVIDIA path is unchanged; Intel is a fallback that activates only when `nvidia-smi` is absent AND `intel_gpu_top` is installed + has `cap_perfmon`. On a location without either, behavior is identical to v2.32.58. `setup-iris-ollama.sh` updated to install + setcap on re-run.

**What changed:** `getGPUMetrics()` extended for Intel; setup script installs `intel-gpu-tools` + grants capability.

**What could break:** Nothing on auto-update — the new code path only fires after the operator runs `setup-iris-ollama.sh` (which installs `intel_gpu_top`). Until then the function throws "GPU metrics not available" and the widget says "No GPU" same as before.

**Affected:** `apps/web/src/app/api/system/metrics/route.ts`, `scripts/setup-iris-ollama.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` is clean.

---

### 2026-05-07 — v2.32.58 — Bartender remote fix bundle (stale guide / deep-link wiring / Shift Brief / WI RSN preset)

**Risk:** GO — four small bartender-remote fixes batched. The auto-update merges files only; no schema, no data, no migration. Two changes need a one-time per-location action AFTER auto-update lands (re-run setup-bartender-nginx.sh; rename WI RSN preset if applicable). See VERSION_SETUP_GUIDE.md v2.32.58 entry for the full per-location table + commands.

**What changed:** `EnhancedChannelGuideBartenderRemote.tsx` (auto-refresh + deepLink wiring), `scripts/setup-bartender-nginx.sh` (/api/ai/ allow-list), `CLAUDE.md` (WI RSN preset-naming clarification), `package.json`, doc entries.

**What could break:** Nothing on auto-update. The Nginx config update doesn't propagate until the operator re-runs `setup-bartender-nginx.sh` — Shift Brief stays 403'd at locations that haven't migrated to Nginx yet (it was 403'd before too, this just keeps things consistent until they migrate). The deep-link Fire TV wiring is a no-op until the catalog walker is upgraded to extract per-event URLs (separate deferred work).

**Affected:** `apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx`, `scripts/setup-bartender-nginx.sh`, `CLAUDE.md`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` is clean.

---

### 2026-05-07 — v2.32.57 — Fleet-standardize bartender proxy (Nginx) + Ollama iGPU acceleration

**Risk:** GO — no app code or schema changes. Two new shell scripts under `scripts/` (`setup-bartender-nginx.sh`, `setup-iris-ollama.sh`) capture the standardized setup that Holmgren has been running on. CLAUDE.md updated to reference them. **The scripts do NOT auto-execute.** Auto-update merges the files; operator decides when to run them.

**What changed:** New scripts. CLAUDE.md updated. `package.json` bump. Doc entries.

**What could break:** Nothing on auto-update — the files just land in `scripts/`. Locations are unaffected until an operator opts in. Holmgren already ran the equivalent manual setup; the scripts are idempotent there and re-running them just verifies.

**Per-location follow-up (operator action, no rush):** Migrate each remaining location at their own pace. Recommended order: lucky-s-1313 → leg-lamp → graystone → greenville → appleton (smallest risk first). Each migration is ~10 min downtime on the bartender proxy + Ollama service. Run during slow hours.

**Affected:** `scripts/setup-bartender-nginx.sh` (new), `scripts/setup-iris-ollama.sh` (new), `CLAUDE.md`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** Scripts unaffect locations until run. If a script fails mid-run, see VERSION_SETUP_GUIDE.md rollback section for the relevant subsystem.

---

### 2026-05-07 — v2.32.56 — Wolf Pack route-state retry backoff (residual TV 1 flicker)

**Risk:** GO — pure retry-tuning in `queryWolfpackRouteState` at `packages/wolfpack/src/wolfpack-matrix-service.ts`. v2.32.55 fixed the toggle-off path; v2.32.56 addresses the residual UI flicker the Holmgren bartender reported afterwards.

**What changed:** Sentinel re-query escalated from a single 600ms attempt to up to 3 attempts at 600ms / 1.2s / 2.4s (cumulative ~4.2s worst case). Loop exits early as soon as the array is sentinel-free. After the last attempt, any remaining sentinel still falls through to the existing 65535→-1 normalization + `MatrixRoute` DB fallback in `/api/matrix/routes`. Non-sentinel paths are unchanged.

**What could break:** A cache-cold `/api/matrix/routes` query against a stuck-firmware Wolf Pack now waits up to 4.2s instead of ~1s. The 30s server-side cache absorbs the cost — only the first query per cache window sees the latency; bartender polls thereafter hit cache. The v2.32.55 `sendHTTPCommand` pre-check uses an independent inline 600ms re-query (not this loop) and is unaffected.

**Affected:** `packages/wolfpack/src/wolfpack-matrix-service.ts`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` is clean.

---

### 2026-05-07 — v2.32.55 — Wolf Pack pre-check 0xFFFF sentinel fix (TV 1 toggle-off bug)

**Risk:** GO — bug fix in `packages/wolfpack/src/wolfpack-matrix-service.ts`. Holmgren-reported symptom: every Video-tab open at the bartender remote silently knocked TV 1 off its route. Diagnosed as the firmware's session-init sentinel (0xFFFF) leaking past the toggle-prevention pre-check in `sendHTTPCommand`. Fix mirrors the settle+requery pattern already in `queryWolfpackRouteState`. No schema, no data, no env, no UI change.

**What changed:** When the pre-check reads `currentRoutes[output0Based] === 65535`, it now waits 600ms and re-queries; if the sentinel persists it refuses to send the toggle command (returns failure for the scheduler to retry next tick) rather than flipping a possibly-correct route OFF. Non-sentinel paths are byte-identical to v2.32.54.

**What could break:** Negligible. Turborepo picks up the package change automatically; PM2 restart on auto-update.

**Affected:** `packages/wolfpack/src/wolfpack-matrix-service.ts`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` is clean.

---

### 2026-05-06 — v2.32.53 — install.sh + ollama-setup.sh simplify pass

**Risk:** GO — install-path-only change; existing locations unaffected. `/simplify` 3-agent pass on v2.32.50-52 found 9 concrete cleanups in `install.sh` (apt-call coalescing, apt-update timeout, sleep removal, PM2-check helper extraction, dead constant, stale comments, canonical-writer hint) plus a model-list drift in `scripts/ollama-setup.sh` (was still pulling `llama3.2:3b` + `phi3:mini` for standalone runs after install.sh was updated). All applied.

**What changed:** Net `+44 / -75` lines across `install.sh` and `scripts/ollama-setup.sh`. Behaviorally identical — same packages installed, same models pulled, same warnings emitted. Just shorter and more consistent.

**Affected:** `install.sh`, `scripts/ollama-setup.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` is safe; pure cleanup commit.

---

### 2026-05-06 — v2.32.52 — Install-doc reconciliation: NEW_LOCATION_SETUP.md is canonical

**Risk:** GO — install-path-only change; existing locations unaffected. Docs-only commit; pure markdown edits to install/deploy guides. Zero runtime impact.

**What changed:** 13 install/deploy docs lived in `docs/`, mostly overlapping and contradicting on which Ollama models to pull. NEW_LOCATION_SETUP.md got a TL;DR-in-8-commands header and a "PASS 7/7" correction (was 6/6, predated v2.18 matrix_config layer). 11 supplementary docs got a top-banner pointer to NEW_LOCATION_SETUP. AUTO_UPDATE_SETUP.md left as-is (canonical for its own thing).

**Why:** Operator bringing a new location online needs ONE authoritative runbook, not 13.

**Affected:** `docs/NEW_LOCATION_SETUP.md`, `docs/INSTALLATION_GUIDE.md`, `docs/QUICK_DEPLOYMENT_GUIDE.md`, `docs/NUC_DEPLOYMENT.md`, `docs/MANUAL_DEPLOYMENT_STEPS.md`, `docs/PULL_AND_INSTALL.md`, `docs/PRODUCTION_DEPLOYMENT.md`, `docs/README_INSTALLATION.md`, `docs/NEW_SYSTEM_DEPLOYMENT_CHECKLIST.md`, `docs/INSTALLER_BUG_ANALYSIS.md`, `docs/AI_BACKEND_SETUP.md`, `docs/OLLAMA_SETUP_COMPLETE.md`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` is harmless.

---

### 2026-05-06 — v2.32.51 — install.sh runs verify-install.sh + clearer Next Steps

**Risk:** GO — install-path-only change; existing locations unaffected. Only changes what `install.sh` does at the end of a fresh-install run; the auto-updater never invokes `install.sh`.

**What changed:** Added PHASE 11 that runs `scripts/verify-install.sh` as the install gate after PM2 is up — same script auto-update.sh uses at Checkpoint C, so the 7-layer pass/fail summary is now visible at install time. Reformatted `print_final_instructions()` to lead with the auth bootstrap as the REQUIRED next step (`scripts/bootstrap-new-location.sh`) instead of burying it under "migrate from existing location" guidance.

**Why now:** Without the auth bootstrap, every login attempt at a fresh install returns "Invalid PIN" and the operator has no obvious signal that bootstrap is the missing piece. Verify-install runs as a non-fatal probe — it surfaces what's missing without blocking the install.

**Affected:** `install.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` is harmless — install-time output only.

---

### 2026-05-06 — v2.32.50 — install.sh PM2 startup fix + correct Ollama models

**Risk:** GO — install-path-only change; existing locations unaffected. None of the 6 fleet locations re-run `install.sh` on auto-update; this only affects future fresh installs on new NUC hardware. The auto-updater never invokes `install.sh`.

**What changed:** `install.sh:setup_pm2()` now runs `pm2 start ecosystem.config.js` (which starts BOTH the next-server and the bartender-proxy together) instead of the previous broken two-call pattern (`pm2 start npm -- start` for the app + `pm2 start "/src/workers/qa-worker.ts" ...` for a worker that no longer exists at that path). Also corrects the Ollama model list from `llama3.2:3b`+`phi3:mini` to `llama3.1:8b`+`nomic-embed-text` to match what production code actually calls. Adds `pm2 install pm2-logrotate` and an `ANTHROPIC_API_KEY` warning.

**Why now:** Audited the install path before bringing a new location online. Three independent bugs would have made the new location fail `verify-install.sh` layer 4 (bartender proxy), 404 on every AI-scheduling call, and accumulate unbounded PM2 logs.

**Affected:** `install.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` is harmless — no existing host runs install.sh.

---

### 2026-05-06 — v2.32.49 — Deterministic checkpoint fast path

**Risk:** GO — additive. New `scripts/checkpoint-deterministic.sh` runs as a 30s-timeout fast path before the existing AI checkpoint runner. Returns one of `GO|CAUTION|STOP|UNDETERMINED`; UNDETERMINED falls through to `checkpoint-runner.py` exactly as before. If the new script is missing, behavior is identical to pre-v2.32.49. Smoke-tested at Holmgren (A/B/C all returned GO).

**What changed:** `scripts/checkpoint-deterministic.sh` (new), `scripts/auto-update.sh:run_checkpoint()` (15-line fast-path block added, existing AI path unchanged).

**Why:** Today's Haiku false-STOP on leaked-key concern (docs-only update) + 4-of-5 fleet rate-limit cascade earlier today made the case for moving the deterministic 80% off the API. Cost target: <$0.50/mo fleet-wide (was ~$5/mo). Speed target: <30s per checkpoint.

**Affected:** `scripts/checkpoint-deterministic.sh` (new), `scripts/auto-update.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` removes the new script and the integration block. AI runs every checkpoint as before. No data risk.

---

### 2026-05-06 — v2.32.48 — Admin gradient-text titles swapped to solid white (iPad Safari fix continued)

**Risk:** GO — three className-only swaps in admin-side components. Continuation of the v2.32.42 homepage fix for iPad Safari rendering `bg-clip-text text-transparent` as fully transparent. Fixes "All Sports Programming" (Sports Guide admin), "AI Game Plan" (modal h2), and "Keyboard Shortcuts" (settings page h1). Bartender-remote files intentionally left alone for separate operator review.

**Affected:** `apps/web/src/components/SportsGuide.tsx`, `apps/web/src/components/AIGamePlanModal.tsx`, `apps/web/src/app/settings/keyboard/page.tsx`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` restores gradients. No data risk.

---

### 2026-05-06 — v2.32.47 — Cron jitter to prevent fleet rate-limit cascade

**Risk:** GO — single-script change to `auto-update.sh` adding a randomized 0-1799s sleep before cron-triggered runs. Manual triggers unchanged. Observed-live problem on 2026-05-06: parallel cron fanout caused 3-of-5 rollbacks via the org-wide 30k tokens/min API limit. Side effect: logs from cron runs are timestamped at actual-work-start (post-jitter), not 02:30.

**What changed:** `scripts/auto-update.sh` jitter block + `RUN_TS`/`LOG_FILE`/`RUN_STARTED_AT` refresh after the sleep so log filenames reflect work-start time. Preflight log line now reports the slept duration.

**Why:** Org rate limit applies across all models (Sonnet/Haiku/Opus combined) — doesn't help to switch model. Spreading the herd is the fix.

**Affected:** `scripts/auto-update.sh`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` returns to the cascade behavior. No data risk.

---

### 2026-05-06 — v2.32.46 — SPORTS_SCHEDULING_SYSTEM_DESIGN.md rewritten to STATUS=SHIPPED

**Risk:** GO — docs only. Final doc in the audit/cleanup pass. The original 3000-line design from 2025-11-14 was forward-looking; Phases 1-3 have been in production since v2.18-v2.20 (DB tables, allocation engine, ESPN sync, auto-reallocator, dashboard UI). 3082 lines reduced to ~75. Zero runtime impact.

**Affected:** `docs/SPORTS_SCHEDULING_SYSTEM_DESIGN.md`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` restores the original design doc. No runtime regression either direction.

---

### 2026-05-06 — v2.32.45 — Scheduler-pattern docs rewritten to STATUS=SHIPPED

**Risk:** GO — docs only. Three-file rewrite under `docs/scheduler-patterns/` to reflect that the team-matcher + priority-calculator + HomeTeam schema work shipped in v2.18-v2.20 but the design docs were never updated. Total ~2200 lines of stale forward-looking design replaced with ~165 lines of accurate STATUS. Zero runtime impact.

**Affected:** `docs/scheduler-patterns/HOME_TEAMS_SCHEDULER_INTEGRATION.md`, `docs/scheduler-patterns/TEAM_NAME_MATCHING_SYSTEM.md`, `docs/scheduler-patterns/TEAM_PRIORITY_SYSTEM.md`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` restores the original long docs. No runtime regression either direction.

---

### 2026-05-06 — v2.32.44 — Channel Resolver Consolidation Plan doc updated

**Risk:** GO — docs only. Single-file rewrite of `docs/CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md` to reflect that the plan has fully shipped (was misleadingly stuck at "No code changes yet"). Zero runtime impact.

**What changed:** Replaced 389-line forward-looking plan with ~70-line STATUS doc. Per-route migration record + verification command + intentional carve-out note for `NETWORK_TO_STREAMING_APP`.

**Affected:** `docs/CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` restores the old plan text. No runtime regression either direction.

---

### 2026-05-06 — v2.32.43 — ESPN college-softball sport slug fix

**Risk:** GO — one-line typo fix in a sport-sync URL builder. No DB changes, no env changes, no API surface change. Failure mode if regressed: same behavior as before the fix (a 400 every 10 minutes for the softball league only). Other ESPN league fetches are unaffected.

**What changed:** `apps/web/src/instrumentation.ts:141` swaps `sport: 'softball'` → `sport: 'baseball'` to match ESPN's URL structure (NCAA Softball lives under `/sports/baseball/college-softball/`).

**Why:** Holmgren post-vacation log inspection found this firing every sync cycle since the lineup was added. Verified live: `sports/baseball/college-softball` returns 200; `sports/softball/college-softball` returns 400.

**Affected:** `apps/web/src/instrumentation.ts`, `package.json`, `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`.

**Rollback:** `git revert` — single-file revert. Log spam returns; no functional regression.

---

### 2026-04-18 — v2.23.5 — Extract memory + versioning guides out of CLAUDE.md

**Risk:** GO — doc reorg only. No code changes. No runtime impact. Each location's next Claude Code session will see the new `docs/CLAUDE_MEMORY_GUIDE.md` and `docs/CLAUDE_VERSIONING_GUIDE.md` referenced in CLAUDE.md's new READ FIRST banner.

**What changed:**
- Two new guide files: `docs/CLAUDE_MEMORY_GUIDE.md` (memory systems, Rules 5 & 7 details) and `docs/CLAUDE_VERSIONING_GUIDE.md` (Rule 8 details, version-bump rules, the 3-doc interlock).
- `CLAUDE.md` adds a "⚠️ READ FIRST" banner at the top requiring both guides as prerequisite reading. Standing Rules 5, 7, 8 in CLAUDE.md trimmed to one-line summaries pointing to the guides. Memory Bank System §6 and Version Bumping sections condensed to one paragraph each + pointer.

**Why this matters:** CLAUDE.md had grown to 1,124 lines with the Standing Rules, Common Gotchas, hardware sections, and UI style guide all inline. The memory and versioning details kept getting bigger with each release. Extracting them into dedicated guides keeps CLAUDE.md scannable while preserving — and clarifying — the rules by giving them room to spell out edge cases.

**Manual step per location (Claude: execute during Checkpoint B):**
1. Verify banner + guide files arrived (see VERSION_SETUP_GUIDE.md §v2.23.5 step 1).
2. Read both new guides fully. They contain the authoritative versions of Rules 5, 7, 8.
3. Sync host auto-memory against the new guide content per Rule 7. If existing memory entries reference "CLAUDE.md §6" by line number, update the pointer to the relevant guide.

**Rollback:** `git revert` cleanly restores the full text to CLAUDE.md and removes the guide files. No data loss.

**Affected:** `CLAUDE.md`, `docs/CLAUDE_MEMORY_GUIDE.md` (new), `docs/CLAUDE_VERSIONING_GUIDE.md` (new), `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

---

### 2026-04-18 — v2.23.3 — Add context7 + brave-search MCP servers project-wide

**Risk:** GO — additive config only. Adds `.mcp.json` at repo root with two MCP servers and sets `enableAllProjectMcpServers: true` in `.claude/settings.json` so the auto-approval bypasses interactive consent at first Claude Code load. No runtime code; no DB impact. MCPs only affect Claude Code sessions at the repo — not the running Sports Bar app.

**What each location gets automatically:**
- **context7** (by Upstash) — live up-to-date library docs for Claude sessions. No API key. Helps with "is this still the current Drizzle API" / "what changed in Next.js 16" questions so the model doesn't guess.
- **brave-search** (by MCP org) — web search. **Needs `BRAVE_API_KEY` in .env per location.** Free-tier key (2,000 queries/month) available at <https://api.search.brave.com/app/keys>. Without the key, Context7 works but Brave Search silently fails.

**Manual step per location (Claude: execute during Checkpoint B):**
1. Verify `.mcp.json` + settings.json flag arrived (see `docs/VERSION_SETUP_GUIDE.md` §v2.23.3 steps 1-2).
2. **Sign up for a free Brave Search API key** (<https://api.search.brave.com/app/keys> — no credit card, 2-minute flow). The key has to be in the SHELL ENV Claude Code launches from, not just in `.env` — see VERSION_SETUP_GUIDE.md §v2.23.3 step 3 for both `~/.bashrc` export and `.env` pattern. Short version:
    ```bash
    echo 'export BRAVE_API_KEY=<paste-key>' >> ~/.bashrc
    echo 'BRAVE_API_KEY=<paste-key>' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
    source ~/.bashrc
    ```
3. Smoke-test both MCPs in a Claude Code session at the repo (see guide §v2.23.3 step 4).

If a location skips step 2, it's not an error — Context7 still works; Brave Search queries from Claude sessions just come back empty at that location.

**Rollback:** Delete `.mcp.json`, remove `enableAllProjectMcpServers` from `.claude/settings.json`. MCPs stop loading. No Sports Bar app impact.

**Affected:** `.mcp.json` (new), `.claude/settings.json` (modified), `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

---

### 2026-04-18 — v2.23.2 — Enable frontend-design + feature-dev Claude Code plugins

**Risk:** GO — additive config only. Adds `.claude/settings.json` with two enabled plugins from the built-in Claude Code official marketplace. No runtime code changes; no DB impact. Plugins only affect Claude Code sessions invoked inside this repo, not the running Sports Bar app.

**What changed:**
- `.claude/settings.json` (new) — `enabledPlugins`: `frontend-design@claude-plugins-official` and `feature-dev@claude-plugins-official`, both `true`. The `claude-plugins-official` marketplace is built into Claude Code — no separate marketplace-add needed.

**What these plugins do:**
- **frontend-design** (Anthropic): design philosophy + system prompts that guide Claude toward distinctive, production-grade UI work (intentional typography, purposeful color, meaningful animation) instead of generic output.
- **feature-dev** (Anthropic): workflow for multi-step feature development — specialized subagents for codebase exploration, architecture, and quality review.

**Manual step per location (Claude: execute during Checkpoint B):**
1. `cat /home/ubuntu/Sports-Bar-TV-Controller/.claude/settings.json` to confirm the file arrived.
2. If a later Claude Code session reports "plugin not found," run interactively once: `/plugin install frontend-design@claude-plugins-official` and `/plugin install feature-dev@claude-plugins-official`, then `/reload-plugins`. See `docs/VERSION_SETUP_GUIDE.md` §v2.23.2 for the full runbook.

**Rollback:** Delete `.claude/settings.json` — plugins become disabled for project sessions. No impact on the Sports Bar app or DB.

**Affected:** `.claude/settings.json` (new), `docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`, `package.json`.

---

### 2026-04-18 — v2.23.0 — AI Suggest diversity + per-location OTA affiliate aliases

**Risk:** CAUTION — requires per-location manual step to populate OTA broadcast affiliates. Without the manual step, games broadcast on ABC/FOX/NBC/CBS (UFL, EPL, some NBA, some UFC) will continue to be filtered out of AI Suggest at locations other than Green Bay/Appleton (which already have WBAY/WLUK-TV/WGBA-TV/WFRV aliased). See `docs/VERSION_SETUP_GUIDE.md` section `v2.23.0` for the exact Claude-executable steps per location.

**What changed (three coherent pieces):**

1. **AI Suggest proposes more games.** The Ollama prompt was capped at 6 suggestions; now `min(totalInputs*2, games.length, 20)` suggestions. Rules rewritten to encourage league diversity and alternate routes (e.g. Brewers game on both cable ch 308 AND on firetv Apple TV+ so the manager can pick). Parser dedup allows up to 2 alternatives per input and 2 per game, rejecting only exact game+input duplicates. Learning loop unchanged — `pattern-analyzer.ts` still reads approved allocations hourly and builds team-routing patterns from manager choices.

2. **`seedStationAliases()` is now a merge, not a skip.** Previously "if station_aliases has any rows, don't touch it" — which meant adding new entries to `STANDARD_ALIASES` in later releases was a no-op at every existing location. Now it per-row upserts: for known rows it unions new aliases with existing (preserving any location-edited aliases); for new rows it inserts. Future universal alias additions propagate automatically.

3. **Per-location OTA affiliate aliases moved out of the shared seed.** `STANDARD_ALIASES` had ABC→WBAY, FOX→WLUK, NBC→WGBA, CBS→WFRV hardcoded — correct for Green Bay, wrong for every other city. Removed. New `seedLocalStationAliases()` reads `apps/web/data/station-aliases-local.json`, which is an empty template on main and populated per-location on each `location/<name>` branch. Also added 9 universal streaming app aliases (PrimeVideo, AppleTVPlus, ParamountPlus, Peacock, ESPNPlus, Netflix, Max, YouTubeTV, Hulu) which ARE the same everywhere.

**What could break:**
- **Green Bay/Appleton locations** already had the old hardcoded aliases in the DB, so those rows remain (merge doesn't delete). Nothing breaks. The merge ADDS streaming app aliases. UFL/EPL/NBA on ABC/FOX will now resolve correctly.
- **Madison (Lucky's), Milwaukee, or any other city**: after merging v2.23.0, the DB will NOT yet have the location's correct ABC/FOX/NBC/CBS aliases — because those were never seeded. Claude at each location MUST execute Step 3-5 of the VERSION_SETUP_GUIDE.md v2.23.0 section BEFORE the build step, populating `station-aliases-local.json` AND patching the live DB.
- Commit the populated JSON to the location branch (not main). Main keeps the empty template.

**Manual step per location (Claude: execute during Checkpoint B):**
1. `grep LOCATION_NAME /home/ubuntu/Sports-Bar-TV-Controller/.env` to identify this location.
2. Determine OTA callsigns for this city (use `docs/VERSION_SETUP_GUIDE.md` reference table; web search for cities not listed).
3. Write `apps/web/data/station-aliases-local.json` populated with this location's 4 OTA affiliates.
4. Run the SQL in VERSION_SETUP_GUIDE.md §v2.23.0 Step 4 to patch the live DB.
5. Commit the JSON to the location branch — do NOT push to main.

The detailed Claude-executable steps (with exact SQL templates, callsign reference table, and verification curl command) are in `docs/VERSION_SETUP_GUIDE.md` under `### v2.23.0`. Auto-update's Checkpoint B must perform this population before the build runs, or the fix silently no-ops at that location.

**Rollback:** The upsert change is additive (union-merge never deletes aliases). Git revert is safe — DB rows stay, AI Suggest prompt reverts to the 6-cap. The populated `station-aliases-local.json` stays on the location branch as a valid template for future use.

**Affected:** `apps/web/src/app/api/scheduling/ai-suggest/route.ts`, `apps/web/src/lib/seed-from-json.ts`, `apps/web/data/station-aliases-local.json` (new), `docs/VERSION_SETUP_GUIDE.md`, `package.json`.

---

### 2026-04-18 — v2.22.12 — per-league duration learning from actual-vs-scheduled

**Risk:** GO — additive pattern type. No schema change; uses existing `scheduling_patterns` table.

`input_source_allocations` has been storing `allocated_at`, `expected_free_at`, and `actually_freed_at` since v2.19.0, but `pattern-analyzer.ts` never aggregated the duration data. Raw signal was sitting in the DB unused.

New `analyzeLeagueDurationPatterns()` reads every completed allocation and computes per league: sample count, avg scheduled vs actual duration, P50 + P90 actual, avg + P90 overrun, and a recommended buffer = ceil(P90 overrun / 5) * 5 min. Writes `pattern_type='league_duration'` rows to `scheduling_patterns`.

AI Suggest's Ollama prompt now includes `Learned league durations: mlb: ~209 min actual (+29 min over scheduled, n=1; buffer 30 min for P90 overrun)`, so future slot planning buffers high-overrun leagues correctly while on-time leagues get no buffer. Learning is per-venue from that venue's own completed allocations.

**Affected:** `packages/scheduler/src/pattern-analyzer.ts`, `packages/scheduler/src/scheduler-service.ts`, `apps/web/src/app/api/scheduling/ai-suggest/route.ts`, `package.json`.

---

### 2026-04-17 — v2.22.11 — matrix single-card check is opt-in via env

**Risk:** GO — fixes false-positive verify failure on multi-card WP-36X36 locations (Graystone). Single-card locations (Lucky's, Leg Lamp) now declare themselves via `MATRIX_SINGLE_CARD=true` in .env, which activates the strict offset=0 check. Multi-card (default) accepts any offset.

**Manual step per single-card location:** add `MATRIX_SINGLE_CARD=true` to `.env`. Already done at Lucky's and Leg Lamp during rollout.

**Affected:** `scripts/verify-install.sh`, `CLAUDE.md`, `package.json`.

---

### 2026-04-17 — v2.22.10 — wrap drizzle-kit push in PTY for data-loss prompts

**Risk:** GO — small fix to schema_push.

v2.22.8's `yes | drizzle-kit push` didn't work because drizzle-kit's `prompts` package bails with "Interactive prompts require a TTY terminal" the moment it detects stdin isn't a tty, before reading any characters. Same bug class as the Claude CLI TTY regression — needs a real pty. Fix: wrap in `script -qfc "yes | ... drizzle-kit push" /dev/null`. The `yes` inside the script'd shell pre-stages "y\n" answers and the pty satisfies the tty check.

Still affects Graystone (3 rows in N8nWebhookLog that v2.20.0's schema removed).

**Affected:** `scripts/auto-update.sh`, `package.json`.

---

### 2026-04-17 — v2.22.9 — orchestration scripts take main's version + longer checkpoint timeouts

**Risk:** GO — fixes two remaining blockers.

1. `scripts/auto-update.sh`, `scripts/rollback.sh`, `scripts/verify-install.sh`, `scripts/ensure-schema.sh`, `scripts/ensure-ollama-model.sh`, and the three `checkpoint-*.txt` prompts now live in `LOCATION_PATHS_THEIRS` — any merge conflict on these takes main's version. Lucky's had divergent edits to `auto-update.sh` from an earlier manual tweak, which aborted the merge at step `merge`. These are pure software and locations should never carry divergent versions.
2. Checkpoint B and C timeouts bumped 180s → 300s. The memory-sync additions in Checkpoint C and accumulated context in Checkpoint B were making Claude run past 3 min on lower-spec hosts (Graystone). `script -qfc` killed the subprocess at the outer timeout and rolled back.

**Affected:** `scripts/auto-update.sh`, `package.json`.

---

### 2026-04-17 — v2.22.8 — pipe `yes` to drizzle-kit push for data-loss prompts

**Risk:** GO — unblocks locations with data in tables the schema has since removed (v2.20.0 removed N8nWebhookLog + N8nWorkflowConfig). drizzle-kit push was hitting a confirmation prompt for data-loss statements and erroring with "Interactive prompts require a TTY terminal" — indistinguishable in the log from the Claude CLI TTY error that v2.22.4/7 fixed. Fix: `yes | npx drizzle-kit push` so the auto-approved schema change from Checkpoint A proceeds. Data loss is intentional: the table was already removed on main.

**Affected:** `scripts/auto-update.sh` (schema_push step), `package.json`.

---

### 2026-04-17 — v2.22.7 — resolve claude to absolute path inside script -qfc

**Risk:** GO — critical followup to v2.22.4. `script -qfc` invokes via `sh -c` which lacks `~/.local/bin` on PATH, so v2.22.4's pty wrapper couldn't find `claude`. Now we call `command -v claude` first and pass the absolute path into `script`. Without this fix, every location still rolls back at Checkpoint B even though v2.22.4 landed.

**Affected:** `scripts/auto-update.sh` (run_checkpoint function), `package.json`.

---

### 2026-04-17 — v2.22.6 — checkpoint C enforces CLAUDE.md + memory sync post-update

**Risk:** GO — prompt-only change to `scripts/prompts/checkpoint-c.txt`. No code, no schema, no deps.

Every successful auto-update now forces the post-restart Claude to re-read `CLAUDE.md` in full, sync it against this host's `memory/MEMORY.md`, and scan `docs/VERSION_SETUP_GUIDE.md`'s "Known Errors & Fixes" for any unapplied fixes — before deciding GO/CAUTION. This enforces CLAUDE.md Rule 7 at a predictable moment so each location's memory stays near-duplicate with CLAUDE.md across the fleet. Two rounds of doc backfill (the v2.22.2-5 entries and the "Known Errors & Fixes" entries for the Claude-CLI-TTY and Tailwind-lockfile issues we debugged today) are part of the same push so the updated Checkpoint C has something to catch.

**Required Manual Step:** None. Runs automatically at the tail of every auto-update.

**Affected:** `scripts/prompts/checkpoint-c.txt`, `docs/VERSION_SETUP_GUIDE.md`, `package.json`.

---

### 2026-04-17 — v2.22.5 — shift brief: real game times + anti-hallucination

**Risk:** GO — pure fix to an LLM prompt. No schema, no deps.

Ollama was fabricating times in the shift brief (e.g. "Brewers at 9pm" for a game that started at 6:10pm) because active-allocation prompt entries had no time field. Fix adds `startLocal` + `status` to the context and a CRITICAL guardrail forbidding invented times. Fallback brief also shows "started <time>". See `docs/VERSION_SETUP_GUIDE.md` v2.22.5 for verification commands.

**Affected:** `apps/web/src/app/api/ai/shift-brief/route.ts`, `package.json`.

---

### 2026-04-17 — v2.22.4 — wrap claude -p in pseudo-TTY

**Risk:** GO — critical fix; every location's auto-update was rolling back at Checkpoint B once Claude CLI reached 2.1.113+.

Claude Code CLI 2.1.113+ errors with "Interactive prompts require a TTY terminal" when invoked non-interactively. `scripts/auto-update.sh` now wraps the claude call in `script -qfc "..." /dev/null` to provide a pty. Self-update re-exec means every location picks up the fix starting with the run that merges it. See `docs/VERSION_SETUP_GUIDE.md` v2.22.4 for verification.

**Affected:** `scripts/auto-update.sh`, `package.json`.

---

### 2026-04-17 — v2.22.3 — revert to Tailwind 3 (v2.17.0 migration was incomplete)

**Risk:** GO — restores the last known-good CSS pipeline. Fixes build break that no location could recover from.

**What's in this release:**

The Tailwind 3→4 migration in commit `5209838a` (v2.17.0) was never actually completed. The commit claimed "migrated via `npx @tailwindcss/upgrade`" but:

- `apps/web/src/app/globals.css` still uses Tailwind 3 syntax (`@tailwind base/components/utilities;`) instead of Tailwind 4's `@import 'tailwindcss';`.
- `apps/web/tailwind.config.js` was deleted without adding a `@theme` block to globals.css to replace it.
- `apps/web/postcss.config.js` still lists `tailwindcss` and `autoprefixer` as plugins (Tailwind 4 consolidates both into `@tailwindcss/postcss`).
- `apps/web/package.json` dep mix was internally inconsistent.

Result: `npm ci` failed on every location's auto-update starting with v2.17.0, then when v2.22.2's hotfix let `npm ci` through, the build failed with `Cannot find module 'autoprefixer'`, then `Cannot apply unknown utility class text-slate-100` once postcss.config was fixed.

This release reverts all Tailwind 4 changes back to the working Tailwind 3 state. Other v2.17.0 bumps (lucide-react 0→1, eslint 9→10, sqlite3 removal) are KEPT.

Verified: `npm ci && npx turbo run build --force --filter=@sports-bar/web` compiles successfully in 38s on Stoneyard.

**What could break at a location:** Nothing. Restores the CSS pipeline every location was running before v2.17.0.

**Manual steps required:** None.

**Affected files:**
- `apps/web/tailwind.config.js` (restored)
- `apps/web/postcss.config.js` (reverted)
- `apps/web/package.json` (reverted tailwind/autoprefixer deps)
- `package-lock.json` (regenerated)
- `package.json` (version 2.22.2 → 2.22.3)

---

### 2026-04-17 — v2.22.2 — fix Tailwind 4 lockfile drift + add npm-ci fallback

**Risk:** GO — fixes a hard break on all locations that would otherwise roll back every auto-update run.

**What's in this release:**

1. **`apps/web/package.json`** — bumped `tailwindcss: ^3.4.18` → `^4.2.2`. Commit `5209838a` (v2.17.0) had migrated the root lockfile to Tailwind 4.2.2 and added `@tailwindcss/postcss: ^4.2.2`, but forgot to bump the `tailwindcss` dep in the same workspace file. `npm ci` caught the mismatch and failed on every location's auto-update starting with v2.17.0, triggering an immediate rollback at the `npm_ci` step.

2. **`scripts/auto-update.sh` + `scripts/rollback.sh`** — added a fail-safe: if `npm ci` exits with EUSAGE ("lockfile out of sync"), fall back to `npm install` which regenerates the lock in-place on the location. Rebuilt lock is NOT committed back to git — the root cause still has to be fixed on main — but this prevents a single missed lockfile regen on main from stranding the entire fleet.

3. **`package-lock.json`** regenerated to include all of Tailwind 4.2.2's transitive deps (arg, chokidar, didyoumean, dlv, fast-glob, jiti, lilconfig, postcss-nested, sucrase, etc.).

**What could break at a location:** Nothing. This update is what was supposed to be in v2.17.0. Every location that attempted an auto-update between v2.17.0 and v2.22.1 rolled back cleanly (no state damage), they just stayed on their pre-v2.17.0 commit. This release finally gets them unstuck.

**Manual steps required:** None.

**Rollback notes:** If this ends up mispulling, the rollback path is: `git revert HEAD` on main + regenerate lock with `npm install --package-lock-only`. The npm-ci fail-safe is designed to be strictly additive, so it can be removed without behavioral change on the happy path.

**Affected files:**
- `apps/web/package.json` (tailwindcss 3 → 4)
- `package-lock.json` (regenerated)
- `scripts/auto-update.sh` (npm_ci fail-safe)
- `scripts/rollback.sh` (npm_ci fail-safe)
- `package.json` (version 2.22.1 → 2.22.2)

---

### 2026-04-17 — v2.16.3 — auto-pull Ollama llama3.1:8b during update

**Risk:** GO — additive step in auto-update.sh. Non-fatal if ollama isn't reachable.

**What's in this release:**

- New `scripts/ensure-ollama-model.sh` — idempotent helper that checks if `llama3.1:8b` is installed in the local Ollama daemon, and pulls it if missing. Exits 0 when the model is present (no-op on subsequent runs).
- `scripts/auto-update.sh` calls the helper between `schema_push` and `checkpoint_b` as a new `ollama_model` step. Non-fatal: if ollama is down or the pull fails, the update continues and just logs a WARNING — AI Suggest will be degraded until resolved, but the rest of the app works.

**What could break at a location:**

- First run at each location downloads ~4.7GB from `registry.ollama.ai`. Expect the auto-update duration to jump from ~4 min to ~8-10 min on the first run that includes this change. Subsequent runs are instant no-ops.
- If the location runs Ollama with a different model configured and intentionally doesn't have `llama3.1:8b`, this will still pull it (no harm, just disk usage). The app's `hardware-config.ts` hardcodes `llama3.1:8b` as the AI Suggest model, so this matches production code.
- If the location has no Ollama daemon running at all, the helper exits 1 with a WARNING and the update proceeds. AI Suggest will continue to fail until ollama is installed. This is a soft fail by design.

**Manual steps required:** None. The auto-update handles it.

**Rollback notes:** The new step is strictly additive. Rolling back the code change removes the step; any already-pulled model stays on disk (harmless).

**Affected files:**
- `scripts/ensure-ollama-model.sh` (new)
- `scripts/auto-update.sh` (added `ollama_model` step)
- `package.json` (version 2.16.2 → 2.16.3)

---

### 2026-04-15 — v2.8.4 — LG TV model probe + TV power audit trail + LG clientKey fix

**Risk:** GO — additive features plus one latent-bug fix. No schema change.

**What's in this release:**

1. **LG TV model probe** (`apps/web/src/lib/lg-model-probe.ts` — new file)
   - Mirror of `samsung-model-probe.ts`: walks every `NetworkTVDevice`
     where `brand='lg'`, queries SSAP `ssap://system/getSystemInfo`
     via port 3001 WebSocket using the stored `clientKey`, and
     updates the `model` column with the real modelName (e.g.
     `"65UT8000AUA.BUSYLKR"`). Unreachable/unpaired TVs are skipped;
     previously-set model is never cleared.
   - Wired into `instrumentation.ts` alongside Samsung probe. Runs
     60s after boot, then every 4 hours. Staggered 15s behind Samsung
     to avoid DB write contention.
   - Manual trigger: `POST /api/tv-discovery/probe-lg-models`
     (parallels `/api/tv-discovery/probe-models` for Samsung).
   - **Requires first-run pairing.** Each LG TV must accept a pairing
     dialog once to populate `clientKey`. Greenville's 19 LG TVs all
     have keys stored already — verified. Locations adding new LG
     TVs need to pair them via the bulk-power `on` command or the
     single-TV power endpoint before the probe can read their model.

2. **TV power audit trail** (reuses existing `AuditLog` table — no
   schema change)
   - `POST /api/tv-control/bulk-power` now writes one `AuditLog` row
     per call with `action='TV_POWER_BULK_ON|OFF|TOGGLE'`,
     `resource='tv_power'`, and `metadata` JSON containing the full
     per-device result list (success/fail, brand, IP, message,
     powerVerified). Fires on both success and error paths. Audit
     write is fire-and-forget — it never blocks the response or
     causes the power command to fail.
   - `POST /api/tv-control/[deviceId]/power` same treatment with
     `action='TV_POWER_ON|OFF|TOGGLE'`.
   - New query endpoint: `GET /api/tv-control/audit?hours=24&action=off`
     returns TV power events for the last N hours (max 30 days),
     filterable by action family. Rows include parsed metadata for
     easy "what time did the bartender turn off all the TVs last
     night" lookups.
   - Retention uses `cleanupOldAuditLogs()` from `@sports-bar/auth`
     which already runs with `AUDIT_LOG_RETENTION_DAYS=90`.

3. **LG clientKey latent bug fix** (silent, but real)
   - Both `/api/tv-control/bulk-power/route.ts` and
     `/api/tv-control/[deviceId]/power/route.ts` were constructing
     `LGTVClient` without passing `device.clientKey`. This made
     every LG power command fall back to PROMPT pairing, which
     hangs waiting for a TV-side user approval that never comes in
     automated contexts — commands appeared to "silently fail"
     without a clear error. Now the clientKey is passed through
     correctly. If any location has LG TVs where bulk power-off has
     been unreliable, this is the fix.

**Why this matters:**

- Next time someone asks "what time did the bartender turn off all
  the TVs last night?", it's answerable via a single API call —
  the data survives PM2 log rotation indefinitely.
- LG TV catalog at Greenville (and any LG-heavy location) will stop
  showing generic "LG WebOS" and will show real model strings,
  matching how Samsung locations already work.
- LG power commands that have been unreliable since the client was
  introduced will start working as intended.

**Manual steps required:** none. Existing LG rows already have
`clientKey` set from previous pairing; probe will run automatically
on next startup.

**Verification after update:**

```bash
# 1. Wait ~90 seconds after PM2 restart, then check LG probe ran:
pm2 logs sports-bar-tv-controller --nostream --lines 100 | \
  grep "LG PROBE"
# Expected: "[INSTRUMENTATION][LG PROBE] probed=N, updated=N, unreachable=0"

# 2. Check real model strings landed:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, ipAddress, model FROM NetworkTVDevice WHERE brand='lg';"
# Expected: model column shows real strings like "65UT8000AUA.BUSYLKR"

# 3. Smoke-test the audit trail query (after a bulk-power command fires):
curl -s 'http://localhost:3001/api/tv-control/audit?hours=24' | \
  head -c 2000
# Expected: JSON with events array
```

**Affected files:**

- `apps/web/src/lib/lg-model-probe.ts` (new)
- `apps/web/src/app/api/tv-discovery/probe-lg-models/route.ts` (new)
- `apps/web/src/app/api/tv-control/audit/route.ts` (new)
- `apps/web/src/instrumentation.ts`
- `apps/web/src/app/api/tv-control/bulk-power/route.ts`
- `apps/web/src/app/api/tv-control/[deviceId]/power/route.ts`
- `package.json`
- `docs/LOCATION_UPDATE_NOTES.md`

---

### 2026-04-15 — v2.8.3 — scheduler: bump updatedAt on ESPN sync, suppress benign WARN spam

**Risk:** GO — two small bugfixes, no schema change, no manual steps.

**What changed:**

1. **`packages/scheduler/src/espn-sync-service.ts`** — the ESPN sync's
   UPDATE path now bumps `updatedAt` alongside `lastSynced`. Drizzle's
   schema default only applies at insert time, so `updated_at` was
   frozen at row-creation and made staleness audits misleading (the
   row would show "last updated 5 days ago" even when the sync loop
   had touched it 30 seconds ago). `lastSynced` was always correct;
   `updatedAt` now matches it on every sync cycle.
2. **`packages/scheduler/src/scheduler-service.ts`** — the "No TVs to
   control" message from the AI Game Monitor's 5-minute tick is no
   longer logged at WARN. It's the expected steady state when no
   bartender has set active allocations, and it was producing ~288
   benign warnings per day, drowning real errors. Demoted to DEBUG
   with a neutral message; real execution failures still warn.

**Why this matters at a location:**

- Monitoring tools and the audit subagent that compute "sync
  staleness" from `game_schedules.updated_at` will finally show
  accurate numbers. Previously, anyone running a diff query would
  wrongly conclude ESPN sync had stalled when it was actually running
  fine — `lastSynced` was the truth all along, but it's buried in the
  schema and not the obvious column to check.
- PM2 logs go from roughly 300 WARN entries/day to zero for this
  condition, making real scheduler incidents visible.

**What could break:** nothing. `updatedAt` was previously stale for
every ESPN-synced row anyway; code that read it was either also
broken or was reading `lastSynced` instead. The log change is pure
verbosity reduction.

**Manual cleanup (optional, per-location):** if `game_schedules`
has legacy rows from pre-v2.3.0 with human-readable league labels
like `"MLB Baseball"`, `"NBA Basketball"`, `"NCAA Hockey"`, they're
orphaned and safe to delete. The current ESPN sync writes lowercase
labels (`mlb`, `nba`, `nhl`) and will never touch the legacy rows.
On Stoneyard Greenville today, those 5 orphan rows have been deleted
as part of this cleanup. Other locations can check with:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT league, COUNT(*) FROM game_schedules GROUP BY league;"
```

and delete any row whose league is not a lowercase short code:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "DELETE FROM game_schedules WHERE league IN ('MLB Baseball','NBA Basketball','NCAA Hockey');"
```

**Affected files:**

- `packages/scheduler/src/espn-sync-service.ts`
- `packages/scheduler/src/scheduler-service.ts`
- `package.json` (version bump)
- `docs/LOCATION_UPDATE_NOTES.md`

---

### 2026-04-15 — v2.8.2 — fire TV send-command: DB fallback for missing ipAddress

**Risk:** GO — bugfix, no schema change, no manual steps.

**What changed:**

`POST /api/firetv-devices/send-command` no longer requires `ipAddress`/`port`
in the request body. When missing (or blank), the route now looks up the
device row by `deviceId` from the `FireTVDevice` table and uses the DB values
as the source of truth. Schema fields are marked `.optional()`.

**Why:**

Stoneyard Greenville reported "Amazon 2 can't be controlled" from the
bartender iPad while Amazon 1 and 3 worked. Backend + physical device were
healthy — every direct curl to the endpoint succeeded. Root cause was an
iPad PWA cache holding a stale `/api/devices/all` response from back when
the FireTV connection-manager UPSERT bug (fixed in v2.5.4) had briefly
written a phantom row with empty `ipAddress`. The tablet's cached device
list kept sending `ipAddress: ""` → Zod rejected → fire-and-forget silent
failure in `FireTVRemote.tsx` → "nothing happens". Hard-refreshing the
tablet clears the cache, but a permanent fix belongs on the server so no
tablet can ever get wedged by stale client state again.

**What could break at a location:** nothing — the schema change is strictly
relaxing validation. Existing clients that DO send a valid ipAddress/port
keep working unchanged. The only new behavior is the DB fallback on empty.

**Manual steps required:** none. Auto-update handles it.

**Rollback notes:** revert the single commit; no DB changes. Previous
behavior (strict ipAddress) returns.

**Affected files:**

- `apps/web/src/app/api/firetv-devices/send-command/route.ts`
- `package.json` (version bump)
- `docs/LOCATION_UPDATE_NOTES.md`

---

### 2026-04-15 — docs: EXISTING_LOCATION_CLAUDE_PROMPT.md — manual catch-up runbook

**Risk:** GO — docs only, no code change, no version bump.

**What it is:**

A new runbook at `docs/EXISTING_LOCATION_CLAUDE_PROMPT.md` that a
Claude Code session running on any location's host can follow to
manually bring that location up to current main. It's the
command-line equivalent of the Sync-tab "Run Update Now" flow, for
locations that:

- Don't have `auto-update.sh` wired up yet (no systemd timer, no
  checkpoint flow), or
- Are too far behind main to trust their own stale auto-update.sh, or
- Need a step-by-step recovery path with the operator in the loop

The runbook walks through the same phases as auto-update.sh (fetch →
merge with LOCATION_PATHS_OURS guard → npm ci → drizzle-kit push →
build → pm2 delete+start → verify → install timer) but does each
step explicitly with diagnostic snapshots before and after, so a
Claude session with zero prior context can execute it cleanly.

**When to reference this:**

- Rolling out the first update at a location that was installed
  before auto-update.sh became standard (Holmgren Way, Graystone,
  Lucky's — as of 2026-04-15).
- Any time a location's own `scripts/auto-update.sh` is broken or
  missing features like the v2.8.1 schema-push phase.
- Disaster recovery when the Sync tab refuses to start an update or
  the checkpoint Claude instance fails to reach a decision.

**How Claude at the remote location uses it:**

The runbook contains both a short two-phase bootstrap prompt (what
the operator pastes into a fresh Claude session) AND the full
authoritative step list. The bootstrap fetches the file into `/tmp`
so the remote Claude is reading from origin/main's version, not
whatever stale copy is on the location's disk.

**Affected files:**

- `docs/EXISTING_LOCATION_CLAUDE_PROMPT.md` (new, ~550 lines)
- `docs/LOCATION_UPDATE_NOTES.md` — this entry

**No version bump** — docs-only addition, no code path changes.

---

### 2026-04-15 — v2.8.1 — auto-update.sh now runs drizzle-kit push before build

**Risk:** GO — this fix prevents the silent failure that v2.8.0 would
have caused at every other location. Read this entry BEFORE deciding on
the v2.8.0 entry below.

**Background — what was broken in v2.8.0:**

v2.8.0 added a new `ChannelTuneLog` table to the schema. The runbook
(`docs/NEW_LOCATION_CLAUDE_PROMPT.md` Step 4) explicitly tells fresh
installs to run `npx drizzle-kit push` between `npm ci` and `npm run
build`, but **`scripts/auto-update.sh` never had that step**. Result:
locations pulling v2.8.0 via auto-update would build successfully, PM2
would restart fine, verify-install would pass, but any call to the new
`/api/channel-presets/tune/history` endpoints would 500 because the
table doesn't exist.

We caught it at Stoneyard Greenville during the v2.8.0 merge and
created the table by hand with `sqlite3`. Without this v2.8.1 patch
that workaround would be needed at Holmgren, Graystone, Lucky's, and
every future install.

**What changed in v2.8.1:**

`scripts/auto-update.sh` — new `schema_push` phase between `npm_ci`
and `checkpoint_b`. It runs `npx drizzle-kit push` and:

- On clean success: logs and continues.
- On the specific "index/table/column already exists" error class:
  logs a WARNING and continues. This is the benign case where the DB
  already has untracked indexes from a prior manual hotfix (e.g., the
  `AiTvAvailability_matrixOutputId_idx` index that's currently
  pre-existing at Greenville). drizzle tracks schema by literal CREATE
  statements not by structural diff, so any untracked-but-present
  object trips the push even though the schema is already correct.
- On any OTHER error: aborts the update before checkpoint_b. Real
  schema corruption / version mismatch / sqlite engine errors all fail
  loudly so the rollback path triggers.

`scripts/prompts/checkpoint-b.txt` — Claude is now told to:
1. Read LOCATION_UPDATE_NOTES.md to see if the release added new tables
2. Grep the run log for `[SCHEMA]` / `WARNING:` / `drizzle` lines
3. If `packages/database/src/schema.ts` was in the merge diff, run
   `sqlite3 production.db ".tables"` and verify each new table from
   the diff actually exists. Missing tables → STOP, manual `sqlite3`
   CREATE needed before the build is worth running.

**What Claude on other location machines should look for after this
patch ships:**

1. `[SCHEMA]` lines in the auto-update run log — clean push or benign
   warning are both fine. Anything else aborts before checkpoint_b.
2. At checkpoint_b: ALWAYS list `.tables` and compare against any
   `packages/database/src/schema.ts` changes in the merge diff. New
   table missing → STOP.
3. The "WARNING: drizzle-kit push reported pre-existing objects
   (benign)" message is **expected** at Greenville and probably at
   Holmgren too — both have manually-created indexes from earlier
   hotfix sessions. Treat the warning as informational, not a failure.

**Affected files:**

- `scripts/auto-update.sh`
- `scripts/prompts/checkpoint-b.txt`
- `package.json` — version bump 2.8.0 → 2.8.1

**Stoneyard Greenville:** the manual `ChannelTuneLog` table from the
v2.8.0 merge is already in place, so this patch is purely preventative
here. Other locations get the patch via their next auto-update run,
which will then itself trigger the schema push for v2.8.0's table on
the next run after that. (Order matters: v2.8.1 patches the auto-
updater, then auto-updater can correctly handle v2.8.0+ schema
changes.)

**Rollback:** trivial — `git revert <sha>` restores the unpatched
auto-update.sh and the longer checkpoint-b prompt.

---

### 2026-04-15 — v2.8.0 — Samsung power-detection rewrite + tune-history + auto-update CLI fix

**Risk:** CAUTION — most pieces are GO, but **one DB schema change**
(ChannelTuneLog table) needs `drizzle-kit push` at every location after
the merge. Auto-update.sh already runs `drizzle-kit push` before
`npm run build` so a normal auto-update covers it. If you do a manual
merge, run drizzle-kit push yourself before restarting PM2 or the new
tune-history endpoints will 500.

**What changed (6 commits cherry-picked from location/stoneyard-appleton
where they were originally tested):**

1. **Auto-update CLI permissions fix** (`971c377d`) —
   `scripts/auto-update.sh` adds `--dangerously-skip-permissions` to
   the headless `claude -p` calls. Previously checkpoint B was hanging
   on interactive approval for a `sqlite3` command, parsing as
   UNDETERMINED, and triggering rollback.

2. **Fire TV health reporting fix** (`c09d705e`) — `/api/system/health`
   was comparing `FireTVDevice.status` against the literal `'connected'`,
   a value never written anywhere. Every Fire TV showed offline with
   the absurd issue text "Status: online". Now reads from `isOnline`.
   Also removed a duplicate `themeColor` from layout.tsx that Next.js
   16 warns about.

3. **Channel tune history (NEW FEATURE)** (`f8fae17c`) — append-only
   rolling log of every channel-tune attempt. New table
   `ChannelTuneLog`, new GET/POST `/api/channel-presets/tune/history`
   endpoints, intent-event hook in EnhancedChannelGuideBartenderRemote
   so Watch button clicks are logged independently of downstream
   success. Cable boxes get a second row tagged `bartender` with
   success/failure and durationMs.

4. **Bulk-power TV state probe** (`ed6e03ed`) — bulk power-off was
   reporting success even when Samsung TVs ignored the key. Now probes
   port 8002 before sending and verifies post-send. **Then superseded**
   by commit 5 below which replaced the lying 8002 probe with REST
   PowerState.

5. **Samsung REST PowerState rewrite + model probe** (`f54f25c0`) —
   replaces port-8002 probe with REST `/api/v2/` `PowerState`. Standby
   = off (skipped for action='off', WoL'd for action='on'). New model-
   catalog probe `POST /api/tv-discovery/probe-models` + boot-time
   refresh in instrumentation.ts (45s after start, every 4h). At
   Stoneyard Appleton this updated 7 of 20 model rows to their real
   identity (e.g. `UN55DU7200DXZA`).

6. **NEW_LOCATION_SETUP doc update** (`5c87b7b1`) — adds §9a walking
   the operator through running the model probe once after configuring
   TVs, plus rewrites the "Samsung TV keeps turning itself off"
   troubleshooting step with explicit "do not probe 8002" warning.

**Per-location action after this merge:**

```bash
# auto-update.sh handles this automatically. Manual merge:
npx drizzle-kit push --config drizzle.config.ts
pm2 restart sports-bar-tv-controller
# Samsung locations: trigger model probe to refresh catalog (after login)
curl -sS -b cookiejar -X POST http://localhost:3001/api/tv-discovery/probe-models
```

**Affected files:**

- `scripts/auto-update.sh`
- `apps/web/src/app/api/system/health/route.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/api/channel-presets/tune/history/route.ts` (new)
- `apps/web/src/app/api/channel-presets/tune/route.ts`
- `apps/web/src/app/api/tv-control/bulk-power/route.ts`
- `apps/web/src/app/api/tv-discovery/probe-models/route.ts` (new)
- `apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx`
- `apps/web/src/instrumentation.ts`
- `apps/web/src/lib/samsung-model-probe.ts` (new)
- `packages/database/src/schema.ts` — adds `channelTuneLog` table
- `docs/NEW_LOCATION_SETUP.md`
- `package.json` — version bump 2.7.1 → 2.8.0 (minor: new feature)

**Stoneyard Appleton:** already running these commits (originated
there). Cherry-picks land them on main with different SHAs — Appleton's
next merge from main will resolve as duplicates cleanly.

**Rollback:** non-trivial because of the schema change. Best path is
`git revert <merge sha>` + `pm2 restart`. The new ChannelTuneLog table
can stay (empty) without affecting anything else.

---

### 2026-04-14 — v2.7.1 — bigger preset logos + logos in input list

**Risk:** GO — pure UI tweak. No behavior change.

**What changed:**

`ChannelPresetGrid.tsx` — preset grid logos went from 20px to 40px
with a subtle white background tile so SimpleIcons white-monochrome
variants stay visible against colored card gradients.

`EnhancedChannelGuideBartenderRemote.tsx` — each input row in the
Guide tab's left panel now shows the currently-tuned channel's logo
(32px) next to the "Ch X • cable" label. Lookup uses
`currentChannels[input].channelName` against the same channel-logos
helper from v2.7.0. Hides on CDN error, falls back to text badge for
unknown channels.

**Affected files:**

- `apps/web/src/components/ChannelPresetGrid.tsx`
- `apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx`
- `package.json` — version bump 2.7.0 → 2.7.1

---

### 2026-04-14 — v2.7.0 — channel logos in bartender preset grid

**Risk:** GO — additive UI only. Logos appear next to preset names in
the bartender remote's preset grid. Falls back to a colored text badge
for any preset name without a known logo, so unknown channels still
display gracefully.

**What changed:**

`apps/web/src/lib/channel-logos.ts` (new, ~400 lines) — a name→logo
lookup that maps a `ChannelPreset.name` to either:

- A SimpleIcons CDN URL (https://cdn.simpleicons.org) for major brands
  with a SimpleIcons entry (ESPN, NFL, NBA, MLB, NHL, FOX Sports,
  Peacock, Paramount+, Prime Video, Apple TV+)
- A colored text badge with brand colors for everything else (regional
  sports nets, college conferences, broadcast affiliates, niche
  channels)
- A generic gray badge with the first 4 chars of the preset name as
  the ultimate fallback

`apps/web/src/components/ChannelPresetGrid.tsx` — renders the logo or
badge inline next to each preset name. The image element has an
onError handler that hides itself if the CDN hiccups, so a network
failure on the SimpleIcons CDN never breaks the grid layout.

**Coverage at Stoneyard Greenville (verified by smoke test):**

All 17 tested preset names match correctly, including the
previously-tricky cases: ESPN News (vs ESPNews), Peacock/NBC Sports
(slash in name), Big 10, NFLNet/NHLNet abbreviations, MBL Network
(typo of MLB), NESN, MSG2, beIN Sports, MLB Strike Zone, Fan Duel
North, Cowboy Channel, and the Stoneyard-specific "Bally Sports WI"
preset that maps to the channel 308 overflow feed per CLAUDE.md.

**Coverage at other locations:** untested, but the fallback badge
ensures no preset will render broken — at worst it displays a 4-char
text badge in the grid color.

**No DB schema change.** The lookup is pure computation from the
existing `ChannelPreset.name` column. A future enhancement could add
an optional `ChannelPreset.logoUrl` column for per-location overrides
without touching this helper.

**Affected files:**

- `apps/web/src/lib/channel-logos.ts` — new
- `apps/web/src/components/ChannelPresetGrid.tsx`
- `package.json` — version bump 2.6.0 → 2.7.0 (minor: new feature)

**Rollback:** trivial — `git revert <sha>` removes the logos and the
grid falls back to text-only as before.

---

### 2026-04-14 — v2.6.0 — bartender Guide tab: Open Channel Guide button (cable only)

**Risk:** GO — additive UI only. New button appears only for cable-box
inputs, has no effect on any other code path.

**What changed:**

In the bartender remote's Guide tab
(`EnhancedChannelGuideBartenderRemote.tsx`), when an input backed by
an IR cable box is selected, a new "Open Channel Guide on TV" button
appears under the input list. Tapping it sends the learned `Guide` IR
command to that cable box, popping the on-screen Spectrum/cable guide
up on whatever TV is currently routed to that input.

The button is hidden for DirecTV, Fire TV, and EverPass inputs — they
don't have a cable-style on-screen guide. DirecTV could be added later
via the IP control GUIDE command if requested.

**Prerequisite at each location:**

Each cable box's IR device row must have a learned `Guide` command in
the `IRCommand` table. Verify with:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceId, functionName FROM IRCommand WHERE LOWER(functionName)='guide';"
```

If any cable box is missing it, learn it via Device Config → IR tab →
Learn IR (point the physical Spectrum remote at the Global Cache
sensor, press Guide). Without this row, the button shows an error
toast for that input but the rest of the UI still works fine.

**Stoneyard Greenville:** all 4 cable boxes already have Guide learned
(verified). Other locations need to spot-check.

**Affected files:**

- `apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx`
- `package.json` — version bump 2.5.4 → 2.6.0 (minor: new feature)

**Rollback:** trivial — `git revert <sha>` removes the button.

---

### 2026-04-14 — v2.5.4 — kill phantom Fire TV row regeneration loop

**Risk:** GO — defensive fix only, no surface change. Will eliminate
existing per-second `Failed to connect to :5555` log noise at any
location whose FireTVDevice table still has a phantom row.

**What was happening:**

The Fire TV connection manager's `updateDeviceStatus()` was using the
`saveFireTVDevice()` upsert helper. When called with a deviceId that
didn't exist in FireTVDevice (e.g., because something else fed it a
DirecTV id), the upsert silently INSERTed a new row with empty
ipAddress and `name='Unknown'`. That phantom row then survived manual
DELETE: on the next health check, `loadFireTVDevices()` returned the
empty row, the connection manager tried to connect to `:5555`, failed,
and re-upserted the row — perpetuating itself indefinitely. At
Stoneyard Greenville this produced ~30 reconnect attempts/minute
forever and the bartender remote saw a phantom "Unknown" device.

**What's fixed:**

1. `firetv-connection-manager.ts::updateDeviceStatus` now uses a plain
   `db.update().where()` instead of the upsert. If the device id has no
   matching row, the update is a no-op and the manager logs a warning
   but does NOT create a row. Phantom rows can no longer self-resurrect.
2. `firetv-connection-manager.ts::initialize` skips devices with empty
   `ipAddress`, so existing phantoms in the table don't get added to the
   in-memory connection map at boot.
3. `firetv-health-monitor.ts::checkDeviceHealth` skips devices with
   empty `ipAddress`, killing the per-cycle reconnect noise.

**One-time cleanup at any affected location** (if you see "Unknown"
devices in `FireTVDevice` after pulling this fix):

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "DELETE FROM FireTVDevice WHERE ipAddress='' OR ipAddress IS NULL;"
pm2 restart sports-bar-tv-controller
```

The new code is defensive enough that this cleanup is optional — even
without it, no new connection attempts will fire against the phantom.

**Affected files:**

- `apps/web/src/services/firetv-connection-manager.ts`
- `apps/web/src/services/firetv-health-monitor.ts`
- `package.json` — version bump 2.5.3 → 2.5.4

**Open question (NOT fixed in this commit):** the original injection
path that fed DirecTV ids into Fire TV's connection manager has not
been found. Search for `directv_holmgren_2` in PM2 logs at any location
to see if an older code path is still pumping cross-table device ids.
The defensive fix above blocks the symptom even if the original injector
is still in place.

---

### 2026-04-14 — v2.5.3 — strip Holmgren defaults from shared package config

**Risk:** GO — pure cleanup, no behavior change at any location.

**What changed:**

`packages/config/src/hardware-config.ts` used to be a "mirror" of
`apps/web/src/lib/hardware-config.ts` and shipped Holmgren-specific
defaults (Atlas IP `10.11.3.246`, processor ID `3641dcba…`, name
"Holmgren Way", Wolf Pack audio output slots 37-40) to every new install
via `@sports-bar/config`. Anything importing the package version got
Holmgren defaults regardless of which location it was running on.

Audited every import of `@sports-bar/config` HARDWARE_CONFIG — only two
fields were ever read through the package: `ollama.baseUrl/model` (truly
generic) and `venue.timezone` (same `America/Chicago` for all WI
locations). All other fields (`atlas.*`, `wolfpack.*`, `api.*`,
`venue.name`, `scheduler.*`) were dead weight nobody imported through the
package — the real consumers all read from the app-level file directly.

Stripped the package version down to those two fields and added a
header comment explaining what does and does not belong in shared package
code. Both fields now also honor env overrides (`OLLAMA_BASE_URL`,
`OLLAMA_MODEL`, `LOCATION_TIMEZONE`).

**What this fixes:**

This was the source of the "I keep seeing Holmgren references at this
location" class of bug. Even on a perfectly-configured Stoneyard install,
anything routed through `@sports-bar/config` would surface Holmgren IPs
or the venue name "Holmgren Way" in logs, AI prompts, and diagnostic
output. That's gone now.

**Affected files:**

- `packages/config/src/hardware-config.ts` — rewritten (47 → ~50 lines)
- `package.json` — version bump 2.5.2 → 2.5.3

**Rollback:** trivial — `git revert <sha>` restores the old mirror.

---

### 2026-04-14 — `ee9c63c0` — CAUTION: location-data reconciliation bug + install fixes

**Risk:** CAUTION — one corrective data commit already applied to
location/stoneyard-greenville; NO action needed on other location
branches UNLESS an operator does a naive `git merge main` instead of
running `scripts/auto-update.sh`.

**What happened at Stoneyard (for context so you know what to watch for):**

During the 2026-04-14 main-vs-location reconciliation session, I
branched a `reconcile-main` branch FROM `location/stoneyard-greenville`'s
tip, blanked the location-data files on it (tv-layout.json,
wolfpack-devices.json, channel-presets-*.json), and force-pushed
that as `main`. Later, when `main` was merged back into
`location/stoneyard-greenville` via a plain `git merge main` that did
NOT use the auto-update script's LOCATION_PATHS_OURS conflict
resolver, git saw the blanking as a clean tree change (no conflict to
trip on) and the location branch's real hardware data got wiped:

  tv-layout.json           3843 → 61 bytes (20 TV zones erased)
  wolfpack-devices.json     407 → 15 bytes (chassis config erased)
  channel-presets-cable.json   17745 → 15 bytes (62 presets erased)
  channel-presets-directv.json 15487 → 15 bytes (54 presets erased)

Visible symptom: the bartender remote Video tab and /layout-editor
page showed an empty TV map because the layout API reads
tv-layout.json directly at request time.

Fixed on Stoneyard by commit 54463a72 which restored all four files
from 5fb25f19 (the commit immediately before reconcile). This commit
is on location/stoneyard-greenville ONLY — never cherry-picked to
main, and will never be because it contains Stoneyard-specific
hardware data.

**What this means for the other 3 locations (graystone, holmgren-way,
lucky-s-1313):**

- **You were NOT affected.** I audited all three branches on 2026-04-14:
  none of them have the reconcile commit (7f13fbe7) in their ancestry,
  and all three still have their real tv-layout.json / directv-devices
  / firetv-devices data intact.

- **But when you pull tonight's main for the first time, be careful.**
  Main now has empty templates for tv-layout.json (61 bytes),
  wolfpack-devices.json (15 bytes), channel-presets-cable.json (15
  bytes), and channel-presets-directv.json (15 bytes). A naive
  `git merge main` from a shell will overwrite your location's real
  data the same way it happened to Stoneyard.

- **The correct merge path** is to let `scripts/auto-update.sh` handle
  it. That script has LOCATION_PATHS_OURS logic that runs
  `git checkout --ours <path>` on every location-data file in the
  merge conflict set, then `git add` + `git commit --no-edit` to
  finalize. It preserves the location's real data and takes main's
  software changes.

- **If you must merge manually**, do this instead of a plain
  `git merge main`:

  ```
  git merge origin/main --no-commit --no-ff
  for f in apps/web/data/tv-layout.json \
           apps/web/data/directv-devices.json \
           apps/web/data/firetv-devices.json \
           apps/web/data/device-subscriptions.json \
           apps/web/data/wolfpack-devices.json \
           apps/web/data/channel-presets-cable.json \
           apps/web/data/channel-presets-directv.json; do
    if [ -f "$f" ]; then git checkout HEAD -- "$f"; git add "$f"; fi
  done
  git commit --no-edit
  ```

  This explicitly restores each location-data file from your branch's
  HEAD after the merge, guaranteeing main's empty templates never
  land on your tree.

- **After any merge, verify** that the TV map still renders on the
  bartender remote Video tab AND that `apps/web/data/tv-layout.json`
  is >500 bytes. If either check fails, restore from your branch
  history the same way I restored Stoneyard:

  ```
  git log --oneline -- apps/web/data/tv-layout.json
  git show <last-good-commit>:apps/web/data/tv-layout.json \
    > apps/web/data/tv-layout.json
  git add apps/web/data/tv-layout.json
  git commit -m "data: restore tv-layout.json after merge"
  ```

**Other install fixes bundled in tonight's main** (safe to pull, no
action required beyond using the correct merge path above):

- `8445e47f` LG TVs now work with bartender All On/All Off (bulk-power
  route was missing `case 'lg':`)
- `ac58e3e4` ecosystem.config.js adds bartender-proxy as a second PM2
  app, verify-install.sh treats empty ChannelPreset as WARN not FAIL,
  runbook fixed to use `pm2 delete && pm2 start` instead of
  `pm2 restart --update-env` for env reload

**Manual steps required:** For each location pulling main for the
first time:
1. Use `scripts/auto-update.sh` (recommended) or the manual checkout
   loop above — NOT a plain `git merge main`.
2. After the merge, verify `apps/web/data/tv-layout.json` is >500
   bytes and the bartender remote Video tab shows the TV map.
3. If the bartender proxy on port 3002 wasn't running before,
   `pm2 delete bartender-proxy 2>/dev/null || true; pm2 start
   ecosystem.config.js` will pick up the new second app.

**Rollback notes:** If a location pulls main and the layout disappears,
the fix is `git show HEAD~1:apps/web/data/tv-layout.json >
apps/web/data/tv-layout.json && git add ... && git commit`. The old
data lives in git history — it's never permanently lost.

**Affected files:**

- `apps/web/data/tv-layout.json` (per-location, never to main)
- `apps/web/data/wolfpack-devices.json` (per-location)
- `apps/web/data/channel-presets-cable.json` (per-location)
- `apps/web/data/channel-presets-directv.json` (per-location)

---

### 2026-04-14 — `8445e47f` — Bartender All On/All Off now works for LG TVs (was silently failing)

**Risk:** MEDIUM — bug fix for a user-facing bartender action that had
been broken for any location with LG brand TVs.

**What changed:**

`/api/tv-control/bulk-power` (the endpoint the bartender remote's
"All On" / "All Off" buttons hit) previously had no `case 'lg':` in
its `controlDevicePower()` brand switch. LG TVs fell through to the
default branch which returned `${brand} not supported for bulk power`,
so every LG TV silently failed and the bartender saw no effect on the
wall.

The single-TV route at /api/tv-control/[deviceId]/power already had
a controlLGPower handler; this commit adds the same pattern to the
bulk route. LGTVClient.powerOn() uses Wake-on-LAN via the device's
MAC address (idempotent), LGTVClient.powerOff() uses WebSocket SSAP
to send `ssap://system/turnOff`.

Discovered on Stoneyard Greenville which has 19 LG TVs + 1 Samsung.
The Samsung power commands were working; the 19 LG TVs were the
visible problem.

**What could break at a location:**

- **None** — purely additive bug fix. Locations with LG TVs gain a
  working All On / All Off. Locations without LG TVs see zero change
  (the new case is brand-scoped).
- If a location has LG TVs but no MAC address in the DB row, the
  powerOn call will fail with "WOL failed: MAC required". Fix:
  populate networkTVDevices.macAddress for each LG TV row via the
  Device Config UI or the TV network discovery scan.

**Manual steps required:** None — next auto-update picks it up, or
re-run the build manually. Locations should verify MAC addresses are
populated for their LG TV rows before expecting "All On" to work —
WoL requires MAC.

**Rollback notes:** `git revert 8445e47f` (but you probably don't
want to — reverting restores the broken state where LG TVs silently
fail every bulk power command).

**Affected files:**

- `apps/web/src/app/api/tv-control/bulk-power/route.ts` — added LG case to
  controlDevicePower() switch + added LGTVClient to imports

---

### 2026-04-14 — `6f0a43d9` — 🎉 First successful end-to-end auto-update run (history id=14, 127s, pass)

**Risk:** none (milestone entry, not a code change)

**What changed:**

This is a marker entry for the first green auto-update run from
Stoneyard Greenville, produced by the auto-update orchestrator
itself (not an operator-typed commit). The merge commit
`6f0a43d9 chore: auto-update merge 2026-04-14-11-42` is the
output artifact of the orchestrator successfully flowing through
every phase of the pipeline.

Full 127-second run breakdown (history row id=14):
- preflight + fetch: <1s
- **checkpoint_a**: DECISION GO in 17s
- backup (DB snapshot + rollback tag): <1s
- merge with LOCATION_PATHS_OURS conflict auto-resolve: <1s
- version_check: <1s
- **npm ci --include=dev**: 10s, turbo present
- **checkpoint_b**: DECISION GO in 55s
- build (turbo cached): <1s
- **pm2_restart**: 20s, script detached via `setsid --fork` and
  survived the Next.js restart (PID still alive, PPID=1)
- verify-install.sh: PASS 6/6 in 2s
- **checkpoint_c**: DECISION GO in 22s (prompt now trusts
  verify-install output and treats sandbox denials as GO)
- finalize: <1s → history row transitioned from in_progress to pass

Every bug uncovered during tonight's 13 prior test runs is fixed
in the code paths exercised by this run:

1. `NODE_ENV=development npm ci --include=dev` (run id=8) — turbo
   installs despite PM2's NODE_ENV=production environment.
2. API route spawns via `setsid --fork` (runs id=10 and id=12) —
   auto-update.sh starts with PPID=1 in its own session/pgid and
   cannot be killed by `pm2 restart sports-bar-tv-controller`.
3. bash-level `exec setsid -f` as belt-and-suspenders for direct
   shell invocation paths.
4. Checkpoint A prompt trusts LOCATION_PATHS_OURS auto-resolve
   (run id=11 would have been rolled back by the old prompt's
   false-positive STOP on data-file modifications in the diff).
5. Checkpoint C prompt treats sandbox denials as GO instead of
   STOP, trusts verify-install.sh JSON output as authoritative
   (runs id=11 and id=13 rolled back at this step under the old
   prompt despite verify-install PASS 6/6).

**What could break at a location:**

- **None** — this entry is a milestone marker, not a code change.

**Manual steps required:** None.

**Rollback notes:** Not applicable.

**Affected files:** None (the merge commit itself is a content
no-op since location and main have the same tree — all the bug
fixes had already been cherry-picked to both branches before the
run started).

---

### 2026-04-14 — `8c148ce8` — auto-update: force NODE_ENV=development for npm ci

**Risk:** HIGH (this was a blocker for every auto-update run before this fix)

**What changed:**

Both `scripts/auto-update.sh` and `scripts/rollback.sh` now run
`NODE_ENV=development npm ci --include=dev` instead of plain `npm ci`.

The plain version inherited PM2's `NODE_ENV=production` and silently
skipped devDependencies, dropping `turbo` from node_modules. The next
`npm run build` then died with `sh: 1: turbo: not found` and triggered
an unnecessary rollback. First discovered on the first real end-to-end
auto-update attempt tonight (history id=8, rolled back at 23:02:34).

**What could break at a location:**

- **None** — the fix makes auto-update WORK where previously it was
  broken. Locations that have never successfully run auto-update
  before this commit will now be able to. Locations that already
  happen to have turbo installed (because they built outside the
  auto-update flow) will be unaffected.
- If a location is extremely disk-constrained, forcing devDependencies
  to install adds ~100 MB to node_modules. Not an issue for any
  current Sports Bar TV Controller deployment.

**Manual steps required:** None. The fix is in the script itself —
next run picks it up automatically.

**Rollback notes:** `git revert 8c148ce8`. But you probably don't
want to — reverting restores the broken state.

**Affected files:**

- `scripts/auto-update.sh` (npm_ci step)
- `scripts/rollback.sh` (npm ci step)

---

### 2026-04-14 — `726b766e` — Sign-out button uses POST fetch instead of GET link

**Risk:** low

**What changed:**

Clicking "sign out" on the System Admin auth banner returned HTTP 405
because it was a plain `<a href="/api/auth/logout">` (GET) but the
logout route only exports POST. Changed to a `<button>` with an
onClick handler that fetches POST with credentials, then redirects
to `/login`.

**What could break at a location:**

- **None** — purely a client-side UI fix in one component. No API
  contract change, no schema change, no new files.

**Manual steps required:** None.

**Rollback notes:** `git revert 726b766e`.

**Affected files:**

- `apps/web/src/app/system-admin/page.tsx` (AuthStatusBanner sign-out handler)

---

### 2026-04-14 — `7cd30e3d` — Per-commit update notes + version badge on System Admin

**Risk:** low

**What changed:**

- New `docs/LOCATION_UPDATE_NOTES.md` — per-commit changelog that
  Claude reads at Checkpoint A to factor risk into the decision.
- New `scripts/add-update-note.sh` — interactive helper to prepend
  entries to the notes file.
- Updated `scripts/prompts/checkpoint-a.txt` with Step 1.5 that
  requires Claude to read the notes entry for every pending commit.
- New `GET /api/system/version` endpoint returning package.json
  version, git branch, commit SHA + date, build date, uptime.
- New `<VersionBadge />` component at top of `/system-admin` that
  polls `/api/system/version` every 60s and shows the current
  running version.

**What could break at a location:**

- **None** — purely additive. New endpoint, new component, new docs,
  updated prompt. No existing runtime paths touched.

**Manual steps required:** None.

**Rollback notes:** `git revert 7cd30e3d`.

**Affected files:**

- `docs/LOCATION_UPDATE_NOTES.md` (new)
- `scripts/add-update-note.sh` (new, executable)
- `scripts/prompts/checkpoint-a.txt` (Step 1.5 added)
- `apps/web/src/app/api/system/version/route.ts` (new)
- `apps/web/src/app/system-admin/page.tsx` (VersionBadge component added)

---

### 2026-04-14 — `5380f7e7` — New-location bootstrap kit + doc + CLAUDE.md update

**What changed:**

- Added `scripts/bootstrap-new-location.sh` — idempotent helper for
  per-location auth bootstrap (creates `Location` row, seeds
  `AuthPin` STAFF/ADMIN rows, writes `LOCATION_ID` to `.env`,
  optionally creates the location git branch).
- Added `docs/NEW_LOCATION_SETUP.md` — full cold-start runbook from
  fresh Ubuntu host to auto-update enabled.
- Updated `CLAUDE.md` Multi-Location Deployment section with the
  corrected file list (including `channel-presets-*.json`), auth
  bootstrap subsection, and a warning about the reconciliation
  history.

**What could break at a location:**

- **Low risk** — purely additive (new script + new doc + CLAUDE.md
  documentation update). No existing files removed, no runtime code
  changes, no schema migrations.
- Existing locations that run the auto-update will get these as new
  files. None of the new files is imported or executed at runtime by
  the app; they are operator tooling only.

**Manual steps required:** None.

**Rollback notes:** `git revert 5380f7e7` or, if rolling main back
further, `git push origin main-archive-20260414:main --force-with-lease`.

**Affected files:**

- `scripts/bootstrap-new-location.sh` (new, executable)
- `docs/NEW_LOCATION_SETUP.md` (new)
- `CLAUDE.md` (Multi-Location Deployment section modified)

---

### 2026-04-14 — `7f13fbe7` — Reconcile main with location software state

**What changed:**

This is the catastrophic-scale reconciliation that brought `main`
back in sync with `location/stoneyard-greenville` after months of
drift. 81 files, 12K+ line changes.

For locations that were on a pre-reconcile `main` (i.e., anything
before this commit): the auto-update will pull in months of v2.4.x
evolution in a single merge. For locations that were branched from
`location/stoneyard-greenville` itself: this is a near-no-op because
they already had the v2.4.x work.

Specifically, the commit:

1. Replaced `main`'s tree with `location/stoneyard-greenville`'s
   software tree (all v2.4.0-2.4.9 work: Sports Guide Admin Phases
   A-D, AI Game Plan features, Fire TV streaming panel, Crestron DM
   matrix support, ESPN sync boot hook, scheduler fixes, channel-
   resolver consolidation, auto-update system).
2. Blanked location-data files to empty templates on `main`
   (`tv-layout.json`, `directv-devices.json`, `firetv-devices.json`,
   `device-subscriptions.json`, `wolfpack-devices.json`,
   `channel-presets-cable.json`, `channel-presets-directv.json`).
3. Deleted `apps/web/backup/location-data/` (stale DB backup that
   was accidentally committed).
4. Deleted `apps/web/src/app/api/matrix/config/route.ts.backup2`
   (Prisma-era cruft).
5. Hardened `.gitignore` with `*.apk`, `*.zip`, `*.sqlite`,
   `database_backups/`, `.claude/settings.local.json`, variant
   backup patterns.

**What could break at a location:**

- **MEDIUM risk** — the diff from a pre-reconcile `main` is enormous.
  The auto-update script's `LOCATION_PATHS_OURS` conflict resolver
  will handle the data files correctly (keeping the location's
  version), but be aware of these specifically:
  - `apps/web/src/lib/hardware-config.ts` — this file currently
    contains Stoneyard's device IPs in code (pre-existing tech debt).
    Locations that have customized this file locally WILL get a
    conflict. Resolution: `git checkout --ours` to keep the local
    version, then follow up by moving the constants to
    `data/hardware.json` as a proper per-location file.
  - `apps/web/data/*.json` — auto-resolved to `--ours` (location
    keeps its data).
  - `package-lock.json` + `package.json` — auto-resolved to
    `--theirs` (main's version; dependency sync).
- The v2.4.0 Sports Guide Admin consolidation deletes several old
  scheduler/sports-guide-config routes. If a location has bookmarked
  URLs, `/sports-guide`, `/sports-guide-config`, `/ai-gameplan`, and
  `/scheduling` now redirect (via Next.js `redirects()`) to the new
  `/sports-guide-admin` page.
- The AuthPin login flow was fixed today — old cookies issued by the
  pre-fix app will still work until they expire (8 hours).

**Manual steps required:**

- Run `npx drizzle-kit push --config drizzle.config.ts` after the
  merge to apply any new DB tables. The v2.4.x work added
  `auto_update_state` and `auto_update_history` (singleton + append-
  only). Safe — they default to empty and gate on application logic.
- If `.env` doesn't have `LOCATION_ID`, set it using the bootstrap
  script or manually from the Location row's `id`.
- If `.env` doesn't have `AUTH_COOKIE_SECURE`, add it as `false`
  (required for HTTP LAN deployments).

**Rollback notes:**

The pre-reconcile state is preserved as `main-archive-20260414` on
origin. If something breaks catastrophically post-merge:

```bash
git fetch origin
git push origin main-archive-20260414:main --force-with-lease
# Then each location:
git checkout location/<name>
git reset --hard origin/location/<name>  # revert local merge
pm2 restart sports-bar-tv-controller --update-env
```

**Affected files:**

- 81 files across the entire tree — too many to list. `git diff --stat
  main-archive-20260414..7f13fbe7` will show the full picture.
- Highest-attention files: `apps/web/src/app/sports-guide-admin/page.tsx`
  (new), all `apps/web/src/components/admin/*.tsx` (new), `.gitignore`,
  all `apps/web/data/*.json` (blanked), `CLAUDE.md`.

---

### 2026-04-14 — `4bb259a8` — checkpoint-a prompt trusts LOCATION_PATHS_OURS

**What changed:**

Rewrote `scripts/prompts/checkpoint-a.txt` (the Claude Code CLI
pre-update review prompt) to know about the auto-updater's
`LOCATION_PATHS_OURS` conflict auto-resolve step. Previously the
prompt treated any modification of a location-data file in the
incoming diff as an automatic STOP, producing false positives on
every run (including the reconciliation commit above, which modifies
the location-data files to blank templates on main).

The rewritten prompt:

- Lists the full `LOCATION_PATHS_OURS` and `LOCATION_PATHS_THEIRS`
  arrays at the top so Claude knows which paths are auto-handled.
- Removes "STOP on location-data modification" from the criteria.
- Refocuses STOP triggers on things the script CAN'T auto-handle:
  non-additive schema migrations, known-breaking dep bumps,
  accidental secrets, deletion of the script itself, auth lockout
  changes.
- Explicitly lists things that should NOT cause a STOP.

**What could break at a location:**

- **None** — this is prompt-only. The script itself is unchanged.
- The only observable difference is that auto-update runs that
  previously failed at Checkpoint A with a false-positive STOP will
  now proceed to the merge+build+verify flow. This is the INTENDED
  behavior.

**Manual steps required:** None.

**Rollback notes:** `git revert 4bb259a8` restores the old prompt.

**Affected files:**

- `scripts/prompts/checkpoint-a.txt` (rewritten)

---

### 2026-04-14 — `9bd78364` — AutoUpdatePanel: save button no longer fights with polling

**What changed:**

Fixed "can't enable or save settings" bug in the Sync tab Auto Update
panel. The 15-second status poll was unconditionally resetting the
user's in-progress draft (`enabledDraft`, `timeDraft`) to the
server's value, wiping any edits before the user could click Save.
Added a `draftTouchedRef` that pauses server-sync on the draft once
the user interacts with the Switch or time picker; cleared after a
successful save.

**What could break at a location:**

- **None** — pure UI state fix in a single component. No API contract
  changes, no schema changes.

**Manual steps required:** None.

**Rollback notes:** `git revert 9bd78364`.

**Affected files:**

- `apps/web/src/components/AutoUpdatePanel.tsx` (modified)

---

## Archive

Older entries (>30 days) are pruned from this file. The authoritative
record is the git history.
