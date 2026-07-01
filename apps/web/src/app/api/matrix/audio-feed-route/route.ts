import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

/**
 * Route a source's Wolf Pack input into the "Matrix Audio" output that feeds a
 * given Atlas source index, so the audio physically reaches the Atlas input the
 * zones are pointed at.
 *
 * This is the SINGLE source of truth for the source-index → audio-feed-output
 * mapping. Both the scheduler (game-time auto-tune) and the manual "apply now"
 * button call it, so the two can never drift — the drift between two audio
 * apply paths is exactly what caused the Stoneyard Greenville Brewers
 * "video switched, audio didn't" bug (2026-06-30).
 *
 * The feed outputs are DERIVED PER-LOCATION from MatrixOutput.audioOutput='audio'
 * ordered by channelNumber (Greenville 33-36, Holmgren 37-40 — bigger matrix);
 * they are NEVER hardcoded. Atlas source index N = the Nth audio-feed output.
 *
 * Returns { success, skipped, feedOutput, ... }. A location with no audio-feed
 * outputs configured returns skipped:true (HTTP 200) — not an error.
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodySchema = z.object({
    input: z.union([z.string(), z.number()]),
    audioSourceIndex: z.number().int().min(0),
  })
  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { input, audioSourceIndex } = bodyValidation.data

  const inputNum = typeof input === 'string' ? parseInt(input, 10) : input
  if (!Number.isFinite(inputNum)) {
    return NextResponse.json({ success: false, error: `Invalid input "${input}"` }, { status: 400 })
  }

  try {
    // Per-location audio-feed outputs, ordered so index 0 = first "Matrix Audio"
    // output = Atlas source 0.
    const feedRows = await db
      .select({ ch: schema.matrixOutputs.channelNumber })
      .from(schema.matrixOutputs)
      .where(eq(schema.matrixOutputs.audioOutput, 'audio'))
      .orderBy(schema.matrixOutputs.channelNumber)
      .all()
    const feeds = feedRows.map(r => r.ch).filter(c => Number.isFinite(c)) as number[]
    const feedOutput = feeds[audioSourceIndex]

    if (feedOutput == null) {
      logger.warn(`[AUDIO-FEED-ROUTE] No audio-feed output for source index ${audioSourceIndex} (feeds=[${feeds.join(',')}]) — zones will listen but game audio not routed. Check MatrixOutput.audioOutput flags.`)
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'no_audio_feed_output',
        audioSourceIndex,
        availableFeeds: feeds,
      })
    }

    // Route via the standard matrix endpoint so the audio feed gets the exact
    // same routing + DB-row + cache treatment as any other route.
    const port = process.env.PORT || 3001
    const routeRes = await fetch(`http://127.0.0.1:${port}/api/matrix/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: inputNum, output: feedOutput, source: 'audio-feed' }),
    })
    const routeBody = await routeRes.json().catch(() => ({}))
    const ok = routeRes.ok && routeBody?.success !== false

    if (ok) {
      logger.info(`[AUDIO-FEED-ROUTE] Routed input ${inputNum} → audio-feed output ${feedOutput} (Atlas source ${audioSourceIndex})`)
    } else {
      logger.error(`[AUDIO-FEED-ROUTE] Failed to route input ${inputNum} → output ${feedOutput}: ${routeBody?.error || routeRes.status}`)
    }

    return NextResponse.json({
      success: ok,
      input: inputNum,
      feedOutput,
      audioSourceIndex,
      route: routeBody,
    })
  } catch (error: any) {
    logger.error('[AUDIO-FEED-ROUTE] Error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'audio feed route failed' }, { status: 500 })
  }
}
