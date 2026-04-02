/**
 * DirecTV Device Loader
 *
 * Centralized loader for DirecTV device configurations.
 * Reads from directv-devices.json and caches results until file changes.
 * Follows the same pattern as wolfpack/chassis-loader.ts.
 *
 * All code needing DirecTV device info should import from here
 * instead of reading the JSON file directly.
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { logger } from '@sports-bar/logger'

const DATA_FILE = join(process.cwd(), 'data', 'directv-devices.json')

export interface DirecTVDeviceConfig {
  id: string
  name: string
  ipAddress: string
  port: number
  receiverType: string
  inputChannel?: number
  isOnline: boolean
  addedAt?: string
  updatedAt?: string
}

let cachedDevices: DirecTVDeviceConfig[] | null = null
let cachedMtime: number = 0

/**
 * Load all DirecTV device configs from the JSON driver file.
 * Caches results until the file is modified.
 */
export function loadDirecTVDevices(): DirecTVDeviceConfig[] {
  try {
    if (!existsSync(DATA_FILE)) {
      logger.debug('[DIRECTV-LOADER] No directv-devices.json found, returning empty list')
      return []
    }

    const stat = statSync(DATA_FILE)
    const mtime = stat.mtimeMs

    if (cachedDevices && mtime === cachedMtime) {
      return cachedDevices
    }

    const raw = readFileSync(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    cachedDevices = parsed.devices || []
    cachedMtime = mtime

    logger.debug(`[DIRECTV-LOADER] Loaded ${cachedDevices!.length} DirecTV devices from JSON`)
    return cachedDevices!
  } catch (error) {
    logger.error('[DIRECTV-LOADER] Failed to load directv-devices.json', {
      error: error instanceof Error ? error : new Error(String(error))
    })
    return []
  }
}

/**
 * Get a specific DirecTV device by ID, or the first online device.
 */
export function getDirecTVDeviceFromConfig(deviceId?: string): DirecTVDeviceConfig | null {
  const devices = loadDirecTVDevices()

  if (deviceId) {
    return devices.find(d => d.id === deviceId) || null
  }

  // Return first online device
  return devices.find(d => d.isOnline) || null
}

/**
 * Get all DirecTV devices.
 */
export function getAllDirecTVDevices(): DirecTVDeviceConfig[] {
  return loadDirecTVDevices()
}
