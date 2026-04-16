/**
 * Device Database Helpers
 *
 * Single source of truth for DirecTV and Fire TV device data.
 * All routes should use these functions instead of reading JSON files.
 *
 * Database tables: DirecTVDevice, FireTVDevice (in packages/database/src/schema.ts)
 */

import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// ============================================================
// DirecTV Devices
// ============================================================

export interface DirecTVDeviceRecord {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceType: string
  inputChannel: number | null
  receiverId: string | null
  receiverType: string | null
  isOnline: boolean
  addedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Load all DirecTV devices from the database.
 * Returns { devices: [...] } to match the legacy JSON format.
 */
export async function loadDirecTVDevices(): Promise<{ devices: DirecTVDeviceRecord[] }> {
  try {
    const devices = await db.select().from(schema.direcTVDevices).all()
    return { devices }
  } catch (error) {
    logger.error('[DEVICE-DB] Error loading DirecTV devices:', error)
    return { devices: [] }
  }
}

/**
 * Load a single DirecTV device by ID.
 */
export async function getDirecTVDeviceById(deviceId: string): Promise<DirecTVDeviceRecord | null> {
  try {
    const device = await db.select()
      .from(schema.direcTVDevices)
      .where(eq(schema.direcTVDevices.id, deviceId))
      .get()
    return device ?? null
  } catch (error) {
    logger.error(`[DEVICE-DB] Error loading DirecTV device ${deviceId}:`, error)
    return null
  }
}

/**
 * Find a DirecTV device by IP address.
 */
export async function getDirecTVDeviceByIp(ipAddress: string): Promise<DirecTVDeviceRecord | null> {
  try {
    const device = await db.select()
      .from(schema.direcTVDevices)
      .where(eq(schema.direcTVDevices.ipAddress, ipAddress))
      .get()
    return device ?? null
  } catch (error) {
    logger.error(`[DEVICE-DB] Error loading DirecTV device by IP ${ipAddress}:`, error)
    return null
  }
}

/**
 * Find a DirecTV device by name (label).
 */
export async function getDirecTVDeviceByName(name: string): Promise<DirecTVDeviceRecord | null> {
  try {
    const device = await db.select()
      .from(schema.direcTVDevices)
      .where(eq(schema.direcTVDevices.name, name))
      .get()
    return device ?? null
  } catch (error) {
    logger.error(`[DEVICE-DB] Error loading DirecTV device by name ${name}:`, error)
    return null
  }
}

/**
 * Save (upsert) a DirecTV device. Uses id as the conflict key.
 */
export async function saveDirecTVDevice(device: Partial<DirecTVDeviceRecord> & { id: string }): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.insert(schema.direcTVDevices)
      .values({
        ...device,
        port: device.port ?? 8080,
        deviceType: device.deviceType ?? 'DirecTV',
        isOnline: device.isOnline ?? false,
        name: device.name ?? 'Unknown',
        ipAddress: device.ipAddress ?? '',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.direcTVDevices.id,
        set: {
          ...(device.name !== undefined && { name: device.name }),
          ...(device.ipAddress !== undefined && { ipAddress: device.ipAddress }),
          ...(device.port !== undefined && { port: device.port }),
          ...(device.deviceType !== undefined && { deviceType: device.deviceType }),
          ...(device.inputChannel !== undefined && { inputChannel: device.inputChannel }),
          ...(device.receiverId !== undefined && { receiverId: device.receiverId }),
          ...(device.receiverType !== undefined && { receiverType: device.receiverType }),
          ...(device.isOnline !== undefined && { isOnline: device.isOnline }),
          updatedAt: now,
        }
      })
  } catch (error) {
    logger.error(`[DEVICE-DB] Error saving DirecTV device ${device.id}:`, error)
    throw error
  }
}

/**
 * Save all DirecTV devices (replaces entire set).
 */
export async function saveDirecTVDevices(devices: DirecTVDeviceRecord[]): Promise<void> {
  const now = new Date().toISOString()
  for (const device of devices) {
    await saveDirecTVDevice({ ...device, updatedAt: now })
  }
}

/**
 * Delete a DirecTV device by ID.
 */
export async function deleteDirecTVDevice(deviceId: string): Promise<boolean> {
  try {
    const result = await db.delete(schema.direcTVDevices)
      .where(eq(schema.direcTVDevices.id, deviceId))
    return true
  } catch (error) {
    logger.error(`[DEVICE-DB] Error deleting DirecTV device ${deviceId}:`, error)
    return false
  }
}

