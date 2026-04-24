/**
 * DirecTV PPV/Event Channel Probe
 *
 * Polls each DirecTV box's `/tv/getTuned` endpoint and records any tuned
 * channel that looks like a PPV / event channel (callsign='PPV' or in the
 * traditional PPV major-channel band 100-199 with a non-empty title).
 *
 * Why this exists: ESPN's MMA scheduleboard does not include reliable
 * PPV broadcast info — UFC PPV events sync into game_schedules without a
 * channel number. Without something like this, the AI Suggest tab has no
 * way to know that "UFC 311" is on channel 125 tonight; the channel only
 * lives inside the DirecTV box's program guide. By scraping which channel
 * a manager already tuned a box to, we get a recently-seen PPV-channel
 * list that operators can pin to scheduled events.
 *
 * Wired into scheduler-service.ts as a 10-minute background task.
 */

import { db, schema, eq, and } from '@sports-bar/database'
import { SHEFClient } from '@sports-bar/directv'
import { logger } from '@sports-bar/logger'

export interface ProbeResult {
  devicesProbed: number
  ppvChannelsObserved: number
  newRows: number
  updatedRows: number
  errors: Array<{ deviceId: string; ip: string; error: string }>
}

/**
 * Decide whether a getTuned response looks like a PPV / event channel
 * worth recording. Two signals:
 *
 *   1. callsign === 'PPV' — DirecTV's explicit PPV marker, most reliable.
 *   2. major in [100..199] AND a non-empty title — the traditional PPV
 *      band; falls in the iN Demand range for boxing/UFC. Empty title
 *      filters out idle channels and the box's own status overlays.
 *
 * Anything not matching is plain linear TV and not worth tracking.
 */
function isPpvLikeChannel(tuned: {
  callsign?: string | null
  major: number
  title?: string | null
}): boolean {
  if (tuned.callsign && tuned.callsign.toUpperCase() === 'PPV') return true
  if (
    tuned.major >= 100 &&
    tuned.major <= 199 &&
    typeof tuned.title === 'string' &&
    tuned.title.trim().length > 0
  ) {
    return true
  }
  return false
}

/**
 * Upsert a discovered PPV-channel observation. Increments seenCount and
 * bumps lastSeenAt on a duplicate (same device + major). Drizzle on
 * SQLite doesn't expose an `onConflictDoUpdate` chain that's universally
 * available across our drizzle version pin, so we do explicit SELECT +
 * UPDATE/INSERT.
 */
async function upsertObservation(
  directvDeviceId: string,
  channelMajor: number,
  channelMinor: number | null,
  callsign: string | null,
  title: string | null,
  nowUnix: number,
): Promise<'inserted' | 'updated'> {
  const existing = await db
    .select()
    .from(schema.discoveredPpvChannels)
    .where(
      and(
        eq(schema.discoveredPpvChannels.directvDeviceId, directvDeviceId),
        eq(schema.discoveredPpvChannels.channelMajor, channelMajor),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    const row = existing[0]
    await db
      .update(schema.discoveredPpvChannels)
      .set({
        channelMinor,
        callsign: callsign ?? row.callsign,
        title: title ?? row.title,
        lastSeenAt: nowUnix,
        seenCount: (row.seenCount ?? 1) + 1,
      })
      .where(eq(schema.discoveredPpvChannels.id, row.id))
    return 'updated'
  }

  await db.insert(schema.discoveredPpvChannels).values({
    id: crypto.randomUUID(),
    directvDeviceId,
    channelMajor,
    channelMinor,
    callsign,
    title,
    firstSeenAt: nowUnix,
    lastSeenAt: nowUnix,
    seenCount: 1,
  })
  return 'inserted'
}

/**
 * Probe every active DirecTV box for what it's currently tuned to and
 * upsert any PPV-like channel into discovered_ppv_channels.
 *
 * Returns a structured result so the on-demand POST endpoint can hand
 * it back to the operator for verification. Errors per-box are caught
 * and reported, never thrown — one offline box should not abort the
 * whole sweep.
 */
export async function probeAllDirecTVTuned(): Promise<ProbeResult> {
  const result: ProbeResult = {
    devicesProbed: 0,
    ppvChannelsObserved: 0,
    newRows: 0,
    updatedRows: 0,
    errors: [],
  }

  const devices = await db.select().from(schema.direcTVDevices)
  if (devices.length === 0) {
    logger.debug('[DTV-PROBE] No DirecTV devices configured; skipping probe')
    return result
  }

  const nowUnix = Math.floor(Date.now() / 1000)

  for (const device of devices) {
    result.devicesProbed++
    try {
      const client = new SHEFClient(device.ipAddress, device.port ?? 8080)
      const tuned = await client.getTuned()

      if (!tuned || typeof tuned.major !== 'number') {
        // SHEF disabled or weird response — silent skip, not an error.
        continue
      }

      if (!isPpvLikeChannel(tuned)) continue

      result.ppvChannelsObserved++
      const action = await upsertObservation(
        device.id,
        tuned.major,
        tuned.minor ?? null,
        tuned.callsign ?? null,
        tuned.title ?? null,
        nowUnix,
      )
      if (action === 'inserted') result.newRows++
      else result.updatedRows++

      logger.info(
        `[DTV-PROBE] ${device.name || device.ipAddress} on ch ${tuned.major}` +
          ` callsign=${tuned.callsign} title="${tuned.title}" (${action})`,
      )
    } catch (error: any) {
      // Common cases: box offline (ECONNREFUSED), SHEF disabled (HTTP 403),
      // network timeout. Log at debug to avoid noise — an iTach/DirecTV
      // box being briefly unreachable is normal during reboots.
      const msg = error?.message || String(error)
      logger.debug(
        `[DTV-PROBE] Probe failed for ${device.name || device.ipAddress}: ${msg}`,
      )
      result.errors.push({
        deviceId: device.id,
        ip: device.ipAddress,
        error: msg,
      })
    }
  }

  if (result.ppvChannelsObserved > 0 || result.errors.length > 0) {
    logger.info(
      `[DTV-PROBE] Sweep complete: probed=${result.devicesProbed},` +
        ` ppvSeen=${result.ppvChannelsObserved} (new=${result.newRows},` +
        ` updated=${result.updatedRows}), errors=${result.errors.length}`,
    )
  } else {
    logger.debug(
      `[DTV-PROBE] Sweep complete: probed=${result.devicesProbed}, no PPV channels observed`,
    )
  }

  return result
}
