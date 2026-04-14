# New Location Install — Claude Code One-Shot Prompt

## ⭐ Recommended: Two-phase prompt (shortest, uses this doc as the runbook)

Fill in the three values and paste the ENTIRE block below into a fresh
Claude Code session running on the **new location's host machine**.

```
You are installing the Sports Bar TV Controller on a fresh Ubuntu host
for a new location. I'm going to give you the location-specific values
first, then tell you where to find the full runbook.

Location name:   <FILL IN — e.g. "Holmgren Way">
Admin PIN:       <4 digits, 1000-9999>
Staff PIN:       <4 digits, 1000-9999>
Timezone:        America/Chicago
(change timezone if this location is in a different tz — common options:
America/New_York, America/Denver, America/Los_Angeles)

Phase 1 — Pull the repo so you can read the runbook:

  sudo apt update && sudo apt install -y git
  cd /home/ubuntu
  git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
  cd Sports-Bar-TV-Controller
  git checkout main

Phase 2 — Read `docs/NEW_LOCATION_CLAUDE_PROMPT.md` in full, then follow
every step from Step 1 through Step 12 in order. When you reach Step 6
(bootstrap), pass the values I gave you above to
scripts/bootstrap-new-location.sh via its CLI flags. At Step 10 install
the auto-update systemd timer — we want nightly auto-updates enabled on
this location.

Report back when verify-install.sh shows PASS 6/6 and the login flow
curl test returns {"authenticated":true,"role":"ADMIN"}. Stop and ask
if any step fails so I can help debug before continuing.
```

That's it. Claude will clone the repo, read this file, and execute the
runbook. Total install time: ~10-15 minutes depending on network speed.

---

## Reference: The full runbook (what Claude reads after the clone)

This is what Claude executes starting at Step 1. You don't need to paste
this — it's already in the repo after Phase 1 of the prompt above pulls
it down.

If you're doing a manual install without Claude, this is also the
authoritative step list.

**Prerequisites on the target host:**
- Ubuntu 22.04+ with internet access
- `sudo` available for the initial apt install step
- The user running Claude Code has sudo access (or another operator can
  run the one sudo command Claude will ask for)

**What Claude will install:**
1. System packages: git, nodejs, npm, sqlite3, build-essential
2. PM2 (global npm)
3. Sports Bar TV Controller repo cloned from GitHub to
   `/home/ubuntu/Sports-Bar-TV-Controller`
4. Location-specific auth bootstrap (Location row + PINs + `.env`)
5. Dependency install + first build
6. PM2-managed app start
7. Location git branch
8. systemd user timer for nightly auto-update
9. End-to-end verification (verify-install.sh + login flow)

**Expected duration:** ~10-15 minutes depending on network.

---

## The prompt

