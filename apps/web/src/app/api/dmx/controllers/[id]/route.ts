import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const updateControllerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  serialPort: z.string().optional(),
  baudRate: z.number().int().positive().optional(),
  adapterModel: z.string().optional(),
  ipAddress: z.string().optional(),
  artnetPort: z.number().int().min(1).max(65535).optional(),
  artnetSubnet: z.number().int().min(0).max(15).optional(),
  artnetNet: z.number().int().min(0).max(127).optional(),
  universeStart: z.number().int().min(0).max(255).optional(),
  universeCount: z.number().int().min(1).max(4).optional(),
  maestroPresetCount: z.number().int().min(1).max(99).optional(),
  maestroFunctionCount: z.number().int().min(1).max(20).optional(),
  description: z.string().optional(),
  status: z.enum(['online', 'offline', 'error']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  try {
    const controller = await db.select()
      .from(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, id))
      .limit(1)
      .get()

    if (!controller) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, controller })
  } catch (error) {
    logger.error('[DMX] Error loading controller:', error)
    return NextResponse.json({ error: 'Failed to load controller' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  const bodyValidation = await validateRequestBody(request, updateControllerSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const existing = await db.select()
      .from(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, id))
      .limit(1)
      .get()

    if (!existing) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    await db.update(schema.dmxControllers)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(schema.dmxControllers.id, id))
      .run()

    const updated = await db.select()
      .from(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, id))
      .limit(1)
      .get()

    logger.info('[DMX] Updated controller', { id, name: updated?.name })

    return NextResponse.json({ success: true, controller: updated })
  } catch (error) {
    logger.error('[DMX] Error updating controller:', error)
    return NextResponse.json({ error: 'Failed to update controller' }, { status: 500 })
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
      .from(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, id))
      .limit(1)
      .get()

    if (!existing) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 })
    }

    await db.delete(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, id))
      .run()

    logger.info('[DMX] Deleted controller', { id, name: existing.name })

    return NextResponse.json({ success: true, message: 'Controller deleted' })
  } catch (error) {
    logger.error('[DMX] Error deleting controller:', error)
    return NextResponse.json({ error: 'Failed to delete controller' }, { status: 500 })
  }
}
