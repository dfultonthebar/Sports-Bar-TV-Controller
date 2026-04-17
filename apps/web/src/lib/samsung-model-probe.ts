import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

export type SamsungProbeResult = {
  modelName: string | null
  powerState: 'on' | 'standby' | null
  reachable: boolean
}

/**
 * Probe a Samsung TV via its REST API (port 8001) for real model + power state.
 *
 * Why this matters:
 *   - `modelName` gives us the true hardware identity (e.g. "UN55DU7200DXZA")
 *     so we can stop showing bogus strings like "LG WebOS" in the UI.
 *   - `PowerState` is the authoritative signal for bulk-power: "on" = screen
 *     lit, "standby" = screen off but NIC alive, unreachable = fully off.
 *
 * Cave­at: a previous fix claimed this endpoint lies about PowerState on
 * some models. Empirically, 2024 Samsung DU7200 units report "standby"
 * accurately. Older models may behave differently — fall back to REST
 * unreachable = off if PowerState is missing.
 */
export async function probeSamsungTV(ipAddress: string, timeoutMs = 2500): Promise<SamsungProbeResult> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const resp = await fetch(`http://${ipAddress}:8001/api/v2/`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!resp.ok) {
      return { modelName: null, powerState: null, reachable: false }
    }
    const data: any = await resp.json()
    const modelName: string | null = data?.device?.modelName ?? null
    const rawPs: string | undefined = data?.device?.PowerState
    const powerState =
      rawPs === 'on' ? 'on' : rawPs === 'standby' ? 'standby' : null
    return { modelName, powerState, reachable: true }
  } catch {
    return { modelName: null, powerState: null, reachable: false }
  }
}

/**
 * Probe every Samsung TV in the DB and update `NetworkTVDevice.model` with
 * the live modelName whenever it changes. Safe to run in parallel — each
 * TV is independent. Unreachable TVs are skipped (model stays whatever it
 * was; we don't clear it because that would lose info when a TV is off).
 */
export async function refreshSamsungModelCatalog(): Promise<{
  probed: number
  updated: number
  unreachable: number
}> {
  const tvs = await db
    .select({
      id: schema.networkTVDevices.id,
      name: schema.networkTVDevices.name,
      ipAddress: schema.networkTVDevices.ipAddress,
      model: schema.networkTVDevices.model,
    })
    .from(schema.networkTVDevices)
    .where(eq(schema.networkTVDevices.brand, 'samsung'))
    .all()

  let updated = 0
  let unreachable = 0

  await Promise.all(
    tvs.map(async (tv) => {
      const result = await probeSamsungTV(tv.ipAddress)
      if (!result.reachable) {
        unreachable++
        return
      }
      if (result.modelName && result.modelName !== tv.model) {
        try {
          await db
            .update(schema.networkTVDevices)
            .set({
              model: result.modelName,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.networkTVDevices.id, tv.id))
          logger.info(
            `[SAMSUNG PROBE] ${tv.name} (${tv.ipAddress}): model "${tv.model ?? 'null'}" → "${result.modelName}"`
          )
          updated++
        } catch (err: any) {
          logger.warn(`[SAMSUNG PROBE] Failed to update model for ${tv.ipAddress}: ${err?.message ?? err}`)
        }
      }
    })
  )

  return { probed: tvs.length, updated, unreachable }
}
