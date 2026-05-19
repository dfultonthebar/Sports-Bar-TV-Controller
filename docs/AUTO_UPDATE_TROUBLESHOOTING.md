# Auto-Update Troubleshooting — Every Failure Mode We've Seen

**Audience:** operator at any of the 6 fleet locations, plus anyone setting up a new install.

**Purpose:** every time we hit an auto-update failure or install-time gotcha, the recipe to detect + diagnose + fix lands here. This is the single doc to consult when a location says "stuck on an old version" or "the update rolled back."

**Companion docs:**
- `docs/NEW_LOCATION_SETUP.md` — install runbook (sections 0-10). §7b lists the pre-flight checks that prevent most of these failures up-front.
- `docs/AUTO_UPDATE_SYSTEM_PLAN.md` — architectural overview of the auto-update system itself.
- `docs/VERSION_SETUP_GUIDE.md` — per-version manual steps the operator may need to run after merge.
- `CLAUDE.md` Gotcha #11 — concise pointer to the failure modes below.

---

## Quick triage — "the location is stuck on an old version"

Run this audit recipe FIRST (it covers 90% of cases in 30 seconds):

```bash
ssh ubuntu@<host> "
  echo '== timer state (must show enabled + active + NEXT in the future) =='
  systemctl --user list-timers sports-bar-autoupdate.timer 2>/dev/null | head -5
  echo '== linger (must be yes — required for timer to fire without active session) =='
  loginctl show-user ubuntu | grep -i Linger
  echo '== last 3 auto-update logs =='
  ls -lat /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -3
  echo '== look for ROLLBACK/CONFLICT/FAIL in latest log =='
  L=\$(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)
  grep -E 'STEP:|ROLLBACK|CONFLICT|FAIL|❌' \$L | head -20
  echo '== current vs latest version =='
  jq -r .version ~/Sports-Bar-TV-Controller/package.json
  cd ~/Sports-Bar-TV-Controller && git fetch -q origin main && echo 'main is at:' && git log origin/main --oneline -1
"
```

Map the symptoms to a failure mode below.

---

## Failure mode 1: `Linger=no` — silent stall, weeks at a time

**Symptom:** timer is `enabled` + `active`, but `LAST` was days/weeks ago, and `NEXT` is today/tomorrow at the right time. `loginctl show-user ubuntu` shows `Linger=no`. Location's auto-update log directory has nothing recent.

