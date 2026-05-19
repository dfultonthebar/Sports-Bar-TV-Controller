# PM2 Restart Runbook

**Purpose:** Disambiguate `pm2 restart` vs `pm2 delete && pm2 start` vs `pm2 restart --update-env` so code/env/ecosystem changes actually take effect.
**Audience:** operators, admins, Claude Code agents.
**Read time:** ~5 minutes.

## When to use this runbook

- You changed code in `apps/web/src/` or `packages/*` and the new behavior is not showing up on `http://<host>:3001` after running `pm2 restart`.
- You edited `.env` (added/changed `LOCATION_ID`, `OLLAMA_HOST`, `SDR_ENABLED`, etc.) and the new variable is not visible from `process.env`.
- You edited `ecosystem.config.js` (changed port, working directory, args) and the change had no effect after `pm2 restart`.
- You ran `pm2 restart --update-env` and the new variable still didn't load.

## Pre-flight checks

- [ ] You are on the production host (Tailscale or LAN — NOT a dev box).
- [ ] You have a recent backup of the database: `ls -la /home/ubuntu/sports-bar-data/backups/ | tail -5` (auto-update.sh writes one per run).
- [ ] You know whether the change is code-only, env-only, or both.
- [ ] You ran `git branch --show-current` and confirmed it is a location branch (`location/holmgren-way`, `location/lucky-s-1313`, etc.) — NOT `main`. Production PM2 runs the location branch.

## Decision tree

```
                    What changed?
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   Code only          .env file      ecosystem.config.js
   (src/*, packages/*)                or both
        │                 │                 │
   pm2 restart      pm2 delete +     pm2 delete +
   (after build)    pm2 start        pm2 start
```

## Procedure

