/**
 * EverPass Devices API - CRUD operations
 * Uses JSON file storage (same pattern as Fire TV devices)
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { withFileLock } from '@/lib/file-lock'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, isValidationError } from '@/lib/validation'
import { EverPassDevice, generateEverPassDeviceId } from '@/lib/everpass-utils'

const DATA_FILE = path.join(process.cwd(), 'data', 'everpass-devices.json')

export const dynamic = 'force-dynamic'

async function readDevices(): Promise<{ devices: EverPassDevice[] }> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    logger.error('[EVERPASS API] Error reading devices file:', error)
    return { devices: [] }
  }
}

/**
 * Safely perform a read-modify-write operation with file lock.
 * This prevents race conditions when multiple processes modify the file.
 */
async function modifyDevices(
  modifier: (data: { devices: EverPassDevice[] }) => { devices: EverPassDevice[] }
): Promise<{ devices: EverPassDevice[] }> {
  return await withFileLock(DATA_FILE, async () => {
    // Read current data inside the lock
    let data: { devices: EverPassDevice[] }
    try {
      const content = await fs.readFile(DATA_FILE, 'utf-8')
      data = JSON.parse(content)
    } catch (error) {
      logger.error('[EVERPASS API] Error reading devices file:', error)
      data = { devices: [] }
    }

    // Apply the modification
    const modified = modifier(data)

    // Write back inside the lock
    await fs.writeFile(DATA_FILE, JSON.stringify(modified, null, 2), 'utf-8')

    return modified
  })
}

// Validation schemas
const createDeviceSchema = z.object({
  name: z.string().min(1).max(100),
  cecDevicePath: z.string().regex(/^\/dev\/tty(ACM|USB)\d+$/, 'Invalid CEC device path'),
  inputChannel: z.number().int().min(1).max(100),
  deviceModel: z.string().optional(),
})

const updateDeviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  cecDevicePath: z.string().regex(/^\/dev\/tty(ACM|USB)\d+$/, 'Invalid CEC device path'),
  inputChannel: z.number().int().min(1).max(100),
  deviceModel: z.string().optional(),
  isOnline: z.boolean().default(false),
  lastSeen: z.string().optional(),
  addedAt: z.string(),
  updatedAt: z.string().optional(),
})

// GET - List all EverPass devices
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    logger.info('[EVERPASS API] GET request - fetching all devices')
    const data = await readDevices()

    logger.info(`[EVERPASS API] Found ${data.devices.length} devices`)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    logger.error('[EVERPASS API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load devices', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Add new EverPass device
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, createDeviceSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const deviceData = bodyValidation.data

  try {
    logger.info('[EVERPASS API] POST request - adding new device')

    const newDevice: EverPassDevice = {
      id: generateEverPassDeviceId(),
      name: deviceData.name,
      cecDevicePath: deviceData.cecDevicePath,
      inputChannel: deviceData.inputChannel,
      deviceModel: deviceData.deviceModel,
      isOnline: false,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Use atomic read-modify-write to prevent race conditions
    await modifyDevices((devicesData) => {
      devicesData.devices.push(newDevice)
      return devicesData
    })

    logger.info(`[EVERPASS API] Device added successfully: ${newDevice.name} (${newDevice.id})`)
    return NextResponse.json({ success: true, device: newDevice })
  } catch (error: any) {
    logger.error('[EVERPASS API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to add device', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update existing EverPass device
export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, updateDeviceSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const deviceData = bodyValidation.data

  try {
    logger.info('[EVERPASS API] PUT request - updating device')

    const updatedDevice: EverPassDevice = {
      id: deviceData.id,
      name: deviceData.name,
      cecDevicePath: deviceData.cecDevicePath,
      inputChannel: deviceData.inputChannel,
      deviceModel: deviceData.deviceModel,
      isOnline: deviceData.isOnline,
      lastSeen: deviceData.lastSeen,
      addedAt: deviceData.addedAt,
      updatedAt: new Date().toISOString(),
    }

    // Use atomic read-modify-write to prevent race conditions
    let deviceFound = false
    await modifyDevices((devicesData) => {
      const deviceIndex = devicesData.devices.findIndex((d) => d.id === updatedDevice.id)
      if (deviceIndex !== -1) {
        devicesData.devices[deviceIndex] = updatedDevice
        deviceFound = true
      }
      return devicesData
    })

    if (!deviceFound) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    logger.info(
      `[EVERPASS API] Device updated successfully: ${updatedDevice.name} (${updatedDevice.id})`
    )
    return NextResponse.json({ success: true, device: updatedDevice })
  } catch (error: any) {
    logger.error('[EVERPASS API] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update device', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove EverPass device
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')

    logger.info(`[EVERPASS API] DELETE request - removing device: ${deviceId}`)

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 })
    }

    // Use atomic read-modify-write to prevent race conditions
    let removedDevice: EverPassDevice | null = null
    await modifyDevices((data) => {
      const deviceIndex = data.devices.findIndex((d) => d.id === deviceId)
      if (deviceIndex !== -1) {
        removedDevice = data.devices[deviceIndex]
        data.devices.splice(deviceIndex, 1)
      }
      return data
    })

    if (!removedDevice) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    logger.info(`[EVERPASS API] Device removed successfully: ${removedDevice.name} (${deviceId})`)
    return NextResponse.json({ success: true, message: 'Device deleted successfully' })
  } catch (error: any) {
    logger.error('[EVERPASS API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete device', details: error.message },
      { status: 500 }
    )
  }
}
