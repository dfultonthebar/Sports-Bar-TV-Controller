# @sports-bar/htd

**Purpose:** HTD (Home Theater Direct) whole-house audio system control — MC-66, MCA-66, Lync 6, Lync 12. TCP control via the WGW-SLX network gateway; RS-232 serial planned.

**Key exports** (`src/index.ts`):
- `HTDTCPClient` — TCP client with framed protocol (`src/htd-tcp-client.ts`)
- `HTDControlService` — high-level zone control (`src/htd-control-service.ts`)
- Protocol utilities (`src/htd-protocol.ts`): `calculateChecksum`, `buildCommand`, `buildCommandFromObject`, `buildQueryCommand`, `volumeToPercent`, `percentToVolume`, `rawToSignedTone`
- Config constants (`src/config.ts`): `HTD_START_BYTE`, `HTD_CONSTANT_BYTE`, `HTD_COMMANDS`, `HTD_DATA`, `HTD_NETWORK_CONFIG`, `HTD_SERIAL_CONFIG`, `HTD_VOLUME`, `HTD_RESPONSE`, `HTD_ZONE_OFFSETS`, `HTD_FLAGS`, `HTD_MODEL_CONFIGS`, `HTD_DEFAULT_CONFIG`
- Validators: `validateZone`, `validateSource`, `getSourceDataCode`, `getModelConfig`
- All types: `HTDModel`, `HTDConnectionType`, `HTDZoneState`, `HTDZoneRawData`, `HTDCommand`, `HTDPendingCommand`, `HTDConnectionState`, `HTDControlServiceConfig`, `HTDControlEvents`, etc.

**Protocol / port:** TCP **10006** (HTD WGW-SLX gateway default — `HTD_NETWORK_CONFIG.DEFAULT_PORT`). Binary protocol with start byte + checksum.

**Used by:** `apps/web` HTD admin / control routes (per location).

**Gotchas:**
- Protocol is **checksum-validated** — use `buildCommand` / `buildCommandFromObject`, never hand-roll byte arrays.
- Multiple model families with different zone counts — always read `getModelConfig(model)` first to know zone range.
- Volume is encoded as a raw byte; UI conversions go through `volumeToPercent` / `percentToVolume`.
- RS-232 serial is in `types.ts` but **not implemented** yet (TCP-only at present).

**See also:**
- CLAUDE.md (internal use only — no dedicated section yet)
- `@sports-bar/atlas`, `@sports-bar/dbx-zonepro`, `@sports-bar/bss-blu` (sibling DSP packages)
