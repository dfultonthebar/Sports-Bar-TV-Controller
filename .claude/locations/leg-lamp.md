# Leg Lamp Hardware Reference

**Branch:** `location/leg-lamp`
**Status:** Active — single-card Wolf Pack matrix, smaller install
**Special role:** Recommended canary location for `auto-update.sh` (Phase 3) — see `scripts/canary-config.json`

DB is the source of truth — see CLAUDE.md §6 (Device Data Migration) and `apps/web/src/lib/device-db.ts`. Values below mirror the DB as a quick reference; if they drift, trust the DB.

## Matrix — CRITICAL outputOffset enforcement

- **Wolf Pack** — **SINGLE-CARD** chassis. ONE card fills all outputs.
- **`outputOffset` MUST be `0`** (enforced). Per CLAUDE.md §4:

| Location | Model | Layout | outputOffset | audioOutputCount | Notes |
|---|---|---|---|---|---|
| Leg Lamp | Wolf Pack | **Single-card** | **0 (enforced)** | **0** | |

- **Enforcement mechanism:** `MATRIX_SINGLE_CARD=true` is set in this
  location's `.env`. When that flag is true, `scripts/verify-install.sh`'s
  `matrix_config` layer FAILS the install if `outputOffset != 0`, rolling
  back the auto-update before bad values can ship. Same protection Lucky's
  has.
- **Audio routing does NOT go through the Wolf Pack** (`audioOutputCount = 0`).
  If audio is needed, it routes through whatever DSP is on-site (verify in
  DB at the location — Atlas / dbx / BSS are the supported options).

## Canary role (auto-update Phase 3)

This box is the **first to receive new versions** in the fleet's staged
rollout. Per `scripts/canary-config.json`, when canary mode is enabled:

1. Auto-update at Leg Lamp runs first on its normal cron schedule
2. After a successful run, a `.canary-blessed.json` sidecar is written to
   the repo + pushed to GitHub
3. Other locations' auto-update gates on the presence + freshness of that
   blessing — refuses to merge a version until canary has signed off
4. If Leg Lamp's verify-install FAILS, the bad version is rolled back AND
   the canary blessing is NOT written → other locations skip that version

**Operator impact:** if Leg Lamp's auto-update is stuck or its blessing
sidecar is stale, the rest of the fleet WILL not auto-update — that's by
design. Check `https://github.com/dfultonthebar/Sports-Bar-TV-Controller/blob/main/.canary-blessed.json`
when other locations report "waiting on canary".

## Per-location operational facts

| Field | Value | Source |
|---|---|---|
| OS | Ubuntu 24.04 (noble) | docs/FLEET_STATUS.md |
| Kernel | 6.8.0-111 | docs/FLEET_STATUS.md |
| Software version | v2.32.94 (snapshot — fleet-wide) | docs/FLEET_STATUS.md |
| Bartender proxy | Nginx (port 3002 → 3001) | docs/FLEET_STATUS.md |
| AI Suggest backend | IPEX-LLM Ollama (Iris Xe) | docs/FLEET_STATUS.md |
| AI Suggest cold-run timing | ~100s on llama3.1:8b (fleet average) | docs/FLEET_STATUS.md |
| Smaller install | Fewer TVs, fewer source devices vs other locations | implied by single-card matrix |

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

## Pulling Latest Updates

Prefer `bash scripts/auto-update.sh --triggered-by=manual_cli` — handles
the conflict resolution, schema push, cache bust, PM2 restart, and verify
gate automatically. **Especially important here** since Leg Lamp's run
gates the rest of the fleet.

Manual fallback:
```bash
git checkout location/leg-lamp
git fetch origin
git merge origin/main
# On conflict with data files → keep Leg Lamp's version:
#   git checkout --ours apps/web/data/<file>
#   git checkout --theirs package-lock.json package.json
npm ci
npx drizzle-kit push --config drizzle.config.ts
npm run build && pm2 restart sports-bar-tv-controller --update-env
```

### After Merging Main (post-April 2026)

1. **Wolf Pack:** Single-card — leave it alone. `MATRIX_SINGLE_CARD=true`
   stays set. Verify-install will gate on `outputOffset=0` automatically.
2. **Ollama models:** Verify `llama3.1:8b` + `nomic-embed-text` are current
   per Standing Rule 10. Use `sg ollama -c 'ollama pull <model>'` if the
   user needs to be in the `ollama` group.
3. **Canary blessing:** Confirm `.canary-blessed.json` was written +
   pushed after the auto-update completes — if not, other locations are
   stuck waiting on this box.

## Per-Location Notes

- **Auth bootstrap:** `LOCATION_ID` set in `.env`; STAFF/ADMIN PINs seeded
  via `scripts/bootstrap-new-location.sh`.
- **Single-card matrix:** `MATRIX_SINGLE_CARD=true` env flag is the source
  of truth for the install-verifier check.
- **Canary opt-in:** Configured via `scripts/canary-config.json` — when
  enabled, other locations gate auto-update on this branch's
  `.canary-blessed.json`. To disable canary mode (e.g. for a known-bad
  ship that needs to skip Leg Lamp), comment out the entry there.
- **Bartender remote:** Nginx proxy on port 3002 → Next.js 3001,
  restricted via `scripts/setup-bartender-nginx.sh` allow-list.

## Cross-References

- CLAUDE.md §4 — Matrix Config Per-Location Values (CRITICAL — outputOffset)
- CLAUDE.md §6 — Device Data Migration (JSON → DB)
- `docs/EQUIPMENT_SETUP_PLAYBOOK.md` §2 (Wolf Pack) + §1 (new-location bootstrap)
- `docs/OPERATIONS_RECOVERY_PLAYBOOK.md` §2 (Wolf Pack troubleshooting)
- `docs/runbooks/MATRIX_INPUT_SWITCH.md` — per-location switching procedure
- `docs/AUTO_UPDATE_SYSTEM_PLAN.md` + `scripts/canary-config.json` — canary mechanism
- `docs/FLEET_STATUS.md` — current OS/version/iGPU status
- `scripts/verify-install.sh` — the install gate
- `.claude/locations/lucky-s-1313.md` — the other single-card location (similar setup)
