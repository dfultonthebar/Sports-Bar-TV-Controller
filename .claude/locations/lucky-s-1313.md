# Lucky's 1313 Hardware Reference

**Branch:** `location/lucky-s-1313`
**Status:** Active — has its own installation

DB is the source of truth — see CLAUDE.md §6 (Device Data Migration) and `apps/web/src/lib/device-db.ts`. Values below mirror the DB as a quick reference; if they drift, trust the DB.

## Matrix — CRITICAL outputOffset enforcement

- **Wolf Pack WP-36X36** — **SINGLE-CARD** chassis. ONE card fills all 36 outputs.
- **`outputOffset` MUST be `0`** (enforced). Per CLAUDE.md §4:

| Location | Model | Layout | outputOffset | audioOutputCount | Notes |
|---|---|---|---|---|---|
| Lucky's 1313 | Wolf Pack WP-36X36 | **Single-card** | **0 (enforced)** | **0** | Audio via dbx ZonePRO 1260m @ 192.168.10.50 |

- **Enforcement mechanism:** `MATRIX_SINGLE_CARD=true` is set in this location's
  `.env`. When that flag is true, `scripts/verify-install.sh`'s `matrix_config`
  layer FAILS the install if `outputOffset != 0`, rolling back the
  auto-update before bad values can ship. This guard was added April 2026 in
  response to the incident described below.
- **Audio routing does NOT go through the Wolf Pack** at Lucky's —
  `audioOutputCount = 0`. All audio is handled by the dbx ZonePRO 1260m
  audio processor at `192.168.10.50` (TCP 3804, HiQnet protocol). The Wolf
  Pack carries video only.

## Audio Processor

| Device | IP | Port | Notes |
|---|---|---|---|
| dbx ZonePRO 1260m | 192.168.10.50 | TCP 3804 | All audio routing + zone DSP. Scene 1 auto-recall on connect required (CLAUDE.md §7 — failsafe-mode source-shift fix). |

## Source Devices

Refer to DB tables `DirecTVDevice`, `FireTVDevice`, `IRDevice`, `CableBox`
for the current per-device IPs + ports. Seed JSONs at `apps/web/data/*.json`
are committed on this branch and reseed on first run if the DB is empty
(see `apps/web/src/lib/seed-from-json.ts`).

## Sports Guide Configuration

- Has its own Rail Media configuration for channel sync.
- Channel numbers differ from Graystone (different cable market).
- Needs its own `SPORTS_GUIDE_USER_ID` in `.env`.
- Local RSN channel mappings in
  `apps/web/src/app/api/sports-guide/live-by-channel/route.ts`
  (`NETWORK_TO_CABLE` + `NETWORK_TO_DIRECTV` dicts). ESPN names like
  "FanDuel SN WI" / "Bucks.TV" map to Lucky's local cable/satellite
  channel numbers — verify after any merge from main.

## Incident History — why MATRIX_SINGLE_CARD is enforced

Lucky's 1313 shipped in **April 2026** with `outputOffset = 26` on this
single-card WP-36X36. The auto-update verifier did not yet have the
single-card check; every "output 1" routing request was silently
landing on physical output 27 for weeks. Operators saw confused
routing behavior with no error logs. Caught + corrected via the
new env-flag-driven `MATRIX_SINGLE_CARD=true` enforcement.

The check was deliberately scoped to LOCATIONS THAT OPT IN (not all
WP-36X36 chassis) because some — like Graystone's WP-36X36 — are
multi-card and legitimately use non-zero offsets. Lucky's `.env`
declares itself single-card via the env flag.

**If you re-cable Lucky's to multi-card in the future:** remove
`MATRIX_SINGLE_CARD=true` from `.env`, update CLAUDE.md §4's row for
Lucky's, and update this file. Otherwise verify-install will block
every future auto-update.

## Pulling Latest Updates

```bash
git checkout location/lucky-s-1313
git merge main
# On conflict with data files (wolfpack-devices.json, etc.) → keep Lucky's version:
#   git checkout --ours apps/web/data/wolfpack-devices.json
#   git checkout --theirs package-lock.json package.json
npm ci
npx drizzle-kit push --config drizzle.config.ts  # create any new DB tables
npm run build && pm2 restart sports-bar-tv-controller --update-env
```

Prefer `bash scripts/auto-update.sh --triggered-by=manual_cli` — it
handles the conflict resolution + verify gate automatically.

### After Merging Main (post-April 2026)

1. **Live Channel Mappings:** Update `NETWORK_TO_CABLE` and
   `NETWORK_TO_DIRECTV` in
   `apps/web/src/app/api/sports-guide/live-by-channel/route.ts` with
   Lucky's local channel numbers for regional sports networks (RSNs).
2. **Wolf Pack:** Single-card — leave it alone. Do NOT add multi-chassis
   config. If physical layout changes, see "Incident History" above.
3. **DirecTV Devices:** Ensure DB has Lucky's DirecTV receiver IPs +
   ports. Re-seeds from `apps/web/data/directv-devices.json` if DB is empty.
4. **Ollama:** Verify `llama3.1:8b` + `nomic-embed-text` are pulled
   per Standing Rule 10 (CLAUDE.md). Run
   `sg ollama -c 'ollama pull llama3.1:8b nomic-embed-text qwen2.5:14b'`.

## Per-Location Notes

- **Auth bootstrap:** `LOCATION_ID` set in `.env`; STAFF/ADMIN PINs
  seeded via `scripts/bootstrap-new-location.sh`.
- **Audio architecture:** dbx ZonePRO 1260m handles ALL audio zones;
  Wolf Pack carries video only. Do NOT try to route audio via Wolf Pack
  here — there are no audio outputs configured.
- **Single-card matrix:** `MATRIX_SINGLE_CARD=true` env flag is the
  source of truth for the install-verifier check.

## Cross-References

- CLAUDE.md §4 — Matrix Config Per-Location Values (CRITICAL — outputOffset)
- CLAUDE.md §7 — dbx ZonePRO Scene 1 auto-recall
- `docs/EQUIPMENT_SETUP_PLAYBOOK.md` §2 (Wolf Pack) + §7 (dbx ZonePRO)
- `docs/OPERATIONS_RECOVERY_PLAYBOOK.md` §2 (Wolf Pack troubleshooting)
- `docs/runbooks/MATRIX_INPUT_SWITCH.md` — per-location switching procedure
- `apps/web/src/instrumentation.ts` — startup-time MATRIX-CONFIG warning
  if a single-card model has non-zero offset
- `scripts/verify-install.sh` — the install gate that catches bad offsets
