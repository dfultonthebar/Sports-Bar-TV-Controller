
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
    const { deviceType, deviceId, action, success, details, component } = bodyValidation.data

    await enhancedLogger.logHardwareOperation(
      deviceType as any,
      deviceId as string | undefined,
      String(action),
      success,
      details && typeof details === 'object'
        ? { ...(details as object), component }
        : { component }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to log device interaction:', error)
    return NextResponse.json(
      { error: 'Failed to log device interaction' },
      { status: 500 }
    )
  }
}
