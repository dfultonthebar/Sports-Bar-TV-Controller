# RF Interference Detection System

**Scope:** features shipped v2.52.8 – v2.52.21 (May 2026).
**Audience:** engineers extending or debugging the RF stack. Assumes familiarity with TypeScript, Next.js App Router, Drizzle ORM, SSE, and the broader monorepo conventions in [`CLAUDE.md`](../CLAUDE.md).

---

## 1. Executive Summary

- The bar runs Shure SLX-D wireless mics in a UHF band shared with broadcast TV, ENG trucks, neighborhood DJ rigs, and stadium-event wireless. Mic dropouts have to be diagnosed in seconds, not after a customer complains.
- Three detectors operate in parallel: **Shure SLX-D** (narrow per-channel RSSI/TX-type), **RTL-SDR rtl_power sweep** (wide-band 25 kHz-resolution spectrum), and the **Atlas AZMP DSP** (mic-input level + priority bus). Each is independently useful; cross-confirmation is where the value is.
- A scheduler-driven AI pipeline correlates RF events with a **neighborhood-venue gig calendar** (Bandsintown + Bananas Entertainment scraper + manual entries) and builds per-artist interference profiles. Bookings by known interferers trigger preemptive alerts with suggested clean frequencies.
- A daily **Ollama-summarized RF Pattern Digest** (`llama3.1:8b`, on-iGPU via IPEX-LLM) translates 24h of activity into bartender-grade prose. A pre-shift brief injects mic status + upcoming neighborhood-interferer headlines.
- The whole stack degrades gracefully: no SDR dongle → SDR endpoints return empty grids; no Shure receiver → digest still runs over SDR-only data; Ollama offline → digest stores a counts-only fallback so the UI never goes blank.

---

## 2. Three-Detector RF Pipeline

```
                                  ┌─────────────────────────────────┐
                                  │      Neighborhood scrapers      │
                                  │  Bandsintown · Bananas Ent. ·   │
                                  │  manual entry · venue alias DB  │
                                  └────────────────┬────────────────┘
                                                   │
                                                   ▼
                                          NeighborhoodEvent
                                          NeighborhoodVenue
   DETECTORS                                       │
   ─────────                                       │
                                                   │
   Shure SLX-D ─► shure_rf_events ──┐              │
   (per-channel)                    │              │
                                    ▼              ▼
   RTL-SDR ─────► sdr_carriers ───► correlateAllInterference()
   (wide-band)    sdr_spectrum       (every 10 min, packages/scheduler)
                                    │
                                    ▼
                          InterferenceAttribution
                                    │
                                    ▼
                          ArtistInterferenceProfile  (per artist × location)
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
   runPreemptiveStrike    generateRfPatternDigest    /api/sdr/clean-freqs
   (Tier 2, every 1h)     (Tier 3, every 24h,        (Tier 4, on-demand)
   [PREEMPTIVE] logs +    llama3.1:8b)
   CleanFreqSuggestion[]
                                    │
                                    ▼
              ShureRfAiPanel + ShureSdrSpectrumPanel + shift-brief
   Atlas AZMP ─► atlas_priority_events
   (mic level)    atlas_drop_events
                  ▲
                  └─ context only: priority bus crosschecks Shure mic ON
```

**How they correlate.** When the Shure RF watcher (`apps/web/src/lib/shure-rf-watcher.ts`) fires an `rf_interference` event, it inline-queries `sdr_carriers` within ±60s at the same freq (±50 kHz). A match relabels Atlas-priority-driven `mic_active` rows to `rf_induced_mic_active` so the bartender banner says "broadcast interference, not a real page". The correlator scheduler tick runs every 10 min over both event tables, joining to neighborhood gigs within ±30 min and ≤1 mi.

---

## 3. SDR Hardware & Software Calibration

### Hardware

- **Dongle:** NooElec NESDR Smart (RTL2832U + R820T2, RTL-SDR v3 derivative). Any rtl-sdr-compatible USB device works; setup script verifies via `rtl_test -t`.
- **Coverage:** 25 MHz – 1.7 GHz tunable. Sufficient for G58 wireless mics (470-514 MHz), H55, J50A, J52A bands.
- **Antenna:** stock telescopic is fine for in-room work. Operator extended via a 6+ ft USB cable to move the dongle away from chassis RFI.

### One-time setup: `scripts/setup-sdr.sh`

```bash
sudo bash scripts/setup-sdr.sh
```

Idempotent. Five steps:

1. `apt install rtl-sdr` (if missing).
2. Write `/etc/modprobe.d/blacklist-rtl.conf` blacklisting `dvb_usb_rtl28xxu`, `rtl2832`, `rtl2830`, `e4000`, `rtl2838`.
3. `rmmod` any already-loaded DVB modules (skippable with `--no-rmmod`).
4. Append `SDR_ENABLED=auto` to `.env` if not already set.
5. `rtl_test -t` verification.

**The DVB-USB gotcha.** The Linux kernel DVB-USB driver auto-binds to any RTL2832U device the instant it's plugged in. After it claims the dongle, `rtl_test` reports `usb_claim_interface error -6`. The blacklist file prevents auto-bind on reboot; `rmmod` handles the running kernel. First-time installs are advised to reboot once after the script runs to guarantee the blacklist took effect.

### Environment variables

All consumed by `apps/web/src/lib/sdr-watcher.ts`. **Every SDR_* var must also be enumerated in `ecosystem.config.js`'s `env` block** (Gotcha #2: PM2 won't forward arbitrary env). The v2.52.7 fix added the full list — see `ecosystem.config.js:48-64`.

| Var | Default | Purpose |
|---|---|---|
| `SDR_ENABLED` | `false` | `auto` (start when dongle detected, re-probe every 5 min), `true` (force-start), `false`/unset (off). |
| `SDR_BAND_PRESET` | `auto` | `auto` (track live Shure freqs ±5 MHz), `uhf-wireless` (470-700 MHz), `full-uhf` (470-960 MHz), `custom`. |
| `SDR_BAND_START_MHZ` / `SDR_BAND_END_MHZ` | `470` / `514` | Used when `SDR_BAND_PRESET=custom` or as fallback when no Shure receiver is connected. |
| `SDR_BAND_BUFFER_MHZ` | `5` | Pad applied either side of the Shure-freq min/max in `auto` mode. |
| `SDR_BAND_REEVAL_MS` | `300000` | Period of the auto-band re-evaluation interval. |
| `SDR_RESOLUTION_KHZ` | `25` | rtl_power bin width. 25 kHz balances mic-channel detection vs sweep cycle time. |
| `SDR_SWEEP_INTERVAL_SEC` | `1` | `-i` arg to rtl_power. |
| `SDR_GAIN_DB` | `25` | `-g` arg. Holmgren tuned to `14.4`; over-gain causes ADC clip. |
| `SDR_DBM_OFFSET` | `-55` | **Software calibration offset added at ingest.** See below. Holmgren tuned to `-37`. |
| `SDR_CARRIER_THRESHOLD_DBM` | `-70` | Bin power that counts as "above threshold". Raised from `-85` in v2.52.11 after calibration normalized dBm register. |
| `SDR_CARRIER_DETECT_SAMPLES` | `3` | Consecutive samples above threshold to fire `carrier_active`. |
| `SDR_CARRIER_CLEAR_SAMPLES` | `5` | Consecutive samples below to fire `carrier_cleared`. |

