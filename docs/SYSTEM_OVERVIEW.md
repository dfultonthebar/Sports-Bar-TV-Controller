# Sports Bar TV Controller — System Overview

> **This document is the AI Hub's "I know what I am" anchor.** When operators
> ask "what is this system?", "what do you know?", "what features do we have?",
> "what hardware is at our bar?", "what can you help me with?" — semantic
> search on the RAG store should retrieve this document first. It exists to
> give the local AI assistant a grounded answer to self-introspection
> questions instead of falling back to generic large-language-model answers.

**Last indexed:** 2026-05-19 02:53 UTC
**System version (at write time):** v2.49.3
**Live locations:** 6 (Holmgren Way, Graystone, Lucky's 1313, Stoneyard Greenville, Stoneyard Appleton, Leg Lamp)

---

## What this system is (one paragraph)

The Sports Bar TV Controller is a self-hosted full-stack control plane for
managing all audio/video equipment at a sports bar location — HDMI matrix
switching, audio processor zone control, cable / satellite / streaming
device control, RF wireless-microphone monitoring, lighting / DMX,
commercial music streaming, and live sports scheduling. It is built on
**Next.js 16** (App Router), **Turborepo + npm workspaces**, **Drizzle ORM
on SQLite**, **PM2 + Nginx** for process / proxy management, and a local
**Ollama LLM** (llama3.1:8b on Intel Iris Xe iGPU via IPEX-LLM) for
AI-assisted scheduling and the operator chat assistant. Each bar runs its
own instance on dedicated local hardware (Intel NUC class). Multi-location
deployment is managed via git branches (one `location/<name>` branch per
venue) with a shared `main` branch holding the code template. A nightly
auto-update orchestrator merges new code into each location with three
Claude-Code-CLI safety checkpoints (A/B/C).

---

## At a glance — the numbers

- **Live locations:** 6 — Holmgren Way (Green Bay, WI), Graystone (Green Bay, WI), Lucky's 1313, Stoneyard Greenville, Stoneyard Appleton, Leg Lamp
- **Hardware classes integrated:** 15+ (HDMI matrix, audio DSP, CEC adapter, IR blaster, IP TV/satellite receivers, ADB streaming devices, wireless mic receiver, SDR spectrum monitor, DMX lighting, smart TVs via SmartThings, Crestron DM matrix, Multi-View video cards, projectors, audio commercial-music streaming, weather/sports APIs)
- **API endpoints:** ~356 route handlers under `apps/web/src/app/api/**/route.ts`
- **Shared packages:** 37 — `ls packages/` for the live list. Hardware vendor packages: `atlas`, `bss-blu`, `crestron`, `dbx-zonepro`, `directv`, `firecube`, `htd`, `ir-control`, `multiview`, `shure-slxd`, `soundtrack`, `wolfpack`. Cross-cutting: `ai-tools`, `auth`, `cache-manager`, `circuit-breaker`, `commercial-lighting`, `config`, `data`, `database`, `dmx`, `layout-detection`, `logger`, `memory-bank`, `rag-server`, `rate-limiting`, `scheduler`, `security`, `services`, `sports-apis`, `streaming`, `tv-docs`, `tv-guide`, `tv-network-control`, `ui-utils`, `utils`, `validation`
- **Database tables:** 110 (source: `packages/database/src/schema.ts`)
- **RAG store chunks:** ~5,500+ post v2.48.x rescan (Markdown + PDF + HTML docs, plus optional source-code awareness via `scripts/scan-code-docs.ts`)
- **Local AI model:** **llama3.1:8b** running on **Intel Iris Xe iGPU** via the IPEX-LLM Ollama portable build (~14 tok/s vs ~3 tok/s CPU-only)
- **Embedding model:** **nomic-embed-text** (also via Ollama, same host)
- **Production DB:** `/home/ubuntu/sports-bar-data/production.db` (better-sqlite3)
- **Admin port:** 3001 (Next.js)
- **Bartender remote port:** 3002 (Nginx reverse-proxy → 3001 with route allow-list)
- **Ollama port:** 11434 (loopback only)

---

## What the AI Hub knows about

The local RAG store has indexed the full `docs/` tree plus `CLAUDE.md`,
`packages/*/README.md`, `.claude/locations/*.md`, and per-feature design
docs. This section is a complete topical inventory so semantic search has a
high-IDF anchor for every system concern. **I (the AI Hub) can answer
questions about all of the following.**

### Audio processors

I know about the following audio DSP families integrated into the system:

- **AtlasIED Atmosphere AZM4 / AZM8** — TCP port 5321 (JSON-RPC commands) and UDP port 3131 (subscribed meter pushes). Property pattern: `SourceMeter_N`, `ZoneMeter_N`, `GroupMeter_N` reporting dB. Holmgren Way runs an AZM8 on firmware 4.5.18. There is a **firmware 4.5 "Custom Priority Volume" gotcha** (CLAUDE.md §7) where priority events pin zone gain to a fixed low level that looks identical to a real drop. Always check the Atlas GUI → Sources → Priority before debugging the drop watcher. Atlas firmware exposes NO queryable "priority active" parameter — priority is inferred from mic-named input meter levels (`/\b(mic|juke|page|intercom|priority)\b/i`) plus unexpected `ZoneSource_X` source changes. Package: `@sports-bar/atlas`.
- **dbx ZonePRO 640m / 641m / 1260m / 1261m** (M-series only) — TCP port 3804, HiQnet protocol. **CRITICAL:** raw HiQnet frames over TCP, no F0/64/00 prefix, no checksum, fire-and-forget. Object IDs are installation-specific. Volume range 0-415 (UWORD). Opening a new TCP connection triggers built-in failsafe mode that shifts source indices — `DbxTcpClient` always recalls Scene 1 on connect to counteract. Lucky's 1313 runs a dbx ZonePRO 1260m @ 192.168.10.50. Package: `@sports-bar/dbx-zonepro`.
- **BSS Soundweb London** — HiQnet over TCP 1023. Package: `@sports-bar/bss-blu`.
- **HTD (Home Theater Direct) multi-zone amps** — Package: `@sports-bar/htd`.

### Wireless microphone receivers

- **Shure SLX-D wireless mic receivers** — TCP port 2202, ASCII line protocol (`< VERB CHAN PROP VAL >`). **Wire-protocol property name gotcha:** the receiver uses `TX_MODEL` (NOT `TX_TYPE`) and `GROUP_CHANNEL` (NOT `GROUP_CHAN`) — case-statements in the client matter. Holmgren runs Shure SLXD4D on firmware 1.4.7.0. The system performs **RF interference detection** by watching for the "ghost-carrier signature": `TX_TYPE='UNKNOWN'` AND `RSSI ≥ -85 dBm` sustained 3 consecutive samples (hysteresis: clear at ≤ -95 dBm × 3). When RF interference fires concurrently with an Atlas priority event, the priority event is re-classified as `rf_induced_mic_active` so operators stop chasing ghost overrides during ENG / mobile-broadcast events near the venue. A cyan banner appears on the bartender Audio tab. Front-panel gate **`Menu → Advanced → Network → Allow Third-Party Controls`** must be ENABLED — defaults to blocked. **No `SCAN` command exists in firmware 1.4.7.0** (16 candidate variants probed, all returned `< REP ERR >`); use front-panel Group Scan or the software `POST /api/shure-rf/find-clean-freq` workaround. Package: `@sports-bar/shure-slxd`. Logs to `/home/ubuntu/sports-bar-data/logs/shure-rf-YYYY-MM-DD.log`.

### RF / SDR

- **NESDR Smart / RTL-SDR v3 USB dongles** — Wide-band RF spectrum monitor complementing the Shure receiver's narrow per-channel view. Coverage 25 MHz – 1.7 GHz. Watcher spawns `rtl_power -f <start>M:<end>M:25k -i 1 -e 0 -g 25` and parses CSV per minute. Bucketed per-minute spectrum data goes to the `sdr_spectrum` table; carrier rising/falling-edge events go to `sdr_carriers`. Setup is a one-time `sudo bash scripts/setup-sdr.sh` (apt installs rtl-sdr, blacklists the kernel DVB-USB driver, appends `SDR_ENABLED=auto` to `.env`). `SDR_BAND_PRESET=auto` (default) follows the actual Shure receiver frequencies; presets: `uhf-wireless` (470-700 MHz), `full-uhf` (470-960 MHz), `custom`. Cross-confirms Shure RF events — when matched within ±60s and ±50 kHz, the event gets `(SDR-confirmed, SDR peak X dBm)` in its note and a purple badge in the UI. UI surface: `/device-config → Audio → Wireless Mics → RF Spectrum Monitor` (waterfall with our Shure freqs as cyan lines + Green Bay TV station edges WCWF / WLUK as dashed white lines).

### HDMI matrix switchers

- **Wolf Pack 4K HDMI matrix** (WP-8X8, WP-16X16, WP-36X36, WP-48-port) — **HTTP web API ONLY** (TCP port 5000 is non-functional on all tested units — it answers OK to garbage but never switches). HTTP flow: `POST http://<ip>/login.php` form-encoded `username=admin&password=admin`, then `GET http://<ip>/get_json_cmd.php?cmd=o2ox&prm={input_0based},{output_0based},` with session cookie. **CRITICAL `outputOffset` gotcha** (CLAUDE.md §4): the chassis can be sold single-card OR multi-card; offset is per-card on multi-card. Single-card MUST be `outputOffset=0` (silently misroutes if wrong — Lucky's 1313 shipped with offset=26 for weeks). Single-card locations opt in via `MATRIX_SINGLE_CARD=true` in `.env`; `verify-install.sh` enforces. Package: `@sports-bar/wolfpack`.
- **Crestron DM / HD-MD / DMPS / NVX series** — Telnet / CTP / CIP control. **Output slot offset gotcha:** DM 8x8 / 16x16 outputs start at 17, 32x32 at 33, 64x64 at 65 — add the offset before issuing routing commands. Package: `@sports-bar/crestron`.
- **Wolf Pack Multi-View Quad-View cards** (HDTVSupply 4K60) — RS-232 USB (115200 8N1), 8 display modes (single → quad), hex frame format. DB: `WolfpackMultiViewCard`. Package: `@sports-bar/multiview`.

### Source / playback devices

- **DirecTV IP receivers** — HTTP API on port 8080. Holmgren has 6 (10.11.3.42 – 10.11.3.47). Graystone has 8 (192.168.5.121 – 128). Package: `@sports-bar/directv`. Device configs auto-seed from `apps/web/data/directv-devices.json` on first run; DB is source of truth after that.
- **Amazon Fire TV Cubes (3rd Gen / AFTR / AFTR2)** — ADB over TCP port 5555. Holmgren has 5 (`10.11.3.48-.51`, one is "Atmosphere TV" for background visuals). Streaming app launch via `am start -n <package>/<activity>`. **AFTR / PVFTV Cubes gotcha** (CLAUDE.md §9): Prime Video is launcher-hosted, no `com.amazon.avod` package — `com.amazon.firebat` is the package alias; routes via `LandingActivity`. **3s ADB-shell timeout was silently truncating `uiautomator dump`** on launcher home screens (fixed v2.32.89 — walker now passes `timeoutMs=10000`). Package: `@sports-bar/firecube`.
- **Spectrum / Charter cable boxes** — **IR ONLY**. Spectrum disables CEC in firmware; Wolf Pack doesn't pass CEC through anyway. Controlled via Global Cache iTach IP2IR (TCP port 4998). IR codes captured via the IR Learning Panel (UI: Device Config → IR tab → Learn IR) using `get_IRL` command on the iTach, 60s capture window. Codes stored in `IRCommand` table; `sendir,1:1,...` runtime-substituted to use the device's actual `globalCachePortNumber` on multi-port iTachs. Holmgren has 2 iTachs (10.11.3.40 + 10.11.3.41) controlling 4 Spectrum boxes. Package: `@sports-bar/ir-control`.
- **Pulse-Eight USB CEC adapter** — historical; cable-box CEC is dead (see above). Package: still present but no new features added.

### Display devices

- **Samsung Tizen TVs** — SmartThings cloud API + WoL for power. REST identity at `http://<tv-ip>:8001/api/v2/` returns `modelName`, `PowerState`, MAC, firmware. `KEY_POWER` is a TOGGLE on Samsung — bulk-power off pre-probes via `PowerState` and only sends to TVs currently `on`. **Do NOT use TCP-connect-to-port-8002 to decide if a TV is on** (modern Samsungs keep WS port open in network standby). Holmgren has 24 Samsung TVs (10.11.3.1 – 10.11.3.27). Common Samsung MAC OUIs: `2c:99:75`, `1c:86:9a`, `28:af:42`, `c8:a6:ef`, `b8:b4:09`. WoL fails silently if the MAC OUI in the DB isn't Samsung.
- **VAVA projector** — present at Holmgren. **CAUTION:** power-off / sleep kills the NIC; power-off is BLOCKED in code.
- **Epson projectors** — present at Holmgren (10.11.3.14, currently offline per scheduler logs).
- **TV Network Control** — generic IP TV control package: `@sports-bar/tv-network-control`.

### Lighting / DMX

- **PKnight CR011R ArtNet DMX controller** — Universe 1. Holmgren has one. Package: `@sports-bar/dmx`.
- **Commercial lighting integrations** (Lutron, Philips Hue) — Package: `@sports-bar/commercial-lighting`.

### Music / streaming

- **Soundtrack Your Brand** — commercial bar music streaming. API integration includes now-playing display, play / pause from bartender remote. Package: `@sports-bar/soundtrack`.

### Sports data / TV guide

- **ESPN sync** — runs from `apps/web/src/instrumentation.ts` on startup (30s delay) and every 60 min. Covers MLB / NBA / NHL / NFL / CFB / MCBB / WCBB → `game_schedules` table.
- **Rail Media (Sports Guide API)** — per-location `SPORTS_GUIDE_USER_ID` in `.env`. Channel guide injection. Misses regional games; the channel-guide fallback queries `game_schedules` in the same window and injects via `stationToPreset`.
- **NFHS Network** — high-school sports catalog (`com.playon.nfhslive`). Walker emits sport label (`Junior Varsity Girls Soccer` etc.) so games with identical titles show as distinct rows on the bartender remote.
- **Live Channel Mapping** — `NETWORK_TO_CABLE` + `NETWORK_TO_DIRECTV` dicts in `apps/web/src/app/api/sports-guide/live-by-channel/route.ts` map ESPN broadcast names to local channel numbers. WI RSN split is CRITICAL: Channel 40 = `FanDuelWI` (Bucks + general WI, ESPN code `FSWI`); Channel 308 = `BallyWIPlus` (Brewers-only, ESPN tag `Brewers.TV`). ChannelPreset name MUST end with `+` for Brewers games to bind to the preset. Package: `@sports-bar/sports-apis`, `@sports-bar/tv-guide`.

### Local AI

- **Ollama LLM server** — port 11434, models `llama3.1:8b` (default) and `nomic-embed-text` (embeddings). Fleet-standard since v2.32.57 is the **IPEX-LLM Ollama portable build** for Intel Iris Xe iGPU acceleration (~14 tok/s vs ~3 tok/s CPU). Standardized via `scripts/setup-iris-ollama.sh`. Models live at `/usr/share/ollama/.ollama/models/`. AI Suggest cold-run timings on iGPU range from 67s (Stoneyard Appleton, fleet best) to 170s (Graystone) for `llama3.1:8b`. `qwen2.5:14b` also accelerates on the iGPU (6.1 tok/s, ~150-180s total) — kept available as `OLLAMA_MODEL` override but not default. **`ollama ps` reports `size_vram=0GB` even when GPU-loaded** — this is a known IPEX-LLM / SYCL quirk; verify GPU use with `intel_gpu_top`.
- **Pattern Digest (Tier 1 AI grounded by RAG)** — RAG-grounded summary generator. Pulls from `shure_rf_events`, `sdr_carriers`, `atlas_drop_events`, `atlas_priority_events` and writes operator-facing pattern recommendations. Lives under `/api/ai/...`.
- **N8N** — workflow automation host (separate from the Next.js app). Used for scheduling automations the in-app scheduler doesn't cover.

### Authentication

- **NextAuth.js 4.24.11 with custom PIN-based authentication.** Sessions stored in the database (not JWT). PINs bcrypt-hashed in the `AuthPin` table. Per-location `LOCATION_ID` set in `.env` binds the PIN namespace. **`AUTH_COOKIE_SECURE` MUST be `false`** on HTTP-only LAN deployments (browsers silently drop `Secure` cookies on `http://` origins). API keys for external integrations stored in the `ApiKey` table. Package: `@sports-bar/auth`.

### Validation / rate limiting

- **`packages/validation`** — Zod schemas under `src/schemas.ts`. Utilities: `validateRequestBody()`, `validateQueryParams()`, `validatePathParams()`. **CRITICAL pattern:** never call `request.json()` after `validateRequestBody()` — the body stream has already been consumed. Use `bodyValidation.data` instead.
- **`packages/rate-limiting`** — `withRateLimit(request, RateLimitConfigs.DEFAULT)` wraps every API endpoint.

### Observability / logging

- **`packages/logger`** — Component-tagged logger: `logger.info('[COMPONENT] message', { context })`. Component tags like `[CEC]`, `[MATRIX]`, `[IR]`, `[ATLAS]`, `[SHURE]`, `[SDR]` are searchable in PM2 logs.
- **Enhanced Logger** — `packages/logger/src/enhanced-logger.ts` stores logs in the database for the System Admin analytics view.
- **PM2** — process manager. Single app: `sports-bar-tv-controller`. Logs at `/home/ubuntu/.pm2/logs/sports-bar-tv-controller-out.log`.
- **Dedicated subsystem log files** — `/home/ubuntu/sports-bar-data/logs/shure-rf-YYYY-MM-DD.log` (daily rotation, 30-day retention).

---

## Locations served

Each bar is a separate git branch off `main`. The DB at each location is
the source of truth for device configs; JSON files (`apps/web/data/*.json`)
are only used as seed data on first startup. **CLAUDE.md is shared across
all locations** — never commit location-specific edits to it.

### Holmgren Way (Green Bay, WI) — reference deployment

- **Branch:** `location/holmgren-way`
- **Subnet:** 10.11.3.0/24
- **Hardware:** Intel NUC i9-13900HK, Iris Xe iGPU, 32 GB RAM, Ubuntu 24.04 noble, kernel 6.8.0-111
- **Matrix:** Wolf Pack 48-port (multi-card layout; outputs 37-40 are AUDIO-ONLY, not video displays)
- **Audio:** AtlasIED AZM8 audio processor on TCP 5321
- **RF monitoring:** Shure SLXD4D wireless mic receiver, NESDR Smart SDR
- **Displays:** 24 Samsung Tizen TVs (10.11.3.1 – 10.11.3.27), 1 VAVA projector (power-off blocked), 1 Epson projector (10.11.3.14)
- **Sources:** 4 Spectrum cable boxes (via 2 iTach IP2IRs at 10.11.3.40 + 10.11.3.41), 6 DirecTV receivers (10.11.3.42 – 10.11.3.47), 4 Fire TV Cubes (10.11.3.48 – 10.11.3.51, one is Atmosphere TV)
- **Lighting:** PKnight CR011R ArtNet DMX (universe 1)
- **AI model:** llama3.1:8b
- **Auth:** STAFF / ADMIN PINs seeded via `scripts/bootstrap-new-location.sh`
- **Known issue:** Fire TVs at 10.11.3.48 + .49 are failing hardware on the swap list — ADB errors are NOT bugs to debug.
- **Reference doc:** `.claude/locations/holmgren-way.md`

### Graystone (Green Bay, WI)

- **Branch:** `location/graystone`
- **Hardware:** Intel NUC i5-1340P, Iris Xe iGPU (a7a0), 16 GB RAM (smaller box), Ubuntu 24.04
- **Matrix:** Wolf Pack WP-36X36 multi-card, IP 192.168.5.100
- **Audio:** Atlas AZM8 on matrix input 17 (Atmosphere / background audio)
- **Cable:** Spectrum / Charter (CEC disabled in firmware — must use IR via iTachs `f9d60b91` and `6f5d1b25`)
- **Sources:** 4 Spectrum cable boxes (matrix inputs 1-4), 8 DirecTV receivers (192.168.5.121 – 128, matrix inputs 5-12), 4 Fire TV Cubes (192.168.5.131 – 134, matrix inputs 13-16), 3 wall-plate HDMI passthroughs (inputs 18-20)
- **Displays:** 24 TVs across 4 rooms — Dining Room (TVs 1-7), Main Bar (TVs 8-18, 21), Niagra Room (TVs 19-20), Redbird Room (TVs 22-24)
- **Channel reference:** ESPN 27 / ESPN2 28 / TNT 29 / Big Ten 39 / FS1 75 on Spectrum; ESPN 140 / ESPN2 143 / FS1 150 on DirecTV
- **Rail Media userId:** 258351 (env: `SPORTS_GUIDE_USER_ID`)
- **Reference doc:** `.claude/locations/graystone.md`

### Lucky's 1313

- **Branch:** `location/lucky-s-1313`
- **Hardware:** Intel NUC i9-13900HK, Iris Xe, 32 GB RAM, Ubuntu 24.04
- **Matrix:** Wolf Pack WP-36X36 **single-card** (`outputOffset=0`, `MATRIX_SINGLE_CARD=true` enforced)
- **Audio:** dbx ZonePRO 1260m @ 192.168.10.50 — 6 zones, source index map specific to Lucky's wiring (Main Bar = Ch1 / `0x0105001F`, Banquet = Ch2 / `0x01050020`)
- **Per-location notes:** Has its own Rail Media `SPORTS_GUIDE_USER_ID`; channel numbers differ from Graystone (different cable market); NETWORK_TO_CABLE / NETWORK_TO_DIRECTV dicts maintained per-location
- **Reference doc:** `.claude/locations/lucky-s-1313.md`

### Stoneyard Greenville

- **Branch:** `location/stoneyard-greenville`
- **Hardware:** Intel NUC i9-13900HK, Iris Xe (a7a0), 32 GB RAM, Ubuntu 24.04
- **Matrix:** Wolf Pack WP-36X36 **multi-card**, `outputOffset` per-card, audio outputs = 4 from the matrix
- **Notes:** `MATRIX_SINGLE_CARD` MUST NOT be set in `.env`
- **AI Suggest cold-run:** ~119s on iGPU
- **Reference doc:** `.claude/locations/stoneyard-greenville.md`

### Stoneyard Appleton

- **Branch:** `location/stoneyard-appleton`
- **Hardware:** Intel NUC i9-13900HK, Iris Xe (a7a0), 32 GB RAM, Ubuntu 24.04
- **Matrix:** Wolf Pack **multi-card**, `outputOffset` per-card per physical wiring, audio outputs = 4
- **AI Suggest cold-run:** 67.3s on iGPU (fleet best)
- **Notes:** `MATRIX_SINGLE_CARD` MUST NOT be set in `.env`
- **Reference doc:** `.claude/locations/stoneyard-appleton.md`

### Leg Lamp

- **Branch:** `location/leg-lamp`
- **Hardware:** Intel NUC i9-13900HK, Iris Xe, 32 GB RAM, Ubuntu 24.04
- **Matrix:** Wolf Pack **single-card** (`MATRIX_SINGLE_CARD=true`, `outputOffset=0` enforced)
- **Audio:** 0 outputs from the matrix (audio routes via DSP if any)
- **Notes:** Recommended canary location for `auto-update.sh` (Phase 3) — see `scripts/canary-config.json`
- **Reference doc:** `.claude/locations/leg-lamp.md`

---

## Operational concepts the AI knows about

Topics the operator can ask me about and expect grounded answers.

### Auto-update orchestrator (`scripts/auto-update.sh`)

The canonical update pipeline. Detects current branch, pulls `main`,
merges into the location branch using a `LOCATION_PATHS_OURS` conflict
auto-resolver (location data files keep the location version, software
files take main's), runs `npm ci`, `drizzle-kit push`, `npm run build`,
restarts PM2 with `--update-env`, runs `verify-install.sh` (7 layers:
`pm2_online`, `health_http`, `metrics_http`, `bartender_proxy`,
`critical_tables`, `matrix_config`, `crash_logs`). Three Claude Code CLI
checkpoints (A/B/C) gate the run: Checkpoint A pre-update review,
Checkpoint B mid-update state diff, Checkpoint C post-update verify. On
any failure the orchestrator rolls back to the pre-merge SHA. A heartbeat
sidecar at `/home/ubuntu/sports-bar-data/.auto-update-last-success.json`
survives branch switches so the drift-recovery code in v2.32.81/.82 can
detect a box left on `main` and switch back to its `location/*` branch
automatically.

### Standing Rules 1-10 (apply every session)

1. Read docs before non-trivial work, update docs after.
2. Commit + push after completing verified-working work.
3. Never break working features during cleanup — positive evidence of zero callers before deleting.
4. Force-rebuild when Turbo cache lies — `npx turbo run build --force` after branch switches or cherry-picks.
5. "Remember" → update CLAUDE.md too. Bidirectional sync between local auto-memory and CLAUDE.md.
6. Always use `scripts/auto-update.sh` — never manual merge / npm ci / PM2 restart.
7. Sync memory ↔ CLAUDE.md bidirectionally at Checkpoint B + every CLAUDE.md read.
8. Read and CONTRIBUTE to `docs/VERSION_SETUP_GUIDE.md` every update.
9. CLAUDE.md is main-only — never commit edits to it from a location branch.
10. **EVERYTHING stays on latest version** — npm deps, OS packages, Ollama models. Run `npm audit fix` + `npm update` every feature batch; weekly `npm outdated` and bump breaking-majors; weekly check `ollama list` vs ollama.ai; monthly OS upgrade check; track latest stable for Atlas / Shure / Wolf Pack / Crestron / DirecTV firmware.

### Per-location commit strategy

- **Software changes** (code in `apps/web/src/`, `packages/`, docs, scripts) → commit to `main` first, then merge into location branches.
- **Location-specific data** (device IPs, configs in `apps/web/data/*.json`, `.env`, layout images) → commit ONLY to the location branch.
- **NEVER merge location branches back into main** — location data must not leak to other locations.
- Always `git fetch origin main && git merge origin/main` before pushing to main.

### Bartender remote on port 3002 (Nginx proxy)

Nginx reverse-proxy in front of Next.js on 3001 with a route allow-list
(admin pages return 403 to keep them off the bartender iPad). The
`/api/scheduling/` block has `proxy_read_timeout 300s` so AI Suggest's
Ollama call (90-200s on iGPU) doesn't 504. Standardized via
`scripts/setup-bartender-nginx.sh` — run once per location. **When adding
a new `/api/foo/` route** that needs to be reachable from the bartender,
add it to the Nginx allow-list AND re-run the script — otherwise it
returns 403 on :3002.

iPad / tablet UI constraints: minimum 44x44px touch targets (Apple HIG),
checkboxes at least `h-5 w-5` with `py-2 px-3` padding, `text-sm` minimum
on interactive elements, `gap-2` minimum between tappable elements.

### Atlas drop watcher + priority watcher

- **Atlas drop watcher** — polls zone gain every 30s, fires on ≥15-point drop landing ≤10. Writes `atlas_drop_events` rows.
- **Atlas priority watcher** — polls input meters every 5s, fires when any input matching `/\b(mic|juke|page|intercom|priority)\b/i` crosses −45 dB. Writes `atlas_priority_events` rows.
- Both watchers write `event_type='startup'` rows on boot so the table proves they're alive even with no real events.
- A banner appears at the top of the bartender remote audio tab while a priority event is active.
- **Cache pattern:** long-running poll watchers must update `lastSeen` IMMEDIATELY after the read, not at the end after conditional INSERTs (v2.42.1 lesson — 50 false drops at Holmgren before the fix).

### SDR cross-confirmation of Shure RF events

When `shure-rf-watcher` fires `rf_interference`, it queries `sdr_carriers`
within ±60s at the same freq (±50 kHz tolerance). If matched, the event's
`note` gets `(SDR-confirmed, SDR peak X dBm)`. UI shows a purple
"SDR-confirmed" badge on event-history rows. The Ollama Pattern Digest
weights these higher when recommending mitigation. When BOTH the Shure RF
banner (cyan) and the Atlas priority banner (amber) fire simultaneously,
the priority event is RF-induced — operators stop chasing ghost overrides.

### AI Scheduling Intelligence

- **AI Suggest** — Ollama llama3.1:8b, 300s timeout. Per-location scheduling preferences, default source config, DJ mode (locks TVs during special events).
- **Pattern Analyzer** — historical viewing → optimal channel assignment. Reads `SchedulerLog` override-learn rows hourly.
- **Override-learn** — manual `/api/matrix/route` calls with `source='bartender'` within 10 min of an alloc patch the alloc's `tv_output_ids`. SchedulerLog row written with `component='override-learn'`.
- **AI Game Plan** — auto-builds nightly schedule from `game_schedules`, `HomeTeam`, `ChannelPreset`, viewing preferences.
- API: `GET/POST /api/scheduling/preferences`, `GET /api/scheduling/suggestions`, `POST /api/scheduling/apply`.

### RAG document indexing (`scripts/scan-*.ts`)

- **`scripts/scan-system-docs.ts`** — indexes the full `docs/` tree, `CLAUDE.md`, `packages/*/README.md`, `.claude/locations/*.md`.
- **`scripts/scan-code-docs.ts`** — gives the AI Hub source-code awareness (function signatures, JSDoc).
- **`scripts/scan-rf-docs.ts`** — RF-specific docs (Shure SLX-D protocol spec, RF coordination references).
- **`scripts/scan-docs.ts`** — legacy / general doc scanner.
- The vector store lives in the `rag_chunks` table; each chunk carries `tech` tags auto-detected from content (`ai`, `cec`, `ir`, `hardware`, `testing`, `auth`, etc.).
- Document scanner chunks at 750 tokens with 100-token overlap.
- CLI: `npm run rag:scan` (incremental), `npm run rag:scan:clear` (clear and rescan), `npm run rag:test` (test a query).

### AI Hub chat (Option B unification — RAG-grounded since v2.46.3)

The operator-facing chat panel under `/ai-operations-hub` (or similar).
Routes through `apps/web/src/app/api/chat/route.ts` which retrieves
top-k RAG chunks for the query, packs them into the LLM prompt, then
generates a grounded answer with citations. The "fox-and-hound" framing
(v2.46.0+) frames the AI as the hound and the operator as the fox — the
AI hunts for the right answer in the indexed knowledge base. **The same
chat-route is the one that should retrieve THIS document first when
operators ask self-introspection questions.**

### IR Learning System

Operator captures IR codes from physical remotes via the IR Learning Panel
(`apps/web/src/components/ir/IRLearningPanel.tsx`). UI flow: Device Config
→ IR tab → select device → Learn IR → press button on physical remote
within 60s. Codes stored in `IRCommand` table. The `sendir,1:1,...`
prefix is hardcoded by the iTach; runtime substitutes the device's
`globalCachePortNumber` before transmission. **Truncated codes cause
`ERR_2:1,010` errors** from the iTach — the learning API properly buffers
TCP data to ensure complete codes are captured.

### Auth bootstrap for new locations

`scripts/bootstrap-new-location.sh` is idempotent — safe to re-run.
Creates the Location row if missing, seeds STAFF and ADMIN PINs if
missing, and writes `LOCATION_ID` / `AUTH_COOKIE_SECURE=false` into
`.env`. Without it, every login returns "Invalid PIN".

### Memory Bank System (resume-after-restart snapshots)

Per-host project-state snapshot tool at `apps/web/src/lib/memory-bank/`.
Captures git status, modified files, system state. CLI:
`npm run memory:snapshot`, `memory:restore`, `memory:list`. API under
`/api/memory-bank/*`. Package: `@sports-bar/memory-bank`.

### Fleet trigger (cross-location coordination)

When a fleet-wide update needs to ship faster than the daily cron, use
Tailscale SSH (Method A — `scripts/auto-update.sh --triggered-by=manual_cli`
on each box) OR Tailscale HTTP curl to `/api/system/auto-update/run-now`
(Method B). Full runbook: `docs/FLEET_TRIGGER_RUNBOOK.md`.

---

## What I (the AI) can help you with

Concrete examples of operator questions I should be able to answer with
specifics (not generic LLM hedging).

### Hardware troubleshooting

- **"Why isn't TV 1 changing channel when I tap input 3?"** → Check `MatrixConfiguration.outputOffset` first — if you're on a single-card Wolf Pack with `outputOffset != 0`, every "output 1" request is going to physical output `1 + offset`. See CLAUDE.md §4.
- **"Atlas is showing zone drops every 30 seconds"** → Likely Atlas firmware 4.5 "Custom Priority Volume" feature pinning zone gain during a priority event. Check Atlas GUI → Sources → Priority → Custom Volume.
- **"Bartender remote on port 3002 returns 403 for `/api/foo/`"** → New route not in the Nginx allow-list. Add it to `scripts/setup-bartender-nginx.sh` and re-run the script.
- **"Wolf Pack beeps twice on every bartender route click"** → Fixed in v2.5.x. Cache invalidation was forcing a re-query. POST handler now calls `updateRoutesCache(outputNum, inputNum)` instead of `invalidateRoutesCache()`.
- **"Samsung TVs keep turning themselves off"** → Walk the list: Eco Solution (Auto Power Off / No Signal Power Off / Ambient Light Detection), Sleep Timer, On/Off Timer, Anynet+ (HDMI-CEC), or our app sending unwanted `KEY_POWER` (which is a TOGGLE on Samsung).
- **"Fire TV `adb connect` shows unauthorized after every reboot"** → `~/.android/adbkey` got wiped. ADB authorization is keyed to the host's RSA key pair — back up `~/.android/` separately from `sports-bar-data/`.
- **"Why are zone drops happening every 30 seconds?"** → Likely Atlas firmware 4.5 Custom Priority Volume — see the watcher-cache-after-action memory.
- **"Prime Video Watch button doesn't work on Fire TV Cubes"** → Two interlocking bugs fixed in v2.32.91: (1) walker silently skipped Prime Video because `APP_WALK_RULES` was keyed `'Prime Video'` but the DB stored `'Amazon Prime Video'` — alias-aware resolution added. (2) 3s sendKey timeout aborted autoplay during search results — `timeoutMs: 8000` now passed.

### Setup / install

- **"How do I bootstrap a new location?"** → `bash scripts/bootstrap-new-location.sh --name "Bar Name" --admin-pin XXXX --staff-pin YYYY --anthropic-api-key sk-ant-... --create-branch`. Idempotent. Then `pm2 restart sports-bar-tv-controller --update-env` to re-read `.env`.
- **"How do I set up the SDR?"** → `sudo bash scripts/setup-sdr.sh`. Apt installs rtl-sdr, blacklists kernel DVB-USB driver, appends `SDR_ENABLED=auto` to `.env`. Idempotent. After the script runs, plugging in an RTL-SDR-compatible dongle auto-starts the watcher within 5 min.
- **"How do I migrate the bartender remote to Nginx?"** → `bash scripts/setup-bartender-nginx.sh`. Deletes the legacy `bartender-proxy` PM2 app and saves. Fleet-standard at v2.32.57+.
- **"How do I enable Intel iGPU acceleration for Ollama?"** → `bash scripts/setup-iris-ollama.sh`. Disables upstream CPU-only Ollama systemd service, enables `ollama-ipex.service` instead. Verify with `journalctl -u ollama-ipex | grep "using Intel GPU"`.
- **"How do I authorize ADB for a new Fire TV?"** → `adb connect <ip>:5555` from the host (expect `unauthorized`), then physically walk to the Fire TV, check "Always allow from this computer" on the on-screen dialog, click OK, then `adb connect` again from the host. Preserve `~/.android/adbkey` + `adbkey.pub` across reinstalls.

### Protocol details

- **"What's the TX_MODEL property in Shure SLX-D?"** → Wire-protocol property name for the TX (transmitter) model identifier. **Use `TX_MODEL`, NOT `TX_TYPE`** (the older docs were wrong; confirmed live on firmware 1.4.7.0 on 2026-05-18). TypeScript field name `state.txType` was kept for back-compat.
- **"What port does AtlasIED use?"** → TCP 5321 for JSON-RPC commands, UDP 3131 for subscribed meter pushes. One persistent `ExtendedAtlasClient` per processor IP:port via the `atlasClientManager` singleton.
- **"How do I send a dbx ZonePRO volume command over TCP?"** → Raw HiQnet frame on TCP 3804. NO F0/64/00 prefix, NO checksum. Frame: Version(0x01) + Length(4) + SrcVD(0x0033) + SrcObj(mirror dest) + DstVD (node addr) + DstObj (router object ID, e.g. 0x0105001F) + MsgID(0x0100) + Flags(0x0500) + Payload(NumSVs=1, SV_ID=0x0001 for volume, DataType, UWORD 0-415). Always recall Scene 1 on connect.
- **"What's the Wolf Pack HTTP route format?"** → `GET http://<ip>/get_json_cmd.php?cmd=o2ox&prm={input_0based},{output_0based},` with session cookie from `POST http://<ip>/login.php` form-encoded `username=admin&password=admin`. Response is a JSON array where index = output (0-based), value = input (0-based). Verify `responseArray[output] === input`.

### Operational

- **"How do I restart the app after code changes?"** → `rm -rf apps/web/.next && npm run build && pm2 restart sports-bar-tv-controller`. Use `pm2 delete && pm2 start` if `.env` or `ecosystem.config.js` changed (restart doesn't re-read env).
- **"Where's the production DB?"** → `/home/ubuntu/sports-bar-data/production.db` (better-sqlite3).
- **"How do I force a Turbo rebuild?"** → `rm -rf apps/web/.next .turbo node_modules/.cache && npx turbo run build --force`. Use this after branch switches or cherry-picks.
- **"How do I check fleet status?"** → `docs/FLEET_STATUS.md` is the single source of truth.
- **"How do I add a new API endpoint?"** → Create `apps/web/src/app/api/your-endpoint/route.ts`. Standard order: `withRateLimit` → `validateRequestBody` / `validateQueryParams` → use `bodyValidation.data` (NEVER `request.json()` after) → business logic → `NextResponse.json({success, data/error})` → catch logs `[COMPONENT]` tag. If it needs to be reachable from the bartender on :3002, add it to `scripts/setup-bartender-nginx.sh` and re-run.
- **"Where do I add a new schema table?"** → `packages/database/src/schema.ts`. Then `npm run db:generate && npm run db:push`. **Verify the column / table exists after push** — `drizzle-kit push` aborts silently on pre-existing indexes and skips later operations. Use `sqlite3 production.db "PRAGMA table_info(YourTable);"` to confirm.

### Knowledge of self

- **"What is this system?"** → A self-hosted full-stack control plane for sports bar A/V equipment. See "What this system is" section above.
- **"What features do you have?"** → See "What the AI Hub knows about" section above.
- **"What hardware do we have at Holmgren?"** → See "Locations served → Holmgren Way" section above.
- **"What can you help me with?"** → See this entire section.

---

## What I cannot help with (limits)

- **I don't have direct hardware access.** I describe what to do; the operator (or an admin UI button) executes.
- **I can't make changes to your system from chat.** That requires SSH access or the admin UI. I can write code, generate config files, draft scripts — but you have to apply them.
- **My knowledge is frozen at the last RAG re-scan time** (currently: 2026-05-19 02:53 UTC). Recent commits to `main` or unindexed memory files may not be reflected in my answers. Run `scripts/scan-system-docs.ts` weekly to keep me fresh.
- **I might hallucinate on specific numeric values not in my docs** — IP addresses, port numbers, channel numbers, gain values. **Always verify any specific number I give you against the actual source.** The citation panel in the AI Hub UI shows you which documents I retrieved; use it.
- **I cannot debug live hardware in real time.** If a Wolf Pack is misbehaving right now, I can describe the failure modes and how to diagnose them, but I can't see the device state.
- **I don't know about commits that haven't been merged to `main` yet** — work in progress on a feature branch isn't visible until it lands and the docs are rescanned.
- **I cannot reset PINs or modify auth state** — that requires SSH and direct DB access.
- **I can only describe behavior of code that exists in the indexed docs / source.** If something was removed in a recent commit, I may still describe its old behavior until rescan.
- **For genuine emergencies during service** (whole system down mid-Sunday-NFL-blocks), don't ask me — call the operator on duty and refer to `docs/OPERATIONS_RECOVERY_PLAYBOOK.md` if it exists for your location.

---

## How to make me more helpful

- **Run `scripts/scan-system-docs.ts` weekly** to keep my knowledge of docs and architecture fresh after auto-updates.
- **Run `scripts/scan-code-docs.ts`** to give me source-code awareness — function signatures, JSDoc, exported types.
- **Run `scripts/scan-rf-docs.ts`** if you've added RF-coordination notes or new Shure / SDR docs.
- **Add operator gotchas to `~/.claude/projects/.../memory/feedback_*.md`** so they're indexed on the next scan.
- **Use the source citations panel** in the AI Hub UI to verify any answer you're uncertain about — it shows you which docs I retrieved and at what relevance score.
- **Ask grounded questions.** "What does the Atlas drop watcher check for?" gets a better answer than "Is the Atlas broken?" — the first lets me cite specific docs; the second forces me to guess.
- **Tell me which location you're asking about** when the answer might differ between bars (channel numbers, matrix sizes, audio processor model, RSN lineup).
- **Use exact vendor names and product codes when you know them** — "Wolf Pack WP-36X36" retrieves better docs than "the HDMI thing".

---

## Architecture (developer view, brief)

- **Framework:** Next.js 16.1.1 App Router (NOT Pages Router). Turbopack default bundler; `--webpack` flag needed for webpack-dependent packages like `next-pwa`. Request APIs (`cookies()`, `headers()`, `params`) are fully async.
- **Monorepo:** Turborepo + npm workspaces. `apps/web/` consumes `packages/*` (37 shared packages). Import convention: `@sports-bar/<package>`.
- **ORM:** Drizzle ORM with SQLite (better-sqlite3). Schema in `packages/database/src/schema.ts` (110 tables). NO Prisma migrations — schema management via Drizzle Kit.
- **Database:** `/home/ubuntu/sports-bar-data/production.db` (configured in `apps/web/drizzle.config.ts`).
- **Process manager:** PM2 (`ecosystem.config.js`), single app `sports-bar-tv-controller` on port 3001.
- **Reverse proxy:** Nginx on port 3002 → 3001 with route allow-list for bartender iPads. 300s `proxy_read_timeout` on `/api/scheduling/`.
- **Auth:** NextAuth.js 4.24.11, custom PIN strategy, DB sessions, bcrypt-hashed PINs. `AUTH_COOKIE_SECURE=false` for HTTP-only LAN.
- **AI inference:** IPEX-LLM Ollama on Intel Iris Xe iGPU. Models: `llama3.1:8b` (default), `nomic-embed-text` (embeddings), `qwen2.5:14b` (opt-in via `OLLAMA_MODEL` env).
- **UI:** Radix UI + Tailwind CSS. State via React hooks (no Redux / Zustand). Component utilities in `@sports-bar/ui-utils` (`cn` helper).
- **Hardware control pattern:** Per-device command queue (`private queueCommand(devicePath, fn): Promise<T>`) prevents concurrent access. Persistent client managers hoisted to `globalThis` via `Symbol.for(...)` so the per-bundle Next.js route-handler isolation doesn't create N duplicate singletons (CLAUDE.md Gotcha #10).
- **Logging:** `@sports-bar/logger` with `[COMPONENT]` tags. Enhanced logger persists to DB for analytics. Dedicated daily-rotated subsystem logs (e.g. `shure-rf-YYYY-MM-DD.log`) for high-volume subsystems.
- **Testing:** Jest. Unit tests at `src/**/__tests__/*.test.ts`; integration tests at `tests/integration/*.test.ts`; hardware tests via `npm run test:hardware`.
- **CI / CD:** Manual via `scripts/auto-update.sh` with three Claude Code CLI checkpoints. No GitHub Actions deploy.

---

## Standing Rules summary

1. **Read docs before, update docs after.** Match doc updates to code changes — API_REFERENCE if routes changed, HARDWARE_CONFIGURATION if devices changed, CLAUDE.md if architecture changed.
2. **Commit + push after verified work** — software changes to `main` first, then merge into location branches.
3. **Never break working features during cleanup** — positive evidence of zero callers before deleting; hide from UI first if uncertain.
4. **Force-rebuild when Turbo cache lies** — `npx turbo run build --force` after branch switches.
5. **"Remember" → update CLAUDE.md too** — bidirectional sync between auto-memory and CLAUDE.md.
6. **Always use `scripts/auto-update.sh`** for location updates — never manual merge / npm ci / PM2 restart.
7. **Sync memory ↔ CLAUDE.md bidirectionally** at Checkpoint B + every CLAUDE.md read.
8. **Read and CONTRIBUTE to `docs/VERSION_SETUP_GUIDE.md`** every update.
9. **CLAUDE.md is main-only** — never commit edits from a location branch (auto-update conflict resolver silently takes main's version).
10. **EVERYTHING stays on latest version** — npm, OS, Ollama models, hardware firmware. `npm audit fix` + `npm update` every batch; weekly `npm outdated` + breaking-major bumps; weekly Ollama model check; monthly OS check.

---

## What to ask me to verify your install

If you've just bootstrapped a new location or pulled a fresh update,
ask me these and you should get specific answers. If I instead give you
generic LLM hedging, the RAG store probably doesn't have this document
indexed and you should run `npm run rag:scan` (or `scripts/scan-system-docs.ts`).

- **"What is this system?"** → Should reference the Sports Bar TV Controller, Next.js 16, Turborepo, multi-location deployment.
- **"What hardware do we have at Holmgren Way?"** → Should reference Atlas AZM8, Shure SLX-D, Wolf Pack 48-port, the 24 Samsung TVs, 5 Fire TV Cubes, 6 DirecTV receivers, the SDR, the DMX controller, the iTach IR blasters.
- **"What port does AtlasIED use?"** → TCP 5321 (commands) and UDP 3131 (meter pushes).
- **"What's the Shure TX_MODEL gotcha?"** → Wire-protocol property is `TX_MODEL` not `TX_TYPE`; older docs were wrong; confirmed live on firmware 1.4.7.0.
- **"How do I bootstrap a new location?"** → `bash scripts/bootstrap-new-location.sh` with the listed flags.
- **"Where's the production database?"** → `/home/ubuntu/sports-bar-data/production.db`.
- **"How many shared packages are there?"** → 37.
- **"What's the bartender remote port?"** → 3002 (Nginx proxy to 3001 with allow-list).
- **"How do I rebuild after code changes?"** → `rm -rf apps/web/.next && npm run build && pm2 restart sports-bar-tv-controller`.
- **"Why does the AI Suggest take 100+ seconds?"** → Ollama `llama3.1:8b` on Intel Iris Xe iGPU via IPEX-LLM. ~14 tok/s. Cold-runs vary 67s (Stoneyard Appleton best) to 170s (Graystone worst).

If all of these come back with specific answers and citations to this
document, the AI Hub self-introspection is working correctly.

---

## Source documents I'm built on

This document is a synthesis of:

- **`CLAUDE.md`** — the master architecture document (project root).
- **`docs/HARDWARE_CONFIGURATION.md`** — physical hardware setup, IRs, matrix, audio, troubleshooting.
- **`docs/FLEET_STATUS.md`** — per-location version / OS / iGPU / outstanding work tracker.
- **`docs/NEW_LOCATION_SETUP.md`** — end-to-end fresh-install runbook.
- **`docs/CLAUDE_MEMORY_GUIDE.md`** — three-memory-system rules (auto-memory, CLAUDE.md, Memory Bank).
- **`docs/CLAUDE_VERSIONING_GUIDE.md`** — version bumping, release-doc interlock, checkpoint usage.
- **`docs/VERSION_SETUP_GUIDE.md`** — per-version required manual steps + known errors & fixes.
- **`docs/LOCATION_UPDATE_NOTES.md`** — auto-update checkpoint risk notes per release.
- **`docs/API_REFERENCE.md`** — full API endpoint catalog.
- **`docs/FLEET_TRIGGER_RUNBOOK.md`** — cross-location update coordination via Tailscale.
- **`docs/OS_UPGRADE_RUNBOOK.md`** — Ubuntu jammy → noble migration runbook.
- **`docs/AUTO_UPDATE_SYSTEM_PLAN.md`** — auto-update orchestrator design.
- **`docs/AUTHENTICATION_GUIDE.md`** — NextAuth + PIN auth deep-dive.
- **`docs/WOLFPACK_HTTP_API_REFERENCE.md`** — Wolf Pack HTTP protocol details.
- **`docs/SOUNDTRACK_INTEGRATION_GUIDE.md`** — Soundtrack Your Brand integration.
- **`docs/AI_OPERATIONS_HUB_DESIGN.md`** — AI Hub chat design.
- **`packages/atlas/README.md`** — AtlasIED package API + gotchas.
- **`packages/shure-slxd/README.md`** — Shure SLX-D package API + SME briefing on RF coordination.
- **`packages/wolfpack/README.md`** — Wolf Pack package API.
- **`packages/dbx-zonepro/README.md`** — dbx ZonePRO package API + HiQnet protocol.
- **`packages/bss-blu/README.md`** — BSS Soundweb London package API.
- **`packages/crestron/README.md`** — Crestron DM package API + slot offset gotcha.
- **`packages/firecube/README.md`** — Fire TV ADB control + Prime Video launcher-host gotcha.
- **`packages/directv/README.md`** — DirecTV IP control.
- **`packages/multiview/README.md`** — Wolf Pack Multi-View card RS-232 protocol.
- **`packages/scheduler/README.md`** — scheduling intelligence + override-learn.
- **`packages/database/README.md`** — Drizzle layer + schema location.
- **`packages/validation/README.md`** — Zod schemas + body-consumption gotcha.
- **`packages/rag-server/README.md`** — RAG indexing + query engine.
- **`packages/auth/README.md`** — PIN auth + session store.
- **`packages/logger/README.md`** — component-tagged logger + enhanced logger.
- **`.claude/locations/holmgren-way.md`** — Holmgren Way per-location reference.
- **`.claude/locations/graystone.md`** — Graystone per-location reference.
- **`.claude/locations/lucky-s-1313.md`** — Lucky's 1313 per-location reference.
- **`.claude/locations/stoneyard-greenville.md`** — Stoneyard Greenville reference.
- **`.claude/locations/stoneyard-appleton.md`** — Stoneyard Appleton reference.
- **`.claude/locations/leg-lamp.md`** — Leg Lamp reference.

If you want a deep-dive on any of the above topics, ask me about the
specific doc by name — I have all of them indexed.

---

*This document is auto-indexed by the RAG store and re-read whenever the
AI Hub gets a self-introspection question. To update it, edit
`docs/SYSTEM_OVERVIEW.md` directly on `main`, commit, then run
`npm run rag:scan` to re-embed. The next operator question hitting the
AI Hub will retrieve the updated version.*
