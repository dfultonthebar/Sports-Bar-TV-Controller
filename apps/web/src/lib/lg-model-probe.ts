import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { LGTVClient, TVBrand } from '@sports-bar/tv-network-control'

export type LGProbeResult = {
  modelName: string | null
  serialNumber: string | null
  softwareVersion: string | null
  reachable: boolean
}

/**
 * Probe an LG webOS TV via its SSAP WebSocket (port 3001) for real model
 * metadata. Parallel counterpart to probeSamsungTV() — same shape, same
 * purpose: replace stale "LG WebOS" strings in NetworkTVDevice.model with
 * the actual hardware identifier (e.g. "65UT8000AUA.BUSYLKR") so the UI
 * and catalog show the truth.
 *
 * Requires a paired `clientKey` — LGTVClient.getDeviceInfo() uses the
 * stored key to silently re-authorize. A TV that has never been paired
 * will trigger a PROMPT dialog on the screen and the call will time out.
 * At locations that already use LG power control via the bulk-power and
 * single-TV routes, every LG row will already have a clientKey from its
 * first successful power command.
 */
export async function probeLGTV(
  ipAddress: string,
  port: number,
  clientKey: string | null,
  macAddress: string | null,
  timeoutMs = 6000,
): Promise<LGProbeResult> {
  if (!clientKey) {
    return { modelName: null, serialNumber: null, softwareVersion: null, reachable: false }
  }
  const client = new LGTVClient({
    ipAddress,
    port: port || 3001,
    brand: TVBrand.LG,
    clientKey,
    macAddress: macAddress || undefined,
  })
  try {
    const info = await Promise.race([
      client.getDeviceInfo(),
      new Promise<{}>((_, reject) => setTimeout(() => reject(new Error('probe timeout')), timeoutMs)),
    ]) as { model?: string; serialNumber?: string; softwareVersion?: string }
    const modelName = info.model ?? null
    if (!modelName) {
      return { modelName: null, serialNumber: null, softwareVersion: null, reachable: false }
    }
    return {
      modelName,
      serialNumber: info.serialNumber ?? null,
      softwareVersion: info.softwareVersion ?? null,
      reachable: true,
    }
  } catch {
    return { modelName: null, serialNumber: null, softwareVersion: null, reachable: false }
  }
}

/**
 * Probe every LG TV in the DB and update `NetworkTVDevice.model` whenever
 * the probed value differs from the stored one. Parallel per-TV with a
 * 6-second per-device cap, so 19 TVs fully unreachable still returns in
 * ~6s. Unreachable or unpaired TVs are skipped (model stays whatever it
 * was; never cleared, so we don't lose info when a TV is powered off).
 */
export async function refreshLGModelCatalog(): Promise<{
  probed: number
  updated: number
  unreachable: number
}> {
  const tvs = await db
    .select({
      id: schema.networkTVDevices.id,
      name: schema.networkTVDevices.name,
      ipAddress: schema.networkTVDevices.ipAddress,
      port: schema.networkTVDevices.port,
      clientKey: schema.networkTVDevices.clientKey,
      macAddress: schema.networkTVDevices.macAddress,
      model: schema.networkTVDevices.model,
    })
    .from(schema.networkTVDevices)
    .where(eq(schema.networkTVDevices.brand, 'lg'))
    .all()

  let updated = 0
  let unreachable = 0

  await Promise.all(
    tvs.map(async (tv) => {
      const result = await probeLGTV(tv.ipAddress, tv.port, tv.clientKey, tv.macAddress)
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
            `[LG PROBE] ${tv.name} (${tv.ipAddress}): model "${tv.model ?? 'null'}" → "${result.modelName}"`,
          )
          updated++
        } catch (err: any) {
          logger.warn(`[LG PROBE] Failed to update model for ${tv.ipAddress}: ${err?.message ?? err}`)
        }
      }
    }),
  )

  return { probed: tvs.length, updated, unreachable }
}
