/**
 * Refresh every Fire TV box's installed-app list — the per-box "preset list"
 * the scheduler's firetv path picks a streamingAppId from. Each Fire TV's app
 * list lives in the DeviceSubscription table (one row per deviceId, apps in the
 * `subscriptions` JSON). Unlike cable/DirecTV channel presets, these are the
 * actual streaming apps installed on the box, scanned over ADB.
 *
 * WHY this exists (v2.83.3): nothing re-polled these automatically, so they
 * went months stale — Holmgren's were last scanned 2026-04-25, and Fire TV 1
 * sat empty (`[]`, pollStatus=error) after a box swap until a manual refresh on
 * 2026-06-28. This helper is wired into instrumentation (initial run after boot,
 * then on an interval) so every box keeps its own Fire TV preset lists current.
 *
 * Failure isolation: a box that's powered off (TV off → ADB unreachable) just
 * marks that one row pollStatus=error and is skipped — it does NOT overwrite the
 * last-known-good `subscriptions`, and it never aborts the other boxes. So a
 * poll at a bad time is harmless: the good list survives until the next success.
 */
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { pollRealFireTVSubscriptions } from '@/lib/real-device-subscriptions'
import { loadFireTVDevices } from '@/lib/device-db'

function nowStamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

export async function refreshAllFireTVSubscriptions(
  reason = 'scheduled',
): Promise<{ scanned: number; ok: number; failed: number }> {
  let devices: any[] = []
  try {
    const loaded = await loadFireTVDevices()
    devices = loaded.devices || []
  } catch (e) {
    logger.warn('[FIRETV-SUBS] device load failed — skipping refresh:', e)
    return { scanned: 0, ok: 0, failed: 0 }
  }

  if (devices.length === 0) return { scanned: 0, ok: 0, failed: 0 }

  let ok = 0
  let failed = 0

  for (const device of devices) {
    const deviceId = String(device.id)
    try {
      // ADB scan of installed apps (same call the /api/device-subscriptions/poll
      // route uses). Throws if the box is unreachable.
      const subscriptions = await pollRealFireTVSubscriptions(device)
      const stamp = nowStamp()
      const existing = await db
        .select()
        .from(schema.deviceSubscriptions)
        .where(eq(schema.deviceSubscriptions.deviceId, deviceId))
        .get()

      // Only success overwrites `subscriptions` — preserves last-good on failure.
      const values = {
        subscriptions: JSON.stringify(subscriptions),
        lastPolled: stamp,
        pollStatus: 'success' as const,
        error: null as string | null,
        updatedAt: stamp,
      }

      if (existing) {
        await db
          .update(schema.deviceSubscriptions)
          .set(values)
          .where(eq(schema.deviceSubscriptions.deviceId, deviceId))
      } else {
        await db.insert(schema.deviceSubscriptions).values({
          deviceId,
          deviceType: 'firetv',
          deviceName: String(device.name ?? deviceId),
          createdAt: stamp,
          ...values,
        })
      }
      ok++
    } catch (e: any) {
      failed++
      // Mark the row errored but leave its last-good subscriptions intact.
      try {
        await db
          .update(schema.deviceSubscriptions)
          .set({ pollStatus: 'error', error: e?.message || 'poll failed', updatedAt: nowStamp() })
          .where(eq(schema.deviceSubscriptions.deviceId, deviceId))
      } catch (_) {
        /* row may not exist yet; ignore */
      }
      logger.debug(`[FIRETV-SUBS] poll failed for ${deviceId}: ${e?.message || e}`)
    }
  }

  logger.info(`[FIRETV-SUBS] refresh (${reason}): ${ok} ok, ${failed} failed of ${devices.length}`)
  return { scanned: devices.length, ok, failed }
}
