
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
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
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    // Get logs based on filters
    let logs = await enhancedLogger.getRecentLogs(
      hours, 
      category as any, 
      level as any
    )

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase()
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.source.toLowerCase().includes(searchLower) ||
        (log.deviceType && log.deviceType.toLowerCase().includes(searchLower)) ||
        (log.deviceId && log.deviceId.toLowerCase().includes(searchLower))
      )
    }

    // Limit results for preview
    const previewLogs = logs.slice(0, limit)

    const response = {
      logs: previewLogs,
      total: logs.length,
      preview: true,
      filters: {
        hours,
        category: category || 'all',
        level: level || 'all',
        search
      },
      timestamp: new Date().toISOString()
    }

    // Log the preview request
    await enhancedLogger.info(
      'api',
      'log-preview-api',
      'preview_logs',
      'Log preview requested',
      { 
        hours, 
        category, 
        level, 
        search,
        totalFound: logs.length,
        previewCount: previewLogs.length
      }
    )

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Failed to preview logs:', error)
    
    await enhancedLogger.error(
      'api',
      'log-preview-api',
      'preview_logs',
      'Failed to preview logs',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to preview logs' },
      { status: 500 }
    )
  }
}
