import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * TV Discovery Devices List API
 *
 * Returns all discovered NetworkTVDevice records from database,
 * joined with matrixOutputs to include Wolf Pack output labels.
 */

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('[TV-DISCOVERY] Fetching all discovered TV devices')

    // Fetch all network TV devices, left join matrixOutputs for output label
    const rows = await db.select({
      device: schema.networkTVDevices,
      outputLabel: schema.matrixOutputs.label,
      outputNumber: schema.matrixOutputs.channelNumber,
    })
      .from(schema.networkTVDevices)
      .leftJoin(schema.matrixOutputs, eq(schema.networkTVDevices.matrixOutputId, schema.matrixOutputs.id))

    // Flatten and sort by IP address numerically
    const devices = rows.map(row => ({
      ...row.device,
      outputLabel: row.outputLabel || null,
      outputNumber: row.outputNumber || null,
    })).sort((a, b) => {
      const aParts = a.ipAddress.split('.').map(Number)
      const bParts = b.ipAddress.split('.').map(Number)
      for (let i = 0; i < 4; i++) {
        if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i]
      }
      return 0
    })

    logger.info(`[TV-DISCOVERY] Found ${devices.length} TV devices`)

    return NextResponse.json({
      success: true,
      count: devices.length,
      devices
    })

  } catch (error: any) {
    logger.error('[TV-DISCOVERY] Failed to fetch devices:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch TV devices' },
      { status: 500 }
    )
  }
}

/**
 * Update a TV device (rename, etc.)
 * Body: { id: string, name?: string }
 */
export async function PATCH(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    id: z.string(),
    name: z.string().max(100).optional(),
    matrixOutputId: z.string().nullable().optional(),
  }))
  if (!bodyValidation.success) return bodyValidation.error

  const { id, name, matrixOutputId } = bodyValidation.data

  try {
    const [updated] = await db.update(schema.networkTVDevices)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(matrixOutputId !== undefined ? { matrixOutputId } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.networkTVDevices.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    logger.info(`[TV-DISCOVERY] Device ${id} updated: name="${name}", matrixOutputId="${matrixOutputId}"`)
    return NextResponse.json({ success: true, device: updated })
  } catch (error: any) {
    logger.error('[TV-DISCOVERY] Failed to update device:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update device' },
      { status: 500 }
    )
  }
}
