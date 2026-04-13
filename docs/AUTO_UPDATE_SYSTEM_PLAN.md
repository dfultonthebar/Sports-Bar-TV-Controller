# Automated Daily Update System Plan

**Status:** v2 — post Plan-review corrections applied. Approved by user. No code changes yet.
**Target version:** 2.6.0 (channel resolver consolidation takes 2.5.0 and ships first)
**Scope:** Build a safe, automated 2:30am daily update mechanism that each location's server runs against its own location branch, with **Claude Code CLI as an active monitor throughout the update** (not just a post-check), complete rollback-on-failure handling, and a redesigned Sync tab UI for monitoring and manual control.

**Changes from v1 (2026-04-13 Plan-review pass + user direction on Claude Code role):**
- **Claude Code CLI is now an active monitor throughout the update flow, not a final verification bonus.** The user's direction: "Claude Code CLI needs to monitor the updates, read the updated documentation and current configuration so nothing gets broken." This changes the CLI from advisory to **required**, and adds pre-flight + in-flight + post-flight Claude Code checkpoints. See new Section 5 for full details.
- Cron time moved from 3:30am to **2:30am** Central. At 3:30am a slow rollback (build + verify) can overrun into the 4:00am channel preset cron, causing confusing failures.
- Lock file handling changed from a simple file-exists check to `flock` for crash-safe exclusion. A SIGKILL'd run no longer blocks the next day.
- Rollback pre-caches the old `.next` build as `.next.bak` before `rm -rf`, so rollback is an instant `mv` (seconds) rather than a full 8-10 minute rebuild.
- `package-lock.json` has its own special-case resolution (always `--theirs`, then `npm ci`) — the generic `--ours` for location files would break dependency installation from `main` updates.
- `ANTHROPIC_API_KEY` is now required in `/etc/environment` (system-wide), not `.bashrc`. Cron does NOT source `.bashrc`, so a key only in `.bashrc` silently fails every night.
- The single Phase 2 cron-install mechanism is the API route in Phase 2 writing to `/etc/cron.d/sports-bar-autoupdate`. The v1 "Phase 4 shell one-liner" was redundant and has been removed.
- Phase 3 split into Phase 3a (Sync tab UI for auto-update) and Phase 3b (separate commit for the color-clash fix at `/system-admin` lines 645-678).
- Added schema-push runtime-failure row to the failure matrix: acknowledges that a successful `drizzle-kit push` that adds a new NOT NULL column can still cause runtime failures, and flags it as requiring manual DB restoration.
- Added PID tracking via `~/sports-bar-data/auto-update.pid` so the status API can detect orphaned runs after a Next.js restart mid-update.
- Added version-regression pre-flight check (reject updates where `package.json` version decreased).

---

## 1. Problem statement

Today, pulling software updates at each location is a manual process:

1. SSH into the location's server.
2. Run `./update_from_github.sh`.
3. Watch for errors.
4. Verify the bartender remote still works.
5. Hope nothing broke overnight.

The existing `update_from_github.sh` script has several critical problems for automation:

- **It always does `git pull origin main`**, which is **wrong for location branches**. On `location/stoneyard-greenville`, a pull of `origin main` attempts to fast-forward the location branch to main — if location-specific commits (device IPs, layouts) exist, the pull produces a conflict, and the script's stash/pop handling doesn't cleanly recover. On a successful fast-forward, the location-specific commits are silently lost.
- **The DB backup step backs up `prisma/data/sports_bar.db`** which is the pre-Drizzle legacy path. The current production DB is at `/home/ubuntu/sports-bar-data/production.db`. The backup never touches the real database.
- **The HTTP health check polls `localhost:3001/`** for 30 seconds and declares success on HTTP 200. It doesn't check `/api/system/health`, doesn't confirm the bartender remote loads, doesn't verify Fire TVs are reachable, doesn't check scheduler health.
- **There is no rollback mechanism.** If the build fails after the merge, the script exits with an error and leaves the git state mid-merge. Someone has to SSH in, `git reset --hard`, and rebuild manually.
- **The Sync tab on `/system-admin` only pushes config to GitHub** — there's no UI for pulling updates, no auto-update toggle, no schedule setting, no rollback button, no update history.
- **Claude Code CLI is installed on each ISO build** (via `scripts/iso/build-sports-bar-iso.sh`) but **no existing script invokes it for automation**. It's effectively dormant as a verification tool.

The user wants: **4am every morning, each location automatically pulls latest main, merges into its location branch, builds, restarts, verifies with Claude Code, and rolls back if anything broke** — with a Sync tab UI for monitoring and manual control.

## 2. Target architecture

**Core flow at 2:30am Central:**

```
┌─────────────────────────────────────────────────────────┐
│  cron: 30 2 * * * /home/ubuntu/auto-update.sh          │
│  (in /etc/cron.d/sports-bar-autoupdate)                 │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 1: Pre-flight checks                             │
│   - Disk space > 2GB                                    │
│   - PM2 shows app online                                │
│   - Network reachable (github + ollama)                 │
│   - Current commit SHA saved to rollback marker         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 2: DB + config backup                            │
│   - cp production.db -> backups/pre-update-$(date).db   │
│   - tar apps/web/data + .env -> backups/                │
│   - git tag rollback-$(date) HEAD                       │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 3: Git fetch + merge                             │
│   - git fetch origin                                    │
│   - git merge origin/main (with auto --ours for known   │
│     location-specific paths on conflict)                │
│   - If unexpected conflict: abort, notify, exit         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 4: Build                                         │
│   - rm -rf apps/web/.next                               │
│   - npm ci (--omit=optional)                            │
│   - npm run build (10 min timeout)                      │
│   - If fails: rollback to tag, rebuild old version      │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 5: Drizzle schema push                           │
│   - npx drizzle-kit push                                │
│   - If fails: warn only (app likely still runs)         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 6: PM2 restart                                   │
│   - pm2 restart sports-bar-tv-controller --update-env   │
│   - Wait 15s for boot                                   │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 7: Multi-layer verification                      │
│   a. PM2 online + restart_count stable (no crash loop)  │
│   b. curl /api/system/health returns healthy/degraded   │
│   c. curl /api/scheduling/games returns array          │
│   d. curl /remote loads (HTTP 200 + non-empty body)     │
│   e. Claude Code CLI headless verification (see §5)     │
│   If any layer fails: ROLLBACK                          │
└───────────────────┬─────────────────────────────────────┘
                    │
            ┌───────┴───────┐
            │               │
            ▼               ▼
     ┌──────────┐    ┌──────────────────────────────────┐
     │ Success  │    │  Rollback                         │
     │ Log OK   │    │   - git reset --hard rollback-tag │
     │ Notify   │    │   - rm -rf .next && npm run build │
     └──────────┘    │   - pm2 restart                   │
                     │   - Verify rollback worked        │
                     │   - Alert bartender via log +     │
                     │     systemSettings row + email    │
                     └──────────────────────────────────┘
```

