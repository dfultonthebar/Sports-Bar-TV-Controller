/**
 * GET /api/neighborhood/preemptive-strike
 *
 * Returns the next N hours of upcoming neighborhood events whose artist
 * matches a high-confidence `ArtistInterferenceProfile` for the current
 * LOCATION_ID. Drives the operator-facing "incoming RF threats" panel.
 *
 * Stage 1 only — endpoint surfaces what the scheduler's `[PREEMPTIVE]`
 * log line would say. A future stage will offer an "act on this" button
 * that triggers a Shure retune; for now this is informational.
 *
 * Query params:
 *   ?horizonHours=N  — look-ahead window in hours (default 24, max 168)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateQueryParams } from '@/lib/validation'
import { runPreemptiveStrike } from '@sports-bar/scheduler'

const querySchema = z.object({
  horizonHours: z.coerce.number().int().min(1).max(168).default(24),
})

export async function GET(request: NextRequest) {
  // DATABASE_READ — pure SELECT (the strike pass writes to the log,
  // never to the DB at stage 1).
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) return rateLimit.response

  const queryValidation = validateQueryParams(request, querySchema)
  if (!queryValidation.success) return queryValidation.error
  const { horizonHours } = queryValidation.data

  const locationId = process.env.LOCATION_ID
  if (!locationId) {
    return NextResponse.json(
      { success: false, error: 'LOCATION_ID env not set' },
      { status: 500 },
    )
  }

  try {
    const candidates = await runPreemptiveStrike({ locationId, horizonHours })

    return NextResponse.json({
      success: true,
      locationId,
      horizonHours,
      generatedAt: Math.floor(Date.now() / 1000),
      count: candidates.length,
      candidates,
    })
  } catch (err: any) {
    logger.error('[NEIGHBORHOOD-STRIKE] Query failed:', err)
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Unknown error' },
      { status: 500 },
    )
  }
}
