/**
 * Cable Box CEC Control API
 *
 * Endpoints for managing and controlling cable boxes via CEC
 */

import { NextRequest, NextResponse } from 'next/server'
import { CableBoxCECService } from '@/lib/cable-box-cec-service'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * GET /api/cec/cable-box
 * List all configured cable boxes
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const cecService = CableBoxCECService.getInstance()
    const cableBoxes = await cecService.getCableBoxes()

    return NextResponse.json({
      success: true,
      cableBoxes,
      count: cableBoxes.length,
    })
  } catch (error: any) {
    console.error('[API] Error fetching cable boxes:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch cable boxes',
      },
      { status: 500 }
    )
  }
}
