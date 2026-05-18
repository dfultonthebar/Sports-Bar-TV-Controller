/**
 * SDR Spectrum Watcher — continuous wide-band RF monitoring
 *
 * Complements the Shure RF watcher (which only sees activity on the
 * specific frequencies our receiver is tuned to) by sweeping the
 * entire G58 band (470-514 MHz) — or any operator-configured band —
 * via an RTL-SDR (NooElec NESDR Smart or compatible) dongle plugged
 * into the PM2 host.
 *
 * SPAWNS rtl_power AS A LONG-LIVED CHILD PROCESS:
 *
 *   rtl_power -f 470M:514M:25k -i 1 -e 0 -g 25
 *
 * Output is one CSV row per sweep, each row representing the power
 * spectrum across the configured band at 25 kHz resolution. We
 * parse line-by-line, write per-minute MAX/AVG aggregates to
 * `sdr_spectrum` (raw 1-sec data would be ~17 GB/year — aggregates
 * are 1/60 the volume), and emit carrier events to `sdr_carriers`
 * when a freq bin sustains above-threshold power for N samples.
 *
 * GRACEFUL DEGRADATION at locations without an SDR dongle:
 *   - If rtl_power binary is missing, log a one-time info + stay idle.
 *   - If rtl_test reports no device, retry every 5 min (operator may
 *     plug a dongle in later — no app restart needed).
 *   - If the spawned process dies, exponential-backoff restart up
 *     to 5 min, then steady 5 min retry.
 *
 * Disabled by default via env. Set SDR_ENABLED=true after the
 * RTL-SDR is connected + `rtl_test -t` confirms the dongle works.
 */

import { spawn, execFile } from 'child_process'
import * as readline from 'readline'
import { randomUUID } from 'crypto'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

const ENABLED = process.env.SDR_ENABLED === 'true'
const BAND_START_MHZ = parseFloat(process.env.SDR_BAND_START_MHZ ?? '470')
const BAND_END_MHZ = parseFloat(process.env.SDR_BAND_END_MHZ ?? '514')
const RESOLUTION_KHZ = parseFloat(process.env.SDR_RESOLUTION_KHZ ?? '25')
const SWEEP_INTERVAL_SEC = parseInt(process.env.SDR_SWEEP_INTERVAL_SEC ?? '1', 10)
const GAIN_DB = process.env.SDR_GAIN_DB ?? '25'
const CARRIER_THRESHOLD_DBM = parseFloat(process.env.SDR_CARRIER_THRESHOLD_DBM ?? '-85')
const CARRIER_DETECT_SAMPLES = parseInt(process.env.SDR_CARRIER_DETECT_SAMPLES ?? '3', 10)
const CARRIER_CLEAR_SAMPLES = parseInt(process.env.SDR_CARRIER_CLEAR_SAMPLES ?? '5', 10)
const RESTART_BACKOFF_INITIAL_MS = 5_000
const RESTART_BACKOFF_MAX_MS = 5 * 60 * 1000

// Per-minute aggregator. Keyed by `${minuteBucket}:${freqMhz.toFixed(4)}`
// — the watcher accumulates max/avg/count over the minute, then flushes
// to DB at the minute boundary. In-memory size is bounded:
// 1760 bins × 60 sec = 105K entries max, ~5 MB RAM.
type AggBucket = { max: number; sum: number; count: number; minute: number; freq: number }
const aggregator = new Map<string, AggBucket>()

// Carrier-detection state machine — per freq bin. Tracks consecutive
// above-threshold samples for rising-edge, consecutive below for
// falling-edge. Tight on memory because most bins stay at noise floor
// indefinitely; we only allocate state when a bin first crosses.
type CarrierState = {
  active: boolean
  aboveCount: number
  belowCount: number
  firstSeenSec: number
  peakDbm: number
  sumDbm: number
  sampleCount: number
  lastHeartbeatSec: number
}
const carriers = new Map<number, CarrierState>() // key = freqMhz

let childProcess: ReturnType<typeof spawn> | null = null
let backoffMs = RESTART_BACKOFF_INITIAL_MS
let stopRequested = false

async function ensureTables(): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sdr_spectrum (
      id TEXT PRIMARY KEY,
      freq_mhz REAL NOT NULL,
      bin_width_khz REAL NOT NULL,
      max_dbm REAL NOT NULL,
      avg_dbm REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      bucket_at INTEGER NOT NULL,
      detected_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS sdr_spectrum_bucket_idx ON sdr_spectrum (bucket_at)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS sdr_spectrum_freq_bucket_idx ON sdr_spectrum (freq_mhz, bucket_at)`)

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sdr_carriers (
      id TEXT PRIMARY KEY,
      freq_mhz REAL NOT NULL,
      event_type TEXT NOT NULL,
      peak_dbm REAL,
      avg_dbm REAL,
      duration_sec INTEGER,
      note TEXT,
      detected_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS sdr_carriers_detected_at_idx ON sdr_carriers (detected_at DESC)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS sdr_carriers_freq_detected_idx ON sdr_carriers (freq_mhz, detected_at DESC)`)
}

