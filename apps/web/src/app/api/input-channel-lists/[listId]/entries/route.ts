import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and, asc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, isValidationError } from '@/lib/validation'

// GET /api/input-channel-lists/[listId]/entries - Get entries for a list
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ listId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ listId: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  const queryValidation = validateQueryParams(request, z.object({
    active: z.enum(['true', 'false']).optional(),
  }))
  if (isValidationError(queryValidation)) return queryValidation.error

  logger.api.request('GET', `/api/input-channel-lists/${params.listId}/entries`)

  try {
    const { listId } = params
    const { active } = queryValidation.data

    // Verify list exists
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

    const whereClause = active === 'true'
      ? and(eq(schema.inputChannelListEntries.listId, listId), eq(schema.inputChannelListEntries.isActive, true))
      : eq(schema.inputChannelListEntries.listId, listId)

    const entries = await db.select()
      .from(schema.inputChannelListEntries)
      .where(whereClause)
      .orderBy(
        asc(schema.inputChannelListEntries.displayOrder),
        asc(schema.inputChannelListEntries.channelNumber)
      )
      .all()

    logger.api.response('GET', `/api/input-channel-lists/${listId}/entries`, 200, { count: entries.length })
    return NextResponse.json({ success: true, entries })
  } catch (error) {
    logger.api.error('GET', `/api/input-channel-lists/${params.listId}/entries`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/input-channel-lists/[listId]/entries - Add a channel entry
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ listId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ listId: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  const bodySchema = z.object({
    channelNumber: z.string().min(1),
    channelName: z.string().min(1).max(255),
    callsign: z.string().max(50).optional(),
    network: z.string().max(255).optional(),
    category: z.string().max(100).optional(),
    isHD: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })

  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  logger.api.request('POST', `/api/input-channel-lists/${params.listId}/entries`)

  try {
    const { listId } = params
    const { channelNumber, channelName, callsign, network, category, isHD, displayOrder } = bodyValidation.data

    // Verify list exists
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

    // Check for duplicate channel number in this list
    const existingEntry = await db.select()
      .from(schema.inputChannelListEntries)
      .where(and(
        eq(schema.inputChannelListEntries.listId, listId),
        eq(schema.inputChannelListEntries.channelNumber, channelNumber)
      ))
      .get()

    if (existingEntry) {
      return NextResponse.json(
        { success: false, error: `Channel ${channelNumber} already exists in this list` },
        { status: 409 }
      )
    }

    const entryId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(schema.inputChannelListEntries).values({
      id: entryId,
      listId,
      channelNumber,
      channelName,
      callsign: callsign ?? null,
      network: network ?? null,
      category: category ?? 'sports',
      isHD: isHD ?? false,
      isActive: true,
      displayOrder: displayOrder ?? 0,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    }).run()

    const entry = await db.select()
      .from(schema.inputChannelListEntries)
      .where(eq(schema.inputChannelListEntries.id, entryId))
      .get()

    logger.api.response('POST', `/api/input-channel-lists/${listId}/entries`, 201, { entryId })
    return NextResponse.json(
      { success: true, entry },
      { status: 201 }
    )
  } catch (error) {
    logger.api.error('POST', `/api/input-channel-lists/${params.listId}/entries`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to add entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
