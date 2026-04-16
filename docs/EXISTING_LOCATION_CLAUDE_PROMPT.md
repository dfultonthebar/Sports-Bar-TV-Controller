# Existing Location Catch-Up — Claude Code One-Shot Prompt

**Use this when:** an existing Sports Bar TV Controller location is
running an older version of the code, doesn't have `scripts/auto-update.sh`
wired up yet (no systemd timer, no Sync-tab "Run Update Now" working),
and you want a Claude Code session running directly on the host to
bring it up to current `main` from the command line.

**Do not use this for:** fresh installs (use
`docs/NEW_LOCATION_CLAUDE_PROMPT.md` instead), or locations that already
have a working auto-updater (click "Run Update Now" in the Sync tab
instead).

**This runbook is idempotent.** Safe to re-run if any step fails.

---

## ⭐ Recommended: Two-phase bootstrap prompt

Paste the ENTIRE block below into a fresh Claude Code session running
on the existing location's host machine. Launch Claude with
`--dangerously-skip-permissions` so it doesn't block on sqlite3 / pm2 /
npm permission prompts mid-run:

```
claude --dangerously-skip-permissions
```

Then paste:

```
You are bringing an existing Sports Bar TV Controller location up to
date from the command line. The location is behind main and does not
have a working auto-updater. You're running directly on the host via
SSH or local terminal. I want you to do the equivalent of what
auto-update.sh would do, manually, step by step, so nothing fails
silently.

Phase 1 — Fetch the authoritative runbook (does NOT touch any other
files):

  cd /home/ubuntu/Sports-Bar-TV-Controller
  git fetch origin main
  git show origin/main:docs/EXISTING_LOCATION_CLAUDE_PROMPT.md > /tmp/runbook.md
  git show origin/main:docs/LOCATION_UPDATE_NOTES.md > /tmp/notes.md

Phase 2 — Read both files in FULL before touching anything:

  Read /tmp/runbook.md — specifically the "Full runbook" section
  further down this same file (the one you are reading now after
  Phase 1 writes it to /tmp).

  Read /tmp/notes.md — every entry newer than the location's current
  version. Each entry has a Risk tag (GO / CAUTION / STOP) and may
  have per-location action items. Anything CAUTION requires you to
  pause and ask the operator before executing that step.

Phase 3 — Execute the "Full runbook" section of /tmp/runbook.md step
by step. When a step says "STOP and ask the operator", do that. When
a step says "record this output", keep it in your working notes so
you can cite it in the final report.

Phase 4 — Report:

  At the end, tell the operator:
    - The version you started at (BEFORE_VERSION)
    - The version you landed on (AFTER_VERSION)
    - The number of commits pulled
    - Whether drizzle-kit push was clean or emitted a benign warning
    - Whether you cleaned up any phantom FireTVDevice rows
    - Whether verify-install.sh returned PASS 6/6
    - Whether the systemd auto-update timer was installed
    - Any steps that failed or needed manual intervention
    - URLs for /system-admin and /remote on the LAN IP

Stop and ask the operator if any step produces unexpected state you
can't confidently resolve. This is a live sports bar's live config —
wrong moves cost real money.
```

That's the full paste block. Total execution time: ~5-10 minutes
depending on network + build time.

---

## Full runbook

This is what Claude reads from `/tmp/runbook.md` and executes. If
you're doing this manually without Claude, this is the authoritative
step list.

### Step 0 — Environment sanity check

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
pwd                            # expect /home/ubuntu/Sports-Bar-TV-Controller
whoami                         # expect ubuntu (or equivalent non-root user)
git branch --show-current      # expect location/<slug>
git status --short             # should be clean (untracked OK, modified NOT OK)
node --version                 # MUST be >= v18.17, ideally v20.x
npm --version
pm2 --version
df -h /home                    # confirm >=5 GB free (build cache + node_modules)
```

**If node < 18.17 (Ubuntu 22 ships Node 12):** install NodeSource 20
BEFORE proceeding. `npm ci` will fail on the modern package-lock.json
otherwise.

```bash
sudo apt-get remove -y nodejs npm libnode-dev libnode72 >/dev/null 2>&1 || true
sudo apt-get autoremove -y >/dev/null 2>&1 || true
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version                 # should now report v20.x
```

**If `git status` shows modified files:** stash them so the merge is
clean. We restore at the end if needed:

```bash
git stash push -u -m "pre-manual-update-$(date +%Y%m%d-%H%M%S)"
```

### Step 1 — Snapshot current state (for diagnostics + rollback)

Record ALL of this output in your working notes. If the update breaks
anything, this is the baseline you compare against:

```bash
# Version + git state
echo "=== BEFORE ===" | tee /tmp/before-snapshot.txt
curl -sS --max-time 5 http://localhost:3001/api/system/version 2>&1 | tee -a /tmp/before-snapshot.txt
git log -1 --oneline | tee -a /tmp/before-snapshot.txt
git rev-parse HEAD | tee -a /tmp/before-snapshot.txt

