import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, asc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { randomUUID } from 'crypto'

const createZoneSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const zones = await db.select()
      .from(schema.dmxZones)
      .orderBy(asc(schema.dmxZones.displayOrder))
      .all()

    // Get fixture counts per zone
    const fixtures = await db.select()
      .from(schema.dmxFixtures)
      .all()

    const zonesWithCounts = zones.map(zone => ({
      ...zone,
      fixtureCount: fixtures.filter(f => f.zoneId === zone.id).length,
    }))

    return NextResponse.json({
      success: true,
      zones: zonesWithCounts,
      count: zones.length,
    })
  } catch (error) {
    logger.error('[DMX] Error loading zones:', error)
    return NextResponse.json({ error: 'Failed to load zones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, createZoneSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const now = new Date().toISOString()
    const id = randomUUID()

    const zone = await db.insert(schema.dmxZones)
      .values({
        id,
        name: data.name,
        description: data.description || null,
        displayOrder: data.displayOrder ?? 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()

    logger.info('[DMX] Created zone', { id, name: data.name })

    return NextResponse.json({
      success: true,
      zone,
    }, { status: 201 })
  } catch (error) {
    logger.error('[DMX] Error creating zone:', error)
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 })
  }
}