function checkRtlPower(): Promise<{ available: boolean; error?: string }> {
  return new Promise((resolve) => {
    execFile('which', ['rtl_power'], (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve({ available: false, error: 'rtl_power binary not in PATH (install rtl-sdr package)' })
        return
      }
      execFile('rtl_test', ['-t'], { timeout: 5_000 }, (testErr, testOut, testStderr) => {
        const out = (testOut + testStderr).toLowerCase()
        if (out.includes('found 0 device') || out.includes('no supported devices')) {
          resolve({ available: false, error: 'no RTL-SDR dongle detected (rtl_test -t found 0 devices)' })
          return
        }
        if (testErr && !out.includes('found 1') && !out.includes('found 2')) {
          resolve({ available: false, error: `rtl_test failed: ${testErr.message}` })
          return
        }
        resolve({ available: true })
      })
    })
  })
}

function flushAggregator(forceAll = false): void {
  const now = Math.floor(Date.now() / 1000)
  const currentMinute = Math.floor(now / 60) * 60
  const stmt = db
  const toFlush: AggBucket[] = []
  for (const [key, bucket] of aggregator.entries()) {
    if (forceAll || bucket.minute < currentMinute) {
      toFlush.push(bucket)
      aggregator.delete(key)
    }
  }
  if (toFlush.length === 0) return
  // Batch insert. SQLite handles thousand-row inserts in a single tx
  // fine; spreading them keeps the writer thread responsive.
  Promise.resolve().then(async () => {
    for (const b of toFlush) {
      try {
        await stmt.run(sql`
          INSERT INTO sdr_spectrum (id, freq_mhz, bin_width_khz, max_dbm, avg_dbm, sample_count, bucket_at, detected_at)
          VALUES (${randomUUID()}, ${b.freq}, ${RESOLUTION_KHZ}, ${b.max}, ${b.sum / b.count}, ${b.count}, ${b.minute}, ${now})
        `)
      } catch (err) {
        logger.debug(`[SDR-WATCHER] aggregator flush row failed: ${(err as Error)?.message ?? err}`)
      }
    }
  })
}

async function writeCarrierEvent(
  freq: number,
  type: 'carrier_active' | 'carrier_cleared' | 'carrier_heartbeat',
  peak: number,
  avg: number,
  durationSec: number | null,
  note?: string,
): Promise<void> {
  try {
    await db.run(sql`
      INSERT INTO sdr_carriers (id, freq_mhz, event_type, peak_dbm, avg_dbm, duration_sec, note, detected_at)
      VALUES (${randomUUID()}, ${freq}, ${type}, ${peak}, ${avg}, ${durationSec}, ${note ?? null}, ${Math.floor(Date.now() / 1000)})
    `)
  } catch (err) {
    logger.debug(`[SDR-WATCHER] carrier event insert failed: ${(err as Error)?.message ?? err}`)
  }
}

