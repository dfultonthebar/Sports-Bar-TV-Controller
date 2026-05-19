# @sports-bar/commercial-lighting

**Purpose:** Commercial / venue lighting control for IP-based systems — Lutron (LIP + LEAP) and Philips Hue. Provides a unified manager so the app can dim/scene-recall lights as part of game-day automation.

**Key exports** (`src/index.ts`):
- `LutronLIPClient` — Lutron Integration Protocol over Telnet (`src/clients/lutron-lip-client.ts`)
- `LutronLEAPClient` — Lutron LEAP (Caseta / RA3 modern protocol) (`src/clients/lutron-leap-client.ts`)
- `HueClient` — Philips Hue Bridge v2 REST API (`src/clients/hue-client.ts`)
- `commercialLightingManager` — singleton orchestrator registering all configured systems (`src/commercial-lighting-manager.ts`)
- `lightingLogger` — component-tagged logger
- Config + types: `LightingSystemConfig`, `RegisteredSystem`, `LightingManagerStatus`, plus per-protocol device / zone / scene types

**Protocol / port:** Multiple — Lutron LIP over Telnet (TCP 23 typical), Lutron LEAP over TLS, Philips Hue over HTTPS REST. Exact ports configured per client.

**Used by:** `apps/web` (lighting-control admin pages, game-event reactors). Currently optional — only active at locations with commercial lighting hardware.

**Gotchas:**
- LEAP requires paired CA-signed certs to talk to the Lutron processor — see Lutron LEAP docs.
- Hue v2 endpoints require an `application-key` header — provision via Hue Bridge button-press flow.
- No DMX here — DMX/ArtNet lives in `@sports-bar/dmx`.

**See also:**
- `@sports-bar/dmx` (sibling package for DMX512 / Art-Net fixtures)
- CLAUDE.md (no dedicated section yet — internal use only)
