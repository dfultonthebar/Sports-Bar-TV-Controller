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

## OPERATOR HEADS-UP — 2026-04-17 batch (v2.18.0 through v2.22.x)

**Applies to every location auto-updating tonight.** 14 versions shipped
in a single night at Lucky's 1313. Most are additive and pure software;
the `auto-update.sh` pipeline handles the merge, schema push, cache
bust, and PM2 restart automatically — you do NOT need to run any manual
steps for the update itself. Checkpoint B will reconcile these entries
for you. This section exists so you know what to watch for on the OTHER
side of the update.

### What changed (one-line per version)

- **v2.18.0–2.18.2** — Scheduler bug fixes: per-tune matrix routing was
  silently mis-routing TVs for bartender-scheduled games (UUID parseInt
  passed garbage to Wolf Pack). Plus: scheduler UI "Idle" state fix
  + override-learn hook that records bartender corrections.
- **v2.19.0** — ESPN sync now tracks real game durations per league,
  scheduler uses the learned average for `expected_free_at` instead of
  hardcoded 3h. Atlas endpoint guards stop reconnect-loop log spam at
  non-Atlas locations.
- **v2.20.0** — Autonomous agents: override-digester + failure-sweeper
  run hourly, surface recurring bartender corrections and recurring
  SchedulerLog failures as high-visibility warn rows. n8n dead code
  removed (iframe pointed at a stranger's IP — unused at all locations).
- **v2.21.0** — Four new `/api/ai/*` endpoints: shift-brief,
  distribution-plan, conflict-suggestion, weekly-summary.
- **v2.22.0** — UI wiring for v2.21.0 endpoints on the bartender
  remote + AI Suggest tab. Also fixed a pre-existing bug where college
  baseball games on ESPN/ESPNU were invisible in the Live Games list.

### What bartenders will notice the night of update

- **Scheduled tunes now land TVs on the correct input the first time.**
  Many bartenders have been manually moving TVs to the right cable box
  after every scheduled game fire — that behavior is no longer needed.
  If they've been compensating, the change will feel sudden. Brief them.
- **New Shift Brief card at the top of the remote's Video tab.** Shows
  tonight's games and anything unusual. Can be dismissed for 4 hours.
- **New "Smart Distribute" button next to "Approve All"** in the AI
  Suggest tab. Recommended flow when approving 3+ games at once.
- **College baseball shows up in Live Games** where it didn't before.
- **No UI regression expected anywhere else.**

### What to verify AFTER update (5-minute checklist)

Run each block. All commands are safe / read-only unless noted.

**1. `OLLAMA_MODEL` env var points at an installed model** (critical —
the shift-brief 404s silently if wrong):
```bash
grep OLLAMA_MODEL /home/ubuntu/Sports-Bar-TV-Controller/.env
curl -s http://localhost:11434/api/tags | jq -r '.models[].name'
# If .env value isn't in the installed list, edit .env and do:
# pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js
```

**2. No in-flight scheduler routing drift** (the v2.18.2 detection query):
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
FROM alloc_outputs ao LEFT JOIN MatrixRoute mr ON mr.outputNum = ao.output
ORDER BY ao.src, CAST(ao.output AS INT);
SQL
```
Any `MIS-ROUTED` = an allocation created pre-v2.18.2 that the fix
didn't repair. Curl-loop repair per the v2.18.2 entry below.

**3. Atlas reconnect loop absent** (post-v2.19.0 should be zero):
```bash
pm2 logs sports-bar-tv-controller --err --lines 500 --nostream \
  | grep -c "Failed to connect to Atlas processor"
```
Expect 0. Non-zero at a non-Atlas location = guard didn't apply (check
that the build picked up the new `atlas-guard.ts`).

**4. Autonomous agents fired on restart:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT component, operation, message FROM SchedulerLog
   WHERE component IN ('override-digest','failure-sweep')
   ORDER BY createdAt DESC LIMIT 4;"
```
Expect 2 summary rows per hourly tick (one each).

**5. ChannelPreset seeded** (distribution-optimizer preflight depends
on this — without it, every plan line shows `chan ✗`):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceType, COUNT(*) FROM ChannelPreset WHERE isActive=1 GROUP BY deviceType;"
```
A running location should have 20+ cable / 50+ directv presets. If
zero, seed through the bartender remote preset UI before trusting
distribution-plan output.

**6. HomeTeam seeded** (drives home-team priority in every AI feature):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT teamName, sport, league FROM HomeTeam WHERE isActive=1 ORDER BY sport;"
```
If empty, shift-brief and distribution-plan won't prioritize home-team
games. Populate per your market — see CLAUDE.md §10 reference example.

**7. `LOCATION_TIMEZONE` is set** if you're not in Central Time. The
weekly owner summary fires Monday 6am in `LOCATION_TIMEZONE` local time:
```bash
grep LOCATION_TIMEZONE /home/ubuntu/Sports-Bar-TV-Controller/.env
```

### Location-specific notes

- **Holmgren Way** (only Atlas-using location): the v2.19.0 atlas-guard
  passes through for type='atlas' and is a no-op performance-wise.
  Expected zero change in log spam volume.
- **Graystone + Holmgren Way** (multi-card Wolf Pack): the v2.18.2
  matrix routing fix is orthogonal to your non-zero `outputOffset`
  settings — those remain per-card and correct per your layout. The
  fix only repairs the parseInt-of-UUID bug. Verify-install's
  `matrix_config` layer still only catches the single-card variant;
  multi-card drift is operator-maintained per CLAUDE.md §5a.
- **Lucky's 1313**: all features built and verified tonight against
  real scheduled games. Reference implementation for the other sites.

### What NOT to panic about

- **`bartender-proxy` restart counter jumping by 1-2** during the
  update is expected (the proxy re-handshakes with the main app when
  PM2 recycles it). Only worry if it's restarting AFTER the update
  finishes and sports-bar-tv-controller is stable.
- **Hundreds of new SchedulerLog rows** with component=override-digest
  or failure-sweep every hour — that's the new autonomous agents
  reporting in. Info-level rows are the heartbeat; warn rows are the
  signal.
- **One merge conflict possible** on `apps/web/src/app/ai-hub/page.tsx`
  if your location had a local edit to that file. `auto-update.sh`'s
  `LOCATION_PATHS_OURS` doesn't cover it. If Checkpoint B reports a
  conflict here, the safe resolution is `git checkout --theirs` —
  this page is a shared AI UI, not location-specific data.

---

## Current entries

### v2.32.28 — Checkpoint API path now supports tool use (bash + read_file)
**Released:** 2026-04-25

v2.32.20's API path was a plain text-completion call. Checkpoint A/B/C
prompts expect the model to inspect git state, sqlite tables, .env, and
log tails before deciding GO/CAUTION/STOP. With no tool access, the
model correctly said "I cannot execute these commands" and returned
DECISION: STOP. Lucky's + Leg Lamp both failed at checkpoint_b on this.

**Changes:**
- New `scripts/checkpoint-runner.py` — Anthropic SDK-style messages loop
  with two tools: `bash` (cwd=repo root, 60s timeout, 64 KB output cap)
  and `read_file` (64 KB cap). Loops `tool_use → tool_result` up to 15
  turns until model emits text-only DECISION.
- `scripts/auto-update.sh run_checkpoint()` now invokes the runner
  instead of inline curl + python text-only call. CLI fallback path
  (when `ANTHROPIC_API_KEY` unset) is unchanged.

**Smoke-tested:** runner executed `sqlite3` against production.db and
returned a correct DECISION in 2 turns.

**Required Manual Step:** None. `python3` is already a hard dep of the
auto-update preflight (added in v2.32.20).

**Verification:**
```bash
# After next auto-update, look for the tool-use turns in the log
grep "checkpoint-runner" /home/ubuntu/sports-bar-data/update-logs/$(ls -t /home/ubuntu/sports-bar-data/update-logs/ | head -1) | head -10
# Expect lines like: turn=1 stop_reason=tool_use tool_uses=N
```

**Rollback:** `git revert` is clean. Old text-only API path is gone but
CLI fallback still functional for hosts without an API key.

---

### v2.32.27 — Source nvm in auto-update.sh + rollback.sh
**Released:** 2026-04-25

Hosts that installed Node via nvm (Leg Lamp) had `npm` only on the
interactive bash PATH, not on cron / setsid subshells. Auto-update.sh
exited 127 ("npm: command not found") at npm_ci or build phase, then
rollback.sh hit the same error trying to realign node_modules → exit
99 (CRITICAL: rollback failed) even though the git rollback itself
succeeded.

**Changes:**
- `scripts/auto-update.sh` sources `~/.nvm/nvm.sh` (if present) at
  the top, runs `nvm use default` to activate the alias.
- `scripts/rollback.sh` same source block at the top.
- Hosts using apt's `/usr/bin/npm` (graystone, luckys, appleton,
  greenville, holmgren) are unaffected — the nvm script is a no-op
  when `~/.nvm/nvm.sh` doesn't exist.

**Required Manual Step:** None. Hosts without nvm continue using
their system npm. Hosts with nvm pick up the default-version automatically.

**Verification (post-update at the affected location):**
```bash
which npm
# Expect: /usr/bin/npm OR /home/ubuntu/.nvm/versions/node/v20.20.0/bin/npm
bash -c '. ~/.nvm/nvm.sh --no-use && nvm use default >/dev/null && which npm'
# Expect: a valid path to npm
```

**Rollback:** `git revert` is clean.

---

### v2.32.26 — auto-update.sh: pre-clean working tree + CLAUDE.md takes main
**Released:** 2026-04-24

Unblocks the fleet from 4+ days of stuck nightly auto-updates. Two distinct
failure classes resolved:

**Class 1 — CLAUDE.md merge conflict (graystone today, others imminent).**
Main shipped v2.32.21/22 simplify pass (1122 → 672 lines, extracted to
satellites). Location branches carried local commits like holmgren-way's
`8610e1e2 docs(claude): add Fire TV Cube launcher-hosted Prime Video
gotcha (v2.28.9)`. Auto-resolver did NOT have `CLAUDE.md` in any
LOCATION_PATHS list → "merge conflict on non-whitelisted file" → exit 3.

**Class 2 — auto-update.sh self-update conflict (every location after the
bootstrap-fix dance).** Operator hot-patches a new `auto-update.sh` into
the working tree without committing. Next merge step then aborts with
"Your local changes would be overwritten by merge" → exit 4. Today's
workaround was a manual commit; that's now obviated.

**Changes:**
- `scripts/auto-update.sh` LOCATION_PATHS_THEIRS gains `CLAUDE.md`. Any
  conflict on `CLAUDE.md` automatically takes main's version.
- New PRE_MERGE_RESET_PATHS loop in the preflight phase: for any path that
  will take main's version anyway (auto-update.sh, rollback.sh,
  CLAUDE.md, package.json, etc.), `git checkout HEAD -- <path>` discards
  uncommitted edits before the fetch+merge step. The merge then proceeds
  cleanly and the conflict resolver overlays main's version on top.
- `CLAUDE.md` adds Standing Rule 9: "CLAUDE.md is main-only."

**Required Manual Step:** None. The fix lands as part of the merge into
each location. First post-fix update may still hit the bootstrap dance
once if it's already in flight; subsequent runs are clean.

**Verification:**
```bash
# After merge lands, on each location branch:
grep -A1 'LOCATION_PATHS_THEIRS=' scripts/auto-update.sh | grep CLAUDE.md
# Expect: "CLAUDE.md" inside the array (with the v2.32.26 comment block above it).

# Confirm pre-clean loop exists:
grep -n 'PRE_MERGE_RESET_PATHS' scripts/auto-update.sh
# Expect: a line in the preflight section (~line 487) plus the array def.
```

**Rollback:** `git revert <sha>` is safe — script reverts to v2.32.25
behavior. Only side effect: locations that had hot-patched
`auto-update.sh` in their working trees would again need a manual
commit before the next auto-update.

**Doesn't fix (intentionally):**
- Class 3 (Claude Code CLI not installed at graystone/appleton) is
  already handled by v2.32.20's API path — preflight at
  `scripts/auto-update.sh:466` skips the `claude --version` check when
  `ANTHROPIC_API_KEY` is set in `.env`.
- Class 4 (CLI cap exhaustion at Holmgren/leglamp) is the same — API
  path bills per-token with no monthly cap.

---

### v2.32.25 — Shift brief surfaces fleet-stuck alerts to bartender
**Released:** 2026-04-25

When sister locations are stuck on auto-update, the bartender's pre-shift
brief now flags it with a "TELL OWNER" line. Operator gets a heads-up
without having to navigate to /fleet.

**Why:** 4+ days of silent fleet-wide auto-update failures (graystone +
appleton: CLI not installed; leglamp: CLI cap exhausted). Fleet dashboard
showed `staleness: 'stuck'` but no notification path; operator had to
remember to check.

**Changes:**
- `apps/web/src/app/api/ai/shift-brief/route.ts` `gatherShiftContext()`
  fetches `/api/fleet/status` (8s timeout, soft-fail if unreachable) and
  builds a `fleetAlerts` array of stuck/warning sister locations.
- Prompt template adds a "Sister-location health" section + Format rule:
  "If STUCK locations, add ONE line: TELL OWNER: <names> stuck on
  auto-update."
- Fallback brief (LLM unavailable) appends the same alerts.

**Required Manual Step:** None. Pure additive change. Cache invalidates
on the existing 10-minute TTL — bartender sees alerts within 10 minutes
of fleet API turning red.

**Verification:**
```bash
curl -s 'http://localhost:3001/api/ai/shift-brief?force=true' | python3 -c "import sys,json; print(json.load(sys.stdin).get('brief',''))"
# If any sister location is stuck, expect a "TELL OWNER" line in the output.
```

**Rollback:** `git revert` is clean.

---

### v2.32.24 — bootstrap + auto-update WARN for missing ANTHROPIC_API_KEY
**Released:** 2026-04-24

All locations share the same `ANTHROPIC_API_KEY` (operator's
single key). Without it in `.env`, auto-update.sh falls back to the
Claude Code CLI subscription path — same path that hit "monthly usage
limit" today and triggered v2.32.20.

**Changes:**
- `scripts/bootstrap-new-location.sh` accepts `--anthropic-api-key sk-ant-...`
  and writes it to `.env` at first install. If neither flag nor existing
  `.env` value, prints a WARN.
- `scripts/auto-update.sh` preflight prints 3 WARN lines when the key is
  missing, with the exact `echo ... >> .env` snippet.

**Required Manual Step (CRITICAL — apply at every location):**

The same API key from the operator goes in every location's `.env`. SSH
into each host and run (idempotent — skips if already set):

```bash
KEY='sk-ant-...'  # paste the operator's shared key
ENV=/home/ubuntu/Sports-Bar-TV-Controller/.env
if ! grep -q '^ANTHROPIC_API_KEY=' "$ENV"; then
  echo "ANTHROPIC_API_KEY=$KEY" >> "$ENV"
  echo "[OK] added ANTHROPIC_API_KEY at $(hostname)"
else
  echo "[SKIP] $(hostname) already has ANTHROPIC_API_KEY"
fi
```

Locations to apply (in order; all 6):

1. holmgren-way (already done 2026-04-24)
2. graystone
3. lucky-s-1313
4. leg-lamp
5. stoneyard-appleton
6. stoneyard-greenville

**Verification:**

```bash
grep '^ANTHROPIC_API_KEY=' /home/ubuntu/Sports-Bar-TV-Controller/.env | sed 's/=.*/=<set>/'
# Expect: ANTHROPIC_API_KEY=<set>
```

After the next auto-update at each location, look for this log line:
```
Claude path: Anthropic API (model=claude-opus-4-7)
```
NOT this:
```
Claude path: Claude Code CLI (...)
WARN: ANTHROPIC_API_KEY missing from .env — using subscription CLI path.
```

**Rollback:** `git revert` is clean. The key in `.env` is harmless to leave in place.

---

### v2.32.23 — Hardware package READMEs + all location stubs (729 → 672 lines)
**Released:** 2026-04-24

Final cleanup pass. Cumulative CLAUDE.md size: 1122 → 672 (-40%). All
remaining "satellite extraction" candidates done.

**Per-package READMEs created (4 new):**
- `packages/crestron/README.md` — DM/HD-MD/DMPS/NVX models, Telnet/CTP/CIP, output slot offset table.
- `packages/bss-blu/README.md` — BSS Soundweb London BLU models, HiQnet TCP 1023.
- `packages/dbx-zonepro/README.md` — ZonePRO TCP 3804, NO F0/64/00 prefix, failsafe Scene 1 workaround.
- `packages/multiview/README.md` — 4K60 Quad-View hex frames, mode table, RS-232.

CLAUDE.md §6 (Crestron) / §7 (Audio) / §8 (Multi-View) compressed to
1-3 line refs pointing at the per-package READMEs.

**Location stubs created (4 new):**
- `.claude/locations/leg-lamp.md` (canary candidate; single-card matrix)
- `.claude/locations/stoneyard-appleton.md` (multi-card)
- `.claude/locations/stoneyard-greenville.md` (multi-card; v2.32.18 origin)
- Renamed `.claude/locations/lucky-s.md` → `lucky-s-1313.md` (matches `location/lucky-s-1313` branch).

`.claude/locations/README.md` updated with all 6 active locations + the
matching hardware-ref filenames + the per-location-IPs-go-here rule.

**Required Manual Step:** None at any location. Pure docs reorganization.

**Verification:**

```bash
wc -l /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md
# Expect: 672

ls /home/ubuntu/Sports-Bar-TV-Controller/.claude/locations/ | wc -l
# Expect: 7 (README + 6 location files)

ls /home/ubuntu/Sports-Bar-TV-Controller/packages/{crestron,bss-blu,dbx-zonepro,multiview}/README.md
# Expect: all 4 files present
```

**At each location's next auto-update**, Claude at Checkpoint B should
populate the location's `<branch>.md` device tables from the live DB
if they're still TBD stubs (already documented in the stubs).

**Rollback:** `git revert` is clean.

---

### v2.32.22 — CLAUDE.md deep simplify (961 → 729 lines)
**Released:** 2026-04-24

Second simplify pass. Cumulative 1122 → 729 (-35%). Extracted three
sections to satellite docs/files; preserved all rules + behavior.

**Extracted:**
- §Key Package @sports-bar/config (28 lines) → `packages/config/README.md` (new)
- §10 Holmgren Way Hardware (24 lines) → `.claude/locations/holmgren-way.md` (new). Per-location IPs were stale (192.168.4.x; actual is 10.11.3.x); new file pulls live IPs from DB.
- UI Styling Guide (103 lines) → `docs/UI_STYLING.md` (new). Tagged "recommended pattern, not hard rule" to match reality.

**Compressed in-place:**
- V2 Monorepo Architecture: dropped the inline 26-line package tree (operators run `ls packages/` for the live list).
- §8a Sports Guide Phase A/B/C/D narrative (15 lines → 1 paragraph). Consolidation is complete; phases are history.
- §9 AI Scheduling: dropped "prior to vX.Y.Z" historical prose, kept current behavior (~30 lines saved).

