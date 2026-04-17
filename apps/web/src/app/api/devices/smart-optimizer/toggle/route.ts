
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { id, isActive } = bodyValidation.data

    // Log the optimization rule toggle
    logger.info(`Optimization rule ${id} ${isActive ? 'activated' : 'deactivated'}`)

    // In a real implementation, this would:
    // 1. Update the database with the new state
    // 2. Start/stop the actual automation process
    // 3. Log the change for audit purposes

    return NextResponse.json({
      success: true,
      message: `Optimization rule ${isActive ? 'activated' : 'deactivated'} successfully`,
      id,
      isActive,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Toggle optimization error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to toggle optimization rule' },
      { status: 500 }
    )
  }
}
