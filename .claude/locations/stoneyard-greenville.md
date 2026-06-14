# Stoneyard Greenville Hardware Reference

**Branch:** `location/stoneyard-greenville`
**Status:** Active — has its own installation
**Fleet rank:** historically the most-neglected box; receives extra attention on upgrades

DB is the source of truth — see CLAUDE.md §6 (Device Data Migration) and `apps/web/src/lib/device-db.ts`. Values below mirror the DB as a quick reference; if they drift, trust the DB.

## Matrix — control protocol is TCP (not HTTP)

- **`MatrixConfiguration.protocol` = `TCP`** (port 5000), set 2026-06-11. Routes
  via `sendTCPCommand` (1-based `{in}X{out}.` SET) like Holmgren Way — NOT the HTTP
  `o2ox` toggle. **Why:** HTTP routing used the `o2ox` toggle, which disconnects an
  already-set output when re-sent (Video-tab read racing a scheduler write → TV goes
  black). TCP is a plain SET with no toggle, no PHP session, no password at Stoneyard.
  This is the proven Holmgren approach; see `docs/WOLFPACK_HTTP_API_REFERENCE.md`
  ("TCP to switch + HTTP o2o to verify") and [[feedback-wolfpack-tcp-not-http-routing]].
- Config is read fresh from DB per route (no cache), so the flip took effect with no
  restart. **Rollback if TCP ever misbehaves:** `sqlite3 .../production.db "UPDATE
  MatrixConfiguration SET protocol='HTTP' WHERE name LIKE 'Stoneyard Greenville';"`
- The v2.55.73 per-IP HTTP session mutex still applies — HTTP is used to READ/verify
  route state for the bartender Video tab even when switching over TCP.

## Matrix — outputOffset is PER-CARD

- **Wolf Pack WP-36X36** — **MULTI-CARD** chassis. `outputOffset` value depends on physical wiring.
- Per CLAUDE.md §4:

| Location | Model | Layout | outputOffset | audioOutputCount | Notes |
|---|---|---|---|---|---|
| Stoneyard Greenville | Wolf Pack WP-36X36 | **Multi-card** | Per card | **4** | |

- **Audio outputs:** 4 audio outputs from the matrix (separate from video).
- **`MATRIX_SINGLE_CARD` MUST NOT be set** in this location's `.env` — the env-flag-driven check in `scripts/verify-install.sh` only enforces `outputOffset=0` for single-card opt-ins. Multi-card locations accept the value the operator wired in. Setting the flag here would falsely fail every install.

## Per-location operational facts

| Field | Value | Source |
|---|---|---|
| OS | Ubuntu 24.04 (noble) | docs/FLEET_STATUS.md |
| Kernel | 6.8.0-111 | docs/FLEET_STATUS.md |
| Software version | v2.32.94 (snapshot — fleet-wide) | docs/FLEET_STATUS.md |
| Bartender proxy | Nginx (port 3002 → 3001) | docs/FLEET_STATUS.md |
| AI Suggest backend | IPEX-LLM Ollama (Iris Xe) | docs/FLEET_STATUS.md |
| AI Suggest cold-run timing | **119s** on llama3.1:8b (fleet average, slower than Appleton's 67s but faster than Graystone's 170s) | docs/FLEET_STATUS.md |
| OS upgraded | 2026-05-08 from jammy → noble | docs/LOCATION_UPDATE_NOTES.md |

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
> SELECT name, ipAddress, port, audioMessages FROM AudioProcessor;
> SQL
> ```

Once the values are filled in, replace this section with tables matching the
`.claude/locations/graystone.md` and `.claude/locations/holmgren-way.md`
layout (Source Devices / Display Devices / Audio + Lighting).

## Known operational quirks

- **Frozen Four bartender-scheduling incident (April 2026):**
  See `docs/SCHEDULER_FIXES_APRIL_2026.md`. A Wisconsin Badgers Frozen Four
  game scheduled here exposed three related auto-reallocator + channel-guide
  bugs (TV stranded on ESPN2 after the game ended; Brewers games missing
  from channel guide; HomeTeam table empty so prioritization fell back to
  ESPN rank). All fixed in that document's referenced commits.
- **`outputDefaults` and `roomDefaults` empty `{}`** as of 2026-04-10 —
  auto-reallocator still tunes cable boxes back to default channels (covers
  the bartender's primary concern) but won't re-route TVs to a different
  source. To get full revert behavior (TVs flip back to Atmosphere after a
  game), populate via the default-sources settings UI.
- **HomeTeam table empty** as of 2026-04-10 — AI scheduler still works
  (returns games + sets channels) but home-team prioritization (Packers /
  Bucks / Brewers / Badgers) is degraded. Configure when convenient.

## Pulling Latest Updates

Prefer `bash scripts/auto-update.sh --triggered-by=manual_cli` — handles
the conflict resolution, schema push, cache bust, PM2 restart, and verify
gate automatically.

Manual fallback:
```bash
git checkout location/stoneyard-greenville
git fetch origin
git merge origin/main
# On conflict with data files → keep Greenville's version:
#   git checkout --ours apps/web/data/<file>
#   git checkout --theirs package-lock.json package.json
npm ci
npx drizzle-kit push --config drizzle.config.ts
npm run build && pm2 restart sports-bar-tv-controller --update-env
```

### After Merging Main (post-April 2026)

1. **Live Channel Mappings:** Verify `NETWORK_TO_CABLE` / `NETWORK_TO_DIRECTV`
   in `apps/web/src/app/api/sports-guide/live-by-channel/route.ts` still has
   Greenville's local channel numbers for RSNs.
2. **Wolf Pack:** Multi-card — leave the per-card `outputOffset` values
   alone. Do NOT set `MATRIX_SINGLE_CARD=true`.
3. **Ollama models:** Verify `llama3.1:8b` + `nomic-embed-text` are current
   per Standing Rule 10 (CLAUDE.md). Use `sg ollama -c 'ollama pull <model>'`
   if the user needs to be in the `ollama` group.
4. **RAG re-scan:** After significant doc updates, run
   `npx tsx scripts/scan-system-docs.ts` (~25-40 min on iGPU) so the AI Hub
   stays current.

## Per-Location Notes

- **Auth bootstrap:** `LOCATION_ID` set in `.env`; STAFF/ADMIN PINs seeded
  via `scripts/bootstrap-new-location.sh`.
- **Multi-card matrix:** `MATRIX_SINGLE_CARD` is NOT set in `.env`.
- **Bartender remote:** Nginx proxy on port 3002 → Next.js 3001,
  restricted via `scripts/setup-bartender-nginx.sh` allow-list.
- **Bulk-power fix:** v2.32.18 changed toggle to use fleet majority rather
  than Samsung-only probe (Greenville was the trigger).

## Cross-References

- CLAUDE.md §4 — Matrix Config Per-Location Values
- CLAUDE.md §6 — Device Data Migration (JSON → DB)
- `docs/EQUIPMENT_SETUP_PLAYBOOK.md` §2 (Wolf Pack)
- `docs/OPERATIONS_RECOVERY_PLAYBOOK.md` §2 (Wolf Pack troubleshooting)
- `docs/runbooks/MATRIX_INPUT_SWITCH.md` — per-location switching procedure
- `docs/SCHEDULER_FIXES_APRIL_2026.md` — the Frozen Four incident
- `docs/FLEET_STATUS.md` — current OS/version/iGPU status
- `scripts/verify-install.sh` — the install gate
