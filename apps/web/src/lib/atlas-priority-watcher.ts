/**
 * Atlas Priority/Mic Watcher
 *
 * Detects priority/page activity on the AZM8 by reading input meter
 * levels every 5 seconds. The AZM8 firmware doesn't expose a queryable
 * "priority active" parameter (probed 60+ candidate names 2026-05-17,
 * all returned -32604), so we infer priority by watching the mic input
 * audio levels — when a paging mic is in use its level spikes above
 * the room noise floor.
 *
 * The companion atlas-drop-watcher handles the other priority signal:
 * unexpected ZoneSource changes that we didn't command. Both write to
 * atlas_priority_events.
 *
 * Tuning:
 * - Inputs are considered "mic" when their name contains "MIC" (case
 *   insensitive). Set per-location via the Atlas configuration.
 * - Activation threshold: -45 dB sustained ABOVE_THRESHOLD_POLLS in a
 *   row. Deactivation: below DEACTIVATE_THRESHOLD for the same.
 *   Hysteresis prevents flapping on brief peaks.
 */

import { db, schema } from '@/db'
import { eq, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { randomUUID } from 'crypto'

const POLL_INTERVAL_MS = 5_000
const ACTIVATE_THRESHOLD_DB = -45
const DEACTIVATE_THRESHOLD_DB = -55
const ABOVE_THRESHOLD_POLLS = 1
const BELOW_THRESHOLD_POLLS = 2

type InputState = { active: boolean; aboveCount: number; belowCount: number }
const inputStates = new Map<string, InputState>()

function key(processorId: string, inputIndex: number): string {
  return `${processorId}:${inputIndex}`
}

async function pollOnce(baseUrl: string) {
  const processors = await db.select().from(schema.audioProcessors).all()

  for (const p of processors) {
    if (!p.ipAddress) continue
    if (p.processorType && p.processorType !== 'atlas') continue

    let meters: Array<{ index: number; name: string; level: number; peak: number }> = []
    try {
      const resp = await fetch(`${baseUrl}/api/atlas/input-meters?processorIp=${p.ipAddress}`)
      if (!resp.ok) continue
      const json = await resp.json()
      meters = json.meters || []
    } catch (err) {
      logger.debug(`[ATLAS-PRIORITY-WATCHER] Input meter fetch failed for ${p.ipAddress}: ${(err as Error).message}`)
      continue
    }

    for (const meter of meters) {
      if (!meter.name || !/mic/i.test(meter.name)) continue

      const k = key(p.id, meter.index)
      const state = inputStates.get(k) ?? { active: false, aboveCount: 0, belowCount: 0 }
      const level = typeof meter.level === 'number' ? meter.level : -80

      if (level >= ACTIVATE_THRESHOLD_DB) {
        state.aboveCount += 1
        state.belowCount = 0
      } else if (level <= DEACTIVATE_THRESHOLD_DB) {
        state.belowCount += 1
        state.aboveCount = 0
      } else {
        // Hysteresis band — hold current state, don't accumulate either way
        state.aboveCount = 0
        state.belowCount = 0
      }

      if (!state.active && state.aboveCount >= ABOVE_THRESHOLD_POLLS) {
        state.active = true
        const now = Math.floor(Date.now() / 1000)
        await db.run(sql`
          INSERT INTO atlas_priority_events
            (id, processor_id, event_type, input_index, input_name, input_level_db, detected_at)
          VALUES (
            ${randomUUID()}, ${p.id}, 'mic_active',
            ${meter.index}, ${meter.name}, ${level}, ${now}
          )
        `)
        logger.warn(`[ATLAS-PRIORITY] Mic active: "${meter.name}" (input ${meter.index}) at ${level.toFixed(1)} dB`)
      } else if (state.active && state.belowCount >= BELOW_THRESHOLD_POLLS) {
        state.active = false
        // No event written for deactivation — UI badge time-decays after
        // 30s of no recent events, so an explicit "end" row would be
        // misinterpreted as a new event.
        logger.info(`[ATLAS-PRIORITY] Mic idle: "${meter.name}" (input ${meter.index}) back to ${level.toFixed(1)} dB`)
      }

      inputStates.set(k, state)
    }
  }
}

export function startAtlasPriorityWatcher() {
  const baseUrl = `http://127.0.0.1:${process.env.PORT || 3001}`

  setTimeout(() => {
    pollOnce(baseUrl).catch((err) => logger.error('[ATLAS-PRIORITY-WATCHER] Initial poll failed:', err))
  }, 50_000)

  setInterval(() => {
    pollOnce(baseUrl).catch((err) => logger.error('[ATLAS-PRIORITY-WATCHER] Poll failed:', err))
  }, POLL_INTERVAL_MS)
}
