import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateQueryParams, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const url = new URL(request.url)
    const deviceId = url.searchParams.get('deviceId')
    const deviceType = url.searchParams.get('deviceType')

    const conditions = []
    if (deviceId) conditions.push(eq(schema.deviceSubscriptions.deviceId, deviceId))
    if (deviceType) conditions.push(eq(schema.deviceSubscriptions.deviceType, deviceType))

    const rows = conditions.length > 0
      ? await db.select().from(schema.deviceSubscriptions).where(and(...conditions))
      : await db.select().from(schema.deviceSubscriptions)

    // Parse JSON subscriptions for each row
    const devices = rows.map(row => ({
      deviceId: row.deviceId,
      deviceType: row.deviceType,
      deviceName: row.deviceName,
      subscriptions: JSON.parse(row.subscriptions || '[]'),
      lastPolled: row.lastPolled,
      pollStatus: row.pollStatus,
      error: row.error,
    }))

    return NextResponse.json({ success: true, devices })
  } catch (error) {
    logger.error('Error loading subscription data:', error)
    return NextResponse.json({ success: true, devices: [] as any[] })
  }
}