**Sync tab redesign:** A single admin UI for viewing update status, triggering manual updates, viewing recent run logs, and managing the auto-update schedule.

## 3. Critical constraints — things that MUST NOT break

1. **Location-specific data preservation.** `apps/web/data/*.json`, `data/*.json`, `.env`, `apps/web/public/uploads/layouts/`, `apps/web/data/atlas-configs/` must never be overwritten by a merge. The auto-updater auto-resolves conflicts on these paths with `--ours`.

2. **Location branch identity.** Each location runs from its location branch (e.g. `location/stoneyard-greenville`), NOT `main`. The auto-updater fetches `origin/main` and MERGES into the current branch — it never switches branches. A naive `git pull origin main` on a location branch would destroy location commits — this must be eliminated from the flow.

3. **Bartender remote availability.** Update window is 4-4:15am local time. Bars are closed but the bartender remote might still be in use (cleanup shift). The restart window should take under 2 minutes. If verification fails and rollback happens, the whole flow must finish before 4:30am.

4. **Database integrity.** `/home/ubuntu/sports-bar-data/production.db` is the live database. It must be backed up (not just copied — flushed to disk first via sqlite `.backup`) before anything touches the schema. Any Drizzle schema push must be reversible or at least additive only.

5. **PM2 crash-loop detection.** Must catch the case where the new code builds fine but crashes on boot, causing PM2 to restart-restart-restart. Detection: `pm2 jlist | jq '.[0].pm2_env.restart_time'` should stabilize within 15 seconds.

6. **Timezone correctness.** The user said 4am; the server timezone on ISO-built installs is `America/Chicago`. The cron entry uses `TZ=America/Chicago 0 4 * * *` to be explicit, not implicit.

7. **Idempotency.** Re-running the updater twice on the same day should not cause harm. If the second run finds no new commits, it exits early without rebuilding.

8. **The 4am slot is already used by `presetCronService`** (channel preset sync from Rail Media, confirmed at line 48 of `presetCronService.ts`). Auto-update must run at a non-conflicting time with enough headroom for the worst case: failed build + rollback rebuild + rollback verification + Claude Code Checkpoint C, which can total ~25 minutes on a cold cache. v1 proposed 3:30am but that leaves only 30 minutes of headroom which can overlap with the 4:00am preset cron. **v2 uses 2:30am** which leaves 90 minutes — enough for two rollback attempts if needed.

## 4. Pre-work (before Phase 1 can start)

### Pre-work 1: Fix the existing `update_from_github.sh` (branch awareness + correct DB path)

The current script is unsafe even for manual use. Fix it FIRST as a standalone pre-work commit so every location has a working manual updater as a safety net before the auto-updater ships.

**Changes:**
- Replace `git pull origin main` with:
  ```bash
  CURRENT_BRANCH=$(git branch --show-current)
  git fetch origin
  git merge origin/main --no-edit -m "chore: auto-merge main into $CURRENT_BRANCH"
  ```
- Fix the DB backup path: use `/home/ubuntu/sports-bar-data/production.db` via `sqlite3 ... .backup`, not `cp` on the legacy Prisma path.
- Add auto-resolve for known location-specific paths on conflict:
  ```bash
  LOCATION_PATHS=(
    "apps/web/data/tv-layout.json"
    "apps/web/data/directv-devices.json"
    "apps/web/data/firetv-devices.json"
    "apps/web/data/device-subscriptions.json"
    "apps/web/data/wolfpack-devices.json"
    "apps/web/data/atlas-configs"
    "apps/web/data/channel-presets-cable.json"     # from channel-resolver plan
    "apps/web/data/channel-presets-directv.json"
    "apps/web/public/uploads/layouts"
    "data"
    ".env"
  )
  for path in "${LOCATION_PATHS[@]}"; do
    if git status --porcelain "$path" | grep -q "^UU"; then
      echo "Conflict on $path — keeping location version"
      git checkout --ours "$path"
      git add "$path"
    fi
  done
  ```

**Pre-work 1 output:** Fixed `update_from_github.sh`, committed and tested manually on Stoneyard.

### Pre-work 2: Build the post-update verification script

Create `scripts/verify-install.sh` — a standalone shell script that does the five verification layers from Phase 7 above. Exit 0 = healthy, exit 1 = degraded (boot but health check warns), exit 2 = critical (boot failed, crashes, or Claude Code verification fails). The auto-updater uses this script as the gate; operators can run it manually anytime.

**Script layers:**

1. **PM2 online check.** `pm2 jlist | jq -e '.[] | select(.name == "sports-bar-tv-controller") | .pm2_env.status == "online"'`. Fail if not online.

2. **Restart loop check.** `pm2 jlist | jq '.[0].pm2_env.restart_time'` at t=0 and t=15. Delta > 1 = crash loop = fail.

3. **HTTP health check.** `curl -sf http://localhost:3001/api/system/health`. Parse `.overall.status`. `healthy` = pass, `degraded` = pass with warning, `critical` = fail.

