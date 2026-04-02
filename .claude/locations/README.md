# Multi-Location Deployment Guide

## Overview

This project supports multiple sports bar locations. Each location runs its own
installation of the Sports Bar TV Controller with location-specific data stored
on dedicated git branches.

## Location Branches

| Branch | Location | Status |
|--------|----------|--------|
| `location/graystone` | Graystone (Green Bay, WI) | Active |
| `location/lucky-s-1313` | Lucky's | Active |
| `main` | Clean template (no location data) | Shared code |

## Which Files Are Location-Specific?

These files contain location-specific device configs, layouts, and credentials:

| File | Purpose |
|------|---------|
| `apps/web/data/tv-layout.json` | Floor plan, TV zones, rooms |
| `apps/web/data/directv-devices.json` | DirecTV receiver IPs |
| `apps/web/data/firetv-devices.json` | Fire TV/Cube device IPs |
| `apps/web/data/device-subscriptions.json` | Device streaming subscriptions |
| `apps/web/data/wolfpack-devices.json` | Wolf Pack multi-chassis configs |
| `apps/web/data/atlas-configs/*.json` | Audio processor configurations |
| `apps/web/public/uploads/layouts/*.png` | Floor plan images |
| `data/tv-layout.json` | Mirror of layout (root copy) |
| `data/directv-devices.json` | Mirror of DirecTV devices |
| `data/firetv-devices.json` | Mirror of Fire TV devices |
| `data/device-subscriptions.json` | Mirror of subscriptions |
| `data/streaming-credentials.json` | Streaming service credentials |
| `.env` | API keys, SPORTS_GUIDE_USER_ID |

## Setting Up a New Location

1. **Clone the repo and checkout main:**
   ```bash
   git clone <repo-url>
   cd Sports-Bar-TV-Controller
   ```

2. **Create a location branch:**
   ```bash
   git checkout -b location/<location-name>
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with location-specific values:
   # - SPORTS_GUIDE_USER_ID (from Rail Media)
   # - Database path
   # - API keys
   ```

5. **Configure devices:**
   - Edit `apps/web/data/directv-devices.json` with local DirecTV IPs
   - Edit `apps/web/data/firetv-devices.json` with local Fire TV IPs
   - Upload floor plan via the UI (creates tv-layout.json)

6. **Build and start:**
   ```bash
   npm run build
   pm2 start ecosystem.config.js
   ```

7. **Commit location data:**
   ```bash
   git add apps/web/data/ data/ apps/web/public/uploads/layouts/
   git commit -m "feat(<location>): Initial device and layout configuration"
   git push -u origin location/<location-name>
   ```

## Updating Location Code

To pull new features from main into a location branch:

```bash
git checkout location/<location-name>
git merge main
# Resolve conflicts on data files — KEEP the location version
npm run build
pm2 restart sports-bar-tv-controller
```

## Backing Up Location Data

Location data lives ONLY on the location branch. To back up:

```bash
git checkout location/<location-name>
git add apps/web/data/ data/ apps/web/public/uploads/layouts/
git commit -m "backup(<location>): <description>"
git push
```

## Important Notes

- `main` branch has EMPTY template data files — no location-specific configs
- NEVER merge a location branch back into main (would add location data to main)
- When merging main into a location branch, always keep the location's data files
- The `.env` file is gitignored — each installation manages its own
- Database (SQLite) is stored outside the repo at `/home/ubuntu/sports-bar-data/production.db`
- PM2 working directory is `apps/web/` — `process.cwd()` resolves to there

## Recent Feature Updates (April 2026)

When pulling latest main into a location branch, these features are now available:

### Live Channel Mapping
ESPN network names (e.g., "FanDuel SN WI", "Bucks.TV") are mapped to local channel numbers
in `apps/web/src/app/api/sports-guide/live-by-channel/route.ts`. Each location may need
to add/update `NETWORK_TO_CABLE` and `NETWORK_TO_DIRECTV` mappings for their local RSN
(Regional Sports Network) channels.

### Wolf Pack Multi-Chassis Support
Locations with multiple Wolf Pack matrices can configure them in `apps/web/data/wolfpack-devices.json`.
Each chassis gets its own entry with IP, model, inputs, outputs, and credentials.
Sync to DB via `POST /api/wolfpack/chassis/sync`.

### Atlas Audio AI Learning
Automatic pattern discovery for audio processors. Runs every 6 hours via instrumentation.
Learns clipping patterns, gain effectiveness, and zone usage. No location-specific config needed.

### DirecTV Device Loader
DirecTV receivers are configured in `apps/web/data/directv-devices.json` (location-specific).
The loader (`apps/web/src/lib/directv-device-loader.ts`) reads this file for all DirecTV API routes.

### AI Scheduling with Ollama
Requires Ollama with `llama3.1:8b` model installed. AI suggests which cable boxes to tune
for upcoming games. Configure via `/api/scheduling/ai-suggest`.

### Music Tab Enhancements
Bartender Music tab now shows all playlists with artwork tiles and album art on Now Playing.
Requires Soundtrack Your Brand API credentials in `.env`.
