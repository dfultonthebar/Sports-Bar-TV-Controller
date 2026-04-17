import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and, asc, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, isValidationError } from '@/lib/validation'

// GET /api/input-channel-lists - List all input channel lists with entry counts
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const queryValidation = validateQueryParams(request, z.object({
    matrixInputId: z.coerce.number().int().min(1).optional(),
  }))
  if (isValidationError(queryValidation)) return queryValidation.error

  logger.api.request('GET', '/api/input-channel-lists')

  try {
    const { matrixInputId } = queryValidation.data

    if (matrixInputId !== undefined) {
      // Get a specific input's list
      const list = await db.select()
        .from(schema.inputChannelLists)
        .where(eq(schema.inputChannelLists.matrixInputId, matrixInputId))
        .get()

      if (!list) {
        return NextResponse.json({ success: true, list: null })
      }

      const entryCount = await db.select({ count: sql<number>`count(*)` })
        .from(schema.inputChannelListEntries)
        .where(eq(schema.inputChannelListEntries.listId, list.id))
        .get()

      logger.api.response('GET', '/api/input-channel-lists', 200, { matrixInputId })
      return NextResponse.json({
        success: true,
        list: { ...list, entryCount: entryCount?.count ?? 0 },
      })
    }

    // Get all lists with entry counts
    const lists = await db.select()
      .from(schema.inputChannelLists)
      .orderBy(asc(schema.inputChannelLists.matrixInputId))
      .all()

    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        const entryCount = await db.select({ count: sql<number>`count(*)` })
          .from(schema.inputChannelListEntries)
          .where(eq(schema.inputChannelListEntries.listId, list.id))
          .get()
        return { ...list, entryCount: entryCount?.count ?? 0 }
      })
    )

    logger.api.response('GET', '/api/input-channel-lists', 200, { count: listsWithCounts.length })
    return NextResponse.json({ success: true, lists: listsWithCounts })
  } catch (error) {
    logger.api.error('GET', '/api/input-channel-lists', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch input channel lists', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/input-channel-lists - Create a new channel list for a matrix input
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodySchema = z.object({
    matrixInputId: z.number().int().min(1),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    importFromGlobal: z.boolean().optional(),
  })

  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  logger.api.request('POST', '/api/input-channel-lists')

  try {
    const { matrixInputId, name, description, importFromGlobal } = bodyValidation.data

    // Check if a list already exists for this input
    const existing = await db.select()
      .from(schema.inputChannelLists)
      .where(eq(schema.inputChannelLists.matrixInputId, matrixInputId))
      .get()

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A channel list already exists for matrix input ${matrixInputId}` },
        { status: 409 }
      )
    }

    const listId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(schema.inputChannelLists).values({
      id: listId,
      matrixInputId,
      name,
      description: description ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run()

    let importedCount = 0

    // Optionally seed entries from global ChannelPreset table (directv presets)
    if (importFromGlobal) {
      const globalPresets = await db.select()
        .from(schema.channelPresets)
        .where(and(
          eq(schema.channelPresets.deviceType, 'directv'),
          eq(schema.channelPresets.isActive, true)
        ))
        .orderBy(asc(schema.channelPresets.order))
        .all()

      for (const preset of globalPresets) {
        await db.insert(schema.inputChannelListEntries).values({
          id: crypto.randomUUID(),
          listId,
          channelNumber: preset.channelNumber,
          channelName: preset.name,
          category: 'sports',
          isHD: false,
          isActive: true,
          displayOrder: preset.order,
          source: 'imported',
          createdAt: now,
          updatedAt: now,
        }).run()
        importedCount++
      }

      logger.info('[INPUT_CHANNEL_LISTS] Imported entries from global presets', { listId, importedCount })
    }

    const list = await db.select()
      .from(schema.inputChannelLists)
      .where(eq(schema.inputChannelLists.id, listId))
      .get()

    logger.api.response('POST', '/api/input-channel-lists', 201, { listId, importedCount })
    return NextResponse.json(
      { success: true, list, importedCount },
      { status: 201 }
    )
  } catch (error) {
    logger.api.error('POST', '/api/input-channel-lists', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create input channel list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
