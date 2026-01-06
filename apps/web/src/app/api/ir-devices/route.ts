
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, isValidationError, isValidationSuccess} from '@/lib/validation'
import { db } from '@/db'
import { irDevices } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')

    if (deviceId) {
      // Get specific device
      const device = await db.query.irDevices.findFirst({
        where: eq(irDevices.id, deviceId),
      })

      if (!device) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 })
      }

      // Map matrixInput to inputChannel for frontend compatibility
      const mappedDevice = { ...device, inputChannel: device.matrixInput }
      return NextResponse.json({ devices: [mappedDevice] }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } else {
      // Get all devices
      const devices = await db.query.irDevices.findMany()
      // Map matrixInput to inputChannel for frontend compatibility
      const mappedDevices = devices.map(d => ({ ...d, inputChannel: d.matrixInput }))
      return NextResponse.json({ devices: mappedDevices }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }
  } catch (error) {
    logger.error('Error loading devices:', error)
    return NextResponse.json({ error: 'Failed to load devices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation schema
  const deviceSchema = z.object({
    name: z.string(),
    deviceType: z.string(),
    brand: z.string(),
    model: z.string().optional(),
    matrixInput: z.number().optional(),
    matrixInputLabel: z.string().optional(),
    irCodeSetId: z.string().optional(),
    irCodes: z.string().optional(),
    globalCacheDeviceId: z.string().optional(),
    globalCachePortNumber: z.number().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  })

  const bodyValidation = await validateRequestBody(request, deviceSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data } = bodyValidation

  try {
    const newDevice = data

    const [created] = await db.insert(irDevices).values({
      name: newDevice.name,
      deviceType: newDevice.deviceType,
      brand: newDevice.brand,
      model: newDevice.model,
      matrixInput: newDevice.matrixInput,
      matrixInputLabel: newDevice.matrixInputLabel,
      irCodeSetId: newDevice.irCodeSetId,
      irCodes: newDevice.irCodes,
      globalCacheDeviceId: newDevice.globalCacheDeviceId,
      globalCachePortNumber: newDevice.globalCachePortNumber,
      description: newDevice.description,
      status: newDevice.status || 'active',
    }).returning()

    return NextResponse.json({ message: 'Device added successfully', device: created })
  } catch (error) {
    logger.error('Error adding device:', error)
    return NextResponse.json({ error: 'Failed to add device' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation schema
  const updateSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    deviceType: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    matrixInput: z.number().optional(),
    matrixInputLabel: z.string().optional(),
    irCodeSetId: z.string().optional(),
    irCodes: z.string().optional(),
    globalCacheDeviceId: z.string().optional(),
    globalCachePortNumber: z.number().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  })

  const bodyValidation = await validateRequestBody(request, updateSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data } = bodyValidation

  try {
    const { id, ...updateData } = data

    // Check if device exists
    const existing = await db.query.irDevices.findFirst({
      where: eq(irDevices.id, id),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Update device
    await db
      .update(irDevices)
      .set({
        ...updateData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(irDevices.id, id))

    return NextResponse.json({ message: 'Device updated successfully' })
  } catch (error) {
    logger.error('Error updating device:', error)
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 })
    }

    // Check if device exists
    const existing = await db.query.irDevices.findFirst({
      where: eq(irDevices.id, deviceId),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Delete device
    await db.delete(irDevices).where(eq(irDevices.id, deviceId))

    return NextResponse.json({ message: 'Device deleted successfully' })
  } catch (error) {
    logger.error('Error deleting device:', error)
    return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 })
  }
}
