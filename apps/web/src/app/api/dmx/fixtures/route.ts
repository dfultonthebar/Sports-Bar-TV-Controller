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

const createFixtureSchema = z.object({
  controllerId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  fixtureType: z.enum(['led-par', 'moving-head', 'strobe', 'fog-machine', 'led-strip', 'pin-spot', 'laser', 'generic']),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  universe: z.number().int().min(0).max(3).optional(),
  startAddress: z.number().int().min(1).max(512),
  channelCount: z.number().int().min(1).max(512),
  channelMap: z.record(z.number().int().min(1).max(512)),
  capabilities: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const controllerId = searchParams.get('controllerId')
    const zoneId = searchParams.get('zoneId')

    let fixtures = await db.select()
      .from(schema.dmxFixtures)
      .orderBy(asc(schema.dmxFixtures.displayOrder), asc(schema.dmxFixtures.startAddress))
      .all()

    // Filter in JS
    if (controllerId) {
      fixtures = fixtures.filter(f => f.controllerId === controllerId)
    }
    if (zoneId) {
      fixtures = fixtures.filter(f => f.zoneId === zoneId)
    }

    // Parse JSON fields
    const parsed = fixtures.map(f => ({
      ...f,
      channelMap: JSON.parse(f.channelMap || '{}'),
      capabilities: JSON.parse(f.capabilities || '[]'),
      currentState: JSON.parse(f.currentState || '{}'),
    }))

    return NextResponse.json({
      success: true,
      fixtures: parsed,
      count: parsed.length,
    })
  } catch (error) {
    logger.error('[DMX] Error loading fixtures:', error)
    return NextResponse.json({ error: 'Failed to load fixtures' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, createFixtureSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    // Verify controller exists
    const controller = await db.select()
      .from(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, data.controllerId))
      .limit(1)
      .get()

    if (!controller) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const id = randomUUID()

    const fixture = await db.insert(schema.dmxFixtures)
      .values({
        id,
        controllerId: data.controllerId,
        zoneId: data.zoneId || null,
        name: data.name,
        fixtureType: data.fixtureType,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        universe: data.universe ?? 0,
        startAddress: data.startAddress,
        channelCount: data.channelCount,
        channelMap: JSON.stringify(data.channelMap),
        capabilities: JSON.stringify(data.capabilities || []),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()

    logger.info('[DMX] Created fixture', {
      id,
      name: data.name,
      type: data.fixtureType,
      address: `${data.universe ?? 0}:${data.startAddress}`,
    })

    return NextResponse.json({
      success: true,
      fixture: {
        ...fixture,
        channelMap: data.channelMap,
        capabilities: data.capabilities || [],
      },
    }, { status: 201 })
  } catch (error) {
    logger.error('[DMX] Error creating fixture:', error)
    return NextResponse.json({ error: 'Failed to create fixture' }, { status: 500 })
  }
}
