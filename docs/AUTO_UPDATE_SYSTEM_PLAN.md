# Automated Daily Update System Plan

**Status:** Plan only, awaiting approval. No code changes yet.
**Target version:** 2.5.0 or 2.6.0 (separate from the channel resolver consolidation; can ship independently).
**Scope:** Build a safe, automated 4am daily update mechanism that each location's server runs against its own location branch, with Claude Code CLI as the post-update verification gate, complete rollback-on-failure handling, and a redesigned Sync tab UI for monitoring and manual control.

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

**Core flow at 4am Central:**

```
┌─────────────────────────────────────────────────────────┐
│  cron: 0 4 * * * /home/ubuntu/auto-update.sh            │
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

8. **The 4am slot is already used by `presetCronService`** (channel preset sync from Rail Media). Auto-update must run at a non-conflicting time. **Recommend 4:15am** to let the preset sync finish first, OR **3:45am** to run first. Either works; this plan defaults to **3:30am** to leave headroom for a long rollback.

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

### Pre-work 3: Confirm Claude Code CLI works headlessly

The auto-update research agent found that Claude Code CLI is installed per-user on ISO builds but nobody has tested it headlessly. Pre-work 3 proves it works:

- Confirm install path: `which claude` (expected: `/home/ubuntu/.claude/local/claude` or similar).
- Confirm auth: `claude --version` should not prompt for login.
- Test headless: `echo "Reply with just the word PASS" | claude -p --no-interactive` should print `PASS`.
- Test API key: confirm `ANTHROPIC_API_KEY` is set in `/etc/environment` or ubuntu user's `.bashrc` (the ISO installer sets this up; verify).

**Pre-work 3 output:** A single-line report confirming Claude Code works headlessly on each location server. If it doesn't, the auto-updater falls back to a simpler verification without Claude Code as layer 5.

### Pre-work 4: Decide where auto-update state lives

Options:
- **`config/auto-sync.json`** — extend the existing file with `autoUpdate: {enabled, schedule, lastRun, lastResult, lastCommitSha}`. Pro: reuses existing file. Con: mixes two concepts (config push vs code pull).
- **`systemSettings` table row with key `auto_update_state`** — JSON value with the same fields. Pro: queryable from any API, single source of truth. Con: requires DB read for every status query.
- **`~/sports-bar-data/auto-update-state.json`** — dedicated file outside the repo. Pro: persists across git operations. Con: not visible to the web UI unless a new API route reads it.

**Recommendation:** `systemSettings` row. Matches the existing `default_sources` and `sports_guide_update_schedule` patterns added in v2.3.0 / v2.4.3. The Sync tab can then GET `/api/settings/auto-update` to render state.

## 5. Claude Code CLI verification layer

**Prompt template** (for `scripts/verify-install.sh` layer 5):

```
You are verifying that a Next.js application just completed an auto-update successfully.

Context:
- The server at /home/ubuntu/Sports-Bar-TV-Controller just merged main into branch $(git branch --show-current) and restarted via PM2.
- This is a production sports bar control system. A failure is serious.

Check the following by reading these files and running these commands:

1. Read the last 50 lines of PM2 logs:
   `pm2 logs sports-bar-tv-controller --lines 50 --nostream`
   Look for: unhandled exceptions, "Error:", stack traces, startup failures, database errors.

2. Read the last 20 scheduler logs from the DB:
   `sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT datetime(createdAt,'unixepoch','localtime'), level, message FROM SchedulerLog ORDER BY createdAt DESC LIMIT 20;"`
   Look for: level='error' entries in the last 5 minutes.

3. Check git state:
   `git status --short` should show only ignored/expected files.
   `git log --oneline -5` should show the merge commit.

4. Curl the health endpoint:
   `curl -sf http://localhost:3001/api/system/health | jq .overall.status`
   Should return "healthy" or "degraded", not "critical".

Output ONLY the following format on the first line:
VERIFICATION: PASS
VERIFICATION: FAIL - <short reason>

Do not include any other text before that line. No explanation. No preamble. Just the single VERIFICATION line.
```

**Invocation:**

```bash
claude -p --no-interactive "$PROMPT" 2>&1 | head -20 > /tmp/claude-verify.txt
if grep -q "^VERIFICATION: PASS" /tmp/claude-verify.txt; then
  echo "[VERIFY] Claude: PASS"
  exit 0
elif grep -q "^VERIFICATION: FAIL" /tmp/claude-verify.txt; then
  reason=$(grep "^VERIFICATION: FAIL" /tmp/claude-verify.txt | sed 's/VERIFICATION: FAIL - //')
  echo "[VERIFY] Claude: FAIL - $reason"
  exit 2
else
  echo "[VERIFY] Claude: UNDETERMINED (no VERIFICATION line in output)"
  exit 1  # degraded, not critical