```
You are installing the Sports Bar TV Controller on a fresh Ubuntu host for
a new location. Follow the steps below in order. Every script I reference
is idempotent — safe to re-run if you hit an error and retry.

## Step 0 — Confirm environment

Run these checks before proceeding:
  uname -a                       # Should be Linux, Ubuntu 22.04+
  whoami                         # Should be `ubuntu` or equivalent
  echo $HOME                     # Should be /home/ubuntu
  df -h /home                    # Confirm at least 10 GB free
  ping -c 2 github.com           # Confirm internet

If any of these fail, stop and tell the operator what's wrong.

## Step 1 — Install system packages (one sudo step)

Run:
  sudo apt update && sudo apt install -y git nodejs npm sqlite3 build-essential curl jq

After that:
  sudo npm install -g pm2
  node --version                 # Should be ≥ 18.17
  npm --version
  pm2 --version

If node is older than 18.17, install nodesource's NodeSource Node.js 20.x
following https://github.com/nodesource/distributions before continuing.

## Step 2 — Clone the repo

  cd /home/ubuntu
  git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
  cd Sports-Bar-TV-Controller
  git checkout main
  git log -1 --oneline            # Confirm you're on latest main

## Step 3 — Create the data directory

  mkdir -p /home/ubuntu/sports-bar-data/{backups,update-logs,logs}

## Step 4 — Install deps and do the first build

  npm ci
  npm run build

This takes 3-5 minutes on a fresh host because npm has no cache. If the
build fails with `sh: 1: turbo: not found`, the turbo dev dependency wasn't
installed — re-run `NODE_ENV=development npm ci --include=dev` and retry
the build.

## Step 5 — First app start via PM2

  pm2 start ecosystem.config.js
  sleep 8
  pm2 list

You should see TWO apps in `online` status:
  - `sports-bar-tv-controller` (the Next.js app on port 3001)
  - `bartender-proxy` (the restricted proxy on port 3002)

Both are defined in ecosystem.config.js so `pm2 start` brings them up
together. If either shows `errored`, run
`pm2 logs <name> --lines 50 --nostream` and diagnose.

Verify both respond:
  curl -sS http://localhost:3001/api/system/health | head -c 200
  curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3002/

The first should return JSON with `"status":"healthy"` or `"status":"degraded"`.
Degraded is fine at this stage (hardware not configured yet).
The second should return `302` (root redirects to /remote).

## Step 6 — Auth bootstrap (CRITICAL)

Ask the operator for these values before running the bootstrap script:
  - Location display name (e.g. "Holmgren Way")
  - Admin PIN (4 digits, 1000-9999)
  - Staff PIN (4 digits, 1000-9999)

Then run:
  bash scripts/bootstrap-new-location.sh \
    --name "<LOCATION NAME>" \
    --admin-pin <ADMIN PIN> \
    --staff-pin <STAFF PIN> \
    --timezone America/Chicago \
    --non-interactive \
    --create-branch

This script will:
  - Create the Location row in production.db
  - Seed STAFF and ADMIN AuthPin rows with bcrypt hashes
  - Write LOCATION_ID, LOCATION_NAME, and AUTH_COOKIE_SECURE=false into
    the repo-root .env file (AUTH_COOKIE_SECURE=false is required for
    plain-HTTP LAN deployments — do NOT override to true unless you put
    HTTPS in front of the app)
  - Create and check out the location/<slug> branch off main
  - Run verify-install.sh as a sanity check

If the timezone is not Central (America/Chicago), ask the operator for
the correct IANA timezone string and pass it via --timezone. Common
options: America/New_York, America/Denver, America/Los_Angeles.

## Step 7 — Restart PM2 with the new env

  pm2 delete sports-bar-tv-controller bartender-proxy
  pm2 start ecosystem.config.js

**Why delete + start instead of `pm2 restart --update-env`?** PM2's
`--update-env` flag re-reads the env object from memory but does NOT
re-execute the `require('dotenv').config(...)` at the top of
ecosystem.config.js. That means the new `LOCATION_ID` from `.env`
(written by the bootstrap script one step ago) never reaches the
Next.js child process, and every login returns "Invalid PIN".

`pm2 delete && pm2 start` force-evaluates the ecosystem file from
scratch, which re-runs dotenv, which loads `.env`, which propagates
`LOCATION_ID` into the env block.

Confirm both apps come back up:
  pm2 list
Expected: sports-bar-tv-controller online, bartender-proxy online.

## Step 8 — Verify the login flow end-to-end

Run these commands in order:

Test unauthenticated whoami:
  curl -sS http://localhost:3001/api/auth/whoami
Expected: {"authenticated":false,"reason":"no session cookie present..."}

Log in as admin:
  rm -f /tmp/cj.txt
  curl -sS -c /tmp/cj.txt -X POST -H "Content-Type: application/json" \
    -d '{"pin":"<ADMIN PIN>"}' http://localhost:3001/api/auth/login
Expected: {"success":true,"session":{"role":"ADMIN",...}}

Verify session is recognized:
  curl -sS -b /tmp/cj.txt http://localhost:3001/api/auth/whoami
Expected: {"authenticated":true,"role":"ADMIN",...}

Hit an admin-gated endpoint:
  curl -sS -b /tmp/cj.txt http://localhost:3001/api/system/auto-update/status \
    | head -c 200
Expected: {"enabled":false,"scheduleCron":"30 2 * * *",...}

If any of these fail, diagnose before proceeding. Most common failure:
the cookie isn't being sent back (you'll see {"authenticated":false}
after the login). That almost always means AUTH_COOKIE_SECURE=true is
set in .env or the env was not propagated via --update-env.

## Step 9 — Run verify-install.sh

  bash scripts/verify-install.sh

Expected output:
  [VERIFY] PASS (6/6 checks, 2s)

If any layer fails, fix it before continuing.

## Step 10 — (Optional) Enable auto-update + install the systemd timer

If the operator wants this location to auto-update from main overnight:

First flip the enabled flag in the DB (or via the Sync tab UI):
  sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "UPDATE auto_update_state SET enabled=1 WHERE id=1;"

Confirm the schedule (default 30 2 * * * = 2:30 AM local):
  sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "SELECT enabled, schedule_cron FROM auto_update_state;"

Install the systemd user timer:
  bash scripts/install-auto-update-timer.sh

This generates ~/.config/systemd/user/sports-bar-autoupdate.{service,timer}
and enables the timer. It will report the next scheduled run time.

For headless hosts (no active login session), also run ONCE (needs sudo):
  sudo loginctl enable-linger ubuntu

Without enable-linger, the user systemd instance shuts down when the
last login session ends and the timer never fires.

## Step 11 — Browser verification

From a laptop or tablet on the same LAN, point a browser at:
  http://<host-ip>:3001/system-admin

You should see the System Admin page with an amber "Not signed in"
banner at the top. Click "Log in", enter the admin PIN you seeded,
and the banner should turn green with "Signed in as ADMIN".

The bartender remote is at http://<host-ip>:3001/remote (port 3001 direct)
or http://<host-ip>:3002/remote if the bartender-proxy is running.

## Step 12 — Commit location-specific data (when ready)

After the operator has used the UI to configure hardware (TV layout,
matrix, Fire TV devices, DirecTV receivers, Atlas audio, channel presets,
etc.), the apps/web/data/*.json files will have real content. Commit
those to the location branch only — NEVER to main:

  git add apps/web/data/
  git commit -m "feat(<slug>): initial hardware configuration"
  git push -u origin location/<slug>

The location branch is gitignored from getting pulled back into main —
per the branch strategy documented in CLAUDE.md Multi-Location Deployment
section, location data stays on its own branch.

## Final report

When all steps are complete, tell the operator:
  - The location slug you created
  - The next scheduled auto-update time (from step 10, if enabled)
  - Any warnings or degraded states from verify-install.sh
  - The URLs for /system-admin and /remote on the LAN IP

Remind them to rotate the bootstrap PINs after first login if the values
they provided were temporary, and to run `sudo loginctl enable-linger ubuntu`
if they haven't already.

Reference documents in this repo for the operator:
  - docs/NEW_LOCATION_SETUP.md — detailed runbook
  - docs/AUTO_UPDATE_SYSTEM_PLAN.md — how auto-update works
  - docs/LOCATION_UPDATE_NOTES.md — per-commit changelog Claude reads
    at Checkpoint A on every auto-update run
  - CLAUDE.md — architecture reference and branch strategy
```

