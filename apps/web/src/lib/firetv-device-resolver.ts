/**
 * Fire TV Device Resolver
 *
 * Maps a scout-reported deviceId + ipAddress to the canonical FireTVDevice
 * row id. Scout's compile-time IP_DEVICE_MAP only knows Stoneyard IPs
 * (10.40.10.x), so Holmgren and other locations heartbeat with deviceId
 * `fire-tv-unknown` (or legacy `amazon-N` / `fire-tv-N`) — the server
 * resolves to the canonical id by matching ipAddress against FireTVDevice
 * before persisting any per-device state.
 *
 * Used by both /api/firestick-scout (heartbeat ingest) and
 * /api/firestick-scout/catalog (catalog ingest) — extracted here so the
 * "unknown deviceId" condition strings and the lookup logic stay in one
 * place. Caches the IP→FireTVDevice map for 60s to avoid hammering the DB
 * with one query per heartbeat per device (3 devices × 30s heartbeat =
 * 6 reads/min before caching).
 */

import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

interface CachedDevice {
  id: string
  name: string
}

let cache: Map<string, CachedDevice> | null = null
let cacheLoadedAt = 0
const CACHE_TTL_MS = 60 * 1000

async function getIpMap(): Promise<Map<string, CachedDevice>> {
  const now = Date.now()
  if (cache && now - cacheLoadedAt < CACHE_TTL_MS) return cache
  const rows = await db.select().from(schema.fireTVDevices).all()
  const map = new Map<string, CachedDevice>()
  for (const r of rows) {
    if (r.ipAddress) map.set(r.ipAddress, { id: r.id, name: r.name })
  }
  cache = map
  cacheLoadedAt = now
  return map
}

const UNKNOWN_DEVICE_ID_PREFIXES = ['fire-tv-unknown', 'amazon-', 'fire-tv-']
function isUnknownDeviceId(deviceId: string): boolean {
  return UNKNOWN_DEVICE_ID_PREFIXES.some((p) => deviceId === p || deviceId.startsWith(p))
}

export interface ResolvedFireTVDevice {
  resolvedDeviceId: string
  resolvedDeviceName?: string
  resolvedFromIp: boolean
}

/**
 * Resolve a scout-reported (deviceId, ipAddress) to the canonical
 * FireTVDevice id. If deviceId is already canonical (looks like
 * `firetv_*_*`), returns it untouched. If it's an "unknown" placeholder
 * AND ipAddress matches a known FireTVDevice row, returns the canonical
 * id+name. Otherwise returns the input deviceId as-is.
 */
export async function resolveCanonicalFireTVDeviceId(
  deviceId: string,
  ipAddress: string | undefined,
  fallbackName?: string
): Promise<ResolvedFireTVDevice> {
  if (!ipAddress || !isUnknownDeviceId(deviceId)) {
    return { resolvedDeviceId: deviceId, resolvedDeviceName: fallbackName, resolvedFromIp: false }
  }
  try {
    const map = await getIpMap()
    const hit = map.get(ipAddress)
    if (hit) {
      if (hit.id !== deviceId) {
        logger.info(`[FIRETV-DEVICE-RESOLVER] ${deviceId} (${ipAddress}) → canonical ${hit.id} (${hit.name})`)
      }
      return { resolvedDeviceId: hit.id, resolvedDeviceName: hit.name, resolvedFromIp: true }
    }
  } catch (err: any) {
    logger.warn(`[FIRETV-DEVICE-RESOLVER] Lookup failed for ${ipAddress}: ${err.message}`)
  }
  return { resolvedDeviceId: deviceId, resolvedDeviceName: fallbackName, resolvedFromIp: false }
}