### Step 1 — Identify what changed

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git status
git diff --name-only HEAD~1 HEAD
```

Look for:
- Files under `apps/web/src/` or `packages/*` → **code change**.
- `.env` (gitignored, so check timestamp): `ls -la .env`.
- `ecosystem.config.js` → **ecosystem change**.
- `apps/web/data/*.json` → **data seed**, requires DB reseed not just restart.

### Step 2A — Code-only change (no env, no ecosystem)

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
rm -rf apps/web/.next
npm run build
pm2 restart sports-bar-tv-controller
pm2 logs sports-bar-tv-controller --lines 30
```

**Expected output:**
```
[PM2] Applying action restartProcessId on app [sports-bar-tv-controller](ids: [ 0 ])
[PM2] [sports-bar-tv-controller](0) ✓
┌────┬─────────────────────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id │ name                        │ namespace   │ version │ mode    │ pid      │
└────┴─────────────────────────────┴─────────────┴─────────┴─────────┴──────────┘
```

If the new code path emits a log line, you should see it in `pm2 logs` within ~5 seconds of the restart.

### Step 2B — `.env` changed OR new env variable added

`pm2 restart` does NOT re-execute `require('dotenv').config()` from `ecosystem.config.js`. **`--update-env` does NOT either** — it only refreshes shell-injected env vars, not the dotenv() call. Only a full `delete + start` re-reads `.env`.

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
rm -rf apps/web/.next
npm run build
pm2 delete sports-bar-tv-controller
pm2 start ecosystem.config.js
pm2 save
pm2 logs sports-bar-tv-controller --lines 30
```

**Expected output:**
```
[PM2] [sports-bar-tv-controller](0) ✓
[PM2] Process successfully started
[PM2] Saving current process list...
[PM2] Successfully saved in /home/ubuntu/.pm2/dump.pm2
```

**Verify the new env var is visible:**
```bash
pm2 env sports-bar-tv-controller | grep -E 'LOCATION_ID|YOUR_NEW_VAR'
```

If the value is wrong or empty, the file was not read. Check that `.env` is in the working directory referenced by `ecosystem.config.js` (default: `/home/ubuntu/Sports-Bar-TV-Controller`).

### Step 2C — `ecosystem.config.js` changed

Same as 2B — full delete + start. The ecosystem file is parsed by PM2 only at process creation.

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
pm2 delete sports-bar-tv-controller
pm2 start ecosystem.config.js
pm2 save
```

### Step 3 — Confirm production traffic reaches the new build

```bash
curl -s http://localhost:3001/api/health | head -20
curl -s http://localhost:3001/api/system/version | jq .
```

**Expected:**
```json
{"version": "2.46.3", "branch": "location/holmgren-way", "commit": "dd8d2bde"}
```

If the version field is older than what `cat package.json | jq .version` reports, the build did not actually run. See "If still broken" below.

## The `--update-env` trap

`pm2 restart sports-bar-tv-controller --update-env` is the seductive option — it sounds like exactly what you want. **It is not.** What it actually does:

- Re-reads env vars from the **shell that invoked pm2**, not from `.env`.
- Does NOT re-execute the `require('dotenv').config()` call at the top of `ecosystem.config.js`.
- So any var you added to `.env` but NOT to your current shell's environment is invisible to the restarted process.

Symptom: you added `SDR_ENABLED=auto` to `.env`, ran `pm2 restart --update-env`, restarted multiple times, and `pm2 env sports-bar-tv-controller | grep SDR` still shows nothing. **Fix:** `pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js`.

The ONE legit use case for `--update-env` is when you `export FOO=bar` in your shell and want PM2 to pick that up without losing the running process. That is rarely what you want in production.

## Force-rebuild when Turbo cache lies

If `npm run build` finishes in under 1 second and the output shows `FULL TURBO` with every package cached, your source code did NOT actually compile. This bites after:

- Switching git branches.
- Cherry-picking a commit that touches a package without changing its hash.
- Editing files via SSH/sftp where mtime is not what Turbo expects.

**Fix:**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
rm -rf apps/web/.next .turbo node_modules/.cache
npx turbo run build --force
pm2 restart sports-bar-tv-controller
```

The `--force` flag tells Turbo to ignore its hash cache and recompile everything. Build will take 60-120s on a fleet box.

## Verification

After ANY restart workflow:

1. **PM2 status:**
   ```bash
   pm2 status
   ```
   `sports-bar-tv-controller` should show `online` and the uptime should be a few seconds, not the original days/hours.

2. **HTTP health:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/health
   ```
   Expected: `200`.

3. **Bartender proxy health (port 3002):**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/health
   ```
   Expected: `200`. If `502`, the Nginx proxy lost its upstream — re-run `bash scripts/setup-bartender-nginx.sh`.

4. **Restart-loop check:**
   ```bash
   pm2 status | grep sports-bar
   ```
   The `↺` column should be `0` (or stable). If it climbs every second, the app is crashing on startup — `pm2 logs` will show the error.

5. **Env var visible (if 2B):**
   ```bash
   pm2 env sports-bar-tv-controller | grep -E 'YOUR_VAR_NAME'
   ```

## If still broken

- **Restart loop, exit code 1:** Open `pm2 logs sports-bar-tv-controller --err --lines 50`. Look for missing module errors (`Cannot find module`) — usually a workspace package was not rebuilt. Re-run `npx turbo run build --force`.
- **HTTP 502 or connection refused on port 3001:** PM2 says online but the app didn't bind the port. Check for a port conflict: `sudo ss -tlnp | grep 3001`. Another process (a leftover `next start`, a previous PM2 process) may be holding it. Kill it: `sudo fuser -k 3001/tcp` and re-start PM2.
- **HTTP 200 but old code still runs:** The build cache lied. Force rebuild per "Force-rebuild when Turbo cache lies" above.
- **`.env` change still invisible after delete+start:** Confirm `cat .env | grep YOUR_VAR` shows it. If the var is multi-line or has spaces, wrap in quotes. PM2 reads `.env` via dotenv, which is strict about quoting.
- **Database schema errors after restart:** A merge added new columns/tables. Run `npx drizzle-kit push --config apps/web/drizzle.config.ts`. **Then verify the columns exist** — Drizzle silently skips when an index pre-exists (CLAUDE.md Gotcha #6).

## Escalation path

1. Capture: `pm2 logs sports-bar-tv-controller --lines 200 > /tmp/pm2-debug.log`.
2. Capture: `pm2 env sports-bar-tv-controller > /tmp/pm2-env.log`.
3. Capture: `git log --oneline -10 > /tmp/git-recent.log`.
4. Last-resort recovery: `bash scripts/auto-update.sh --triggered-by=manual_cli` — runs the full update orchestrator including backup, Turbo bust, PM2 delete+start, and verify checkpoints. Safe to run even when nothing changed; it is idempotent.

## Cross-references

- **CLAUDE.md Gotcha #2** — PM2 restart vs delete+start semantics.
- **CLAUDE.md Standing Rule #4** — Force-rebuild when Turbo cache lies.
- **CLAUDE.md Standing Rule #6** — Always use `scripts/auto-update.sh` for location updates.
- **Memory file:** `~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/feedback_pm2_restart.md` — original observation of the bug.
- **Memory file:** `feedback_turbo_cache.md` — Turbo cache bust pattern.
- **Related runbooks:** `MATRIX_INPUT_SWITCH.md` (which restart pattern to use after switching routing code).
- **Source:** `ecosystem.config.js` (root) — the dotenv() call that only fires on `pm2 start`.
- **Source:** `scripts/auto-update.sh` — canonical full-restart orchestration.
