/**
 * Wolf Pack Chassis Loader
 *
 * Reads wolfpack-devices.json and returns parsed chassis configurations.
 * Follows the same pattern as firetv-devices.json / directv-devices.json.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { logger } from '@sports-bar/logger'
import type { WolfpackChassisConfig, WolfpackDevicesFile } from '@sports-bar/wolfpack'

const DATA_FILE = join(process.cwd(), 'data', 'wolfpack-devices.json')

let cachedChassis: WolfpackChassisConfig[] | null = null
let cachedMtime: number = 0

/**
 * Load all chassis configs from the JSON driver file.
 * Caches results until the file is modified.
 */
export function loadChassis(): WolfpackChassisConfig[] {
  try {
    if (!existsSync(DATA_FILE)) {
      logger.debug('[WOLFPACK-CHASSIS] No wolfpack-devices.json found, returning empty list')
      return []
    }

    const stat = require('fs').statSync(DATA_FILE)
    const mtime = stat.mtimeMs

    if (cachedChassis && mtime === cachedMtime) {
      return cachedChassis
    }

    const raw = readFileSync(DATA_FILE, 'utf-8')
    const data: WolfpackDevicesFile = JSON.parse(raw)

    if (!data.chassis || !Array.isArray(data.chassis)) {
      logger.warn('[WOLFPACK-CHASSIS] Invalid wolfpack-devices.json format, expected { chassis: [] }')
      return []
    }

    cachedChassis = data.chassis
    cachedMtime = mtime

    logger.info(`[WOLFPACK-CHASSIS] Loaded ${data.chassis.length} chassis from wolfpack-devices.json`)
    return data.chassis
  } catch (error) {
    logger.error('[WOLFPACK-CHASSIS] Error loading wolfpack-devices.json:', { error })
    return []
  }
}

/**
 * Get a specific chassis config by ID.
 */
export function getChassisById(chassisId: string): WolfpackChassisConfig | undefined {
  const chassis = loadChassis()
  return chassis.find(c => c.id === chassisId)
}

/**
 * Get the primary chassis (isPrimary: true).
 * Returns undefined if no chassis is configured or none is marked primary.
 */
export function getPrimaryChassis(): WolfpackChassisConfig | undefined {
  const chassis = loadChassis()
  return chassis.find(c => c.isPrimary)
}

/**
 * Invalidate the cache (e.g., after writing new data to the file).
 */
export function invalidateChassisCache(): void {
  cachedChassis = null
  cachedMtime = 0
}
