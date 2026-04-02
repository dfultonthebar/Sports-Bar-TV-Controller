/**
 * POST /api/wolfpack/chassis/[chassisId]/route - Route input→output on specific chassis
 */

import { NextResponse, NextRequest } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'
import { routeMatrix } from '@sports-bar/wolfpack'
import { getChassisById } from '@/lib/wolfpack/chassis-loader'

const routeSchema = z.object({
  inputNum: z.number().int().min(1),
  outputNum: z.number().int().min(1),
})

type RouteContext = { params: Promise<{ chassisId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { chassisId } = await context.params

    // Validate chassis exists in JSON
    const chassisConfig = getChassisById(chassisId)
    if (!chassisConfig) {
      return NextResponse.json(
        { error: `Chassis "${chassisId}" not found in wolfpack-devices.json` },
        { status: 404 }
      )
    }

    // Validate request body
    const bodyValidation = await validateRequestBody(request, routeSchema)
    if (!bodyValidation.success) return bodyValidation.error
    const { inputNum, outputNum } = bodyValidation.data

    // Validate against chassis limits
    if (inputNum > chassisConfig.inputs.length) {
      return NextResponse.json(
        { error: `Input ${inputNum} exceeds chassis max ${chassisConfig.inputs.length}` },
        { status: 400 }
      )
    }
    if (outputNum > chassisConfig.outputs.length) {
      return NextResponse.json(
        { error: `Output ${outputNum} exceeds chassis max ${chassisConfig.outputs.length}` },
        { status: 400 }
      )
    }

    logger.info(`[WOLFPACK-CHASSIS] Routing on ${chassisId}: input ${inputNum} -> output ${outputNum}`)

    const success = await routeMatrix(inputNum, outputNum, chassisId)

    if (!success) {
      return NextResponse.json(
        { error: 'Routing command failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      chassisId,
      inputNum,
      outputNum,
    })
  } catch (error) {
    logger.error('[WOLFPACK-CHASSIS] Error routing:', { error })
    return NextResponse.json(
      { error: 'Failed to route' },
      { status: 500 }
    )
  }
}
