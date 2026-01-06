
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  try {
    const { operation, duration, metadata, component } = bodyValidation.data

    await enhancedLogger.logPerformanceMetric(
      operation as string,
      duration as number,
      metadata && typeof metadata === 'object'
        ? { ...(metadata as object), component }
        : { component }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to log performance metric:', error)
    return NextResponse.json(
      { error: 'Failed to log performance' },
      { status: 500 }
    )
  }
}
