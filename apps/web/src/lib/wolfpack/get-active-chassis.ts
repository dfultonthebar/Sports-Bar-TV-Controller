/**
 * Active Chassis Config Resolver
 *
 * Replaces inline `WHERE isActive = true` queries across 16+ API routes
 * with a single helper that supports optional chassisId lookup.
 *
 * Backward compatible: omitting chassisId falls back to the primary active config.
 */

import { db, schema, eq } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

type MatrixConfigRow = typeof schema.matrixConfigurations.$inferSelect

/**
 * Get the active matrix configuration for a given chassis.
 *
 * @param chassisId - Optional chassis ID from wolfpack-devices.json.
 *   If provided, looks up the DB row linked to that chassis.
 *   If omitted, falls back to the primary active config (WHERE isActive = true).
 */
export async function getActiveChassisConfig(
  chassisId?: string | null
): Promise<MatrixConfigRow | undefined> {
  try {
    if (chassisId) {
      const config = await db.select()
        .from(schema.matrixConfigurations)
        .where(eq(schema.matrixConfigurations.chassisId, chassisId))
        .limit(1)
        .get()

      if (config) return config

      logger.warn(`[WOLFPACK-CHASSIS] No DB config found for chassisId="${chassisId}", falling back to active`)
    }

    // Backward compatible: primary active config
    return await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()
  } catch (error) {
    logger.error('[WOLFPACK-CHASSIS] Error resolving active config:', { error })
    return undefined
  }
}
