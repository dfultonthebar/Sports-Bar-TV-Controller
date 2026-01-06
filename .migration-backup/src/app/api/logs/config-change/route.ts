
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { component, setting, oldValue, newValue, userId } = body

    await enhancedLogger.logConfigurationChange(
      component,
      setting,
      oldValue,
      newValue,
      userId
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
