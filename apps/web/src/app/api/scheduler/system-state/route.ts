/**
 * Scheduler System State API
 *
 * GET /api/scheduler/system-state
 * Returns current system state for intelligent distribution:
 * - What's playing on each input
 * - Current matrix routing
 * - Available inputs by type
 * - TV zone assignments
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { getStateReader } from '@/lib/scheduler/state-reader'
import { logger } from '@sports-bar/logger'

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[API] Getting scheduler system state')

    const stateReader = getStateReader()
    const systemState = await stateReader.getSystemState()

    return NextResponse.json({
      success: true,
      data: systemState
    })
  } catch (error: any) {
    logger.error('[API] Error getting system state:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get system state'
      },
      { status: 500 }
    )
  }
}