### Why rtl_power emits dBFS not dBm

The Osmocom `rtl_power` binary (keenerd's branch) reports raw `10·log10(FFT bin power)` with no antenna-port reference, no gain compensation, no IF-stage correction. The values land in roughly the **dBFS** register (decibels relative to ADC full-scale) — typically `-30` to `+5` for any real signal, not the textbook `-110 → 0` dBm wireless-mic register.

This bites three layers:

- Carrier threshold (`-85` originally) catches everything as "active" — the noise floor itself sits around `-30`.
- Waterfall colormap (designed for `-110 → 0` dBm) saturates red across the entire band.
- SDR ↔ Shure cross-confirmation compares apples to oranges: Shure RSSI is real dBm, SDR is dBFS-ish.

**The v2.52.10 fix:** apply a per-location offset at ingest, before anything else touches the value. `sdr-watcher.ts:322`:

```typescript
const power = rawPower + DBM_OFFSET   // DBM_OFFSET default -55
```

After offset:
- noise floor lands near `-90 dBm` (matches Shure RSSI for an unmodulated channel)
- in-room wireless mic shows `-70` to `-50 dBm`
- nearby broadcast TV `-30` to `-10 dBm`

**Per-location calibration recipe:**

1. Key a known wireless mic 6 ft from the SDR antenna.
2. Read Shure RSSI on that channel (e.g. `-58 dBm`).
3. Read the rtl_power raw value for the same freq from `/api/sdr/history?freqStart=X&freqEnd=X` (subtract the current `SDR_DBM_OFFSET` to recover the raw number).
4. Set `SDR_DBM_OFFSET = shure_rssi - rtl_raw`.
5. `pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js` (delete+start, not restart — Gotcha #2).
6. Document the value in `.claude/locations/<branch>.md`.

Default `-55` is the midpoint of empirical UHF corrections clustered between `-50` and `-65` (per the v2.52.10 research digest). SDR# uses `-40` as its default for the same reason.

---

## 4. SDR Watcher Architecture

`apps/web/src/lib/sdr-watcher.ts` is the heart of the wide-band stack. Spawned from `instrumentation.ts` at app boot.

### Long-lived rtl_power child

```bash
rtl_power -f <start>M:<end>M:25k -i 1 -g 25 -e 0
```

`-e 0` runs forever. CSV output streams to stdout, parsed line-by-line via `readline.createInterface`. stderr is logged at DEBUG level (other than the noisy `tuner gain` lines).

### Per-minute aggregator → `sdr_spectrum`

Raw 1-Hz sweep data at 25 kHz resolution would be ~17 GB/year. The aggregator (`sdr-watcher.ts:118-119, 241-267`) accumulates max/avg/count per `(minuteBucket, freqMhz)` key in an in-memory `Map`. A 30-second `setInterval` flushes rows whose `minute < currentMinute` to the `sdr_spectrum` table. In-memory bound: ~1760 bins × 60s = 105K entries, ~5 MB RAM peak.

```typescript
type AggBucket = { max: number; sum: number; count: number; minute: number; freq: number }
```

### Carrier detection state machine

Per freq bin (lazy-allocated when first crossing threshold). State machine in `sdr-watcher.ts:339-379`:

| State | Trigger | Action |
|---|---|---|
| inactive → tracking | first sample ≥ threshold | allocate `CarrierState` |
| tracking → active | `aboveCount ≥ 3` | INSERT `carrier_active` row, log info |
| active → active | every 30s while active | INSERT `carrier_heartbeat` row |
| active → cleared | `belowCount ≥ 5` | INSERT `carrier_cleared`, free state |

Hysteresis (3/5) matches the Shure and Atlas-priority watchers — same shape, different signal source. Heartbeats let downstream consumers prove the carrier is still alive without scanning the full sweep.

### Per-sweep emitter (v2.52.10)

`apps/web/src/lib/sdr-sweep-emitter.ts` is a `globalThis`-hoisted `EventEmitter` (Gotcha #10 — Next.js bundles route handlers separately, so module-scope singletons are per-bundle). Watcher accumulates a full-band sweep across rtl_power's ~2.6 MHz chunks in `sweepInProgress: Map<number, number>` (bin → dBm), then `emitSweep()` fires when the timestamp string rolls.

```typescript
getSdrSweepEmitter().emit('sweep', {
  t: Math.floor(Date.now() / 1000),
  bins, dbms, startMhz, endMhz,
})
```

The SSE stream route subscribes via `.on('sweep', ...)` and forwards each sweep to connected browsers. This is what gives the FFT panadapter sub-second freshness (the per-minute aggregator path is too slow for a 30-sec DJ-mic burst).

`setMaxListeners(0)` — bumped from default 10, then from 50 to unlimited in v2.52.20. The SSE route's abort handler is the leak guard.

### Auto band-tracking

`computeBand()` (`sdr-watcher.ts:388-418`) dynamic-imports `@sports-bar/shure-slxd`, calls `shureSlxdClientManager.getSnapshots()`, extracts `c.frequencyMhz` from every connected receiver's channels, returns `[floor(min - 5), ceil(max + 5)]`. Re-evaluated every 5 min by a `setInterval`. If the new band differs by ≥ 1 MHz on either edge, the watcher sets `retuneInProgress = true` then `kill('SIGTERM')`s the rtl_power child. The exit handler respawns with the new args at the base 5-second interval.

When no Shure receivers are connected (location without a wireless mic system), falls back to G58 defaults (470-514 MHz).

### Backoff state machine + the v2.52.19 retune fix

The exit handler doubles `backoffMs` (up to 5 min) on each rtl_power crash. A `setTimeout(60_000)` resets `backoffMs` to 5s after a 60-second clean run.

**The v2.52.19 bug** (audit C1): pre-fix sequence —

```typescript
// BAD: capture flag AFTER clearing it
if (childProcess && !childProcess.killed) { /* ... */ }
retuneInProgress = false                  // cleared
// ... later in exit handler:
if (!retuneInProgress) backoffMs *= 2     // always true → always doubled
```

A band retune is supposed to skip backoff (it's an intentional kill, not a crash). The clear-then-check pattern meant the exit handler doubled backoff on every retune, so after a few auto-band re-evals the next real crash waited 5 min instead of 5 sec. Fix:

```typescript
const wasRetune = retuneInProgress
retuneInProgress = false
const restartIn = wasRetune ? RESTART_BACKOFF_INITIAL_MS : backoffMs
setTimeout(spawnRtlPower, restartIn)
if (!wasRetune) backoffMs = Math.min(backoffMs * 2, RESTART_BACKOFF_MAX_MS)
```

### Signal handlers (v2.52.4)

`process.on('SIGTERM' | 'SIGINT', stopSdrWatcher)` ensures the rtl_power child is killed on graceful PM2 shutdown. Without it, the orphaned process inherits to init and holds the USB device open, blocking the next PM2 start from acquiring it. Handler registration is idempotent (`signalHandlersRegistered` flag) because `startSdrWatcher()` can be re-called by the AUTO_MODE retry path.

---

## 5. SDR API Endpoints

All routes live under `apps/web/src/app/api/sdr/`. All apply `withRateLimit(RateLimitConfigs.HARDWARE)`.

### `GET /api/sdr/status` — liveness + active carriers

`apps/web/src/app/api/sdr/status/route.ts`

Returns:

```json
{
  "success": true,
  "enabled": true,
  "healthy": true,
  "lastSweepAt": 1747654321,
  "ageSecs": 4,
  "totalAggregatedRows": 1834221,
  "activeCarriers": [
    { "freqMhz": 482.7, "peakDbm": -42, "lastSeenSec": 3, "widthKhz": 200, "binCount": 8 }
  ]
}
```

Two non-obvious details:

- **`enabled` mirrors `SDR_ENABLED_MODE` parsing** — accepts both `'true'` and `'auto'`. Pre-v2.45.0 only checked `'true'`, so locations using the recommended `auto` mode saw a permanent "SDR disabled" UI even with the watcher actively writing rows.
- **`lastSweepAt` uses `MAX(detected_at)` not `MAX(bucket_at)`** (v2.52.8 fix). Bucket timestamps round to minute starts; `ageSecs` derived from bucket grew 0 → 140s every minute, oscillating past the 120s health threshold and making the UI flap. Switching to `detected_at` (actual INSERT timestamp) keeps `ageSecs` within 0-30s. Threshold relaxed 120 → 180s in the same release to absorb realistic SQLite WAL jitter.

**Carrier coalescing (v2.52.11, hardened v2.52.19):** the active-carriers list groups adjacent 25 kHz bins into one entry per real signal. A 6 MHz WCWF QAM broadcast renders as one carrier with `widthKhz: 6000, binCount: 240` instead of 240 separate rows crowding out wireless-mic events.

Gap math (`route.ts:90-134`):

```typescript
const COALESCE_GAP_MHZ = 0.50   // wide enough for WCWF stepped power profile
```

The v2.52.19 audit C2 fix: track `lastFreqMhz` (rightmost-bin freq) explicitly on the cluster object rather than deriving it from `freqMhz + widthKhz/2000`. The /2000 was wrong (mixed half-kHz with MHz) and `freqMhz` was being re-centered to the strongest bin, detaching the right-edge calculation from the actual rightmost bin. For 240-bin WCWF broadcasts the gap check was off by ~3 MHz, prematurely splitting clusters.

After coalescing, top-20 by `peakDbm` so a few wide TV broadcasts don't crowd out narrow wireless-mic events.

### `GET /api/sdr/history` — 2D waterfall grid

`apps/web/src/app/api/sdr/history/route.ts`

Query: `freqStart`, `freqEnd`, `minutesAgo` (default 60, max 1440).

Returns a pivoted grid: `grid[t][f] = max_dbm`. Missing cells filled with `-120` sentinel (renders as deepest blue). Used to seed the waterfall on initial page load before SSE takes over.

### `GET /api/sdr/stream` — Server-Sent Events live push

`apps/web/src/app/api/sdr/stream/route.ts`

Five event types:

| Event | Cadence | Payload |
|---|---|---|
| `hello` | once on connect | `{ at, seeded }` (count of seed rows sent) |
| `bucket` | every 5s (DB poll) | `{ bucketAt, bins[], dbms[] }` per minute |
| `carrier` | every 1s (DB poll) | `{ freqMhz, eventType, peakDbm, durationSec, detectedAt }` |
| `sweep` | ~1s (emitter push) | `{ t, bins[], dbms[], startMhz, endMhz }` (full sweep snapshot) |
| `heartbeat` | every 30s | `{ at }` (keeps Nginx and browser awake) |

`Content-Type: text/event-stream` with `X-Accel-Buffering: no` for the Nginx bartender proxy on port 3002.

The connect path sends the last 10 minutes of bucket data eagerly so a fresh client renders something immediately. Three timers (`bucketTimer`, `carrierTimer`, `heartbeatTimer`) plus the sweep emitter subscription. All cleaned up in the `request.signal.addEventListener('abort', ...)` handler.

**v2.52.19 audit H1 fix:** abort handler is registered **synchronously, immediately after** subscribing the sweep listener. Pre-fix there was a window where if the request signal aborted between `emitter.on(...)` and the abort listener registration, the sweep listener leaked forever.

**v2.45.0 review fix:** if the client disconnects during the initial seed query, bail before creating the three timers — otherwise the abort handler had already fired before the timers existed and they ticked until process restart.

### `GET /api/sdr/peak-stats` — per-freq aggregates

`apps/web/src/app/api/sdr/peak-stats/route.ts`

Query: `daysAgo` (default 7, max 90), `freqStart`, `freqEnd`, `topN` (default 20, max 200).

Returns max/avg/p95/sample count/last-hot-at/hot-minutes per freq bin. `hot_minutes` = count of minute-buckets where `max_dbm >= -85` (the legacy carrier threshold; left at -85 for backwards-compat of the "busy minutes" metric).

P95 computed in a **single bulk `GROUP_CONCAT` query** (v2.45.0 review fix); pre-fix issued one no-LIMIT subquery per result row, which at `topN=200` over a 7-day window meant 200 sequential queries fetching ~2M rows total and blocking the SQLite writer for tens of seconds.

Powers the click-to-inspect popover on the spectrum panel (`±0.05 MHz, topN=1`).

### `GET /api/sdr/clean-freqs` — ranked clean-freq suggestions

`apps/web/src/app/api/sdr/clean-freqs/route.ts` — Tier 4 surface.

Query: `exclude` (comma-separated MHz list; default = live Shure freqs), `topN` (1-10, default 3).

Thin wrapper around `findCleanFreqs()` from `@sports-bar/scheduler`. See [Section 8](#8-ai-tier-2--preemptive-strike) for the scoring algorithm.

### `GET/POST /api/sdr/digest`

`GET` returns the most-recent `rf_pattern_digest` row for this `LOCATION_ID`. `POST` force-regenerates by calling `generateRfPatternDigest()` synchronously — typically 30-90s on llama3.1:8b. UI shows a spinner and refreshes from `GET` on completion.

---

## 6. SDR UI Surface — `ShureSdrSpectrumPanel.tsx`

`apps/web/src/components/ShureSdrSpectrumPanel.tsx`

Renders the wide-band view inside the Wireless Mics admin tab (`/device-config → Audio → Wireless Mics → RF Spectrum Monitor`). Wrapped in `SafeBoundary` upstream so a render crash doesn't escalate to the global error page.

### Stacked FFT + waterfall

- **FFT panadapter (160px, primary):** lime-green line graph (SDR# / GQRX signature look), dBm grid lines, semi-transparent fill underneath. Derives from `liveSweep` (1-sec freshness via `sweep` SSE events). Falls back to the latest per-minute `bucket` if no live sweep yet.
- **Shared X-axis label strip (12px):** real DOM text labels at integer-MHz steps. Sits between FFT and waterfall.
- **Waterfall (50px, secondary):** classic time-vs-freq color matrix, newest at the bottom. Powered by rolling 10-min `buckets[]` accumulated from SSE.

Both canvases share the same `xForFreq(freq, minF, maxF, W)` helper (hoisted to module scope in v2.52.9 so the two render passes can't drift).

### Annotations

- **Cyan vertical lines:** our tuned Shure freqs (`ourFrequencies` prop). FFT uses 0.7 opacity, waterfall 0.95.
- **Dashed white lines:** Green Bay TV station edges (WCWF↑ 476, WLUK↓ 500, WLUK↑ 506). Defined in `G58_BAND_MARKERS`. These are hard-coded for now — extending to other markets means parameterizing this constant from `HARDWARE_CONFIG.venue`.

### Click-to-inspect

Click any column on either canvas → `setInspect({freqMhz, loading: true})` → fetch `/api/sdr/peak-stats?freqStart=X-0.05&freqEnd=X+0.05&topN=1` → display max/p95/avg/hot-minutes/last-hot-at popover.

### Hover tooltip (v2.52.9)

`onMouseMove` walks `fftSnapshot.bins` to find the nearest bin, reads dBm. Renders a `"484.0 MHz · −62 dBm (click to inspect)"` floating tooltip positioned near the cursor.

### Three render states

| `status.enabled` | `status.healthy` | UI |
|---|---|---|
| `false` | — | gray "SDR disabled" card with setup instructions |
| `true` | `false` | amber "Waiting for sweep" with last-seen + log-pointer |
| `true` | `true` | live FFT + waterfall + carriers list |

### Coalesced carrier classification (v2.52.15)

Active-carriers list classifies by `widthKhz`:

| Range | Badge | Likely source |
|---|---|---|
| `≥ 1000 kHz` | red "X.X MHz wide" | broadcast TV |
| `300-999 kHz` | orange "X kHz wide" | wide-band rig |
| `100-299 kHz` | amber "X kHz (mic-width)" | wireless mic |
| `< 100 kHz` | slate "X kHz" | narrow / spurious |

---

## 7. AI Tier 1 — Interference Correlator

`packages/scheduler/src/interference-correlator.ts`

Two parallel pipelines feeding the same `InterferenceAttribution` table.

### `correlateInterference()` — Shure-source

For each `shure_rf_events` row with `event_type='rf_interference'`, scan `NeighborhoodEvent` rows where `|rf.detected_at - ne.start_time| ≤ 1800s` (±30 min) and `nv.distance_mi ≤ 1.0`. Upsert one `InterferenceAttribution` per pair.

### `correlateSdrInterference()` — SDR-source (v2.52.12)

Same shape, but reads `sdr_carriers` instead of `shure_rf_events`. **Critical narrowing:** filters to carriers within ±0.1 MHz of OUR live Shure receiver freqs (via `getShureFreqsMhz()`). Without this filter, the continuous WCWF UHF14 broadcast would attribute itself to every neighborhood gig at every time-of-day forever.

De-dup: per `(NeighborhoodEvent, Shure freq)`, pick the SDR carrier closest in time to event start. Multiple `carrier_active` events during one DJ set on the same freq collapse to one attribution.

```typescript
const bestPerPair = new Map<string, {carrier, ne, freqIdx, dt}>()  // key = `${neId}:${freqIdx}`
```

### `InterferenceAttribution.source: 'shure' | 'sdr'`

Schema column (`packages/database/src/schema.ts:2984-2991`). The artist-profile-builder reads both — when **both** detectors independently see RF activity at a venue's event time, artist confidence climbs faster than either source alone.

The Shure pass writes `source: 'shure'` explicitly (v2.52.20 audit M2 — defensive against schema recreation), the SDR pass writes `source: 'sdr'`. The `(rfEventId, neighborhoodEventId)` unique index covers both — `rfEventId` UUIDs are globally unique across both source tables, no collision risk.

### Confidence formula

```typescript
export function computeAttributionConfidence(
  timeDeltaSeconds: number, distanceMi: number,
): number {
  const tFactor = Math.max(0, 1 - timeDeltaSeconds / 1800)
  const dFactor = Math.max(0, 1 - distanceMi / 1.0)
  return Math.min(0.85, Math.max(0, tFactor * dFactor * 0.85))
}
```

Single-event cap of 0.85 — a single match never "proves" anything. Multi-gig profiles aggregated by `artist-profile-builder` are where confidence approaches actionable thresholds.

### `correlateAllInterference()` — runner

Runs both passes, catching errors independently so one source's failure doesn't block the other. The scheduler service (`scheduler-service.ts:155, 237-249`) calls this every 10 min with a 3-min initial delay.

### `shure-freq-utils.ts` (v2.52.21 refactor)

Three call sites (`interference-correlator.ts`, `preemptive-strike.ts`, `rf-pattern-digest.ts`) independently implemented the same 15-line dynamic-import + snapshot-extract pattern. Consolidated to:

```typescript
export async function getShureFreqsMhz(): Promise<number[]>
export function buildFreqBandClauses(freqs: number[], toleranceMhz: number): SQL | null
export const SHURE_FREQ_MATCH_MHZ = 0.10
```

`buildFreqBandClauses` returns `((freq_mhz BETWEEN x-tol AND x+tol) OR ...)` joined with `sql.join`, or `null` when the freq list is empty (caller should short-circuit). Single source of truth for the 0.1 MHz tolerance constant means tuning it doesn't drift across files.

---

## 8. AI Tier 2 — Preemptive Strike

`packages/scheduler/src/preemptive-strike.ts`

Reads `NeighborhoodEvent` rows in the next 12h (configurable), joins to `ArtistInterferenceProfile` for our `LOCATION_ID`, returns `PreemptiveStrikeCandidate[]` for artists with `confidence ≥ 0.6`.

**Stage 1 only — does NOT retune mics.** Logs `[PREEMPTIVE]` warnings + returns candidates. A future Stage 2 will act; deploying prediction first lets operators eyeball recommendations before automating action.

### `PreemptiveStrikeCandidate.suggestedCleanFreqs[]`

Each candidate carries up to 3 clean-freq suggestions. Generated by `suggestCleanFreqs(exclude)`:

```sql
SELECT
  ROUND(freq_mhz * 2) / 2 AS freq_mhz,
  AVG(max_dbm)  AS avg_dbm,
  SUM(CASE WHEN max_dbm > -75 THEN 1 ELSE 0 END) AS hot_count,
  COUNT(*) AS total_count
FROM sdr_spectrum
WHERE detected_at >= ${cutoff}
  AND freq_mhz BETWEEN 471 AND 513
GROUP BY ROUND(freq_mhz * 2) / 2
HAVING total_count > 10
ORDER BY avg_dbm ASC, hot_count ASC
LIMIT 50
```

Then JS-side filter out anything within ±0.2 MHz of either the artist's predicted-affected freqs OR our currently-tuned Shure freqs. Top 3 returned with rationale:

```
"quiet 99.4% of last 7 days, avg -88 dBm"
```

**Caching:** `cleanFreqsCache: Map<excludeKey, suggestions>` so N candidates with the same exclusion set don't re-query `sdr_spectrum` N times.

**v2.52.19 audit H4 fix:** assignment is `suggestedCleanFreqs: [...suggestions]` (shallow copy) — without it, a downstream mutation of one candidate's array (push/splice/sort) would propagate into the cache entry shared by other candidates.

### `findCleanFreqs()` standalone helper

Exported for on-demand use by the UI (Tier 4):

```typescript
export async function findCleanFreqs(opts?: {
  excludeFreqsMhz?: number[]
  topN?: number
}): Promise<CleanFreqSuggestion[]>
```

If `excludeFreqsMhz` omitted, defaults to live Shure freqs via `getShureFreqsMhz()`. `GET /api/sdr/clean-freqs` is a thin wrapper around this.

### Scheduling

`scheduler-service.ts:157` registers `runPreemptiveStrike` at 1h cadence with a 15-min initial delay. Logs `[PREEMPTIVE]` warnings to PM2 + scheduler log.

---

## 9. AI Tier 3 — Daily RF Pattern Digest

`packages/scheduler/src/rf-pattern-digest.ts`

Once-per-24h Ollama summarization of the last 24h. Scheduled at `scheduler-service.ts:162` with a 30-min initial delay (so a fresh-start watcher has time to populate `sdr_spectrum` before the digest tries to summarize it).

### Data gathering (`gatherRawCounts`)

Eight tables/queries:

- 24h `shure_rf_events` count where `event_type='rf_interference'`
- 24h `sdr_carriers` count where `event_type='carrier_active'`
- Subset within ±0.1 MHz of our Shure freqs (using `buildFreqBandClauses`)
- Top-5 attributed artists from `InterferenceAttribution` joined to neighborhood tables
- Up to 10 upcoming `NeighborhoodEvent` rows in next 24h, joined to `ArtistInterferenceProfile` for known-interferer flag
- Top-8 hottest SDR freqs in last 24h (avg_dbm > -75)

Each in its own try/catch so a missing table (no Shure setup, no SDR) degrades to zero instead of throwing.

### `formatPromptForLlm`

Formats the counts into a structured prompt with a bartender-grade directive header:

> You are summarizing the last 24 hours of RF activity at a sports bar for the BARTENDER, who manages wireless microphones but doesn't know radio engineering jargon. Keep your response under 6 sentences. Plain English. No "dBm" or "freq" — say "channel" and "signal strength."

Free-form strings (artist name, venue name) pass through `sanitizeForLlmContext()`:

```typescript
function sanitizeForLlmContext(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, '')   // control chars
    .replace(/```+/g, "'''")            // neutralize fenced-block injection
    .slice(0, 80)
    .trim()
}
```

The scrapers (Bandsintown, Bananas Entertainment) feed arbitrary text into `NeighborhoodEvent.artistName` and `NeighborhoodVenue.name`. A crafted venue name like `"} Ignore previous instructions and ...` could derail the LLM into outputting misleading bartender instructions, which then store verbatim in `rf_pattern_digest.summaryText` and render on the bartender screen. v2.52.20 audit security #1.

### `callOllama` (v2.52.19 audit H3)

```typescript
signal: AbortSignal.timeout(120_000)
keep_alive: -1
options: { temperature: 0.4, num_predict: 400 }
```

Pre-fix had no timeout — if Ollama was busy loading another model the fetch hung indefinitely, leaving the operator on a spinner until PM2 kill. 120s timeout matches shift-brief's pattern.

### Model: `llama3.1:8b` (v2.52.17 RAM-pressure fix)

Pre-v2.52.17 used `qwen2.5:14b` (9 GB). With shift-brief and ai-suggest both pinning `llama3.1:8b` (5 GB), having `qwen2.5:14b` keep-alive=-1 added 9 GB of resident model on Holmgren's 32 GB box → 7.8 GB swap thrash → every Ollama call took 30+ sec.

Now the digest shares the same resident model as everything else. Output quality is plenty for bartender-grade summary; qwen2.5's extra capacity was wasted on this prompt. Override per-location via `RF_DIGEST_MODEL=qwen2.5:14b` env if a host has the RAM headroom.

### `ensureDigestTable()` (v2.52.20 audit M1)

```typescript
let tableEnsured = false
async function ensureDigestTable(): Promise<void> {
  if (tableEnsured) return
  await db.run(sql`CREATE TABLE IF NOT EXISTS rf_pattern_digest (...)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS rf_pattern_digest_location_idx ...`)
  tableEnsured = true
}
```

Pre-fix relied on `drizzle-kit push` for table creation. CLAUDE.md Gotcha #6 — drizzle-kit aborts silently on pre-existing indexes and skips downstream tables. Fresh installs OR locations that skipped the push step threw `"no such table: rf_pattern_digest"` on the first INSERT and never recovered. Mirrors `sdr-watcher.ts`'s `ensureTables()` pattern.

### Fallback summary

If Ollama is unreachable, the row still lands with a counts-only fallback:

```
RF digest could not be generated (Ollama unavailable: <err>). Raw counts: N
Shure events, M SDR carriers (K on our freqs), J attributions, L upcoming events.
```

Operator sees "model unavailable" rather than no card at all.

### Storage

`rf_pattern_digest` table — `summary_text` (prose), `structured_findings` (JSON with counts + top interferers + upcoming events + hottest freqs), plus model metadata (`model_used`, `prompt_token_count`, `completion_token_count`, `generation_ms`).

---

## 10. AI Tier 4 — On-Demand Clean-Freq API

`GET /api/sdr/clean-freqs?topN=5&exclude=484.7,510.9`

Thin route around `findCleanFreqs()` from Tier 2's helper. Used by:

- "Suggest a Clean Frequency" button in `ShureRfAiPanel`
- Future bartender-remote retune assistant
- External integrations

Returns:

```json
{
  "success": true,
  "excludedFreqsMhz": [484.7, 510.9],
  "topN": 5,
  "suggestions": [
    { "freqMhz": 491.5, "avgDbm": -88, "hotMinutes": 4, "totalMinutes": 10080,
      "rationale": "quiet 99.96% of last 7 days, avg -88 dBm" }
  ],
  "note": null
}
```

When no SDR data exists (fresh install) returns empty suggestions with a `note` explaining ~7 days of history is needed.

---

## 11. Shift-Brief Integration

`apps/web/src/app/api/ai/shift-brief/route.ts`

Pre-shift summary the bartender sees on remote open. 10-min in-memory cache (`cachedBrief`). Force-regenerate with `?force=true`. Typical operator-visible response: **18 ms** (cached). Cold gen: ~60s.

### Mic-status one-liner (v2.52.16)

Queries `shure_rf_events` for last 60 min `rf_interference` count + last 5 min any event (watcher-fresh probe):

| Condition | Output |
|---|---|
| Watcher not fresh and no events | "Mic status: nothing to report." |
| 0 events | "Mic status: good (no interference in the last hour)." |
| 1-4 events | "Mic status: N brief signal hiccups in the last hour. Probably fine — check the receivers if you hear dropouts." |
| 5+ events | "Mic status: N interference events in the last hour — wireless mic environment is busy. Worth a Shure receiver check before the rush." |

Skipped entirely if `shure_rf_events` table doesn't exist (no Shure setup).

### Upcoming neighborhood interferer bullets (v2.52.16)

Queries `NeighborhoodEvent` joined to `NeighborhoodVenue` + LEFT JOIN `ArtistInterferenceProfile` for events in the next 12h within ≤ 1 mi (`is_self=0` to exclude our own bar). Up to 8 rows.

LLM prompt instructs:

> If there are nearby bands/DJs in the next 12h, add a line like "Heads up: \<artist\> at \<venue\> at \<time\> might cause mic interference" — but only for KNOWN INTERFERER entries OR entries within 0.5 mi. Skip distant unknowns to avoid noise.

Operator-facing example output:

> Heads up: Casey at Anduzzi's at 9pm might cause mic interference.

Bullet generation also exists in the `fallbackBrief()` path so it works without Ollama.

### Game-list pre-filter (v2.52.17)

Pre-v2.52.17 fed ALL ~25 upcoming games to llama3.1:8b. Two problems:

1. Prompt inflated to ~2000 tokens → 30s generation
2. **LLM context overflow caused hallucinated grouping** — the model dropped track of which entries carried the `[HOME TEAM]` flag and grouped sound-alike teams (Cavs @ Knicks) under "Home-team games tonight" at a Green Bay bar

Fix: filter to `ALL home-team games + top-4 network-priority other games`, total ≤ 8. Prompt also now includes the explicit home-team list:

> Our home teams (for THIS bar — anything not in this list is NOT a home-team game): Packers, Bucks, Brewers, Badgers

### LLM call

```typescript
const resp = await fetch(`${HARDWARE_CONFIG.ollama.baseUrl}/api/generate`, {
  body: JSON.stringify({
    model: HARDWARE_CONFIG.ollama.model,  // llama3.1:8b
    keep_alive: -1,
    options: { temperature: 0.2, num_predict: 200 },
  }),
  signal: AbortSignal.timeout(90_000),
})
```

`num_predict: 200` (raised from 150 in v2.52.17) lets the full bullet list finish without truncating the `TELL OWNER:` fleet-alert line.

### Sanitization

Same `sanitizeForLlmContext` pattern as the digest (v2.52.20 audit security #2). Applied to `artistName` + `venueName` in both the prompt builder and the fallback.

---

## 12. UI Surface — `ShureRfAiPanel.tsx`

`apps/web/src/components/ShureRfAiPanel.tsx`

Sits below `ShureSdrSpectrumPanel` on the Wireless Mics admin tab. Two cards inside one purple-bordered container.

### "RF Environment Summary" card

- Loads latest digest via `GET /api/sdr/digest` on mount
- Refresh button → `POST /api/sdr/digest` (regenerates, ~30-90s on llama3.1:8b)
- Shows `digest.summaryText` as prose (`whitespace-pre-wrap`)
- Shows age + model used (e.g. "12 min ago · llama3.1:8b")
- Bottom strip: 4-cell counts grid from `digest.structured.counts` — Shure interference (24h) / SDR carriers (24h) / SDR near our mics (24h) / event attributions (24h)
- Loading state spinner, error state amber AlertCircle, empty state italics

### "Suggest a Clean Frequency" card

- Button → `GET /api/sdr/clean-freqs?topN=5`
- Renders ranked list with #1 in emerald badge, rest in slate
- Each row: freq + rationale
- Note from API (e.g. "No SDR data available yet") surfaces as italic warning

### SafeBoundary

Per [feedback-safeboundary-for-new-panels], both panels are wrapped upstream in `<SafeBoundary label="...">` so a render crash shows a tiny inline card instead of escalating to the global error page. The first few releases of any new admin panel default to this.

---

## 13. Database Schema Additions

All in `packages/database/src/schema.ts` (re-exported via `apps/web/src/db/schema.ts`).

### `sdr_spectrum` (v2.41.0+)

```sql
CREATE TABLE sdr_spectrum (
  id TEXT PRIMARY KEY,
  freq_mhz REAL NOT NULL,
  bin_width_khz REAL NOT NULL,
  max_dbm REAL NOT NULL,
  avg_dbm REAL NOT NULL,
  sample_count INTEGER NOT NULL,
  bucket_at INTEGER NOT NULL,     -- minute bucket start, unix epoch
  detected_at INTEGER NOT NULL    -- actual INSERT timestamp
)
CREATE INDEX sdr_spectrum_bucket_idx        ON sdr_spectrum (bucket_at);
CREATE INDEX sdr_spectrum_freq_bucket_idx   ON sdr_spectrum (freq_mhz, bucket_at);
```

Created at runtime by `sdr-watcher.ts:ensureTables()`. Volume ~290 MB/year per location at default settings.

### `sdr_carriers` (v2.41.0+)

```sql
CREATE TABLE sdr_carriers (
  id TEXT PRIMARY KEY,
  freq_mhz REAL NOT NULL,
  event_type TEXT NOT NULL,        -- 'carrier_active' | 'carrier_heartbeat' | 'carrier_cleared'
  peak_dbm REAL,
  avg_dbm REAL,
  duration_sec INTEGER,
  note TEXT,
  detected_at INTEGER NOT NULL
)
CREATE INDEX sdr_carriers_detected_at_idx     ON sdr_carriers (detected_at DESC);
CREATE INDEX sdr_carriers_freq_detected_idx   ON sdr_carriers (freq_mhz, detected_at DESC);
```

### `rf_pattern_digest` (v2.52.14)

```typescript
export const rfPatternDigest = sqliteTable('rf_pattern_digest', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  locationId: text('location_id').notNull(),
  periodStart: integer('period_start').notNull(),
  periodEnd: integer('period_end').notNull(),
  summaryText: text('summary_text').notNull(),
  structuredFindings: text('structured_findings'),    // JSON
  modelUsed: text('model_used').notNull(),
  promptTokenCount: integer('prompt_token_count'),
  completionTokenCount: integer('completion_token_count'),
  generationMs: integer('generation_ms'),
  generatedAt: integer('generated_at').notNull(),
}, (table) => ({
  locationIdx: index('rf_pattern_digest_location_idx').on(table.locationId, table.generatedAt),
}))
```

Created via `drizzle-kit push` AND defensively at runtime via `ensureDigestTable()`.

### `InterferenceAttribution.source` column (v2.52.12)

Added to existing table (`schema.ts:2991`):

```typescript
source: text('source').notNull().default('shure'),
```

Plus `sourceIdx` on the column. Values: `'shure'` | `'sdr'`. The unique index on `(rfEventId, neighborhoodEventId)` is unchanged; UUIDs from both source tables share the same column without collision risk (FK enforcement is off in prod SQLite anyway).

### `NeighborhoodVenue.isSelf` (v2.51.3)

Pre-existing in the prediction pipeline but worth noting — bookings AT our own bar still count for interference prediction (band brings its own wireless rig). Marked `is_self=1` → distance=0 → lower confidence threshold (≥0.3 vs ≥0.6) for preemptive strike.

---

## 14. Configuration Reference

### Per-location `.env` additions

```bash
# SDR — enable + auto-detect dongle (default after setup-sdr.sh)
SDR_ENABLED=auto

# Per-location calibration (see Section 3). Default -55 if unset.
SDR_DBM_OFFSET=-37

# Per-location tuner gain (some locations need lower to avoid ADC clip)
SDR_GAIN_DB=14.4

# Optional band override (default = auto-track Shure freqs)
# SDR_BAND_PRESET=uhf-wireless
# SDR_BAND_START_MHZ=470
# SDR_BAND_END_MHZ=514

# Carrier-detection tuning (defaults usually fine)
# SDR_CARRIER_THRESHOLD_DBM=-70
# SDR_CARRIER_DETECT_SAMPLES=3
# SDR_CARRIER_CLEAR_SAMPLES=5

# Optional: override the LLM model for the daily digest (default llama3.1:8b)
# RF_DIGEST_MODEL=qwen2.5:14b
```

### `ecosystem.config.js` forwarding

Every `SDR_*` env var must appear in the `env:` block — see `ecosystem.config.js:48-64`. PM2 does NOT forward arbitrary process.env to the spawned child. After adding a new SDR_* var:

1. Add `process.env.SDR_FOO` reference in the watcher.
2. List `SDR_FOO: process.env.SDR_FOO` in `ecosystem.config.js`.
3. `pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js` (delete+start, NOT just restart — Gotcha #2).

### Nginx allow-list

`/api/sdr/*` routes are NOT on the bartender Nginx allow-list at port 3002 (they're admin-only). The admin port 3001 surface is what `ShureSdrSpectrumPanel` and `ShureRfAiPanel` consume. If a future bartender-facing surface needs an SDR endpoint, add it to `scripts/setup-bartender-nginx.sh` and re-run the script.

---

## 15. Operational Runbook

### SDR alive?

```bash
curl -s http://localhost:3001/api/sdr/status | python3 -m json.tool
```

Expected:
- `"enabled": true`
- `"healthy": true`
- `"ageSecs"` between 0 and 30

If `enabled=true` but `healthy=false`:
- `pm2 logs sports-bar-tv-controller --lines 200 | grep SDR-WATCHER`
- Look for `rtl_power exited` → check `dmesg | grep -i rtl` for USB issues
- Verify dongle: `rtl_test -t 2>&1 | head`
- Verify DVB blacklist: `grep dvb_usb_rtl28xxu /etc/modprobe.d/blacklist-rtl.conf`

If `enabled=false`:
- `grep SDR_ENABLED /home/ubuntu/Sports-Bar-TV-Controller/.env`
- If unset or `false`: `sudo bash scripts/setup-sdr.sh` then `pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js`

### Carriers detecting correctly?

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT event_type, COUNT(*), MIN(detected_at), MAX(detected_at)
   FROM sdr_carriers WHERE detected_at > strftime('%s','now') - 3600
   GROUP BY event_type"
```

Expected: a mix of `carrier_active`, `carrier_heartbeat`, `carrier_cleared`. All-zero counts after >24h running = threshold mistuned (raise/lower `SDR_CARRIER_THRESHOLD_DBM` per Section 3 calibration).

### Tier 3 digest fresh?

```bash
curl -s http://localhost:3001/api/sdr/digest | python3 -m json.tool
```

`ageSec` should be < 86400 (24h). If older, the scheduler tick has been skipping — check `pm2 logs | grep RF-DIGEST`. Manual regenerate:

```bash
curl -X POST http://localhost:3001/api/sdr/digest
```

### Shift-brief responsive?

```bash
time curl -s http://localhost:3001/api/ai/shift-brief | python3 -m json.tool | head -3
```

Expected first call: 30-90s (cold). Subsequent calls within 10 min: <50ms (cache hit, `"fromCache": true`).

### Correlator running?

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT source, COUNT(*), MAX(created_at)
   FROM InterferenceAttribution
   WHERE created_at > strftime('%s','now') - 86400
   GROUP BY source"
```

Expected after a busy night: rows in both `'shure'` and `'sdr'` source. If only `'shure'` and SDR is healthy, check `pm2 logs | grep CORRELATOR-SDR` for the `no Shure freqs known` skip path.

### Ollama health (shared dependency for Tier 3 + shift-brief + ai-suggest)

```bash
journalctl -u ollama-ipex --since "1 hour ago" | grep -E "GPU|model|error"
ollama list
ollama ps   # active models, but note size_vram=0 even when iGPU-loaded
intel_gpu_top -s 1 5   # verify the iGPU is actually being used
```

---

## 16. Gotchas & Pitfalls

### Drizzle better-sqlite3 has no `.catch()`

```typescript
// WRONG — runtime "is not a function" error
db.all(sql`...`).catch(err => ...)
db.run(sql`...`).catch(err => ...)

// CORRECT
try { await db.all(sql`...`) } catch (err) { ... }
```

`db.all` / `db.run` from `better-sqlite3` driver return SYNCHRONOUS results wrapped in a Promise-like — the `.catch` method does not exist. Hit twice in one session in v2.52.14/15. Compile-time clean, runtime explodes.

### Ollama RAM pressure — ONE resident model only

Per `[feedback-ollama-ram-pressure]`: setting `keep_alive: -1` on TWO different models pushes a 32 GB box into 7.8 GB swap thrash → 30+ sec LLM calls. Pick one resident model for all per-location AI features. Currently `llama3.1:8b` is the canonical resident. Tier 3 was originally `qwen2.5:14b`; v2.52.17 switched it to share llama3.1:8b.

### LLM context overflow on >8 items with `[FLAG]` tags

Per `[feedback-llm-context-overflow]`: listing >8 entries with sparse annotations causes the LLM to mis-group by sound-alike-importance rather than actual flag. shift-brief was hallucinating Cavs@Knicks under "Home-team games tonight" at a Green Bay bar. Fix: pre-filter to ≤8 items + state ground truth in prompt header (e.g. explicit home-team allowlist).

### `ecosystem.config.js` must list every SDR_* env var

PM2 does not forward arbitrary `process.env` to spawned children. Every new `SDR_FOO` setting must be added to the `env:` block in `ecosystem.config.js` AND `pm2 delete && pm2 start` (not `restart`). v2.52.7 fixed this — pre-fix, operators setting `SDR_GAIN_DB=14` in `.env` were silently ignored.

### Carrier coalescing gap math precision

The v2.52.19 audit C2 fix: do NOT derive cluster right-edge from `freqMhz + widthKhz/2000`. Track the rightmost-bin freq explicitly on the cluster object. Mixing kHz and MHz units, or re-centering `freqMhz` to the peak bin, will mis-compute gaps and split clusters at the wrong points.

### Next.js per-bundle singletons

Per CLAUDE.md Gotcha #10: any module-private state shared across API routes must be hoisted to `globalThis` with `Symbol.for(...)`. `sdr-sweep-emitter.ts` is the canonical example — without it, the SSE route's emitter instance would be different from the watcher's (each bundled separately), and `sweep` events would never reach connected browsers.

### drizzle-kit silent index failure

Per CLAUDE.md Gotcha #6: `npx drizzle-kit push` aborts entirely on pre-existing indexes and silently skips downstream tables. After every push that adds a table:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables" | grep rf_pattern_digest
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(rf_pattern_digest);"
```

The `ensureDigestTable()` runtime helper in `rf-pattern-digest.ts` is the belt-and-suspenders for this.

### Watcher cache after action

Per `[feedback-watcher-cache-after-action]`: long-running watchers comparing prev vs live must update `lastSeen` IMMEDIATELY after the read, not at the end after conditional INSERTs. A throwing INSERT otherwise strands the cache and re-fires the same event indefinitely. SDR carrier-detection doesn't compare prev/live (it's pure rising-edge from `aboveCount`), but adjacent code on this stack does.

---

## 17. Extension Points

### Add a new detector

Pattern: independent watcher, own event table, `source: 'X'` discriminator on `InterferenceAttribution`.

1. Add a new `xxx_events` table to `packages/database/src/schema.ts` with `id`, `frequency_mhz`, `detected_at` at minimum.
2. Write a watcher at `apps/web/src/lib/xxx-watcher.ts` following `sdr-watcher.ts`'s shape: `ensureTables()`, signal handlers, child process or polling loop, hysteresis state machine.
3. Spawn from `instrumentation.ts`.
4. Add a `correlateXxxInterference()` pass to `packages/scheduler/src/interference-correlator.ts`, mirroring `correlateSdrInterference()`. Use the shared `buildFreqBandClauses` helper from `shure-freq-utils.ts` for freq-window filtering.
5. Add a new value to `InterferenceAttribution.source` (no schema change needed — text column).
6. Wire into `correlateAllInterference()` runner.

### Add a new AI tier

Daily Ollama job pattern (Tier 3 is the template):

1. New file at `packages/scheduler/src/your-pass.ts` exporting `async function generateYourThing()`.
2. Defensive `ensureXxxTable()` at the top.
3. Sanitize all free-form interpolated strings with `sanitizeForLlmContext()`.
4. `AbortSignal.timeout(120_000)` on the Ollama fetch.
5. Use `RF_DIGEST_MODEL` style env override (default to the shared resident `llama3.1:8b`).
6. Register in `scheduler-service.ts` via `this.registerPoll('yourPass', () => this.yourPassSafe(), intervalMs, initialDelayMs)`.
7. Wrapper method with try/catch so the scheduler tick survives.
8. Expose via `packages/scheduler/src/index.ts` export.
9. `GET /api/your/pass` route to read latest; `POST` to force-regenerate.

### Add a new UI panel

Pattern from `ShureRfAiPanel`:

1. Wrap in `<SafeBoundary label="Your Panel">` upstream.
2. Use `useCallback` for fetch handlers, `useEffect` for initial load.
3. Distinct loading / error / empty / data states.
4. If the panel hits the bartender :3002 surface, add the route prefix to `scripts/setup-bartender-nginx.sh` AND re-run it (and update `LOCATION_UPDATE_NOTES` manual-steps).
5. SafeBoundary stays on for the first few releases; remove only after the panel has shown zero render crashes across the fleet for several versions.

### Future Stage 2 — actual mic retune

`PreemptiveStrikeCandidate` already carries `suggestedCleanFreqs[]`. Stage 2 would:

1. Add `SET FREQUENCY` send method to `@sports-bar/shure-slxd` client (currently read-only).
2. Add `preemptive-strike.ts:actOnCandidate()` that picks `suggestions[0]`, sends the SET, waits for REP echo, logs an audit row.
3. Add operator opt-in flag (env or DB) so locations can enable autonomous retune independently from the alert-only Stage 1.
4. Surface the audit trail on the Wireless Mics admin tab.

The Shure protocol's silent-drop behavior on malformed/out-of-range commands (no `ERR`/`NAK` frame) means Stage 2 will need post-SET REP validation, not fire-and-forget.