// ============================================================
// Fire TV Devices
// ============================================================

export interface FireTVDeviceRecord {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceType: string
  inputChannel: number | null
  isOnline: boolean
  disabled: boolean
  adbEnabled: boolean | null
  serialNumber: string | null
  deviceModel: string | null
  softwareVersion: string | null
  model: string | null
  keepAwakeEnabled: boolean | null
  keepAwakeStart: string | null
  keepAwakeEnd: string | null
  lastSeen: string | null
  addedAt: string | null
  updatedAt: string
}

/**
 * Load all Fire TV devices from the database.
 * Returns { devices: [...] } to match the legacy JSON format.
 */
export async function loadFireTVDevices(): Promise<{ devices: FireTVDeviceRecord[] }> {
  try {
    const devices = await db.select().from(schema.fireTVDevices).all()
    return { devices }
  } catch (error) {
    logger.error('[DEVICE-DB] Error loading Fire TV devices:', error)
    return { devices: [] }
  }
}

/**
 * Load a single Fire TV device by ID.
 */
export async function getFireTVDeviceById(deviceId: string): Promise<FireTVDeviceRecord | null> {
  try {
    const device = await db.select()
      .from(schema.fireTVDevices)
      .where(eq(schema.fireTVDevices.id, deviceId))
      .get()
    return device ?? null
  } catch (error) {
    logger.error(`[DEVICE-DB] Error loading Fire TV device ${deviceId}:`, error)
    return null
  }
}

/**
 * Save (upsert) a Fire TV device. Uses id as the conflict key.
 */
export async function saveFireTVDevice(device: Partial<FireTVDeviceRecord> & { id: string }): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.insert(schema.fireTVDevices)
      .values({
        ...device,
        port: device.port ?? 5555,
        deviceType: device.deviceType ?? 'Fire TV Cube',
        isOnline: device.isOnline ?? false,
        disabled: device.disabled ?? false,
        name: device.name ?? 'Unknown',
        ipAddress: device.ipAddress ?? '',
        status: device.isOnline ? 'online' : 'offline',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.fireTVDevices.id,
        set: {
          ...(device.name !== undefined && { name: device.name }),
          ...(device.ipAddress !== undefined && { ipAddress: device.ipAddress }),
          ...(device.port !== undefined && { port: device.port }),
          ...(device.deviceType !== undefined && { deviceType: device.deviceType }),
          ...(device.inputChannel !== undefined && { inputChannel: device.inputChannel }),
          ...(device.isOnline !== undefined && { isOnline: device.isOnline }),
          ...(device.disabled !== undefined && { disabled: device.disabled }),
          ...(device.adbEnabled !== undefined && { adbEnabled: device.adbEnabled }),
          ...(device.lastSeen !== undefined && { lastSeen: device.lastSeen }),
          ...(device.model !== undefined && { model: device.model }),
          ...(device.keepAwakeEnabled !== undefined && { keepAwakeEnabled: device.keepAwakeEnabled }),
          ...(device.keepAwakeStart !== undefined && { keepAwakeStart: device.keepAwakeStart }),
          ...(device.keepAwakeEnd !== undefined && { keepAwakeEnd: device.keepAwakeEnd }),
          ...(device.isOnline !== undefined && { status: device.isOnline ? 'online' : 'offline' }),
          updatedAt: now,
        }
      })
  } catch (error) {
    logger.error(`[DEVICE-DB] Error saving Fire TV device ${device.id}:`, error)
    throw error
  }
}

/**
 * Update a Fire TV device's online status.
 */
export async function updateFireTVDeviceStatus(deviceId: string, isOnline: boolean): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.update(schema.fireTVDevices)
      .set({
        isOnline,
        status: isOnline ? 'online' : 'offline',
        lastSeen: now,
        updatedAt: now,
      })
      .where(eq(schema.fireTVDevices.id, deviceId))
  } catch (error) {
    logger.error(`[DEVICE-DB] Error updating Fire TV device status ${deviceId}:`, error)
  }
}

/**
 * Delete a Fire TV device by ID.
 */
export async function deleteFireTVDevice(deviceId: string): Promise<boolean> {
  try {
    await db.delete(schema.fireTVDevices)
      .where(eq(schema.fireTVDevices.id, deviceId))
    return true
  } catch (error) {
    logger.error(`[DEVICE-DB] Error deleting Fire TV device ${deviceId}:`, error)
    return false
  }
}
