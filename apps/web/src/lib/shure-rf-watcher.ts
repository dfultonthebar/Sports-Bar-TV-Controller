/**
 * Shure RF Watcher
 *
 * Subscribes to RSSI meter pushes from each configured Shure SLX-D
 * receiver. Detects interference signatures via the hysteresis pattern
 * cribbed from atlas-priority-watcher:
 *
 *   ACTIVATE: RSSI ≥ -85 dBm AND TX_MODEL == 'UNKNOWN' sustained 3
 *             consecutive samples (transmitter absent but the noise
 *             floor is elevated — something else is on our freq).
 *   DEACTIVATE: 3 consecutive samples below the activate threshold
 *               OR TX_MODEL becomes a real model (rightful TX returned).
 *
 * Events land in three places:
 *   1. shure_rf_events DB table (audit history, /api/shure-rf endpoint)
 *   2. Dedicated daily log file (operator-requested separate file)
 *   3. PM2 log via @sports-bar/logger (matches existing watchers)
 *
 * SLX-D firmware exposes no native "interference flag" — see
 * packages/shure-slxd/src/config.ts INTERFERENCE_THRESHOLDS for the
 * inferential heuristic and rationale.
 */

import { db, schema } from '@/db'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { logger } from '@sports-bar/logger'
import {
  getShureSlxdClient,
  INTERFERENCE_THRESHOLDS,
  SHURE_PROTOCOL,
  type ShureChannelState,
} from '@sports-bar/shure-slxd'
import { logShureRfEvent, pruneOldShureRfLogs } from './shure-rf-logger'

/**
 * Per-channel rolling counters for hysteresis. Keyed by `${receiverId}:${ch}`.
 */
type ChannelCounters = {
  active: boolean
  aboveCount: number
  belowCount: number
  lastEventAt: number // unix sec
  lowBatteryActive: boolean // tracks rising-edge for TX_BATT_BARS ≤ 1
}
const counters = new Map<string, ChannelCounters>()

// Heartbeat — while active, refresh the audit row at most every 20s
// so the "active in last 30s" banner query keeps returning rows for
// as long as the interference persists. Same pattern as
// atlas-priority-watcher.
const HEARTBEAT_INTERVAL_SEC = 20

