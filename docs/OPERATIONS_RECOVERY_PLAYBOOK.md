# Operations Recovery Playbook

**Last Updated:** 2026-05-18
**Audience:** Operators (bar managers, system admins) and the local AI Hub
**Scope:** Recovery procedures for the Sports Bar TV Controller stack when something is stuck, offline, misbehaving, or wrong.

---

## Purpose + How AI Hub uses this doc

This playbook is the operator's "what do I do when X is stuck?" reference and the AI Hub's source of truth for recovery procedures. The local Ollama-driven chat (`llama3.1:8b` on the Intel Iris Xe iGPU via IPEX-LLM) indexes this file into the RAG vector store (`packages/rag-server`) and retrieves the matching subsection when a bar manager types something like "the Atlas is dropping the upstairs zone every 30 seconds" or "Fire TV 2 won't wake up." Every subsection therefore opens with a "Symptom:" line (matched by semantic search), follows a "Likely cause(s):" bulleted list (matched against the operator's clues), provides "Recovery steps:" as exact commands the operator can copy-paste, and ends with a "Verification:" check so neither the AI nor the human declares victory prematurely. When in doubt, follow the steps top-to-bottom — they are ordered safest-first.

---

## Quick Reference Table

| Symptom | Top suspect | Jump to |
|---|---|---|
| Whole app down, PM2 says `errored` | Build failure or DB lock | §1.1 |
| Auto-update mangled the install | Conflict resolver kept wrong side | §1.2 |
| "Database is locked" / SQLITE_BUSY | Stale WAL or another writer | §1.3 |
| RAG returns "I don't know" for everything | Empty vector store after wipe | §1.4 |
| AI chat hangs > 3 min | Ollama saturated or iGPU stuck | §1.5 |
| No video on any TV after route | `outputOffset` set wrong | §2.2 |
| Atlas processor offline | TCP socket stuck OR per-bundle singleton drift | §3.1 / §3.5 |
| Atlas zone drops 50× in 30 min | Firmware 4.5 Custom Priority Volume | §3.2 |
| Priority watcher firing ghost events | Cache-after-action regression | §3.3 |
| Atlas meters frozen on bartender tab | Per-bundle UDP socket split | §3.5 |
| Fire TV "Offline" / ADB drop | Authorization or DHCP IP change | §4.1 |
| ESPN+ "Watch" button doesn't start playback | Touch event rejected, need DPAD | §4.2 |
| Prime Video won't launch on Cube | Cube has firebat-hosted Prime, not avod | §4.3 |
| Cable box channel command fails silently | IR emitter port wrong | §6.1 |
| Shure receiver "OFFLINE" but TCP open | Third-party-controls front-panel gate | §7.4 |
| Mic flagged as RF interferer | TX_MODEL=UNKNOWN + RSSI ghost signature | §7.2 |
| SDR not detected after plug-in | DVB-USB kernel driver claimed dongle | §8.2 |
| Bartender remote 403 on /api/foo | Route missing from nginx allow-list | §9.1 |
| Login "Invalid PIN" | LOCATION_ID unset or AuthPin rows missing | §10.1 |

If your symptom isn't above, scan the section headers — they all use "Symptom: X" format so Ctrl-F (or RAG semantic search) lands you on the right page.

---

## §1. System-wide recovery

### §1.1 Hard restart PM2 + clear Next.js cache

**Symptom:** Whole app appears down. `pm2 status` shows `errored`, `stopped`, or repeated restarts. Browser at `http://<server>:3001` times out, returns 502, or hangs blank. Recent change you made (code, env var, package) didn't take effect.

**Likely causes:**
- Next.js cache (`apps/web/.next/`) holds stale compiled chunks after a code change
- Turbo cache returned `FULL TURBO` for a package that actually needs rebuilding
- PM2 process is alive but Node.js inside it crashed without exiting (rare but happens)
- `.env` file changed but `pm2 restart` doesn't re-read it

**Recovery steps:**

```bash
# 1. Stop PM2 cleanly
pm2 stop sports-bar-tv-controller

# 2. Nuke caches so the rebuild can't lie to you
rm -rf /home/ubuntu/Sports-Bar-TV-Controller/apps/web/.next
rm -rf /home/ubuntu/Sports-Bar-TV-Controller/.turbo
rm -rf /home/ubuntu/Sports-Bar-TV-Controller/node_modules/.cache

# 3. Force a full rebuild (Turbo cache miss is otherwise sneaky — see CLAUDE.md Standing Rule 4)
cd /home/ubuntu/Sports-Bar-TV-Controller
npx turbo run build --force

# 4. If .env or ecosystem.config.js changed, use delete+start (NOT restart) per CLAUDE.md Gotcha #2
pm2 delete sports-bar-tv-controller
pm2 start ecosystem.config.js

# 4b. Otherwise plain restart is fine
pm2 restart sports-bar-tv-controller --update-env

# 5. Watch the boot log for at least 30 seconds
pm2 logs sports-bar-tv-controller --lines 80
```

**Verification:**
- `pm2 status` shows `online` and restart counter is NOT climbing
- `curl http://localhost:3001/api/health/database` returns `{"status":"ok",...}`
- Browse to the bartender remote on `http://<server>:3002/remote` — layout loads
- Watch logs for `[SEED]`, `[ATLAS]`, `[SHURE]`, `[SDR]` startup lines confirming subsystems came up

If PM2 keeps restarting in a loop, jump to §1.3 (DB lock) — most loops at boot are SQLite related.

---

### §1.2 Auto-update failed — rollback procedure

**Symptom:** `scripts/auto-update.sh` ran, finished with a non-zero exit, and now the app is broken or behaving wrong. The Sync tab UI may show "Update failed at checkpoint X." Operator did NOT change anything by hand.

**Likely causes:**
- Conflict in a location-data file (`apps/web/data/*.json`, `tv-layout.json`) — auto-update's `LOCATION_PATHS_OURS` resolver kept the wrong side
- Drizzle push silently failed on a pre-existing index, leaving a new column missing (per CLAUDE.md Gotcha #6)
- Build failed mid-script and PM2 was already restarted with the broken artifact
- Nginx allow-list out of date for a new API route family (per §9.1)
- Verification at Checkpoint C caught a regression but the rollback failed

**Recovery steps:**

```bash
# 1. Confirm what version is live vs what was expected
cat /home/ubuntu/Sports-Bar-TV-Controller/package.json | grep version
curl -s http://localhost:3001/api/health/version

# 2. Identify the auto-update backup directory (created at Checkpoint A)
ls -lt /home/ubuntu/sports-bar-data/backups/auto-update-* | head -5

# 3. Restore the DB from the backup (replace TIMESTAMP with the matching one)
pm2 stop sports-bar-tv-controller
cp /home/ubuntu/sports-bar-data/production.db /home/ubuntu/sports-bar-data/production.db.broken
gunzip -c /home/ubuntu/sports-bar-data/backups/auto-update-<TIMESTAMP>/production.db.gz > /home/ubuntu/sports-bar-data/production.db

# 4. Roll the code back to the prior commit on this branch
cd /home/ubuntu/Sports-Bar-TV-Controller
git log --oneline -10
git reset --hard <PREVIOUS_COMMIT_SHA>

# 5. Reinstall + rebuild from the rolled-back tree
npm ci
npx turbo run build --force

# 6. Restart and verify
pm2 start sports-bar-tv-controller
pm2 logs sports-bar-tv-controller --lines 50
```

**Verification:**
- `curl /api/health/database` returns ok
- Open `/system-admin/sync` and confirm the last update entry shows "rolled back"
- Browse the bartender remote — layout shows, channel presets visible, no console errors

After rollback, file the failure mode at `docs/VERSION_SETUP_GUIDE.md` "Known Errors & Fixes" so the next location sees the warning before merging the same version (per CLAUDE.md Standing Rule 8).

---

### §1.3 Database lock / SQLite WAL stuck

**Symptom:** App logs spam `SQLITE_BUSY` or `database is locked`. Any API write returns 500. Reads might still work because SQLite WAL allows concurrent reads. `pm2 status` may show `online` but the app is functionally dead.

**Likely causes:**
- A previous PM2 process was killed mid-write and left `production.db-shm` / `production.db-wal` files in a half-state
- An external process (`sqlite3` shell left open, drizzle-kit studio session) is holding a write lock
- The WAL file has grown huge (>50 MB) because the auto-checkpoint never fired

**Recovery steps:**

```bash
# 1. Identify everything that currently has the DB open
lsof /home/ubuntu/sports-bar-data/production.db

# 2. Stop the app so nothing is actively writing
pm2 stop sports-bar-tv-controller

# 3. Kill any stray sqlite3 / drizzle-kit / drizzle-studio processes
pgrep -af "sqlite3|drizzle" || true
pkill -f "drizzle-kit studio" || true

# 4. Force a WAL checkpoint and truncate
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 5. If the -shm file is still there and looks stale (mtime far in the past), remove it
ls -la /home/ubuntu/sports-bar-data/production.db-shm
rm -f /home/ubuntu/sports-bar-data/production.db-shm

# 6. Integrity check before restart
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
# Expect: "ok" — anything else means corruption, jump to §1.3.bis below

# 7. Restart
pm2 start sports-bar-tv-controller
```

**Verification:**
- `pm2 logs` shows no further `SQLITE_BUSY` lines
- `curl /api/health/database` returns ok
- WAL size stays bounded: `ls -lh /home/ubuntu/sports-bar-data/production.db-wal` should be under 10 MB after a few minutes of normal traffic

**§1.3.bis — If integrity_check returned anything other than "ok":**

```bash
pm2 stop sports-bar-tv-controller
cp /home/ubuntu/sports-bar-data/production.db /home/ubuntu/sports-bar-data/production.db.corrupt-$(date +%s)
# Attempt dump-and-rebuild recovery
sqlite3 /home/ubuntu/sports-bar-data/production.db ".dump" | sqlite3 /home/ubuntu/sports-bar-data/production.db.rebuilt
mv /home/ubuntu/sports-bar-data/production.db.rebuilt /home/ubuntu/sports-bar-data/production.db
pm2 start sports-bar-tv-controller
```

If `.dump` itself errors out, restore from `/home/ubuntu/sports-bar-data/backups/latest.db.gz` per §1.2 step 3.

---

### §1.4 Vector store corrupt — full rebuild

**Symptom:** AI Hub chat returns generic "I don't know" or "I don't have information about that" for queries that should hit indexed docs. `GET /api/rag/stats` shows `chunks: 0` or a number lower than expected. Recent doc additions don't surface in answers.

**Likely causes:**
- Vector store file was deleted, moved, or written to the wrong path (the chdir-before-import gotcha — `packages/rag-server` imports should happen from the repo root or the embed path lands in the wrong place; see §11.4)
- Embedding model was upgraded (e.g. `nomic-embed-text` major version) without re-embedding existing chunks — vectors are dimension-mismatched
- A scan was interrupted mid-write

**Recovery steps:**

```bash
# 1. Confirm the embedding model is what the code expects
ollama list | grep -E "nomic-embed-text|llama3.1"
# Both must be present. If missing:
ollama pull nomic-embed-text
ollama pull llama3.1:8b

# 2. Wipe the existing vector store and rebuild
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run rag:scan:clear

# 3. Watch progress — embedding 200+ docs takes 5-15 min on the iGPU
# The script prints one line per file processed. Expect 1500-3000 chunks total.

# 4. Test a known-good query
npm run rag:test -- --query "How do I configure CEC cable box control?"

# 5. Verify via API
curl http://localhost:3001/api/rag/stats
# Expect: chunks > 1500, documents > 200
```

**Verification:**
- `/api/rag/stats` returns non-zero counts that match expectations
- Open AI Hub chat and ask "How do I rebuild the vector store?" — answer should cite this section (`OPERATIONS_RECOVERY_PLAYBOOK.md §1.4`)
- Ask "What is outputOffset?" — answer should cite CLAUDE.md Gotcha #4

If `npm run rag:scan:clear` itself errors with "model not found," Ollama isn't running — jump to §1.5.

---

### §1.5 Ollama not responding / iGPU lock

**Symptom:** AI Hub chat hangs for >3 minutes. AI Suggest in the scheduler times out at 300s. `journalctl -u ollama-ipex` shows no recent entries or shows SYCL errors. `ollama list` works but `ollama run llama3.1:8b "hi"` hangs.

**Likely causes:**
- Iris Xe iGPU driver got into a wedged state — typically after a kernel update without a reboot
- IPEX-LLM Ollama service crashed silently
- A previous large-context generation is still holding the model loaded and refusing new requests
- Wrong service running — vanilla `ollama` instead of `ollama-ipex` (vanilla is CPU-only and ~5× slower)

**Recovery steps:**

```bash
# 1. Confirm which Ollama service is active (we want ollama-ipex)
systemctl status ollama-ipex
systemctl status ollama 2>/dev/null  # Should be inactive/disabled

# 2. If vanilla ollama is running, disable it and start the IPEX variant
sudo systemctl disable --now ollama
sudo systemctl enable --now ollama-ipex

# 3. Restart the IPEX service to clear any wedged model
sudo systemctl restart ollama-ipex
sleep 5

# 4. Verify GPU detection
journalctl -u ollama-ipex --since "1 min ago" | grep -i "intel gpu\|level_zero"
# Expect: "using Intel GPU" and "level_zero:gpu:0"

# 5. Smoke-test inference (should return in <10s)
time curl -s -X POST http://localhost:11434/api/generate \
  -d '{"model":"llama3.1:8b","prompt":"hi","stream":false}' | head -c 200

# 6. Confirm acceleration (Render/3D busy >50% during inference)
sudo timeout 8 intel_gpu_top -J -s 1000 > /tmp/gpu_top.json &
sleep 1
curl -s -X POST http://localhost:11434/api/generate \
  -d '{"model":"llama3.1:8b","prompt":"explain TCP in 3 sentences","stream":false}' > /dev/null
wait
grep -A2 '"Render/3D"' /tmp/gpu_top.json | head -20
```

**Verification:**
- Smoke-test step 5 returns a coherent string in <10 seconds
- GPU usage in step 6 shows `busy` > 50% during the inference
- AI Hub chat responds normally; AI Suggest in the scheduler completes in 90-200 seconds

**Don't trust `ollama ps` `size_vram` field** — it reports `0` even when GPU-loaded on the SYCL backend (per memory `feedback_ipex_llm_sycl_quirks`). `intel_gpu_top` is the only authoritative check.

If `intel_gpu_top` shows zero GPU usage during inference, the IPEX build has fallen back to CPU. Re-run `bash scripts/setup-iris-ollama.sh` and reboot.

---

## §2. Wolf Pack HDMI matrix

### §2.1 No video on any output

**Symptom:** TVs show "No Signal" on every output after a routing change. Bartender remote video tab shows correct selections but the room is dark. Recent action: probably a reboot, a config save, or a multi-route command.

**Likely causes:**
- Wolf Pack chassis lost network — power blip, switch port flapped
- HDCP handshake failure across all outputs (often after a source device reboot)
- `outputOffset` was changed and now every route lands on the wrong physical output (jump to §2.2 if this matches)
- Telnet port 23 stuck — chassis accepts the TCP connection but commands silently fail

**Recovery steps:**

```bash
# 1. Confirm chassis is reachable on the network
ping -c 4 <wolfpack-ip>       # see .claude/locations/<branch>.md for the IP
nc -zv <wolfpack-ip> 23

# 2. Send a known-good test route via Telnet
echo "I1O1." | nc -w 3 <wolfpack-ip> 23
# Expect: "OK" or the chassis's success token. No response = port stuck.

# 3. If port 23 is stuck but ping works, power-cycle the chassis
# (Physical: pull power for 10 sec, plug back in, wait 60 sec for full boot)

# 4. After chassis comes back, force the app to re-discover route state
curl -X POST http://localhost:3001/api/wolfpack/refresh-routes

# 5. From the bartender remote, re-route one TV and verify video
```

**Verification:**
- Bartender remote shows the new route AND the physical TV lights up
- `pm2 logs | grep WOLFPACK` shows successful command echoes

---

### §2.2 Routing command silently fails (the outputOffset gotcha)

**Symptom:** Routing commands return "success" but the wrong physical TV switches sources, or no TV does. Operator says "I tapped Cable 1 → TV 5 and Bar TV 3 changed instead." No error logs.

**Likely causes (THIS IS THE #1 SILENT FAILURE — CLAUDE.md Gotcha #4):**
- `MatrixConfiguration.outputOffset` is set wrong for the chassis layout
- Single-card chassis (e.g. Lucky's 1313 WP-36X36) MUST have `outputOffset = 0` — any other value misroutes every command
- Multi-card chassis layouts vary; the offset depends on which physical card the output lives on

**Recovery steps:**

```bash
# 1. Read the live value
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, outputOffset, audioOutputCount FROM MatrixConfiguration;"

# 2. Compare against the expected value for this location.
# Look up CLAUDE.md Gotcha #4 per-location table:
#   - Single-card (Lucky's, Leg Lamp): outputOffset MUST be 0
#   - Multi-card (Holmgren, Graystone, Stoneyard): per-card; depends on wiring
#
# Also check the location's .env for MATRIX_SINGLE_CARD=true — if set,
# any non-zero offset is wrong and verify-install.sh would have blocked
# the auto-update.

# 3. If the value is wrong, fix it
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE MatrixConfiguration SET outputOffset = 0 WHERE id = 1;"

# 4. Restart so the matrix service re-reads the config
pm2 restart sports-bar-tv-controller

# 5. Smoke-test a single route and physically confirm the right TV changed
```

**Verification:**
- Tap Cable 1 → TV 5 on the bartender remote and **physically walk to TV 5** to confirm it switched
- `pm2 logs | grep "\[MATRIX-CONFIG\]"` shows the warning is gone
- Try several routes across the matrix — no more misroutes

If a multi-card chassis offset is wrong, you need the wiring diagram from the install — do not guess. Contact the installer or check `.claude/locations/<branch>.md` for the canonical mapping.

---

### §2.3 Wolf Pack chassis-config reset

**Symptom:** Chassis appears working but inputs are labeled wrong, EDID is wrong, or routing groups have been wiped. The chassis's own web UI shows defaults.

**Likely causes:**
- Power blip during a config save — chassis reverted to last good
- A firmware update — Wolf Pack firmware sometimes wipes user config

**Recovery steps:**

1. Open the chassis web UI at `http://<wolfpack-ip>` (default creds in `.claude/locations/<branch>.md`)
2. Compare input labels and EDID assignments against the canonical list in `apps/web/data/wolfpack-devices.json` on this location branch
3. Re-apply labels and EDID per the canonical list
4. Save and reboot the chassis from its own UI
5. From the app, force a re-fetch: `curl -X POST http://localhost:3001/api/wolfpack/refresh-routes`

**Verification:** Bartender remote video tab shows the correct input names; routing works.

---

## §3. Atlas audio processor (AZM8 / AZMP4)

### §3.1 Atlas TCP connection drops repeatedly

**Symptom:** PM2 logs show repeated `[ATLAS] connect failed` or `[ATLAS] socket closed unexpectedly` over minutes/hours. Bartender Audio tab shows stale meters or "OFFLINE" badge. The processor IS reachable via ping and its own web UI.

**Likely causes:**
- Network blip causing the persistent TCP session on port 5321 to drop, plus a reconnect race
- Per-bundle singleton issue (jump to §3.5 if meters are also frozen)
- Processor firmware bug — some Atlas firmware versions drop idle TCP after ~5 min if no commands flow
- The app was started multiple times without `pm2 delete`, leaving zombie clients holding the socket

**Recovery steps:**

```bash
# 1. Confirm the processor is responsive at its own web UI
ping <atlas-ip>
curl -s --max-time 5 http://<atlas-ip>/ | head -20

# 2. Check what the app thinks
curl -s http://localhost:3001/api/atlas/status

# 3. Force a clean reconnect — restart the app via delete+start so any
# zombie clients in old PM2 processes definitely die
pm2 delete sports-bar-tv-controller
pm2 start ecosystem.config.js

# 4. Watch the Atlas startup sequence
pm2 logs sports-bar-tv-controller --lines 100 | grep -i atlas
# Expect: "[ATLAS] TCP connected", "[ATLAS] UDP listener bound 3131",
# "[ATLAS] meter subscriptions sent"
```

**Verification:**
- Bartender Audio tab meters tick within 2 seconds
- `curl /api/atlas/status` returns `connected: true`
- No further `[ATLAS] socket closed` lines for 10+ minutes

---

### §3.2 Zone gain drops 50× in 30min (firmware 4.5 Custom Priority Volume gotcha)

**Symptom:** `atlas_drop_events` table is filling up with rows for the same zone, repeated every ~30 seconds. The bartender remote shows the zone's gain repeatedly snapping to a low value (e.g. 45 → 5) then recovering, then dropping again. Operator says "the upstairs zone keeps cutting out."

**Likely causes:**
- Atlas firmware 4.5+ "Custom Priority Volume Levels" feature is set on a priority input (mic, page, GPI). When that priority fires, the zone gain is forced to a fixed low value — looks IDENTICAL to a real drop signature (per memory `feedback_atlas_firmware_4_5_custom_priority_volume`)
- A real mic or page input is genuinely firing repeatedly (less likely if it's exactly every 30 seconds, which matches the drop-watcher poll cadence times a stuck cache)
- Watcher cache-after-action regression (jump to §3.3 if events list shows `gap_seconds = 30, 60, 90, ...`)

**Recovery steps:**

1. **First — check the Atlas GUI before assuming a code bug.** Open `http://<atlas-ip>/` → Sources → Priority. For every priority-tagged input (mic, page, GPI, X-ZPS):
   - Look for a "Custom Volume" or "Custom Level" field
   - If set to a low value (e.g. 5%, -50 dB) AND that priority input is firing, that IS the "drop"

2. Decide what to do:
   - **Raise the Custom Volume** to a less-jarring level (e.g. -10 dB instead of -50 dB)
   - **Set it back to "Zone Volume"** for legacy ducking behavior
   - **Accept it** — the drops are intentional, just suppress watcher noise via cooldown

3. If you want to suppress drop-watcher noise from a known-intentional priority drop:

```bash
# Add a watcher exclusion for this zone (UI: /system-admin/atlas → Drop Watcher)
# Or set per-zone cooldown to 300s (v2.42.1+) so spam is bounded
```

4. Confirm the priority watcher is correctly labeling this as priority-induced rather than a mystery drop:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT created_at, zone_id, prev_volume, new_volume, source_id \
   FROM atlas_drop_events ORDER BY id DESC LIMIT 20;"
# Cross-reference timestamps with atlas_priority_events for the same window
```

**Verification:**
- No more new drop rows for that zone (or the cooldown bounds them to ≤1/5min)
- Operator confirms the audio behavior matches their expectation

---

### §3.3 Priority watcher firing ghost events

**Symptom:** `atlas_priority_events` rows are appearing every poll interval (~5 sec) with no actual mic/page activity. The amber priority banner on the bartender Audio tab is stuck on. Operator hears no audio difference.

**Likely causes:**
- Watcher cache-after-action regression — `lastSeen.set()` is being skipped because a downstream INSERT throws, so prev vs live comparison keeps matching the stale value (per memory `feedback_watcher_cache_after_action`)
- A real mic input is briefly crossing -45 dBFS from ambient noise — bump the threshold or fix the input gain
- RF interference on a Shure mic is causing audio leakage into the Atlas input (cross-check §7.2 — if it lines up, this is a `rf_induced_mic_active` event, not a watcher bug)

**Recovery steps:**

```bash
# 1. Look at the recent priority events — gap_seconds pattern reveals cache-stuck
sqlite3 /home/ubuntu/sports-bar-data/production.db "
  SELECT created_at, event_type, source_name, level_dbfs,
         CAST((julianday(created_at) - julianday(LAG(created_at) OVER (ORDER BY id))) * 86400 AS INTEGER) AS gap_seconds
  FROM atlas_priority_events
  WHERE created_at > datetime('now', '-30 minutes')
  ORDER BY id DESC LIMIT 30;
"
# Cache-stuck pattern: gap_seconds = 5, 10, 15, 20, ... (linearly increasing or constant 5)
# Real activity: gap_seconds varies widely with bursts

# 2. Check whether the Shure RF watcher fired in the same window (relabels event_type)
sqlite3 /home/ubuntu/sports-bar-data/production.db "
  SELECT created_at, event_type, rssi_dbm, freq_mhz, note
  FROM shure_rf_events
  WHERE created_at > datetime('now', '-30 minutes')
  ORDER BY id DESC LIMIT 20;
"

# 3. If the pattern is clearly a cache-stuck spam, restart the app
# (will clear the in-memory lastSeen map and force a fresh read)
pm2 restart sports-bar-tv-controller

# 4. After restart, watch the next 5 minutes
pm2 logs sports-bar-tv-controller --lines 100 | grep -i "atlas.*priority\|priority.*watcher"
```

**Verification:**
- `gap_seconds` returns to varying values (or zero new rows if there's no real activity)
- Banner clears from the bartender Audio tab
- If the spam returns, this is a code regression — file an issue and roll back via §1.2

---

### §3.4 Scene recall stuck (dbx auto-recall pattern, applies to ZonePRO)

**Symptom:** After power blip or app restart, dbx ZonePRO zone is in "failsafe mode" — source indices are shifted (source 1 plays the wrong content, sources may be off-by-one or off-by-two).

**Likely causes:**
- A new TCP connection puts ZonePRO into failsafe mode, which silently shifts source indices (per `packages/dbx-zonepro/README.md`)
- Scheduler did NOT auto-recall Scene 1 on connect — the `sceneOnConnect` option is missing or the code path is broken

**Recovery steps:**

```bash
# 1. Verify ZonePRO is reachable
ping <zonepro-ip>   # Lucky's 1313 ZonePRO at 192.168.10.50
nc -zv <zonepro-ip> 3804

# 2. Force a scene recall via the app's API
curl -X POST http://localhost:3001/api/dbx-zonepro/recall-scene \
  -H "Content-Type: application/json" \
  -d '{"deviceIp":"<zonepro-ip>","sceneNumber":1}'

# 3. If that endpoint doesn't exist or fails, restart the app — the
# scheduler reconnects and recalls Scene 1 on connect
pm2 restart sports-bar-tv-controller

# 4. Confirm via the bartender Audio tab — sources should map correctly
```

**Verification:** Source labels match audio. Operator can tap Source 1 and hear Source 1 content.

---

### §3.5 Meter readings frozen (per-bundle singleton drift — CLAUDE.md Gotcha #10)

**Symptom:** Bartender Audio tab and admin Atlas page show DIFFERENT meter values — bartender meters are frozen at the value from 10 minutes ago, admin meters are live. Or vice versa. Both pages query the same processor. No errors in logs.

**Likely causes:**
- Two route bundles each have their own copy of `atlasClientManager` — each created its own `ExtendedAtlasClient` with its own UDP socket bound to port 3131 via `SO_REUSEPORT`. The Linux kernel hashes meter packets to whichever socket happens to win, so each bundle's cache only reflects the packets that landed there (per CLAUDE.md Gotcha #10, fixed in v2.33.50+ — but a regression is possible if someone wrote a new singleton without `globalThis` hoisting)
- An app deploy stranded zombie route-bundle processes (rare; usually PM2 cleans them up)

**Recovery steps:**

```bash
# 1. Confirm the issue — fetch from BOTH endpoints and compare
curl -s http://localhost:3001/api/atlas/meters | head
curl -s http://localhost:3002/api/atlas/meters | head    # bartender proxy
# If the values disagree, you have the singleton split

# 2. Hard restart — kills all bundle processes
pm2 delete sports-bar-tv-controller
pm2 start ecosystem.config.js

# 3. After restart, re-compare. They should now agree.

# 4. If they STILL disagree after restart, a singleton in the code is
# NOT using globalThis Symbol.for(). Find it:
grep -rn "private static instance" packages/atlas packages/shure-slxd \
  packages/dbx-zonepro packages/bss-blu apps/web/src/lib
# Anything that owns an OS resource (TCP/UDP socket, file handle, child process)
# AND lacks `Symbol.for(...)` is a candidate fix per Gotcha #10
```

**Verification:** Bartender Audio tab and admin Atlas page show identical meter values that update in real time on both.

---

## §4. Fire TV / streaming devices

### §4.1 Device offline (ADB drop)

**Symptom:** Fire TV shows "Offline" in the dashboard. Commands return "ECONNREFUSED" or "device offline." Ping to the device works.

**Likely causes:**
- ADB authorization revoked (Fire TV expects the operator to accept the connection prompt after a factory reset or firmware update)
- DHCP IP changed and the DB still points at the old address
- Fire TV's ADB daemon crashed
- The device is failing hardware (Holmgren has 2 Fire Cubes flagged for replacement at 10.11.3.48/.49 — don't waste hours debugging hardware failures; check `project_holmgren_firecube_replacement` memory)

**Recovery steps:**

```bash
# 1. Confirm network reachability
ping <firetv-ip>
nc -zv <firetv-ip> 5555

# 2. Try a direct ADB connect from the server
adb disconnect <firetv-ip>:5555
adb connect <firetv-ip>:5555
adb devices
# Expect: device listed as "device" (not "unauthorized" or "offline")

# 3. If "unauthorized," walk to the Fire TV and accept the prompt on screen
#    (Settings → My Fire TV → Developer Options → ADB Debugging may need toggling)

# 4. If the IP changed (DHCP), update the DB
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE FireTVDevice SET ipAddress = '<new-ip>' WHERE id = '<device-id>';"

# 5. Restart the firecube subsystem
pm2 restart sports-bar-tv-controller
```

**Verification:**
- `adb -s <ip>:5555 shell echo hello` returns "hello"
- Bartender remote shows the device as Online
- A test command (channel change, app launch) executes

If the device is a known-failing Cube (10.11.3.48/.49 at Holmgren), don't keep debugging — it's on the replacement list.

---

### §4.2 ESPN+ "Watch" button doesn't reach PlayerActivity (DPAD_CENTER gotcha)

**Symptom:** AI Game Monitor or operator tap on a Watch button gets stuck on the ESPN detail page. Foreground activity is the detail page, not PlayerActivity. No errors — the click "succeeded" but the player never started.

**Likely causes:**
- ESPN GTV's detail-page Watch CTA rejects synthetic touch events (`input tap`, `dispatchGesture`). Only `KEYCODE_DPAD_CENTER` advances to PlayerActivity (per memory `feedback_espn_watch_dpad_only`)

**Recovery steps:**

```bash
# 1. From the server, send the DPAD_CENTER directly
adb -s <firetv-ip>:5555 shell input keyevent 23
# Wait 5 sec for focus to settle, then send a SECOND DPAD_CENTER as belt-and-suspenders
sleep 5
adb -s <firetv-ip>:5555 shell input keyevent 23

# 2. Verify foreground is now PlayerActivity
adb -s <firetv-ip>:5555 shell dumpsys window windows | grep mCurrentFocus
# Expect: com.espn.gtv/.player.PlayerActivity or similar

# 3. If you reach this step often, the host-side code path is broken.
# v2.32.99 wired this DPAD send into the app's deep-link flow.
# Confirm the active path includes it:
grep -n "DPAD_CENTER\|keyevent 23" packages/firecube/src/*.ts packages/streaming/src/*.ts
```

**Verification:** Audio + video playing from PlayerActivity within 10 seconds.

---

### §4.3 Prime Video on Cube AFTR — uses launcher (com.amazon.firebat) not com.amazon.avod (CLAUDE.md Gotcha #9)

**Symptom:** "Launch Prime Video" command silently does nothing on a Fire TV Cube (model AFTR, Fire OS 7.7). Logs say "package com.amazon.avod not found." The Cube DOES have Prime Video — the operator can launch it from the home tile.

**Likely causes:**
- On Cube model AFTR (PVFTV builds), Prime Video is hosted INSIDE the launcher `com.amazon.firebat`. The catalog assumes `com.amazon.avod` which doesn't exist on these Cubes

**Recovery steps:**

```bash
# 1. Verify the package situation on the device
adb -s <firetv-ip>:5555 shell pm path com.amazon.avod
# Expect: "package not found" on AFTR Cubes

adb -s <firetv-ip>:5555 shell pm path com.amazon.firebat
# Expect: package path returned

# 2. Test the deep-link launch via firebat
adb -s <firetv-ip>:5555 shell cmd package resolve-activity --brief \
  -c android.intent.category.LEANBACK_LAUNCHER com.amazon.firebat
# Expect: com.amazon.firebat/com.amazon.firebatcore.deeplink.DeepLinkRoutingActivity

# 3. Manually launch via that activity
adb -s <firetv-ip>:5555 shell am start \
  -c android.intent.category.LEANBACK_LAUNCHER com.amazon.firebat

# 4. v2.28.8 added `com.amazon.firebat` to amazon-prime packageAliases.
# Confirm it's still there:
grep -A5 "amazon-prime" packages/streaming/src/streaming-apps-database.ts
# Expect to see "com.amazon.firebat" in packageAliases array
```

**Verification:** Prime Video browse screen appears on the TV after the bartender-remote launch button is tapped.

**Generalize the lesson:** for ANY Fire TV launch failure, run `pm path <package>` on the device first. Don't trust the catalog. Same pattern may apply to Amazon Music, Photos, etc. on Cube builds.

---

### §4.4 Catalog walker timeout

**Symptom:** Fire TV catalog walker (used by `firetv-app-sync`) reports "empty dump" or "uiautomator dump returned empty" repeatedly. Background log noise. The synced app list goes stale.

**Likely causes:**
- ADB shell default timeout is 3000 ms (per memory `feedback_adb_shell_timeout`); `uiautomator dump` on busy launcher home screens takes 3-7 seconds. The wrapper silently truncates with an empty result instead of throwing

**Recovery steps:**

```bash
# 1. Confirm via direct adb that the dump itself works
adb -s <firetv-ip>:5555 shell "uiautomator dump /sdcard/test.xml && wc -c /sdcard/test.xml"
# Expect: file size > 10000 bytes within 10 seconds

# 2. Confirm the walker passes a long timeout (v2.32.89+ uses 10000 ms)
grep -n "timeoutMs\|timeout:" packages/firecube/src/adb-client.ts apps/web/src/lib/firetv-catalog-walker.ts | head
# Expect to see timeoutMs >= 8000 in the walker call site

# 3. If the walker is using the default, edit the call site to pass timeoutMs: 10000
#    and rebuild + restart
```

**Verification:** `firetv-app-sync` log entries show successful dumps (non-empty XML) and the app list refreshes.

---

### §4.5 Live catalog out of sync (firetv-app-sync)

**Symptom:** Bartender remote shows an app the operator removed from the Cube, or doesn't show one they installed.

**Recovery steps:**

```bash
# 1. Force an immediate sync
curl -X POST http://localhost:3001/api/firetv-devices/<device-id>/sync-apps

# 2. Watch the sync log
pm2 logs sports-bar-tv-controller --lines 50 | grep -i "firetv-app-sync\|catalog"

# 3. If sync fails repeatedly, check §4.4 (walker timeout)
```

**Verification:** Bartender remote app tiles match what's actually installed on the Cube.

---

## §5. DirecTV receivers

### §5.1 Receiver unreachable (port 8080 / SHEF disabled)

**Symptom:** DirecTV receiver shows offline. Channel-tune commands return ECONNREFUSED or timeout.

**Likely causes:**
- SHEF (Set-top HTTP Export Functions) "External Access" is disabled in the receiver's menu
- DHCP IP changed
- Receiver is rebooting (Genie reboots take 3-5 minutes)
- Receiver firmware update reset the SHEF gate to OFF

**Recovery steps:**

```bash
# 1. Reachability
ping <directv-ip>
nc -zv <directv-ip> 8080

# 2. Manual SHEF probe
curl -s --max-time 5 "http://<directv-ip>:8080/info/getVersion" | head -50
# Expect: JSON with stbMacAddress, receiverId, etc.

# 3. If SHEF is disabled, walk to the receiver:
#    Menu → Settings → Whole-Home → External Device → External Access → Allow
#    Note: must be set BEFORE the receiver can be controlled via IP

# 4. If IP changed, update the DB
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE DirecTVDevice SET ipAddress = '<new-ip>' WHERE id = '<device-id>';"
pm2 restart sports-bar-tv-controller
```

**Verification:** `curl http://<directv-ip>:8080/tv/tune?major=206` returns success and the receiver tunes to ESPN.

---

### §5.2 Channel-tune command rejected

**Symptom:** SHEF returns 400 / 403 / 500 for channel-tune. Receiver does NOT change channel.

**Likely causes:**
- Channel number is wrong for this provider (CFB game listed on FS1 412 but receiver only knows FS1 as 219)
- Receiver is showing the parental-controls or DVR menu — SHEF can't change channels while a modal is up
- Tune-conflict on a Genie client where a recording is happening on the same tuner

**Recovery steps:**

```bash
# 1. Try a known-working channel directly
curl -s "http://<directv-ip>:8080/tv/tune?major=206"   # ESPN

# 2. If that works, the channel number in the request was wrong.
# Check the channel mapping in apps/web/src/app/api/sports-guide/live-by-channel/route.ts
# (NETWORK_TO_DIRECTV dictionary) and update if needed.

# 3. If even ESPN fails, walk to the receiver and dismiss any on-screen menu
# (back button, exit button). Then retry.
```

**Verification:** SHEF tune-by-channel command succeeds and TV shows the new channel.

---

### §5.3 Genie client offline

**Symptom:** Main Genie receiver is online but a Genie Mini client TV shows "Searching for receiver."

**Recovery steps:**

1. Power-cycle the affected Genie Mini (unplug, wait 30 sec, plug back in)
2. Wait 3-5 minutes for the client to re-pair with the main Genie
3. If still offline, power-cycle the main Genie (last resort — kills all clients during reboot)

**Verification:** Mini shows live TV.

---

## §6. Cable boxes (IR control)

### §6.1 IR command not firing (iTach port assignment per CLAUDE.md §10)

**Symptom:** Channel-change tap on the bartender remote returns success but the cable box doesn't change channels. Phone camera pointed at the IR emitter shows no purple/white flash.

**Likely causes:**
- iTach port assignment is wrong — learned codes have `sendir,1:1,...` hardcoded, but the runtime substitutes the device's `globalCachePortNumber`. If that field is wrong, IR fires from a different emitter
- Emitter cable is loose
- Emitter is dead (replace with spare)
- iTach lost power

**Recovery steps:**

```bash
# 1. Reachability of the iTach
ping <itach-ip>
nc -zv <itach-ip> 4998

# 2. Test the iTach directly
echo -e "getversion\r" | nc -w 2 <itach-ip> 4998
# Expect: version response

# 3. Check the device's port assignment in the DB
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, name, globalCachePortNumber FROM IRDevice WHERE name LIKE '%cable%';"

# 4. Compare against physical wiring (which iTach jack is the emitter actually in?)
# If they disagree, update the DB:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE IRDevice SET globalCachePortNumber = <correct-port> WHERE id = '<id>';"

# 5. Visual confirmation: point phone camera at emitter, send a command,
# look for purple/white flashing
```

**Verification:** Cable box responds to a channel-up command.

---

### §6.2 IR Learning failed — incomplete code (sendir buffer not flushed)

**Symptom:** Learning session in the IR Learning Panel completes, but sending the learned code returns `ERR_2:1,010` from the iTach.

**Likely causes:**
- IR code captured by the learning API was truncated (TCP buffer wasn't fully drained before the response was sent)
- The physical button press wasn't held long enough for the iTach to capture a complete waveform

**Recovery steps:**

1. Re-learn the code:
   - `/device-config` → IR tab → Select device → Click "Learn IR"
   - Point the remote at the iTach's IR sensor (within ~3 inches)
   - Press and hold the button for ~1 second
   - Wait for the API to return the captured code

2. Verify the code is complete — it must end in a number and have 6+ segments:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT functionName, irCode FROM IRCommand WHERE deviceId = '<id>';"
# Each irCode should look like: sendir,1:1,1,37764,1,1,342,171,21,83,21,...
# (long string of comma-separated numbers, ending in a number)
```

3. If the code is short, re-learn until it's >100 chars and ends in a number.

**Verification:** Sending the learned code via `/api/ir/commands/send` succeeds and the cable box responds.

---

### §6.3 Spectrum box CEC dead (use IR only per CLAUDE.md §5)

**Symptom:** Operator asks "can we control the cable box via CEC?" Or someone tried adding CEC code and is debugging why nothing happens.

**Answer:** No. Wolf Pack matrix does NOT pass CEC, and Spectrum/Charter disabled CEC in their cable box firmware. Cable box control is IR-only via Global Cache iTach IP2IR. **Do not add new CEC features for cable boxes.** See CLAUDE.md §5 and `docs/CEC_DEPRECATION_FAQ.md`.

If a non-Spectrum box (Xfinity, FiOS) needs CEC, treat it as a one-off — but it still must bypass the Wolf Pack matrix.

---

## §7. Shure SLX-D wireless mics

### §7.1 Receiver shows "OFFLINE" despite TCP connection

**Symptom:** App shows Shure receiver as offline. `nc -zv <ip> 2202` succeeds. Receiver's own web UI works.

**Likely causes:**
- Third-party-controls front-panel gate is BLOCKED (jump to §7.4 — by far the most common cause)
- Receiver firmware is below 1.1.0 (network control not supported)
- Receiver's TCP listener accepted the connect but the singleton cache hasn't populated yet

**Recovery steps:**

```bash
# 1. Probe the receiver directly to confirm the protocol works
(echo "< GET 0 FW_VER >"; sleep 2) | nc -w 3 <shure-ip> 2202
# Expect: < REP 0 FW_VER {1.4.7.0} > or similar.
# If you get NOTHING back, the front-panel gate is BLOCKED (§7.4).
# If you get FW_VER < 1.1.0, the firmware is too old — upgrade required.

# 2. Run the pre-flight probe from the app
curl -X POST http://localhost:3001/api/shure-rf/preflight \
  -H "Content-Type: application/json" \
  -d '{"ip":"<shure-ip>","port":2202}'
# Returns a checklist: TCP reachable, third-party-controls enabled, firmware ≥1.1.0

# 3. If everything checks out but the app still shows OFFLINE, restart
pm2 restart sports-bar-tv-controller
sleep 10
curl -s http://localhost:3001/api/shure-rf/status
```

**Verification:** Bartender Audio tab shows the LiveMicChips strip with real battery + RSSI values, polling every 3 seconds.

---

### §7.2 Mic detected as interferer (rf_induced_mic_active label per v2.34.1)

**Symptom:** Atlas priority watcher fires `mic_active` event, but the operator says no one is using the mic. The event note says `(SDR-confirmed, SDR peak -67 dBm)` or the event type is `rf_induced_mic_active`.

**Likely causes:**
- Real RF interference on the mic's frequency (ENG truck at Lambeau, kitchen video, neighbor's wireless) is bleeding audio into the Atlas input via the Shure receiver. This is the cross-confirmation pipeline working as designed (per memory `project_shure_sdr_atlas_rf_pipeline`)

**Recovery steps (mid-event mitigation, <60 sec):**

1. Confirm RF (not battery): check the mic's TX battery LED — if it's dead/dying, ignore the RF detection and swap mics
2. Swap to backup mic if paired
3. On the Shure receiver front panel: **Channel Scan** → pick the next clear channel in the same Group
4. **IR Sync** the TX to the new frequency (hold TX IR window within 6" of receiver IR sensor, press Sync)
5. Resume

**Recovery steps (post-event — prevent recurrence):**

```bash
# 1. Use the in-app "Find clean frequency" button
curl -X POST http://localhost:3001/api/shure-rf/find-clean-freq \
  -H "Content-Type: application/json" \
  -d '{"receiverId":"rcv-main","channel":1}'
# Causes an audible click on every hop — operator should warn staff before running

# 2. Review the Pattern Digest for recurring offenders
curl -X POST http://localhost:3001/api/shure-rf/pattern-digest
# Returns Ollama-generated summary of last 30 days of RF events + mitigation suggestions
```

**Verification:** Mic frequency is on a freq with zero recent interference events in `shure_rf_events`.

---

### §7.3 RF detection ghost-triggers (TX_MODEL=UNKNOWN, RSSI ≥-85)

**Symptom:** Cyan RF interference banner appears on bartender Audio tab even when no RF source is obvious. `shure_rf_events` shows `event_type=rf_interference` with `tx_type=UNKNOWN`, `rssi_dbm=-72`.

**Likely causes:**
- An actual ghost carrier (someone outside the bar transmitting on or near our frequency) — usually transient, an ENG truck moving past or a neighbor's wireless
- TX is genuinely off but RSSI is high (a stale carrier or a co-channel interferer)
- Cross-confirm with SDR carrier table — if SDR also saw it at the same freq within ±60s, this is real

**Recovery steps:**

```bash
# 1. Inspect the event detail
sqlite3 /home/ubuntu/sports-bar-data/production.db "
  SELECT created_at, receiver_id, channel, event_type, rssi_dbm, freq_mhz, tx_type, note
  FROM shure_rf_events
  WHERE created_at > datetime('now', '-1 hour')
  ORDER BY id DESC LIMIT 20;
"

# 2. Cross-check SDR carriers at the same freq
sqlite3 /home/ubuntu/sports-bar-data/production.db "
  SELECT created_at, freq_mhz, peak_dbm, event_type
  FROM sdr_carriers
  WHERE created_at > datetime('now', '-1 hour') AND freq_mhz BETWEEN <freq>-0.05 AND <freq>+0.05
  ORDER BY id DESC LIMIT 10;
"

# 3. If both detectors agree, run the mid-event mitigation playbook (§7.2)
# If only Shure fires (no SDR confirmation), it may be a near-field source
# the SDR antenna can't see — still real, but less certain
```

**Verification:** Banner clears within ~30 seconds of the interferer stopping (hysteresis = clear at RSSI ≤ -95 dBm × 3 samples).

---

### §7.4 Third-party-controls disabled (front-panel BLOCKED gate)

**Symptom:** TCP port 2202 accepts the connection (`nc -zv` succeeds) but the receiver silently drops every command. No data ever comes back. `< GET 0 FW_VER >` returns nothing.

**Likely causes:**
- Front-panel gate `Menu → Advanced → Network → Allow Third-Party Controls` is set to `BLOCKED` (default on new units; can reset after firmware update)

**Recovery steps:**

1. Walk to the Shure receiver
2. Press **Menu** on the front panel
3. Navigate: `Advanced` → `Network` → `Allow Third-Party Controls`
4. Set to `Enable`
5. Exit menu
6. From the server, re-run the pre-flight probe:

```bash
curl -X POST http://localhost:3001/api/shure-rf/preflight \
  -H "Content-Type: application/json" \
  -d '{"ip":"<shure-ip>","port":2202}'
# Now expect: all checks pass
```

**Verification:** Bartender Audio tab LiveMicChips strip populates with real RSSI + battery values.

This gate defaults to BLOCKED and can flip back to BLOCKED after any firmware update. Add it to the per-location post-update checklist.

---

### §7.5 Battery shows 1-bar persistently

**Symptom:** Bartender remote shows mic battery at 1 bar (red) for hours. Low-battery alert fires repeatedly.

**Likely causes:**
- TX is genuinely low on battery — replace
- TX is on alkaline batteries, which report `TX_BATT_BARS = 255` (unknown). The watcher should skip this case but a regression might fire false low-battery
- Field `TX_BATT_BARS` returned 255 (unknown) — the watcher's rising-edge logic correctly skips this if implemented per v2.34.1

**Recovery steps:**

1. Replace the TX batteries (use lithium for accurate readings; alkaline returns 255)
2. Power-cycle the TX so the receiver re-reads battery info
3. Confirm the bar count in the receiver's own front panel matches the app

**Verification:** Bar count rises to 5/5 within 30 seconds of fresh batteries.

---

## §8. SDR spectrum monitor

### §8.1 SDR not detected after USB plug

**Symptom:** Plugged in the NESDR Smart dongle 10+ minutes ago. `/api/sdr/status` returns `disabled: true` or `dongle_detected: false`. Waterfall is blank.

**Likely causes:**
- `SDR_ENABLED` env var is not set to `auto` or `true`
- Probe interval hasn't elapsed yet (auto-detect probes every 5 minutes)
- DVB-USB kernel driver claimed the dongle (jump to §8.2)
- `rtl_power` binary not installed (`setup-sdr.sh` not run)

**Recovery steps:**

```bash
# 1. Confirm rtl-sdr tools are installed
which rtl_power rtl_test
# Expect: paths returned. If not, run: sudo bash scripts/setup-sdr.sh

# 2. Confirm SDR_ENABLED is set
grep SDR_ENABLED /home/ubuntu/Sports-Bar-TV-Controller/.env
# Expect: SDR_ENABLED=auto (or true)

# 3. Check kernel-level USB detection
lsusb | grep -i "realtek\|rtl"
# Expect: Bus XXX Device XXX: ID 0bda:2838 Realtek Semiconductor Corp. RTL2838 DVB-T

# 4. Confirm the device isn't claimed by DVB driver (§8.2)
lsmod | grep -E "dvb_usb|rtl28"
# Expect: NOTHING. If you see dvb_usb_rtl28xxu, jump to §8.2.

# 5. Direct probe — should report "Found 1 device(s)"
rtl_test -t 2>&1 | head -10

# 6. Force the app to re-probe immediately
curl -X POST http://localhost:3001/api/sdr/restart
```

**Verification:** `/api/sdr/status` returns `dongle_detected: true` and `watcher_running: true`. The waterfall on `/device-config → Audio → Wireless Mics → RF Spectrum Monitor` starts rendering within 1-2 minutes.

---

### §8.2 DVB-USB kernel driver grabbing the dongle (blacklist per setup-sdr.sh)

**Symptom:** `rtl_test` says "usb_claim_interface error -6" or "No supported devices found." `lsmod | grep dvb_usb` shows `dvb_usb_rtl28xxu` loaded.

**Likely causes:**
- Kernel's DVB-USB driver auto-claimed the dongle before rtl-sdr could (the #1 first-install failure)
- The blacklist file from `setup-sdr.sh` was never written, or was wiped by a kernel update

**Recovery steps:**

```bash
# 1. Confirm or create the blacklist file
cat /etc/modprobe.d/blacklist-rtl.conf 2>/dev/null
# Expect content like:
#   blacklist dvb_usb_rtl28xxu
#   blacklist rtl2832
#   blacklist rtl2830

# If missing or incomplete:
sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-sdr.sh
# (idempotent — safe to re-run)

# 2. Unload the DVB driver right now (don't wait for reboot)
sudo modprobe -r dvb_usb_rtl28xxu rtl2832 rtl2830 2>/dev/null || true

# 3. Re-test
rtl_test -t 2>&1 | head -10
# Expect: "Found 1 device(s)"

# 4. Force the SDR watcher to re-probe
curl -X POST http://localhost:3001/api/sdr/restart
```

**Verification:** Waterfall renders. `journalctl --since "5 min ago" | grep dvb` is empty (driver stayed unloaded).

---

### §8.3 Sweep frequency wrong (auto-band tracking issue)

**Symptom:** Waterfall shows activity at the wrong frequency range — e.g. operator added an H55 (514-558 MHz) Shure receiver but the SDR is still sweeping 470-514 MHz (G58 only).

**Likely causes:**
- `SDR_BAND_PRESET` is not `auto`
- `shureSlxdClientManager.getSnapshots()` returns no data so the auto-band fallback kicked in to a default
- Auto-band probe runs every 5 minutes — change hasn't propagated yet

**Recovery steps:**

```bash
# 1. Confirm the band preset
grep SDR_BAND_PRESET /home/ubuntu/Sports-Bar-TV-Controller/.env
# Expect: SDR_BAND_PRESET=auto (or absent — auto is the default)

# 2. Confirm Shure receivers are discoverable to the auto-band tracker
curl -s http://localhost:3001/api/shure-rf/status | head -50
# Expect: at least one receiver with channels listing real freqs

# 3. Force an immediate band re-evaluation
curl -X POST http://localhost:3001/api/sdr/restart

# 4. Override with explicit band if auto isn't right for some reason
# Edit .env:
#   SDR_BAND_PRESET=custom
#   SDR_BAND_START_MHZ=510
#   SDR_BAND_END_MHZ=560
# Then: pm2 delete + pm2 start (env var change — per CLAUDE.md Gotcha #2)
```

**Verification:** Waterfall x-axis covers the expected frequency range, and the cyan vertical lines (our Shure freqs) appear within the range.

---

## §9. Bartender remote (iPad / port 3002)

### §9.1 403 on /api/foo/ route (nginx allow-list per memory `feedback_nginx_allowlist_new_api_routes`)

**Symptom:** Bartender iPad gets HTTP 403 from an API call. React state stays empty. Banner/tile doesn't update. Same route works on port 3001.

**Likely causes:**
- The nginx allow-list on port 3002 doesn't include this `/api/foo/` route family. Bartender proxy intentionally restricts which routes the iPad can reach (admin pages return 403 by design)

**Recovery steps:**

```bash
# 1. Confirm the symptom
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/foo/test
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/foo/test
# 200 vs 403 = allow-list issue

# 2. Add the route to the nginx setup script
# Edit: /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-bartender-nginx.sh
# Add:
#   location /api/foo/ { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

# 3. Re-apply the live nginx config
sudo bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/setup-bartender-nginx.sh

# 4. Re-test
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/foo/test
# Expect: 200
```

**Verification:** iPad UI updates with live data. Add the script re-run step to `LOCATION_UPDATE_NOTES.md` so other locations pick it up on next update.

**Already-allowlisted families** (don't re-add): `/api/atlas/`, `/api/atlas-priority`, `/api/atlas-drops`, `/api/shure-rf`, `/api/sdr/`, `/api/audio-processor`, `/api/bartender/`, `/api/matrix/`, `/api/wolfpack/`, `/api/directv/`, `/api/firetv-devices`, `/api/ir/`, `/api/ir-devices`, `/api/globalcache/`, `/api/streaming/`, `/api/dmx/`, `/api/channel-presets`, `/api/sports-guide/`, `/api/schedules/bartender-schedule`, `/api/schedules/recovery`, `/api/htd/`, `/api/uploads/`, `/api/override-learn/`, `/api/soundtrack/`, `/api/tv-control/`, `/api/tv-discovery/`, `/api/devices/`, `/api/directv-devices`.

---

### §9.2 Layout zones/rooms not showing (BartenderLayout DB seed)

**Symptom:** Bartender remote Video tab loads but shows zero TVs / zero rooms / empty zone tabs.

**Likely causes:**
- `BartenderLayout` DB row was not seeded from `apps/web/data/tv-layout.json` after a fresh install
- Drizzle push silently failed on the `rooms` column (per CLAUDE.md Gotcha #6) — column missing, route throws, returns empty layout

**Recovery steps:**

```bash
# 1. Confirm the row exists and has data
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT id, length(zones) AS zones_bytes, length(rooms) AS rooms_bytes FROM BartenderLayout;"

# 2. Verify the column actually exists
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(BartenderLayout);"
# Expect: id, zones, rooms, tvPositions, professionalImageUrl, ...

# 3. If columns are missing, add them
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "ALTER TABLE BartenderLayout ADD COLUMN rooms TEXT DEFAULT '[]';"

# 4. Re-seed from the JSON file (the auto-seeder runs on empty tables only)
sqlite3 /home/ubuntu/sports-bar-data/production.db "DELETE FROM BartenderLayout;"
pm2 restart sports-bar-tv-controller
pm2 logs sports-bar-tv-controller --lines 30 | grep -i seed
# Expect: "[SEED] Seeded BartenderLayout from tv-layout.json"

# 5. Confirm the layout JSON has real data
wc -c /home/ubuntu/Sports-Bar-TV-Controller/apps/web/data/tv-layout.json
# Expect: >500 bytes. If 61 bytes, it's the empty template — restore from git history
```

**Verification:** Bartender remote Video tab shows TV tiles in the correct rooms, room filter tabs work.

---

### §9.3 Login redirects to admin pages

**Symptom:** Bartender logs in on iPad and is taken to `/system-admin` instead of `/remote`. Or the iPad shows an admin page they shouldn't be able to reach.

**Likely causes:**
- The user has an ADMIN role PIN when they should have STAFF
- Default landing page logic is wrong for STAFF users
- iPad somehow hit port 3001 directly instead of port 3002

**Recovery steps:**

```bash
# 1. Confirm which port the iPad is bookmarked to
# It MUST be port 3002 for the proxy restrictions to apply

# 2. Check the user's PIN role
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT pin, role FROM AuthPin;"

# 3. If STAFF PIN was assigned ADMIN, fix it
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE AuthPin SET role = 'STAFF' WHERE pin = '<staff-pin>';"

# 4. Reset session
# Clear iPad's cookies for the site, log in again
```

**Verification:** STAFF login lands on `/remote`, cannot navigate to `/system-admin` (returns 403).

---

## §10. Auth + PINs

### §10.1 Bartender PIN rejected

**Symptom:** Operator types the PIN and gets "Invalid PIN" no matter what they try.

**Likely causes:**
- `LOCATION_ID` not set in `.env` — every PIN attempt returns invalid because no `Location` row matches (see `docs/NEW_LOCATION_SETUP.md`)
- `Location` row missing in DB
- `AuthPin` rows missing (PIN never seeded)
- `AUTH_COOKIE_SECURE=true` on HTTP-only LAN — login appears to succeed but every subsequent request is unauthenticated (per CLAUDE.md "Auth bootstrap")

**Recovery steps:**

```bash
# 1. Confirm .env has LOCATION_ID
grep LOCATION_ID /home/ubuntu/Sports-Bar-TV-Controller/.env
# Expect: LOCATION_ID=<some-uuid-or-slug>

# 2. Confirm cookie setting
grep AUTH_COOKIE_SECURE /home/ubuntu/Sports-Bar-TV-Controller/.env
# On HTTP-only LAN deployments this MUST be: AUTH_COOKIE_SECURE=false

# 3. Confirm Location and AuthPin rows
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT id, name FROM Location;"
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT pin, role FROM AuthPin;"

# 4. If any of the above are missing, use the bootstrap script (idempotent)
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/bootstrap-new-location.sh \
  --name "Your Bar Name" \
  --admin-pin 7819 \
  --staff-pin 1234

# 5. Restart (delete+start since .env may have changed)
pm2 delete sports-bar-tv-controller
pm2 start ecosystem.config.js
```

**Verification:** PIN authentication works; operator can log in and reach the bartender remote.

---

### §10.2 Session cookie dropped (AUTH_COOKIE_SECURE=true on HTTP)

**Symptom:** Login shows "Success" but the very next page load is unauthenticated. Looks like the session never started.

**Likely causes:**
- `AUTH_COOKIE_SECURE=true` plus an HTTP (not HTTPS) origin → browser silently drops the cookie (it requires HTTPS to honor `Secure`)

**Recovery steps:**

```bash
# 1. Force secure=false for LAN HTTP
sed -i 's/^AUTH_COOKIE_SECURE=.*/AUTH_COOKIE_SECURE=false/' /home/ubuntu/Sports-Bar-TV-Controller/.env

# 2. delete+start (env change)
pm2 delete sports-bar-tv-controller
pm2 start ecosystem.config.js
```

**Verification:** Login persists across page loads.

---

### §10.3 New PIN setup

**Symptom:** Operator wants to add a new PIN for a new staff member.

**Recovery steps:**

```bash
# Use the bootstrap script with the new PIN (it's idempotent and just adds rows)
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/bootstrap-new-location.sh \
  --staff-pin 5678

# Or insert directly
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "INSERT INTO AuthPin (pin, role) VALUES ('5678', 'STAFF');"
```

**Verification:** New PIN logs in and lands on `/remote`.

---

## §11. AI Hub specifics

### §11.1 Chat returns generic "I don't know" — RAG empty

**Symptom:** AI Hub chat won't answer any question, returns boilerplate "I don't have information about that." `GET /api/rag/stats` shows 0 documents or 0 chunks.

**Likely causes:**
- Vector store was wiped but never re-scanned
- `npm run rag:scan` was run but errored mid-way

**Recovery steps:** Run §1.4 (full rebuild).

**Verification:** Chat answers a known-good question (e.g. "What is outputOffset?") with a reference to CLAUDE.md.

---

### §11.2 Pattern Digest times out (Ollama saturated)

**Symptom:** `POST /api/shure-rf/pattern-digest` returns 504 or times out after 300s. AI Suggest in the scheduler also slow.

**Likely causes:**
- Another inference is in progress (long context, large model) — Ollama serializes requests by default
- iGPU is wedged (jump to §1.5)
- Pattern Digest is being run against an enormous event window (30+ days with thousands of events) — context exceeds practical Ollama limits on llama3.1:8b

**Recovery steps:**

```bash
# 1. Confirm no other inference is queued
curl -s http://localhost:11434/api/ps

# 2. Restart Ollama to clear any wedged state
sudo systemctl restart ollama-ipex

# 3. Re-run with a smaller window (default is 30 days; try 7)
curl -X POST http://localhost:3001/api/shure-rf/pattern-digest \
  -H "Content-Type: application/json" \
  -d '{"daysAgo":7}'
```

**Verification:** Digest returns within 90-200 seconds for a 7-day window, 180s+ for 30-day on `llama3.1:8b`.

---

### §11.3 Re-scan after major doc updates

**Symptom:** Recently added new docs (e.g. this playbook) but AI Hub doesn't surface them.

**Recovery steps:**

```bash
# Incremental scan — adds new/changed docs without nuking the store
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run rag:scan

# Verify count went up
curl -s http://localhost:3001/api/rag/stats
```

**Verification:** New docs surface in chat answers. Ask AI Hub a question whose answer is only in the new doc.

---

### §11.4 Vector store wrote to wrong path (chdir before import gotcha)

**Symptom:** Two vector store files exist — one in the expected location and one elsewhere — and the API loads from the empty one. Or the store appears empty but a `.bin` file with thousands of vectors lives in `apps/web/.next/cache/`.

**Likely causes:**
- A script imported `packages/rag-server` from a non-repo-root cwd; the store's default relative path landed in whatever directory the script started from

**Recovery steps:**

```bash
# 1. Find all vector store files
find /home/ubuntu/Sports-Bar-TV-Controller -name "vector-store*.bin" -o -name "embeddings*.json" 2>/dev/null

# 2. Identify the expected path (defined in packages/rag-server)
grep -rn "vector-store\|VECTOR_STORE_PATH" packages/rag-server/src/ | head -10

# 3. If a misplaced file exists, move it to the expected location
# (or just nuke and rescan — usually faster than untangling)
npm run rag:scan:clear
```

**Verification:** `/api/rag/stats` returns non-zero, and only ONE vector store file exists in the expected location.

---

## §12. Per-location quick references

Per-location IPs, ports, and quirks live in `.claude/locations/<branch>.md` — those are the authoritative source. The notes below are quick recovery pointers only.

### Holmgren Way (`location/holmgren-way`)

- **Network:** 10.11.3.x
- **Hardware:** 24 Samsung TVs (10.11.3.1–27), 4 Spectrum cable boxes (iTach at .40/.41), 6 DirecTV receivers (.42–.47:8080), 3 Fire Cubes (.49/.50/.51), Wolf Pack 48-port matrix, Atlas AZM8 (firmware 4.5+), Shure SLX-D receiver
- **Rooms:** Main Bar, UpStairs, Pavillion, Party Room/Patio (4 rooms, 31 zones)
- **Common gotchas:**
  - Outputs 37-40 are **audio-only** (don't try to route video there)
  - TV 19 (10.11.3.19, UN65NU6950) — REST API hangs, use DLNA port 9197
  - Fire Cubes at .48 and .49 are on the **replacement list** — ADB errors are hardware, not code
  - Atlas firmware 4.5 → check Custom Priority Volume before debugging drop watcher (§3.2)
  - Atlas multi-card Wolf Pack 48-port → verify `outputOffset` against canonical wiring (§2.2)
- **Auth:** Admin PIN 7819, Staff PIN 1111, `AUTH_COOKIE_SECURE=false`
- **Ollama:** `llama3.1:8b` on Iris Xe iGPU via IPEX-LLM

### Graystone (`location/graystone`)

- **Hardware:** Wolf Pack WP-36X36, **multi-card** layout with `outputOffset=+32` for the audio card
- **Common gotchas:**
  - `outputOffset=32` is correct for THIS chassis (multi-card) — do NOT enforce 0 via `MATRIX_SINGLE_CARD=true`
  - Comment in `packages/wolfpack/src/wolfpack-matrix-service.ts:275` documents the offset

### Lucky's 1313 (`location/lucky-s-1313`)

- **Hardware:** Wolf Pack WP-36X36 **single-card**, dbx ZonePRO 1260m at 192.168.10.50
- **Common gotchas:**
  - `outputOffset` MUST be 0 — enforced via `MATRIX_SINGLE_CARD=true` in `.env`
  - `audioOutputCount` is 0 (audio is via the ZonePRO, not Wolf Pack outputs)
  - ZonePRO needs Scene 1 auto-recall on connect (§3.4) — failsafe-mode source shift otherwise

### Stoneyard Greenville / Stoneyard Appleton

- **Hardware:** Wolf Pack (Greenville is WP-36X36; both **multi-card**)
- **Common gotchas:** `outputOffset` is per-card; check `.claude/locations/<branch>.md` for canonical values before touching

### Leg Lamp (`location/leg-lamp`)

- **Hardware:** Wolf Pack **single-card**
- **Common gotchas:** `outputOffset` MUST be 0 (enforced via `MATRIX_SINGLE_CARD=true`)

---

## Appendix: When to escalate

If you have run the relevant section's Recovery steps twice and the symptom persists:

1. Collect diagnostics:

```bash
pm2 status > /tmp/diag.txt
pm2 logs sports-bar-tv-controller --lines 200 >> /tmp/diag.txt
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;" >> /tmp/diag.txt
df -h >> /tmp/diag.txt
free -h >> /tmp/diag.txt
ip addr show >> /tmp/diag.txt
systemctl status ollama-ipex >> /tmp/diag.txt
journalctl -u ollama-ipex --since "30 min ago" | tail -50 >> /tmp/diag.txt
```

2. Note the section number you followed and the exact symptom that persisted.

3. Contact the system admin with `/tmp/diag.txt` attached.

4. Use physical remotes for any urgent operator need while waiting — do not block service on technical recovery.

---

## Cross-references

- **CLAUDE.md** — Common Gotchas §1–§10, Standing Rules, hardware layer architecture
- **docs/TROUBLESHOOTING_GUIDE.md** — Generic device troubleshooting (predates this playbook)
- **docs/OPERATIONS_PLAYBOOK.md** — Daily opening/closing/game-day procedures (operator-facing)
- **docs/HARDWARE_CONFIGURATION.md** — Hardware reference (IPs, ports, models)
- **docs/FAQ.md** — Operator-friendly Q&A
- **docs/VERSION_SETUP_GUIDE.md** — Per-version manual steps and Known Errors & Fixes
- **docs/NEW_LOCATION_SETUP.md** — Fresh-install runbook (auth bootstrap, JSON seeds, env)
- **docs/FLEET_STATUS.md** — Per-location OS / app version / iGPU / outstanding work
- **packages/atlas/README.md** — Atlas AZM8 protocol, ports, gotchas
- **packages/shure-slxd/README.md** — Shure SLX-D protocol, interference detection, RF cheatsheet
- **packages/wolfpack/README.md** — Wolf Pack matrix models, protocol, gotchas
- **packages/dbx-zonepro/README.md** — ZonePRO failsafe-mode auto-recall
- **packages/firecube/README.md** — Fire TV ADB control, gotchas
- **packages/directv/README.md** — DirecTV SHEF API
- **packages/ir-control/README.md** — IR learning, Spectrum cable box catalog

---

**End of Operations Recovery Playbook**
