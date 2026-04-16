import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, asc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validatePathParams, isValidationError } from '@/lib/validation'

// GET /api/input-channel-lists/[listId] - Get list details + all entries
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ listId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ listId: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  logger.api.request('GET', `/api/input-channel-lists/${params.listId}`)

  try {
    const { listId } = params

    const list = await db.select()
      .from(schema.inputChannelLists)
      .where(eq(schema.inputChannelLists.id, listId))
      .get()

    if (!list) {
      return NextResponse.json(
        { success: false, error: 'Channel list not found' },
        { status: 404 }
      )
    }

    const entries = await db.select()
      .from(schema.inputChannelListEntries)
      .where(eq(schema.inputChannelListEntries.listId, listId))
      .orderBy(
        asc(schema.inputChannelListEntries.displayOrder),
        asc(schema.inputChannelListEntries.channelNumber)
      )
      .all()

    logger.api.response('GET', `/api/input-channel-lists/${listId}`, 200, { entryCount: entries.length })
    return NextResponse.json({ success: true, list, entries })
  } catch (error) {
    logger.api.error('GET', `/api/input-channel-lists/${params.listId}`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channel list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT /api/input-channel-lists/[listId] - Update list metadata
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ listId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ listId: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  const bodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
  })

  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  logger.api.request('PUT', `/api/input-channel-lists/${params.listId}`)

  try {
    const { listId } = params
    const { name, description, isActive } = bodyValidation.data

    const existing = await db.select()
      .from(schema.inputChannelLists)
      .where(eq(schema.inputChannelLists.id, listId))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Channel list not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    await db.update(schema.inputChannelLists)
      .set(updateData)
      .where(eq(schema.inputChannelLists.id, listId))
      .run()

    const list = await db.select()
      .from(schema.inputChannelLists)
      .where(eq(schema.inputChannelLists.id, listId))
      .get()

    logger.api.response('PUT', `/api/input-channel-lists/${listId}`, 200)
    return NextResponse.json({ success: true, list })
  } catch (error) {
    logger.api.error('PUT', `/api/input-channel-lists/${params.listId}`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to update channel list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/input-channel-lists/[listId] - Delete list (entries cascade)
export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ listId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ listId: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  logger.api.request('DELETE', `/api/input-channel-lists/${params.listId}`)

  try {
    const { listId } = params

    const existing = await db.select()
      .from(schema.inputChannelLists)
      .where(eq(schema.inputChannelLists.id, listId))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Channel list not found' },
        { status: 404 }
      )
    }

    await db.delete(schema.inputChannelLists)
      .where(eq(schema.inputChannelLists.id, listId))
      .run()

    logger.api.response('DELETE', `/api/input-channel-lists/${listId}`, 200)
    return NextResponse.json({ success: true, message: 'Channel list deleted successfully' })
  } catch (error) {
    logger.api.error('DELETE', `/api/input-channel-lists/${params.listId}`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete channel list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
