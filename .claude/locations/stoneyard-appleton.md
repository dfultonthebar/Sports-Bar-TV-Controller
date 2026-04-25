# Stoneyard Appleton Hardware Reference

**Branch:** `location/stoneyard-appleton`

## Matrix Config

- **Wolf Pack:** **Multi-card** chassis. `outputOffset` per-card, depends on physical wiring.
- **Audio outputs:** 4 from the matrix.

## Source / Display / Audio Devices

> Stub — populate from the live DB at this location:
>
> ```bash
> sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name, ipAddress FROM FireTVDevice ORDER BY name; SELECT '---'; SELECT name, ipAddress FROM DirecTVDevice ORDER BY name;"
> ```

| Device | Type | IP | Port | Notes |
|---|---|---|---|---|
| (TBD) | | | | |

## Per-Location Notes

- **Auth bootstrap:** `LOCATION_ID` set in `.env`.
- **Multi-card matrix:** `MATRIX_SINGLE_CARD` MUST NOT be set in `.env` (would falsely fail `verify-install.sh` matrix-config check).
