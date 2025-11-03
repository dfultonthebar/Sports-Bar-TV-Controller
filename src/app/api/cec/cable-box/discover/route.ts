/**
 * CEC Device Discovery API
 *
 * POST /api/cec/cable-box/discover
 * Discover all connected Pulse-Eight USB CEC adapters
 */

import { NextRequest, NextResponse } from 'next/server'
import { CableBoxCECService } from '@/lib/cable-box-cec-service'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    logger.info('[API] Discovering CEC adapters...')

    const cecService = CableBoxCECService.getInstance()
    const adapters = await cecService.discoverAdapters()

    return NextResponse.json({
      success: true,
      adapters,
      count: adapters.length,
      message: `Found ${adapters.length} CEC adapter(s)`,
    })
  } catch (error: any) {
    logger.error('[API] Error discovering adapters:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to discover adapters',
        adapters: [],
      },
      { status: 500 }
    )
  }
}
