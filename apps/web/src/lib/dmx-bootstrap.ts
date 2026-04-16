/**
 * DMX Bootstrap Helper
 * Ensures ArtNet/USB adapters from the database are registered
 * with the DMX connection manager before scene recall.
 */

import { db } from '@/db'
import { schema } from '@/db'
import { dmxConnectionManager } from '@sports-bar/dmx'
import type { ArtNetConfig } from '@sports-bar/dmx'
import { logger } from '@sports-bar/logger'

let bootstrapped = false

/**
 * Ensure all DMX controllers from the database are registered
 * with the connection manager. Idempotent — safe to call multiple times.
 */
export async function ensureDMXControllersRegistered(): Promise<void> {
  if (bootstrapped) return

  try {
    const controllers = await db.select()
      .from(schema.dmxControllers)
      .all()

    for (const controller of controllers) {
      // Skip if already registered
      if (dmxConnectionManager.getAdapter(controller.id)) continue

      if (controller.controllerType === 'artnet' && controller.ipAddress) {
        const config: ArtNetConfig = {
          ipAddress: controller.ipAddress,
          port: controller.artnetPort ?? 6454,
          universe: controller.universeStart ?? 0,
          subnet: controller.artnetSubnet ?? 0,
          net: controller.artnetNet ?? 0,
        }

        await dmxConnectionManager.registerArtNetAdapter(
          controller.id,
          controller.name,
          config,
          controller.universeStart ?? 0,
          controller.universeCount ?? 1,
        )

        logger.info('[DMX] Bootstrapped ArtNet controller from DB', {
          id: controller.id,
          name: controller.name,
          ip: controller.ipAddress,
        })
      }
    }

    bootstrapped = true
  } catch (error) {
    logger.error('[DMX] Failed to bootstrap controllers:', error)
  }
}
