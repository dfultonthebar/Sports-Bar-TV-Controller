import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validatePathParams, isValidationError } from '@/lib/validation'

// PUT /api/input-channel-lists/[listId]/entries/[entryId] - Update a single entry
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ listId: string; entryId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({
    listId: z.string().min(1),
    entryId: z.string().min(1),
  }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  const bodySchema = z.object({
    channelNumber: z.string().min(1).optional(),
    channelName: z.string().min(1).max(255).optional(),
    callsign: z.string().max(50).nullable().optional(),
    network: z.string().max(255).nullable().optional(),
    category: z.string().max(100).optional(),
    isHD: z.boolean().optional(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })

  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  logger.api.request('PUT', `/api/input-channel-lists/${params.listId}/entries/${params.entryId}`)

  try {
    const { listId, entryId } = params

    // Verify entry exists and belongs to the specified list
    const existing = await db.select()
      .from(schema.inputChannelListEntries)
      .where(and(
        eq(schema.inputChannelListEntries.id, entryId),
        eq(schema.inputChannelListEntries.listId, listId)
      ))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entry not found in this list' },
        { status: 404 }
      )
    }

    const { channelNumber, channelName, callsign, network, category, isHD, isActive, displayOrder } = bodyValidation.data

    // If changing channel number, check for duplicates
    if (channelNumber !== undefined && channelNumber !== existing.channelNumber) {
      const duplicate = await db.select()
        .from(schema.inputChannelListEntries)
        .where(and(
          eq(schema.inputChannelListEntries.listId, listId),
          eq(schema.inputChannelListEntries.channelNumber, channelNumber)
        ))
        .get()

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `Channel ${channelNumber} already exists in this list` },
          { status: 409 }
        )
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (channelNumber !== undefined) updateData.channelNumber = channelNumber
    if (channelName !== undefined) updateData.channelName = channelName
    if (callsign !== undefined) updateData.callsign = callsign
    if (network !== undefined) updateData.network = network
    if (category !== undefined) updateData.category = category
    if (isHD !== undefined) updateData.isHD = isHD
    if (isActive !== undefined) updateData.isActive = isActive
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder

    await db.update(schema.inputChannelListEntries)
      .set(updateData)
      .where(eq(schema.inputChannelListEntries.id, entryId))
      .run()

    const entry = await db.select()
      .from(schema.inputChannelListEntries)
      .where(eq(schema.inputChannelListEntries.id, entryId))
      .get()

    logger.api.response('PUT', `/api/input-channel-lists/${listId}/entries/${entryId}`, 200)
    return NextResponse.json({ success: true, entry })
  } catch (error) {
    logger.api.error('PUT', `/api/input-channel-lists/${params.listId}/entries/${params.entryId}`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to update entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/input-channel-lists/[listId]/entries/[entryId] - Remove an entry
export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ listId: string; entryId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({
    listId: z.string().min(1),
    entryId: z.string().min(1),
  }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  logger.api.request('DELETE', `/api/input-channel-lists/${params.listId}/entries/${params.entryId}`)

  try {
    const { listId, entryId } = params

    // Verify entry exists and belongs to the specified list
    const existing = await db.select()
      .from(schema.inputChannelListEntries)
      .where(and(
        eq(schema.inputChannelListEntries.id, entryId),
        eq(schema.inputChannelListEntries.listId, listId)
      ))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entry not found in this list' },
        { status: 404 }
      )
    }

    await db.delete(schema.inputChannelListEntries)
      .where(eq(schema.inputChannelListEntries.id, entryId))
      .run()

    logger.api.response('DELETE', `/api/input-channel-lists/${listId}/entries/${entryId}`, 200)
    return NextResponse.json({ success: true, message: 'Entry deleted successfully' })
  } catch (error) {
    logger.api.error('DELETE', `/api/input-channel-lists/${params.listId}/entries/${params.entryId}`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
