# @sports-bar/directv

**Purpose:** DirecTV receiver control and channel-guide fetch via DirecTV's SHEF (Set-top HTTP Export Functions) API. Includes SSDP discovery.

**Key exports** (`src/index.ts`):
- `SHEFClient` — HTTP SHEF command client (`src/shef-client.ts`)
- `DirecTVDiscovery` — SSDP-based receiver discovery (`src/discovery.ts`)
- `ChannelGuideService` — channel guide retrieval (`src/channel-guide.ts`)
- `CommandMapper` — maps high-level commands to SHEF requests (`src/command-mapper.ts`)
- `fetchDirecTVGuide`, `fetchChannelProgramInfo`, `fetchMultipleChannelProgramInfo` (`src/directv-guide-service.ts`)
- `pollRealDirecTVSubscriptions`, `determinePackageType` (`src/subscription-service.ts`)
- `direcTVLogger`, `createErrorDetails`, `withTiming`, `LogLevel`, `DirecTVOperation`
- Constants: `DIRECTV_CONFIG`, `MODEL_FAMILIES`, `REMOTE_KEYS`, `SERIAL_COMMANDS`, `COMMON_SPORTS_CHANNELS`, `CHANNEL_CATEGORIES`
- All types re-exported from `src/types.ts`

**Protocol / port:** HTTP **8080** (SHEF API); SSDP **1900** multicast on `239.255.255.250` for discovery. Defined in `src/constants.ts` → `DIRECTV_CONFIG`.

**Used by:** `apps/web` DirecTV API routes (channel tuning, guide retrieval); `@sports-bar/scheduler` for game-time channel selection. Wraps `axios` + `node-ssdp`.

**Gotchas:**
- Device IPs/ports are loaded from `apps/web/data/directv-devices.json` for guide fetching (known tech debt — CLAUDE.md Gotcha #5). Other paths read from the `DirecTVDevice` DB table.
- `DirecTVDevice` row's `port` field is used at runtime — SHEF API is per-receiver, port may vary.
- Uses `@sports-bar/cache-manager` to cache guide responses.

**See also:**
- `apps/web/src/lib/directv-device-loader.ts` (JSON loader)
- CLAUDE.md → §"Hardware Control Layer" / Gotcha #5