**Real-world hit:** **greenville-stoneyard, 2026-05-19** — Linger had silently flipped to `no` at some point. Last cron-driven update was 38 hours earlier (the operator's last SSH login). Without linger, the user-scoped systemd timer dies when the operator's SSH session ends and won't fire again until somebody logs in.

**Why it happens:** `scripts/install-auto-update-timer.sh` correctly calls `systemctl --user enable` but does NOT enable linger (which requires `sudo` and the installer is meant to run as user `ubuntu`). The runbook says to also run `sudo loginctl enable-linger ubuntu` but it's an easy step to skip or to silently un-do later (e.g. `sudo loginctl disable-linger` accidentally during a session-cleanup spree).

**Fix (one line, root, idempotent):**
```bash
sudo loginctl enable-linger ubuntu
loginctl show-user ubuntu | grep Linger   # confirm Linger=yes
```

After enabling, the timer fires at the next scheduled time without requiring any active session.

**Prevention:** `scripts/install-auto-update-timer.sh` should be enhanced to also enable linger when sudo is available. Until then, NEW_LOCATION_SETUP.md §7b includes the explicit check.

---

## Failure mode 2: modify/delete merge conflict — rollback at STEP: merge

**Symptom:** log shows `STEP: merge` immediately followed by `Merge had conflicts — applying auto-resolve rules`, then `error: path 'X' does not have their version`, then `Trap fired: exit code=1, step=merge`, then `Rollback SUCCESS`. The location stays at its pre-merge version.

**Real-world hit:** **graystone, 2026-05-19** — main deleted `apps/web/src/app/api/matrix/outputs-schedule/route.ts` in commit `0c9360bf v2.48.2: 13 more verified-dead routes deleted`. Graystone had touched the file at some point (the original V2 modular-architecture commit `068cdfd1`), so git sees `modify/delete`. The `LOCATION_PATHS_OURS` auto-resolver only handles pure conflicts via `git checkout --theirs|--ours` — when the file is deleted on main there IS no `--theirs` version to check out, so it errors.

**Why it specifically affects v2.48.x sweeps:** when `main` deletes verified-dead routes, ANY location branch that ever touched that file (even just whitespace tweaks before the V2 migration) is in modify/delete territory. Standing Rule 5 (no software edits on location branches) means modifications shouldn't exist, but historical breaches accumulate.

**Diagnostic — find the offending file:**
```bash
ssh ubuntu@<host> "grep -E 'modify/delete|does not have their version' \$(ls -t ~/sports-bar-data/update-logs/auto-update-*.log | head -1)"
```

**Verify the file is truly dead on main:**
```bash
# back at Holmgren — grep for callers
grep -rEn "import.*FILE_BASENAME|FILE_PATH" apps/web/src/ --include='*.ts' --include='*.tsx'
# also confirm main intentionally deleted it
git log origin/main --diff-filter=D -- "<file-path>" | head -5
```

**Fix (manual, ~30 sec):**
```bash
ssh ubuntu@<host>
cd ~/Sports-Bar-TV-Controller
git rm <path-of-conflicted-file>
git commit -m "chore: accept main deletion of verified-dead X route (vY.Z sweep)"
git push origin location/<name>
# then re-trigger
bash scripts/auto-update.sh --triggered-by=manual_cli
```

Don't try to fix it inside an in-progress merge — let the trap roll back first, then resolve cleanly on the location branch. The rollback tag (`rollback-YYYY-MM-DD-HH-MM`) is your safety net if you change your mind.

**Long-term fix (planned):** teach the auto-resolver in `scripts/auto-update.sh` to handle modify/delete by `git rm`'ing the path when main deleted it AND `grep -r` confirms no callers in `apps/web/src/`. Until then, every v2.48-style deletion sweep has a chance of stalling a location.

---

## Failure mode 3: drizzle-kit data-loss prompt — rollback at STEP: schema_push

**Symptom:** log shows `STEP: schema_push` followed by `npx drizzle-kit push (apply pending schema changes)`, then drizzle prints `Warning  Found data-loss statements:` listing tables, then `Error: Interactive prompts require a TTY terminal`, then `Trap fired: exit code=1, step=schema_push`, then `Rollback SUCCESS`.

**Real-world hit:** **greenville, leglamp, luckys1313, graystone, stoneyard-appleton — ALL 5 fleet locations on 2026-05-19 v2.50.11 push.** drizzle-kit wanted to drop 4 watcher-managed audit tables that existed in their DBs but were never declared in `packages/database/src/schema.ts`:
- `atlas_drop_events` (created by `apps/web/src/lib/atlas-drop-watcher.ts`)
- `atlas_priority_events` (created by `apps/web/src/lib/atlas-priority-watcher.ts`)
- `shure_rf_events` (created by `apps/web/src/lib/shure-rf-watcher.ts`)
- `scheduling_preferences` (created by an older migration, removed from schema.ts in v2.48.5)

Watcher tables are created via raw `CREATE TABLE IF NOT EXISTS` in the watcher's startup path, and runtime code accesses them via raw `sql\`INSERT INTO ...\`` template literals. They predate the Drizzle schema migration. Because they were never declared in `schema.ts`, drizzle-kit's diff against the live DB sees "table in DB, not in schema → propose drop." When the tables have rows, drizzle's data-loss guard prompts for confirmation — and bails with the TTY error in non-interactive auto-update mode.

**The `yes | script -qfc` trick in auto-update.sh DOES NOT WORK** for this prompt: drizzle-kit checks `process.stdin.isTTY` and `process.stdout.isTTY` BEFORE reading any character, sees `stdin=pipe (false)`, and errors out. Providing a pty via `script` only fixes stdout — stdin is still a pipe from `yes`.

**Root fix (shipped in v2.50.12):** declare all watcher tables in `packages/database/src/schema.ts`. Once declared, drizzle's diff says "schema matches DB, no changes needed" and the prompt never fires. Look at the `WATCHER AUDIT TABLES` section near the end of `packages/database/src/schema.ts` for the pattern.

**Defensive fallback (v2.50.12 in `scripts/auto-update.sh` schema_push step):** if drizzle-kit hits the TTY prompt AND all flagged tables are on the known-safe watcher allowlist, the script logs a warning, runs `ensure-schema.sh` to apply any non-blocked changes, and continues without rolling back. This catches NEW watcher tables added without a matching schema.ts entry — but logs a `TO ROOT-FIX` hint pointing the developer at the right place to declare them.

**If you hit this on a NEW watcher table not yet on the allowlist:**
1. Find the live DB schema:
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db ".schema <table_name>"
   ```
2. Declare it in `packages/database/src/schema.ts` in the `WATCHER AUDIT TABLES` section, matching column types exactly.
3. ALSO add it to the `SAFE_TABLES_REGEX` allowlist in `scripts/auto-update.sh` (schema_push step) so older fleet boxes that haven't pulled your schema.ts change yet still pass through.
4. Bump version, commit, push, re-fire fleet.

---

## Failure mode 4: NVM-installed node not in `/usr/local/bin` — systemd-fired scripts fail

**Symptom:** any non-login shell script (cron, systemd timer, `ssh user@host 'cmd'`, `rag-rescan-if-needed.sh`) reports `node: command not found` or `npx: command not found`. PM2 `status` shows the app running fine, contradicting the missing-node report. `which node` over `ssh` returns "not found"; `which pm2` works.

**Real-world hit:** **leglamp-tvcontroller, 2026-05-19** — RAG rescan exited with `scripts/rag-rescan-if-needed.sh: line 88: npx: command not found`. PM2 + the running app were unaffected because PM2 inherits the PATH from the login session that originally started it; new non-login subprocesses get the system PATH (`/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`) which has no node.

**Why:** NVM installs node under `~/.nvm/versions/node/v<X.Y.Z>/bin/`. Login shells source `~/.nvm/nvm.sh` from `~/.bashrc`, which prepends NVM's bin dir to PATH. Non-login shells (`bash -c`, systemd `ExecStart=`, cron, `ssh user@host 'cmd'`) don't read `~/.bashrc`, so they don't get NVM in PATH.

**Detection:**
```bash
ssh ubuntu@<host> "which node npm npx"   # all three should resolve
ssh ubuntu@<host> "ls /usr/local/bin/{node,npm,npx} 2>&1"  # all three should exist
ls -la ~/.nvm/versions/node/*/bin/node    # find the NVM-installed version
```

**Fix (idempotent, requires sudo):**
```bash
# Replace v20.20.0 with whatever your nvm has installed
sudo ln -sfv /home/ubuntu/.nvm/versions/node/v20.20.0/bin/node /usr/local/bin/node
sudo ln -sfv /home/ubuntu/.nvm/versions/node/v20.20.0/bin/npm  /usr/local/bin/npm
sudo ln -sfv /home/ubuntu/.nvm/versions/node/v20.20.0/bin/npx  /usr/local/bin/npx
```

**Why this over sourcing nvm in `/etc/profile` or systemd unit env:** PATH baked into a wrapper script is fragile; symlinks are a single explicit declaration that survives `apt upgrade` and shell switches. Tradeoff: when nvm's node version changes (rare on this fleet), the symlinks must be repointed.

**Why my SSH-trigger pattern initially failed at leglamp:** my first trigger used `source ~/.nvm/nvm.sh && cd ...` — the `source` failed (`No such file or directory` for nvm.sh) and `&&` short-circuited the whole chain. The fix is to not depend on nvm at all from non-login shells; rely on the `/usr/local/bin` symlinks above.

---

## Failure mode 5: IPEX-LLM ollama models dir not writable by ubuntu — `ollama pull` permission denied

**Symptom:** `ollama list` works (it reads from the daemon socket), but `ollama pull <model>` partially downloads then errors with `open /usr/share/ollama/.ollama/models/blobs/sha256-XXX-partial-0: permission denied`. RAG rescan log says `❌ Ollama not available. ollama serve + pull nomic-embed-text first.` even though ollama IS serving.

**Real-world hit:** **stoneyard-appleton + leglamp-tvcontroller, 2026-05-19** — RAG rescan needed `nomic-embed-text` (274 MB, not pre-installed at these locations). `sudo ollama pull` did NOT help because sudo escalates the CLI but the daemon (running as ubuntu) is what actually writes to disk.

**Why:** the IPEX-LLM ollama package (per CLAUDE.md §9 "Ollama runtime fleet-standard") sets `OLLAMA_MODELS=/usr/share/ollama/.ollama/models` in `/etc/systemd/system/ollama-ipex.service` so it shares the model store with the (disabled) upstream ollama install. But the dir is owned `ollama:ollama` and the IPEX daemon runs as `ubuntu` (so the ubuntu PM2/auto-update tooling can talk to it without sudo). ubuntu doesn't have write access by default.

**Detection:**
```bash
ssh ubuntu@<host> "
  groups ubuntu | grep -q ollama && echo 'in ollama group: yes' || echo 'in ollama group: NO'
  test -w /usr/share/ollama/.ollama/models/ && echo 'models dir writable: yes' || echo 'models dir writable: NO'
  ollama list 2>&1 | head -5
"
```

**Fix (idempotent, requires sudo):**
```bash
sudo usermod -aG ollama ubuntu
sudo chgrp -R ollama /usr/share/ollama/.ollama/models/
sudo chmod -R g+w   /usr/share/ollama/.ollama/models/
sudo systemctl restart ollama-ipex
# Verify
ssh ubuntu@<host> "ollama pull nomic-embed-text"   # should complete
```

Group membership applies on next login session OR systemd unit restart. After this, `ollama pull` works without sudo and the IPEX daemon can persist new models.

**Why this over `chown -R ubuntu /usr/share/ollama`:** keeping the dir group-owned by `ollama` preserves the option to switch back to the upstream ollama systemd unit (running as user ollama) without re-fixing perms. The group-write membership lets both daemons read+write the same store.

---

## Failure mode 6: missing `nomic-embed-text` model

**Symptom:** RAG rescan log says `❌ Ollama not available. ollama serve + pull nomic-embed-text first.` and `ollama list` confirms the model is missing.

**Real-world hit:** **stoneyard-appleton, 2026-05-19** — fresh-ish install never pulled the embedding model. Combined with Failure mode 5 (perm-denied) so the simple `ollama pull` from ubuntu failed.

**Fix:** first apply Failure mode 5's perm fix, then:
```bash
ollama pull nomic-embed-text
ollama list   # confirms nomic-embed-text:latest is present
```

The model is ~274MB and pulls in seconds on a decent connection. Once installed, retry the RAG rescan.

**Why nomic-embed-text specifically:** the RAG vector store uses it as the embedding model (defined in `packages/rag-server/src/config.ts`). Without it, scan-system-docs.ts can't generate embeddings for new chunks and exits.

---

## Failure mode 7: systemd USER timer invisible to `systemctl list-timers`

**Symptom:** `systemctl list-timers` shows no sports-bar-autoupdate timer, leading to "the cron is broken" conclusion. Yet auto-update.sh logs show it's been firing nightly.

**Real-world hit:** **2026-05-19 fleet investigation** — spent 30 min searching `/etc/cron*`, `/etc/crontab`, `/var/spool/cron`, systemd timers — all empty for sports-bar. Eventually realized the timer is a **user** unit at `~/.config/systemd/user/sports-bar-autoupdate.timer`, invisible to system-scoped `systemctl list-timers`.

**Detection — use the `--user` flag:**
```bash
systemctl --user list-timers sports-bar-autoupdate.timer
systemctl --user is-enabled sports-bar-autoupdate.timer   # → enabled
systemctl --user is-active sports-bar-autoupdate.timer    # → active
systemctl --user cat sports-bar-autoupdate.timer | grep OnCalendar
```

**Not a failure mode per se — just confusing.** Documented here so the next operator's auto-update audit doesn't lose 30 minutes.

---

## Failure mode 8: Tailscale hostname conventions vary per box

**Symptom:** `ssh ubuntu@luckys-1313-tvcontroller` returns `Could not resolve hostname` even though the location is online.

**Real-world hit:** **2026-05-19** — assumed every location was `<branch-slug>-tvcontroller`. Half the fleet is, but `luckys1313` has no dashes and `greenville-stoneyard` reverses the slug order.

**Fix — always look up via `tailscale status`:**
```bash
tailscale status | grep -i <approximate-name>
```

**Canonical list (as of 2026-05-19):**

| Branch slug | Tailscale name | IP |
|---|---|---|
| `location/holmgren-way` | `hw-sports-bar-tv-controller` | 100.117.155.98 |
| `location/leg-lamp` | `leglamp-tvcontroller` | 100.101.200.82 |
| `location/lucky-s-1313` | `luckys1313` | 100.77.85.89 |
| `location/graystone` | `graystone-tvcontroller` | 100.93.130.14 |
| `location/stoneyard-greenville` | `greenville-stoneyard` | 100.112.255.60 |
| `location/stoneyard-appleton` | `stoneyard-appleton` | 100.107.223.47 |

---

## Failure mode 9: PM2 reports correct version but `/api/version` lags

**Symptom:** `package.json` on disk shows v2.50.X (new) but `curl /api/version` returns v2.50.Y (old). PM2 `status` shows app online.

**Real-world hit:** **Holmgren, 2026-05-19** — I committed v2.50.8 + v2.50.9 directly to main but never rebuilt + restarted PM2. PM2 was still running the v2.50.7 build.

**Why:** PM2 runs the `.next/` build artifact, not the source. The disk-level source change has no runtime effect until `npm run build` regenerates `.next/` AND `pm2 restart` picks up the new build.

**Fix:**
```bash
cd ~/Sports-Bar-TV-Controller
bash scripts/auto-update.sh --triggered-by=manual_cli
# or, if you don't need the full auto-update flow:
rm -rf apps/web/.next
npm run build
pm2 restart sports-bar-tv-controller --update-env
```

The full auto-update flow is safer because it has the verify-install gate at the end.

---

## Failure mode 10: working tree slip — committed to wrong branch

**Symptom:** "Holmgren reports the new version but the fleet dashboard doesn't see the commit." OR "git push complains about diverged branches." OR: I commit something I think is going to `main` but it actually lands on `location/holmgren-way` and gets isolated to Holmgren until I notice.

**Real-world hit:** **Holmgren, 2026-05-19 (multiple times across the session)** — auto-update.sh on Holmgren switches the checkout to `location/holmgren-way` for the merge step and leaves it there. The next `git commit` from the session goes to the location branch instead of `main`. Took 2 cycles to catch the pattern.

**Detection — always run before commit:**
```bash
git branch --show-current
```

If it shows `location/...` and you intended to push code to main, switch first:
```bash
git reset HEAD                # keep working tree changes, unstage
git checkout main             # working tree edits travel with you
# then re-stage + commit
```

**Prevention (workflow rule):** after every `pm2 restart`-following-a-location-merge, the NEXT command is `git checkout main`. Build that into muscle memory.

---

## Failure mode 11: RAG rescan reports `idle` but never actually ran

**Symptom:** `pgrep -af 'rag-rescan|scan-system-docs'` returns nothing immediately after triggering. /tmp/rag-rescan-*.log file exists but has the "no changes to scan" message OR an error.

**Common causes (in order of likelihood):**
1. **Genuine no-op** — `scripts/rag-rescan-if-needed.sh` is path-aware. If no RAG-indexed files (CLAUDE.md / docs/ / packages/*/README.md / etc.) changed in the merge, it exits without scanning. Look for `[rag-rescan] no rag-indexed files changed — skipping` in the log.
2. **Missing npx** — see Failure mode 4.
3. **Missing nomic-embed-text** — see Failure mode 6.
4. **Lock file held** — `/tmp/rag-rescan.lock` from a previous interrupted run blocks the new one. `rm -f /tmp/rag-rescan.lock` and retry (only safe if no scan process is actually running per `pgrep`).

