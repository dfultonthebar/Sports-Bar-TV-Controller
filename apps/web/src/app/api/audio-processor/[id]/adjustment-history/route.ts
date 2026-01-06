
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

// GET: Get adjustment history for an input
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  // Path parameter validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error
  try {
    const processorId = params.id
    const { searchParams } = new URL(request.url)
    const inputNumber = parseInt(searchParams.get('inputNumber') || '')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (isNaN(inputNumber)) {
      return NextResponse.json(
        { error: 'Valid input number is required' },
        { status: 400 }
      )
    }

    const history = await aiGainService.getAdjustmentHistory(
      processorId,
      inputNumber,
      limit
    )

    return NextResponse.json({ 
      success: true,
      processorId,
      inputNumber,
      history
    })

  } catch (error) {
    logger.error('Error fetching adjustment history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch adjustment history' },
      { status: 500 }
    )
  }
}
