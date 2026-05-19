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
import { wasRecentlyCommandedSource } from '@/lib/atlas-commanded-state'

// During the 2026-05-17 investigation we discovered that nothing was
// writing live ZoneGain values back to audioZones.volume. The control
// route only writes currentSource; ?live=true only syncs muted from
// output meters. So the slider in the bartender remote was reading a
// DB cache that hadn't been refreshed since the last UI-side write —
// days-stale for any zone that auto-changed on the Atlas side. Bartenders
// saw "Bathroom = 0" and dragged it up, when the actual Atlas gain was
// already at 45%. The watcher polls the truth, so let it sync the cache.

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
// After firing a drop event for a zone, refuse to fire another for
// that zone until the volume has RECOVERED above DROP_LOW_FLOOR OR
// this cooldown elapses. Prevents the post-firmware-update spam at
// Holmgren 2026-05-18 where one real drop (volume 45 → 5 at 10:22)
// got re-fired every 30 seconds for the next 28 minutes because the
// volume stayed at 5 the entire time, sliding 50 identical rows
// into the audit table.
const DROP_COOLDOWN_SEC = 5 * 60

type ZoneState = { volume: number; source: number; muted: boolean; observedAt: number }
const lastSeen = new Map<string, ZoneState>()
// Per-zone cooldown timestamps — unix sec when each zone last fired
// a drop event. Reset when volume recovers above the floor.
const dropCooldown = new Map<string, number>()

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

  // Priority/page events. Populated by both atlas-drop-watcher (source
  // overrides) and atlas-priority-watcher (mic input level spikes).
  // event_type: 'source_override' | 'mic_active'
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS atlas_priority_events (
      id TEXT PRIMARY KEY,
      processor_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      zone_number INTEGER,
      zone_name TEXT,
      previous_source INTEGER,
      new_source INTEGER,
      input_index INTEGER,
      input_name TEXT,
      input_level_db REAL,
      detected_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS atlas_priority_events_detected_at_idx
      ON atlas_priority_events (detected_at)
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS atlas_priority_events_processor_type_idx
      ON atlas_priority_events (processor_id, event_type, detected_at)
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

        // Reset cooldown when volume recovers above the floor — a real
        // subsequent drop after the zone came back up is worth firing.
        const cooldownAt = dropCooldown.get(key)
        if (cooldownAt && volume > DROP_LOW_FLOOR) dropCooldown.delete(key)

        if (prev) {
          const delta = prev.volume - volume
          if (delta >= DROP_DELTA_THRESHOLD && volume <= DROP_LOW_FLOOR) {
            // Cooldown check — suppress duplicate fires for the same
            // sustained-low state. Holmgren 2026-05-18 hit this when
            // Atlas firmware 4.5 introduced Custom Priority Volume that
            // pins zone gain to a fixed low level while priority is
            // active. The drop watcher saw "volume keeps being 5" every
            // poll vs cached prev=45 and re-fired the same event 50+
            // times. Cooldown clears when volume recovers above the
            // floor, OR after DROP_COOLDOWN_SEC, whichever first.
            const recentlyFired = cooldownAt && (now - cooldownAt) < DROP_COOLDOWN_SEC
            if (!recentlyFired) {
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
              dropCooldown.set(key, now)

              const tag = explained ? 'EXPLAINED' : 'SILENT'
              const fn = explained ? logger.info : logger.warn
              fn(`[ATLAS-DROP] ${tag} drop on "${zone.name}" (Atlas zone ${atlasZone}): ${prev.volume} → ${volume} (Δ${delta}, gap ${now - prev.observedAt}s, src=${source}, muted=${muted})`)
            }
          }
        }

        // CRITICAL: update lastSeen IMMEDIATELY after a successful read,
        // before any other operations that could throw. Holmgren 2026-05-18
        // root cause: when source-override INSERT threw inside the
        // try/catch (per-zone catch at line 270 swallows everything),
        // the lastSeen.set at the end never ran, so prev.observedAt
        // stayed frozen at the FIRST poll's time and gap_seconds
        // increased monotonically across 50+ false-positive replays.
        // Moving the cache update here means partial-failure paths
        // (db write fails, etc.) still leave the watcher with a
        // current baseline — at worst they miss one event, not
        // re-fire the same event forever.
        lastSeen.set(key, { volume, source, muted, observedAt: now })

        // Source override detection: if the source changed between
        // polls AND the new value doesn't match anything we commanded
        // in the last 10s, that's the Atlas firmware (priority/page)
        // taking over.
        if (prev && prev.source !== source && source >= 0) {
          if (!wasRecentlyCommandedSource(p.id, zone.zoneNumber, source)) {
            const atlasZone = zone.zoneNumber + 1
            await db.run(sql`
              INSERT INTO atlas_priority_events
                (id, processor_id, event_type, zone_number, zone_name,
                 previous_source, new_source, detected_at)
              VALUES (
                ${randomUUID()}, ${p.id}, 'source_override',
                ${atlasZone}, ${zone.name},
                ${prev.source}, ${source}, ${now}
              )
            `)
            logger.warn(`[ATLAS-PRIORITY] Source override on "${zone.name}" (Atlas zone ${atlasZone}): src ${prev.source} → ${source} (not commanded by us)`)
          }
        }

        // Sync audioZones cache with truth from Atlas so the bartender
        // slider doesn't render a multi-day-stale volume on next load.
        // Only write when something changed to keep DB churn low.
        if (
          zone.volume !== volume ||
          (zone.muted ? 1 : 0) !== (muted ? 1 : 0) ||
          (zone.currentSource ?? '') !== String(source)
        ) {
          await db.update(schema.audioZones)
            .set({
              volume,
              muted,
              currentSource: String(source),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.audioZones.id, zone.id))
        }
      } catch (err) {
        // Log full error context (message + stack) instead of just
        // .message — debug-level errors that lost stacks made it
        // impossible to diagnose the Holmgren spam without an external
        // research agent + manual analysis. Same lesson as the
        // shure-rf-watcher logger.error gotcha (v2.34.2).
        const e = err as Error
        logger.debug(`[ATLAS-DROP-WATCHER] Zone ${zone.zoneNumber} (${zone.name}) query failed: ${e?.message ?? err}\n${e?.stack ?? ''}`)
      }
    }
  }
}

export async function startAtlasDropWatcher() {
  await ensureTable()
  await writeStartupEvent('drop_watcher')

  setTimeout(() => {
    pollOnce().catch((err) => logger.error('[ATLAS-DROP-WATCHER] Initial poll failed:', err))
  }, 45_000)

  setInterval(() => {
    pollOnce().catch((err) => logger.error('[ATLAS-DROP-WATCHER] Poll failed:', err))
  }, POLL_INTERVAL_MS)
}

/**
 * Write a synthetic startup row to atlas_priority_events so operators
 * can see in the audit table that the watcher actually booted, even
 * when no real events have fired. Shared by both watchers so a single
 * SELECT on event_type='startup' shows the boot history.
 */
export async function writeStartupEvent(watcherName: string): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000)
    await db.run(sql`
      INSERT INTO atlas_priority_events
        (id, processor_id, event_type, input_name, detected_at)
      VALUES (
        ${randomUUID()}, ${''}, 'startup', ${watcherName}, ${now}
      )
    `)
    logger.info(`[ATLAS-${watcherName.toUpperCase()}] startup row written (pid=${process.pid})`)
  } catch (err) {
    logger.warn(`[ATLAS-${watcherName.toUpperCase()}] failed to write startup row: ${(err as Error).message}`)
  }
}
