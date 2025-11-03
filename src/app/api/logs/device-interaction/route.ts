
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    const body = await request.json()
    const { deviceType, deviceId, action, success, details, component } = body

    await enhancedLogger.logHardwareOperation(
      deviceType,
      deviceId,
      action,
      success,
      {
        ...details,
        component
      }
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