# DB counts — any of these at 0 when they shouldn't be is a red flag
sqlite3 /home/ubuntu/sports-bar-data/production.db "
  SELECT 'DirecTVDevice=' || COUNT(*) FROM DirecTVDevice;
  SELECT 'FireTVDevice=' || COUNT(*) FROM FireTVDevice;
  SELECT 'IRDevice=' || COUNT(*) FROM IRDevice;
  SELECT 'ChannelPreset=' || COUNT(*) FROM ChannelPreset;
  SELECT 'station_aliases=' || COUNT(*) FROM station_aliases;
  SELECT 'Location=' || COUNT(*) FROM Location;
  SELECT 'AuthPin=' || COUNT(*) FROM AuthPin;
" 2>&1 | tee -a /tmp/before-snapshot.txt

# Health overall
curl -sS --max-time 5 http://localhost:3001/api/system/health 2>&1 | head -c 500 | tee -a /tmp/before-snapshot.txt

# PM2 state
pm2 list 2>&1 | tee -a /tmp/before-snapshot.txt
```

**If `DirecTVDevice` rows have IPs that don't match this location's
network** (e.g. `10.11.3.*` at a Stoneyard install), STOP — you may
have the Holmgren-defaults leak from v2.5.3. Read the v2.5.3 entry in
LOCATION_UPDATE_NOTES.md and the v2.5.4 entry for the phantom-row fix
before proceeding.

### Step 2 — Read what you're about to pull

```bash
git fetch origin main
git log --oneline HEAD..origin/main | tee /tmp/incoming-commits.txt
git diff --stat HEAD..origin/main | tail -30
```

Then read LOCATION_UPDATE_NOTES.md — every entry newer than the
location's current HEAD commit. Scroll from the top and stop at the
first entry older than your BEFORE version. Each entry will tell you:

- **GO** — safe, execute normally
- **CAUTION** — warnings; may need per-location action after the merge.
  STOP AND ASK THE OPERATOR before proceeding if the CAUTION affects
  live hardware (matrix, TVs, Atlas audio) or DB schema.
- **STOP** — a bug / incident that must be understood before updating.
  Ask the operator — do not proceed.

```bash
git show origin/main:docs/LOCATION_UPDATE_NOTES.md | head -400
```

### Step 3 — Create a backup tag and DB snapshot

```bash
BACKUP_TAG="pre-manual-update-$(date +%Y%m%d-%H%M%S)"
git tag "$BACKUP_TAG"
echo "Rollback tag: $BACKUP_TAG" | tee -a /tmp/before-snapshot.txt

# DB backup for extra safety
mkdir -p /home/ubuntu/sports-bar-data/backups
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/$BACKUP_TAG.db
ls -la /home/ubuntu/sports-bar-data/backups/$BACKUP_TAG.db
```

### Step 4 — Merge main with LOCATION_PATHS_OURS guard

This is the critical step. We need to merge main's software changes
but keep this location's populated JSON data files. We do a normal
merge first — if it conflicts on a location-data path, we take ours;
if it conflicts on any other path, we take theirs; if it merges
cleanly, we do nothing extra.

```bash
# The location-data paths that must be preserved. This list MUST match
# the LOCATION_PATHS_OURS array in scripts/auto-update.sh exactly — if
# they diverge the two update flows will make different decisions and
# you'll see random data loss at unpredictable locations. Check with:
#   grep -A 15 LOCATION_PATHS_OURS scripts/auto-update.sh
LOCATION_PATHS_OURS=(
  "apps/web/data/tv-layout.json"
  "apps/web/data/directv-devices.json"
  "apps/web/data/firetv-devices.json"
  "apps/web/data/device-subscriptions.json"
  "apps/web/data/wolfpack-devices.json"
  "apps/web/data/atlas-configs"
  "apps/web/data/channel-presets-cable.json"
  "apps/web/data/channel-presets-directv.json"
  "apps/web/public/uploads/layouts"
  "data"
  ".env"
)

# These paths ALWAYS take main's version — package manifests have to
# match for `npm ci` to work, and version bumps on main belong in the
# location branch too.
LOCATION_PATHS_THEIRS=(
  "package-lock.json"
  "package.json"
)

