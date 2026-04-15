import { NextRequest, NextResponse } from 'next/server'
import { desc, eq, gte, and } from 'drizzle-orm'
import { db } from '@/db'
import { schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, validateRequestBody, isValidationError } from '@/lib/validation'
import { z } from 'zod'

// GET /api/channel-presets/tune/history
// Rolling history of tune attempts. Supports optional filters:
//   ?inputNum=3      — only tunes for a specific matrix input
//   ?since=ISO       — only tunes after this timestamp (ISO 8601)
//   ?limit=N         — cap results (default 100, max 500)
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const queryValidation = validateQueryParams(
    request,
    z.object({
      inputNum: z.coerce.number().int().positive().optional(),
      since: z.string().datetime().optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    })
  )
  if (isValidationError(queryValidation)) return queryValidation.error

  const { inputNum, since, limit = 100 } = queryValidation.data

  try {
    const conditions = []
    if (inputNum !== undefined) {
      conditions.push(eq(schema.channelTuneLogs.inputNum, inputNum))
    }
    if (since) {
      conditions.push(gte(schema.channelTuneLogs.tunedAt, since))
    }

    const rows = await db
      .select()
      .from(schema.channelTuneLogs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.channelTuneLogs.tunedAt))
      .limit(limit)
      .all()

    return NextResponse.json({
      success: true,
      count: rows.length,
      tunes: rows,
    })
  } catch (error: any) {
    logger.error('[TUNE HISTORY] Error reading ChannelTuneLog:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load tune history' },
      { status: 500 }
    )
  }
}

// POST /api/channel-presets/tune/history
// Append an intent event to the history log. Used by the Channel Guide
// Watch button so we can track clicks independently of whether the
// downstream hardware command succeeded. For cable inputs this produces
// a 'watch-button' row here *and* a 'bartender' row from the tune
// endpoint — the two together tell the intent-vs-outcome story.
const postSchema = z.object({
  channelNumber: z.string(),
  deviceType: z.string(),
  inputNum: z.number().int().positive().optional(),
  inputLabel: z.string().optional(),
  channelName: z.string().optional(),
  deviceId: z.string().optional(),
  cableBoxId: z.string().optional(),
  presetId: z.string().optional(),
  triggeredBy: z.string().optional(),
  success: z.boolean().optional(),
  errorMessage: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, postSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const body = bodyValidation.data

  try {
    await db.insert(schema.channelTuneLogs).values({
      id: crypto.randomUUID(),
      inputNum: body.inputNum,
      inputLabel: body.inputLabel,
      deviceType: body.deviceType,
      deviceId: body.deviceId,
      cableBoxId: body.cableBoxId,
      channelNumber: body.channelNumber,
      channelName: body.channelName,
      presetId: body.presetId,
      triggeredBy: body.triggeredBy ?? 'watch-button',
      success: body.success ?? true,
      errorMessage: body.errorMessage,
      tunedAt: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('[TUNE HISTORY] Error appending event:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to append event' },
      { status: 500 }
    )
  }
}
