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

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    console.log('[API] Discovering CEC adapters...')

    const cecService = CableBoxCECService.getInstance()
    const adapters = await cecService.discoverAdapters()

    return NextResponse.json({
      success: true,
      adapters,
      count: adapters.length,
      message: `Found ${adapters.length} CEC adapter(s)`,
    })
  } catch (error: any) {
    console.error('[API] Error discovering adapters:', error)
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