fi
```

**Risk of this layer:** Claude Code might hit rate limits, timeouts, or return unparseable output. These must NOT cause rollback — treat as degraded, not critical. The preceding four layers are the authoritative gate; Claude Code is a "smart check" bonus.

## 6. Phase-by-phase execution

Every phase is a separate commit. Phases 1-3 can run in parallel after pre-work.

### Phase 1 — Build `auto-update.sh` shell script

**File:** new `scripts/auto-update.sh`. Encapsulates everything in the Phase 1-7 flow diagram from §2. Calls `scripts/verify-install.sh` from pre-work 2.

**Key features:**
- Runs with `set -euo pipefail` for strict error handling.
- Writes a single append-only log file: `~/sports-bar-data/update-logs/auto-update-$(date +%Y-%m-%d-%H-%M).log`.
- Captures stdout/stderr of every sub-command.
- On any failure, triggers rollback.
- After completion (success or fail), writes a summary JSON to `~/sports-bar-data/update-logs/latest.json` and updates the `auto_update_state` systemSettings row.
- Idempotent: if `git fetch` shows no new commits from main, exit early with "no update available".
- Lock file at `/tmp/sports-bar-auto-update.lock` prevents concurrent runs.

**Verification:** Run manually on Stoneyard with `--dry-run` flag. Confirm it fetches, would merge, prints what it would do, and exits without touching anything. Then run for real.

**Risk:** MEDIUM. Script can fail in creative ways. Rollback must be tested by deliberately introducing a build error.

**Rollback:** Revert commit. The script doesn't exist; manual updates still work.

### Phase 2 — Build `/api/system/auto-update/*` routes

**Files:** new folder `apps/web/src/app/api/system/auto-update/`.

**Routes:**

- `GET /api/system/auto-update/status` — reads `auto_update_state` from systemSettings and returns `{enabled, schedule, lastRun, lastResult, lastCommitSha, recentRuns}`. `recentRuns` tailgates the last 10 files from `~/sports-bar-data/update-logs/`.
- `PUT /api/system/auto-update/settings` — body `{enabled, schedule}` — validates and writes to `auto_update_state`. If `enabled=true`, also writes/updates the cron entry via `crontab -l | grep -v sports-bar-auto-update; echo "$CRON_LINE"`.
- `POST /api/system/auto-update/run-now` — spawns `scripts/auto-update.sh` via `child_process.spawn` detached, returns a job ID. The job's output streams to the same log file as scheduled runs.
- `GET /api/system/auto-update/logs/:runId` — tails a specific log file for display in the UI.
- `POST /api/system/auto-update/rollback` — spawns `scripts/auto-update.sh --rollback-to <tag>`. Separate action from "run now".

**Auth:** All routes require session auth (existing NextAuth session middleware).

**Rate limiting:** Use `RateLimitConfigs.DATABASE_WRITE` on POST/PUT. `DEFAULT` on GET.

**Verification:** Curl each endpoint with valid session cookies, confirm expected behavior.

**Risk:** LOW. Thin wrappers around the shell script.

**Rollback:** Delete the folder.

### Phase 3 — Redesign Sync tab UI

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

**Styling:** Dark slate theme per CLAUDE.md "UI Styling Guide". NO Card components, NO `bg-white`. Fix the existing light-mode color clash at `/system-admin/page.tsx` lines 645-678 (the three info-grid `bg-blue-50 / bg-green-50 / bg-purple-50` cards) while we're in there.

**Expandable log viewer:** Clicking `[▾]` on a recent run expands to show the last 100 lines of that run's log file, rendered in monospace with ANSI color support.

**Verification:** Manual click-through on Stoneyard. Toggle enable/disable, save, refresh, confirm state persists. Trigger manual run, watch log stream. Trigger rollback, confirm it runs.

**Risk:** LOW. Additive UI. Existing push-config path unchanged.

**Rollback:** Revert commit.

### Phase 4 — Install the cron entry

Not a code change — a runtime action on each location's server. Done per-location after Phase 3 ships:

```bash
# One-time per server
(crontab -l 2>/dev/null; echo "TZ=America/Chicago 30 3 * * * /home/ubuntu/Sports-Bar-TV-Controller/scripts/auto-update.sh >> ~/sports-bar-data/update-logs/cron.log 2>&1") | crontab -
```

**Alternative:** The Phase 2 `PUT /api/system/auto-update/settings` route writes the crontab when the admin toggles auto-update on. In that case Phase 4 becomes "flip the toggle in the UI". Recommended because it keeps cron state in sync with the DB row.

**Risk:** LOW. Cron entries are easy to delete.

**Rollback:** `crontab -e` and remove the line.

### Phase 5 — Per-location rollout

**Order:**
1. **Stoneyard-greenville** first. Full evening of observation. Trigger one manual run, confirm success. Enable auto-update toggle, wait for 3:30am run.
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

## 11. Open questions for user approval

1. **Cron time:** plan says 3:30am Central. Confirm or redirect (3:45? 2am? 5am?).
2. **Alert channel:** MVP is "log + UI only". Do you want Pushover/Slack/email integration added in v1, or is the Sync tab UI sufficient for morning review?
3. **Auto-update toggle default:** when the feature ships, should it default to enabled or disabled? Plan assumes DISABLED by default and operators opt in per-location.
4. **Rollback retention:** how many update logs + git tags to keep before pruning? Plan says "last 30 days of logs, last 7 git tags".
5. **Claude Code API key:** confirmed available on all servers? If not, layer 5 of verification gets skipped.
6. **Version bump:** 2.5.0 or 2.6.0?
7. **Relationship to channel resolver consolidation plan:** should auto-update ship before, after, or in parallel with the channel resolver plan? Strong recommendation: **after**. The channel resolver work will generate several commits that we want each location to pull through the (proven, manual) update path first, not through an untested auto-updater.

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
