# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ READ FIRST — REQUIRED BEFORE ANY NON-TRIVIAL WORK

Standing Rules 5, 7, and 8 below are SUMMARIES. Full application lives in:

1. **`docs/CLAUDE_MEMORY_GUIDE.md`** — three memory systems, sync rules, edge cases for Rules 5 & 7.
2. **`docs/CLAUDE_VERSIONING_GUIDE.md`** — version bumping, the three release docs interlock, Checkpoint A/B/C usage, Rule 8.

---

## Grok collaboration

When invoking Grok (the advisor / outside-perspective agent), use `bash scripts/grok-prime.sh <prompt-file>` or `bash scripts/grok-prime.sh --task "..."`. The wrapper auto-prepends `docs/GROK_BRIEFING.md` (Standing Rules + hot Gotchas + operator preferences) to every prompt so Grok always knows the rules. Raw `grok --prompt-file X` works but means Grok has to be re-told the rules each time. See `docs/GROK_BRIEFING.md` for what's prepended.

---

## V2 Monorepo Architecture

Turborepo + npm workspaces. `apps/web/` (Next.js 16) consumes `packages/*` (37 shared packages — `ls packages/` for the live list). Hardware control packages are named after the device family they wrap: `atlas`, `wolfpack`, `crestron`, `bss-blu`, `dbx-zonepro`, `directv`, `firecube`, `ir-control`, `multiview`. Cross-cutting packages: `auth`, `cache-manager`, `circuit-breaker`, `config`, `database`, `logger`, `rate-limiting`, `streaming`, `tv-guide`, `sports-apis`, `validation`, `ui-utils`, `utils`.

**Import convention:** `@sports-bar/<package>` (e.g. `import { logger } from '@sports-bar/logger'`).

**Notable:** `@sports-bar/config` centralizes validation schemas, rate-limit policies, Fire TV config, and `ConfigChangeTracker`. Apps use bridge files (e.g. `apps/web/src/lib/config-change-tracker.ts`) to inject app-specific adapters. Full API: `packages/config/README.md`.

## Build & Development Commands

### Local Development
```bash
npm run dev              # Start development server at http://localhost:3000
npm run build            # Production build (Turborepo builds all packages)
npm start                # Start production server
```

### Production Deployment (PM2)
```bash
pm2 start ecosystem.config.js        # Start with PM2
pm2 restart sports-bar-tv-controller # Restart after changes
pm2 logs sports-bar-tv-controller    # View logs
pm2 status                           # Check process status
```
**Port:** Production runs on port 3001 (configured in ecosystem.config.js)
**Database:** Production SQLite database is at `/home/ubuntu/sports-bar-data/production.db`

### IMPORTANT: Rebuild and Restart After Code Changes
**After making any code changes in `apps/web/src` or `packages/`, you MUST rebuild and restart PM2:**
```bash
# Step 1: Clear Next.js cache (recommended)
rm -rf apps/web/.next

# Step 2: Rebuild the application (Turborepo handles dependencies)
npm run build

# Step 3: Restart PM2
pm2 restart sports-bar-tv-controller
```

**Why this is required:**
- Next.js caches compiled code in `apps/web/.next/` directory
- PM2 runs the production build, not the development server
- Without rebuilding, code changes won't take effect
- Turborepo caches build artifacts - clears automatically when source changes

### Database Operations
```bash
npm run db:generate      # Generate Drizzle migration files from schema changes
npm run db:migrate       # Apply pending migrations to database (preferred since v2.54.1)
npm run db:studio        # Open Drizzle Studio database GUI
# npm run db:push        # LEGACY — silently aborts on pre-existing indexes (Gotcha #6). Do NOT use in production flow.
```

**Database Architecture:**
- ORM: Drizzle ORM with SQLite
- Schema: `apps/web/src/db/schema.ts` (single file, ~85 tables)
- Database Package: `packages/database/` - shared database layer
- Production DB: `/home/ubuntu/sports-bar-data/production.db` (configured in drizzle.config.ts)
- No Prisma migrations - uses Drizzle Kit for schema management

### Testing
```bash
npm test                    # Run unit tests
npm run test:watch          # Watch mode for unit tests
npm run test:integration    # Run all integration tests
npm run test:hardware       # Test specific hardware (CEC, IR, Matrix)
npm run test:api            # Test API endpoints
npm run test:database       # Test database operations
npm run test:all            # Run both unit and integration tests
npm run test:coverage       # Generate coverage report
```

**Test Structure:**
- Unit tests: `src/**/__tests__/*.test.ts`
- Integration tests: `tests/integration/*.test.ts`
- Test scenarios: `tests/scenarios/*.test.ts`

### ISO Build (v3.1.0+ — subiquity autoinstall, CANONICAL)

Bare-metal install media for new locations. **v3.1.0 replaces the hand-rolled v3.0.x installer.** Stock Ubuntu 24.04.4 Server ISO + subiquity autoinstall + curtin handle all partitioning, kernel, initramfs, GRUB BIOS+UEFI — pain we kept reinventing badly.

**Build:**
```bash
sudo apt-get install -y p7zip-full xorriso wget openssl   # one-time
bash scripts/iso/build-autoinstall-iso.sh                  # 15-30 min
bash scripts/iso/smoke-test-autoinstall.sh                 # end-to-end VM verify (optional)
bash scripts/iso/audit-installed-vm.sh <vmid>              # 9-layer post-install audit
```

**Active scripts** (`scripts/iso/`):
- `build-autoinstall-iso.sh` (~220 lines) — downloads stock ISO, 7z-extracts, drops autoinstall config + first-boot service, edits grub.cfg, xorriso-repacks
- `autoinstall.yaml.template` — declarative subiquity user-data; curtin handles partitioning natively
- `sports-bar-first-boot.service` — systemd oneshot, runs `first-boot-fresh.sh` (clone → build → PM2) on first boot
- `smoke-test-autoinstall.sh` — Proxmox VM 200 end-to-end install + Playwright HTTP verify
- `audit-installed-vm.sh` — 9-layer production-readiness check post-install
- `cleanup-chroot.sh` — safe debootstrap teardown helper (carried over from v3.0.x)

**DEPRECATED — do not extend** (kept in repo for git history only): `build-sports-bar-iso.sh` (debootstrap from scratch, ~700 lines), `disk-installer.sh` (~430 lines, hit 7 silent-fail bugs in one day). The 4-iteration v3.1.0 vs 7-iteration v3.0.x pain memorialized the rule: **always use the distribution's installer (subiquity/preseed/kickstart), never hand-roll.** See `feedback-use-canonical-installer-not-hand-rolled` memory + `docs/BARE_METAL_ISO.md`.

**Proxmox VM settings for smoke test** (VM 200 reference): BIOS OVMF + EFI disk (`qm set <id> -efidisk0 local-zfs:0,efitype=4m,pre-enrolled-keys=1`), machine q35, virtio-scsi-pci with `discard=on,cache=writeback,ssd=1`, virtio network, QEMU agent enabled. Min 16 GB RAM / 4 cores / 100 GB disk (4 GB/30 GB was too tight in 2026-05-27 testing).

## High-Level Architecture

### Next.js 16 App Router Architecture
**Framework:** Next.js 16.1.1 with App Router (not Pages Router)
- All routes in `apps/web/src/app/*` follow App Router conventions
- API routes: `apps/web/src/app/api/**` with route.ts files
- Pages: `apps/web/src/app/**/page.tsx` files
- Layouts: `apps/web/src/app/**/layout.tsx` files

**Next.js 16 Breaking Changes (from v15):**
- **Turbopack is the unconditional default bundler** (v2.54.41 dropped `--webpack` flag from dev+build scripts). Native modules (`isolated-vm`, `better-sqlite3`, `serialport`, `sharp`, `ws`, etc.) are declared in top-level `serverExternalPackages` in `apps/web/next.config.js`. For client-bundled bridges that need server-only code (e.g. `child_process` import in `@sports-bar/firecube`), add a `client-safe` subpath export to the package and import THAT from the bridge file.
- **PWA support removed entirely** (v2.54.34 dropped `next-pwa` to close 5 HIGH workbox CVEs; v2.54.39 stripped manifest + appleWebApp metadata + sw.js + workbox + dead icons). No service worker, no offline cache, no install-to-home-screen prompt. Browser HTTP caching only.
- `eslint` config in next.config.js is removed; run `eslint .` directly
- The `next lint` command is removed; use `eslint .` directly
- Request APIs (`cookies()`, `headers()`, `params`) are now fully async (synchronous access removed)

### Core Systems

#### 1. Hardware Control Layer
**Location:** Shared packages and `apps/web/src/lib/` services
**Key Packages:**
- `@sports-bar/atlas` - AtlasIED audio processor control
- `@sports-bar/wolfpack` - Atlas Wolf Pack matrix control
- `@sports-bar/crestron` - Crestron DM matrix switcher control
- `@sports-bar/bss-blu` - BSS Soundweb London audio processors
- `@sports-bar/dbx-zonepro` - dbx ZonePRO audio processors
- `@sports-bar/directv` - DirecTV IP control
- `@sports-bar/firecube` - Amazon Fire TV ADB control
- `@sports-bar/ir-control` - IR blaster control (iTach IP2IR)

**DirecTV Device Loader:** `apps/web/src/lib/directv-device-loader.ts` loads DirecTV receiver configs from `apps/web/data/directv-devices.json`. Used by DirecTV API routes to resolve device IPs and port numbers.

**Command Queue Pattern:**
All hardware services use a command queue pattern to prevent concurrent access issues:
```typescript
private queueCommand(devicePath: string, fn: () => Promise<T>): Promise<T>
```

#### 2. Validation & Security Architecture
**Location:** `packages/validation/` and `packages/rate-limiting/`

**Request Validation Pattern (CRITICAL):**
```typescript
// ❌ WRONG - Duplicate request.json() call
const bodyValidation = await validateRequestBody(request, schema)
const body = await request.json() // ERROR: Body already consumed!

// ✅ CORRECT - Use validated data
const bodyValidation = await validateRequestBody(request, schema)
if (!bodyValidation.success) return bodyValidation.error
const body = bodyValidation.data // Use this!
```

**Common Bug:** The `validateRequestBody()` middleware consumes the HTTP request body stream. Never call `request.json()` after validation - always use `bodyValidation.data`.