**Verify a rescan is actually doing work:**
```bash
ssh ubuntu@<host> "
  echo 'processes:'; pgrep -af 'scan-system-docs|scan-code-docs'
  echo 'store-size:'; stat -c '%s bytes / mtime %y' ~/Sports-Bar-TV-Controller/apps/web/rag-data/vector-store.json
  echo 'bm25-size:';  stat -c '%s bytes / mtime %y' ~/Sports-Bar-TV-Controller/apps/web/rag-data/bm25.db
"
```

Growing size + recent mtime = actively working. Mtime older than your trigger time + no processes = it already finished (success) OR it failed silently before opening the file.

**Note on `chunks: 0` reading:** if you `jq '.chunks | length' vector-store.json` mid-scan, you can get `0` even though the file is 60+ MB. The scanner is mid-write — the chunks array hasn't been re-serialized yet. NOT a failure. Wait for mtime to settle, then re-query.

---

## Failure mode 12: Checkpoint A false-positive — "critical script deleted in pending diff"

**Symptom:** Checkpoint A returns `STOP - critical script deleted in pending diff` at a location that hasn't been updated in a while, even though the pending commits only ADD/MODIFY scripts (no deletions).

**Real-world hit:** **leglamp-tvcontroller, 2026-05-19** — v2.50.13 push (which only added `docs/CLAUDE_CLI_RAG_ACCESS.md` and modified `package.json` + `scripts/auto-update.sh`). Checkpoint A flagged it because the location's `.auto-update-last-success.json` (a per-location heartbeat file that exists on leglamp but doesn't exist on `main`) appears as `D .auto-update-last-success.json` in `git diff HEAD..origin/main`. The old detector OR'd "any critical script touched" with "any file deleted" — both true, so STOP fired even though the deleted file wasn't a critical script.