async function ensureTable(): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS shure_rf_events (
      id TEXT PRIMARY KEY,
      receiver_id TEXT NOT NULL,
      receiver_name TEXT,
      ip_address TEXT,
      channel INTEGER NOT NULL DEFAULT 0,
      event_type TEXT NOT NULL,
      rssi_dbm REAL,
      frequency_mhz REAL,
      tx_type TEXT,
      note TEXT,
      detected_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS shure_rf_events_detected_at_idx
      ON shure_rf_events (detected_at)
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS shure_rf_events_receiver_idx
      ON shure_rf_events (receiver_id, channel, detected_at)
  `)
}

/**
 * Insert an audit row + dedicated log line for a single event.
 */
async function writeEvent(args: {
  receiverId: string
  receiverName: string
  ipAddress: string
  channel: number
  eventType: 'rf_interference' | 'rf_interference_heartbeat' | 'rf_cleared' | 'tx_offline' | 'tx_online' | 'low_battery' | 'startup' | 'freq_changed'
  rssiDbm?: number
  frequencyMhz?: number
  txType?: string
  note?: string
  level?: 'info' | 'warn' | 'error'
}): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db.run(sql`
    INSERT INTO shure_rf_events
      (id, receiver_id, receiver_name, ip_address, channel, event_type,
       rssi_dbm, frequency_mhz, tx_type, note, detected_at)
    VALUES (
      ${randomUUID()}, ${args.receiverId}, ${args.receiverName}, ${args.ipAddress},
      ${args.channel}, ${args.eventType},
      ${args.rssiDbm ?? null}, ${args.frequencyMhz ?? null}, ${args.txType ?? null},
      ${args.note ?? null}, ${now}
    )
  `)
  await logShureRfEvent({
    level: args.level ?? (args.eventType === 'rf_interference' ? 'warn' : 'info'),
    receiverId: args.receiverName || args.receiverId,
    channel: args.channel || undefined,
    event: args.eventType,
    rssiDbm: args.rssiDbm,
    frequencyMhz: args.frequencyMhz,
    txType: args.txType,
    note: args.note,
  })
}

/**
 * Evaluate the current channel state against thresholds, emitting
 * events on the rising / falling edges. Heartbeats refresh the row
 * while the condition persists.
 */
async function evaluateChannel(args: {
  receiverId: string
  receiverName: string
  ipAddress: string
  channel: number
  state: ShureChannelState
}): Promise<void> {
  const { receiverId, receiverName, ipAddress, channel, state } = args
  const key = `${receiverId}:${channel}`
  const c = counters.get(key) ?? {
    active: false,
    aboveCount: 0,
    belowCount: 0,
    lastEventAt: 0,
    lowBatteryActive: false,
  }

  // Low-battery rising edge — fires when txBattBars drops to ≤ 1 from
  // a higher value, clears when it goes back above 1 (TX swapped or
  // batteries replaced). 255 = unknown (alkaline TX), skip.
  if (state.txBattBars !== undefined && state.txBattBars !== 255) {
    const wasLow = c.lowBatteryActive
    const isLow = state.txBattBars <= 1
    if (isLow && !wasLow) {
      c.lowBatteryActive = true
      const mins = state.txBattRuntimeMin
      const minsNote = mins !== undefined && mins < 65_000
        ? ` (${mins} min remaining)`
        : ''
      await writeEvent({
        receiverId, receiverName, ipAddress, channel,
        eventType: 'low_battery',
        rssiDbm: state.rssiDbm,
        frequencyMhz: state.frequencyMhz,
        txType: state.txType,
        note: `TX battery at ${state.txBattBars} bar(s)${minsNote}`,
        level: 'warn',
      })
    } else if (!isLow && wasLow) {
      c.lowBatteryActive = false
      logger.info(`[SHURE-RF-WATCHER] battery recovered on ${receiverName} ch${channel} (${state.txBattBars} bars)`)
    }
  }

  const rssi = state.rssiDbm
  // TX-presence signal — must be robust against the TX-power-on
  // transient where the receiver detects an RF carrier (RSSI jumps
  // up) BEFORE the TX_BATT_BARS / TX_TYPE REP messages have arrived
  // (REP-on-change can lag 1-3 sec behind SAMPLE). Without the
  // audio-silence guard, this window fired a false rf_interference
  // event every time the operator powered the mic on at Holmgren
  // 2026-05-18.
  //
  // Real interference signature:
  //   - bars sentinel (255 or undefined) AND
  //   - tx_type not a known model AND
  //   - receiver audio output is at digital silence (no decoded carrier)
  // TX-power-on transient differs on the audio criterion: the
  // receiver locks the digital signal within ~100ms of carrier
  // detection, so audio is already above the noise floor by the
  // time we'd otherwise count interference samples.
  const hasBattery = state.txBattBars !== undefined && state.txBattBars !== 255
  const txTypeKnownPresent =
    state.txType !== undefined &&
    state.txType !== '' &&
    state.txType.toUpperCase() !== 'UNKNOWN'
  const audioSilent = (state.audioPeakDbfs ?? -120) <= -100
  const txOff = !hasBattery && !txTypeKnownPresent && audioSilent

  if (rssi === undefined) {
    counters.set(key, c)
    return
  }

  const isHot = rssi >= INTERFERENCE_THRESHOLDS.ACTIVATE_RSSI_DBM
  const isCool = rssi <= INTERFERENCE_THRESHOLDS.DEACTIVATE_RSSI_DBM

  // Only count toward "interference" when the TX itself is absent.
  // High RSSI with a real TX_MODEL is just a strong signal — that's
  // the desired state.
  if (isHot && txOff) {
    c.aboveCount += 1
    c.belowCount = 0
  } else if (isCool || !txOff) {
    c.belowCount += 1
    c.aboveCount = 0
  } else {
    // Hysteresis band — RSSI is between activate (-85) and deactivate
    // (-95) thresholds. Hold current active/inactive state and reset
    // both counters so a transient spike in the marginal zone doesn't
    // count toward either edge. Operator-visible consequence: an
    // active event with fluctuating RSSI in the marginal zone stays
    // active until RSSI cleanly drops below -95 (intentional —
    // prevents banner flapping while interference is still real).
    c.aboveCount = 0
    c.belowCount = 0
  }

  const now = Math.floor(Date.now() / 1000)

  if (!c.active && c.aboveCount >= INTERFERENCE_THRESHOLDS.ABOVE_SAMPLES_TO_ACTIVATE) {
    c.active = true
    c.lastEventAt = now
    await writeEvent({
      receiverId, receiverName, ipAddress, channel,
      eventType: 'rf_interference',
      rssiDbm: rssi,
      frequencyMhz: state.frequencyMhz,
      txType: state.txType,
      note: `rising edge: ${INTERFERENCE_THRESHOLDS.ABOVE_SAMPLES_TO_ACTIVATE} samples ≥ ${INTERFERENCE_THRESHOLDS.ACTIVATE_RSSI_DBM}dBm with TX off`,
      level: 'warn',
    })
  } else if (c.active && c.belowCount >= INTERFERENCE_THRESHOLDS.BELOW_SAMPLES_TO_DEACTIVATE) {
    c.active = false
    await writeEvent({
      receiverId, receiverName, ipAddress, channel,
      eventType: 'rf_cleared',
      rssiDbm: rssi,
      frequencyMhz: state.frequencyMhz,
      txType: state.txType,
      note: 'RF floor dropped or TX returned',
      level: 'info',
    })
  } else if (c.active && now - c.lastEventAt >= HEARTBEAT_INTERVAL_SEC) {
    c.lastEventAt = now
    await writeEvent({
      receiverId, receiverName, ipAddress, channel,
      eventType: 'rf_interference_heartbeat',
      rssiDbm: rssi,
      frequencyMhz: state.frequencyMhz,
      txType: state.txType,
      note: 'still hot',
      level: 'info',
    })
  }

  counters.set(key, c)
}

/**
 * Track which receivers we've already wired a listener to, so the
 * 5-min rediscovery scan doesn't append duplicate stateChange
 * listeners to the same managed client. EventEmitter.on does NOT
 * dedupe — without this set the same RSSI sample would be evaluated
 * (and written to the audit table) N times after N rediscovery passes.
 */
const attachedReceivers = new Set<string>()

async function setProcessorStatus(processorId: string, status: 'online' | 'offline'): Promise<void> {
  try {
    if (status === 'online') {
      await db.run(sql`
        UPDATE AudioProcessor
           SET status = 'online',
               lastSeen = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
               updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ${processorId}
      `)
    } else {
      await db.run(sql`
        UPDATE AudioProcessor
           SET status = 'offline',
               updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ${processorId}
      `)
    }
  } catch (err) {
    logger.debug(`[SHURE-RF-WATCHER] status sync failed for ${processorId}: ${(err as Error).message}`)
  }
}

/**
 * Wire up one receiver: connect, attach stateChange handler that
 * runs the threshold evaluator, start metering at 1 Hz.
 */
async function attachReceiver(processor: {
  id: string
  name: string | null
  ipAddress: string | null
  tcpPort: number | null
  model: string | null
}): Promise<void> {
  if (!processor.ipAddress) return
  if (attachedReceivers.has(processor.id)) return
  const receiverName = processor.name || processor.ipAddress
  try {
    const client = await getShureSlxdClient(processor.id, {
      ipAddress: processor.ipAddress,
      port: processor.tcpPort ?? 2202,
      receiverId: processor.id,
      receiverName,
      autoReconnect: true,
    })

    client.on('stateChange', (channel: number, state: ShureChannelState) => {
      evaluateChannel({
        receiverId: processor.id,
        receiverName,
        ipAddress: processor.ipAddress!,
        channel,
        state,
      }).catch((err) => logger.error(`[SHURE-RF-WATCHER] evaluate failed: ${(err as Error).message}`))
    })

    // Keep AudioProcessor.status / lastSeen in sync with the live TCP
    // state so every consumer (Wireless Mics admin, Audio Processors
    // list, Overview tab counts) sees the same truth. Without this the
    // DB column stays at whatever it was when the row was first
    // inserted — operator complaint at Holmgren 2026-05-18.
    client.on('connected', () => {
      setProcessorStatus(processor.id, 'online').catch(() => {})
    })
    client.on('disconnected', () => {
      setProcessorStatus(processor.id, 'offline').catch(() => {})
    })

    // Use a faster metering rate than the BF default 5000ms so we
    // catch RF interference within ~3s. Spec allows 50-60000; we pick
    // 1000ms — fast enough for game-day responsiveness, slow enough
    // not to lock the receiver's web UI per Bitfocus HELP guidance.
    await client.startMetering(1_000)
    attachedReceivers.add(processor.id)
    await setProcessorStatus(processor.id, 'online')
    logger.info(`[SHURE-RF-WATCHER] attached to ${receiverName} @ ${processor.ipAddress}:${processor.tcpPort ?? 2202}`)
  } catch (err) {
    await setProcessorStatus(processor.id, 'offline')
    logger.warn(`[SHURE-RF-WATCHER] could not attach to ${receiverName} @ ${processor.ipAddress}: ${(err as Error).message}`)
  }
}

/**
 * Discover all `processorType='shure-slxd'` rows and attach to each.
 * Idempotent — `getShureSlxdClient` returns the existing managed
 * client on the second call.
 */
async function discoverAndAttach(): Promise<void> {
  const processors = await db.select().from(schema.audioProcessors).all()
  const shureRows = processors.filter((p) => p.processorType === 'shure-slxd')
  if (shureRows.length === 0) {
    logger.info('[SHURE-RF-WATCHER] no shure-slxd receivers configured — watcher idle')
    return
  }
  for (const p of shureRows) {
    await attachReceiver(p as any)
  }
}

/**
 * Public entry point — called from instrumentation.ts on app boot.
 * Creates the table, writes a startup row, prunes old logs, attaches
 * to receivers, then re-scans every 5 minutes so a newly-added
 * receiver gets picked up without a full app restart.
 */
export async function startShureRfWatcher(): Promise<void> {
  await ensureTable()

  // Startup marker — proves the watcher booted even if no real RF
  // events fire today. Same pattern as atlas-drop-watcher.
  await writeEvent({
    receiverId: '',
    receiverName: 'watcher',
    ipAddress: '',
    channel: 0,
    eventType: 'startup',
    note: `pid=${process.pid}`,
    level: 'info',
  })

  // Best-effort prune. Doesn't block startup if filesystem misbehaves.
  pruneOldShureRfLogs().catch(() => {})

  // Initial discovery after 60s so the rest of the app has time to
  // settle (DB seeding, other watchers).
  setTimeout(() => {
    discoverAndAttach().catch((err) => logger.error(`[SHURE-RF-WATCHER] discovery failed: ${(err as Error)?.message ?? err}`))
  }, 60_000)

  // Re-scan every 5 minutes for newly-added receivers.
  setInterval(() => {
    discoverAndAttach().catch((err) => logger.debug(`[SHURE-RF-WATCHER] re-scan failed: ${(err as Error)?.message ?? err}`))
  }, 5 * 60 * 1000)
}
