
import { NextRequest, NextResponse } from 'next/server'
import { reorderAllPresets } from '@/services/presetReorderService'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * POST /api/channel-presets/reorder
 * Manually trigger preset reordering based on usage
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    await reorderAllPresets()

    return NextResponse.json({
      success: true,
      message: 'Presets reordered successfully based on usage patterns'
    })
  } catch (error) {
    logger.error('Error reordering presets:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reorder presets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
