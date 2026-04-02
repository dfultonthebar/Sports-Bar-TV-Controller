
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, isValidationError } from '@/lib/validation'
import {
  loadDirecTVDevices,
  getDirecTVDeviceById,
  saveDirecTVDevice,
  deleteDirecTVDevice,
} from '@/lib/device-db'
import { db, schema } from '@/db'
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
    const data = await loadDirecTVDevices()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    logger.error('Error loading DirecTV devices', { error: error instanceof Error ? error : new Error(String(error)) })
    return NextResponse.json({ error: 'Failed to load DirecTV devices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const newDevice = bodyValidation.data as any

    // Validate required fields
    if (!newDevice.name || !newDevice.ipAddress) {
      return NextResponse.json({ error: 'Name and IP address are required' }, { status: 400 })
    }

    // Add timestamp and ensure device has required fields
    const device = {
      id: newDevice.id || `directv_${Date.now()}`,
      name: newDevice.name,
      ipAddress: newDevice.ipAddress,
      port: newDevice.port || 8080,
      deviceType: newDevice.deviceType || 'DirecTV',
      inputChannel: newDevice.inputChannel ?? null,
      receiverId: newDevice.receiverId ?? null,
      receiverType: newDevice.receiverType || 'Genie HD DVR',
      isOnline: newDevice.isOnline || false,
      addedAt: new Date().toISOString(),
    }

    await saveDirecTVDevice(device)

    return NextResponse.json({ message: 'DirecTV device added successfully', device })
  } catch (error) {
    logger.error('Error adding DirecTV device', { error: error instanceof Error ? error : new Error(String(error)) })
    return NextResponse.json({ error: 'Failed to add DirecTV device' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const updatedDevice = bodyValidation.data as any

    const existing = await getDirecTVDeviceById(updatedDevice.id)
    if (!existing) {
      return NextResponse.json({ error: 'DirecTV device not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await db.update(schema.direcTVDevices)
      .set({
        ...(updatedDevice.name !== undefined && { name: updatedDevice.name }),
        ...(updatedDevice.ipAddress !== undefined && { ipAddress: updatedDevice.ipAddress }),
        ...(updatedDevice.port !== undefined && { port: updatedDevice.port }),
        ...(updatedDevice.deviceType !== undefined && { deviceType: updatedDevice.deviceType }),
        ...(updatedDevice.inputChannel !== undefined && { inputChannel: updatedDevice.inputChannel }),
        ...(updatedDevice.receiverId !== undefined && { receiverId: updatedDevice.receiverId }),
        ...(updatedDevice.receiverType !== undefined && { receiverType: updatedDevice.receiverType }),
        ...(updatedDevice.isOnline !== undefined && { isOnline: updatedDevice.isOnline }),
        updatedAt: now,
      })
      .where(eq(schema.direcTVDevices.id, updatedDevice.id))

    return NextResponse.json({ message: 'DirecTV device updated successfully' })
  } catch (error) {
    logger.error('Error updating DirecTV device', { error: error instanceof Error ? error : new Error(String(error)) })
    return NextResponse.json({ error: 'Failed to update DirecTV device' }, { status: 500 })
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

    const existing = await getDirecTVDeviceById(deviceId)
    if (!existing) {
      return NextResponse.json({ error: 'DirecTV device not found' }, { status: 404 })
    }

    await deleteDirecTVDevice(deviceId)
    return NextResponse.json({ message: 'DirecTV device deleted successfully' })
  } catch (error) {
    logger.error('Error deleting DirecTV device', { error: error instanceof Error ? error : new Error(String(error)) })
    return NextResponse.json({ error: 'Failed to delete DirecTV device' }, { status: 500 })
  }
}
