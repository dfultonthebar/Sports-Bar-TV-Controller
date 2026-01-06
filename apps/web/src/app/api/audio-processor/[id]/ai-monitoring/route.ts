
import { NextRequest, NextResponse } from 'next/server'
import { aiGainService } from '@/lib/ai-gain-service'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
interface RouteContext {
  params: Promise<{
    id: string
  }>
}

// GET: Get monitoring status
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Path parameter validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error
  try {
    const processorId = params.id

    const status = await aiGainService.getAIGainStatus(processorId)

    return NextResponse.json({ 
      success: true,
      processorId,
      status
    })

  } catch (error) {
    logger.error('Error fetching AI monitoring status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring status' },
      { status: 500 }
    )
  }
}

// POST: Start/stop monitoring
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error
  try {
    const processorId = params.id
    const { action } = bodyValidation.data

    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "start" or "stop"' },
        { status: 400 }
      )
    }

    if (action === 'start') {
      await aiGainService.startMonitoring(processorId)
      return NextResponse.json({ 
        success: true,
        message: 'AI gain monitoring started'
      })
    } else {
      aiGainService.stopMonitoring(processorId)
      return NextResponse.json({ 
        success: true,
        message: 'AI gain monitoring stopped'
      })
    }

  } catch (error) {
    logger.error('Error controlling AI monitoring:', error)
    return NextResponse.json(
      { error: 'Failed to control monitoring' },
      { status: 500 }
    )
  }
}
