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