---

## Quick copy-paste command (if operator prefers a single shell command)

If you want to skip the Claude-assisted install and just run everything
yourself, this is the TL;DR sequence. You'll still need to type the
location name and PINs interactively when `bootstrap-new-location.sh`
prompts for them.

```bash
# Step 1-3: system packages + repo + data dir
sudo apt update && sudo apt install -y git nodejs npm sqlite3 build-essential curl jq
sudo npm install -g pm2
cd /home/ubuntu
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
git checkout main
mkdir -p /home/ubuntu/sports-bar-data/{backups,update-logs,logs}

# Step 4-5: build + start
npm ci
npm run build
pm2 start ecosystem.config.js
sleep 8
pm2 logs sports-bar-tv-controller --lines 20 --nostream

# Step 6-7: bootstrap (interactive prompts for name + PINs)
bash scripts/bootstrap-new-location.sh --create-branch
pm2 restart sports-bar-tv-controller --update-env

# Step 8-9: verify
bash scripts/verify-install.sh

# Step 10: optional auto-update
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE auto_update_state SET enabled=1 WHERE id=1;"
bash scripts/install-auto-update-timer.sh
sudo loginctl enable-linger ubuntu
```

Done. Point a laptop at `http://<host-ip>:3001/system-admin`, log in with
the admin PIN you set, and configure hardware via the UI.
