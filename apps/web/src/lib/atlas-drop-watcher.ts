/**
 * Atlas Drop Watcher
 *
 * Polls Atlas zone gain/source/mute every 30s and flags large unexplained
 * volume drops to atlas_drop_events. "Unexplained" = no matching write in
 * audio_volume_logs within the correlation window. Diagnostic-only — no
 * recovery action, no UI side effects.
 *
 * Added for the 2026-05-17 investigation of Bathroom + VIP Tent volumes
 * crashing to 1-2% repeatedly without any control-API write — to prove
 * whether the drops originate from Atlas firmware (Auto-Source, ducking,
 * scene recall), an external Atlas client, or an Atlas Group master.
 */

import { db, schema } from '@/db'
import { and, eq, sql } from 'drizzle-orm'
import { getAtlasClient } from '@sports-bar/atlas'
import { logger } from '@sports-bar/logger'
import { randomUUID } from 'crypto'

const POLL_INTERVAL_MS = 30_000
// Counts as a drop only if BOTH conditions hold — large delta AND the
// new value is in the "crashed" range. Filters out normal bartender
// fades and minor jitter from Atlas's gain-curve quantization.
const DROP_DELTA_THRESHOLD = 15
const DROP_LOW_FLOOR = 10
// Any audio_volume_logs write within this window is treated as the
// drop's cause. Bartender writes hit the log table within ~1s of the
// Atlas accepting them; 10s is comfortable headroom.
const CORRELATION_WINDOW_SEC = 10

type ZoneState = { volume: number; source: number; muted: boolean; observedAt: number }
const lastSeen = new Map<string, ZoneState>()

async function ensureTable() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS atlas_drop_events (
      id TEXT PRIMARY KEY,
      processor_id TEXT NOT NULL,
      zone_number INTEGER NOT NULL,
      zone_name TEXT,
      previous_volume INTEGER NOT NULL,
      new_volume INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      source_at_drop INTEGER,
      muted_at_drop INTEGER NOT NULL DEFAULT 0,
      gap_seconds INTEGER NOT NULL,
      explained INTEGER NOT NULL DEFAULT 0,
      detected_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS atlas_drop_events_detected_at_idx
      ON atlas_drop_events (detected_at)
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS atlas_drop_events_zone_idx
      ON atlas_drop_events (processor_id, zone_number, detected_at)
  `)
}

function readPct(resp: any): number | null {
  if (!resp?.success || !resp.data) return null
  if (resp.data.method === 'getResp' && resp.data.params?.pct !== undefined) {
    return Math.round(resp.data.params.pct)
  }
  if (typeof resp.data.value === 'number') return Math.round(resp.data.value)
  if (resp.data.result?.pct !== undefined) return Math.round(resp.data.result.pct)
  return null
}

function readVal(resp: any): number | null {
  if (!resp?.success || !resp.data) return null
  if (resp.data.method === 'getResp' && resp.data.params?.val !== undefined) {
    return resp.data.params.val
  }
  if (typeof resp.data.value === 'number') return resp.data.value
  if (resp.data.result?.val !== undefined) return resp.data.result.val
  return null
}

async function pollOnce() {
  const processors = await db.select().from(schema.audioProcessors).all()

  for (const p of processors) {
    if (!p.ipAddress) continue
    if (p.processorType && p.processorType !== 'atlas') continue

    const zones = await db.select().from(schema.audioZones)
      .where(and(eq(schema.audioZones.processorId, p.id), eq(schema.audioZones.enabled, true)))
      .all()
    if (zones.length === 0) continue

    let client
    try {
      client = await getAtlasClient(p.id, {
        ipAddress: p.ipAddress,
        tcpPort: p.tcpPort ?? 5321,
        timeout: 5_000,
      })
    } catch (err) {
      // Atlas unreachable — clear lastSeen so we don't false-positive
      // on the recovery once it comes back.
      for (const zone of zones) lastSeen.delete(`${p.id}:${zone.zoneNumber}`)
      logger.debug(`[ATLAS-DROP-WATCHER] ${p.name}@${p.ipAddress} unreachable: ${(err as Error).message}`)
      continue
    }

    for (const zone of zones) {
      try {
        const gainResp = await client.getParameter(`ZoneGain_${zone.zoneNumber}`, 'pct')
        const volume = readPct(gainResp)
        if (volume === null) continue

        const sourceResp = await client.getParameter(`ZoneSource_${zone.zoneNumber}`, 'val')
        const source = readVal(sourceResp) ?? -1

        const muteResp = await client.getParameter(`ZoneMute_${zone.zoneNumber}`, 'val')
        const muted = readVal(muteResp) === 1

        const key = `${p.id}:${zone.zoneNumber}`
        const prev = lastSeen.get(key)
        const now = Math.floor(Date.now() / 1000)

        if (prev) {
          const delta = prev.volume - volume
          if (delta >= DROP_DELTA_THRESHOLD && volume <= DROP_LOW_FLOOR) {
            // audio_volume_logs.zone_number is 1-based (Atlas zone), while
            // schema.audioZones.zoneNumber is 0-based (DB index).
            const atlasZone = zone.zoneNumber + 1
            const corr = await db.all<{ cnt: number }>(sql`
              SELECT COUNT(*) AS cnt FROM audio_volume_logs
              WHERE processor_id = ${p.id}
                AND zone_number = ${atlasZone}
                AND created_at >= ${now - CORRELATION_WINDOW_SEC}
            `)
            const explained = (corr[0]?.cnt ?? 0) > 0 ? 1 : 0

            await db.run(sql`
              INSERT INTO atlas_drop_events
                (id, processor_id, zone_number, zone_name,
                 previous_volume, new_volume, delta,
                 source_at_drop, muted_at_drop, gap_seconds,
                 explained, detected_at)
              VALUES (
                ${randomUUID()}, ${p.id}, ${atlasZone}, ${zone.name},
                ${prev.volume}, ${volume}, ${delta},
                ${source}, ${muted ? 1 : 0}, ${now - prev.observedAt},
                ${explained}, ${now}
              )
            `)

            const tag = explained ? 'EXPLAINED' : 'SILENT'
            const fn = explained ? logger.info : logger.warn
            fn(`[ATLAS-DROP] ${tag} drop on "${zone.name}" (Atlas zone ${atlasZone}): ${prev.volume} → ${volume} (Δ${delta}, gap ${now - prev.observedAt}s, src=${source}, muted=${muted})`)
          }
        }

        lastSeen.set(key, { volume, source, muted, observedAt: now })
      } catch (err) {
        logger.debug(`[ATLAS-DROP-WATCHER] Zone ${zone.zoneNumber} (${zone.name}) query failed: ${(err as Error).message}`)
      }
    }
  }
}

export async function startAtlasDropWatcher() {
  await ensureTable()

  setTimeout(() => {
    pollOnce().catch((err) => logger.error('[ATLAS-DROP-WATCHER] Initial poll failed:', err))
  }, 45_000)

  setInterval(() => {
    pollOnce().catch((err) => logger.error('[ATLAS-DROP-WATCHER] Poll failed:', err))
  }, POLL_INTERVAL_MS)
}
