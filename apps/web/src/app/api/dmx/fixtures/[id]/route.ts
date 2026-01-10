import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const updateFixtureSchema = z.object({
  controllerId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(100).optional(),
  fixtureType: z.string().min(1).optional(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  universe: z.number().int().min(0).max(255).optional(),
  startAddress: z.number().int().min(1).max(512).optional(),
  channelCount: z.number().int().min(1).max(512).optional(),
  channelMap: z.record(z.number().int().min(1).max(512)).optional(),
  capabilities: z.array(z.string()).optional(),
  currentState: z.record(z.number().int().min(0).max(255)).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  try {
    const fixture = await db.select()
      .from(schema.dmxFixtures)
      .where(eq(schema.dmxFixtures.id, id))
      .get()

    if (!fixture) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    const parsed = {
      ...fixture,
      channelMap: fixture.channelMap ? JSON.parse(fixture.channelMap) : null,
      capabilities: fixture.capabilities ? JSON.parse(fixture.capabilities) : [],
      currentState: fixture.currentState ? JSON.parse(fixture.currentState) : null,
    }

    return NextResponse.json({ success: true, fixture: parsed })
  } catch (error) {
    logger.error('[DMX] Error fetching fixture:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fixture' },
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

  const bodyValidation = await validateRequestBody(request, updateFixtureSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const existing = await db.select()
      .from(schema.dmxFixtures)
      .where(eq(schema.dmxFixtures.id, id))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      )
    }

    // If controllerId is being updated, verify it exists
    if (data.controllerId) {
      const controller = await db.select()
        .from(schema.dmxControllers)
        .where(eq(schema.dmxControllers.id, data.controllerId))
        .get()

      if (!controller) {
        return NextResponse.json(
          { success: false, error: 'Controller not found' },
          { status: 400 }
        )
      }
    }

    // If zoneId is being updated, verify it exists
    if (data.zoneId) {
      const zone = await db.select()
        .from(schema.dmxZones)
        .where(eq(schema.dmxZones.id, data.zoneId))
        .get()

      if (!zone) {
        return NextResponse.json(
          { success: false, error: 'Zone not found' },
          { status: 400 }
        )
      }
    }

    const now = new Date().toISOString()

    // Prepare update data with JSON serialization
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    }

    if (data.controllerId !== undefined) updateData.controllerId = data.controllerId
    if (data.zoneId !== undefined) updateData.zoneId = data.zoneId
    if (data.name !== undefined) updateData.name = data.name
    if (data.fixtureType !== undefined) updateData.fixtureType = data.fixtureType
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer
    if (data.model !== undefined) updateData.model = data.model
    if (data.universe !== undefined) updateData.universe = data.universe
    if (data.startAddress !== undefined) updateData.startAddress = data.startAddress
    if (data.channelCount !== undefined) updateData.channelCount = data.channelCount
    if (data.channelMap !== undefined) updateData.channelMap = JSON.stringify(data.channelMap)
    if (data.capabilities !== undefined) updateData.capabilities = JSON.stringify(data.capabilities)
    if (data.currentState !== undefined) updateData.currentState = JSON.stringify(data.currentState)
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder

    const fixture = await db.update(schema.dmxFixtures)
      .set(updateData)
      .where(eq(schema.dmxFixtures.id, id))
      .returning()
      .get()

    logger.info('[DMX] Updated fixture', { id, name: fixture.name })

    // Parse JSON fields for response
    const parsed = {
      ...fixture,
      channelMap: fixture.channelMap ? JSON.parse(fixture.channelMap) : null,
      capabilities: fixture.capabilities ? JSON.parse(fixture.capabilities) : [],
      currentState: fixture.currentState ? JSON.parse(fixture.currentState) : null,
    }

    return NextResponse.json({ success: true, fixture: parsed })
  } catch (error) {
    logger.error('[DMX] Error updating fixture:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update fixture' },
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
      .from(schema.dmxFixtures)
      .where(eq(schema.dmxFixtures.id, id))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      )
    }

    await db.delete(schema.dmxFixtures)
      .where(eq(schema.dmxFixtures.id, id))
      .run()

    logger.info('[DMX] Deleted fixture', { id, name: existing.name })

    return NextResponse.json({ success: true, message: 'Fixture deleted' })
  } catch (error) {
    logger.error('[DMX] Error deleting fixture:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete fixture' },
      { status: 500 }
    )
  }
}