# Attempt the merge. If it completes cleanly we're done; otherwise
# resolve conflicts using the two lists above.
set +e
git merge origin/main --no-ff --no-edit
MERGE_EXIT=$?
set -e

if [ "$MERGE_EXIT" -eq 0 ]; then
  echo "=== Clean merge, no conflicts ==="
else
  echo "=== Conflicts detected — applying LOCATION_PATHS_OURS/_THEIRS ==="

  for path in "${LOCATION_PATHS_OURS[@]}"; do
    if git status --porcelain "$path" 2>/dev/null | grep -q "^UU"; then
      echo "  keeping LOCATION version: $path"
      git checkout --ours "$path"
      git add "$path"
    fi
  done

  for path in "${LOCATION_PATHS_THEIRS[@]}"; do
    if git status --porcelain "$path" 2>/dev/null | grep -q "^UU"; then
      echo "  taking MAIN version: $path"
      git checkout --theirs "$path"
      git add "$path"
    fi
  done

  # Anything still unresolved — stop and ask the operator. This is
  # usually a real semantic conflict on code that needs a human judgment
  # call (e.g., a file touched on both branches for unrelated reasons).
  REMAINING=$(git diff --name-only --diff-filter=U)
  if [ -n "$REMAINING" ]; then
    echo "⚠ UNRESOLVED conflicts remain:"
    echo "$REMAINING"
    echo "STOP — this requires manual resolution by the operator."
    exit 1
  fi

  git commit --no-edit
fi

# Sanity — no unresolved conflicts remain
git status --short
git log -1 --oneline
```

**If any step above errored out** with something other than a normal
conflict, STOP. Run `git merge --abort` and ask the operator. Most
common reason: the working tree had modified files you forgot to
stash in Step 0.

### Step 5 — npm ci (with the NODE_ENV trap)

```bash
# CRITICAL: --include=dev because PM2 sets NODE_ENV=production in the
# process env, which npm ci inherits. Under NODE_ENV=production, npm ci
# skips devDependencies — dropping `turbo` (the build orchestrator),
# drizzle-kit, and other build machinery. The build then fails with
# `sh: 1: turbo: not found`.
NODE_ENV=development npm ci --include=dev 2>&1 | tail -30
```

If this errors with "unsupported engine" or similar, it almost
certainly means Node is still < 18.17 — go back to Step 0 and install
Node 20 from NodeSource.

### Step 6 — drizzle-kit push (with benign-error handling)

Apply any new tables/columns from the merged schema to production.db.
Some older locations have manually-created indexes that drizzle-kit
will complain about — that class of error is benign and means the
object is already present. Anything else means real trouble.

```bash
SCHEMA_LOG=/tmp/drizzle-push-$(date +%s).log
if NODE_ENV=development npx drizzle-kit push 2>&1 | tee "$SCHEMA_LOG"; then
  echo "[SCHEMA] clean push"
elif grep -qE "already exists" "$SCHEMA_LOG"; then
  echo "[SCHEMA] benign pre-existing objects — continuing"
  echo "[SCHEMA] see $SCHEMA_LOG for details"
else
  echo "[SCHEMA] ⚠ UNRECOGNIZED ERROR — do not continue"
  cat "$SCHEMA_LOG"
  echo "STOP — ask the operator before proceeding"
  exit 1
fi
```

**After the push, verify any NEW tables from LOCATION_UPDATE_NOTES
actually got created.** v2.8.0 added `ChannelTuneLog`; future releases
may add more. Check what's in the merge diff:

```bash
# What schema files changed in the merge?
git show HEAD --stat | grep -E 'schema\.ts|drizzle'

# What tables does production.db have?
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables"
```

**For v2.8.0's `ChannelTuneLog` specifically**, confirm it exists:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='ChannelTuneLog';"
```

