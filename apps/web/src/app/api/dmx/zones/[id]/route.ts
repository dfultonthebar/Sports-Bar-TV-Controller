import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const updateZoneSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  try {
    const zone = await db.select()
      .from(schema.dmxZones)
      .where(eq(schema.dmxZones.id, id))
      .get()

    if (!zone) {
      return NextResponse.json(
        { success: false, error: 'Zone not found' },
        { status: 404 }
      )
    }

    // Also fetch fixtures in this zone
    const fixtures = await db.select()
      .from(schema.dmxFixtures)
      .where(eq(schema.dmxFixtures.zoneId, id))
      .all()

    return NextResponse.json({
      success: true,
      zone,
      fixtures,
      fixtureCount: fixtures.length,
    })
  } catch (error) {
    logger.error('[DMX] Error fetching zone:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch zone' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  const bodyValidation = await validateRequestBody(request, updateZoneSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const existing = await db.select()
      .from(schema.dmxZones)
      .where(eq(schema.dmxZones.id, id))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Zone not found' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()

    const zone = await db.update(schema.dmxZones)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(schema.dmxZones.id, id))
      .returning()
      .get()

    logger.info('[DMX] Updated zone', { id, name: zone.name })

    return NextResponse.json({ success: true, zone })
  } catch (error) {
    logger.error('[DMX] Error updating zone:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update zone' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  try {
    const existing = await db.select()
      .from(schema.dmxZones)
      .where(eq(schema.dmxZones.id, id))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Zone not found' },
        { status: 404 }
      )
    }

    // Note: Fixtures in this zone will have their zoneId set to null due to onDelete: 'set null'
    await db.delete(schema.dmxZones)
      .where(eq(schema.dmxZones.id, id))
      .run()

    logger.info('[DMX] Deleted zone', { id, name: existing.name })

    return NextResponse.json({ success: true, message: 'Zone deleted' })
  } catch (error) {
    logger.error('[DMX] Error deleting zone:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete zone' },
      { status: 500 }
    )
  }
}
