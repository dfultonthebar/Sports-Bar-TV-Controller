/**
 * Distribution Plan API
 *
 * POST /api/scheduler/distribution-plan
 * Creates intelligent distribution plan for games
 *
 * Body:
 * {
 *   games: Array<{
 *     id?: string
 *     homeTeam: string
 *     awayTeam: string
 *     sport?: string
 *     league?: string
 *     startTime: string
 *     description?: string
 *     channelNumber?: string
 *     channelName?: string
 *   }>
 *   execute?: boolean  // If true, execute the plan immediately
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas, z } from '@/lib/validation'
import { getDistributionEngine } from '@/lib/scheduler/distribution-engine'
import { logger } from '@/lib/logger'

const distributionPlanSchema = z.object({
  games: z.array(
    z.object({
      id: z.string().optional(),
      homeTeam: z.string().min(1),
      awayTeam: z.string().min(1),
      sport: z.string().optional(),
      league: z.string().optional(),
      startTime: z.string(),
      description: z.string().optional(),
      channelNumber: z.string().optional(),
      channelName: z.string().optional()
    })
  ).min(1),
  execute: z.boolean().optional().default(false)
})

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // Validation
  const bodyValidation = await validateRequestBody(request, distributionPlanSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const { games, execute } = bodyValidation.data

  try {
    logger.info(`[API] Creating distribution plan for ${games.length} games (execute: ${execute})`)

    const engine = getDistributionEngine()
    const plan = await engine.createDistributionPlan(games)

    // Validate plan
    const validation = engine.validatePlan(plan)
    if (!validation.valid) {
      logger.warn(`[API] Distribution plan validation failed: ${validation.errors.join(', ')}`)
    }

    // Execute if requested
    if (execute) {
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot execute invalid plan',
            validationErrors: validation.errors
          },
          { status: 400 }
        )
      }

      logger.info('[API] Executing distribution plan')
      await engine.executePlan(plan)
    }

    return NextResponse.json({
      success: true,
      data: {
        plan,
        validation,
        executed: execute
      }
    })
  } catch (error: any) {
    logger.error('[API] Error creating distribution plan:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create distribution plan'
      },
      { status: 500 }
    )
  }
}
