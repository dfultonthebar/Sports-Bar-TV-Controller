
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { buildDistributionPlan } from '@/lib/ai/distribution-optimizer'

// Morning bulk-scheduling helper. Bartender or manager selects a batch of
// proposed games (e.g., "approve all AI Suggest recommendations for
// today") and this endpoint returns an assignment plan that tries to get
// all games visible, using per-team historical routes and per-league
// learned durations.
//
// Dry run: this endpoint does NOT create allocations. Caller commits each
// line through POST /api/schedules/bartender-schedule using the returned
// plan's inputSourceId, channelNumber, tvOutputIds, and tuneAtUnix.

const proposedGameSchema = z.object({
  gameScheduleId: z.string(),
  preferredTvCount: z.number().int().min(1).max(40).optional(),
  priority: z.number().int().min(0).max(100).optional(),
})

const schema = z.object({
  games: z.array(proposedGameSchema).min(1).max(40),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, schema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { games } = bodyValidation.data
  const startMs = Date.now()

  try {
    const result = await buildDistributionPlan(games)
    logger.info(
      `[DISTRIBUTION-PLAN] ${result.stats.assigned}/${result.stats.totalGames} assigned ` +
      `(${result.stats.homeTeamAssigned} home teams, ${result.stats.inputSourcesUsed} sources) ` +
      `in ${Date.now() - startMs}ms`
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    logger.error('[DISTRIBUTION-PLAN] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