**Validation Utilities:**
- `validateRequestBody()` - POST/PUT/PATCH body validation
- `validateQueryParams()` - GET query string validation
- `validatePathParams()` - Dynamic route parameter validation
- Schemas: `packages/validation/src/schemas.ts` - Centralized Zod schemas

**Rate Limiting:**
All API endpoints are rate-limited using `packages/rate-limiting/src/middleware.ts`:
```typescript
const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
if (!rateLimit.allowed) return rateLimit.response
```

#### 3. Database Architecture
**ORM:** Drizzle ORM (not Prisma - migration completed)
**Schema:** Single file at `apps/web/src/db/schema.ts` (~85 tables)
**Database Package:** `packages/database/` - Shared database layer with re-exports
**Helpers:** `apps/web/src/lib/db-helpers.ts` - CRUD operations (findFirst, findMany, create, update, delete)

**Key Tables:**
- `FireTVDevice`, `DirecTVDevice`, `IRDevice` - Device management
- `CableBox`, `CECDevice` - CEC cable box control
- `ChannelPreset` - Quick channel access
- `MatrixConfiguration`, `MatrixRoute` - HDMI matrix routing
- `User`, `Session`, `ApiKey` - Authentication
- `CECCommandLog`, `CommandLog` - Audit trails
- `AtlasZone`, `AtlasProcessor` - Audio control

**Database Access Pattern:**
```typescript
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

// Query
const devices = await db.select().from(schema.fireTVDevices).where(eq(schema.fireTVDevices.status, 'online'))

// Using helpers
import { findFirst, findMany, create } from '@/lib/db-helpers'
const device = await findFirst('fireTVDevices', { where: eq(schema.fireTVDevices.id, deviceId) })
```

#### Device Data Migration (JSON → Database)
**Status:** Complete as of March 2026

Device configuration has been migrated from JSON files to database tables:

| Device Type | Old Source | New Source | DB Table | Helper Module |
|-------------|-----------|-----------|----------|---------------|
| DirecTV receivers | `data/directv-devices.json` | Database | `DirecTVDevice` | `apps/web/src/lib/device-db.ts` |
| Fire TV devices | `data/firetv-devices.json` | Database | `FireTVDevice` | `apps/web/src/lib/device-db.ts` |
| Station aliases | Hardcoded in channel-guide route | Database | `station_aliases` | Cached DB query in channel-guide |
| Channel overrides | Hardcoded in channel-guide route | Database | `local_channel_overrides` | Cached DB query in channel-guide |
| Channel presets | Hardcoded dicts in routes | Database | `ChannelPreset` | Seeded from `data/channel-presets-{cable,directv}.json` |

**Auto-Seed on First Startup:** When the app starts and device/preset tables are empty, it automatically seeds from JSON files (`data/directv-devices.json`, `data/firetv-devices.json`, `data/channel-presets-cable.json`, `data/channel-presets-directv.json`). This ensures locations pulling the code update don't lose their devices or channel presets. See `apps/web/src/lib/seed-from-json.ts`. The channel-preset JSON files are per-location (committed on the location branch) and seed the `ChannelPreset` table only when it's empty — after that the DB is the source of truth.

**Centralized Hardware Config:** `apps/web/src/lib/hardware-config.ts` contains all device IPs, ports, and processor IDs. Update this file when hardware changes — no more hunting through 15+ files.

**Important:** The JSON files still exist on location branches as seed data. After first startup, the database is the source of truth. Edits made through the UI go to DB only.

#### 4. Logging Architecture
**Logger Package:** `packages/logger/`
```typescript
import { logger } from '@sports-bar/logger'

logger.info('[COMPONENT] Message', { context: 'data' })
logger.error('[COMPONENT] Error:', error)
logger.debug('[COMPONENT] Debug info')
```

**Enhanced Logging:** `packages/logger/src/enhanced-logger.ts` - Stores logs in database for System Admin analytics
**Component Tags:** Use `[COMPONENT]` prefix for searchable log filtering (e.g., `[CEC]`, `[MATRIX]`, `[IR]`)

#### 5. Cable Box Control (IR only — CEC dead, do not extend)
Wolf Pack matrix does NOT pass CEC + Spectrum disables CEC in firmware → all cable box control is IR via Global Cache iTach IP2IR. IR codes live in the `IRCommand` table, learned via the IR Learning Panel. UI: `apps/web/src/components/remotes/CableBoxRemote.tsx` + `BartenderRemoteSelector.tsx`. Do not add new CEC features.

#### 6. Crestron Matrix Switcher Control
`packages/crestron/` — DM/HD-MD/DMPS/NVX series, Telnet/CTP/CIP. **Output slot offset gotcha:** DM 8x8/16x16 outputs start at 17, 32x32 at 33, 64x64 at 65 — add the offset before issuing routing commands. Full models, ports, command list, API routes: `packages/crestron/README.md`.

#### 7. Audio Processor Control
`packages/bss-blu/` (HiQnet TCP 1023), `packages/dbx-zonepro/` (TCP 3804 preferred — **NO F0/64/00 prefix or checksum** over TCP, fire-and-forget; **CRITICAL** auto-recall Scene 1 on connect to escape failsafe-mode source-shift), `packages/atlas/` (AtlasIED), `packages/shure-slxd/` (Shure SLX-D wireless mic receivers, RF interference monitoring only — see §7a). UI: Device Config → Audio Processors. Per-package READMEs hold full model lists, SV IDs, and protocol detail.