**Why:** the deterministic Checkpoint A scan in `scripts/checkpoint-deterministic.sh` had:
```bash
if echo "$diff" | grep -qE '^diff --git a/scripts/(auto-update|verify-install|rollback)\.sh' && \
   echo "$diff" | grep -qE '^deleted file mode'; then
  emit STOP "critical script deleted in pending diff"
fi
```
The two greps were independent — one fired on script CHANGE, the other on ANY file delete. They didn't have to be the SAME file.

**Fix (v2.50.14):** narrowed the check to extract the per-file diff section for each critical script and confirm THAT file specifically has `deleted file mode`. Now an unrelated heartbeat-file delete plus a critical-script modification no longer false-positives.

**Workaround on a stuck location (pre-v2.50.14):**
```bash
# manually mark the run as approved + skip checkpoint A (NOT a real flag, just rebuild)
# OR delete the heartbeat file on the location branch so it doesn't appear "deleted":
ssh ubuntu@<host>
cd ~/Sports-Bar-TV-Controller
git rm .auto-update-last-success.json  # location-only, gets recreated on next successful run
git commit -m "chore: remove stale heartbeat to unblock checkpoint A"
git push origin location/<name>
bash scripts/auto-update.sh --triggered-by=manual_cli
```

---

## Failure mode 13: Checkpoint C false-positive — stale PM2 crash from BEFORE pm2_restart