4. **Smoke-test key endpoints.**
   - `curl -sf http://localhost:3001/remote` returns HTTP 200 and body contains "BartenderRemote"
   - `curl -sf http://localhost:3001/sports-guide-admin` returns HTTP 200
   - `curl -sf http://localhost:3001/api/scheduling/games?limit=5` returns `{success:true,games:[...]}`

5. **Claude Code headless verification.** Invoke Claude Code CLI with a structured prompt that reads recent PM2 logs and scheduler logs, checks git status, and returns `PASS` or `FAIL` + one-line reasoning. Details in §5.

**Script output:** Single JSON object printed to stdout with `{status, layers: [{name, passed, detail}], durationMs}`. Also appended to `~/sports-bar-data/update-logs/verify-$(date).json` for history.

**Pre-work 2 output:** `scripts/verify-install.sh`, tested manually on Stoneyard.

### Pre-work 3: Confirm Claude Code CLI works headlessly AND is accessible to cron

The auto-update research agent found that Claude Code CLI is installed per-user on ISO builds but nobody has tested it headlessly AND nobody has confirmed it works from the cron environment specifically. Cron runs with a minimal environment — it does NOT source `~/.bashrc` or `~/.profile`. Pre-work 3 proves it works from both contexts.

**Steps:**

1. **Confirm install path:** `which claude` (expected: `/home/ubuntu/.claude/local/claude` or `/usr/local/bin/claude`).
2. **Confirm auth:** `claude --version` should not prompt for login.
3. **Test headless from an interactive shell:** `echo "Reply with just the word PASS" | claude -p --no-interactive` should print `PASS`.
4. **CRITICAL — test from a cron-like environment:**
   ```bash
   env -i HOME=/home/ubuntu PATH=/usr/local/bin:/usr/bin:/bin bash -c 'claude --version'
   ```
   This simulates cron's minimal environment. If this fails with "command not found", the PATH is wrong and the cron entry needs an explicit `PATH=...` line. If it fails with "authentication required", `ANTHROPIC_API_KEY` is not in the environment.
