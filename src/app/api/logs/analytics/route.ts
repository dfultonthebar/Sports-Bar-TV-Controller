
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')
    const category = searchParams.get('category') || undefined

    const analytics = await enhancedLogger.getLogAnalytics(hours, category)

    return NextResponse.json(analytics)
  } catch (error) {
    logger.error('Failed to get log analytics:', error)
    
    await enhancedLogger.error(
      'api',
      'logs-analytics-api',
      'fetch_analytics',
      'Failed to fetch log analytics',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
