---
name: hermes-self-backup-to-github
description: Daily cron that backs up ~/.hermes skills, config, and memory to a private GitHub repo so a box loss never costs the agent's brain.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [backup, cron, github, disaster-recovery, ops, self-maintenance]
---

# Hermes Self-Backup to GitHub

Push the agent's own config, skills, and memory to a **private** GitHub repo on a
daily cron. (Source: David Andre "7 Levels of Hermes" — Level 4.) Highest-leverage
automation an ops agent can have: a box failure, a bad `rm`, or a corrupt update
never loses accumulated skill/memory state. Back up TEXT (skills + markdown +
memory), NOT blobs/caches — the full folder blows past GitHub's size limit.

## Shipped implementation (fleet-canonical, v2.58.2)

The working script is **`hermes/scripts/backup.sh`** (installed to `~/.hermes/scripts/backup.sh`). It:
- Pushes to the private repo **`dfultonthebar/hermes-backup`**, into a **per-box subdir** (LOCATION_NAME
  slug → hostname), so every fleet box backs up to one repo without clobbering.
- Auths via the box's existing **git `credential.helper=store`** (`~/.git-credentials`) — **no token in the
  script**. (The generic PAT method below is the fallback for a box without a credential store.)
- Backs up **brain only**: `skills/`, `memories/`, `cron/`, `hooks/`, root `*.md`. Excludes the Hermes
  program source (`hermes-agent/`), caches/blobs, and **all secrets** (`.env`, `config.yaml`, credentials).
- Wipes its dest subdir each run (rsync `--delete` protects excluded files, so a clean snapshot avoids bloat).

**Per-box install:**
```bash
cp hermes/scripts/backup.sh ~/.hermes/scripts/backup.sh && chmod +x ~/.hermes/scripts/backup.sh
loginctl show-user "$USER" | grep -q 'Linger=yes' || sudo loginctl enable-linger "$USER"
bash ~/.hermes/scripts/backup.sh        # verify the first push lands
hermes cron create --name daily-github-backup --no-agent --script backup.sh "0 3 * * *"
```

## Prerequisites (generic PAT fallback — only if no git credential store)
- A **private** GitHub repo (never public — it contains secrets-adjacent config).
- A fine-grained PAT scoped to ONLY that repo, permission **Contents: read+write**.
- systemd linger enabled, or a user-scoped cron silently never fires (Gotcha #11).

## Workflow

### 1. Store the token in .env (never in chat history, never sent to the model)
```bash
hermes config set GITHUB_TOKEN <fine-grained-pat>
grep -q '^GITHUB_TOKEN=' ~/.hermes/.env && echo "token present"   # verify w/o printing it
```

### 2. Confirm the gateway survives logout (cron depends on this)
```bash
hermes gateway status
loginctl show-user "$USER" | grep Linger      # want Linger=yes
# if no:  sudo loginctl enable-linger "$USER"
```

### 3. Set git identity + clone the backup repo once
```bash
git config --global user.name  "hermes-bot"
git config --global user.email "hermes-bot@localhost"
cd ~ && git clone "https://${GITHUB_TOKEN}@github.com/<owner>/<repo>.git" .hermes-backup
```

### 4. Backup script — TEXT ONLY (skills + memory + markdown; skip blobs/caches)
Write `~/.hermes/scripts/backup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
SRC="$HOME/.hermes"; DST="$HOME/.hermes-backup"
rsync -a --delete \
  --include='*/' \
  --include='skills/***' \
  --include='*.md' \
  --include='memory/***' \
  --exclude='*' \
  "$SRC/" "$DST/"
cd "$DST"
git add -A
git commit -m "chore: hermes backup $(date -Iseconds)" || { echo "no changes"; exit 0; }
git push origin HEAD
```
```bash
chmod +x ~/.hermes/scripts/backup.sh
~/.hermes/scripts/backup.sh         # run once to verify the push works
```

### 5. Create the daily cron (3 AM) — real Hermes syntax
```bash
hermes cron create --name daily-github-backup --no-agent \
  --script backup.sh "0 3 * * *"
hermes cron list                    # confirm ID + next run time
```
`--no-agent` makes the script itself the job (no LLM turn, no token cost).

## Verify / Restore
- **Verify weekly:** open the repo, confirm the latest commit timestamp is < 24h old.
- **Restore:** `git clone` the repo over a fresh `~/.hermes/{skills,memory,*.md}`,
  then `hermes gateway restart`.

## Notes
- Rotate the PAT if it ever appears in logs or chat output.
- If backup commits stop appearing, check linger FIRST
  (`loginctl show-user $USER | grep Linger`) — a `Linger=no` user-scoped job dies
  on logout (the same failure mode as the fleet auto-update timer, Gotcha #11).