5. **Require `ANTHROPIC_API_KEY` in `/etc/environment`** (NOT `.bashrc`). Confirm with:
   ```bash
   grep -q "^ANTHROPIC_API_KEY=" /etc/environment || echo "FAIL: key not in /etc/environment"
   ```
   If missing, add it with `sudo` as part of pre-work:
   ```bash
   echo "ANTHROPIC_API_KEY=<value>" | sudo tee -a /etc/environment
   ```
   Note that `/etc/environment` is sourced by PAM and available to cron — this is the correct place for system-wide secrets. Alternative: the systemd user unit (recommended in Phase 2's implementation note) can load an `EnvironmentFile=/home/ubuntu/.config/sports-bar.env` that contains just the key with `chmod 600`.

**Pre-work 3 output:** A confirmed-working headless Claude Code CLI invocation from a minimal shell environment, documented in `docs/AUTO_UPDATE_SETUP.md` (new file). **If Claude Code cannot be made to work from cron, the auto-update feature cannot ship** — Claude Code is a required dependency per user direction, not optional.

### Pre-work 4: Decide where auto-update state lives

Options:
- **`config/auto-sync.json`** — extend the existing file with `autoUpdate: {enabled, schedule, lastRun, lastResult, lastCommitSha}`. Pro: reuses existing file. Con: mixes two concepts (config push vs code pull).
- **`systemSettings` table row with key `auto_update_state`** — JSON value with the same fields. Pro: queryable from any API, single source of truth. Con: requires DB read for every status query.
- **`~/sports-bar-data/auto-update-state.json`** — dedicated file outside the repo. Pro: persists across git operations. Con: not visible to the web UI unless a new API route reads it.

**Recommendation:** `systemSettings` row. Matches the existing `default_sources` and `sports_guide_update_schedule` patterns added in v2.3.0 / v2.4.3. The Sync tab can then GET `/api/settings/auto-update` to render state.

## 5. Claude Code CLI as active monitor (REQUIRED dependency)

**Per user direction:** Claude Code CLI is not a bonus check at the end of the update. It actively monitors the update at three checkpoints, reads the updated documentation and the location's current configuration, and makes decisions about whether to proceed, proceed with caution, or stop entirely. **This makes Claude Code a required dependency — the auto-update cannot run if Claude Code CLI is missing, unauthenticated, or returns a STOP at any checkpoint.**

### 5.1 Pre-flight dependency checks (before every run)

Before the update flow starts, the auto-updater verifies Claude Code is operational:

```bash
# 1. Binary exists
which claude >/dev/null || fail "Claude Code CLI not installed"

# 2. Version check responds without prompting for auth
timeout 15 claude --version >/dev/null 2>&1 || fail "Claude Code CLI not responding or not authenticated"

# 3. API key is present in the cron environment (NOT .bashrc — cron doesn't source it)
test -n "${ANTHROPIC_API_KEY:-}" || fail "ANTHROPIC_API_KEY missing from cron environment"

# 4. Quick smoke-test invocation
echo "Reply with exactly: READY" | timeout 30 claude -p --no-interactive 2>&1 | grep -q "^READY$" || fail "Claude Code smoke test failed"
```

If any of these fail, the auto-update logs the failure to `~/sports-bar-data/update-logs/` and exits with an "infrastructure unavailable" status. No git operations happen. The Sync tab UI shows a red banner: "Auto-update disabled: Claude Code verification unavailable — see log for details."

### 5.2 Checkpoint A — Pre-update analysis (before merge)

After `git fetch origin` but BEFORE `git merge origin/main`, the auto-updater invokes Claude Code with a structured prompt:

```
You are doing pre-update analysis for the Sports Bar TV Controller application.

Context:
- Location: $(git branch --show-current)
- Current commit: $(git rev-parse HEAD)
- Target: origin/main @ $(git rev-parse origin/main)
- Commits being merged: $(git log --oneline HEAD..origin/main)

Your task is to read these sources and decide whether to proceed with the merge.

REQUIRED READS:
1. /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md (full file)
2. /home/ubuntu/Sports-Bar-TV-Controller/docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md
3. /home/ubuntu/Sports-Bar-TV-Controller/docs/SCHEDULER_FIXES_APRIL_2026.md
4. The diff of the commits being merged: `git log -p HEAD..origin/main`
5. The location's current JSON config files under apps/web/data/*.json (read as LOCATION_CONFIG)
6. The current database schema: `sqlite3 /home/ubuntu/sports-bar-data/production.db ".schema"`
7. Any .md files in docs/ that changed in the diff (read those in full)

DECISION CRITERIA:
- GO: the diff only touches source code + docs, no schema migrations, no breaking API changes, location-specific config paths are not modified.
- CAUTION: the diff adds a new DB column or table, or changes an API contract, but the location's current data is compatible. Proceed with extra monitoring on Checkpoints B and C.
- STOP: the diff includes a schema migration that requires data migration (e.g., new NOT NULL column with no default, or a renamed column), OR the diff modifies a file listed in the location-specific paths (tv-layout.json, directv-devices.json, etc.), OR the diff includes a dependency version that is known to break this project.

OUTPUT FORMAT (first line only):
DECISION: GO
DECISION: CAUTION - <one sentence explaining what to watch>
DECISION: STOP - <one sentence explaining the blocker>

Do NOT include any text before that line. The auto-updater parses it with grep.
```

**Invocation + parsing:**

```bash
PROMPT=$(cat /home/ubuntu/Sports-Bar-TV-Controller/scripts/prompts/checkpoint-a.txt)
timeout 120 claude -p --no-interactive "$PROMPT" > /tmp/claude-checkpoint-a.txt 2>&1 || {
  log "Checkpoint A: Claude Code timed out or errored"
  exit 2  # REQUIRED dependency fail → abort update
}

if grep -q "^DECISION: GO" /tmp/claude-checkpoint-a.txt; then
  log "Checkpoint A: GO"
elif grep -q "^DECISION: CAUTION" /tmp/claude-checkpoint-a.txt; then
  log "Checkpoint A: CAUTION - $(grep CAUTION /tmp/claude-checkpoint-a.txt)"
  CAUTION_MODE=1
elif grep -q "^DECISION: STOP" /tmp/claude-checkpoint-a.txt; then
  reason=$(grep STOP /tmp/claude-checkpoint-a.txt | head -1)
  log "Checkpoint A: STOP - $reason"
  exit 2  # abort before touching anything
else
  log "Checkpoint A: UNDETERMINED response from Claude Code"
  exit 2
fi
```

**What STOP at Checkpoint A means:** The update is ABORTED before the merge. Nothing changes on disk. The Sync tab shows "Update blocked by pre-flight analysis: <reason>". A human must review and decide whether to manually merge or skip this update.

### 5.3 Checkpoint B — Post-merge / pre-build review

After `git merge` succeeds and `npm ci` completes, but BEFORE `npm run build`:

```
You are doing post-merge review. The merge completed without conflicts. Before I rebuild the application, confirm the merged code is coherent with this location's existing configuration.

REQUIRED READS:
1. The merge commit's diff: `git show HEAD`
2. Any .md docs in docs/ that were modified
3. The current state of apps/web/data/*.json (these should NOT have changed during merge)
4. .env file (sanitized — do not log secrets, just confirm expected keys exist like ANTHROPIC_API_KEY, SPORTS_GUIDE_USER_ID)
5. The current channel_presets table: `sqlite3 production.db "SELECT COUNT(*), deviceType FROM ChannelPreset GROUP BY deviceType"`

DECISION CRITERIA:
- GO: merged state is coherent. Config files intact. No unexpected changes to location-specific paths.
- CAUTION: merged state is coherent but has warnings (e.g., a new .env variable is required that is not set — but app may still start in degraded mode).
- STOP: location-specific config file was modified by the merge (indicates a conflict resolution failure), OR a required new .env variable is missing, OR the channel_presets table has become empty.

OUTPUT: DECISION: GO|CAUTION|STOP - <reason>
```

STOP at Checkpoint B aborts the build and triggers rollback of the merge (`git reset --hard` to the rollback tag).

### 5.4 Checkpoint C — Post-restart smoke check

After PM2 restart + the four deterministic layers (PM2 status, restart loop check, HTTP health, endpoint smoke tests), Claude Code does a final holistic review:

```
You are doing post-restart verification. The application has restarted and passed the basic HTTP + health checks. Do a holistic read of the last few minutes to confirm nothing is subtly broken.

REQUIRED READS:
1. The last 100 lines of PM2 logs: `pm2 logs sports-bar-tv-controller --lines 100 --nostream`
2. The last 20 SchedulerLog entries: `sqlite3 production.db "SELECT datetime(createdAt,'unixepoch','localtime'), level, component, operation, message FROM SchedulerLog ORDER BY createdAt DESC LIMIT 20"`
3. Run a live health check: `curl -s http://localhost:3001/api/system/health | jq .`
4. Run the bartender remote smoke test: `curl -s http://localhost:3001/remote | head -200`

DECISION CRITERIA:
- GO: no error-level entries in the last 5 minutes, health is healthy or degraded, /remote renders the BartenderRemote component.
- CAUTION: degraded health but no errors. Update succeeded but an operator should check the Sync tab log.
- STOP: errors in logs, crashes in PM2, /remote fails to render, or the bartender remote HTML is missing expected components.

OUTPUT: DECISION: GO|CAUTION|STOP - <reason>
```

STOP at Checkpoint C triggers rollback (`mv .next.bak .next`, PM2 restart, re-verify).

### 5.5 Failure modes for the Claude Code layer

| Failure | Response |
|---|---|
| CLI not installed | Pre-flight check fails. Auto-update disables itself. Admin sees red banner. |
| `ANTHROPIC_API_KEY` missing from cron environment | Pre-flight check fails. Same as above. |
| API rate limit hit mid-checkpoint | Treated as STOP (fail safe: if we can't verify, we don't change things). |
| Auth error (expired key) | Pre-flight check fails (or Checkpoint A fails with auth error). |
| Claude Code returns PASS followed by explanation | The `^DECISION:` anchor ensures only the first line is parsed. Extra explanation is preserved in the log file but doesn't affect the decision. |
| Claude Code sub-process hangs (shell commands it runs in the prompt) | Outer `timeout 120` kills the whole invocation. Treated as STOP. |
| Network issue reaching Anthropic API | Pre-flight or checkpoint fails with timeout. Treated as STOP (fail safe). |
| ANTHROPIC_API_KEY rotated mid-week | Next run's pre-flight fails. Admin sees red banner before any damage. |

**No rollback on Claude Code CLI failure by itself** — because a STOP at Checkpoint A happens BEFORE any state change, there's nothing to roll back. STOP at Checkpoint B aborts the build and does `git reset` to the rollback tag, which is a clean rollback. STOP at Checkpoint C does the `.next.bak` mv rollback + PM2 restart.

### 5.6 Prompts are version-controlled

All three checkpoint prompts live in `scripts/prompts/checkpoint-{a,b,c}.txt` in the repo so they can be updated, versioned, and reviewed like any other file. The auto-updater reads the prompts from disk at runtime. Changes to prompts are themselves deployed via the auto-update mechanism.

## 6. Phase-by-phase execution

Every phase is a separate commit. Phases 1-3 can run in parallel after pre-work.

### Phase 1 — Build `auto-update.sh` shell script

**File:** new `scripts/auto-update.sh`. Encapsulates everything in the flow diagram from §2. Calls `scripts/verify-install.sh` from pre-work 2. Invokes Claude Code at three checkpoints per §5. Also creates `scripts/prompts/checkpoint-{a,b,c}.txt` with the structured prompts.

**Key features:**

- **Strict error handling** via `set -euo pipefail` — but the rollback function does NOT rely on `|| { return 99 }` (which is incompatible with `set -e`). Instead, rollback is a separate script (`scripts/rollback.sh`) invoked with `trap`:
  ```bash
  cleanup_on_error() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
      echo "[AUTO-UPDATE] FAILED at step: $CURRENT_STEP (exit $exit_code)"
      scripts/rollback.sh "$ROLLBACK_TAG" "$CURRENT_STEP" || true
    fi
  }
  trap cleanup_on_error EXIT
  ```
  This lets each step exit non-zero without fighting `set -e`, and the trap ensures rollback runs on any failure.

- **`flock` for crash-safe mutual exclusion** — replaces the simple lock file check. A SIGKILL'd run no longer leaves a stale lock:
  ```bash
  exec 200>/var/lock/sports-bar-auto-update.lock
  flock -n 200 || { echo "[AUTO-UPDATE] Another run in progress — exiting"; exit 0; }
  ```
  `flock -n` fails immediately if locked; the lock is released automatically when the process exits (including SIGKILL).

- **PID file for status tracking** — writes `$$` to `~/sports-bar-data/auto-update.pid` at start, deletes on exit. The Sync tab's status API checks this file + does `kill -0 <pid>` to determine if a run is truly still active vs orphaned (e.g. if Next.js restarted mid-update, the status API needs a way to detect the detached script is still alive).

- **`.next.bak` caching for instant rollback** — before `rm -rf apps/web/.next && npm run build`, the script moves the old build to `apps/web/.next.bak`. If rollback is triggered, `mv apps/web/.next.bak apps/web/.next` is an instant file-rename (no rebuild needed). The rebuild path is only used if `.next.bak` doesn't exist (first run) or is corrupted. This cuts rollback time from 8-10 minutes to ~15 seconds.

- **Writes a single append-only log file** at `~/sports-bar-data/update-logs/auto-update-$(date +%Y-%m-%d-%H-%M).log`.
- **Captures stdout/stderr** of every sub-command with `2>&1 | tee -a "$LOG_FILE"`.
- **After completion** (success or fail), writes a summary JSON to `~/sports-bar-data/update-logs/latest.json` and updates the `auto_update_state` row in `systemSettings`.
- **Idempotent:** if `git fetch` shows no new commits from main, exit early with "no update available" (exit 0, no state change).
- **Version-regression pre-flight check:** `jq .version package.json` before the merge; after the merge; abort if the post-merge version is numerically lower than the pre-merge version (prevents a bad cherry-pick from downgrading a location).

**Merge conflict resolution rules** (codified in the script):

```bash
LOCATION_PATHS_OURS=(
  "apps/web/data/tv-layout.json"
  "apps/web/data/directv-devices.json"
  "apps/web/data/firetv-devices.json"
  "apps/web/data/device-subscriptions.json"
  "apps/web/data/wolfpack-devices.json"
  "apps/web/data/atlas-configs"
  "apps/web/data/channel-presets-cable.json"     # from channel-resolver plan
  "apps/web/data/channel-presets-directv.json"
  "apps/web/public/uploads/layouts"
  "data"
  ".env"
)

