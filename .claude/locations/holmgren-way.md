# Holmgren Way Hardware Reference

**Branch:** `location/holmgren-way`
**Subnet:** 10.11.3.0/24 (post-network-renumber; older docs may show 192.168.4.x)

DB is the source of truth — see CLAUDE.md §6 (Device Data Migration) and `apps/web/src/lib/device-db.ts`. Values below mirror the DB as a quick reference; if they drift, trust the DB.

## Source Devices (13 total)

| Device | Type | IP | Port | Notes |
|---|---|---|---|---|
| Cable Box 1-4 | Spectrum (IR) | iTach 10.11.3.40 + 10.11.3.41 | TCP 4998 | 2 ports per iTach, 4 boxes total |
| DirecTV 1-6 | DirecTV (IP) | 10.11.3.42 – 10.11.3.47 | 8080 | HTTP API |
| Fire TV 1 (REPLACING) | Fire TV Cube (ADB) | 10.11.3.49 | 5555 | Replacement scheduled |
| Fire TV 2 | Fire TV Cube (ADB) | 10.11.3.50 | 5555 | |
| Fire TV 3 | Fire TV Cube (ADB) | 10.11.3.51 | 5555 | |
| Atmosphere TV | Fire TV Cube (ADB) | 10.11.3.48 | 5555 | Background music/visuals |

## Display Devices

| Device | Count | IPs | Control |
|---|---|---|---|
| Samsung TVs | 24 | 10.11.3.1 – 10.11.3.27 | SmartThings + WoL |
| VAVA Projector | 1 | (verify in DB) | **CAUTION:** power off/sleep kills NIC — power off is blocked in code |
| Epson Projector | 1 | 10.11.3.14 | (Currently offline per scheduler logs) |

## Audio + Lighting

| Device | IP | Port |
|---|---|---|
| AtlasIED AZM8 audio processor | (verify in DB) | TCP 5321 |
| PKnight CR011R ArtNet DMX | (verify in DB) | universe 1 |

## Matrix

- **Wolf Pack 48-port HDMI matrix** — multi-card layout. Outputs 37-40 are AUDIO-ONLY (not video displays). `MatrixConfiguration.outputOffset` per CLAUDE.md §4 — multi-card so accept any value, no `MATRIX_SINGLE_CARD` env enforcement.

## Per-Location Notes

- **IR port adjustment** is required when sending commands to multi-port iTach devices: the learned code has `sendir,1:1,...` hardcoded, but the runtime substitutes the device's `globalCachePortNumber` before transmission. Holmgren has 2 iTachs each with 2 active IR ports — port assignment matters.
- **Auth bootstrap:** `LOCATION_ID` set in `.env`; STAFF/ADMIN PINs seeded via `scripts/bootstrap-new-location.sh` (one-time).
- **Ollama model:** llama3.1:8b (per `OLLAMA_MODEL` in `.env`).
- **Bartender remote:** Nginx proxy on port 3002 → Next.js 3001, restricted to `/remote` + needed APIs.
