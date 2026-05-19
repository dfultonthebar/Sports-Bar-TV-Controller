# @sports-bar/dmx

**Purpose:** DMX512 lighting control — USB adapters (Enttec Pro/Open DMX, PKnight CR011R) and network Art-Net nodes (Enttec ODE, DMXking, generic). Includes scene engine, effect engine, and game-event reactor for celebrations.

**Key exports** (`src/index.ts`):
- Clients (`src/clients/`): `USBDMXClient`, `ArtNetClient`, `MaestroClient`
- `dmxConnectionManager`, `DMXConnectionManagerClass` — singleton with reference counting for multi-adapter setups (`src/dmx-connection-manager.ts`)
- `SceneEngine`, `getSceneEngine` — fade transitions between scenes (`src/scene-engine.ts`)
- `effect-engine.ts` — strobe / chase / color-burst effects
- `game-event-reactor.ts` — drives lights from sports game events
- Config + constants from `src/config.ts` (`DMX_CONFIG`, `ARTNET_ADAPTER_MODELS`)
- `dmxLogger`

**Protocol / port:**
- Art-Net: UDP **6454** (`DMX_CONFIG.ARTNET_PORT`)
- USB DMX: serial via `serialport` package
- Maestro: dedicated client with preset / function-button access

**Used by:** `apps/web` (DMX admin pages + game-event automation). Optional — only active at locations with DMX hardware.

**Gotchas:**
- Connection manager is reference-counted — multiple consumers can share one adapter; release when done.
- Multi-adapter support means a "universe" can span devices — see `dmx-connection-manager.ts` for `AdapterRegistration`.
- For commercial IP lighting (Lutron, Hue) use the sibling `@sports-bar/commercial-lighting` package instead.

**See also:**
- `@sports-bar/commercial-lighting` (IP / non-DMX lighting)
- CLAUDE.md (internal use only — no dedicated section)
