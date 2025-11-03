
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { operation, duration, metadata, component } = body

    await enhancedLogger.logPerformanceMetric(
      operation,
      duration,
      {
        ...metadata,
        component
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log performance metric:', error)
    return NextResponse.json(
      { error: 'Failed to log performance' },
      { status: 500 }
    )
  }
}