**Symptom:** Checkpoint C returns `STOP - fresh crash pattern in PM2 logs post-restart` and rolls back, but the cited crash timestamp is BEFORE the auto-update's `pm2_restart` step in the same log.

**Real-world hit:** **Holmgren, 2026-05-19 02:38:29** — Checkpoint C cited a `SyntaxError: Unterminated string in JSON at position 13617698` crash at 02:33:44 (5 min before the run's pm2_restart at 02:38:06). The crash was real — likely caused by the chat API trying to read `vector-store.json` while the rag-rescan was rewriting it (race condition). But it predated the current run's restart by 5 minutes, so it was leftover noise, not a regression introduced by the merge.

**Why:** the deterministic Checkpoint C scan grabs `pm2 logs --lines 80 --nostream` and greps for crash patterns. With no timestamp filter, any pre-existing crash in those 80 lines (which can span 30+ minutes during low-traffic periods) is treated as fresh.

**Fix (v2.50.14):** `auto-update.sh` now exports `PM2_RESTART_EPOCH=$(date +%s)` immediately before invoking `pm2 restart`. Checkpoint C's awk filter parses each PM2 log line's timestamp, converts to epoch, and skips any crash older than the restart. Pre-restart noise no longer trips STOP.

**Workaround on a stuck location (pre-v2.50.14):**
```bash
# Confirm the cited crash is genuinely from before pm2_restart in your run's log:
ssh ubuntu@<host>
grep -E 'PM2 crash pattern hit|STEP: pm2_restart' \
  $(ls -t ~/sports-bar-data/update-logs/auto-update-*.log | head -1)
# If the crash timestamp is older than pm2_restart, the rollback was a false-positive.
# Re-fire after a few minutes (so the stale crash scrolls out of PM2's last 80 lines):
bash scripts/auto-update.sh --triggered-by=manual_cli
```

If the crash IS post-restart, it's a real regression — investigate the v2.X.Y diff for what could have caused it.

---

## Failure mode 14: stale flock held by orphaned child processes — "Another auto-update run is in progress (lock held)"

**Symptom:** every `bash scripts/auto-update.sh --triggered-by=manual_cli` exits within 1 second with log: `Another auto-update run is in progress (lock held). Exiting cleanly.` BUT `pgrep -af auto-update.sh` shows no actual auto-update process. The 104-byte log file from the "lock held" exit accumulates.

**Real-world hit:** **Holmgren, 2026-05-19 02:50** — needed to fire v2.50.14 after greenville+luckys+graystone+appleton landed but every retry exited at 1 second with "lock held". `pgrep` showed no auto-update.sh running. `lsof /tmp/sports-bar-auto-update.lock` revealed 4 orphan processes holding FD 200 on the lock: bash 632052, npm 632054, sh 632078, node 632079 — leftovers from a backgrounded SSH/build that the script exited but the children never died.

**Why:** `auto-update.sh` uses `exec 200>"$LOCK_FILE"; flock -n 200` for mutual exclusion. The lock is automatically released when the FD is closed — normally that happens at process exit. But if the script `setsid -f`'s itself into the background AND a child npm/build subprocess inherits FD 200 AND that child outlives the script (e.g. detached via nohup or session-killed parent leaves zombies), the kernel keeps the flock held against the orphan FD. The next auto-update.sh's `flock -n 200` correctly fails because the lock IS held — just not by the process the operator thinks.

**Detection:**
```bash
# Confirm the lock file exists but no auto-update.sh is running
ls -la /tmp/sports-bar-auto-update.lock
pgrep -af 'scripts/auto-update.sh' | head -3       # should return nothing or just your grep
# Identify the orphan holder
sudo lsof /tmp/sports-bar-auto-update.lock         # lists PIDs holding FD 200 on the lock
ps -p <PID> -o pid,etime,stat,wchan:25,comm        # check if it's really orphaned
```

**Fix (one line, idempotent):**
```bash
rm -f /tmp/sports-bar-auto-update.lock
# OR if orphan processes need to die too (lsof showed real-looking children):
# sudo kill <PID>...  for each orphan
# then rm the lock
bash scripts/auto-update.sh --triggered-by=manual_cli    # should now proceed past the lock check
```

**Prevention (planned):** auto-update.sh's flock acquisition should also write its OWN PID to a sidecar file at lock acquisition, and `flock -n 200` failure should check whether that PID is alive via `kill -0`. If the recorded PID is dead, treat the lock as stale, remove the file, and retry. Current behavior trusts flock unconditionally, which gets it wrong for orphan-FD cases.

---

## Failure mode 15: stale Q-A or RAG-related processes burning CPU/RAM for hours

**Symptom:** `ps aux | grep node` shows long-running processes (multi-hour elapsed) with 0% CPU, in `ep_poll` state. Their output files are empty or never created.

**Real-world hit:** **Holmgren, 2026-05-19** — Q-A generator process from prior overnight attempt was stuck for ~5 hours waiting on a network read (probably Anthropic API timeout or hung socket). Used 75MB RAM doing nothing.

**Fix:**
```bash
# Identify stale: high elapsed time + 0% CPU + ep_poll state
ps -eo pid,etime,stat,pcpu,pmem,wchan:25,comm --sort=-etime | grep node | head -20
# Kill (substitute PID)
kill <PID>
sleep 2
ps -p <PID> -o stat   # should report no process
```

**Prevention (for new background jobs you write):**
- Set explicit timeouts on every network call
- Log progress to a file every N items, with timestamps, so you can tell when the process LAST made progress (vs. when it started)
- Have a kill-switch envvar so the runner self-terminates after N hours

---

## Update fool-proof sequence (the "always works" recipe)

When pushing a new version that the operator wants to land on every location WITHOUT surprises:

### Step 1 — pre-flight on the dev box (Holmgren)
```bash
cd ~/Sports-Bar-TV-Controller
git branch --show-current   # MUST be main
git status                  # MUST be clean
git pull origin main        # MUST be in sync
```

### Step 2 — ship the code
```bash
# Edit code, bump version in package.json
# Stage + commit + push to main
git add <specific files>
git commit -m "vX.Y.Z: short description"
git push origin main
```

### Step 3 — verify the canary (Holmgren) picks it up cleanly
```bash
bash scripts/auto-update.sh --triggered-by=manual_cli 2>&1 | tail -20
# Look for: "Checkpoint C: DECISION: GO" + "verify-install ... PASS"
# Verify live:
curl -s http://localhost:3001/api/version | jq .version
```

If canary fails: STOP HERE. Fix on main first.

### Step 4 — sweep the fleet (parallel SSH)
```bash
for HOST in leglamp-tvcontroller luckys1313 graystone-tvcontroller greenville-stoneyard stoneyard-appleton; do
  ssh -o ConnectTimeout=5 ubuntu@${HOST} \
    "cd ~/Sports-Bar-TV-Controller && bash scripts/auto-update.sh --triggered-by=manual_cli" \
    > /tmp/${HOST}-trigger.log 2>&1 &
  echo "$HOST: PID=$!"
done
wait
```

DO NOT include `source ~/.nvm/nvm.sh &&` in the SSH command — it short-circuits the whole chain on boxes that don't use nvm (3 of 5 fleet boxes).

### Step 5 — check completion + log triage
```bash
for HOST in leglamp-tvcontroller luckys1313 graystone-tvcontroller greenville-stoneyard stoneyard-appleton; do
  echo "=== $HOST ==="
  curl -s -m 5 http://$HOST:3001/api/version 2>&1 | head -1
  ssh -o ConnectTimeout=4 ubuntu@${HOST} \
    "tail -5 \$(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)" 2>&1 | tail -5
done
```

ANY location showing `ROLLBACK SUCCESS` instead of `Checkpoint C: GO` is stuck — go to "Quick triage" at the top of this doc.

### Step 6 — if a location is stuck, apply the right failure-mode fix from above
Map symptoms → failure mode → fix → re-trigger. Don't bulldoze a fix that's not the right one.

---

## What's been ADDED to make updates more fool-proof (changelog)

- **v2.50.10** — CLAUDE.md Gotcha #11 + NEW_LOCATION_SETUP §7b: three pre-flight checks (NVM symlinks, ollama group, linger) that catch Failure modes 1, 4, 5 at install time instead of after-the-fact.
- **v2.50.11** — `scripts/fleet-schedule.json` + installer auto-stagger: spreads fleet auto-update fire times across 02:00-04:00 UTC so Claude API + GitHub fetch don't burst-collide.
- **v2.50.12** — `packages/database/src/schema.ts` declares the 4 watcher audit tables (`atlas_drop_events`, `atlas_priority_events`, `shure_rf_events`, `scheduling_preferences`) so drizzle-kit stops flagging them for deletion. PLUS `scripts/auto-update.sh` schema_push step now detects drizzle's TTY-prompt failure and falls through safely when only allowlisted tables are flagged. (Failure mode 3.)
- **v2.50.12** — `docs/AUTO_UPDATE_TROUBLESHOOTING.md` (this file): every failure mode + audit recipe + fix in one consultable doc.

---

## When you discover a NEW failure mode

Add it to this doc. The format above is the template:
1. **Symptom** — copy-paste the exact log line/error the operator will see
2. **Real-world hit** — location + date so future-you can correlate with git history
3. **Why** — root cause in 1-2 sentences
4. **Detection** — copy-pasteable shell snippet
5. **Fix** — copy-pasteable shell snippet, idempotent if at all possible

Then update CLAUDE.md Gotcha #11 with a one-line pointer to the new failure mode. Then bump version + commit + push so every location's RAG store picks it up via `scripts/rag-rescan-if-needed.sh` and operators asking the AI Hub chat for help get the new recipe.