**New satellite files:**
- `.claude/locations/holmgren-way.md` — DB-sourced hardware reference for Holmgren.
- `packages/config/README.md` — full @sports-bar/config API + ConfigChangeTracker.
- `docs/UI_STYLING.md` — dark theme styling guide.

**Required Manual Step:** None. Pure docs reorganization.

**Verification:**

```bash
wc -l /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md
# Expect: 729

ls /home/ubuntu/Sports-Bar-TV-Controller/.claude/locations/holmgren-way.md \
   /home/ubuntu/Sports-Bar-TV-Controller/packages/config/README.md \
   /home/ubuntu/Sports-Bar-TV-Controller/docs/UI_STYLING.md
# Expect: all 3 files present
```

**Rollback:** `git revert` is clean.

---

### v2.32.21 — CLAUDE.md simplify pass (1122 → 961 lines)
**Released:** 2026-04-24

Tightened CLAUDE.md by ~14% via the bundled `simplify` skill workflow.
No semantic rule changes — just removed duplication, dead refs, and
prose bloat. All Standing Rules preserved with same intent, just
reformatted.

**Changes:**
- READ FIRST block trimmed to 2 numbered bullets (was 11 lines of prose).
- §5 Cable Box: dropped legacy CEC file list (`cable-box-cec-service.ts`
  etc — those files don't exist in repo anymore), kept the rule "no new
  CEC".
- §8 Wolf Pack Multi-View: was tagged "Future Implementation" but
  `packages/multiview/` is built (commands.ts, multiview-service.ts,
  serial-client.ts, types.ts). Reflected as implemented.
- API Route Patterns: replaced 50-line code block with 1-line summary
  + reference to canonical example route (50+ existing routes already
  document the pattern).
- Common Gotchas: collapsed #1 (body-stream) + #2 (GET no body) into
  one entry; removed dead `/api/cec/cable-box/test` curl example;
  renumbered #5a/#6/#7/#8/#9/#10 → #4/#5/#6/#7/#8/#9 (sequential).
- Standing Rules 1-8: kept all 8, tightened wording. Each is now 1-3
  sentences instead of paragraph-length. Defer-to-docs lines preserved
  for rules 5/7/8.
- Documentation References: removed broken link to non-existent
  `CEC_DEPRECATION_NOTICE.md`; added OBSBOT_TAIL_2_PLAN.md.

**Required Manual Step:** None. Pure docs change, no behavior impact.

**Verification:**

```bash
wc -l /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md
# Expect: 961
```

**Rollback:** `git revert` is clean.

---

### v2.32.20 — auto-update.sh: Anthropic API path replaces CLI subscription
**Released:** 2026-04-24

`scripts/auto-update.sh` now invokes the Anthropic API directly for
Checkpoint A/B/C decisions when `ANTHROPIC_API_KEY` is set in `.env`.
Falls back to the Claude Code CLI subscription path when the env var
is unset.

**Why:** The CLI path uses the user's Claude Pro/Max subscription,
which has a monthly token cap. Holmgren hit "You've hit your org's
monthly usage limit" on Checkpoint B mid-day 2026-04-24 → checkpoint
returned UNDETERMINED → automatic rollback. API path bills per-token
and has no monthly cap, so unattended cron updates can't be silently
defeated by quota exhaustion.

**Changes:**
- `run_checkpoint()` chooses path by `ANTHROPIC_API_KEY` presence.
  API path uses `curl` + `python3` to POST to `/v1/messages`, default
  model `claude-opus-4-7` (override via `CLAUDE_API_MODEL`).
- Preflight check accepts EITHER API key OR CLI binary; fails only
  when neither is available.
- `.env` is now sourced at the start of preflight so checkpoint phases
  see the API key. The original `.env` source at the build phase
  (line ~966) is preserved for Turbo/Next.js.

**Required Manual Step:** None per location IF `ANTHROPIC_API_KEY` is
already in `.env`. Locations without the key keep using the CLI path
automatically, no breakage.

**To opt INTO the API path** at a location that doesn't have the key:

```bash
# Get the actual key from the operator (1Password / shared secrets)
if ! grep -q '^ANTHROPIC_API_KEY=' /home/ubuntu/Sports-Bar-TV-Controller/.env; then
  echo 'ANTHROPIC_API_KEY=sk-ant-...' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
fi
```

After this, the next auto-update.sh run will use the API path. No
restart required (the script sources .env each invocation).

**Verification:**

```bash
# Confirm API path is being chosen at this location:
grep -E "Claude path:" /home/ubuntu/sports-bar-data/update-logs/$(ls -t /home/ubuntu/sports-bar-data/update-logs/ | head -1)
# Expect: "Claude path: Anthropic API (model=claude-opus-4-7)"
# CLI fallback shows: "Claude path: Claude Code CLI (...)"
```

**Rollback:** `git revert` is clean. The CLI path is preserved as the
fallback so removing the API call code doesn't break anything as long
as the CLI is still installed.

---

### v2.32.11 → v2.32.17 — Bartender remote: input tracking + logos + scheduler guards
**Released:** 2026-04-24

Seven small ships during a single Holmgren operator session. All
software-only / additive — no schema changes, no env vars required, no
seed data. Auto-update.sh handles the rebuild + PM2 restart.

**v2.32.11** — `bartender-schedule` POST: tolerant lookup when client
sends `awayTeam="Unknown"` or `""`. Fallback path matches `homeTeamName`
+ empty `awayTeamName` + ±1hr time window. Unblocks NFL Draft, UFC PPV,
and other single-entity events from 404'ing.

**v2.32.12** — Past-game guards (server + client). POST returns 400 if
`endTime < now`. Channel-guide remote short-circuits with operator hint
before POST when program endTime (or startTime + 3h fallback) is past.
Stops auto-reverter churn from operators tapping yesterday's session
of a multi-day event still visible in Rail Media (NFL Draft, Masters).

**v2.32.13** — Fire TV current-app mirrored into `InputCurrentChannel`.
Two write paths: (a) `firestick-scout` heartbeat upserts when scout
reports `currentApp`; (b) `channel-presets/tune` route resolves Fire TV
matrix input via `FireTVDevice.inputChannel` and runs the same upsert
that cable/DirecTV use. Stored as `channelNumber="APP"`,
`channelName=<friendly>`. UI render branches on `"APP"` to show app
name instead of `Ch APP`.

**v2.32.14** — 17 new streaming-app logo registers in `channel-logos.ts`
(Netflix, Disney+, Hulu, Max, YouTube, fubo, Sling, DAZN, Tubi, Pluto,
Vudu, DirecTV Stream, MLB.TV, NBA, NHL, NFL, NFHS, B1G+, NBC Sports,
Fox Sports app, Atmosphere, Home).

**v2.32.15** — `GET /api/matrix/current-channels` hydrates empty
`channelName` from `ChannelPreset` table by `${deviceType}|${channelNumber}`
lookup. Fixes missing logos on cable/DirecTV inputs (tune route only sets
channelName when user clicks a labeled preset; manual tunes left it null,
which suppressed logo render).

**v2.32.16** — Server-side current-app poll. New `pollFiretvCurrentApp`
tick in scheduler-service (60s interval, 45s initial delay) hits
`/api/firetv-devices/[id]/current-app` for each online + non-disabled +
inputChannel-mapped Fire TV. The endpoint also upserts InputCurrentChannel
after the ADB probe. Workaround for older Sports Bar Scout APK builds at
Holmgren that report empty `currentApp` in heartbeats.

**v2.32.17** — Channel logo badge fallback. SimpleIcons removed many
trademarked sports brand logos in 2025 (espn, nfl, hulu, peacock,
primevideo, foxsports, sling, pluto, disneyplus all 404). New
`apps/web/src/components/ui/channel-logo.tsx` `<ChannelLogo>` component
swaps to text badge on `<img>` onError. 9 broken `SI()` calls null'd
in channel-logos.ts (each already has colored badge defined). 14 new
register entries (Spanish networks, Bally MW, NHL Center Ice, UEFA,
Willow Cricket, Overtime, Fox Sports Prime, DTV PPV, FDNOR+, AMZNP).
`normalizeForLogo()` strips parens + trailing `-SD`.

**Required Manual Step:** None. All seven versions are software-only;
build + PM2 restart (handled by auto-update.sh) is sufficient.

**Verification (post-update, optional):**

```bash
# v2.32.13 + v2.32.16 — Fire TV input rows should appear within 60s of restart
DB=/home/ubuntu/sports-bar-data/production.db
sqlite3 "$DB" "SELECT inputNum, inputLabel, channelNumber, channelName FROM InputCurrentChannel WHERE deviceType='firetv';"
# Expect: rows for each online Fire TV with channelNumber='APP' and friendly app name.

# v2.32.15 — current-channels endpoint should return non-null channelName for cable/DirecTV with known channels
curl -s http://localhost:3001/api/matrix/current-channels | python3 -c "import sys,json; d=json.load(sys.stdin); [print(k, v.get('inputLabel'), v.get('channelNumber'), v.get('channelName')) for k,v in sorted(d['channels'].items(), key=lambda x: int(x[0]))]"
# Expect: cable boxes 1-4 show ESPN/ESPN2/ESPN U/ESPN News, DirecTV inputs show their network names.
```

**Rollback:** `git revert` is clean for any of these — pure software,
no DB/data side effects. InputCurrentChannel rows added by v2.32.13/16
are harmless if left after revert (UI just won't read them).

<!-- verify-description: production.db reachable + Fire TV devices have inputChannel mapping (required by v2.32.13/16 mirror path) -->
<!-- verify-sql: SELECT id FROM FireTVDevice WHERE inputChannel IS NOT NULL AND inputChannel > 0 LIMIT 1 -->

---

### v2.32.4 → v2.32.7 — Auto-update robustness Phases 1-4
**Released:** 2026-04-23

Hardens `scripts/auto-update.sh` against the cross-location failure modes
mapped during the v2.31-tonight session. Four orthogonal pieces, all
backward-compatible (no behavior change at locations until they next
auto-update).

**v2.32.4 (Phase 1 — quick wins):**
- `apps/web/data/station-aliases-local.json` added to
  `LOCATION_PATHS_OURS`. Closes a ticking time bomb: any future merge
  touching this file at any location with custom OTA aliases would have
  hit "unexpected conflict" and aborted with exit 3 (no rollback,
  half-merged tree).
- Pre-flight env-var scan after fetch / before Checkpoint A. Greps the
  incoming diff for new `process.env.X` references and warns if X isn't
  in the current `.env`. Warn-only — no STOP — many env vars have
  code-side fallbacks.
- Heartbeat (`.auto-update-last-success.json`) v2 schema: adds
  `configChecksums` (16-char SHA-256 prefixes of `.env`,
  `tv-layout.json`, `station-aliases-local.json`,
  `hardware-config.ts`) and `dbRowCounts` (Location, AuthPin,
  MatrixConfiguration, HomeTeam, ChannelPreset, station_aliases).
  Lets the Fleet Dashboard detect drift without polling each location.

**v2.32.5 (Phase 2 — DB rollback hardening):**
- `auto-update.sh` schema_push phase greps drizzle output for
  destructive operations (DROP TABLE / DROP COLUMN / data-loss /
  truncate). If detected, writes a small companion file
  `$BACKUP_FILE.destructive` next to the pre-update SQLite backup.
- `rollback.sh` checks for the marker after git reset. If present (and
  the backup file exists), snapshots the current half-migrated DB and
  restores production.db from the pre-update backup BEFORE rebuilding,
  so the rolled-back code runs against the schema it expects. Also
  removes WAL/SHM files for clean reopen.
- Additive schema (the normal case) leaves the DB untouched on rollback
  because additive changes are forward-compatible with old code.

**v2.32.6 (Phase 3 — canary location pattern):**
- New `scripts/canary-config.json` with `enabled: false` default. Opt-in.
- When enabled AND non-canary branch: `auto-update.sh` checks the
  canary's `.canary-blessed.json` (in the canary's git branch) before
  merging. Skips with no-op if canary hasn't blessed the target SHA OR
  if the bless is younger than `minBlessAgeMinutes` (default 240).
- When enabled AND canary branch: writes/commits/pushes
  `.canary-blessed.json` after a successful run.
- Bad commits break only the canary; the other 5 locations skip and
  retry on the next nightly cron.

**v2.32.7 (Phase 4 — VERSION_SETUP_GUIDE verify markers):**
- New marker format in version entries: `<!-- verify-sql: SELECT ... -->`
  with optional `<!-- verify-description: ... -->`.
- Checkpoint B parses entries between PRE/POST_MERGE_VERSION, runs each
  marker's SQL, returns `DECISION: STOP` if any returns 0 rows.
- Forward-only enforcement: entries pre-dating v2.32.7 stay advisory.
- See `docs/CLAUDE_VERSIONING_GUIDE.md` "Verify-SQL markers" for usage
  rules.

**Required manual steps PER LOCATION:** None for any of these. All four
ship as auto-update.sh changes that take effect on the next cron run at
each location. Verify post-deploy:

```bash
# After a location's auto-update runs once on v2.32.4+, the heartbeat
# file should have configChecksums + dbRowCounts + heartbeatSchemaVersion=2:
cat /home/ubuntu/Sports-Bar-TV-Controller/.auto-update-last-success.json | head -20
```

**To opt INTO canary mode** (Phase 3) at a future date:
1. Decide which location is the canary (recommended: Leg Lamp — single-card
   matrix, lowest blast-radius).
2. On `main`, edit `scripts/canary-config.json` to set `"enabled": true`
   and `"canaryBranch": "location/leg-lamp"`. Commit + push.
3. Next auto-update run at any non-canary location will start gating on
   the canary's bless. The canary itself is exempt and proceeds normally.

**Worked example of a verify-sql marker** (proof-of-concept; this entry's
own preconditions are met by the auto-update changes themselves, no DB
state required, but the marker below confirms the production DB is
reachable from Checkpoint B at all):

<!-- verify-description: production.db is reachable and has the canonical Location row seeded -->
<!-- verify-sql: SELECT id FROM Location LIMIT 1 -->

---

### v2.31.2 + v2.31.3 + v2.31.4 — Streaming click actually launches; walker navigates to Sports tab
**Released:** 2026-04-23

**What changed:**

- `apps/web/src/app/api/channel-guide/route.ts` (v2.31.2 + v2.31.3):
  - Both streaming injection paths (broadcast_networks fallback AND v2.30.0
    catalog injection) now look up the streaming-apps-database catalog by
    display name and populate `appId`, `packageName`, `packages` on the
    channel object.
  - v2.31.3 added `DISPLAY_NAME_TO_CATALOG_ID` alias map keyed by
    lowercase display name → catalog id. Covers display-name drift where
    scout reports `"Prime Video"` but catalog has `name="Amazon Prime Video"`,
    resolver returns `"ESPN+"` but catalog has `name="ESPN"`, and so on.
    `findStreamingAppByDisplayName(name)` is the canonical lookup helper.

- `apps/web/src/components/EnhancedChannelGuideBartenderRemote.tsx` (v2.31.2):
  - `handleGameClick` streaming case now prefers `/api/streaming/launch`
    (via new helper `launchStreamingAppByCatalog`) when `channel.appId` is
    present. That path goes through `streamingManager.launchApp()` which
    knows about the firebat alias for `amazon-prime` (v2.28.8) and
    correctly resolves the LEANBACK_LAUNCHER activity (DeepLinkRoutingActivity
    → LandingActivity) — the same activity the home-screen Prime Video
    tile invokes.
  - Falls back to the legacy `monkey -p ${packageName}` direct launch when
    `appId` is absent (preserves Rail Media compatibility for programs
    that pre-date this).

- `packages/scheduler/src/firetv-catalog-walker.ts` (v2.31.4):
  - `AppWalkRule.navigation` (new optional field): list of ADB key codes
    sent after launch to navigate to a sports/live tab. Sent in order with
    `interKeyDelayMs` between each (default 400ms), then `postNavDelayMs`
    after the sequence (default 4000ms).
  - Prime Video rule now includes `navigation: { keyevents: [19,19,22,22,22,23] }`
    — UP UP RIGHT RIGHT RIGHT OK navigates from the LandingActivity to
    the Sports tab on Fire TV Cube 2nd gen (AFTR) PVFTV-215.5200-L.
  - Extractor noise filter tightened: drops standalone `LIVE`/`UPCOMING`
    badges, `"Live at <time>"` generic timeslots, `"More details"`, and
    standalone `"all"`. Recognizes `"Sports for you"` as a sport-row
    context anchor.

**Why this was needed:**

Operator reported clicking a Prime Video program in the channel guide
"and nothing happened." Three stacked bugs caused the silent failure:

1. The channel-guide injection set `channel.packages` (plural array) but
   left `channel.packageName` undefined. The bartender remote reads
   `channel.packageName` (singular) — undefined triggered no fall-through,
   so the click was a no-op.
2. Even when `packageName` got populated (Rail Media path), the launch
   used `monkey -p ${packageName} 1` directly. On Fire TV Cube 2nd gen
   Prime Video lives inside `com.amazon.firebat` (the launcher) — there's
   no `com.amazon.avod` package. `monkey -p com.amazon.avod` fails
   silently. `monkey -p com.amazon.firebat` launches the home screen, NOT
   the Prime Video LandingActivity.
3. The walker's daily 04:00 walk only captured 1 useless tile per box
   (`"Live at 5:30 PM"`) because Prime Video's home screen rotates
   content — TV shows in the afternoon, sports in the morning. The walk
   needed to navigate to the Sports tab for stable sports-only catalog.

**Required steps PER LOCATION:**

**No DB or .env changes.** All three fixes are code-only.

**Verify the click works end-to-end (server-simulated, no Fire TV
operator needed):**
```bash
# 1. Send HOME on the Fire TV
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-id>","command":"input keyevent 3"}'
sleep 2

# 2. Simulate the bartender click (this is exactly what the React
# component does when channel.appId is present)
curl -X POST http://localhost:3001/api/streaming/launch \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-id>","ipAddress":"<ip>","appId":"amazon-prime","port":5555}'
sleep 4

# 3. Confirm Prime Video LandingActivity is now in the foreground
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-id>","command":"dumpsys window windows"}' \
  | grep mCurrentFocus
# Expect: ...com.amazon.firebat/com.amazon.firebat.livingroom.landing.LandingActivity
```

**Verify the walker now captures rich sports content:**
```bash
# Trigger an immediate walk (bypasses the 6h cooldown)
curl -X POST http://localhost:3001/api/firestick-scout/catalog/walk

# Check what was captured
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceId, app, contentTitle, isLive, sportTag
   FROM firetv_streaming_catalog
   ORDER BY isLive DESC, contentTitle;"
```
Expected: ~10 tiles per Fire TV with Prime Video — mix of LIVE
(tennis/squash/soccer) and UPCOMING (NBA Playoffs in current season).
If still only 1-2 tiles, Prime Video's UI may have changed and the
`navigation.keyevents` sequence in firetv-catalog-walker.ts needs
re-mapping (run a manual `uiautomator dump` and confirm the Sports tab
position is still 4 of 8).

**Adding navigation for a new app's rule:**
1. Manually launch the app on a Fire TV.
2. Watch where focus lands — usually the first content row.
3. Identify the keyevents needed to reach the Sports tab. ADB keyevents:
   UP=19 DOWN=20 LEFT=21 RIGHT=22 OK=23.
4. Test the sequence by sending each keyevent via
   `/api/firetv-devices/send-command` then `dumpsys window windows` to
   confirm the focused activity changed.
5. Add the `navigation` block to the new app's `APP_WALK_RULES` entry.

---

### v2.31.0 + v2.31.1 — Per-box per-app sports content catalog (Phase 2b-2 + Phase 3)
**Released:** 2026-04-22

**What changed:**

- `packages/database/src/schema.ts` (v2.30.0):
  - New table `firetv_streaming_catalog` (deviceId, app, contentTitle,
    deepLink, isLive, sportTag, capturedAt, expiresAt, createdAt) with
    indexes on (deviceId, app) and expiresAt. Per-box per-app sports
    content tile inventory — overwritten daily by the walker.

- `apps/web/src/app/api/firestick-scout/catalog/route.ts` (v2.30.0, new):
  - POST ingests fresh catalog from the walker; per-app replace semantics
    (delete then insert per app present in the upload). IP-based canonical
    deviceId resolver mirrors v2.28.10's heartbeat resolver.
  - GET reads catalog filtered by deviceId / app / liveOnly. Auto-prunes
    expired rows.

- `apps/web/src/app/api/channel-guide/route.ts` (v2.30.0):
  - After the broadcast_networks fallback, queries firetv_streaming_catalog
    for the requested deviceId, dedupes against existing programs, injects
    each remaining catalog row as a streaming program. Carries deepLink
    and sportTag through. Non-fatal — channel guide continues if catalog
    query fails.

- `packages/scheduler/src/firetv-catalog-walker.ts` (v2.31.0, new):
  - `runFiretvCatalogWalk()`: for each active firetv input_source, for
    each app in `available_networks` that has a rule in APP_WALK_RULES,
    sends HOME, launches the app via /api/streaming/launch, waits for
    first screen render (per-app delay), runs `uiautomator dump`, parses
    tiles via the per-app extractor, POSTs to /api/firestick-scout/catalog,
    sends HOME, moves to next app.
  - Prime Video extractor empirically validated against Fire TV Cube 2nd
    gen (AFTR) on 2026-04-22 — captured 10 real tiles in one walk
    (4 LIVE: ATP/WTA tennis, PSL cricket, squash + 6 UPCOMING NBA
    playoff games). Per-app rules in APP_WALK_RULES — apps without a
    rule are skipped silently (no false data).
  - Architecture: server-side ADB walker (NOT Kotlin AccessibilityService).
    Reasons documented in the file's header comment — short version:
    AccessibilityService requires manual Settings toggle ADB can't
    reliably bypass; TypeScript per-app rules iterate at edit-and-restart
    speed instead of compile-and-flash speed.

- `packages/scheduler/src/scheduler-service.ts` (v2.31.0):
  - `maybeRunCatalogWalk()`: triggers daily catalog walk between 04:00–04:05
    America/Chicago OR after 25h+ gap (catch-up after long downtime).
    6h cooldown prevents double-runs. Tick every 5 min.
  - `triggerCatalogWalkNow()`: public method for manual ad-hoc trigger.

- `apps/web/src/app/api/firestick-scout/catalog/walk/route.ts` (v2.31.0, new):
  - POST endpoint for operator to trigger an immediate walk (e.g. after
    installing a new app on a Fire TV). Bypasses the cooldown.

- `packages/scheduler/src/firetv-catalog-walker.ts` (v2.31.1):
  - Removed `2>/dev/null` from the uiautomator dump command. The
    send-command API mangles shell redirections; without the suffix, the
    dump succeeds and the file is readable. Added `rm -f` before dump
    to prevent stale files from masking failures, plus a 500ms grace
    after dump for the file write to flush. First production walk after
    this fix captured 10 tiles in 22s.

**Why this was needed:**

Earlier phases (v2.28.10 → v2.29.1) made the scheduler aware of per-box
APP availability (which Fire TV has Prime Video, which has Peacock, etc.).
But "what's actually playable inside each app right now" — the per-box
sports catalog — was still missing. Without it, the bartender opens the
channel guide for a Fire TV box and sees only games tagged in ESPN's
broadcast_networks JSON. Anything Prime Video shows on its sports tab
(LIVE NOW tennis, NBA Playoffs row, cricket overflow, etc.) was invisible
unless ESPN happened to tag the same game.

This version delivers the missing per-box catalog by walking each app's
first screen via uiautomator dump (no APK rebuild, no AccessibilityService
permission gate) and surfacing the captured tiles in the channel guide
alongside ESPN-broadcast_networks games. Per-app extraction rules — start
with Prime Video, add others incrementally as the operator needs them.

**Required steps PER LOCATION:**

**No DB migrations needed beyond the table creation.** The
`firetv_streaming_catalog` table is auto-created on schema push (or via the
manual SQL snippet below if drizzle-kit silently skips it — see CLAUDE.md
gotcha #7).

**Manual table creation if drizzle-kit push fails:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
CREATE TABLE IF NOT EXISTS firetv_streaming_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  deviceId TEXT NOT NULL,
  app TEXT NOT NULL,
  contentTitle TEXT NOT NULL,
  deepLink TEXT,
  isLive INTEGER DEFAULT 0,
  sportTag TEXT,
  capturedAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS firetv_catalog_device_app_idx ON firetv_streaming_catalog (deviceId, app);
CREATE INDEX IF NOT EXISTS firetv_catalog_expires_idx ON firetv_streaming_catalog (expiresAt);
SQL
```

**Verify the daily walk fires** (after 04:00 local OR via manual trigger):
```bash
# Manual trigger (bypasses cooldown):
curl -X POST http://localhost:3001/api/firestick-scout/catalog/walk

# Then check what was captured:
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceId, app, contentTitle, isLive, sportTag
   FROM firetv_streaming_catalog
   ORDER BY deviceId, isLive DESC, contentTitle;"
```

If a Fire TV's row count is 0 for an app it should have:
1. Confirm scout heartbeat is fresh and shows the app installed:
   `sqlite3 production.db "SELECT deviceId, installedApps FROM firestick_live_status WHERE deviceId LIKE '%firetv%';"`
2. Confirm the app has an APP_WALK_RULES entry in
   `packages/scheduler/src/firetv-catalog-walker.ts` (only Prime Video as
   of v2.31.0 — other apps are silently skipped).
3. Run the manual walk endpoint with `pm2 logs sports-bar-tv-controller`
   tailing in another shell to see [FIRETV-CATALOG] messages.

**Adding a new app's per-app extraction rule:**
1. Manually open the app on a Fire TV.
2. Run `uiautomator dump /sdcard/d.xml` then `cat /sdcard/d.xml` via the
   send-command endpoint to capture the tile XML pattern.
3. Add a new entry to `APP_WALK_RULES` in
   `packages/scheduler/src/firetv-catalog-walker.ts` mirroring the
   `extractPrimeVideoTiles` shape.
4. Restart PM2; the daily cron + manual trigger will pick up the new app.

---

### v2.29.0 — Per-box auto-discovery of Fire TV streaming apps via Sports Bar Scout
**Released:** 2026-04-22

**What changed:**

- `packages/scheduler/src/firetv-app-sync.ts` (new):
  - `runFiretvAppSyncSweep()` reconciles every active firetv `input_source`
    against the latest scout heartbeat in `firestick_live_status`. Pulls
    `loggedInApps` (or falls back to `installedApps`) from scout, translates
    Android package names → display names, writes the truth back to
    `input_sources.installed_apps` and `input_sources.available_networks`.
  - Staleness guard: skips inputs whose scout heartbeat is >5 min old
    (preserves prior data instead of blanking on a temporary scout outage).
  - Idempotent: only writes when the computed list differs from stored.
  - Launcher-hosted Prime Video back-fill: scout's AppDetector hard-codes
    `com.amazon.avod` and misses launcher-hosted Prime Video on AFTR Cubes
    (CLAUDE.md gotcha #10). When scout reports no Prime Video, this job
    probes `pm path com.amazon.firebat` directly via the device control
    endpoint; if firebat is present, "Prime Video" is added to
    `available_networks` and `com.amazon.firebat` to `installed_apps`.

- `apps/web/src/app/api/firestick-scout/route.ts` (v2.28.10 — bundled into this entry):
  - When a heartbeat arrives with `deviceId='fire-tv-unknown'` or a legacy
    id (`amazon-N`, `fire-tv-N`), the server resolves the canonical
    `FireTVDevice.id` by matching `ipAddress`. Fixes the Holmgren-class
    bug where scout's compile-time IP_DEVICE_MAP only knew Stoneyard IPs
    (`10.40.10.x`) and every Fire TV at any other location heartbeated as
    `fire-tv-unknown` — multiple boxes overwriting each other's row.

- `packages/scheduler/src/scheduler-service.ts`:
  - Wired `runFiretvAppSync()` into the startup sequence: 60s after boot
    + every 5 minutes thereafter. Errors are caught so a sync failure
    never crashes the scheduler tick.

**Why this was needed:**

`input_sources.available_networks` and `installed_apps` were originally
hand-maintained admin metadata. Operators forget to update them when apps
are installed/uninstalled at the device, so AI Suggest ends up either
promising games on Fire TVs that no longer have the app or hiding games
Fire TVs CAN play. Sports Bar Scout (deployed as `com.sportsbar.scout`
on every venue's Fire TVs) already heartbeats the on-device truth every
30 seconds — this job is the bridge that makes the rest of the
scheduling stack consume that truth instead of trusting stale metadata.

Verified at Holmgren Way 2026-04-22:

```
Fire TV 2 (firetv_1741700000002_holmgren2) → fubo, YouTube, ESPN, NFHS,
                                              Peacock, Apple TV+, Netflix,
                                              Prime Video (via firebat probe)
Fire TV 3 (firetv_1741700000003_holmgren3) → YouTube, ESPN, NFHS, Peacock,
                                              Prime Video (via firebat probe)
```

Note Fire TV 2 has Netflix + fubo + Apple TV+ that Fire TV 3 doesn't —
the per-box differentiation that previously was invisible to AI Suggest.

**Required steps PER LOCATION:**

**No DB or .env changes.** The sync is automatic.

**Verify scout is heartbeating from each Fire TV:**
```bash
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceId, deviceName, ipAddress, datetime(lastHeartbeat) as last_hb
   FROM firestick_live_status
   ORDER BY lastHeartbeat DESC;"
```
- Each active Fire TV input should have a row with `lastHeartbeat` within
  the last 2 minutes.
- `deviceId` should match the corresponding `FireTVDevice.id` (the canonical
  id, e.g. `firetv_1741700000002_holmgren2`). Legacy `amazon-N` /
  `fire-tv-unknown` rows are auto-resolved by the v2.28.10 IP resolver but
  you can clean up old rows if any persist:
  ```bash
  sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "DELETE FROM firestick_live_status
     WHERE deviceId NOT LIKE 'firetv_%'
       AND lastHeartbeat < datetime('now', '-1 hour');"
  ```

**If scout isn't heartbeating** on a particular Fire TV: scout's
compile-time `scoutServerUrl` may be wrong for your location. Send a
CONFIG broadcast via ADB to repoint it:
```bash
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId":"<your-firetv-input.deviceId>",
    "command":"am broadcast -a com.sportsbar.scout.CONFIG --es server_url http://<your-server-ip>:3001/api/firestick-scout -n com.sportsbar.scout/.ConfigReceiver"
  }'
```
Then force-stop and relaunch scout:
```bash
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-input.deviceId>","command":"am force-stop com.sportsbar.scout"}'
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-input.deviceId>","command":"monkey -p com.sportsbar.scout -c android.intent.category.LAUNCHER 1"}'
```

**Verify the sync is updating input_sources** (after waiting one cycle):
```bash
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, available_networks FROM input_sources WHERE type='firetv' ORDER BY name;"
```
Each row's `available_networks` should reflect the actual installed apps
from scout, plus Prime Video if firebat is present (Cubes).

To force a sync immediately without waiting 5 min, restart PM2 and the
sync will fire 60 seconds after startup.

---

### v2.28.8 — Launch Prime Video on Fire TV Cubes that ship it baked into the launcher (no com.amazon.avod APK)
**Released:** 2026-04-22

**What changed:**

- `packages/streaming/src/streaming-apps-database.ts`:
  - Added `com.amazon.firebat` as a `packageAlias` on the `amazon-prime`
    catalog entry (now `[com.amazon.avod.thirdpartyclient, com.amazon.firebat]`).

**Why this was needed:**

On Fire TV Cube 2nd gen (model AFTR, Fire OS 7.7) and other Cubes shipping
the PVFTV (Prime Video Fire TV) launcher build, **there is no separate
`com.amazon.avod` APK on disk** — Prime Video is hosted entirely inside the
launcher (`com.amazon.firebat`). Settings → Applications → Manage Installed
Applications shows a "Prime Video" entry with version like `PVFTV-215.5200-L`,
but that entry is the launcher itself (Amazon brands it as "Prime Video"
in the user-facing list). The actual installable Amazon Prime Video app
(`com.amazon.avod`) is NOT present.

Result before this fix: `streamingManager.launchApp('amazon-prime')` would
probe `com.amazon.avod` and `com.amazon.avod.thirdpartyclient`, find neither,
log "Amazon Prime Video is not installed on device", and return failure —
even though the bartender can click the Prime Video tile on the home screen
and have it work fine. AI Suggest's Prime Video suggestions and bartender
remote launches both failed silently for these Cubes.

After this fix: the launcher (`com.amazon.firebat`) is registered as a valid
Prime Video host. `adb-client.launchApp()` resolves
`cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER com.amazon.firebat`,
which returns `com.amazon.firebat/com.amazon.firebatcore.deeplink.DeepLinkRoutingActivity`
— the same activity the home-screen Prime Video tile invokes, routing to
`livingroom.landing.LandingActivity` (the Prime Video browse screen).
Verified end-to-end on Fire TV Cube 2nd gen at Holmgren Way (Fire TV 2,
10.11.3.50): foreground activity post-launch matches the user's manual
tile-click.

**Required steps PER LOCATION:**

**No DB or .env changes.** The catalog change ships in v2.28.8. After
auto-update merges + rebuilds + restarts PM2, `POST /api/streaming/launch`
with `appId='amazon-prime'` will succeed on any Fire TV Cube whose Prime
Video is launcher-hosted (in addition to all Cubes that have the standalone
`com.amazon.avod` APK, which were already supported).

**Verify your Fire TV Cubes' Prime Video launch path** (optional sanity check):
```bash
# Replace deviceId/ipAddress with one of your Fire TV Cubes:
curl -s -X POST http://localhost:3001/api/streaming/launch \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<your-firetv-id>","ipAddress":"<ip>","appId":"amazon-prime","port":5555}'
# Expect: {"success":true,"message":"Successfully launched app amazon-prime",...}
# Walk to the TV — Prime Video browse screen should be visible.
```

If `success:false` with "Amazon Prime Video is not installed", the Cube has
neither `com.amazon.avod` NOR `com.amazon.firebat` (uncommon — would suggest
an unusual build). Check `pm list packages` on the device for the actual
Prime Video host package and add it as an alias.

---

### v2.28.7 — Fix smart-input-allocator excluding Fire TVs from every Prime Video / Hulu / Netflix / Max / YouTube TV game
**Released:** 2026-04-22

**What changed:**

- `packages/scheduler/src/smart-input-allocator.ts` `findCapableInputs()`:
  - Removed the Fire-TV-specific override that was filtering out every
    Fire TV input for almost every streaming game. Now uses the same
    `availableNetworks.includes(targetNetwork)` check that ai-suggest,
    bartender-remote, and conflict-detector all use.

**Why this was needed:**

The override had two compounding bugs that made it always-false-for-firetv-streaming:

1. **Hardcoded whitelist was missing most apps.** The list was literally
   `['ESPN', 'Peacock', 'Paramount+', 'Apple TV']` — no Prime Video, no
   Hulu, no Netflix, no Max, no YouTube TV, no MLB.TV, no NBA League Pass,
   no ESPN+. A Prime Video TNF game requested via `POST /api/scheduling/allocate`
   would silently exclude every Fire TV input ("Prime Video".includes('ESPN')
   = false, etc.).
2. **Wrong shape on the second predicate.** `installedApps.includes(app)`
   compared display names ('ESPN') against an array of Android package names
   (`com.amazon.avod`, `com.peacocktv.peacock`, ...). Even for the four
   whitelisted apps, this always returned false.

Net effect: any allocation request whose `preferredNetwork` was a streaming
service silently filtered out every Fire TV input. The bartender's "approve
this AI Suggest" or "Schedule from channel guide" flows for Prime Video games
would either fail to allocate or fall back to a non-streaming source (cable
boxes that don't have the game). Operator at Holmgren noticed that Fire TV 2
and Fire TV 3 weren't being picked up for Prime Video — both have
`com.amazon.avod` in `installed_apps` and `"Prime Video"` in
`available_networks`, but the broken gate hid them anyway.

ai-suggest's GET handler (which generates the suggestions) was unaffected
because it uses a separate, correct gate based on `availableNetworks`.
The bug was only at the approve/allocate step. So suggestions could mention
Prime Video games but the approval would silently fall over.

**Required steps PER LOCATION:**

**No DB or .env changes.** The fix is code-only. After auto-update merges
+ rebuilds + restarts PM2, the next streaming-game allocation request will
correctly consider Fire TVs whose `availableNetworks` lists the network.

**Verify your Fire TV inputs are populated correctly:**
```bash
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, available_networks FROM input_sources WHERE type='firetv' ORDER BY name;"
```
Each Fire TV's `available_networks` should be a JSON array of display names
matching what the network resolver returns (e.g. `"Prime Video"`, `"Apple TV+"`,
`"Peacock"`, `"ESPN+"`, `"Max"`, `"Paramount+"`, `"Hulu"`, `"Netflix"`,
`"YouTube TV"`). If a Fire TV is missing an app it actually has, edit it via
the Device Config UI — the missing entry is what was hiding it.

`installed_apps` (the package-name list) is no longer consulted by the
allocator gate, so it does not need to be perfect. It's still kept for
device-side launch via ADB.

---

### v2.28.6 — Cancel pending allocations whose game already ended (stops infinite tune retries)
**Released:** 2026-04-22

**What changed:**

- `packages/scheduler/src/scheduler-service.ts`:
  - `checkAndExecuteBartenderSchedules()` now guards every loop iteration
    with a "game already ended?" check BEFORE attempting the tune. If
    `game.status` is one of `completed`/`final`/`postponed`/`canceled`/`cancelled`,
    OR the wall-clock is more than 30 minutes past `game.estimatedEnd`,
    the allocation is marked `cancelled` (with `actually_freed_at=now` and
    a `qualityNotes` reason), a `scheduler-service tune` SchedulerLog row
    is written with `metadata.reason='game_ended_before_tune'`, and the
    iteration `continue`s instead of calling the tune API.

**Why this was needed:**

Until v2.28.6, an allocation that stayed `pending` (because every tune
attempt failed) would be re-selected every minute by the scheduler poll
forever. There was no failure cap and no game-end gate. On 2026-04-21 a
single stuck Celtics @ 76ers allocation pointed at DirecTV channel 220
(NBCSN — channel 220 doesn't exist on DirecTV; NBCSN ceased operations
in 2022 and the broadcast actually ran on Peacock) racked up **2,094**
failed tune attempts over 41 hours before it was caught manually. The
revert sweep can't help because reverts only fire when the allocation
transitions from `active` → freed; an allocation that never reaches
`active` is invisible to revert.

**Required steps PER LOCATION** (Claude Code at each location must run):

**Step 1 — Acute cleanup: cancel any allocation already stuck in this state.**
This finds pending allocations whose game has ended and the tune is
clearly never going to succeed. Idempotent — safe to re-run on a clean DB
(returns 0 rows updated).
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "
UPDATE input_source_allocations
SET status='cancelled',
    actually_freed_at=strftime('%s','now'),
    quality_notes='v2.28.6 backfill: pending allocation whose game already ended',
    updated_at=strftime('%s','now')
WHERE status='pending'
  AND game_schedule_id IN (
    SELECT id FROM game_schedules
    WHERE LOWER(status) IN ('completed','final','postponed','canceled','cancelled')
       OR estimated_end < strftime('%s','now') - 1800
  );
SELECT changes() as cleaned_up;"
```

**Step 2 — No code-side action required.** The new guard ships in the v2.28.6
build. After the auto-update merges + rebuilds + restarts PM2, future
stale-pending allocations will self-cancel on the next 60s poll cycle and
each cancellation writes a `scheduler-service tune` log row with
`level='info'`, `metadata.reason='game_ended_before_tune'` for visibility.

**Step 3 — Verify the guard fires (optional, when the next stale pending
allocation appears naturally):**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT datetime(createdAt, 'unixepoch', 'localtime') as ts,
       message,
       json_extract(metadata, '$.reason') as reason
FROM SchedulerLog
WHERE component='scheduler-service'
  AND operation='tune'
  AND json_extract(metadata, '$.reason')='game_ended_before_tune'
ORDER BY createdAt DESC LIMIT 10;"
```

**Follow-up (separate work item, not v2.28.6):** the Celtics @ 76ers
trigger was that NBCSN → channel 220 mapping is wrong on DirecTV (220 is
Fox Sports 2; NBCSN is defunct and the broadcast was actually on Peacock).
The channel resolver should drop NBCSN as a DirecTV target and prefer the
Peacock streaming path when available.

---

### v2.28.4 — AI Suggest enforces HomeTeam.minTVsWhenActive (Packers gets 20 TVs, not 2)
**Released:** 2026-04-21

**What changed:**

- `apps/web/src/app/api/scheduling/ai-suggest/route.ts`:
  - NEW exported helper `matchHomeTeamRule(homeTeam, awayTeam, rules)` —
    case-insensitive contains-match against HomeTeam.aliases.
  - GET handler now loads `HomeTeam` rows where `isActive=true AND
    isPrimary=true AND minTVsWhenActive > 0`, parses the JSON `aliases`
    column, and passes a `HomeTeamRule[]` array to `buildPrompt()` and
    `parseOllamaResponse()`.
  - `buildPrompt()` per-game line now uses the rule's `minTVs` as the target
    when the game matches a home team (vs the flat `tvPerGame` default).
    Each home-team game line is tagged `[HOME TEAM: <Name> — REQUIRES N
    TVs MINIMUM]` and the assign clause says "do NOT go lower".
  - Rule 12 in the prompt now spells out the operator's per-team minimums
    (Packers=20, Bucks=5, Brewers=3, Badgers=3) and notes that the server
    WILL pad if the LLM under-assigns.
  - `parseOllamaResponse()` enforces minimums: when an accepted suggestion
    is for a home-team game and `suggestedOutputs.length < rule.minTVs`,
    it pads with TVs 1..minTVs (deduped). Logs a `[AI-SUGGEST] Home-team
    pad` line so operators can see when the LLM had to be backstopped.

**Why this was needed:**

`HomeTeam.minTVsWhenActive` has been in the schema since the table was
seeded (Packers=20, Bucks=5, Brewers=3, Badgers=3 at Holmgren), but the
AI Suggest prompt and parser never read or enforced it. Result: a Packers
game would get the same 2-3 TVs as a random college baseball game. Operator
report after observing the AI Suggest output multiple times: "the rules of
how many TVs we want them on are not being followed".

**Required steps PER LOCATION** (Claude Code at each location must run these):

The HomeTeam table is seeded per-location. Each location has its own
`minTVsWhenActive` values and its own home-team list. The new code uses
whatever is in the table — no behavior change is needed for locations
whose values are already correct.

**Step 1 — Verify your location's home-team minimums:**
```bash
sqlite3 -header /home/ubuntu/sports-bar-data/production.db \
  "SELECT teamName, sport, league, priority, minTVsWhenActive
   FROM HomeTeam
   WHERE isActive=1 AND isPrimary=1
   ORDER BY priority DESC, teamName;"
```
Confirm `minTVsWhenActive` is set to a value the operator wants. NULL or 0
means the rule is INACTIVE for that team — the AI Suggest will treat it
as a non-home game (use the default `tvPerGame` share).

**Step 2 — Update minimums via SQL** (idempotent — safe to re-run):

Replace the values to match what each location's operator wants:
```bash
# Example template — substitute your team names + counts:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 20 WHERE teamName = 'Green Bay Packers';"
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 5  WHERE teamName = 'Milwaukee Bucks';"
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 3  WHERE teamName = 'Milwaukee Brewers';"
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 3  WHERE teamName = 'Wisconsin Badgers';"
```

Or set ALL primary home teams to the same minimum at once:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE HomeTeam SET minTVsWhenActive = 5 WHERE isPrimary=1 AND isActive=1;"
```

**Step 3 — Verify the new behavior fires:**
```bash
# Trigger AI Suggest and check the prompt log line for the loaded rules
curl -s 'http://127.0.0.1:3001/api/scheduling/ai-suggest' --max-time 320 > /dev/null
grep "Loaded.*home-team minTV rules" ~/.pm2/logs/sports-bar-tv-controller-out.log | tail -1
# Expected: a line like "Loaded 4 home-team minTV rules: Packers=20, Bucks=5, ..."

# When a home-team game is in the next AI Suggest response, look for the pad event
grep "Home-team pad" ~/.pm2/logs/sports-bar-tv-controller-out.log | tail -5
# Expected (when LLM under-assigns): "Home-team pad: Green Bay Packers
# (Bears @ Packers) — LLM gave 3 TVs, padded to 20 (rule minTVs=20)"
```

**Per-location reference** (current Holmgren values as of v2.28.4 release):

| Team | Priority | minTVsWhenActive |
|---|---|---|
| Green Bay Packers | 100 | 20 |
| Milwaukee Brewers | 90 | 3 |
| Milwaukee Bucks | 90 | 5 |
| Wisconsin Badgers | 85 | 3 |
| Green Bay Phoenix (UWGB) | 60 | 1 (effectively off) |
| Marquette Golden Eagles | 60 | 1 (effectively off) |

Other locations should set values that match their bar size and
clientele expectations. A 12-TV bar should NOT use Packers=20.

---

### v2.28.3 — DirecTV revert-to-default-channel (extends Step 6 to handle directv sources)
**Released:** 2026-04-21

**What changed:**

- `packages/scheduler/src/auto-reallocator.ts` — Step 6 ("tune source box back
  to default channel") was previously gated on `inputSource.type === 'cable'`,
  so DirecTV receivers used by a scheduled game stayed on the game's last
  channel after revert. Now handles BOTH `cable` and `directv`:
  - Matrix input lookup branches by type: `irDevices.matrixInput` for cable,
    `direcTVDevices.inputChannel` for DirecTV.
  - Operator's existing `cableBoxDefaults` config is shared — it's keyed by
    matrix input number, which is unique across box types. Holmgren's setup
    uses keys 1-4 for cable boxes, 5-10 for the 6 DirecTVs.
  - Tune API payload differs by type: `cable` uses `cableBoxId` (IR via
    Global Cache), `directv` uses `directTVId` (IP control via SHEF
    `/tv/tune`). Both go through `/api/channel-presets/tune`.
  - SchedulerLog metadata now includes `sourceType` and uses
    `${type}_tuned_*` / `${type}_tune_*` reason codes for filtering.
- Auto-seed-from-tune-history (v2.27.0) extended to DirecTVs too — same
  ChannelTuneLog query path, same persist into `cableBoxDefaults`.

**Why this was needed:**

Wolves @ Nuggets on 2026-04-20 (DirecTV 6) and Orioles @ Royals (DirecTV 5)
both reverted their TV outputs correctly but left the DirecTV boxes on the
game channel. Operator had already configured `cableBoxDefaults` for inputs
5-10 expecting it to apply to the DirecTVs — config was right, the gate was
wrong.

**Required steps PER LOCATION** (Claude Code at each location must execute these):

The auto-update pipeline handles build + restart automatically. The new
revert path is then enabled, but ONLY tunes a DirecTV box back to default
if `cableBoxDefaults` has an entry for that box's matrix input number.

**Step 1 — Discover this location's DirecTV matrix input numbers:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, inputChannel FROM DirecTVDevice ORDER BY inputChannel;"
```
Note each `(name, inputChannel)` pair. inputChannel is the matrix input
number, also the key in `cableBoxDefaults`.

**Step 2 — Check what's already configured:**
```bash
curl -s http://127.0.0.1:3001/api/settings/default-sources | \
  python3 -c "import json,sys; d=json.load(sys.stdin)['defaults']; \
              keys=sorted(d.get('cableBoxDefaults',{}).keys(), key=lambda k:int(k)); \
              print('configured keys:', keys); \
              [print(f'  {k}: ch {v[\"channelNumber\"]} ({v.get(\"channelName\",\"?\")})') \
               for k,v in sorted(d.get('cableBoxDefaults',{}).items(), key=lambda kv:int(kv[0]))]"
```
For each DirecTV inputChannel from Step 1, confirm there's a matching
`cableBoxDefaults` key. If missing, go to Step 3.

**Step 3 — Populate missing DirecTV defaults via the UI** (preferred):

1. Open `http://<location-ip>:3001/system-admin` (or whichever path the
   "Default Sources" settings page is at — varies slightly per version,
   check the nav for "Default Sources" or "Defaults").
2. In the Cable Box Defaults section (covers ALL tunable boxes despite the
   name), find each DirecTV row by matrix input number and pick a
   sensible idle channel. Save.

**Step 3 alternative — via SQL** (when UI access isn't available):

The config lives in `SystemSetting` keyed `default_sources` as JSON. To
add a DirecTV default in-place:
```bash
# Replace MATRIX_INPUT_NUM, CHANNEL_NUM, CHANNEL_NAME with your values.
sqlite3 /home/ubuntu/sports-bar-data/production.db "
UPDATE SystemSetting
SET value = json_set(
  value,
  '\$.cableBoxDefaults.\"MATRIX_INPUT_NUM\"',
  json_object('channelNumber', 'CHANNEL_NUM', 'channelName', 'CHANNEL_NAME')
)
WHERE key = 'default_sources';
"
```
Idempotent — re-running with the same values produces the same result.

**Step 4 — Verify the new revert path fires after the next DirecTV game:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT datetime(createdAt,'unixepoch','localtime'), level,
          json_extract(metadata,'\$.reason') AS reason,
          json_extract(metadata,'\$.sourceType') AS type,
          message
   FROM SchedulerLog
   WHERE component='auto-reallocator' AND operation='revert'
     AND json_extract(metadata,'\$.sourceType')='directv'
   ORDER BY createdAt DESC LIMIT 10;"
```
Expected after the next DirecTV-allocated game completes: rows with
`reason='directv_tuned_configured'` (or `directv_tuned_auto_seeded` if the
operator skipped Step 3 and the auto-seed-from-tune-history fallback
kicked in).

**Per-location reference values** (current settings as of v2.28.3 release):

| Location | Box | inputChannel | Default channel |
|---|---|---|---|
| Holmgren Way | DirecTV 1 | 5 | ch 219 Fox Sports 1 |
| Holmgren Way | DirecTV 2 | 6 | ch 220 NFL Network |
| Holmgren Way | DirecTV 3 | 7 | ch 602 CBS Sports Network |
| Holmgren Way | DirecTV 4 | 8 | ch 611 SEC Network |
| Holmgren Way | DirecTV 5 | 9 | ch 612 ACC Network |
| Holmgren Way | DirecTV 6 | 10 | ch 610 Big 10 |

Other locations: fill in your own values from Step 1 + Step 2 output. The
defaults table above is Holmgren-only and SHOULD NOT be applied at other
sites — channel lineups vary by DirecTV market.

---

### v2.28.2 — Channel guide includes in-progress games whose start is in the past
**Released:** 2026-04-21

**What changed:**

- `apps/web/src/app/api/channel-guide/route.ts` — three fixes to the
  `game_schedules` fallback:
  1. Window filter changed from start-only (`gte(scheduledStart, windowStart)`)
     to overlap-based (`scheduledStart <= windowEnd AND estimatedEnd >= windowStart`)
     PLUS `OR(status='in_progress')` catch-all for games that ran past their
     estimated end.
  2. `isLive` is now derived from `game.status === 'in_progress'` OR
     (now within `[scheduledStart, estimatedEnd]` AND status not completed/final).
     Previously hardcoded `false`.
  3. The 2-hour `[CLEANUP] Filtered out N old programs` filter now exempts
     any program with `isLive === true`. Previously, OT games whose ESPN
     status was still `in_progress` would be removed from the response by
     the cleanup, hiding them from the bartender even though they were
     actively playing.
- Same three fixes applied to both the cable/directv path and the streaming
  path of the fallback.

**Why this was needed:**

Wolves @ Nuggets ran into OT past midnight on 2026-04-20. The bartender
remote channel guide showed "no live games" even though the game was on
DirecTV 6 ch 26 (NBC) and the schedule view correctly listed it. Three
overlapping bugs combined to filter the game out.

**Required manual steps:** NONE.

**Verify after update:**

```bash
# Hit the channel-guide POST endpoint and check for at least one live game
# during a window where ESPN has any status='in_progress' games:
curl -s -X POST http://127.0.0.1:3001/api/channel-guide \
  -H 'Content-Type: application/json' \
  -d '{"inputNumber":1,"deviceType":"satellite","deviceId":"<any-directv-id>"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); \
                live=[p for p in d.get('programs',[]) if p.get('isLive')]; \
                print(f'live programs: {len(live)}'); \
                [print(f'  - {p[\"awayTeam\"]} @ {p[\"homeTeam\"]} on ch {p[\"channel\"][\"number\"]}') for p in live[:5]]"
```

---

### v2.28.1 — Wolf Pack 65535 sentinel: DB fallback in /api/matrix/routes
**Released:** 2026-04-21

**What changed:**

- `apps/web/src/app/api/matrix/routes/route.ts` — when `queryWolfpackRouteState`
  returns the 65535 firmware sentinel for an output (post-route settling
  window), the response previously dropped that output silently. Now falls
  back to the persistent `MatrixRoute` DB table value for any output present
  in DB but missing from the live response. Each fallback entry is tagged
  `source: 'db-fallback'` and the response includes a `fallbackCount` field.

**Why this was needed:**

Operator-reported pattern: TV 1 loses its source checkmark when the bartender
switches from Audio or Guide tab back to Video or Routing tab. Physical TV
is correctly routed; only the UI shows blank. Root cause: the iPad that made
the route had its `currentSources` Map preserve the value via the existing
client-side merge logic, but ANY OTHER iPad (or the same iPad after a hard
refresh) had no prior state to preserve and showed TV 1 as unrouted because
the live Wolf Pack response was missing that output. DB fallback closes the
gap so any device gets a correct response on first load.

**Required manual steps:** NONE.

**Verify after update:**

```bash
# When the Wolf Pack returns sentinels, the response should fill them from
# DB and log the count. Look for the line in PM2 logs:
grep "Wolf Pack returned sentinel" ~/.pm2/logs/sports-bar-tv-controller-out.log | tail -5
# Expected (when it actually fires): lines like
# "[api/matrix/routes] Wolf Pack returned sentinel for 1 output(s); filled
#  from MatrixRoute DB: out1=in1"
```

---

### v2.28.0 — UFC/PPV event scheduling support (ESPN MMA name backfill + DirecTV PPV probe + AI Suggest empty-team tolerance)
**Released:** 2026-04-20

**What changed:**

- `packages/scheduler/src/espn-sync-service.ts` — when `sport === 'mma'` and
  ESPN returns empty `displayName` for both fighters (which it does for
  every UFC event — ESPN structures MMA as fighters, not teams), parse
  `event.name` ("UFC Fight Night: Topuria vs. Holloway") on ` vs.? `,
  strip leading "UFC <whatever>: " from the first half, and assign the
  two halves to `awayTeamName` / `homeTeamName`. Falls back to the whole
  event name in `awayTeamName` if the split fails.
- `packages/database/src/schema.ts` — NEW table `discovered_ppv_channels`
  with `(directvDeviceId, channelMajor)` unique index. Tracks observations
  of PPV-band channels seen on DirecTV `/tv/getTuned`.
- `packages/scheduler/src/directv-probe.ts` — NEW. Polls every active
  DirecTV box's SHEF `/tv/getTuned` and upserts any tuned channel where
  `callsign === 'PPV'` OR (major in 100-199 AND title non-empty) into
  `discovered_ppv_channels`. Per-box errors are caught and reported.
- `packages/scheduler/src/scheduler-service.ts` — wires the probe into a
  10-minute cron interval (first run 90s after startup) alongside the
  existing TV-status poll. New `ppvProbeIntervalId` + `runPpvProbe()`.
- `packages/scheduler/src/index.ts` — re-exports `probeAllDirecTVTuned` and
  `DirecTVProbeResult` so app routes can call the probe.
- `apps/web/src/app/api/directv/probe-tuned/route.ts` — NEW POST endpoint
  for on-demand probe execution (testing / verification).
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — `buildPrompt()`
  game line now tolerates empty `homeTeam`/`awayTeam`: renders whichever
  half is non-empty, falls back to `"<LEAGUE> event"` when both empty.
  Same fallback applied to the `title` field built in `fetchUpcomingGames()`.

**Schema changes:** New table `discovered_ppv_channels`. The auto-update
schema-push handles this on most locations, but if `drizzle-kit push`
silently aborts on a pre-existing index (CLAUDE.md Known Gotcha #7), the
verify step below will catch it and the manual CREATE TABLE block must
be run.

**Why this was needed:**

A manager at Holmgren Way scheduled a UFC PPV on a DirecTV box for
Saturday 2026-04-18. The scheduler never created an allocation for it,
which meant no auto-revert when the fight ended and the box stayed on
the PPV channel until manual cleanup. Two root causes:

1. ESPN's MMA scoreboard returns null for both `homeTeam.displayName`
   and `awayTeam.displayName`. Our sync stored them as empty strings,
   so AI Suggest's prompt rendered " at " for every UFC row, and the
   LLM ignored those rows entirely.
2. ESPN doesn't surface a reliable PPV channel number in
   `broadcastNetworks`, so even if the row had names, the AI had no
   channel to route to. We now reactively learn the PPV channel from
   what the manager already tuned the box to.

**Required manual steps:** NONE for the auto-update path. The pipeline
handles build, schema push, restart, and (where the box is currently
tuned to PPV) the first probe sweep at +90s.

**Optional: backfill historical UFC rows** that synced under the old
code with empty names:
```bash
# Fetches the past week and re-syncs — names get backfilled in place.
TODAY=$(date +%Y%m%d)
WEEK_AGO=$(date -d '7 days ago' +%Y%m%d)
curl -s -X POST http://127.0.0.1:3001/api/scheduling/sync \
  -H 'Content-Type: application/json' \
  -d "{\"sport\":\"mma\",\"league\":\"ufc\",\"startDate\":\"$WEEK_AGO\",\"endDate\":\"$TODAY\"}"
```

**Verify after update (per location):**

```bash
# 1. New table exists
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables" | grep ppv
# Expected: discovered_ppv_channels

# 2. UFC rows have populated names (run after a UFC week and the next sync)
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT id, home_team_name, away_team_name,
       datetime(scheduled_start,'unixepoch') as start_ct
FROM game_schedules
WHERE sport='mma' OR league='ufc'
ORDER BY scheduled_start DESC LIMIT 5;"
# Expected: home_team_name and away_team_name both non-empty for any row
# whose scheduled_start fell within the last sync window.

# 3. Trigger an on-demand probe (no PPV active = empty result, that's fine)
curl -s -X POST http://127.0.0.1:3001/api/directv/probe-tuned | python3 -m json.tool
# Expected: {"success":true,"result":{"devicesProbed":N,...}}
# Where N = number of rows in DirecTVDevice.

# 4. After a manager tunes any box to a PPV channel and waits ≤10 min
#    (or hits the endpoint above), confirm a row appears:
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT directv_device_id, channel_major, callsign, title,
       datetime(last_seen_at,'unixepoch') as last_seen_ct, seen_count
FROM discovered_ppv_channels ORDER BY last_seen_at DESC LIMIT 10;"
```

**Per-location notes:** None. All locations have at least one DirecTV box
in production; the probe scales by DirecTV device count and is harmless
at any location size.

**If the schema push silently skipped the new table** (Known Gotcha #7):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
CREATE TABLE IF NOT EXISTS discovered_ppv_channels (
  id TEXT PRIMARY KEY,
  directv_device_id TEXT NOT NULL,
  channel_major INTEGER NOT NULL,
  channel_minor INTEGER,
  callsign TEXT,
  title TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS discovered_ppv_channels_device_major_unique
  ON discovered_ppv_channels (directv_device_id, channel_major);
CREATE INDEX IF NOT EXISTS discovered_ppv_channels_lastSeen_idx
  ON discovered_ppv_channels (last_seen_at);
SQL
pm2 restart sports-bar-tv-controller
```

**Known errors & fixes:** none observed yet — will append if any surface.

---

### v2.27.1 — AI Suggest spread + collision hardening (zero-output guard, in-batch tracker)
**Released:** 2026-04-20

**What changed:**

- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — prompt rewrite:
  removed the "[BOTH] games go DirecTV by default" exclusivity rule that
  was biasing every dual-route game to DirecTV and packing 5 games on one
  receiver. New rules: explicit no-double-booking, spread-before-stack,
  channel-tells-device-class, dynamic free-set re-check per game, and a
  hard "every suggestion MUST include at least 1 TV output" rule with a
  per-game tvPerGame hint.
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — parser changes:
  (1) `parseOllamaResponse` now returns `{ suggestions, rejections }`.
  (2) Empty `suggestedOutputs` arrays are REJECTED (not silently passed)
  with `reason='zero_outputs'`. Bug A root cause was Ollama tail-attention
  drop on long 12-game prompts producing `suggestedOutputs:[]`.
  (3) New `inBatchClaims` map tracks each accepted suggestion's 3h time
  window per input, so a second suggestion that overlaps gets rerouted
  to an idle same-class input (cable→cable, dtv→dtv) or rejected with
  `reason='in_batch_collision'`.
  (4) The post-LLM "DirecTV-default rerouter" block was DELETED entirely —
  it was the second source of cable-box-bias-the-other-way bug.
  (5) All rejection paths (existing_collision, in_batch_collision,
  zero_outputs, no_route, duplicate_combo, over_per_input_cap,
  over_per_game_cap) now persist a `SchedulerLog` row with
  `component='ai-suggest'`, `operation='reject'`, `level='warn'` for
  the high-signal cases.
- `packages/scheduler/src/allocation-conflicts.ts` — NEW. Duplicates
  `apps/web/src/lib/scheduling/allocation-conflicts.ts` so the package
  allocator can guard `createAllocation` without a cross-package import.
- `packages/scheduler/src/smart-input-allocator.ts` — `createAllocation`
  now refuses to insert when `tvOutputIds.length === 0` (throws
  `[ALLOCATOR]` error) AND pre-flight conflict-checks the chosen input
  before the insert (was only checked post-insert by
  `/api/scheduling/allocate`).
- `apps/web/src/app/api/scheduling/allocate/route.ts` — maps
  `[ALLOCATOR]`-prefixed throws to HTTP 409 (was 500) so the UI can
  show a useful retry message.

**Schema changes:** None. Writes additional rows to existing
`SchedulerLog` table (`component='ai-suggest'`, `operation='reject'`).

**Why this was needed:**

At Holmgren Way on 2026-04-20, the AI Suggest tab returned a Hawks/Knicks
suggestion with `suggestedOutputs:[]` (no TVs assigned) and double-booked
DirecTV 3 across overlapping Brewers and 76ers windows. Operator
investigation traced both to (a) LLM tail-attention drop on the 12-game
prompt and (b) the post-LLM "Prefer DirecTV for [BOTH] games" rerouter
ignoring already-claimed slots in the same response.

**Required manual steps:** NONE. Idempotent. Auto-update pipeline handles
build, schema (no changes), restart.

**Verify after update (per location):**

```bash
# 1. Hit the endpoint and confirm no zero-output suggestions returned
curl -s 'http://127.0.0.1:3001/api/scheduling/ai-suggest' | python3 -c '
import json, sys
d = json.load(sys.stdin)
zeros = [s for s in d.get("suggestions", []) if len(s.get("suggestedOutputs", [])) == 0]
print(f"Suggestions: {len(d.get(\"suggestions\", []))}, zero-output: {len(zeros)}")
'

# 2. Confirm rejection telemetry is being written when LLM misbehaves
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT datetime(createdAt,'unixepoch','localtime') AS when_ct,
       level, json_extract(metadata,'\$.reason') AS reason,
       gameId, message
FROM SchedulerLog
WHERE component='ai-suggest' AND operation='reject'
ORDER BY createdAt DESC LIMIT 10;"

# 3. Confirm allocator now refuses 0-output requests with 409
curl -s -X POST http://127.0.0.1:3001/api/scheduling/allocate \
  -H 'Content-Type: application/json' \
  -d '{"gameId":"NONEXISTENT","tvOutputIds":[]}' \
  | python3 -m json.tool
# Expected: 4xx response, NOT a 200 with an empty allocation.
```

**Known errors & fixes:** none observed yet — will append if any surface.

---

### v2.27.0 — Cable-box tune-back: auto-seed defaults from tune history + observability
**Released:** 2026-04-20

**What changed:**

- `packages/scheduler/src/auto-reallocator.ts` — `revertTVsToDefaults()`
  no longer silently skips Step 6 when `defaults.cableBoxDefaults` is empty.
  If a cable-input is missing an explicit default, the service queries
  `ChannelTuneLog` for the most recent successful tune BEFORE the game's
  `scheduledStart` on that `inputNum`, constructs a `{channelNumber, channelName}`
  fallback, persists it to `SystemSettings.default_sources` in-process so
  the UI shows it going forward, and proceeds with the tune. If no prior
  tune exists either, the box is left where it is with a `warn` row logged.
- `packages/scheduler/src/auto-reallocator.ts` — every branch of
  `revertTVsToDefaults()` (skip, success, failure) now writes a
  `SchedulerLog` row with `component='auto-reallocator'`, `operation='revert'`,
  and structured metadata including `gameId`, `inputSourceType`,
  `inputSourceName`, `tvCount`, `cableBoxTuned`, `cableBoxChannel`,
  `autoSeededCableDefault`, plus a `reason` string from a finite set
  (`tv_reverted`, `cable_tuned_configured`, `cable_tuned_auto_seeded`,
  `auto_seeded_from_tune_history`, `no_default_no_history`, `revert_complete`,
  etc.). A single summary row fires at the end.
- `packages/scheduler/src/scheduler-logger.ts` — `'revert'` added to the
  `SchedulerOperation` union.
- `apps/web/src/components/DefaultSourceSettings.tsx` — amber warning
  banner lists any cable boxes with no default channel configured and
  explains the auto-seed fallback.

**Schema changes:** None. Reads `ChannelTuneLog` (no write), writes to
`SystemSettings` row with `key='default_sources'` (existing row, updated
in place).

**Why this was needed:**

At Holmgren Way on 2026-04-20, after v2.26.2 unblocked the matrix-route
enum path, Cable Box 2 and Cable Box 4 still remained on channel 13
(Magic/Spurs games) after those games ended — because `defaults.cableBoxDefaults`
was empty. The prior logic `if (...cableBoxDefaults && Object.keys(...).length > 0)`
silently no-op'd. Operators don't reliably set per-box defaults up front,
so relying on them was a footgun; the most recent pre-game tune is a
reasonable signal.

**Required manual steps:** NONE. Idempotent — auto-seeding the same box
twice produces the same result. The auto-update pipeline handles build
and restart.

**Verify after update (per location):**

```bash
# 1. Route still responds
curl -s http://127.0.0.1:3001/api/settings/default-sources | jq '.defaults | keys'

# 2. After the next game ends, confirm a revert-complete row appears
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT datetime(createdAt,'unixepoch','localtime') AS when_ct,
       level, message, json_extract(metadata,'$.reason'),
       json_extract(metadata,'$.cableBoxTuned')
FROM SchedulerLog
WHERE component='auto-reallocator' AND operation='revert'
ORDER BY createdAt DESC LIMIT 10;"

# 3. After a game ends on a cable input that had no default set,
#    confirm default_sources now has a cableBoxDefaults entry
sqlite3 /home/ubuntu/sports-bar-data/production.db "
SELECT json_extract(value,'$.cableBoxDefaults') FROM SystemSettings
WHERE key='default_sources';"
```

**Known errors & fixes:** none observed yet — will append if any surface.

---

### v2.25.5 — Auto-update shared-software conflict fallback
**Released:** 2026-04-19

**What changed:**
`scripts/auto-update.sh` — adds `SHARED_SOFTWARE_PREFIXES[]` after the
existing `LOCATION_PATHS_OURS` / `LOCATION_PATHS_THEIRS` lists. Any
merge conflict on a path under these prefixes now auto-resolves to
MAIN's version via `git checkout --theirs`. Prefixes covered:
`apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/lib/`
(except `hardware-config.ts` which remains in OURS), `apps/web/src/hooks/`,
`apps/web/src/db/`, `apps/web/src/types/`, `apps/web/src/utils/`,
`apps/web/public/`, `packages/`, `docs/`, `drizzle/`.

**Why:** Locations' branches can drift on shared UI files from past
on-device debugging or one-off manual tweaks. Before this fix a single
stale edit anywhere under `apps/web/src/app/` would hit `CONFLICT
(content)` at merge time, fall through the exact-path OURS/THEIRS loop,
and the whole auto-update aborted with rollback. `apps/web/src/app/remote/page.tsx`
at Lucky's 1313 triggered this on 2026-04-19 at 16:39 and 2026-04-18
at 16:07, rolling back both attempts.

**Schema changes:** None.

**Required manual steps (ONE-TIME per location, to bootstrap the fix):**

**This is the critical step.** The currently-deployed auto-update.sh
at each location does NOT have this fallback. It can't update itself
via auto-update because the pre-update merge is exactly where it
fails. Operators must resolve the current conflict manually ONCE:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git fetch origin
BRANCH=$(git branch --show-current)
git merge origin/main --no-ff -m "chore: one-shot merge to bootstrap auto-update fix"
# If conflicts appear, take main's version for each shared UI file
# reported — safe because these are shared code, not location config:
for f in $(git status --porcelain | grep '^UU' | awk '{print $2}'); do
  case "$f" in
    apps/web/data/*|.env|ecosystem.config.js|apps/web/src/lib/hardware-config.ts)
      echo "KEEP LOCATION: $f"  # these stay ours
      git checkout --ours "$f" && git add "$f"
      ;;
    *)
      echo "TAKE MAIN: $f"
      git checkout --theirs "$f" && git add "$f"
      ;;
  esac
done
git commit --no-edit 2>&1 | tail -3
# Rebuild + restart so the live app matches the new merge
rm -rf apps/web/.next .turbo
npx turbo run build --force 2>&1 | tail -5
pm2 delete sports-bar-tv-controller 2>&1 | tail -1
pm2 start ecosystem.config.js 2>&1 | tail -3
# Push the resolved branch
git push origin "$BRANCH"
```

After this, `scripts/auto-update.sh` on disk is v2.25.5 and the new
fallback is active for every subsequent auto-update at this location.

**Verification:**
```bash
grep -c "SHARED_SOFTWARE_PREFIXES" /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh
# Expect: >= 2 (one in the array def, one or more in the usage loop)
```

**Applies to:** every location running auto-update.sh prior to v2.25.5.

**First seen:** 2026-04-18 16:07 and 2026-04-19 16:39 at Lucky's 1313
— two consecutive auto-update attempts rolled back because
`apps/web/src/app/remote/page.tsx` had conflicts not covered by the
exact-path OURS/THEIRS lists.

---

### v2.24.6 — auto-update.sh pushes merge commits back to origin (Fleet Dashboard accuracy fix)
**Released:** 2026-04-18

**What changed:**
- `scripts/auto-update.sh` — new push step at the end of the FINALIZE phase. After a successful auto-update (checkpoints A/B/C + verify-install all green), the script now runs `git push origin <current-branch>` to publish the merge commit to GitHub. Non-fatal on failure (location is still healthy; just the dashboard signal is missing). Never touches main. No --force.

**Why this matters:** the Fleet Dashboard (v2.24.0) reads `origin/location/<name>` from the local git clone, which mirrors GitHub. Before v2.24.6, auto-update.sh merged main locally and built/restarted but never pushed. Every location that successfully auto-updated LOCALLY without a human running `git push` afterward looked "stuck" on the dashboard forever. Stoneyard Appleton (v2.12.8 on git, last push 2 days ago) and Stoneyard Greenville (v2.16.2, last push 32h ago) are examples — both have almost certainly been running newer code for a while; nobody has been pushing.

After v2.24.6 lands at a location, the next successful auto-update will push automatically and the dashboard will catch up.

**Required Claude step per location:** None — fix is purely in auto-update.sh. No config, no env var, no DB patch.

**One-time catch-up action for already-stuck locations:** operator SSH to each stuck host once, run:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git push origin "$(git rev-parse --abbrev-ref HEAD)"
```
That pushes whatever merge commits have accumulated locally. Future auto-updates (after v2.24.6 lands there) will do it automatically.

**Rollback:** `git revert` removes the push step. Auto-update goes back to merge-locally-only behavior; dashboard drifts again.

---

### v2.24.5 — Per-location Brave API key provisioning helper
**Released:** 2026-04-18

**What changed:**
- New `scripts/set-brave-api-key.sh` — installs a BRAVE_API_KEY into both `.env` (for PM2 runtime) and `~/.bashrc` (for interactive Claude Code sessions) at the host where it's run. Idempotent (same key = no-op, different key = update). Supports `--remove`, `--show` (masked), `--test` (probes the Brave API to confirm the key works). The script itself is committed; **keys are NOT**. Operator at each location runs it once per key.

**Why this matters:** the Brave Search MCP enabled in v2.23.3 needs a `BRAVE_API_KEY` to work. The repo is PUBLIC, so committing a shared key to git exposes it to scrapers. The safe path is per-location free-tier keys (2,000 queries/month each, signup 2 min, no credit card).

**Required Claude step per location:** None — this is operator-driven. Claude at each location has no way to sign up for an API key; a human has to do the 2-min form. However, Claude at Checkpoint B should mention the helper script in its decision summary so the operator knows it's available.

**Operator runbook per location (do this ONCE per location you want Brave Search in):**

1. Visit https://api.search.brave.com/app/keys and sign up (free tier, no credit card).
2. Create an API key and copy it. The key format is `BS...` — roughly 32-33 chars of alphanumerics/underscores.
3. SSH to the location's server (or run locally on the bar's host), then:
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   bash scripts/set-brave-api-key.sh <paste-key-here>
   ```
   Output should show `.env: added` and `~/.bashrc: added`.

4. Confirm the key actually works (the helper has a probe built in):
   ```bash
   bash scripts/set-brave-api-key.sh --test
   ```
   Expected: `OK: HTTP 200 — key works.` Any other response means the key is invalid or rate-limited.

5. For the Sports Bar app to read the new .env value, do a PM2 delete+start (not restart — see CLAUDE.md Common Gotcha #3):
   ```bash
   pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js
   ```

6. For any CURRENT `claude` terminal session to pick up the new key, either open a new shell OR `export BRAVE_API_KEY="$(grep ^BRAVE_API_KEY= .env | cut -d= -f2-)"` in the existing one, then exit and relaunch `claude`.

**What locations can skip this:**
- Any location where you don't want Brave Search in Claude Code sessions at all — Context7 still works without a key, so the other MCP is unaffected.

**Rollback:**
- `bash scripts/set-brave-api-key.sh --remove` — strips the key from both `.env` and `~/.bashrc` at the location.
- `git revert` the commit — removes the helper script. The key stays until `--remove` is run locally.

---

### v2.24.4 — Scheduler honors applied override defaults + Fleet/Override-Learn home page nav
**Released:** 2026-04-18

**What changed:**
- `apps/web/src/lib/scheduling/apply-override-defaults.ts` — new helper that reads `ScheduledOverrideDefaults` rows for a game's home+away teams and filters/augments an incoming `tvOutputIds` array: `action='exclude'` rows drop matching outputs; `action='include'` rows add missing outputs. Writes an audit `SchedulerLog` row (`operation='applied-to-allocation'`) when any change is made. Non-fatal on DB error.
- `apps/web/src/app/api/schedules/bartender-schedule/route.ts` — wires the helper in BEFORE the allocation insert. Operator decisions from the v2.24.3 Apply button now actually affect live routing.
- `apps/web/src/app/page.tsx` — home-page System Controls grid gains Fleet Dashboard (`/fleet`) and Override-Learn Digest (`/override-learn`) cards. The pages were live since v2.24.0 and v2.24.2 respectively but had no nav entry.

**Required Claude step at each location:** None. Feature uses data already at this location; no env vars, no DB patches, no per-location values.

**Verification at Checkpoint C:**
```bash
# Home page shows both new cards
curl -s http://localhost:3001/ | grep -oE 'href="/(fleet|override-learn)"' | sort -u
```
Expected: both `href="/fleet"` and `href="/override-learn"` appear.

```bash
# Apply a rule and confirm it stores; revert it
curl -s -X POST http://localhost:3001/api/override-learn/apply \
  -H 'Content-Type: application/json' \
  -d '{"team":"__TEST__","outputNum":99,"action":"exclude"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin))"
sqlite3 /home/ubuntu/sports-bar-data/production.db "DELETE FROM ScheduledOverrideDefaults WHERE team='__TEST__';"
```
Expected: `{'success': True, 'id': '<uuid>', 'refreshed': False}`.

**Rollback:** `git revert` removes the helper + its call-site hook. The `ScheduledOverrideDefaults` table stays with any applied rules (harmless — nothing consults the table after revert).

---

### v2.24.3 — Apply-recommendation buttons + bartender Schedule widget
**Released:** 2026-04-18

**What changed:**
- New `ScheduledOverrideDefaults` DB table stores durable operator decisions from the override-learn digest. Each row: `(team, outputNum, action='exclude'|'include', occurrences, appliedAt, appliedBy)` with a `UNIQUE(team, outputNum, action)` index.
- `POST /api/override-learn/apply` upserts a row (idempotent — clicking Apply twice refreshes rather than duplicates). `DELETE /api/override-learn/apply?id=X` reverts. Each operation also writes a `SchedulerLog` audit row at `component='override-digest'`, `operation='applied'` or `'reverted'`.
- `GET /api/override-learn/digest` response now tags each pattern with its `applied` state so the UI can show "Applied ✓" + a Revert button without a second fetch.
- `/override-learn` page gains per-row Apply / Revert buttons.
- New `OverrideLearnWidget` component, embedded in the bartender remote's Schedule tab. Shows the top 5 unapplied patterns (≥2 occurrences) with 44×44 Apply buttons for one-tap manager action. Links to `/override-learn` for the full view. Respects CLAUDE.md bartender-UI rules (touch targets, text-sm, dark theme).

**Scheduler integration status:** The table is WRITTEN but the scheduler doesn't YET consult it when building new allocations. That integration is v2.24.4+ — a single-function change in `packages/scheduler/src/scheduler-service.ts` where `tv_output_ids` is initially computed. For now, Apply records the decision as an audit trail and shared source of truth that any follow-up can honor. Ack this explicitly: clicking Apply today records your intent but doesn't yet change live routing.

**Required Claude step at each location** (Claude at Checkpoint B of the update that merges v2.24.3: execute these steps in order, no questions):

1. **Verify the new table was created.** drizzle-kit push can abort silently on pre-existing indexes (CLAUDE.md Gotcha #7), so confirm the table + its unique index both exist:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name FROM sqlite_master WHERE type='table' AND name='ScheduledOverrideDefaults';"
```
Expected output: `ScheduledOverrideDefaults`. If blank, the push failed before reaching this table — create it manually:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
CREATE TABLE IF NOT EXISTS ScheduledOverrideDefaults (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  league TEXT,
  outputNum INTEGER NOT NULL,
  action TEXT NOT NULL,
  isHomeTeam INTEGER NOT NULL DEFAULT 0,
  occurrences INTEGER NOT NULL DEFAULT 1,
  sourceCorrelationId TEXT,
  appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  appliedBy TEXT NOT NULL DEFAULT 'operator',
  notes TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ScheduledOverrideDefaults_team_idx ON ScheduledOverrideDefaults(team);
CREATE UNIQUE INDEX IF NOT EXISTS ScheduledOverrideDefaults_team_output_action_unique ON ScheduledOverrideDefaults(team, outputNum, action);
SQL
```

2. **Verify the unique index exists** (the table can be created without it on a partial-abort):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ScheduledOverrideDefaults';"
```
Expected: 3 indexes listed (`sqlite_autoindex_…_1`, `ScheduledOverrideDefaults_team_idx`, `ScheduledOverrideDefaults_team_output_action_unique`). If any are missing, run the CREATE INDEX commands from step 1.

3. **Smoke-test the API** after the PM2 restart completes (Checkpoint C):
```bash
curl -s http://localhost:3001/api/override-learn/apply | python3 -m json.tool
```
Expected: `{"applied": []}` (empty list, not an error). If you get a 500, check the PM2 logs for the error. A column-not-found error means step 1 didn't finish; re-run it.

4. **Verify the bartender widget appears.** Open `http://localhost:3001/remote` in a browser, tap into the "More" sheet → Schedule tab. You should see a "Scheduler corrections" card below the scheduled games list. Content depends on whether this location has any override-learn events:
   - If yes: shows patterns with Apply buttons.
   - If none: "No corrections in the last 30 days" — that's a fine state, not an error.

**No per-location value to set.** This feature uses DB-based data collected from that location's own bartender behavior — every location works identically out of the box.

**Rollback:** `git revert` removes the Apply/Revert buttons, the widget, and the API endpoints. The `ScheduledOverrideDefaults` table stays in the DB (harmless — no code reads from it after revert). To fully clean up:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "DROP TABLE IF EXISTS ScheduledOverrideDefaults;"
```

---

### v2.24.1 — auto-update.sh sources .env before build (and LOCATION_NAME fix for v2.23.11)
**Released:** 2026-04-18

**What changed:**
- `scripts/auto-update.sh` — the BUILD phase now sources the repo-root `.env` with `set -a; source .env; set +a` immediately before the `npx turbo run build --force` call. This means any env var set in `.env` (LOCATION_NAME, LOCATION_ID, BRAVE_API_KEY, etc.) is visible to Turbo, to the Next.js build, and to the `process.env` that statically-rendered pages read at build time.
- `docs/VERSION_SETUP_GUIDE.md` — the v2.23.11 entry gains a proper branch-to-LOCATION_NAME mapping table plus the derivation rule for new/unlisted locations, so Claude at each location can pick the right value without guessing.

**Why this is urgent:** the v2.23.11 tab-title feature depended on `LOCATION_NAME` being visible during the build. Before v2.24.1, even a location with `LOCATION_NAME=LegLamp` correctly set in `.env` would still get "Sports Bar TV Controller" (no prefix) baked into the statically-rendered pages, because auto-update.sh never exported the value. Leg Lamp hit exactly this the first time it merged v2.23.11 — the value was missing AND the build wouldn't have seen it anyway.

**Required Claude step at each location** (Claude at Checkpoint B of the update that merges v2.24.1: execute these steps in order, no questions):

1. **Identify this location's branch** and look up the LOCATION_NAME value from the table in §v2.23.11 of this file:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git rev-parse --abbrev-ref HEAD
```
For each known branch:
| Branch | LOCATION_NAME |
|---|---|
| `location/holmgren-way` | `Holmgren` |
| `location/leg-lamp` | `LegLamp` |
| `location/lucky-s-1313` | `Lucky1313` |
| `location/graystone` | `Graystone` |
| `location/stoneyard-appleton` | `AppletonStoneyard` |
| `location/stoneyard-greenville` | `GreenvilleStoneyard` |

For an unlisted branch, derive by capitalizing each dash-separated segment (e.g. `location/new-spot` → `NewSpot`).

2. **Ensure `LOCATION_NAME` is set in `.env`.** This is idempotent — skip the append if already present:
```bash
if ! grep -q '^LOCATION_NAME=' /home/ubuntu/Sports-Bar-TV-Controller/.env; then
  echo 'LOCATION_NAME=<VALUE FROM TABLE>' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
fi
```

3. **That's it.** The auto-update.sh that just ran this checkpoint will proceed to the BUILD phase, where it automatically sources `.env` (v2.24.1 behavior). Next.js will bake the correct title. No manual rebuild needed.

4. **Verify after the PM2 restart phase completes** (Checkpoint C):
```bash
curl -s http://localhost:3001/ | grep -oE '<title[^>]*>[^<]+</title>'
```
Expected: `<title>YourLocation-Sports-Bar-TV-Controller</title>`. If the plain `<title>Sports Bar TV Controller</title>` is returned, step 2 didn't actually add the var — re-check with `grep ^LOCATION_NAME= .env` and fix manually.

**Rollback:** `git revert` safely removes both the auto-update.sh env sourcing and the doc update. The LOCATION_NAME values already in `.env` files at each location don't go away — they're gitignored — so a revert only affects *future* auto-update runs.

---

### v2.23.11 — Location-aware browser tab title
**Released:** 2026-04-18

**What changed:**
- `apps/web/src/app/layout.tsx` — switched from `export const metadata` (static, evaluated at build time) to `export async function generateMetadata` (dynamic, evaluated at request time). Title now computes from `process.env.LOCATION_NAME`. Format: `<LocationName>-Sports-Bar-TV-Controller` when set, plain `Sports Bar TV Controller` when unset.
- `turbo.json` — added `"env": ["LOCATION_NAME", "LOCATION_ID", "NODE_ENV"]` to the build task so Turbo passes these through to the Next.js build subprocess AND includes them in the build cache hash. Without this, Next.js statically pre-renders pages like `/` and `/system-admin` with `process.env.LOCATION_NAME=undefined` at build time, baking the fallback title into cached HTML regardless of what the PM2 runtime env says.

**Why this matters:** operators running multiple locations open each in a browser tab. Previously every tab said "Sports Bar TV Controller" — tell them apart by hovering over favicons or guessing from URL. Now Holmgren's tab says "Holmgren-Sports-Bar-TV-Controller" while Lucky's would say "LuckyS1313-Sports-Bar-TV-Controller" (or whatever the operator sets `LOCATION_NAME` to).

**Required Claude step at each location** (Claude: execute during Checkpoint B of the update that merges v2.23.11):

1. Check if `LOCATION_NAME` is already set in `.env`:
```bash
grep ^LOCATION_NAME= /home/ubuntu/Sports-Bar-TV-Controller/.env
```

2. If NOT set, DETERMINE the correct value for THIS location by reading the current git branch. Each location/* branch has an obvious short name embedded; use this mapping table (update if new locations arrive, do NOT default to a guess):

| Branch | LOCATION_NAME value |
|---|---|
| `location/holmgren-way` | `Holmgren` |
| `location/leg-lamp` | `LegLamp` |
| `location/lucky-s-1313` | `Lucky1313` |
| `location/graystone` | `Graystone` |
| `location/stoneyard-appleton` | `AppletonStoneyard` |
| `location/stoneyard-greenville` | `GreenvilleStoneyard` |

For any new/unlisted branch, derive the name by capitalizing each dash-separated segment and concatenating (e.g. `location/big-sky-tavern` → `BigSkyTavern`). Keep it short — it becomes a tab-title prefix, so 4-16 chars is the sweet spot.

Add it to .env (the value column from the table, substituted in):
```bash
# Example — substitute for YOUR branch per the table:
BRANCH=$(cd /home/ubuntu/Sports-Bar-TV-Controller && git rev-parse --abbrev-ref HEAD)
echo "Current branch: $BRANCH"
# Look up the LOCATION_NAME from the table above, then:
echo 'LOCATION_NAME=<value-from-table>' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
```

3. **As of v2.24.1, auto-update.sh automatically sources .env before the build** — so a subsequent auto-update cycle will pick up your new LOCATION_NAME without any manual shell export. If you want to see the change RIGHT NOW without waiting for the next cron-driven auto-update:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
set -a; source .env; set +a  # push .env into the build shell
rm -rf apps/web/.next .turbo
npx turbo run build --force --filter=@sports-bar/web
pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js
```
(Note: `pm2 delete + start` rather than `pm2 restart` because PM2 restart doesn't re-read .env via ecosystem.config.js — see CLAUDE.md Gotcha about this pattern.)

4. Verify the tab title:
```bash
curl -s http://localhost:3001/ | grep -oE '<title[^>]*>[^<]+</title>'
curl -s http://localhost:3001/remote | grep -oE '<title[^>]*>[^<]+</title>'
```
Expected: `<title>YourLocation-Sports-Bar-TV-Controller</title>` on BOTH routes. If `/remote` shows the correct title but `/` doesn't, it means the dynamic path works but the build-time static path didn't pick up LOCATION_NAME — re-run step 3 and confirm `echo $LOCATION_NAME` in your shell returns the value before running `turbo build`.

**Rollback:** `git revert` restores the static metadata export and removes the turbo env array. Titles go back to "Sports Bar TV Controller" across the board. No data impact.

---

### v2.23.5 — Extract memory + versioning guides out of CLAUDE.md
**Released:** 2026-04-18

**What changed:**
- `docs/CLAUDE_MEMORY_GUIDE.md` (new) — full details on the three memory systems (auto-memory at `~/.claude/projects/.../memory/`, in-repo Memory Bank at `apps/web/src/lib/memory-bank/`, and CLAUDE.md itself). Contains the complete "how to apply" for Standing Rules 5 and 7 plus the memory-saving two-step process, edge cases, and stale-entry handling.
- `docs/CLAUDE_VERSIONING_GUIDE.md` (new) — full details on version-bumping rules, the interlock between `VERSION_SETUP_GUIDE.md` / `LOCATION_UPDATE_NOTES.md` / CLAUDE.md (disjoint responsibilities — whether-to-update vs. what-to-do vs. permanent-rules), commit strategy for release changes, and how auto-update Checkpoint A/B/C consume all three documents. Contains the complete "how to apply" for Standing Rule 8.
- `CLAUDE.md` — added a prominent "⚠️ READ FIRST" banner at the top pointing at both guides as required reading before non-trivial work. Trimmed Standing Rules 5, 7, 8 to one-line summaries that point to the guides. Replaced the 28-line Memory Bank System description (§6) with a one-paragraph summary + pointer. Replaced the Version Bumping section with a one-paragraph summary + pointer. Net: ~15 lines shorter, but much more scannable.

**Required Claude step at each location** (Claude: execute during Checkpoint B of the update that merges v2.23.5):

1. Read the READ FIRST block at the top of CLAUDE.md. Verify it references BOTH `docs/CLAUDE_MEMORY_GUIDE.md` AND `docs/CLAUDE_VERSIONING_GUIDE.md`:
```bash
head -25 /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md | grep -c "CLAUDE_MEMORY_GUIDE\|CLAUDE_VERSIONING_GUIDE"
```
Expected: `2` (both appear in the banner).

2. Read both new guides fully. They contain the authoritative version of Standing Rules 5, 7, 8 — CLAUDE.md's one-liners are only summaries.

3. **Sync memory ↔ new guides** per Rule 7 bidirectional sync. Since the content in the guides is derived from (not new vs.) prior CLAUDE.md content, most host auto-memory entries will already match. Do a pass to confirm. If memory references `CLAUDE.md §6 Memory Bank System` by line number, update the reference to `docs/CLAUDE_MEMORY_GUIDE.md` (the full text now lives there).

**Rollback:** `git revert` is clean — restores the full text into CLAUDE.md and removes the two guide files. All previously-authoritative rules remain intact after revert.

---

### v2.23.3 — context7 + brave-search MCP servers project-wide
**Released:** 2026-04-18

**What changed:**
- `.mcp.json` (new, at repo root) — declares two MCP (Model Context Protocol) servers that every Claude Code session inside this repo gets:
  - **`context7`** by Upstash (`@upstash/context7-mcp`) — fetches up-to-date, version-accurate library docs on demand (React, Next.js, Drizzle, Tailwind, any npm package). Free tier, no API key. Invoke by saying something like "use context7 to check the latest Drizzle ORM schema API" in a Claude session.
  - **`brave-search`** by MCP org (`@modelcontextprotocol/server-brave-search`) — web search. Requires `BRAVE_API_KEY` in each location's `.env` file. Works like a web-search tool (current-events questions, looking up hardware specs, checking vendor sites).
- `.claude/settings.json` — added `"enableAllProjectMcpServers": true` so MCP servers declared in the project's `.mcp.json` auto-approve without a human having to click through the Claude Code consent prompt on first session. Safe here because we only pull from `@modelcontextprotocol/*` (MCP org — protocol maintainers) and `@upstash/*` (reputable vendor).

**Required Claude step at each location** (Claude: execute this during Checkpoint B of the update that merges v2.23.3):

1. Verify `.mcp.json` arrived with the merge:
```bash
cat /home/ubuntu/Sports-Bar-TV-Controller/.mcp.json
```
Expected: contains `mcpServers.context7` and `mcpServers.brave-search` entries. The `$comment` key is intentional metadata — Claude Code ignores unknown top-level keys.

2. Confirm the auto-approve flag is in `.claude/settings.json`:
```bash
grep enableAllProjectMcpServers /home/ubuntu/Sports-Bar-TV-Controller/.claude/settings.json
```
Expected: `"enableAllProjectMcpServers": true`. If missing, the first Claude Code session at this repo will prompt a human to approve each server.

3. **(Optional but recommended)** Set up `BRAVE_API_KEY` so the `brave-search` MCP works at this location. **Without this step, Context7 works but Brave Search silently fails** when invoked — the MCP process starts, tries to read the key, aborts, and subsequent searches return empty. Not fatal to the Sports Bar app; just means that location loses the web-search tool.
    - Free tier (2,000 queries/month per key) is enough for operator/debugging use. Sign up at <https://api.search.brave.com/app/keys> — 2-minute flow, no credit card for free tier.
    - **Important — how the key actually reaches the MCP:** `.mcp.json` uses `${BRAVE_API_KEY}` which Claude Code interpolates from *its own process environment*, not from the project's `.env` file. Just editing `.env` is NOT enough — the shell that launches `claude` must have the variable exported. Two complementary places to set it:
      ```bash
      # (a) Export in every shell — works for interactive claude sessions:
      echo 'export BRAVE_API_KEY=<paste-key-here>' >> ~/.bashrc
      # Reload in your current shell or open a new one:
      source ~/.bashrc

      # (b) Also add to the project .env — so anything else at this location
      # (scripts, scheduled jobs) that reads .env sees it:
      echo 'BRAVE_API_KEY=<paste-key-here>' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
      ```
    - Both files stay on this host — `.env` is gitignored, `~/.bashrc` is per-user. Neither gets pushed to any branch.
    - No restart needed for the Sports Bar app; the next time you start a **new** Claude Code session in the repo, `npx` spawns the MCP with the new env var. If the session already running, exit and restart `claude`.

4. **Smoke-test both MCPs are wired correctly.** Start a Claude Code session at the repo and ask:
    - "Use context7 to look up the current @sports-bar/drizzle-orm type for a nullable column." → expect a real answer citing docs.
    - "Use brave search to find recent Spectrum cable firmware release notes." → expect search hits, OR a clear error if `BRAVE_API_KEY` isn't set.
    - If context7 reports "server not found" but the flag is set, force a reload: inside Claude Code run `/mcp` to see connected servers, or kill the session and restart.

**Why this matters for each location:**
- Context7 is particularly useful when debugging build errors — "why did this Next.js 16 API change" gets an accurate answer without the model hallucinating an API version.
- Brave Search is useful when Claude doesn't know the cable lineup in a new city, vendor docs aren't in the repo, or a firmware release note mention is needed (e.g., "is Spectrum re-enabling CEC on their new firmware?"). It also fills the gap in checkpoint A/B decisions when external context is needed.

**Rollback:** Delete `.mcp.json` and remove `"enableAllProjectMcpServers": true` from `.claude/settings.json` — MCP servers stop loading. The Sports Bar app itself has no runtime dependency on these; they only affect Claude Code sessions inside the repo.

---

### v2.23.2 — Enable frontend-design + feature-dev Claude Code plugins project-wide
**Released:** 2026-04-18

**What changed:**
- `.claude/settings.json` — new file at project scope. Sets `enabledPlugins` for `frontend-design@claude-plugins-official` and `feature-dev@claude-plugins-official`. These are plugins from Anthropic's built-in official marketplace (`claude-plugins-official`, auto-available in Claude Code — no `extraKnownMarketplaces` entry needed).
- **frontend-design** — design philosophy + system prompts that guide Claude to produce distinctive, production-grade UI (bold aesthetic choices, purposeful typography, intentional animations). Applies whenever the dev works on React/Next.js components. Invoked automatically by Claude when it detects UI/frontend work, or explicitly via `/frontend-design:*` skills after `/reload-plugins`.
- **feature-dev** — comprehensive feature-development workflow. Provides specialized subagents for codebase exploration, architecture design, and quality review. Also invokable via `/feature-dev:*` slash commands.

**Required Claude step at each location** (Claude: execute this during Checkpoint B of the update that merges v2.23.2):

1. Verify the `.claude/settings.json` file arrived with the merge:
```bash
cat /home/ubuntu/Sports-Bar-TV-Controller/.claude/settings.json
```
Expected: contains `enabledPlugins` with `frontend-design@claude-plugins-official` and `feature-dev@claude-plugins-official` both set to `true`.

2. The `claude-plugins-official` marketplace is built into Claude Code, so no marketplace-add is needed. However, the plugins themselves must be installed/cached. On most locations the official marketplace auto-updates at startup, so the plugins should be present. If a session later reports "plugin not found," run in Claude Code interactively:
```
/plugin marketplace update claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install feature-dev@claude-plugins-official
/reload-plugins
```

3. Verify plugins are loaded. In Claude Code CLI:
```bash
claude plugin list 2>&1 | grep -E "frontend-design|feature-dev"
```
Expected: both plugins listed as enabled. If missing from the list but present in `.claude/settings.json`, the plugin files need to be cached — run the `/plugin install` commands from step 2 in an interactive session once and Claude Code will remember them.

4. Confirm a Claude Code session invoked at the repo picks them up:
```bash
ls ~/.claude/plugins/cache/ 2>&1 | grep -E "frontend-design|feature-dev" || echo "(plugins not yet cached — run /plugin install as step 2)"
```

**Why this is a project-scoped commit rather than a per-host install:** installing user-scope (`~/.claude/`) at each location would require a manual step that's easy to skip. Committing `enabledPlugins` to `.claude/settings.json` means every location that trusts this repo in Claude Code inherits the same enabled plugin set, and `git pull` + next session start is enough to pick up new plugins added to the list later.

**Rollback:** `git revert` the commit — drops the `.claude/settings.json` file, plugins become disabled for project sessions. The underlying plugin files (if cached at user scope) stay. No DB or runtime impact.

---

### v2.23.0 — AI Suggest diversity + per-location station-alias seeding
**Released:** 2026-04-18

**What changed:**
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — Ollama prompt loosened so the AI now proposes up to `min(totalInputs*2, games.length, 20)` suggestions (previously hard-capped at 6). Rule 4/5/6 rewritten to encourage diverse league coverage and alternate routes (e.g. Brewers game on BOTH cable ch 308 and firetv Apple TV+) so the manager can pick. Parser dedup now allows up to 2 suggestions per input and 2 per game, rejecting only exact game+input duplicates. The pattern-analyzer then learns from the manager's approve choices (this is the feedback loop — scheduler reads `input_source_allocations.tv_output_ids` hourly and builds team-routing patterns from accepted suggestions).
- `apps/web/src/lib/seed-from-json.ts` — `seedStationAliases()` changed from "skip-if-any-rows" to per-row upsert (union-merge of aliases for existing rows, insert for new rows). Without this, new entries added to `STANDARD_ALIASES` in a future release would be no-ops at already-seeded locations. **Removed** hardcoded Green Bay broadcast affiliates (ABC→WBAY, NBC→WGBA, CBS→WFRV, FOX→WLUK) from `STANDARD_ALIASES` — these are location-specific and were wrong for Madison/Appleton/other cities. **Added** 9 universal streaming alias rows (PrimeVideo, AppleTVPlus, ParamountPlus, Peacock, ESPNPlus, Netflix, Max, YouTubeTV, Hulu).
- `apps/web/src/lib/seed-from-json.ts` — New `seedLocalStationAliases()` function that reads `apps/web/data/station-aliases-local.json` and upserts the entries. This file is an empty template on `main` and populated per-location on each `location/<name>` branch.
- `apps/web/data/station-aliases-local.json` — New file. On main: `{"aliases": []}`. On each location branch: populated with that city's OTA affiliate mappings.

**Bug this fixes:** AI Suggest was only surfacing 6 games to the manager, and many of them were MLB/NHL because the Green Bay-specific affiliate aliases (WBAY as ABC, etc.) didn't exist at non-Green-Bay locations — so NBA on ABC, UFL on FOX, EPL on NBC silently failed to resolve and were dropped from the "playable" pool. Manager couldn't approve games that the system had no idea existed.

---

**Required Claude step at each location (Claude: execute this during Checkpoint B of the update that merges v2.23.0):**

You MUST populate `apps/web/data/station-aliases-local.json` with this location's OTA broadcast affiliates BEFORE the build step runs, or broadcast-network games (anything on ABC, FOX, NBC, CBS that isn't on cable-specific affiliate channels) will fail to resolve. Do NOT just read this section — execute the steps below.

**Step 1.** Identify the location by reading `/home/ubuntu/Sports-Bar-TV-Controller/.env` for `LOCATION_NAME`, and cross-check the current `station_aliases` table to see what affiliate callsigns are already seeded:
```bash
grep LOCATION_NAME /home/ubuntu/Sports-Bar-TV-Controller/.env
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT standard_name, aliases FROM station_aliases WHERE aliases LIKE '%ABC%' OR aliases LIKE '%FOX%' OR aliases LIKE '%NBC%' OR aliases LIKE '%CBS%';"
```

**Step 2.** Determine the correct OTA affiliate callsigns for this city. Use this reference table — if your city isn't listed, look up "ABC affiliate <city>" / "FOX affiliate <city>" / "NBC affiliate <city>" / "CBS affiliate <city>" via web search:

| City | ABC | FOX | NBC | CBS |
|---|---|---|---|---|
| Green Bay, WI | WBAY (ch 2) | WLUK-TV (ch 11) | WGBA-TV (ch 26) | WFRV (ch 5) |
| Madison, WI | WKOW (ch 27) | WMSN-TV (ch 47) | WMTV (ch 15) | WISC-TV (ch 3) |
| Milwaukee, WI | WISN (ch 12) | WITI (ch 6) | WTMJ (ch 4) | WDJT (ch 58) |
| Appleton/Fox Cities, WI | WBAY (ch 2) | WLUK-TV (ch 11) | WGBA-TV (ch 26) | WFRV (ch 5) |

(Green Bay and Appleton share affiliates — they're the same DMA.)

**Step 3.** Write the file at `apps/web/data/station-aliases-local.json`. Replace the `standardName` values with this location's callsigns and adjust the `aliases` array to include `"<NETWORK>"` (bare), the callsign (`"WBAY"`), a `-TV` variant (`"WBAY-TV"`), and a display variant like `"ABC 2"` (callsign's actual OTA channel number):
```json
{
  "_location": "<LOCATION_NAME from .env>",
  "aliases": [
    {
      "standardName": "<ABC_CALLSIGN>",
      "aliases": ["ABC", "<ABC_CALLSIGN>", "<ABC_CALLSIGN>-TV", "ABC <OTA_CHANNEL>"]
    },
    {
      "standardName": "<FOX_CALLSIGN>",
      "aliases": ["FOX", "<FOX_CALLSIGN>", "<FOX_CALLSIGN>-TV", "FOX <OTA_CHANNEL>"]
    },
    {
      "standardName": "<NBC_CALLSIGN>",
      "aliases": ["NBC", "<NBC_CALLSIGN>", "<NBC_CALLSIGN>-TV", "NBC <OTA_CHANNEL>"]
    },
    {
      "standardName": "<CBS_CALLSIGN>",
      "aliases": ["CBS", "<CBS_CALLSIGN>", "<CBS_CALLSIGN>-TV", "CBS <OTA_CHANNEL>"]
    }
  ]
}
```

**Step 4.** Also patch the live `station_aliases` DB so the fix is active WITHOUT waiting for the next fresh install to run `seedLocalStationAliases()` (the seeder only runs on empty tables). Run this SQL, substituting the callsigns and channel numbers for YOUR city:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
UPDATE station_aliases
SET aliases = json_array('ABC','<ABC_CALLSIGN>','<ABC_CALLSIGN>-TV','ABC <OTA_CHANNEL>')
WHERE standard_name='<ABC_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('FOX','<FOX_CALLSIGN>','<FOX_CALLSIGN>-TV','FOX <OTA_CHANNEL>')
WHERE standard_name='<FOX_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('NBC','<NBC_CALLSIGN>','<NBC_CALLSIGN>-TV','NBC <OTA_CHANNEL>')
WHERE standard_name='<NBC_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('CBS','<CBS_CALLSIGN>','<CBS_CALLSIGN>-TV','CBS <OTA_CHANNEL>')
WHERE standard_name='<CBS_CALLSIGN>';
SQL
```

If the existing `station_aliases` table does NOT have a row for one of these callsigns (e.g., the location was seeded before any OTA affiliate seeding), insert it instead:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
INSERT OR IGNORE INTO station_aliases (id, standard_name, aliases, created_at) VALUES
  (lower(hex(randomblob(16))), '<CALLSIGN>', json_array('NETWORK','<CALLSIGN>','<CALLSIGN>-TV','NETWORK <OTA_CHANNEL>'), CURRENT_TIMESTAMP);
SQL
```

**Step 5.** Commit the populated JSON file to the location branch (NOT to main — main keeps the empty template):
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git add apps/web/data/station-aliases-local.json
git commit -m "feat(station-aliases): populate OTA affiliates for <LOCATION_NAME>"
# Push happens via auto-update.sh's normal push step — do not push manually.
```

**Step 6.** Verify the AI Suggest fix worked. After the build+restart, call the endpoint:
```bash
curl -s 'http://localhost:3001/api/scheduling/ai-suggest' | python3 -c '
import json, sys, collections
d = json.load(sys.stdin)
leagues = collections.Counter(s["league"] for s in d.get("suggestions", []))
print("leagues in suggestions:", dict(leagues))
print("total suggestions:", len(d.get("suggestions", [])))
'
```
Expected: more than 6 suggestions, spanning multiple leagues (MLB + NHL + NBA + MLS + UFL + UFC + etc., whatever has games in the 12h window). If you still see only MLB/NHL, one of the affiliate aliases was typed wrong — re-check Step 2's callsigns against the actual ESPN broadcast data (`sqlite3 .../production.db "SELECT DISTINCT broadcast_networks FROM game_schedules WHERE league='ufl' LIMIT 5;"` should show `["ABC"]` or `["FOX"]` — confirm your alias catches those bare names).

**Rollback:** The `seedStationAliases()` upsert change is additive (union-merge never deletes aliases). Reverting the code is safe; the DB rows stay. The AI Suggest prompt loosening is a prompt-text change — `git revert` removes it cleanly, and any in-flight AI suggestions from the new prompt continue to work because `parseOllamaResponse` handles both shapes.

---

### v2.22.6 — Checkpoint C enforces CLAUDE.md ↔ memory sync post-update
**Released:** 2026-04-17

**What changed:**
- `scripts/prompts/checkpoint-c.txt` — new "REQUIRED FIRST STEP" section that makes the post-restart Claude re-read `CLAUDE.md` in full, compare it against `~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/MEMORY.md`, add missing rules as new memory entries, correct memories that conflict, remove memories for deleted features, and scan the "Known Errors & Fixes" section of `VERSION_SETUP_GUIDE.md` for any fixes that still apply at this host — all BEFORE deciding GO/CAUTION.
- Backfill entries for v2.22.2/3/4/5 (previously shipped without doc entries) and two "Known Errors & Fixes" entries (Claude CLI 2.1.113+ TTY bug, Tailwind-lockfile drift) so the updated Checkpoint C has concrete content to sync.

**Required Manual Step:** None. Triggered automatically during every successful auto-update run.

**Verification:**
```bash
# After v2.22.6 lands, the most recent auto-update log should show the
# Checkpoint C response mention memory file edits or a "no drift found" note:
grep -A3 "Checkpoint C: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)

# The memory file should have a last-modified time close to the update:
stat -c "%y %n" ~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/MEMORY.md
```

**Rollback:** Prompt-only change. Revert safely removes the REQUIRED-FIRST-STEP block; Checkpoint C reverts to its prior behavior (holistic health sanity check only).

---

### v2.22.5 — Shift brief: real game times + anti-hallucination guardrail
**Released:** 2026-04-17

**What changed:**
- `apps/web/src/app/api/ai/shift-brief/route.ts` — `activeAllocations` query now selects `scheduled_start` + `status` from the joined `game_schedules` row. The mapped payload includes `startLocal` (formatted in `HARDWARE_CONFIG.venue.timezone`) and `status`. The Ollama prompt's "Currently playing" section now says `"Marlins @ Brewers (8 TVs, started 6:10 PM, in_progress)"` instead of a time-less version.
- Added a CRITICAL guardrail to the prompt: "Only reference game start times that are explicitly listed above. Never invent, estimate, or round times." This stops llama3.1:8b from fabricating times for in-progress games it had no time data for.
- Deterministic fallback brief (for when Ollama is down) also shows `"started <time>"` for active allocations.

**Bug this fixes:** Shift brief was reporting "Brewers starting at 9pm" for a game that actually started at 6:10pm CT. Root cause was a lossy prompt — the active-allocations context didn't carry the start time, so the LLM made one up. Verified on Stoneyard that the DB had the correct 23:10 UTC timestamp all along.

**Required Manual Step:** None. The fix is entirely code-side; the existing `scheduling_patterns` and `game_schedules` data is already correct.

**Verification:**
```bash
# After auto-update lands, force-refresh the brief and confirm times match DB:
curl -s 'http://localhost:3001/api/ai/shift-brief?force=true' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["brief"])'

# Compare against the actual DB times for any in-progress games:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT home_team_name, away_team_name, datetime(scheduled_start, 'unixepoch', 'localtime') FROM game_schedules WHERE status='in_progress';"
```

**Rollback:** Strictly additive fields + prompt-string change. `git revert` cleanly.

---

### v2.22.4 — Wrap claude -p in pseudo-TTY for CLI 2.1.113+
**Released:** 2026-04-17

**What changed:**
- `scripts/auto-update.sh` — the `run_checkpoint` function now wraps `claude -p --dangerously-skip-permissions` in `script -qfc "..." /dev/null` which creates a pty. The prompt is written to a mktemp file and read via `"$(cat ...)"` because multi-KB prompts on the command line overflow ARG_MAX once script/sh layers stack up.

**Bug this fixes:** Claude Code CLI 2.1.113+ aborts non-interactive `claude -p` with `Error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false)`. Checkpoint B/C on every location that auto-updated past 2.1.112 would fail and roll back. Affected Appleton, Graystone, Lucky's during the v2.22.x rollout. Stoneyard / Holmgren / Leg Lamp escaped because they were on 2.1.112 when their merges ran.

**Required Manual Step:** None. The fix lives in `auto-update.sh` itself; self-update re-exec ensures every location uses the fixed version starting with the run that merges it.

**Verification:**
```bash
# After a location auto-updates to v2.22.4+, the auto-update log should show
# Checkpoint B returned a DECISION (not "Claude Code timed out or errored"):
grep "Checkpoint B: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)
```

**Rollback:** `git revert` is safe — removes the pty wrapper. Only valid rollback target is back to `claude -p` direct invocation, which requires Claude CLI ≤ 2.1.112 to work. Do not revert unless every location's Claude CLI is downgraded.

---

### v2.22.3 — Revert Tailwind 4 → Tailwind 3 (v2.17.0 migration was incomplete)
**Released:** 2026-04-17

**What changed:**
- `apps/web/tailwind.config.js` restored from `5209838a^` (the commit that had deleted it claiming migration to `@theme` in globals.css, which was never actually done).
- `apps/web/postcss.config.js` reverted to `{ tailwindcss, autoprefixer }` plugins.
- `apps/web/package.json`: removed `@tailwindcss/postcss ^4.2.2`, added `autoprefixer ^10.4.21` back, `tailwindcss ^4.2.2` → `^3.4.18`.
- `package-lock.json` regenerated via `npm install --package-lock-only`.

**Bug this fixes:** v2.17.0's Tailwind 3→4 migration was half-done — `globals.css` still had v3 `@tailwind base/components/utilities` directives, `tailwind.config.js` was deleted with no `@theme` replacement, postcss.config still listed v3 plugins. Every location auto-update from v2.17.0 onward either failed `npm ci` (EUSAGE lockfile drift) or failed the build with "Cannot find module 'autoprefixer'" / "Cannot apply unknown utility class text-slate-100", rolled back cleanly.

**Required Manual Step:** None. Locations pulling this update will get the Tailwind 3 config + autoprefixer restored atomically.

**Verification:**
```bash
# Build should compile without the Tailwind errors that blocked v2.17.0-v2.22.2:
npx turbo run build --force --filter=@sports-bar/web 2>&1 | grep -E "Compiled|Cannot find|unknown utility" | head -5
# Expected: "✓ Compiled successfully in ~38s" and no Cannot-find/unknown-utility lines.
```

**Rollback:** If Tailwind 4 is re-attempted in the future, the migration MUST include: (a) rewrite `globals.css` from `@tailwind ...` to `@import 'tailwindcss'`, (b) add `@theme { ... }` block for custom colors, (c) update `postcss.config.js` to only `@tailwindcss/postcss`, (d) audit every `@apply` usage for v4 compatibility (v4 requires `@reference` in CSS modules). Don't ship without a successful local build at the operator's machine first.

---

### v2.22.2 — Tailwind 4 lockfile drift hotfix + npm-ci fail-safe
**Released:** 2026-04-17

**What changed:**
- `apps/web/package.json`: `tailwindcss ^3.4.18` → `^4.2.2` (matching the `@tailwindcss/postcss ^4.2.2` that commit 5209838a had added). Regenerated `package-lock.json`.
- `scripts/auto-update.sh` + `scripts/rollback.sh`: added a fail-safe — if `npm ci` exits with EUSAGE, fall back to `npm install` to regenerate node_modules from package.json. Location-side lockfile is rebuilt in-place but NOT committed back to git.

**Note:** This was an incomplete hotfix — v2.22.3 is the full Tailwind 3 revert that actually unblocks locations. The npm-ci fallback from v2.22.2 is kept because it's a strictly defensive addition for any future lockfile drift.

**Required Manual Step:** None.

**Verification:** Superseded by v2.22.3 verification.

---

### v2.22.0 — AI UI tiles + college baseball in Live Games
**Released:** 2026-04-17

**UI for v2.21.0 endpoints (all three wired in this release):**

1. **ShiftBriefTile** on the bartender remote (top of Video tab).
   Fetches `/api/ai/shift-brief` on mount, renders the LLM or
   deterministic brief, `Refresh` button forces regenerate,
   `Dismiss` hides for 4 hours (localStorage-backed).

2. **DistributionPlanModal** — the "Smart Distribute" button next to
   "Approve All" in the AI Suggest tab of ScheduledGamesPanel. Opens
   a modal that calls `/api/ai/distribution-plan` with the selected
   suggestions, shows per-line plan + preflight pills (chan ✓ / src ✓
   / outs ✓), lets bartender skip any line, and commits the selected
   rows through the existing `/api/schedules/bartender-schedule`
   POST one-at-a-time.

3. **ConflictAdvisor** — embedded inline when a bartender-schedule
   POST returns 409 inside the DistributionPlanModal. Calls
   `/api/ai/conflict-suggestion` with the rejected + conflicting
   allocation IDs. Renders recommendation + reasoning + optional
   one-line LLM summary. "Displace & retry" button triggers a force
   DELETE of the conflicting allocation followed by re-POST of the
   original body.

**Force-displace support in bartender-schedule DELETE:** Previously
only allowed cancellation of `pending` allocations. Now accepts
`?id=X&force=true` to displace `active` allocations — used exclusively
by the ConflictAdvisor flow. Sets status to `displaced` (not
`cancelled`) so forensics can tell the difference later, and clears
`input_sources.currentlyAllocated` so the replay POST can claim the
freed input.

**College baseball in Live Games (fix):** `ESPN_SPORTS` array in
`/api/sports-guide/live-by-channel/route.ts` did NOT include
`baseball/college-baseball`, so LSU/SEC games on ESPN/ESPNU never
appeared in the bartender remote's Live Games list even though they
were fully scheduled. Added the league. At Lucky's on April 17 this
went from showing 1 live game (Brewers) to 4 (Brewers + 3 college
baseball). No schema changes.

**Required manual steps:** None. Pure additive UI + one-line league
list fix. Restart PM2 after pulling.

**Verification:**
```bash
# Live games should include college baseball games that map to
# cable presets on ESPN/ESPNU/SEC Network / Longhorn Network:
curl -s 'http://localhost:3001/api/sports-guide/live-by-channel?deviceType=cable' \
  | jq '.channels | to_entries | map({ch: .key, league: .value.league, game: (.value.awayTeam + " @ " + .value.homeTeam)})'
```

**Bundle impact:** The three AI UI components are code-split into the
remote/page and ScheduledGamesPanel bundles. No runtime cost until
the user opens those views. ShiftBriefTile's `/api/ai/shift-brief`
call defers to the server-side 10-min cache, so back-to-back page
refreshes are cheap.

---

### v2.21.0 — AI features: shift brief, distribution optimizer, conflict advisor, weekly summary
**Released:** 2026-04-17

**Four new AI endpoints** (all under `/api/ai/*`):

1. **`GET /api/ai/shift-brief`** — Ollama-generated pre-shift summary
   (under 120 words) for the bartender opening the remote. Pulls
   upcoming games (next 12h), currently-playing games, recent
   failure-sweep clusters, and new override-digest recommendations.
   10-minute response cache. Graceful fallback to a deterministic
   text brief when Ollama is slow or unavailable.

2. **`POST /api/ai/distribution-plan`** — bulk scheduling optimizer.
   Give it an array of `{ gameScheduleId }`, get back an assignment
   plan that maximizes coverage: games routed to the right input
   sources with the right TV outputs using **historical data learned
   from prior games**: `scheduling_patterns` (team→input from
   pattern-analyzer), override-digest recommendations (bartender
   corrections), and per-league duration stats (game-duration-stats,
   v2.19.0). Spreads load across cable boxes automatically. Dry-run —
   caller commits each line through the existing bartender-schedule
   POST.

3. **`POST /api/ai/conflict-suggestion`** — when bartender-schedule
   returns 409, pass the rejected allocation and the conflicting
   allocation to get a ranked displacement recommendation
   (`displace` / `keep` / `ambiguous`) with factor-by-factor
   reasoning and an optional one-line LLM summary. Suggest-only — the
   UI must delete+re-POST to execute.

4. **`GET/POST /api/ai/weekly-summary`** — generates a markdown report
   of last week's operations: games aired, top teams by TV-hours,
   bartender corrections, stable learning patterns, failure clusters,
   AI Suggest usage. POST also writes the report to
   `apps/web/data/reports/week-YYYY-Www.md`. Auto-fired by
   scheduler-service on Mondays 06:00 local time.

**No schema changes.** Reads only from existing tables.

**Required manual steps:**
- [ ] **Ensure `OLLAMA_MODEL` matches an installed model.** Running
  `OLLAMA_MODEL=llama3.2` is common in older `.env` files but `latest`
  tag isn't always fetched. Check:
  ```bash
  curl -s http://localhost:11434/api/tags | jq -r '.models[].name'
  grep OLLAMA_MODEL /home/ubuntu/Sports-Bar-TV-Controller/.env
  ```
  Set `OLLAMA_MODEL=llama3.1:8b` (or whichever model is listed + you
  want to use) and `pm2 delete/start` to reload. The shift-brief + AI
  Suggest endpoints 404 silently if the model tag is wrong, falling
  back to deterministic text — still usable, but loses the LLM layer.
- [ ] **No new cron entry** — weekly summary hook piggybacks on the
  existing scheduler-service tick.

**Verification:**
```bash
# Smoke-test shift brief (may take ~50s on CPU-only Ollama first call)
curl -s http://localhost:3001/api/ai/shift-brief | jq '.brief' | head -30

# Smoke-test distribution plan against some upcoming games
curl -s -X POST http://localhost:3001/api/ai/distribution-plan \
  -H 'Content-Type: application/json' \
  -d "{\"games\":[{\"gameScheduleId\":\"<some-uuid>\"}]}" | jq '.plan'
```

**Where the historical signal comes from:**
- `scheduling_patterns` table (team_routing rows) — written hourly by
  `packages/scheduler/src/pattern-analyzer.ts`
- `SchedulerLog component='override-digest' operation='recommend'` —
  written hourly by `packages/scheduler/src/override-digester.ts` (v2.20.0)
- `game_schedules.duration_minutes` — written by ESPN sync (v2.19.0)

All three need at least a few days of real scheduler use before the
optimizer's recommendations become meaningfully specific. Before that,
it falls back to broad-spread across cable boxes, which is still a net
improvement over the pre-v2.21.0 behavior of "first-come-first-served".

---

### v2.20.0 — Autonomous agents + n8n cleanup + GPU benchmark
**Released:** 2026-04-17

**What changed:**

1. **`override-digester` (autonomous, hourly).** New
   `packages/scheduler/src/override-digester.ts`. Reads 30 days of
   `SchedulerLog component='override-learn'` events, buckets by
   (team, outputNum, action), and emits an hourly
   `[override-digest/summarize]` summary plus one
   `[override-digest/recommend]` row per stable pattern
   (≥3 occurrences). Home-team recommendations emit at `level='warn'`
   for prominence. Does NOT auto-mutate allocation defaults — it
   surfaces recommendations for a human review.

2. **`failure-sweeper` (autonomous, hourly).** New
   `packages/scheduler/src/failure-sweeper.ts`. Tails the last hour of
   `SchedulerLog` for `success=0` or `level∈(error,warn)` rows
   (excluding intentional high-vis override signals), buckets by
   (component, operation, first 60 chars of message), emits
   `[failure-sweep/scan]` every hour and a `[failure-sweep/cluster]`
   warn row per recurring signature (≥3 occurrences). Tonight's UUID
   parseInt bug would have been flagged within an hour under this.

3. **n8n dead code removed.** Deleted `n8n-workflows/` directory,
   `/api/n8n/webhook` route, n8n tab from AI Hub UI, `N8nWebhookLog` +
   `N8nWorkflowConfig` schema tables (both empty), and
   `/api/n8n` entry from `packages/auth/src/config.ts`
   webhook-endpoint patterns. The embedded iframe used to point at
   `http://24.123.87.42:5678` (a non-internal IP). ~300 lines gone.

**Schema changes:** `N8nWebhookLog` and `N8nWorkflowConfig` tables
dropped. Both were empty at every location. Drizzle schema no longer
declares them.

**Required manual steps:**
- [ ] **Drop n8n tables** (safe — always empty in practice):
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" "DROP TABLE IF EXISTS N8nWebhookLog; DROP TABLE IF EXISTS N8nWorkflowConfig;"
  ```
- [ ] **Restart PM2** — autonomous agents fire inside the existing
  hourly cleanup tick; no new scheduler entry point needed.

**Verification:**
```bash
# Agents should emit one summary + scan row per hour. Check last 4 hours:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT datetime(createdAt,'unixepoch','localtime'), component, operation, message
   FROM SchedulerLog
   WHERE component IN ('override-digest','failure-sweep')
     AND createdAt >= strftime('%s','now','-4 hours')
   ORDER BY createdAt DESC LIMIT 20;"
```

**GPU acceleration notes (for other locations deciding whether to try):**
- Ollama ships with a Vulkan backend at `/usr/local/lib/ollama/vulkan/`.
  Enable with `OLLAMA_VULKAN=1` (the environment var must be set — not
  just `OLLAMA_LLM_LIBRARY=vulkan`).
- **Intel Iris Xe (13900HK at Lucky's 1313): Vulkan is SLOWER than CPU.**
  CPU baseline 10.8 tok/sec, Vulkan 7.4 tok/sec on llama3.1:8b. The iGPU
  shares RAM (no bandwidth win) and has too few EUs to beat an
  alderlake-tuned ggml CPU build. **Don't enable.**
- Discrete GPU (NVIDIA ≥ 8GB, AMD RX with ROCm, Apple Silicon): very
  likely worth enabling. If a future location gets one, benchmark with
  the same `curl ... /api/generate ... "options":{"num_predict":80}`
  pattern against a CPU baseline and pick the winner.
- Do NOT add `OLLAMA_VULKAN=1` to `/etc/systemd/system/ollama.service`
  unless a per-location benchmark proves it's a net win. The default
  CPU path is the safe choice.

---

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

### Auto-update rolls back at `merge` step with "merge conflict on non-whitelisted file"

- **Symptom:** Log ends with lines like:
  ```
  CONFLICT (content): Merge conflict in apps/web/src/app/remote/page.tsx
  [AUTO-UPDATE] Unexpected merge conflict on non-whitelisted files:
  UU apps/web/src/app/remote/page.tsx
  [AUTO-UPDATE] FAIL at step 'merge': merge conflict on non-whitelisted file 3
  [AUTO-UPDATE] Triggering rollback
  ```
  Rollback succeeds; location stays on pre-update version. Happens on
  consecutive days without intervention because each attempt hits the
  same conflict.
- **Root cause:** Before v2.25.5, the auto-update conflict resolver
  only handled an exact-path whitelist
  (`LOCATION_PATHS_OURS` / `LOCATION_PATHS_THEIRS`). Shared-software
  files like `apps/web/src/app/remote/page.tsx` that have drifted
  between the location branch and main (usually from past on-device
  debugging) fell through both lists and aborted the whole update.
- **Fix (code, v2.25.5):** Added `SHARED_SOFTWARE_PREFIXES` fallback
  that force-takes MAIN for any remaining `UU` file under
  `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/lib/`
  (except `hardware-config.ts`, which stays in OURS),
  `apps/web/src/hooks/`, `apps/web/src/db/`, `apps/web/src/types/`,
  `apps/web/src/utils/`, `apps/web/public/`, `packages/`, `docs/`, or
  `drizzle/`. See the v2.25.5 entry above for the one-time bootstrap
  command to pick up the new resolver.
- **Fix (manual, one-time per location):** see v2.25.5 entry. After
  the one-shot manual merge, every subsequent auto-update uses the
  new script and won't hit this failure again.
- **Verification after fix:**
  ```bash
  grep -c "SHARED_SOFTWARE_PREFIXES" /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh
  # Expect >= 2
  ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1 \
    | xargs grep -c "shared-software fallback"
  # Expect >= 1 after the next auto-update run actually encounters a drift
  ```
- **Applies to:** any location that has edited a shared-UI file
  directly on its location branch (very likely most of them). Once
  bootstrapped, the fallback handles future drift silently.
- **First seen:** Lucky's 1313, back-to-back rollbacks at 2026-04-18
  16:07 and 2026-04-19 16:39 on `apps/web/src/app/remote/page.tsx`.

### Auto-update rolls back at Checkpoint B after Claude CLI 2.1.113+ install

- **Symptom:** `auto-update.sh` runs through merge, npm_ci, schema_push, then fails at Checkpoint B with `FAIL at step 'checkpoint_b': Checkpoint B: Claude Code CLI failure`. The checkpoint output log contains `Error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false)`. The auto-update rolls back cleanly (exit 4), no on-disk damage, but the location stays on its pre-merge version run after run.
- **Root cause:** Claude Code CLI 2.1.113 and later require a TTY for `claude -p` even when `--dangerously-skip-permissions` is set and stdin is piped. The auto-update runs via `setsid -f` detached from any TTY, so the check fails. Locations still on 2.1.112 don't hit this; locations where Claude CLI auto-updated past 2.1.112 do.
- **Fix:** Included in v2.22.4. `scripts/auto-update.sh` now wraps the invocation in `script -qfc "claude -p --dangerously-skip-permissions \"\$(cat $prompt_file_tmp)\"" /dev/null`, which provides a pty. Prompt goes through a mktemp file because multi-KB prompts on the command line overflow ARG_MAX once script/sh layers stack. If a location is stuck pre-v2.22.4, the workaround is to manually `git reset --hard` the location branch forward to v2.22.4 (or temporarily downgrade Claude CLI back to 2.1.112 with `curl -fsSL https://claude.ai/install.sh | bash -s -- --version 2.1.112`).
- **Verification:** `grep "Checkpoint B: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)` should return a DECISION line. Also confirm `claude --version` is ≥ 2.1.113 so you know the pty wrapper is actually what unblocked it.
- **Applies to:** all locations with Claude CLI ≥ 2.1.113. As of 2026-04-17 that's: Appleton, Graystone, Lucky's, Stoneyard-Greenville (post-upgrade). Holmgren + Leg Lamp escaped because their successful runs happened before their Claude CLI upgraded.
- **First seen:** 2026-04-17 at Appleton during v2.22.x batch rollout; Graystone and Lucky's hit the same within minutes. Fixed in v2.22.4.

### Every location rolls back at `npm_ci` with EUSAGE lockfile drift

- **Symptom:** Auto-update fails at `npm_ci` step with `npm error code EUSAGE / npm ci can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with npm install before continuing.` followed by a list of `Missing: <pkg>@<version> from lock file`. Rolls back cleanly.
- **Root cause:** A commit on main bumped a dep in a workspace `package.json` (typically `apps/web/package.json`) but the root `package-lock.json` wasn't regenerated in the same commit. `npm ci` is strict about this — correctly, since a stale lock means reproducible builds aren't actually reproducible. The concrete instance on 2026-04-17 was commit `5209838a` (v2.17.0 "Tailwind 4") that added `@tailwindcss/postcss ^4.2.2` to `apps/web/package.json` but didn't bump `tailwindcss` from `^3.4.18` to `^4.2.2` there, so the regenerated lockfile had inconsistent transitive deps.
- **Fix:** Two parts, both in v2.22.2:
  1. Fix the package.json drift on main: bump the misaligned dep, run `npm install --package-lock-only`, commit both files together.
  2. Defensive fallback in `scripts/auto-update.sh` (mirrored in `scripts/rollback.sh`): if `npm ci` exits with EUSAGE, fall back to `npm install --include=dev` which regenerates node_modules from package.json. The location's rebuilt lockfile is NOT pushed back to git — main still needs to be fixed — but one missed regen on main can no longer strand the fleet.
- **Verification:** `grep "npm install fallback succeeded" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)` — if this line is present the fallback fired and the root cause needs a main-side fix.
- **Applies to:** all locations.
- **First seen:** 2026-04-17 at all 6 locations simultaneously when v2.17.0 rolled out. Fallback added in v2.22.2.

### Location stuck at pre-v2.17.0 version because `npm ci` keeps failing

- **Symptom:** Location is on, say, v2.13.2 or v2.16.x. Auto-update log shows `FAIL at step 'npm_ci'` with `Missing: tailwindcss@3.4.19 from lock file` plus ~20 transitive deps. Rolls back, repeats on next cron cycle. Days pass with no actual update.
- **Root cause:** v2.17.0 shipped an incomplete Tailwind 3→4 migration — `globals.css` still used v3 syntax, `tailwind.config.js` was deleted with no `@theme` replacement, and the package.json ↔ lockfile drift from the entry above compounded. Even with v2.22.2's fallback landing the install, the build then failed with `Cannot find module 'autoprefixer'` or `Cannot apply unknown utility class text-slate-100`.
- **Fix:** v2.22.3 reverts the Tailwind 4 migration entirely — restores `apps/web/tailwind.config.js`, reverts `postcss.config.js` to `{ tailwindcss, autoprefixer }`, `apps/web/package.json` back to `tailwindcss ^3.4.18` + `autoprefixer ^10.4.21`, regenerates lockfile. Keeps the non-Tailwind parts of v2.17.0 (lucide-react 1.x, eslint 10, sqlite3 removal) since those worked.
- **Verification:** `grep version /home/ubuntu/Sports-Bar-TV-Controller/package.json` should read ≥ 2.22.3 after a successful auto-update. Then `ls apps/web/tailwind.config.js` should exist, and `npx turbo run build --force --filter=@sports-bar/web` should compile in ~38s with no Tailwind errors.
- **Applies to:** all locations.
- **First seen:** 2026-04-17 at Stoneyard, Graystone, Appleton, Holmgren, Lucky's, Leg Lamp — essentially the entire fleet during the v2.17.0 → v2.22.x batch.

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