**Atlas (AZMP4/8) TCP+UDP architecture (v2.33.50+):** ONE persistent `ExtendedAtlasClient` per processor IP:port via the `atlasClientManager` singleton (hoisted to `globalThis` per Gotcha #10). TCP port 5321 for JSON-RPC commands; UDP port 3131 for subscribed meter pushes (`SourceMeter_N`, `ZoneMeter_N`, `GroupMeter_N` in dB). All control paths — meter manager, drop watcher, priority watcher, `executeAtlasCommand` — share that one client. Adding new Atlas code: route through `getAtlasClient(processorId, config)`; never `new AtlasTCPClient(...)` directly (TCP leak + breaks the singleton).

**Atlas audit tables (v2.33.47/49):** `atlas_drop_events` (zone gain crashes — drop watcher polls every 30s, fires on ≥15-point drop landing ≤10) and `atlas_priority_events` (mic/page/jukebox/priority-input activity + unexpected source overrides — priority watcher polls input meters every 5s, fires when any input matching `/\b(mic|juke|page|intercom|priority)\b/i` crosses −45 dB). Both watchers write `event_type='startup'` rows on boot so the table proves they're alive even with no real events. Banner at top of bartender remote audio tab while a priority event is active. Endpoints: `GET /api/atlas-drops`, `GET /api/atlas-priority?active=true`. **Atlas firmware exposes no queryable "priority active" parameter** (60+ candidate param names probed 2026-05-17, all returned `-32604`); priority is inferred from MIC-pattern input levels + unexpected `ZoneSource_X` changes.

#### 7a. Shure SLX-D Wireless Mic RF Interference Detection (v2.34.0+, Phase 2 in v2.34.1)
`packages/shure-slxd/` — TCP 2202, Shure's ASCII `< VERB CHAN PROP VAL >` line protocol. Built for stadium-adjacent bars where ENG/mobile broadcast rigs step on the bar's wireless mic frequencies and false-trigger the Atlas priority bus. Receiver is monitored, not routed through — this package does NOT replace any Atlas/DBX/BSS DSP function.

**Canonical operator home:** `/device-config` → **Audio** category → **Wireless Mics** tab (v2.34.2+). One place for setup, pre-flight test, live battery + RSSI + frequency tile per channel, event history, dedicated-log-file path, mock-receiver developer command. AudioProcessorManager still works as a backup add-path. **Full SME briefing on RF coordination + protocol details + reference list:** `packages/shure-slxd/README.md`.

**Surface area (Phase 2 — v2.34.1):**
- **Battery + RSSI tile on bartender Audio tab** — `ShureMicStatusPanel.tsx`, per-receiver / per-channel live status with color-coded battery bars + signal quality, polled every 3s via `GET /api/shure-rf/status`. Hidden when no receiver configured.
- **Pre-install check** — `POST /api/shure-rf/preflight {ip, port}` one-shot probe returning checklist (TCP reachable, third-party-controls enabled, firmware ≥ 1.1.0, model). Wired to "Run pre-flight" button in Device Config → Audio Processors when type is shure-slxd. Catches the BLOCKED-gate install failure before save.
- **Atlas ↔ Shure correlation** — `atlas-priority-watcher` queries `shure_rf_events` ±30s before inserting `mic_active`; if matched, writes `event_type='rf_induced_mic_active'` so the operator distinguishes ghost-override from real page. Banner copy adapts.
- **Low-battery detection** — watcher fires `event_type='low_battery'` rising-edge when `TX_BATT_BARS ≤ 1` (255 = unknown / alkaline TX, skipped).
- **Mock receiver + integration test** — `scripts/mock-shure-receiver.ts` simulates the protocol with 6 scenarios (clean, interference-rising, tx-battery-dying, coalesced-frames, partial-frames, third-party-controls-disabled). `scripts/test-shure-parser.ts` spawns it for each scenario and asserts the real client's parser/cache behavior. **6/6 PASS verifies the parser against real-world frame patterns BEFORE hardware ships.**

**Architecture:** Persistent TCP socket per receiver via `shureSlxdClientManager` singleton (`globalThis` + `Symbol.for()` per Gotcha #10, plus per-key in-flight Promise lock to close the race window). Subscribes to SAMPLE pushes (METER_RATE 1000 ms). Watcher (`apps/web/src/lib/shure-rf-watcher.ts`) writes `shure_rf_events` rows on the ghost-carrier signature: `TX_TYPE='UNKNOWN'` AND `RSSI ≥ -85 dBm` sustained 3 consecutive samples (hysteresis: clear at ≤ -95 dBm × 3). Heartbeat every 20s while active so the banner's 30-s active-window query stays fresh. Endpoint `GET /api/shure-rf?active=true` drives a cyan banner on the bartender Audio tab that appears alongside the amber Atlas priority banner — when BOTH fire simultaneously the priority event is RF-induced (operator stops chasing ghost overrides).

**Dedicated log file:** `/home/ubuntu/sports-bar-data/logs/shure-rf-YYYY-MM-DD.log` (daily rotation, 30-day retention, format `ISO_TS | LEVEL | receiverId | ch | event | rssi_dbm | freq_mhz | tx_type | note`). Also mirrors through `@sports-bar/logger` for PM2 visibility.

**Protocol gotchas (all in `packages/shure-slxd/README.md` — read before extending):**
- Wire-protocol property names per Shure's "SLX-D Command Strings v2 (2020-G)" spec — confirmed live on Holmgren SLXD4D firmware 1.4.7.0 (2026-05-18): **`TX_MODEL`** (NOT `TX_TYPE`); **`GROUP_CHANNEL`** (NOT `GROUP_CHAN`). Earlier note here said the opposite — our client never matched the REP frames, so TX type + group/channel never populated on real hardware until v2.40.1 fixed both. The TypeScript field names `state.txType` / `state.groupChannel` are kept for back-compat; only the wire-protocol case-statements changed. String values still wrapped in `{…}` curly braces (CHAN_NAME, DEVICE_ID, FW_VER, GROUP_CHANNEL).
- Network-side scan: **does NOT exist** in SLX-D firmware 1.4.7.0. Verified by (1) probing 16 candidate command variants live, all returned `< REP ERR >`; (2) Shure's official SLX-D Command Strings spec v2 — full property set enumerated, no SCAN/GROUP_SCAN/CHANNEL_SCAN/FREQ_SCAN/SPECTRUM/SWEEP commands as GET/SET/REP; (3) WWB6 KB explicitly lists SLX-D as monitor/control-only (scan-capable list is Axient Digital, ULX-D, QLX-D, UHF-R, PSM1000). Front-panel Group Scan or our software equivalent (`POST /api/shure-rf/find-clean-freq`, v2.40.0+) are the only options. Don't waste cycles re-probing for SCAN verbs against this firmware.
- FREQUENCY is 6-digit kHz (e.g. `537125` = 537.125 MHz), not 7-digit kHz×100.
- RSSI on SLX-D is COMBINED (no per-antenna A/B split) and SAMPLE-only — no `< REP x RSSI ... >` push. Don't carry ULX/QLX/AD patterns over.
- METER_RATE range 50-60000 ms. Bitfocus recommends ≥5000 ms baseline; we use 1000 ms for game-day RF detection (faster than baseline, slower than receiver-web-UI-lockup threshold).
- Receiver SILENTLY DROPS malformed/out-of-range commands — no `ERR`/`NAK` frame exists in the protocol. Validate post-SET via REP echo if certainty needed.
- Front-panel gate `Menu → Advanced → Network → Allow Third-Party Controls → Enable` defaults to BLOCKED; without it, port 2202 accepts the TCP connection but silently drops every command. **First-install checklist must verify this gate.**
- **Auto Scan is NOT available over the network** — only front-panel Group/Channel Scan, or WWB6 (different protocol). Software-side workaround is to maintain a candidate-frequency list and hop manually; causes audio click on every hop.

#### 7b. SDR Spectrum Monitor — wide-band RF context (v2.41.0+)

**Purpose:** complement the Shure receiver's narrow per-channel view with a wide-band RTL-SDR sweep so the system sees ALL activity in the band, not just on our tuned freqs. Provides cross-confirmation for Shure interference events + early warning when a new carrier appears in the band before it hits our channel.

**Hardware:** NooElec NESDR Smart (RTL-SDR v3 derivative, ~$35) or any rtl-sdr-compatible dongle on USB. Coverage 25 MHz – 1.7 GHz, more than enough for G58 (470-514 MHz) plus H55 / J50A / J52A if the operator ever adds receivers in those bands.

**One-time setup:** `sudo bash scripts/setup-sdr.sh` — apt installs rtl-sdr, writes `/etc/modprobe.d/blacklist-rtl.conf` (the #1 first-install failure is the kernel DVB-USB driver grabbing the dongle before user-space tools can), live-unloads any running DVB modules, appends `SDR_ENABLED=auto` to `.env`. Idempotent. After this, plugging in a dongle ANY time auto-starts the watcher within 5 min — no PM2 restart.

**Watcher (`apps/web/src/lib/sdr-watcher.ts`):** spawns `rtl_power -f <start>M:<end>M:25k -i 1 -e 0 -g 25` as a long-lived child. Parses CSV output line-by-line, two paths per sample:
- **Aggregator** — max/avg/count per (minute, freq) bucket in memory, flushed to `sdr_spectrum` at minute rollover. Storage budget ~290 MB/year.
- **Carrier detection** — per freq bin, count consecutive samples ≥ `-85 dBm` threshold (CARRIER_DETECT_SAMPLES=3 → rising-edge `carrier_active` row; CARRIER_CLEAR_SAMPLES=5 → falling-edge `carrier_cleared` row). Heartbeat every 30s while active. Same hysteresis shape as the Shure and Atlas priority watchers.

**`SDR_ENABLED` env modes:** `auto` (recommended — start only when dongle detected, probe every 5 min), `true` (force-start, error if no dongle), `false`/unset (off, no probes).

**Auto band-tracking:** `SDR_BAND_PRESET=auto` (default) reads `shureSlxdClientManager.getSnapshots()` every 5 min, sweeps MIN-5 MHz to MAX+5 MHz across the actual Shure receiver freqs. Operator adds an H55 receiver → SDR sweep follows. Other presets: `uhf-wireless` (470-700 MHz fixed), `full-uhf` (470-960 MHz), `custom` (use SDR_BAND_START_MHZ/END_MHZ).

**API endpoints:**
- `GET /api/sdr/status` — liveness + active-carriers list (polled every 30s by the UI for header info)
- `GET /api/sdr/history?minutesAgo=N` — pivoted 2D grid (time × freq) for waterfall, used for initial render
- `GET /api/sdr/stream` — Server-Sent Events live push: `bucket` (per-minute spectrum row), `carrier` (active/cleared events), `heartbeat`. Replaces history polling for real-time waterfall updates
- `GET /api/sdr/peak-stats?daysAgo=7&topN=20` — per-freq aggregates: max, avg, p95, hot-minutes count. Foundation for Stage 2 (recurring-pattern detector) and Stage 3 (frequency-suggestion engine)

**Cross-confirmation with Shure:** when `shure-rf-watcher` fires `rf_interference`, it queries `sdr_carriers` within ±60s at the same freq (±50 kHz tolerance). If matched, the event's `note` gets `(SDR-confirmed, SDR peak X dBm)`. UI shows a purple "SDR-confirmed" badge on event-history rows. Ollama pattern digest is told to weight these higher when recommending mitigation.

**UI surface:** `/device-config → Audio → Wireless Mics → RF Spectrum Monitor` — canvas waterfall (annotated with our Shure freqs as cyan vertical lines + Green Bay TV station edges WCWF/WLUK as dashed white lines), click any column to inspect 7-day peak-stats for that freq. Three render states: disabled (setup instructions), waiting-for-sweep (warn), live (waterfall + carriers).

**Wrapped in SafeBoundary** — a render crash in the SDR panel only shows a tiny red inline card, doesn't escalate to the global "Something went wrong" page boundary.

**v2.52.10-17 calibration + AI integration (2026-05-19 SDR install at Holmgren):**

- **`SDR_DBM_OFFSET` software calibration** (default `-55`) applied in `handleSweepLine` at ingest. rtl_power outputs uncalibrated dBFS — not real antenna-port dBm — so every `sdr_spectrum`/`sdr_carriers` row + the carrier-detection threshold needs a per-tuner correction to land in textbook -110→0 dBm register. Holmgren tuned to `-37` at `SDR_GAIN_DB=14.4`. Calibrate per-location by keying a known mic + comparing SDR vs Shure RSSI. See [[feedback-sdr-rtl-power-calibration]].

- **Per-sweep SSE event** (`sweep` event type, ~1 sec cadence) via `apps/web/src/lib/sdr-sweep-emitter.ts` (globalThis singleton per Gotcha #10). The FFT panadapter consumes this directly so it updates at sub-second freshness, not the per-minute bucket cadence. Catches 30-sec DJ-mic bursts that minute-aggregates would miss.

- **Carrier coalescing** at `/api/sdr/status`: adjacent active-bin events within 500 kHz collapse to ONE carrier with `widthKhz` + `binCount` fields. 200 kHz TV broadcast renders as one entry, not 8 separate 25-kHz bin rows. `CARRIER_THRESHOLD_DBM` raised `-85 → -70` (less noise after calibration).

- **FFT panadapter** (`apps/web/src/components/ShureSdrSpectrumPanel.tsx`) sits above the waterfall. 160px FFT primary view, 50px waterfall secondary, shared X-axis. Hover tooltip ("484.0 MHz · −62 dBm").

- **Tier 1 — interference correlator (`packages/scheduler/src/interference-correlator.ts`):** `correlateAllInterference()` runs BOTH `correlateInterference()` (Shure-event source) and `correlateSdrInterference()` (SDR-carrier source). SDR pass filters to ±0.1 MHz of our currently-tuned Shure freqs so we attribute real mic-band interference only, not the continuous WCWF broadcast. `InterferenceAttribution.source` distinguishes `'shure'` vs `'sdr'`. Scheduler runs every 10 min.

- **Tier 2 — preemptive-strike + clean-freq suggestion:** `PreemptiveStrikeCandidate.suggestedCleanFreqs[]` populated per-candidate from 7-day `sdr_spectrum` quietness scoring. `findCleanFreqs()` helper exported for on-demand UI use.

- **Tier 3 — daily Ollama RF Pattern Digest:** `packages/scheduler/src/rf-pattern-digest.ts` runs once / 24h, llama3.1:8b summarizes the last 24h of SDR + Shure + neighborhood events into bartender-grade prose. Stored in `rf_pattern_digest` table. The model is shared with shift-brief/AI Suggest (one resident, not two — see [[feedback-ollama-ram-pressure]]).

- **Tier 4 — `GET /api/sdr/clean-freqs?topN=N`:** ranked clean-freq suggestions, excludes currently-tuned Shure freqs by default, returns rationale ("quiet 99.4% of last 7 days, avg -88 dBm").

- **UI surface (`apps/web/src/components/ShureRfAiPanel.tsx`):** Wireless Mics admin tab has "RF Environment Summary" card (LLM prose + Refresh button + counts grid) + "Suggest a Clean Frequency" button. SafeBoundary-wrapped.

- **Shift-brief integration:** `apps/web/src/app/api/ai/shift-brief/route.ts` is now the bartender's primary pre-shift surface, with 3 RF-related verbatim bullets (each server-built per Gotcha #12):
  - **Mic-status 1-liner** (v2.52.16): live Shure mic health.
  - **Heads-up bullets** (v2.52.16 + v2.53.2): neighborhood-event warnings via Ticketmaster + Bananas. Category-aware radius/lookahead — bars: 1 mi / 12h, stadiums + concert halls: 25 mi / 72h.
  - **Atlas priority recap** (v2.53.6): 24h aggregate of mic-key / RF-induced-ghost / source-override counts for yesterday's shift.
  10-min cache (`?force=true` to bust), `num_predict: 320`. Pre-filter games to ≤8 to avoid LLM context-overflow hallucination (`[[feedback-llm-context-overflow]]`). Whenever adding a new section, mirror to `fallbackBrief()` so degraded-path bartenders still see it. Full architecture: `[[project-shift-brief-architecture]]`.

- **Architecture map:** see [[project-ai-tier-architecture]] memory for the full tier diagram + which file does what.

**ecosystem.config.js forwards all SDR_* env vars** (v2.52.7 fix) — adding a new SDR_FOO env requires (a) reading `process.env.SDR_FOO` in the watcher AND (b) listing it in `ecosystem.config.js`'s `env:` block AND (c) `pm2 delete && pm2 start ecosystem.config.js` (NOT just `restart` — per Gotcha #2).

#### 8. Wolf Pack Multi-View Card Control
`packages/multiview/` — HDTVSupply 4K60 Quad-View cards in Wolf Pack slots. RS-232 USB (115200 8N1), 8 display modes (single → quad), hex frame format. DB: `WolfpackMultiViewCard`. Full hex frames + mode table: `packages/multiview/README.md`.

### API Route Patterns

Standard order: `withRateLimit` → `validateRequestBody`/`validateQueryParams` → use `bodyValidation.data` (NEVER `request.json()` after) → business logic → `NextResponse.json({success, data/error})` → catch logs `[COMPONENT]` tag. POST validates body, GET validates query params. See `apps/web/src/app/api/matrix/current-channels/route.ts` or `apps/web/src/app/api/schedules/bartender-schedule/route.ts` for canonical examples.

### Authentication System
**Location:** `packages/auth/`
**Strategy:** NextAuth.js 4.24.11 with custom PIN-based authentication
**Session Storage:** Database sessions (not JWT)

**Key Files (in packages/auth/src/):**
- `middleware.ts` - Route protection
- `pin.ts` - PIN validation
- `session.ts` - Session management
- `api-key.ts` - API key authentication (for external integrations)

**Protected Routes:** `apps/web/src/app/login/` handles authentication UI

### Audio Control & Soundtrack Integration
**AtlasIED Integration:** `packages/atlas/`
- Real-time audio level monitoring
- AI-powered gain optimization
- Zone-specific control

**Soundtrack Your Brand:** Commercial music streaming for bars
- API integration: `packages/soundtrack/`
- Now playing display
- Play/pause control from bartender remote

### Frontend Component Architecture
**UI Library:** Radix UI + Tailwind CSS
**State Management:** React hooks (no Redux/Zustand)
**UI Utilities:** `packages/ui-utils/` - Tailwind CSS utility functions (cn)
**Component Structure:**
- `apps/web/src/components/ui/` - Reusable UI primitives
- `apps/web/src/components/remotes/` - Device-specific remote controls
- `apps/web/src/components/streaming/`, `directv/`, `ir/` - Device type components

**Smart Component Pattern (CableBoxRemote):**
```typescript
// Detects device type and routes to appropriate API
const isCECDevice = !iTachAddress && deviceId.startsWith('cable-box')
const endpoint = isCECDevice ? '/api/cec/cable-box/command' : '/api/ir-devices/send-command'
```

## Common Gotchas

### 1. Body Stream Already Consumed
`validateRequestBody()` reads the request body. Never call `request.json()` after — use `validation.data`. POST/PUT only; GET has no body, use `validateQueryParams()`.

### 2. PM2 Restart vs Delete+Start
`pm2 restart` does NOT re-read `.env` via `ecosystem.config.js` — only `delete` + `start` does. Use restart for code-only changes after rebuild; delete+start when env vars or ecosystem config changed. Force-rebuild before restarting if package-source changed: `rm -rf apps/web/.next .turbo node_modules/.cache && npx turbo run build --force` (Turbo cache misses package changes — caused the v2.11.7 routing fix to not take effect at Holmgren).

### 3. Production DB Path
Always `/home/ubuntu/sports-bar-data/production.db`. Set in `drizzle.config.ts` + env. Dev may differ.

### 4. Matrix Config Per-Location Values (CRITICAL — outputOffset)

`MatrixConfiguration.outputOffset` is ADDED to every output number before
routing commands go to the Wolf Pack. If set wrong, routing silently lands
on the wrong physical TVs with no error — just confused operators. Lucky's
1313 shipped in April 2026 with `outputOffset=26` on a single-card WP-36X36,
sending every "output 1" request to physical output 27 for weeks before
being caught.

**Expected values by card layout (NOT by model string):**

The WP-8X8, WP-16X16, and WP-36X36 chassis are all sold in BOTH single-card
and multi-card configurations — the model string alone does not tell you
which. Card layout is set per-location by the installer.

| Card layout | outputOffset | audioOutputCount notes |
|---|---|---|
| **Single-card** (one card fills all outputs) | **MUST be 0** | 0 if audio routes via Atlas/dbx/BSS DSP; non-zero only if Wolf Pack outputs are wired to speakers |
| **Multi-card** (chassis populated with multiple daughter cards) | Per-card, depends on physical wiring | Per-location |

**Per-location reference** (updated 2026-04-18 after operator verification):

| Location | Model | Layout | outputOffset | audioOutputCount | Notes |
|---|---|---|---|---|---|
| Stoneyard Greenville | Wolf Pack WP-36X36 | **Multi-card** | Per card | 4 | |
| Stoneyard Appleton | Wolf Pack | **Multi-card** | Per card | 4 | |
| Holmgren Way | Wolf Pack 48-port | **Multi-card** | Per card layout | 4 | Outputs 37-40 are audio-only (CLAUDE.md §10) |
| Graystone | Wolf Pack WP-36X36 | **Multi-card** | +32 for audio card | 4 | Comment in `wolfpack-matrix-service.ts:275` |
| Lucky's 1313 | Wolf Pack WP-36X36 | **Single-card** | **0 (enforced)** | **0** | Audio via dbx ZonePRO 1260m @ 192.168.10.50 |
| Leg Lamp | Wolf Pack | **Single-card** | **0 (enforced)** | 0 | |

**How enforcement is opted in:**

Single-card locations declare themselves by setting `MATRIX_SINGLE_CARD=true`
in the location's `.env`. When this flag is set, `scripts/verify-install.sh`'s
`matrix_config` layer will FAIL the install if `outputOffset != 0`, rolling
back the auto-update before bad values ship. Multi-card locations leave the
flag unset (the default) and any offset is accepted.

This was changed from a model-name-based check after Graystone's multi-card
WP-36X36 failed verify with "offset=32 on WP-36X36 (expected 0)" — the old
check assumed every WP-36X36 was single-card. Opt-in via env is explicit
and lets operators match the check to physical wiring regardless of model.

- `apps/web/src/instrumentation.ts` logs `[MATRIX-CONFIG] ⚠` at startup if a single-card model has non-zero offset (separate legacy check, still useful as a runtime warning).
- Multi-card locations are not auto-verified (their values are wiring-specific) — operator must maintain the row in this table when adding/moving cards.

**When adding a new location**, add a row to the per-location table above
BEFORE the first auto-update merges it into this file. When changing physical
cabling on an existing Wolf Pack, update both the live DB value AND the row
here.

### 5. Device Data: DB is Source of Truth
- Devices are now stored in database tables (`DirecTVDevice`, `FireTVDevice`), not JSON files
- JSON files (`data/directv-devices.json`, `data/firetv-devices.json`) are only used for initial seeding
- All CRUD operations go through `apps/web/src/lib/device-db.ts`
- To re-seed from JSON: delete rows from the DB table, restart the app
- The `@sports-bar/directv` package still reads JSON for guide fetching (known tech debt)

### 6. drizzle-kit push Fails Silently on Pre-Existing Indexes — RESOLVED v2.54.1
**Historical:** `npx drizzle-kit push` aborts entirely when it hits an index that already exists. Any tables or columns scheduled to be created AFTER that index in the push order are silently skipped. Caused a 24h outage on 2026-05-20 when 5 fleet boxes had the v2.51 NeighborhoodEvent table silently missing.

**Fix (v2.54.1):** the schema-update flow no longer uses `push`. Auto-update.sh now runs:
1. `scripts/bootstrap-drizzle-migrations.sh` (idempotent; ensures `__drizzle_migrations` exists with markers for every committed migration)
2. `npx drizzle-kit migrate` (applies pending migrations one-at-a-time, fails LOUD on any error)

Dev workflow for schema changes is now:
1. Edit `packages/database/src/schema.ts`.
2. `cd <repo root> && npx drizzle-kit generate --name <description>` — writes `drizzle/000N_<name>.sql` + `drizzle/meta/000N_snapshot.json`.
3. Review the generated SQL. Drizzle MAY propose dropping orphan tables (sdr_*, AudioMessage, etc.) that aren't declared in schema.ts but exist in production. Use `--custom` or hand-edit the SQL to remove the DROP statements before commit.
4. Commit + push. Auto-update on each fleet box runs the migration on next cycle.

**Belt-and-suspenders:** `verify-install.sh` has a `schema_completeness` layer (v2.53.17) that checks expected tables exist post-install. If a future bug bypasses migrate, this catches it before verify-install passes.

If a box ever shows a missing table again, the recovery is the same one used for the v2.51 outage — see `scripts/bootstrap-drizzle-migrations.sh` source + the v2.54.0 commit message for the manual DDL apply path.

### 7. Location Data Files Get Blanked on Merge from Main
Main has empty template JSON files (`tv-layout.json` = 61 bytes, `directv-devices.json` = 15 bytes). When merging main into a location branch, git can silently overwrite real data with these templates if there's no conflict. **After every merge from main, verify:**
```bash
wc -c apps/web/data/tv-layout.json  # Must be >500 bytes at a configured location
```
If blanked, restore: `git show HEAD~1:apps/web/data/tv-layout.json > apps/web/data/tv-layout.json`

### 8. BartenderLayout Must Include Rooms
The bartender Video tab reads both `zones` and `rooms` from the `BartenderLayout` DB table (migrated from `tv-layout.json` in v2.11.0). If `rooms` is empty or the column is missing, the room filter tabs won't appear. The auto-seeder in `seed-from-json.ts` handles this for fresh installs. For existing locations, ensure the `rooms` column exists and is populated.

### 9. Prime Video on Fire TV Cubes is hosted by the launcher, not a separate APK
On Fire TV Cube 2nd gen (model **AFTR**, Fire OS 7.7) and other PVFTV-build Cubes, **`com.amazon.avod` is NOT installed as a standalone app** — `pm list packages` will not show it. Prime Video is hosted entirely inside the Fire TV launcher (`com.amazon.firebat`). What `Settings → Applications → Manage Installed Applications` shows as "Prime Video" with version `PVFTV-215.5200-L` IS the launcher itself; Amazon brands the launcher entry as "Prime Video" in the user-facing list.

**Don't waste time hunting for the AVOD package.** v2.28.8 added `com.amazon.firebat` as a `packageAlias` for the `amazon-prime` catalog entry (`packages/streaming/src/streaming-apps-database.ts`). When `streamingManager.launchApp('amazon-prime')` runs on a Cube without `com.amazon.avod`, it falls through to firebat. `adb-client.launchApp()` then resolves `cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER com.amazon.firebat` to `com.amazon.firebat/com.amazon.firebatcore.deeplink.DeepLinkRoutingActivity`, which routes to `livingroom.landing.LandingActivity` (the Prime Video browse screen — exact same activity the home-screen tile invokes).

If a future Cube model ships Prime Video under yet another package name, the diagnostic flow is:
1. Confirm device truly lacks `com.amazon.avod`: `pm path com.amazon.avod` returns failure.
2. Have an operator open Prime Video manually on the device, then capture `dumpsys window windows | grep mCurrentFocus` to see the foreground activity.
3. Confirm the package is launchable: `cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER <package>` returns a real activity.
4. Add the package to `packageAliases` for `amazon-prime` in the streaming catalog.

The same reasoning applies to **other Amazon-branded apps that may be launcher-hosted on certain Fire OS builds** (Amazon Music, Photos). Don't trust the catalog package name as authoritative — trust what `pm path` returns on the actual device.

### 10. Next.js bundles each route handler separately → module-private singletons are PER-BUNDLE, not per-process

In Next.js App Router (16.x), every API route handler in `apps/web/src/app/api/**/route.ts` is compiled into its own server bundle. Modules imported by multiple routes — including workspace packages like `@sports-bar/atlas` — are **duplicated across bundles**. A `private static instance` field on a class is therefore **per-bundle**, not per-process: each route's compiled copy of the class has its own static. The "singleton" you wrote is actually N singletons.

**Concrete symptom (v2.33.50 root cause):** `atlasClientManager` and `atlasMeterManager` each had one instance per route bundle. Each bundle's manager created its own `ExtendedAtlasClient` with its own UDP socket bound to port 3131 via `SO_REUSEPORT`. The Linux kernel hashes incoming meter packets to one of the bound sockets — packets landing on bundle A's socket never reach bundle B's cache. Result: bartender remote and admin Audio tab read different stale caches, meters appear frozen, looked like an Atlas bug for hours.

**Fix pattern — hoist any cross-route singleton to `globalThis`:**

```typescript
public static getInstance(): YourClass {
  const KEY = Symbol.for('@your-pkg/YourClass.instance')
  const g = globalThis as any
  if (!g[KEY]) g[KEY] = new YourClass()
  return g[KEY] as YourClass
}
```

`Symbol.for(...)` uses V8's process-wide symbol registry, so every bundle's lookup hits the same slot on `globalThis`. The first bundle to call `getInstance()` creates the instance; every other bundle finds it.

**Race-condition addendum:** Even with the singleton fixed, concurrent `getClient(K)` calls for the same key can both pass a `map.get(key)` check before either inserts — creating duplicate clients. Use a per-key in-flight Promise lock (see `AtlasClientManager.getClient` for the pattern).

**Apply this to:** any code where you wrote a "singleton" but a Next.js route bundle could load it. Notably: TCP/UDP socket managers, connection pools, in-memory caches that mirror external state, anything that binds an OS resource.

Same fix applied to **`@sports-bar/shure-slxd`** in v2.34.0 (preemptive — same race, same singleton, before any stuck-cache symptom hit prod). The reconnect path was tightened in v2.37.2 to also use the in-flight Promise lock so concurrent `getClient()` calls on a disconnected client don't both call `connect()` and create duplicate sockets.

### 11. Auto-update silently stalls — 3 install-time gaps that look like "the timer just stopped firing"

The auto-update timer is a **systemd user unit** at `~/.config/systemd/user/sports-bar-autoupdate.timer` (NOT a system cron entry). `systemctl list-timers` doesn't show it — use `systemctl --user list-timers`. Three install-time gaps make it look like auto-update is broken when it's really just blocked from running:

1. **`Linger=no` on the ubuntu user.** User-scoped systemd units only run while the user has an active login session. Without `sudo loginctl enable-linger ubuntu` (one-time, root), the timer dies when the operator's SSH session ends. Greenville sat 38 hours without an update at v2.50.x because linger was off and nobody had SSH'd since the last manual touch.
2. **modify/delete merge conflict** when main deletes a file that the location branch happened to touch (the v2.48.x verified-dead-route sweeps trigger this). `auto-update.sh`'s auto-resolver tries `git checkout --theirs` which fails when there IS no "theirs" version. Trap fires, full rollback. Fix manually: `git rm <path> && git commit -m "chore: accept main deletion of X" && git push origin location/<branch>`, then re-trigger. The rollback tag (`rollback-YYYY-MM-DD-HH-MM`) is your safety net.
3. **NVM-installed node not in `/usr/local/bin`** — `npx`/`npm` not in PATH for non-login systemd-fired scripts (`rag-rescan-if-needed.sh`, etc). PM2 keeps working because it inherits PATH from the login session that started it; new subprocesses fail. Fix: `sudo ln -sfv /home/ubuntu/.nvm/versions/node/v20.20.0/bin/{node,npm,npx} /usr/local/bin/`.
4. **IPEX-LLM ollama models dir is `ollama:ollama` but daemon runs as `ubuntu`** — `ollama pull` fails part-way with `permission denied` on partial-blob writes. Fix: `sudo usermod -aG ollama ubuntu && sudo chgrp -R ollama /usr/share/ollama/.ollama/models/ && sudo chmod -R g+w /usr/share/ollama/.ollama/models/ && sudo systemctl restart ollama-ipex`. Affects models pulled AFTER initial provisioning (the install script seeds the first set as the ollama user).

**Audit recipe for a stuck location:**
```bash
ssh ubuntu@<host> "systemctl --user list-timers sports-bar-autoupdate.timer; loginctl show-user ubuntu | grep Linger; ls -lat /home/ubuntu/sports-bar-data/update-logs/ | head -3; grep -E 'ROLLBACK|CONFLICT|FAIL' \$(ls -t /home/ubuntu/sports-bar-data/update-logs/*.log | head -1) | head -10"
```
If linger=no → fix it. If ROLLBACK present → resolve the conflict. If `npx: command not found` in a `rag-rescan-*.log` → symlink fix. If `ollama pull` errored with permission denied → group fix. Apply all four checks at install time via `docs/NEW_LOCATION_SETUP.md` §7b.

### 12. llama3.1:8b paraphrases short verbatim text — server-build it instead

llama3.1:8b ignores prompt rules like "do not rephrase" and "use EXACTLY as written" about half the time for short LLM-rendered text (formatted dates, counts, channel labels, source-target pairs). Proven across v2.53.0-8 in 6+ shift-brief sections: the model kept rewriting "Friday (May 22) at 7:30 PM" → "tonight at 7:30 PM", and "Mic status: good" → "Wireless mic status: Mic status: good" (double-prefix). Adding CRITICAL rules to the prompt didn't help.

**Fix pattern:** server-construct the exact string in TypeScript, embed it as a labeled section in the prompt: `"Foo bullet — PRE-WRITTEN, include EXACTLY as shown, no rephrasing, no prefix, no rewording. The bullet is self-labeled:\n${preBuiltBullet}"`. Also include the verbatim bullet in any `fallbackBrief` / degraded-path code so the operator still sees it when Ollama is unreachable. The model is good at copying verbatim text when told to; it just paraphrases free-form generation. Full pattern in `[[feedback-llm-server-built-verbatim]]` memory. Related: `[[feedback-llm-context-overflow]]` for the >8-items hallucination sibling.

### 13. Karaoke at the bars uses BYO mics — never frame bartender docs around it

Standing operator rule (caught mid-doc-write 2026-05-19): the bar's house Shure wireless system is NEVER used for karaoke. Karaoke crews bring their own (BYO) wireless rigs. The house wireless is for paging, hosted events (trivia, MC, in-house entertainment), and the manager's announcement mic. v2.53.7+v2.53.8 fixed ~21 references across `RF_INTERFERENCE_FOR_BARTENDERS.md` + `MIC_NOT_WORKING.md` where "karaoke mic" or "Karaoke" as a channel-label example implied bartenders manage karaoke via the house Shure. They don't.

**When writing bartender-facing content:** use "wireless mic" generic / "page mic" / "hosted-event mic" — never "karaoke mic" as canonical. Acceptable uses: karaoke as a busy-night context ("on a busy karaoke + game night, expect more paging"), or honest disambiguation ("note: karaoke at the bar uses BYO mics, not the house system"). Full guidance in `[[feedback-karaoke-uses-byo-mics]]`.

### 14. ISO build (v3.1.0) — grub.cfg kernel cmdline must be QUOTED, not backslash-escaped

When `build-autoinstall-iso.sh` edits `boot/grub/grub.cfg` to add the autoinstall kernel arg, **use the quoted form `"ds=nocloud;s=/cdrom/server/"`**, NOT the backslash-escape form `ds=nocloud\;s=/cdrom/server/`. The `awk -v` interpolation in the build script strips backslashes silently, leaving `ds=nocloud` alone in the final kernel cmdline — subiquity then ignores the autoinstall config and falls back to the interactive installer. v2.54.92 fix. Any future edit to the grub.cfg injection logic must keep the semicolon inside double quotes.

### 15. ISO build (v3.1.0) — `apt.geoip: true` hangs the unattended install indefinitely

In `autoinstall.yaml.template`, set apt config explicitly:
```yaml
apt:
  fallback: offline-install
  primary:
    - arches: [default]
      uri: "http://archive.ubuntu.com/ubuntu"
```
**Never use `geoip: true`.** Subiquity's geoip lookup tries `geoip.ubuntu.com` over DNS, which on a fresh ISO boot before systemd-resolved is fully up takes 60+ min of timeout-and-retry loops while the install stalls with no visible error. v2.54.95 fix. If a future template change reintroduces `geoip: true`, the install will appear hung on "Mirror selection" forever.

### 16. ISO build (v3.1.0) — `shutdown: poweroff`, not `reboot`

In `autoinstall.yaml.template` top-level: `shutdown: poweroff` (not `reboot`). With `reboot` and the USB still inserted, the BIOS boot-order hits the ISO again, subiquity restarts the install, and if the operator pulls the USB mid-second-install the disk corrupts. poweroff stops the VM/box cleanly so the operator removes USB → powers on → boots the installed system. v2.54.96 fix.

### 17. ISO build (v3.1.0) — install Node 22 + PM2 in `late-commands`, not first-boot

`first-boot-fresh.sh` assumes Node + npm + pm2 are already on PATH when it runs. The subiquity image ships neither, so install them via `late-commands` in `autoinstall.yaml.template`:
```yaml
late-commands:
  - curtin in-target --target=/target -- bash -c 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -'
  - curtin in-target --target=/target -- apt-get install -y nodejs
  - curtin in-target --target=/target -- npm install -g pm2
```
v2.54.97 fix. If installing Node in first-boot instead, the box boots, first-boot service fires, `npm` is not found, service fails, and the box silently never reaches PM2.

### 18. ISO smoke test — Proxmox DHCP arp lag means polling needs ≥15 min, not 5

`smoke-test-autoinstall.sh` post-install poll for the VM's DHCP lease has to wait ≥15 minutes. Proxmox's arp cache doesn't show the new lease until systemd-networkd brings up the interface AND outbound traffic flows (~60-90s after kernel boot — first systemd-resolved query, NTP sync, etc.). v2.54.97 fix. A 5-minute poll loop reports "VM never got DHCP" while the VM is actually running fine.

## Development Workflow

### Standing Rules (MUST follow in every session)

1. **Read docs before work, update docs after.** Read CLAUDE.md + relevant `/docs/*.md` before non-trivial work. After code changes update matching docs (API_REFERENCE if routes changed, HARDWARE_CONFIGURATION if devices, CLAUDE.md if architecture). New feature → new doc. Never claim "docs updated" without actually editing.

2. **Commit + push after completing work.** Verified working (build passes, tests confirm) → commit + push automatically. Software-to-main first, then merge to location. Confirm before destructive git ops (force push, reset, branch delete).

3. **Never break working features during cleanup.** Positive evidence of zero callers/UI refs/scheduled jobs before deleting. When in doubt hide from UI before deleting code. Stage refactors into small verifiable steps; build + PM2 restart + sanity check between each. Never delete DB tables in the same pass as code.

4. **Force-rebuild when Turbo cache lies.** `npm run build` finishes <1s with FULL TURBO + all cached → source did NOT compile. Use `npx turbo run build --force` (or `rm -rf apps/web/.next .turbo && npm run build`) after switching branches or cherry-picking.

5. **"Remember" → update CLAUDE.md too.** Local auto-memory + matching CLAUDE.md section + version bump + commit+push. Details: `docs/CLAUDE_MEMORY_GUIDE.md` → Rule 5.

6. **Always use `scripts/auto-update.sh`.** `bash scripts/auto-update.sh --triggered-by=manual_cli`. Never manual merge/npm ci/PM2 restart — script handles conflicts, DB schema push, backup, Turbo bust, PM2, verify, checkpoints.

7. **Sync memory ↔ CLAUDE.md bidirectionally.** At Checkpoint B + every CLAUDE.md read, diff both ways: CLAUDE.md→memory (save missing rules), memory→CLAUDE.md (promote shared knowledge). Details: `docs/CLAUDE_MEMORY_GUIDE.md` → Rule 7.

8. **Read + CONTRIBUTE to `docs/VERSION_SETUP_GUIDE.md` every update.** At auto-update read target version's Required Manual Steps + execute (or flag). Bumping → write new entry in the same commit. Fixing location error → append to Known Errors & Fixes. Details: `docs/CLAUDE_VERSIONING_GUIDE.md` → Standing Rule 8.

9. **CLAUDE.md is main-only.** Never commit to `CLAUDE.md` from a location branch — it is shared documentation, edits made on a location branch will conflict with main on the next auto-update merge. New rules/gotchas/architecture notes go to `main` first, then propagate via the normal merge. Auto-update's conflict resolver takes main's version of `CLAUDE.md` (since v2.32.26) so any stray location-branch edit will be silently lost on the next merge — do not rely on it surviving.

10. **EVERYTHING stays on latest version (v2.46.3+ — STRENGTHENED 2026-05-18).** Operator rule: every npm dep, OS package, AND local AI model MUST stay on the latest available version, "at any costs." Bump breaking-majors in the working PR and fix the breakage (no longer "defer to dedicated PR"). Specifically:
    - **npm:** every feature batch runs `npm audit fix` AND `npm update`. Once weekly run `npm outdated` and bump every non-pinned dep including breaking-majors — fix breakage in the same PR.
    - **OS:** every fleet box on the latest Ubuntu LTS (currently 24.04 noble — see `docs/FLEET_STATUS.md` + `docs/OS_UPGRADE_RUNBOOK.md`). Monthly check.
    - **Local AI models:** weekly check `ollama list` vs ollama.ai. Pull newer tags for `llama3.1:8b`, `nomic-embed-text`, `qwen2.5:14b`. When a model major-version releases (e.g. `llama3.2:8b`), pull, verify on the RAG grill suite, switch default in `apps/web/src/app/api/chat/route.ts` (~line 52 OLLAMA_MODEL). Re-embed the RAG store after embedding-model majors.
    - **Hardware firmware:** track latest stable for Atlas / Shure / Wolf Pack / Crestron / DirecTV; include current minimums in `docs/NEW_LOCATION_SETUP.md` pre-flight.
    - **Every bump → entry in `docs/VERSION_SETUP_GUIDE.md`** Required Manual Steps so other locations replicate it. Document dep changes one-line in LOCATION_UPDATE_NOTES (what bumped, vulns closed, vulns remaining).

    Rationale: lagging = vuln drift + missing perf/AI capability + crippling catch-up tax later. Operator does not want the system ever falling behind.

11. **Every fix/doc → RAG re-scan (v2.49.10+ — Standing Rule 2026-05-18).** Every commit that touches `CLAUDE.md`, `docs/**/*.md`, `.claude/locations/*.md`, `packages/*/README.md`, memory files at `~/.claude/projects/.../memory/`, drizzle SQL, or anything else indexed by `scripts/scan-system-docs.ts` / `scripts/scan-code-docs.ts` MUST end with a RAG re-scan. Documentation without rescan is invisible to the AI Hub chat — operators ask about the thing we just fixed and the AI doesn't know. Apply at three levels:
    1. **Live session** — after committing a doc fix on main, kick off `nohup npx tsx scripts/scan-system-docs.ts > /tmp/rag-rescan.log 2>&1 &` so it's done by the time the operator next opens the AI Hub. Don't block on completion (~25-40 min) — just queue it.
    2. **Auto-update path** — `scripts/auto-update.sh` should trigger an incremental scan on every successful merge that touched RAG-indexed paths. Operators at every location benefit without manual action. See `scripts/rag-rescan-if-needed.sh` for the path-aware trigger helper (v2.49.10+).
    3. **Weekly cron** — `0 3 * * 0 cd /home/ubuntu/Sports-Bar-TV-Controller && npx tsx scripts/scan-system-docs.ts` as a backstop in case 1+2 miss anything.

    The principle: committing a doc fix without rescanning RAG is like fixing a bug in a service but not restarting it. The fix exists in the repo but the system isn't running the new version.

### Version Bumping (REQUIRED — every commit to main)
Every commit to `main` MUST include a `package.json` version bump (same commit or same push). Code-change-without-bump → locations report matching versions for mismatched code → undebuggable. Minor for features/migrations; patch for bug fixes/docs. Details: `docs/CLAUDE_VERSIONING_GUIDE.md`.

### Making Schema Changes
```bash
# 1. Edit packages/database/src/schema.ts (canonical) or apps/web/src/db/schema.ts (legacy bridge)
# 2. Generate migration file
npx drizzle-kit generate --name <short-description>

# 3. REVIEW the generated drizzle/000N_<name>.sql — Drizzle may propose
#    DROP statements for orphan tables (sdr_*, AudioMessage, etc.) that
#    exist in production but aren't declared in schema.ts. Remove those
#    by hand before commit.

# 4. Commit + push to main. Auto-update.sh on each fleet box runs:
#      scripts/bootstrap-drizzle-migrations.sh  (idempotent marker bootstrap)
#      npx drizzle-kit migrate                  (applies new file)
#    then rebuild + PM2 restart automatically.

# Local-dev one-shot equivalent (if you need to test before push):
bash scripts/bootstrap-drizzle-migrations.sh
npx drizzle-kit migrate
npm run build
pm2 restart sports-bar-tv-controller
```

**NEVER use `npm run db:push` in production flow** after v2.54.1 — push silently aborts on pre-existing indexes, leaving subsequent tables uncreated. Was the root cause of the 2026-05-20 24h NeighborhoodEvent outage. See Gotcha #6.

### Adding New API Endpoints
1. Create route file: `apps/web/src/app/api/your-endpoint/route.ts`
2. Add validation schema to `packages/validation/src/schemas.ts` if needed
3. Add rate limit config to `packages/rate-limiting/src/rate-limiter.ts` if needed
4. Follow the standard API route pattern (see above)
5. Test with appropriate test file in `/tests/integration/`

### Testing Hardware Integrations
`npm run test:hardware` (Wolf Pack/IR/CEC adapters), `npm run test:api -- --testPathPattern=<area>` for targeted route tests. Live device probes go through the existing API routes (e.g. `/api/firetv-devices/[id]/current-app`, `/api/wolfpack/route`) — don't write per-device curl examples here, they rot.

## Key Configuration Files

- `ecosystem.config.js` - PM2 configuration (port 3001, production mode)
- `turbo.json` - Turborepo configuration
- `apps/web/drizzle.config.ts` - Database configuration
- `apps/web/next.config.js` - Next.js configuration
- `.env` or environment variables - API keys, database URL
- `packages/validation/src/schemas.ts` - Centralized validation schemas
- `packages/rate-limiting/src/rate-limiter.ts` - Rate limit configurations

#### 6. Memory Bank System (resume-after-restart snapshots)
Per-host project-state snapshot tool at `apps/web/src/lib/memory-bank/`. Captures git status, modified files, system state. Primarily an operator tool for "SSH session died, what was I doing?" use case. CLI: `npm run memory:snapshot`, `memory:restore`, `memory:list`. API under `/api/memory-bank/*`. **Full details (CLI commands, API endpoints, relationship to the other two memory systems — Claude auto-memory and CLAUDE.md itself) in `docs/CLAUDE_MEMORY_GUIDE.md`.**

#### 7. RAG Documentation Server
**Purpose:** Local documentation search and Q&A using Ollama LLM

**Location:** `apps/web/src/lib/rag-server/`
**Requirements:** Ollama with llama3.1:8b and nomic-embed-text models

**CLI Commands:**
```bash
npm run rag:scan         # Scan all docs into vector store
npm run rag:scan:clear   # Clear vector store and rescan
npm run rag:test         # Test query against indexed docs
```

**API Endpoints:**
- `GET /api/rag/stats` - Vector store statistics
- `POST /api/rag/query` - Query documentation (with optional tech filter)
- `POST /api/rag/rebuild` - Rebuild vector store
- `GET /api/rag/docs` - List indexed documents

**Architecture:**
1. **Document Scanner** (`doc-processor.ts`) - Scans `/docs` folder, chunks documents (750 tokens, 100 overlap)
2. **Vector Store** (`vector-store.ts`) - Stores embeddings with metadata (tech tags, file types)
3. **Query Engine** (`query-engine.ts`) - Retrieves top-k similar chunks, generates LLM answer
4. **Ollama Client** (`ollama-client.ts`) - Interfaces with local Ollama server (port 11434)

**Supported Formats:** Markdown (.md), PDF (.pdf), HTML (.html)

**Usage Example:**
```typescript
import { queryDocs } from '@/lib/rag-server/query-engine'

const result = await queryDocs({
  query: "How do I configure CEC cable box control?",
  tech: "cec" // Optional filter
})
// result.answer: Generated answer from LLM
// result.sources: Source documents used
```

**Tech Tags:** Auto-detected from file content (ai, cec, ir, hardware, testing, auth, etc.)

**Performance:** ~200ms for similarity search, 2-5s for LLM answer generation

#### 8. IR Learning System
**Purpose:** Capture IR codes from physical remotes for cable box control

**Hardware Required:** Global Cache iTach IP2IR

**UI Component:** `apps/web/src/components/ir/IRLearningPanel.tsx`
**API Endpoint:** `apps/web/src/app/api/ir/learn/route.ts`

**Access:** Device Config page → IR tab → Select device → Click "Learn IR" button

**API Endpoints:**
- `POST /api/ir/learn` - Start learning session for a command
- `POST /api/ir/commands/send` - Send learned IR command
- `GET /api/ir/devices/{deviceId}/commands` - Get all commands for device
- `POST /api/ir/commands` - Create new command placeholder
- `DELETE /api/ir/commands/{commandId}` - Delete command

**Learning Flow:**
1. User clicks "Learn" button in IRLearningPanel for a specific command
2. Frontend calls `/api/ir/learn` with device ID, command ID, Global Cache device ID
3. Backend connects to iTach device and sends `get_IRL` command
4. iTach enters learning mode and waits for IR signal (60 second timeout)
5. User points physical remote at iTach IR sensor and presses button
6. iTach captures complete IR code (e.g., `sendir,1:1,1,37764,1,1,342,171,21,83...`)
7. Backend validates code is complete (ends with number, has 6+ segments)
8. Code saved to `IRCommand` table with command ID
9. Frontend reloads command list to show learned code

**Database Schema:**
```typescript
// schema.irCommands table
{
  id: string
  deviceId: string        // Foreign key to IRDevice
  functionName: string    // Command name (e.g., "power", "channel_up")
  irCode: string          // Complete sendir command
  category: string        // "Power", "Volume", "Channel", etc.
  createdAt: string
}
```

**Important:** IR codes must be COMPLETE. Truncated codes will cause `ERR_2:1,010` errors from iTach device. The learning API properly buffers TCP data to ensure complete codes are captured.

**Spectrum Cable Box Note:** Spectrum/Charter disables CEC in firmware. IR learning is the ONLY way to control Spectrum boxes.

#### 8a. Sports Guide Admin Consolidation
Consolidation complete (v2.4.0–v2.4.4). All admin UI lives at `/sports-guide-admin` with 8 tabs. Old URLs (`/sports-guide`, `/sports-guide-config`, `/ai-gameplan`, `/scheduling`) redirect via `next.config.js`. Bartender remote `/remote` is unaffected. **Do not reintroduce** the deleted API routes (full list in `docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md`). Two routes look orphaned but ARE called by internal cron in `packages/scheduler/src/scheduler-service.ts` — keep: `/api/sports-guide/cleanup-old` and `/api/scheduling/live-status`.

#### 9. AI Scheduling Intelligence
**Components:** `pattern-analyzer.ts` (historical viewing → optimal channel assignment), `ai-suggest/route.ts` (Ollama llama3.1:8b, 300s timeout), per-location scheduling preferences, default source config, DJ mode (locks TVs during special events).
**API:** `GET/POST /api/scheduling/preferences`, `GET /api/scheduling/suggestions`, `POST /api/scheduling/apply`.

**Neighborhood RF intelligence stack (v2.51.0+, expanded v2.53.x):** `NeighborhoodEvent` table fed by TWO scrapers running in `packages/scheduler/`:
- **Bananas** (v2.51.0): small-venue live-music gigs at neighbor bars. ~1 mi radius useful.
- **Ticketmaster Discovery API** (v2.53.1): big-venue events (Lambeau, Resch Center, EPIC, Fox Cities PAC, Weidner). Default OFF; activates per-location when `TICKETMASTER_API_KEY` is set. 4× daily, 14-day lookahead, 30-mi radius. Free tier 5000 calls/day, we use ~4.

Both share the source-agnostic downstream pipeline: `preemptive-strike` correlator + shift-brief blurb + RF Pattern Digest. Idempotency key `(source, source_event_id)`. Auto-discovered venues land with `review_status='pending_review'` for operator triage via the v2.53.4 review API + `apps/web/scripts/review-pending-venues.ts` CLI. Both decline (`is_active=false`) AND review_status update atomically per Gotcha #14 / `[[feedback-state-machine-belt-suspenders]]`.

**Cross-encoder reranking (v2.53.0+, RAG pipeline):** `bge-reranker-v2-m3-ONNX` (int8) loads in-process via `@huggingface/transformers`. Default OFF — opt-in per location via `RAG_RERANK_ENABLED=true`. Solves the "bi-encoder retrieves correct chunks but LLM blends adjacent similar chunks" failure mode (e.g., cyan vs yellow banner answers). Requires PM2 `max_memory_restart >= 3G` + `--max-old-space-size=2048` since the ONNX model adds ~600 MB resident memory off-heap. Holmgren is the canary; see `[[feedback-reranker-memory-budget]]` for the full memory model and rollout notes.

**Ollama runtime (fleet-standard at v2.32.57+):** Intel Iris Xe iGPU acceleration via the IPEX-LLM Ollama portable build (replaces the upstream CPU-only Ollama systemd service). Yields ~14 tok/s on `llama3.1:8b` Q4 (vs ~3 tok/s CPU on the same i9-13900HK class hardware) — AI Suggest goes from 3+ min to ~100s. Models live unchanged at `/usr/share/ollama/.ollama/models/` (the IPEX unit reads them via `OLLAMA_MODELS=/usr/share/ollama/.ollama/models` and group permissions). Standardized via `scripts/setup-iris-ollama.sh` — run once per location. Verify with `journalctl -u ollama-ipex | grep "using Intel GPU"`. Not all hardware qualifies — the script checks `clinfo` for an Intel platform and refuses on AMD/Nvidia boxes.

**ESPN sync** runs from `apps/web/src/instrumentation.ts` on startup (30s delay) + every 60min. Covers MLB/NBA/NHL/NFL/CFB/MCBB/WCBB → `game_schedules` table (lowercase league labels). AI Game Monitor's `Schedule` row auto-creates on first use; populate `HomeTeam` table for home-team prioritization (Packers/Bucks/Brewers/Badgers).

**bartender-schedule POST** accepts optional `tvOutputIds: number[]`. Guide tab flow creates allocation then PATCHes; AI-suggest approve sends inline. Lookup: `homeTeamName + awayTeamName + ±1hr window` (special-event fallback when client sends `awayTeam="Unknown"` or `""` v2.32.11). Fails 404 with a sync-pointer message if no match.

**Channel Guide fallback (v2.3.0+):** Rail Media misses regional games (e.g., Brewers on Brewers.TV). After the Rail loop, `POST /api/channel-guide` queries `game_schedules` in the same window and injects any whose `broadcast_networks` resolve to a preset via `stationToPreset` (+ station-alias fallback). Dedup vs Rail by channel + team. `normalizeStation` strips `HD`/`NETWORK`/`CHANNEL`/`-TV` + spaces + dashes — new aliases must normalize to the target preset name.

**WI RSN split (CRITICAL):** `Channel 40` = `FanDuelWI` (Bucks + general WI; ESPN code `FSWI`). `Channel 308` = `BallyWIPlus` (Brewers-only; ESPN tag `Brewers.TV`). Never combine alias bundles or Bucks games route wrong. Canonical lists in `apps/web/src/lib/seed-from-json.ts`.

**ChannelPreset name MUST normalize to one of the alias bundle members for the resolver to bind it (v2.32.58 fix at Holmgren):** `network-channel-resolver.ts:buildStationToPreset` walks each preset and tries to match its `normalizeStation(name)` against every alias in every standard_name's bundle — if a match hits, the standard_name becomes a map key pointing to that preset. For Channel 308 the BallyWIPlus aliases are all `+`-suffixed (`"Bally Sports Wisconsin+"`, `"BSWI+"`, etc.), so the preset itself MUST be named with the trailing `+` (canonical: `"Bally Sports Wisconsin+"`) — without it, BREWERS.TV→BallyWIPlus→preset never connects and Brewers games silently miss the channel-guide injection at game-time. If you find a location's Brewers games not showing on the bartender remote, first check `SELECT name FROM ChannelPreset WHERE channelNumber='308'` — the name must end with `+`.

**Override-learn (v2.18.0):** Manual `/api/matrix/route` with `source='bartender'` within 10min of an alloc → patches alloc's `tv_output_ids` (add if input matches, remove if input differs). SchedulerLog row written with `component='override-learn'`, op `add|remove`, metadata (team/league/isHomeTeam/prev/new). Home-team overrides log at `level='warn'`. `pattern-analyzer.ts` reads these hourly. After 10min window the bartender's change is treated as unrelated, not learned.

#### 9a. Live Channel Mapping (Network → Channel)
`apps/web/src/app/api/sports-guide/live-by-channel/route.ts` holds `NETWORK_TO_CABLE` + `NETWORK_TO_DIRECTV` dicts mapping ESPN broadcast names (e.g. `"FanDuel SN WI"`, `"Brewers.TV"`) → local channel numbers. When a game doesn't appear in live games, capture ESPN's exact network string + add ALL variants to both dicts.

#### 10. Per-location hardware references
Hardware IPs/ports/quirks live per-location in `.claude/locations/<branch>.md` (e.g. `holmgren-way.md`, `graystone.md`, `lucky-s.md`). DB is the source of truth; those files are quick references for operators + Claude. Do NOT put per-location IPs in this file — they drift across locations and pollute the shared template.

**IR port adjustment (applies everywhere):** Learned IR codes have `sendir,1:1,...` hardcoded. The runtime substitutes the device's `globalCachePortNumber` before transmission. For multi-port iTach devices, port assignment matters or the wrong emitter fires.

## Multi-Location Deployment

This system supports multiple sports bar locations. Each location runs its own installation with location-specific data on dedicated git branches.

### Location Branch Convention

| Branch | Purpose |
|--------|---------|
| `main` | Shared code with empty data templates |
| `location/graystone` | Graystone (Green Bay, WI) data |
| `location/holmgren-way` | Holmgren Way (current installation) data |
| `location/lucky-s-1313` | Lucky's data |

### Location-Specific Files (empty templates on main)

These files are replaced with real data on location branches. On `main`
they exist as empty templates that `seed-from-json.ts` handles gracefully
(no-ops) so a fresh clone starts clean. **Never commit populated versions
to `main`** — see the reconciliation commit `7f13fbe7` (2026-04-14) for
the history of what happens when this rule gets broken.

- `apps/web/data/tv-layout.json` — `{"name":"Bar Layout","zones":[],"tvPositions":[],"rooms":[]}`
- `apps/web/data/directv-devices.json` — `{"devices":[]}` (seed-only input; DB is source of truth after first run)
- `apps/web/data/firetv-devices.json` — `{"devices":[]}` (seed-only input)
- `apps/web/data/device-subscriptions.json` — `{"devices":[]}`
- `apps/web/data/wolfpack-devices.json` — `{"chassis":[]}`
- `apps/web/data/channel-presets-cable.json` — `{"presets":[]}` (seeds ChannelPreset table on first run, per-location)
- `apps/web/data/channel-presets-directv.json` — `{"presets":[]}` (same)
- `apps/web/data/everpass-devices.json` — `{"devices":[]}` (if present)
- `apps/web/data/atlas-configs/` — Audio processor configs (gitignored, never on main)
- `apps/web/public/uploads/layouts/` — Floor plan images (gitignored)
- `data/` mirrors at repo root — Root copies of the above (gitignored via `data/*.json` with `!data/*.template.json` exception)
- `.env` — `LOCATION_ID`, `LOCATION_NAME`, `AUTH_COOKIE_SECURE`, `SPORTS_GUIDE_USER_ID`, API keys (gitignored)

### Auth bootstrap (critical per-location step)

Per-location install also requires seeding the `Location` row and
`AuthPin` rows in `production.db`, plus setting `LOCATION_ID` in `.env`,
or every login attempt returns "Invalid PIN". See
`docs/NEW_LOCATION_SETUP.md` for the full runbook and use
`scripts/bootstrap-new-location.sh` to automate steps 4-5:

```bash
bash scripts/bootstrap-new-location.sh \
  --name "Your Bar Name" \
  --admin-pin 7819 \
  --staff-pin 1234
```

The script is idempotent — safe to re-run. It creates the Location row
if missing, seeds STAFF and ADMIN PINs if missing, and writes
`LOCATION_ID` / `AUTH_COOKIE_SECURE=false` into `.env`. `AUTH_COOKIE_SECURE`
must be `false` on HTTP-only LAN deployments; browsers silently drop
`Secure` cookies on `http://` origins, so setting it `true` on HTTP
causes login to "succeed" but every subsequent request to look
unauthenticated.

### Workflow: Pulling Code Updates to a Location

**Preferred:** let `scripts/auto-update.sh` handle it. The orchestrator
has a `LOCATION_PATHS_OURS` conflict auto-resolver that keeps the
location's data files and applies main's software changes, backed up by
Claude Code CLI review at three checkpoints. Configure and enable it
via the Sync tab UI. See `docs/AUTO_UPDATE_SYSTEM_PLAN.md`.

**Manual fallback** (when auto-update isn't available):

```bash
git checkout location/<name>
git fetch origin
git merge origin/main
# On conflict with data files → keep the location version:
#   git checkout --ours apps/web/data/<file>
#   git checkout --theirs package-lock.json package.json
npm ci
npx drizzle-kit migrate  # apply pending migrations (was: push, switched in v2.54.1)
npm run build
pm2 restart sports-bar-tv-controller --update-env
# Check logs for auto-seed: pm2 logs sports-bar-tv-controller --lines 20
# Look for: "[SEED] Seeded X DirecTV devices from JSON"
```

### Commit Strategy (IMPORTANT — this was broken historically and led to the v2.4.x drift)
- **Software changes** (code in `apps/web/src/`, `packages/`, docs, scripts) → commit to `main` first, then merge into location branches
- **Location-specific data** (device IPs, configs in `apps/web/data/*.json`, `.env`, layout images) → commit ONLY to the location branch
- **Never merge location branches back into main** — location data must not leak to other locations
- When making changes on a location branch, always split: software first to main, then merge main into location, then commit location data
- **If you find yourself editing a software file on a location branch**, stop, cherry-pick the change to main first, push main, then merge main into location. The reconciliation work in commit `7f13fbe7` is what happens when you don't.
- **Always pull before pushing to main** — run `git fetch origin main && git merge origin/main` before committing and pushing to `main`. Other locations or sessions may have pushed changes while you were working. Pushing without pulling risks rejected pushes or overwrites.

### Shared Location Reference Docs

See `.claude/locations/` for per-location details (device IPs, input maps, channel numbers).

## Documentation References

- **Fleet Status (single source of truth):** `/docs/FLEET_STATUS.md` — per-location OS / version / iGPU / outstanding work.
- **OS Upgrade Runbook:** `/docs/OS_UPGRADE_RUNBOOK.md` — step-by-step jammy → noble for the 3 fleet boxes still on 22.04.
- API Reference: `/docs/API_REFERENCE.md`
- Hardware Setup: `/docs/HARDWARE_CONFIGURATION.md`
- IR Learning Demo: `/docs/IR_LEARNING_DEMO_SCRIPT.md`
- IR Emitter Placement: `/docs/IR_EMITTER_PLACEMENT_GUIDE.md`
- CEC → IR Migration (historical): `/docs/CEC_TO_IR_MIGRATION_GUIDE.md`
- Soundtrack Integration: `/docs/SOUNDTRACK_INTEGRATION_GUIDE.md`
- Authentication: `/docs/AUTHENTICATION_GUIDE.md`
- Wolf Pack HTTP API: `/docs/WOLFPACK_HTTP_API_REFERENCE.md`
- OBSBOT Tail 2 Plan: `/docs/OBSBOT_TAIL_2_PLAN.md`
- UI Styling Guide (dark theme): `/docs/UI_STYLING.md` — recommended pattern for new dashboard components.

## Bartender Remote - iPad/Tablet UI

**IMPORTANT:** The bartender remote (`/remote` on port 3002) is used on iPads and tablets behind the bar. All bartender-facing UI must be touch-screen friendly:

- **Minimum touch targets:** 44x44px (Apple Human Interface Guidelines)
- **Checkboxes:** At least `h-5 w-5`, wrapped in tappable containers with `py-2 px-3` padding
- **Buttons:** Generous padding, never icon-only without adequate tap area
- **Text size:** `text-sm` minimum for interactive elements (not `text-xs`)
- **Spacing:** `gap-2` minimum between tappable elements to prevent accidental taps
- **Port 3002 (Nginx proxy — fleet-standard at v2.32.57+):** Nginx reverse proxy on port 3002 forwards to the Next.js app on port 3001 with a route allow-list (admin pages return 403). The `/api/scheduling/` block has `proxy_read_timeout 300s` so AI Suggest's Ollama call (90-200s on iGPU) doesn't 504. Standardized via `scripts/setup-bartender-nginx.sh` — run once per location. Replaced the previous Node `apps/web/bartender-proxy.js` PM2 app (still in `ecosystem.config.js` for backwards-compat at locations that haven't migrated yet; the setup script does `pm2 delete bartender-proxy && pm2 save` to remove it).
- **Test viewport:** ~768px-1024px width for tablet layouts
- **Music Tab:** Shows all playlists with artwork tiles, Now Playing displays album art
