
// Fire TV Devices API - CRUD operations (Database-backed, single source of truth)

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, isValidationError } from '@/lib/validation'
import {
  loadFireTVDevices,
  getFireTVDeviceById,
  saveFireTVDevice,
  deleteFireTVDevice,
} from '@/lib/device-db'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

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
    const data = await loadFireTVDevices()

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
    const newDevice = data as any

    const now = new Date().toISOString()
    const device = {
      id: newDevice.id || `firetv_${Date.now()}`,
      name: newDevice.name,
      ipAddress: newDevice.ipAddress,
      port: newDevice.port || 5555,
      deviceType: newDevice.deviceType || 'Fire TV Cube',
      inputChannel: newDevice.inputChannel ?? null,
      isOnline: newDevice.isOnline || false,
      disabled: newDevice.disabled || false,
      adbEnabled: newDevice.adbEnabled ?? null,
      model: newDevice.model ?? null,
      addedAt: now,
      updatedAt: now,
    }

    await saveFireTVDevice(device)

    logger.info(`[FIRETV API] Device added successfully: ${device.name} (${device.id})`)
    return NextResponse.json({ success: true, device })
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
    const updatedDevice = data as any

    const existing = await getFireTVDeviceById(updatedDevice.id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    await db.update(schema.fireTVDevices)
      .set({
        ...(updatedDevice.name !== undefined && { name: updatedDevice.name }),
        ...(updatedDevice.ipAddress !== undefined && { ipAddress: updatedDevice.ipAddress }),
        ...(updatedDevice.port !== undefined && { port: updatedDevice.port }),
        ...(updatedDevice.deviceType !== undefined && { deviceType: updatedDevice.deviceType }),
        ...(updatedDevice.inputChannel !== undefined && { inputChannel: updatedDevice.inputChannel }),
        ...(updatedDevice.isOnline !== undefined && { isOnline: updatedDevice.isOnline }),
        ...(updatedDevice.isOnline !== undefined && { status: updatedDevice.isOnline ? 'online' : 'offline' }),
        ...(updatedDevice.disabled !== undefined && { disabled: updatedDevice.disabled }),
        ...(updatedDevice.adbEnabled !== undefined && { adbEnabled: updatedDevice.adbEnabled }),
        ...(updatedDevice.lastSeen !== undefined && { lastSeen: updatedDevice.lastSeen }),
        ...(updatedDevice.model !== undefined && { model: updatedDevice.model }),
        ...(updatedDevice.keepAwakeEnabled !== undefined && { keepAwakeEnabled: updatedDevice.keepAwakeEnabled }),
        ...(updatedDevice.keepAwakeStart !== undefined && { keepAwakeStart: updatedDevice.keepAwakeStart }),
        ...(updatedDevice.keepAwakeEnd !== undefined && { keepAwakeEnd: updatedDevice.keepAwakeEnd }),
        ...(updatedDevice.serialNumber !== undefined && { serialNumber: updatedDevice.serialNumber }),
        ...(updatedDevice.deviceModel !== undefined && { deviceModel: updatedDevice.deviceModel }),
        ...(updatedDevice.softwareVersion !== undefined && { softwareVersion: updatedDevice.softwareVersion }),
        updatedAt: now,
      })
      .where(eq(schema.fireTVDevices.id, updatedDevice.id))

    logger.info(`[FIRETV API] Device updated successfully: ${updatedDevice.name || existing.name} (${updatedDevice.id})`)
    return NextResponse.json({ success: true, device: { ...existing, ...updatedDevice, updatedAt: now } })
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

    const existing = await getFireTVDeviceById(deviceId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    await deleteFireTVDevice(deviceId)

    logger.info(`[FIRETV API] Device removed successfully: ${existing.name} (${deviceId})`)
    return NextResponse.json({ success: true, message: 'Device deleted successfully' })
  } catch (error: any) {
    logger.error('[FIRETV API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete device', details: error.message },
      { status: 500 }
    )
  }
}
