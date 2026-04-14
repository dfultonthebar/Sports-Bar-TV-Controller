import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

/**
 * Persist a refreshed Samsung auth token back to NetworkTVDevice.
 *
 * Samsung TVs hand out a new token on the first websocket connection if the
 * caller didn't present one, or refresh the token on reconnect. The token is
 * stored on `client.config.authToken` inside the client instance — call this
 * helper from the finally block of any control route that instantiates a
 * SamsungTVClient so the new token reaches the database, which prevents the
 * TV from re-prompting pairing on every subsequent command.
 *
 * No-op if the device isn't a Samsung, if no token was obtained, or if the
 * token matches what's already in the DB. DB write errors are logged and
 * swallowed — a failed token save must never fail the caller's command.
 */
export async function persistSamsungTokenIfChanged(
  device: { id: string; brand: string | null; authToken: string | null; ipAddress: string },
  client: { getConfig(): { authToken?: string } }
): Promise<void> {
  if (device.brand?.toLowerCase() !== 'samsung') return
  const newToken = client.getConfig().authToken
  if (!newToken || newToken === device.authToken) return
  try {
    await db.update(schema.networkTVDevices)
      .set({ authToken: newToken, updatedAt: new Date().toISOString() })
      .where(eq(schema.networkTVDevices.id, device.id))
    logger.info(`[TV-CONTROL] Persisted refreshed Samsung token for ${device.ipAddress}`)
  } catch (err: any) {
    logger.warn(`[TV-CONTROL] Failed to persist Samsung token for ${device.ipAddress}: ${err?.message ?? err}`)
  }
}
