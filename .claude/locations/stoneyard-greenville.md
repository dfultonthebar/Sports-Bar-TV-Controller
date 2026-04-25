# Stoneyard Greenville Hardware Reference

**Branch:** `location/stoneyard-greenville`

## Matrix Config

- **Wolf Pack WP-36X36:** **Multi-card** chassis. `outputOffset` per-card.
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
- **Multi-card matrix:** `MATRIX_SINGLE_CARD` MUST NOT be set in `.env`. The earlier WP-36X36 model-name based check assumed every WP-36X36 was single-card and falsely failed Greenville's verify; opt-in via env now lets multi-card pass.
- Recent ship: `v2.32.18` bulk-power fix (toggle uses fleet majority not Samsung-only probe).