# Special case: package-lock.json MUST use --theirs (main's lockfile),
# otherwise new dependencies from main fail to install via `npm ci`.
LOCATION_PATHS_THEIRS=(
  "package-lock.json"
  "package.json"                    # version bumps always win from main
)

for path in "${LOCATION_PATHS_OURS[@]}"; do
  if git status --porcelain "$path" 2>/dev/null | grep -q "^UU"; then
    git checkout --ours "$path"
    git add "$path"
  fi
done
for path in "${LOCATION_PATHS_THEIRS[@]}"; do
  if git status --porcelain "$path" 2>/dev/null | grep -q "^UU"; then
    git checkout --theirs "$path"
    git add "$path"
  fi
done

# Any remaining conflict = abort (unexpected file conflict = human required)
if git status --porcelain | grep -q "^UU"; then
  echo "[AUTO-UPDATE] Unexpected merge conflict on non-whitelisted file — aborting"
  exit 2
fi
```

**Verification:**
- Run manually on Stoneyard with `--dry-run` flag. Confirm it fetches, would merge, prints what it would do, and exits without touching anything.
- **Intentional build error test:** create a test branch `test/auto-update-intentional-fail` with a deliberate TypeScript error in an app route. Run the auto-updater manually against it. Confirm rollback triggers, `.next.bak` is restored, PM2 restarts cleanly, the pre-failure version is live.
- **Intentional runtime crash test:** create `test/auto-update-intentional-crash` with code that builds fine but throws at module-import time. Run the auto-updater. Confirm the Phase 7 crash-loop detection catches it and triggers rollback.
- Claude Code CLI checkpoint A/B/C prompts exist in `scripts/prompts/` and are readable.

**Risk:** MEDIUM. Script is complex. The rollback paths specifically must be exercised via the two intentional-failure test branches before the script ships.

**Rollback:** Revert commit. The script doesn't exist; manual updates still work via the fixed `update_from_github.sh`.

### Phase 2 — Build `/api/system/auto-update/*` routes

**Files:** new folder `apps/web/src/app/api/system/auto-update/`.

**Routes:**

- `GET /api/system/auto-update/status` — reads `auto_update_state` from systemSettings and returns `{enabled, schedule, lastRun, lastResult, lastCommitSha, recentRuns, currentlyRunning}`. `recentRuns` tailgates the last 10 files from `~/sports-bar-data/update-logs/`. `currentlyRunning` is determined by reading `~/sports-bar-data/auto-update.pid` and checking `kill -0 <pid>` — this detects orphaned runs after a Next.js restart.
- `PUT /api/system/auto-update/settings` — body `{enabled, schedule}` — validates and writes to `auto_update_state`. If `enabled=true`, writes the cron file at `/etc/cron.d/sports-bar-autoupdate` (via `sudo` or a systemd unit — see implementation note below). **Uses a dedicated cron.d file, NOT the user's crontab**, to avoid the v1 fragility where manual `crontab -e` edits could break the grep-based update logic.
- `POST /api/system/auto-update/run-now` — spawns `scripts/auto-update.sh` via `child_process.spawn` detached. Returns `{jobId: string}` where `jobId` is the log file timestamp stem (`auto-update-2026-04-14-02-30`). The detached process writes to that log file; the UI tails it.
- `GET /api/system/auto-update/logs/:jobId` — tails the log file for display. Pure file read; does not depend on the child process still being alive.
- `POST /api/system/auto-update/rollback` — spawns `scripts/auto-update.sh --rollback-to <tag>`. Separate action from "run now".

**Implementation note on `/etc/cron.d/`:** Writing to `/etc/cron.d/` requires root. Options:
1. **Setuid helper:** a small C or shell wrapper owned by root with setuid, invoked via `child_process.execFile()` from the Next.js route.
2. **Systemd user unit:** instead of cron, create a systemd timer unit in `~/.config/systemd/user/` that triggers the script. No root needed. Requires `systemctl --user enable`.
3. **Pre-installed file with `noexec` toggle:** ship `/etc/cron.d/sports-bar-autoupdate` as part of the ISO build with the cron line commented out; the API route uses `sudo sed` to comment/uncomment (narrow sudoers rule).

**Recommendation: option 2 (systemd user unit)**. Cleanest, no root involvement, uses the same mechanism ISO builds already rely on. Requires the ISO installer to enable `loginctl enable-linger ubuntu` so the user timer runs without an active session.

**Auth:** All routes require session auth (existing NextAuth session middleware).

**Rate limiting:** Use `RateLimitConfigs.DATABASE_WRITE` on POST/PUT. `DEFAULT` on GET.

**Verification:** Curl each endpoint with valid session cookies, confirm expected behavior.

**Risk:** LOW. Thin wrappers around the shell script.

**Rollback:** Delete the folder.

### Phase 3a — Redesign Sync tab UI (auto-update controls only)

**File:** Replace `apps/web/src/components/GitHubConfigSync.tsx` (or extract a new `apps/web/src/components/admin/AutoUpdatePanel.tsx` and compose with the existing push-config panel).

**New Sync tab layout:**

```
┌──────────────────────────────────────────────────────┐
│  Sync tab                                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Auto-Update                      [status pill]│  │
│  ├────────────────────────────────────────────────┤  │
│  │  [x] Enable daily auto-update                  │  │
│  │      Schedule: [ 3:30 AM ] [Central]           │  │
│  │                                                │  │
│  │  Last run: 2026-04-13 03:30 AM  [✓ Success ]   │  │
│  │    Pulled 4 commits: e7d8135d..2eef755f        │  │
│  │    Duration: 1m 47s                            │  │
│  │                                                │  │
│  │  [ Update Now ]   [ Rollback to Previous ]     │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Recent Update Runs                            │  │
│  ├────────────────────────────────────────────────┤  │
│  │  2026-04-13 03:30 ✓ Success (e7d8→2eef)  [▾]   │  │
│  │  2026-04-12 03:30 ✓ Success              [▾]   │  │
│  │  2026-04-11 03:30 ⚠ No updates available [▾]   │  │
│  │  2026-04-10 03:30 ✗ Rolled back          [▾]   │  │
│  │  2026-04-09 03:30 ✓ Success              [▾]   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Config Push (existing)                         │  │
│  ├────────────────────────────────────────────────┤  │
│  │  ... unchanged from today ...                   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Styling:** Dark slate theme per CLAUDE.md "UI Styling Guide". NO Card components, NO `bg-white`.

**Expandable log viewer:** Clicking `[▾]` on a recent run expands to show the last 100 lines of that run's log file, rendered in monospace with ANSI color support.

**Verification:** Manual click-through on Stoneyard. Toggle enable/disable, save, refresh, confirm state persists. Trigger manual run, watch log stream. Trigger rollback, confirm it runs.

**Risk:** LOW. Additive UI. Existing push-config path unchanged.

**Rollback:** Revert commit.

### Phase 3b — Fix light-mode color clash at /system-admin (separate commit)

**Files changed:** `apps/web/src/app/system-admin/page.tsx` (lines 645-678 only).

**Changes:** The three existing info-grid divs inside the Sync tab currently use `bg-blue-50`, `bg-green-50`, `bg-purple-50` with `text-blue-900 / text-green-900 / text-purple-800` — light Tailwind backgrounds that clash with the dark theme used everywhere else on the System Admin page. Convert to:
- `bg-slate-900/40 border border-slate-700 text-slate-300` for all three divs
- Colored accent via border-left (`border-l-4 border-l-blue-500` etc.) instead of full background color
- Headings in `text-white`

**Why a separate commit:** v1 of this plan bundled this fix into Phase 3. Per plan review, mixing an unrelated styling cleanup into a behavioral feature commit makes rollback harder. Phase 3b is its own clean commit — can be rolled back independently of the auto-update UI.

**Risk:** NONE. Pure cosmetics.

**Rollback:** Revert.

### Phase 4 — Per-location rollout

*(v1 had "Phase 4 install the cron entry" as a separate phase. Removed per plan review: Phase 2's API route is the single mechanism that installs and removes the cron/systemd timer. The v1 manual shell one-liner was redundant and risked creating duplicate entries.)*

**Order:**
1. **Stoneyard-greenville** first. Full evening of observation. Trigger one manual run, confirm success. Enable auto-update toggle, wait for 2:30am run.
2. **Graystone** second. Same procedure.
3. **Holmgren Way** third.
4. **Lucky's 1313** fourth.

**Per-location checklist:**
- Merge `main` (containing the auto-updater code) into the location branch.
- Deploy to the location's server (`git pull` + `npm run build` + `pm2 restart`).
- Run `scripts/verify-install.sh` manually — confirm all layers green.
- Run `scripts/auto-update.sh --dry-run` — confirm it detects no new updates after this deploy.
- Flip the auto-update toggle in the Sync tab UI.
- Wait for 3:30am run. Check log the next morning.

**Risk:** MEDIUM. Each new location is a real-world production test. The first run is the most dangerous — cron entry could be mis-typed, cron could not fire due to timezone, script could fail on a path that Stoneyard doesn't exercise.

**Rollback:** Disable the toggle in the UI. Manually remove the cron entry. Revert the branch merge if necessary.

## 7. Failure handling matrix

| Failure mode | Detection | Auto-updater response |
|---|---|---|
| `git fetch` fails (network down) | Exit code | Log, exit 0 (not a failure), next day retry |
| Unexpected merge conflict | `git status --porcelain` shows `UU` on non-location path | Abort merge, log, exit 1, alert via log + UI |
| Expected conflict on location file | `UU` on a path in `LOCATION_PATHS` | Auto-resolve with `--ours`, continue |
| `npm ci` fails | Non-zero exit | Restore git tag, exit 2, alert |
| `npm run build` fails | Non-zero exit | Restore git tag, rebuild old, PM2 restart, exit 2, alert |
| `drizzle-kit push` fails | Non-zero exit | Warn only, continue (app likely works) |
| **`drizzle-kit push` succeeds but runtime fails on new NOT NULL column** | Claude Code Checkpoint C detects runtime error in PM2 logs | STOP at Checkpoint C → rollback. **CAVEAT:** git reset rolls back code but NOT schema. Old code now runs against schema with an extra column — typically safe because SQLite doesn't enforce old code to INSERT into new columns, but if the new column is NOT NULL without a default, INSERTs from old code will fail. **Manual DB restore from `~/sports-bar-data/backups/pre-update-*.db` is required** in this specific case. Alert banner on Sync tab says "DB manual restore required". |
| PM2 restart fails | `pm2 restart` exit non-zero | Restore git tag, rebuild, exit 2, alert |
| App boots but crashes on load | Restart count stabilizing at >1 after 15s | Rollback, exit 2, alert |
| `/api/system/health` returns `critical` | curl parse | Rollback, exit 2, alert |
| `/remote` returns 500 | curl | Rollback, exit 2, alert |
| `/api/scheduling/games` returns `{success: false}` | curl parse | Rollback, exit 2, alert |
| Claude Code CLI times out | 60s timeout | Treat as degraded (exit 1), not critical. Alert but don't rollback. |
| Claude Code CLI returns FAIL | Parse output | Rollback, exit 2, alert |
| Ollama missing after update | `curl localhost:11434` fails | Warn only |
| Fire TV offline | verify-install Phase 5 layer | Warn only — hardware offline is normal |
| Disk full during build | `df` pre-check in Phase 1 | Abort before touching anything, exit 2, alert |
| Lock file already exists | `flock` fails | Exit 0, log "another run in progress" |
| Verification script itself crashes | Top-level try/catch | Rollback, exit 2, alert |

**Alert delivery:** MVP scope is "log + Sync tab UI shows the failure on next admin page load". A Slack/email/Pushover integration is explicitly out-of-scope for v1 of this feature — it can be added later once the basic flow is proven.

## 8. Rollback strategy (details)

### Within a single auto-update run

Every failure in Phases 3-7 triggers this sequence:

```bash
rollback_to_tag() {
  local tag=$1
  echo "[ROLLBACK] Resetting to $tag"
  git reset --hard "$tag"
  rm -rf apps/web/.next
  npm run build || {
    echo "[ROLLBACK] CRITICAL: rollback build also failed"
    return 99
  }
  pm2 restart sports-bar-tv-controller --update-env
  sleep 10
  scripts/verify-install.sh || {
    echo "[ROLLBACK] CRITICAL: rollback verification failed"
    return 99
  }
  echo "[ROLLBACK] Success"
}
```

The `rollback-YYYY-MM-DD-HH-MM` git tag is created at the start of Phase 2. Worst-case scenario (rollback's own build fails), the script prints a loud critical message and the Sync tab shows a red banner — human intervention required.

### DB rollback

Schema changes from Drizzle are additive in practice (new columns, new tables). True schema rollback is not automated. If an auto-update somehow causes DB corruption:
- The pre-update DB backup at `~/sports-bar-data/backups/pre-update-$(date).db` is restored via:
  ```bash
  pm2 stop sports-bar-tv-controller
  cp ~/sports-bar-data/backups/pre-update-YYYY.db /home/ubuntu/sports-bar-data/production.db
  pm2 start sports-bar-tv-controller
  ```
- This is a manual operation, not automated. The auto-updater never touches the DB file beyond backing it up.

### Cron rollback

If auto-update itself needs to be permanently disabled:

```bash
crontab -l | grep -v sports-bar-auto-update | crontab -
```

Or via the Sync tab: disable the toggle.

## 9. Testing requirements

### Unit / script tests
- `scripts/auto-update.sh --dry-run` — prints what it would do, touches nothing.
- `scripts/auto-update.sh --verify-only` — runs Phase 7 verification against the current running app.
- `scripts/verify-install.sh --layers 1,2,3` — runs specific layers only for iterating.
- Unit tests for the API routes in Phase 2 using Jest + next-test-api-route-handler.

### Integration test
- A smoke-test branch `test/auto-update-intentional-fail` that adds a deliberate build error. Use this to verify rollback works.
- A second smoke-test branch `test/auto-update-intentional-crash` that adds code that builds fine but crashes on startup. Use this to verify crash-loop detection.

### Manual acceptance test per location
- Trigger a manual "Update Now" from the Sync tab when a real `main` commit is pending.
- Watch the log stream in the UI.
- Verify the bartender remote loads after update.
- Verify the Games tab / AI Game Plan still work.
- Verify the Fire TV streaming apps panel still works.
- Leave auto-update enabled overnight. Check the log the next morning.

### Cross-location verification
- After all four locations have auto-update enabled, introduce a deliberate main-branch commit (e.g. update CLAUDE.md). Watch the 3:30am runs at all four locations. All should succeed; all should pull the same commit.

## 10. Failure Modes We Are NOT Solving In V1

- **Split-brain: location branch has commits that main doesn't.** If a location has made a hotfix directly on the location branch that hasn't been merged to main, the auto-update will preserve those commits (merge into current branch, not reset). This is the correct behavior but means `git log` on the location branch will show an increasingly-long divergence history.
- **Ollama model updates.** If main adds a new Ollama model requirement, the auto-updater won't download it. Flagged as warn-only.
- **npm package vulnerability auto-patching.** Not in scope.
- **PostgreSQL/SQLite major version upgrades.** Not in scope.
- **Per-location pause windows (e.g. "don't update during Super Bowl week").** A future "maintenance window" config could be added; for v1 the only pause mechanism is disabling the toggle.
- **Multi-server locations.** This plan assumes one server per location. If a location ever runs two servers (one primary, one hot standby), the auto-updater needs coordination logic that isn't here.

## 11. Open questions — status after v2 review

| # | Question | v1 status | v2 resolution |
|---|---|---|---|
| 1 | Cron time | Open (plan said 3:30am) | **RESOLVED: 2:30am Central** — 90 min of headroom for double rollback, safely before 4:00am preset cron |
| 2 | Alert channel | Open | Still open. MVP is "log + UI only". Pushover/Slack/email deferred to a v2 follow-up. |
| 3 | Auto-update default | Open | Still open. Plan assumes DISABLED by default; operators opt in per-location. |
| 4 | Rollback retention | Open | Still open. Plan says "last 30 days of logs, last 7 git tags". |
| 5 | Claude Code API key | Open (plan said "soft blocker") | **RESOLVED: Claude Code is a REQUIRED dependency per user direction.** Pre-work 3 must confirm it's working from cron environment. Update will not run if Claude Code is unavailable. |
| 6 | Version bump | 2.5.0 or 2.6.0 | **RESOLVED: 2.6.0.** Channel resolver consolidation takes 2.5.0 and ships first. |
| 7 | Relationship to channel resolver plan | Open | **RESOLVED: auto-update ships AFTER channel resolver consolidation.** Channel resolver is 2.5.0 and ships through manual updates. Auto-update is 2.6.0 and only takes over once operators have a week of successful 2.5.0 operation under their belts. |
| 8 *(new)* | Cron install mechanism | v1 had duplicate mechanisms | **RESOLVED: systemd user timer unit (recommended) OR `/etc/cron.d/sports-bar-autoupdate` via setuid helper.** NOT the user's crontab. |
| 9 *(new)* | Lock file vs flock | v1 had a simple file check | **RESOLVED: flock.** SIGKILL-safe, releases lock automatically on exit. |
| 10 *(new)* | `.next.bak` caching for rollback | v1 said `rm -rf .next` before build | **RESOLVED: cache old .next as .next.bak, rollback is an instant mv.** |
| 11 *(new)* | `package-lock.json` conflict resolution | v1 said `--ours` for all location files | **RESOLVED: `package-lock.json` and `package.json` specifically use `--theirs`.** Prevents dependency installation failures. |
| 12 *(new)* | `ANTHROPIC_API_KEY` environment | v1 said `.bashrc` or `/etc/environment` | **RESOLVED: `/etc/environment` or systemd `EnvironmentFile=`.** Cron does NOT source `.bashrc`. |

## 12. Recommended sequencing

Given everything in this plan plus the parallel channel resolver consolidation plan, here's the recommended rollout order:

1. **Pre-work 1** of auto-update (fix `update_from_github.sh` branch awareness). Standalone commit. Immediate win.
2. Finish channel resolver consolidation Phases 0-7 (separate plan). That work ships via manual updates using the fixed `update_from_github.sh`.
3. **Pre-work 2, 3, 4** of auto-update (verify-install.sh, Claude Code headless test, decide state location).
4. Phase 1: `auto-update.sh`.
5. Phase 2: API routes.
6. Phase 3: Sync tab UI.
7. Phase 4-5: Per-location rollout.

Estimated total: 7-9 commits, 4-6 sessions, 2-3 weeks wall-clock time if paced with bar-operations trial periods between phases.

---

**Next step after approval:** start with Pre-work 1 (the standalone `update_from_github.sh` fix). That commit lands immediately and makes every future manual update safer, including the updates that will carry the channel resolver consolidation work.
