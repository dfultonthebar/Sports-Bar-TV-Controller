# @sports-bar/tv-network-control

**Purpose:** Network-based smart-TV control via per-vendor IP APIs — Roku, Samsung, Sharp, Vava, LG. Each client exposes a unified `BaseTVClient` interface so the app can power-cycle / switch input / launch apps without caring which brand a TV is.

**Key exports** (`src/index.ts`):
- `BaseTVClient` — abstract base (`src/clients/base-client.ts`)
- `RokuTVClient` — Roku ECP REST API (`src/clients/roku-client.ts`)
- `SamsungTVClient` — Samsung Smart TV (`src/clients/samsung-client.ts`)
- `SharpTVClient` — Sharp (`src/clients/sharp-client.ts`)
- `VavaTVClient` — Vava (`src/clients/vava-client.ts`)
- `LGTVClient` — LG WebOS (`src/clients/lg-client.ts`)
- `CommandQueue` — per-device command serialization (`src/utils/command-queue.ts`)
- Types: `TVBrand`, `TVDeviceConfig`, `TVControlCommand`, `TVDeviceStatus`, `CommandResult`

**Protocol / port:**
- **Roku ECP** — HTTP REST on TCP **8060** (`src/clients/roku-client.ts:6`)
- **Samsung Smart TV** — WebSocket (`ws` package dep)
- **LG WebOS** — WebSocket
- **Sharp / Vava** — vendor-specific; see each client's source

**Used by:** `apps/web` smart-TV control routes. Optional — not all locations have IP-controllable TVs (many are dumb HDMI displays driven from Wolf Pack).

**Gotchas:**
- **Naming note:** this package is **smart-TV network control** (Roku/Samsung/etc.). For the Wolf Pack matrix switcher use `@sports-bar/wolfpack`. Don't confuse them.
- All clients use a `CommandQueue` to prevent concurrent-access races (CLAUDE.md "Command Queue Pattern").
- Samsung / LG WebSocket pairing tokens persist per device — store carefully.

**See also:**
- `@sports-bar/wolfpack` (HDMI matrix routing — different layer)
- CLAUDE.md → §"Hardware Control Layer" (command queue pattern)
