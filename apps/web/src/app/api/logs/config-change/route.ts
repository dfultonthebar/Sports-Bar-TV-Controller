
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
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
    const { component, setting, oldValue, newValue, userId } = bodyValidation.data

    await enhancedLogger.logConfigurationChange(
      String(component),
      String(setting),
      oldValue,
      newValue,
      userId as string | undefined
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to log configuration change:', error)
    return NextResponse.json(
      { error: 'Failed to log config change' },
      { status: 500 }
    )
  }
}
