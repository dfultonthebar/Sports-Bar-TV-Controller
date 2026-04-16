/**
 * EverPass Devices API - CRUD operations
 * Uses database storage (migrated from JSON file)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, isValidationError } from '@/lib/validation'
import { generateEverPassDeviceId } from '@/lib/everpass-utils'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

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
})

// GET - List all EverPass devices
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const devices = await db.select().from(schema.everpassDevices)

    return NextResponse.json({ devices }, {
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
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, createDeviceSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const deviceData = bodyValidation.data

  try {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const newDevice = {
      id: generateEverPassDeviceId(),
      name: deviceData.name,
      cecDevicePath: deviceData.cecDevicePath,
      inputChannel: deviceData.inputChannel,
      deviceModel: deviceData.deviceModel || null,
      isOnline: false,
      lastSeen: null,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(schema.everpassDevices).values(newDevice)

    logger.info(`[EVERPASS API] Device added: ${newDevice.name} (${newDevice.id})`)
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
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, updateDeviceSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const deviceData = bodyValidation.data

  try {
    const existing = await db.select().from(schema.everpassDevices)
      .where(eq(schema.everpassDevices.id, deviceData.id))
      .get()

    if (!existing) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await db.update(schema.everpassDevices)
      .set({
        name: deviceData.name,
        cecDevicePath: deviceData.cecDevicePath,
        inputChannel: deviceData.inputChannel,
        deviceModel: deviceData.deviceModel || null,
        isOnline: deviceData.isOnline,
        lastSeen: deviceData.lastSeen || null,
        updatedAt: now,
      })
      .where(eq(schema.everpassDevices.id, deviceData.id))

    const updated = await db.select().from(schema.everpassDevices)
      .where(eq(schema.everpassDevices.id, deviceData.id))
      .get()

    logger.info(`[EVERPASS API] Device updated: ${deviceData.name} (${deviceData.id})`)
    return NextResponse.json({ success: true, device: updated })
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
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('id')

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 })
    }

    const existing = await db.select().from(schema.everpassDevices)
      .where(eq(schema.everpassDevices.id, deviceId))
      .get()

    if (!existing) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    await db.delete(schema.everpassDevices)
      .where(eq(schema.everpassDevices.id, deviceId))

    logger.info(`[EVERPASS API] Device removed: ${existing.name} (${deviceId})`)
    return NextResponse.json({ success: true, message: 'Device deleted successfully' })
  } catch (error: any) {
    logger.error('[EVERPASS API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete device', details: error.message },
      { status: 500 }
    )
  }
}