If that returns nothing (empty output), create the table by hand —
drizzle-kit push choked before getting to the CREATE TABLE statement:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
CREATE TABLE IF NOT EXISTS ChannelTuneLog (
  id TEXT PRIMARY KEY NOT NULL,
  inputNum INTEGER,
  inputLabel TEXT,
  deviceType TEXT NOT NULL,
  deviceId TEXT,
  cableBoxId TEXT,
  channelNumber TEXT NOT NULL,
  channelName TEXT,
  presetId TEXT,
  triggeredBy TEXT NOT NULL DEFAULT 'bartender',
  success INTEGER NOT NULL,
  errorMessage TEXT,
  durationMs INTEGER,
  correlationId TEXT,
  tunedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ChannelTuneLog_tunedAt_idx ON ChannelTuneLog(tunedAt);
CREATE INDEX IF NOT EXISTS ChannelTuneLog_inputNum_idx ON ChannelTuneLog(inputNum);
CREATE INDEX IF NOT EXISTS ChannelTuneLog_deviceType_idx ON ChannelTuneLog(deviceType);
SQL
```

### Step 7 — Build

```bash
# Clear any cached build from the old version so Turbo starts fresh.
rm -rf apps/web/.next

NODE_ENV=development npm run build 2>&1 | tail -20
```

Expected: `Tasks: 34 successful, 34 total` (or a similar count — any
failures are a hard stop).

### Step 8 — Restart PM2 with a FRESH dotenv eval

```bash
# CRITICAL — do NOT use `pm2 restart --update-env`. That flag only
# re-reads the env object from PM2's memory — it does NOT re-execute
# `require('dotenv').config(...)` at the top of ecosystem.config.js.
# Result: LOCATION_ID from .env never reaches the Next.js child
# process and every login returns "Invalid PIN".
#
# delete + start forces PM2 to re-read ecosystem.config.js from disk,
# which re-runs dotenv, which loads .env into process.env fresh.
pm2 delete sports-bar-tv-controller bartender-proxy 2>/dev/null || true
pm2 start ecosystem.config.js
sleep 8
pm2 list
```

Expected: both `sports-bar-tv-controller` and `bartender-proxy` in
`online` status.

### Step 9 — Phantom FireTVDevice row cleanup (v2.5.4 defense)

v2.5.4 added defensive code to prevent phantom FireTVDevice rows, but
any rows created before the fix are still in the DB. Clean them now:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id,name,ipAddress FROM FireTVDevice WHERE ipAddress='' OR ipAddress IS NULL;"
```

If that returns any rows, delete them:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "DELETE FROM FireTVDevice WHERE ipAddress='' OR ipAddress IS NULL;"
```

### Step 10 — Verify

```bash
bash scripts/verify-install.sh
```

Expected: `[VERIFY] PASS (6/6 checks, Xs)`.

If any layer fails:

- **health degraded** — normal if hardware isn't fully configured; check
  `curl -sS http://localhost:3001/api/system/health | head -c 400`
- **critical tables empty** — one or more of ChannelPreset,
  station_aliases, Location, AuthPin is empty. Look at what's missing
  and whether the prior install ever seeded them.
- **bartender proxy down** — check `pm2 logs bartender-proxy --err --lines 50`
- **crash patterns in PM2 err log** — the most common cause is a
  missing table that wasn't caught in Step 6. Re-read Step 6's
  "verify any NEW tables" section and create any that are still
  missing.

### Step 11 — Sanity check login

```bash
curl -sS http://localhost:3001/api/auth/whoami
```

Expected: `{"authenticated":false,"reason":"no session cookie..."}`.

If it returns any other shape or a 500 error, the auth route is
broken — most likely cause is the `LOCATION_ID` env variable didn't
propagate because Step 8 used `--update-env` instead of delete + start.
Re-run Step 8.

If you have the admin PIN and want to verify the full login flow:

```bash
curl -sS -c /tmp/cj.txt -X POST \
  -H 'Content-Type: application/json' \
  -d '{"pin":"<ADMIN_PIN>"}' \
  http://localhost:3001/api/auth/login
# expect: {"success":true,"session":{"role":"ADMIN",...}}

curl -sS -b /tmp/cj.txt http://localhost:3001/api/auth/whoami
# expect: {"authenticated":true,"role":"ADMIN",...}
```

If the second call returns `{"authenticated":false}` even after a
successful login, check `grep AUTH_COOKIE_SECURE /home/ubuntu/Sports-Bar-TV-Controller/.env`
— it must be `false` on HTTP LAN deployments (browsers silently drop
`Secure` cookies over http://).

### Step 12 — Install the auto-update systemd timer (one-time)

This is the biggest change from a raw manual update — after this step,
future updates are automated nightly and the operator can trigger on
demand from the Sync tab.

```bash
# 1. Enable auto-update in the DB (default schedule: 2:30 AM local)
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE auto_update_state SET enabled=1 WHERE id=1;"

sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT enabled, schedule_cron FROM auto_update_state;"

# 2. Install the systemd user timer
bash scripts/install-auto-update-timer.sh
```

That script generates `~/.config/systemd/user/sports-bar-autoupdate.{service,timer}`,
enables the timer, and reports the next scheduled run time.

**One-time sudo step for headless hosts** (no persistent login
session, which is the normal case for a sports bar back-office):

```bash
sudo loginctl enable-linger ubuntu
```

Without `enable-linger`, the user systemd instance shuts down when
the last login session ends and the timer never fires.

Verify the timer is armed:

```bash
systemctl --user list-timers sports-bar-autoupdate.timer
```

### Step 13 — Push the location branch

```bash
git push origin location/<slug>
```

Use the actual branch name, not `<slug>`. You can get it from
`git branch --show-current`.

### Step 14 — Report

Tell the operator:

- **BEFORE_VERSION / AFTER_VERSION** (from /tmp/before-snapshot.txt vs
  `curl http://localhost:3001/api/system/version`)
- **Commit subject** of the merge commit: `git log -1 --oneline`
- **Commits pulled**: `git rev-list --count BEFORE_SHA..HEAD` using the
  SHA from /tmp/before-snapshot.txt
- **drizzle-kit push state**: clean / benign-warned / had to manually
  create a table
- **Phantom row cleanup**: if any FireTVDevice rows were deleted, how
  many and their ids
- **verify-install.sh**: PASS 6/6 or which layers failed
- **Auto-update timer**: installed and armed, with next run time, or
  skipped (and why)
- **URLs** for the LAN:
  - System Admin: `http://<host-ip>:3001/system-admin`
  - Bartender remote: `http://<host-ip>:3001/remote` (direct) or
    `http://<host-ip>:3002/remote` (via bartender proxy)
- **Any steps that required manual intervention** and why

---

## Rollback

If anything went wrong and you need to revert:

```bash
# 1. Restore the DB from the pre-update snapshot
pm2 stop sports-bar-tv-controller bartender-proxy
cp /home/ubuntu/sports-bar-data/backups/$BACKUP_TAG.db \
   /home/ubuntu/sports-bar-data/production.db

# 2. Reset git state to the backup tag
git reset --hard $BACKUP_TAG

# 3. Reinstall the old dependencies
NODE_ENV=development npm ci --include=dev

# 4. Restore the old build if you kept it
rm -rf apps/web/.next
if [ -d apps/web/.next.bak ]; then
  mv apps/web/.next.bak apps/web/.next
else
  NODE_ENV=development npm run build
fi

# 5. Bring services back up
pm2 delete sports-bar-tv-controller bartender-proxy 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 list
bash scripts/verify-install.sh
```

---

## Known failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `sh: 1: turbo: not found` during build | PM2 set `NODE_ENV=production`, npm ci skipped devDependencies | Re-run with `NODE_ENV=development npm ci --include=dev` then retry build |
| `Error: Database file not found` during build | Fresh install never created production.db | `npx drizzle-kit push --config drizzle.config.ts` then retry |
| Login returns "Invalid PIN" | `LOCATION_ID` from `.env` not reaching PM2 (used `--update-env` instead of delete+start) | `pm2 delete sports-bar-tv-controller bartender-proxy && pm2 start ecosystem.config.js` |
| Login succeeds but whoami reports unauthenticated | `AUTH_COOKIE_SECURE=true` over HTTP (browsers drop Secure cookies) | `grep AUTH_COOKIE_SECURE .env` must be `false`; fix, then Step 8 |
| Fresh install fails verify-install on `ChannelPreset=0` | v2.5.x treats empty presets as hard fail | v2.6.0+ treats as WARN; if pulling this runbook you should be on v2.8.1+, fine |
| Samsung TVs report offline but reachable on network | Old 8002-port probe lies about network-standby | v2.8.0+ uses REST PowerState probe — fixed automatically once you're on v2.8.0+ |
| `[VERIFY] FAIL` with crash patterns in PM2 err log | Missing table from the merged schema (drizzle-kit push choked) | Re-read Step 6's "verify any NEW tables" section |
| `directv_holmgren_*` rows showing up in FireTVDevice with empty IP | Phantom rows from pre-v2.5.4 upsert bug | Step 9 cleanup query |
| Wolfpack "beeping" at 15s intervals on bartender remote | Continuous audio tone from status poll hitting the matrix | Fixed in `f47f7826` (pre-v2.5.3) — you get it automatically |

---

## Reference

- `docs/LOCATION_UPDATE_NOTES.md` — per-release changelog with risk
  tags and per-location action items. Read this before every update.
- `docs/NEW_LOCATION_CLAUDE_PROMPT.md` — fresh install runbook.
- `docs/NEW_LOCATION_SETUP.md` — detailed install + troubleshooting.
- `docs/AUTO_UPDATE_SYSTEM_PLAN.md` — how `auto-update.sh` and its
  checkpoint system work once installed.
- `CLAUDE.md` — architecture reference and branch strategy.
