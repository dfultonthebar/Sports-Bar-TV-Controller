
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')
    const category = searchParams.get('category') || undefined
    const level = searchParams.get('level') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')

    const logs = await enhancedLogger.getRecentLogs(
      hours,
      category as any,
      level as any
    )

    // Limit the results
    const limitedLogs = logs.slice(0, limit)

    return NextResponse.json({
      logs: limitedLogs,
      totalCount: logs.length,
      limited: logs.length > limit
    })
  } catch (error) {
    console.error('Failed to get recent logs:', error)
    
    await enhancedLogger.error(
      'api',
      'logs-recent-api',
      'fetch_recent',
      'Failed to fetch recent logs',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to fetch recent logs' },
      { status: 500 }
    )
  }
}
