import { db, schema } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

// Device types that are EXPECTED to report offline when their TV/display is
// powered down — this is normal overnight/idle behavior, NOT a dead screen.
// Never exclude these from scheduling. (CLAUDE.md: the Atmosphere TV at .48 and
// the Epson projector both go offline when the TV is off; firetv-health-monitor
// already special-cases exactly these.)
const EXPECTED_POWERED_DOWN = /atmosphere|epson|projector/i

// A Fire TV's ADB connection can lag up to ~20 min before the connection
// manager flips it offline, and health ticks are periodic. Only exclude a
// device whose last successful contact is older than this grace window, so a
// transient blip between ticks doesn't bounce a live device out of scheduling.
const STALE_GRACE_MS = 10 * 60 * 1000

/**
 * Returns the set of device IDs that are genuinely offline and should therefore
 * be excluded from game assignment, so a game never lands on a dead screen
 * (Wave 3.5 — health-aware assignment).
 *
 * v1 scope is **Fire TV only**. Cable boxes and DirecTV receivers carry an
 * `isOnline` column but it is operator-set, NOT actively monitored, so excluding
 * on it would wrongly drop working boxes. They are intentionally left in the
 * candidate set until a real reachability probe persists their status.
 *
 * Fails OPEN: any query error returns an empty set (assign as before) rather
 * than excluding everything and starving the schedule.
 */
export async function getOfflineDeviceIds(): Promise<Set<string>> {
  const offline = new Set<string>()
  try {
    const fireTvs = (await db.select().from(schema.fireTVDevices)) as any[]
    const now = Date.now()
    for (const d of fireTvs) {
      if (d.isOnline) continue                                  // online → keep
      if (d.disabled) continue                                  // already not scheduled
      if (EXPECTED_POWERED_DOWN.test(d.deviceType || '')) continue  // off-when-TV-off is normal
      const last = d.lastSeen ? new Date(d.lastSeen).getTime() : 0
      if (last && now - last < STALE_GRACE_MS) continue         // seen recently → blip, keep
      offline.add(d.id)
    }
  } catch (err) {
    logger.warn('[DEVICE_HEALTH] getOfflineDeviceIds failed; failing open (no exclusions)', err as any)
    return new Set<string>()
  }
  if (offline.size > 0) {
    logger.info(`[DEVICE_HEALTH] ${offline.size} Fire TV device(s) excluded from scheduling (genuinely offline)`)
  }
  return offline
}
