
// Fire TV Devices API - CRUD operations (No Prisma, uses JSON file storage)

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { withFileLock } from '@/lib/file-lock'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

const DATA_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')

interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceType: string
  isOnline: boolean
  adbEnabled?: boolean
  addedAt: string
  updatedAt?: string
  inputChannel?: number
  serialNumber?: string
  deviceModel?: string
  softwareVersion?: string
  lastSeen?: string
  keepAwakeEnabled?: boolean
  keepAwakeStart?: string
  keepAwakeEnd?: string
}

async function readDevices(): Promise<{ devices: FireTVDevice[] }> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    logger.error('Error reading devices file:', error)
    return { devices: [] }
  }
}

async function writeDevices(data: { devices: FireTVDevice[] }): Promise<void> {
  try {
    await withFileLock(DATA_FILE, async () => {
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    })
  } catch (error) {
    logger.error('Error writing devices file:', error)
    throw error
  }
}

/**
 * Safely perform a read-modify-write operation with file lock.
 * This prevents race conditions when multiple processes modify the file.
 */
async function modifyDevices(modifier: (data: { devices: FireTVDevice[] }) => { devices: FireTVDevice[] }): Promise<{ devices: FireTVDevice[] }> {
  return await withFileLock(DATA_FILE, async () => {
    // Read current data inside the lock
    let data: { devices: FireTVDevice[] }
    try {
      const content = await fs.readFile(DATA_FILE, 'utf-8')
      data = JSON.parse(content)
    } catch (error) {
      logger.error('Error reading devices file:', error)
      data = { devices: [] }
    }

    // Apply the modification
    const modified = modifier(data)

    // Write back inside the lock
    await fs.writeFile(DATA_FILE, JSON.stringify(modified, null, 2), 'utf-8')

    return modified
  })
}

// GET - List all Fire TV devices
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    logger.info('[FIRETV API] GET request - fetching all devices')
    const data = await readDevices()
    
    logger.info(`[FIRETV API] Found ${data.devices.length} devices`)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error: any) {
    logger.error('[FIRETV API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load devices', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Add new Fire TV device
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data } = bodyValidation


  try {
    logger.info('[FIRETV API] POST request - adding new device')
    const newDevice: FireTVDevice = data as any

    // Set timestamps
    newDevice.addedAt = new Date().toISOString()
    newDevice.updatedAt = new Date().toISOString()

    // Use atomic read-modify-write to prevent race conditions
    await modifyDevices((devicesData) => {
      devicesData.devices.push(newDevice)
      return devicesData
    })

    logger.info(`[FIRETV API] Device added successfully: ${newDevice.name} (${newDevice.id})`)
    return NextResponse.json({ success: true, device: newDevice })
  } catch (error: any) {
    logger.error('[FIRETV API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to add device', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update existing Fire TV device
export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data } = bodyValidation


  try {
    logger.info('[FIRETV API] PUT request - updating device')
    const updatedDevice: FireTVDevice = data as any

    // Update timestamp
    updatedDevice.updatedAt = new Date().toISOString()

    // Use atomic read-modify-write to prevent race conditions
    let deviceFound = false
    await modifyDevices((devicesData) => {
      const deviceIndex = devicesData.devices.findIndex(d => d.id === updatedDevice.id)
      if (deviceIndex !== -1) {
        devicesData.devices[deviceIndex] = updatedDevice
        deviceFound = true
      }
      return devicesData
    })

    if (!deviceFound) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info(`[FIRETV API] Device updated successfully: ${updatedDevice.name} (${updatedDevice.id})`)
    return NextResponse.json({ success: true, device: updatedDevice })
  } catch (error: any) {
    logger.error('[FIRETV API] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update device', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove Fire TV device
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')

    logger.info(`[FIRETV API] DELETE request - removing device: ${deviceId}`)

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID required' },
        { status: 400 }
      )
    }

    // Use atomic read-modify-write to prevent race conditions
    let removedDevice: FireTVDevice | null = null
    await modifyDevices((data) => {
      const deviceIndex = data.devices.findIndex(d => d.id === deviceId)
      if (deviceIndex !== -1) {
        removedDevice = data.devices[deviceIndex]
        data.devices.splice(deviceIndex, 1)
      }
      return data
    })

    if (!removedDevice) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info(`[FIRETV API] Device removed successfully: ${removedDevice.name} (${deviceId})`)
    return NextResponse.json({ success: true, message: 'Device deleted successfully' })
  } catch (error: any) {
    logger.error('[FIRETV API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete device', details: error.message },
      { status: 500 }
    )
  }
}
