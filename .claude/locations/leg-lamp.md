# Leg Lamp Hardware Reference

**Branch:** `location/leg-lamp`
**Status:** Single-card Wolf Pack matrix, smaller install. Recommended canary location for `auto-update.sh` (Phase 3 — see `scripts/canary-config.json`).

## Matrix Config

- **Wolf Pack:** **Single-card** chassis. `MatrixConfiguration.outputOffset` MUST be `0` — enforced by `verify-install.sh` when `MATRIX_SINGLE_CARD=true` is set in `.env`.
- **Audio outputs:** 0 from the matrix (audio routes via DSP if any).

## Source / Display / Audio Devices

> Stub — populate from the live DB the first time Claude works at this location:
>
> ```bash
> sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name, ipAddress FROM FireTVDevice ORDER BY name; SELECT '---'; SELECT name, ipAddress FROM DirecTVDevice ORDER BY name;"
> ```

| Device | Type | IP | Port | Notes |
|---|---|---|---|---|
| (TBD) | | | | |

## Per-Location Notes

- **Auth bootstrap:** `LOCATION_ID` set in `.env`. PINs seeded via `scripts/bootstrap-new-location.sh`.
- **Canary candidate:** opt in via `scripts/canary-config.json` — when enabled, other locations gate their auto-update on this branch's `.canary-blessed.json`.
