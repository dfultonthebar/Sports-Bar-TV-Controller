# Stoneyard Appleton Hardware Reference

**Branch:** `location/stoneyard-appleton`
**Status:** Active — has its own installation
**Fleet rank:** fleet-best AI Suggest timing (67s on iGPU — see FLEET_STATUS.md)

DB is the source of truth — see CLAUDE.md §6 (Device Data Migration) and `apps/web/src/lib/device-db.ts`. Values below mirror the DB as a quick reference; if they drift, trust the DB.

## Matrix — control protocol is TCP (not HTTP)

- **`MatrixConfiguration.protocol` = `TCP`** (port 5000), set 2026-06-11. Routes via
  `sendTCPCommand` (1-based `{in}X{out}.` SET) like Holmgren Way — NOT the HTTP `o2ox`
  toggle (which disconnects an already-set output when re-sent → TV black). TCP is a
  plain SET, no PHP session, no password at Stoneyard. See
  `docs/WOLFPACK_HTTP_API_REFERENCE.md` + [[feedback-wolfpack-tcp-not-http-routing]].
- Config read fresh per route (no cache) → flip took effect with no restart.
  **Rollback:** `sqlite3 .../production.db "UPDATE MatrixConfiguration SET
  protocol='HTTP' WHERE name LIKE 'Stoneyard Appleton';"`

## Matrix — outputOffset is PER-CARD

- **Wolf Pack** — **MULTI-CARD** chassis. `outputOffset` value depends on physical wiring.
- Per CLAUDE.md §4:

| Location | Model | Layout | outputOffset | audioOutputCount | Notes |
|---|---|---|---|---|---|
| Stoneyard Appleton | Wolf Pack | **Multi-card** | Per card | **4** | |

- **Audio outputs:** 4 audio outputs from the matrix (separate from video).
- **`MATRIX_SINGLE_CARD` MUST NOT be set** in this location's `.env` —
  the env-flag-driven check in `scripts/verify-install.sh` only enforces
  `outputOffset=0` for single-card opt-ins. Setting the flag here would
  falsely fail every install.

## Per-location operational facts

| Field | Value | Source |
|---|---|---|
| OS | Ubuntu 24.04 (noble) | docs/FLEET_STATUS.md |
| Kernel | 6.8.0-111 | docs/FLEET_STATUS.md |
| Software version | v2.32.94 (snapshot — fleet-wide) | docs/FLEET_STATUS.md |
| Bartender proxy | Nginx (port 3002 → 3001) | docs/FLEET_STATUS.md |
| AI Suggest backend | IPEX-LLM Ollama (Iris Xe) | docs/FLEET_STATUS.md |
| AI Suggest cold-run timing | **67.3s** on llama3.1:8b — **FLEET BEST** | docs/FLEET_STATUS.md |
| Intel package set | Pre-installed (OS upgrade was mostly just the kernel jump) | docs/OS_UPGRADE_OPERATOR_PROMPT.md |

## Source / Display / Audio Devices

> Populate from the live DB the next time work is being done at this location:
>
> ```bash
> sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
> .headers on
> .mode column
> SELECT name, ipAddress, port FROM FireTVDevice ORDER BY name;
> SELECT '---' as separator;
> SELECT name, ipAddress, port FROM DirecTVDevice ORDER BY name;
> SELECT '---' as separator;
> SELECT name, ipAddress, port FROM IRDevice ORDER BY name;
> SELECT '---' as separator;
> SELECT name, ipAddress, port FROM AudioProcessor;
> SQL
> ```

Once the values are filled in, replace this section with tables matching
the `.claude/locations/graystone.md` and `.claude/locations/holmgren-way.md`
layout.

## Known operational quirks

- **Power cycle quirk (per `docs/NEW_LOCATION_CLAUDE_PROMPT.md`):** discovered
  the hard way at Appleton — after a power cycle, certain state needs to be
  manually re-bootstrapped. See that doc for the specifics + the recovery
  steps. (Watch for this on any unexpected reboot.)

## Pulling Latest Updates

Prefer `bash scripts/auto-update.sh --triggered-by=manual_cli` — handles
the conflict resolution, schema push, cache bust, PM2 restart, and verify
gate automatically.

Manual fallback:
```bash
git checkout location/stoneyard-appleton
git fetch origin
git merge origin/main
# On conflict with data files → keep Appleton's version:
#   git checkout --ours apps/web/data/<file>
#   git checkout --theirs package-lock.json package.json
npm ci
npx drizzle-kit push --config drizzle.config.ts
npm run build && pm2 restart sports-bar-tv-controller --update-env
```

### After Merging Main (post-April 2026)

1. **Live Channel Mappings:** Verify `NETWORK_TO_CABLE` / `NETWORK_TO_DIRECTV`
   in `apps/web/src/app/api/sports-guide/live-by-channel/route.ts` still has
   Appleton's local channel numbers for RSNs.
2. **Wolf Pack:** Multi-card — leave the per-card `outputOffset` values
   alone. Do NOT set `MATRIX_SINGLE_CARD=true`.
3. **Ollama models:** Verify `llama3.1:8b` + `nomic-embed-text` are current
   per Standing Rule 10. Use `sg ollama -c 'ollama pull <model>'` if the
   user needs to be in the `ollama` group.
4. **RAG re-scan:** After significant doc updates, run
   `npx tsx scripts/scan-system-docs.ts` (~25-40 min on iGPU) so the AI Hub
   stays current.

## Per-Location Notes

- **Auth bootstrap:** `LOCATION_ID` set in `.env`; STAFF/ADMIN PINs seeded
  via `scripts/bootstrap-new-location.sh`.
- **Multi-card matrix:** `MATRIX_SINGLE_CARD` is NOT set in `.env`.
- **Bartender remote:** Nginx proxy on port 3002 → Next.js 3001,
  restricted via `scripts/setup-bartender-nginx.sh` allow-list.
- **Fast iGPU:** This box has the fleet's fastest AI Suggest timing.
  When debugging AI-pipeline performance regressions, this is the box to
  compare against (regression here = real perf bug, not just thermal).

## Cross-References

- CLAUDE.md §4 — Matrix Config Per-Location Values
- CLAUDE.md §6 — Device Data Migration (JSON → DB)
- `docs/EQUIPMENT_SETUP_PLAYBOOK.md` §2 (Wolf Pack)
- `docs/OPERATIONS_RECOVERY_PLAYBOOK.md` §2 (Wolf Pack troubleshooting)
- `docs/runbooks/MATRIX_INPUT_SWITCH.md` — per-location switching procedure
- `docs/FLEET_STATUS.md` — current OS/version/iGPU status + per-location
  AI Suggest timings
- `docs/NEW_LOCATION_CLAUDE_PROMPT.md` — Appleton power-cycle gotcha
- `scripts/verify-install.sh` — the install gate