function handleSweepLine(line: string): void {
  // rtl_power CSV: date, time, hz_low, hz_high, hz_step, samples, dB1, dB2, ..., dBN
  // Skip headers, comments, blank lines.
  if (!line || line.startsWith('#') || line.startsWith('date,')) return
  const parts = line.split(',').map((p) => p.trim())
  if (parts.length < 7) return
  const hzLow = parseFloat(parts[2])
  const hzHigh = parseFloat(parts[3])
  const hzStep = parseFloat(parts[4])
  if (!Number.isFinite(hzLow) || !Number.isFinite(hzStep) || hzStep <= 0) return
  const dbValues = parts.slice(6).map((v) => parseFloat(v))
  const now = Math.floor(Date.now() / 1000)
  const minuteBucket = Math.floor(now / 60) * 60

  for (let i = 0; i < dbValues.length; i++) {
    const power = dbValues[i]
    if (!Number.isFinite(power)) continue
    // Bin center freq in MHz, rounded to 4 decimal places for stable key.
    const freqHz = hzLow + (i + 0.5) * hzStep
    const freqMhz = Math.round(freqHz / 100) / 10_000 // = freqHz / 1_000_000 with .0001 rounding
    const key = `${minuteBucket}:${freqMhz.toFixed(4)}`

    // Aggregator
    const bucket = aggregator.get(key)
    if (bucket) {
      if (power > bucket.max) bucket.max = power
      bucket.sum += power
      bucket.count += 1
    } else {
      aggregator.set(key, { max: power, sum: power, count: 1, minute: minuteBucket, freq: freqMhz })
    }

    // Carrier detection state machine
    let cs = carriers.get(freqMhz)
    const hot = power >= CARRIER_THRESHOLD_DBM
    if (!cs) {
      if (!hot) continue // never allocate state for bins at the floor
      cs = {
        active: false, aboveCount: 0, belowCount: 0,
        firstSeenSec: 0, peakDbm: -200, sumDbm: 0, sampleCount: 0,
        lastHeartbeatSec: 0,
      }
      carriers.set(freqMhz, cs)
    }

    if (hot) {
      cs.aboveCount += 1
      cs.belowCount = 0
      cs.sumDbm += power
      cs.sampleCount += 1
      if (power > cs.peakDbm) cs.peakDbm = power
    } else {
      cs.belowCount += 1
      cs.aboveCount = 0
    }

    if (!cs.active && cs.aboveCount >= CARRIER_DETECT_SAMPLES) {
      cs.active = true
      cs.firstSeenSec = now
      cs.lastHeartbeatSec = now
      writeCarrierEvent(freqMhz, 'carrier_active', cs.peakDbm, cs.sumDbm / cs.sampleCount, null,
        `rising edge: ${cs.aboveCount} samples ≥ ${CARRIER_THRESHOLD_DBM}dBm`).catch(() => {})
      logger.info(`[SDR-WATCHER] carrier ON @ ${freqMhz.toFixed(3)} MHz (peak ${cs.peakDbm.toFixed(0)} dBm)`)
    } else if (cs.active && (now - cs.lastHeartbeatSec) >= 30) {
      cs.lastHeartbeatSec = now
      writeCarrierEvent(freqMhz, 'carrier_heartbeat', cs.peakDbm, cs.sumDbm / cs.sampleCount, now - cs.firstSeenSec).catch(() => {})
    } else if (cs.active && cs.belowCount >= CARRIER_CLEAR_SAMPLES) {
      const duration = now - cs.firstSeenSec
      writeCarrierEvent(freqMhz, 'carrier_cleared', cs.peakDbm, cs.sumDbm / cs.sampleCount, duration,
        `${cs.belowCount} samples below threshold`).catch(() => {})
      logger.info(`[SDR-WATCHER] carrier OFF @ ${freqMhz.toFixed(3)} MHz (duration ${duration}s, peak ${cs.peakDbm.toFixed(0)} dBm)`)
      carriers.delete(freqMhz) // free state; new event allocates fresh
    }
  }

  // Periodically flush minute buckets that have rolled over.
  flushAggregator(false)
}

function spawnRtlPower(): void {
  if (stopRequested) return
  const args = [
    '-f', `${BAND_START_MHZ}M:${BAND_END_MHZ}M:${RESOLUTION_KHZ}k`,
    '-i', String(SWEEP_INTERVAL_SEC),
    '-g', GAIN_DB,
    '-e', '0', // run forever
  ]
  logger.info(`[SDR-WATCHER] spawning rtl_power ${args.join(' ')}`)
  childProcess = spawn('rtl_power', args, { stdio: ['ignore', 'pipe', 'pipe'] })

  const rl = readline.createInterface({ input: childProcess.stdout! })
  rl.on('line', handleSweepLine)
  childProcess.stderr?.on('data', (chunk) => {
    const s = chunk.toString().trim()
    if (s && !s.toLowerCase().includes('tuner gain')) {
      logger.debug(`[SDR-WATCHER] rtl_power stderr: ${s.slice(0, 200)}`)
    }
  })
  childProcess.on('exit', (code, signal) => {
    childProcess = null
    if (stopRequested) return
    logger.warn(`[SDR-WATCHER] rtl_power exited (code=${code}, signal=${signal}); restart in ${backoffMs / 1000}s`)
    setTimeout(spawnRtlPower, backoffMs)
    backoffMs = Math.min(backoffMs * 2, RESTART_BACKOFF_MAX_MS)
  })

  // Reset backoff after a successful 60s run.
  setTimeout(() => {
    if (childProcess && !childProcess.killed) backoffMs = RESTART_BACKOFF_INITIAL_MS
  }, 60_000)
}

/**
 * Entry point — called from instrumentation.ts on app boot. Returns
 * quickly; the watcher runs as a background subprocess + handlers.
 */
export async function startSdrWatcher(): Promise<void> {
  if (!ENABLED) {
    logger.info('[SDR-WATCHER] disabled (set SDR_ENABLED=true to enable, requires rtl-sdr + dongle)')
    return
  }
  await ensureTables()
  const check = await checkRtlPower()
  if (!check.available) {
    logger.warn(`[SDR-WATCHER] ${check.error} — retry in 5 min`)
    setTimeout(() => startSdrWatcher().catch(() => {}), 5 * 60 * 1000)
    return
  }
  logger.info(`[SDR-WATCHER] band ${BAND_START_MHZ}-${BAND_END_MHZ} MHz @ ${RESOLUTION_KHZ} kHz resolution, ${SWEEP_INTERVAL_SEC}s sweep`)
  // Periodic flush — even if no rollover yet, force any buckets older
  // than the current minute to disk.
  setInterval(() => flushAggregator(false), 30_000)
  spawnRtlPower()
}

export function stopSdrWatcher(): void {
  stopRequested = true
  if (childProcess && !childProcess.killed) childProcess.kill('SIGTERM')
  flushAggregator(true)
}
