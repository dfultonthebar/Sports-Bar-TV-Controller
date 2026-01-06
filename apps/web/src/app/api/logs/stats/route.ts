

import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Get recent logs for analysis
    const recentLogs = await enhancedLogger.getRecentLogs(24) // Last 24 hours
    const analytics = await enhancedLogger.getLogAnalytics(24)

    // Calculate categories distribution
    const categories = recentLogs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Calculate recent activity (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const recentActivity = recentLogs.filter(log => log.timestamp > oneHourAgo).length

    // Determine system health
    let systemHealth: 'good' | 'warning' | 'critical' = 'good'
    if (analytics.errorRate > 15) {
      systemHealth = 'critical'
    } else if (analytics.errorRate > 5 || analytics.performanceMetrics.averageResponseTime > 3000) {
      systemHealth = 'warning'
    }

    const stats = {
      totalLogs: analytics.totalLogs,
      errorRate: analytics.errorRate,
      categories,
      recentActivity,
      systemHealth,
      lastUpdated: new Date().toISOString()
    }

    // Log the stats request
    await enhancedLogger.info(
      'api',
      'log-stats-api',
      'fetch_stats',
      'Log statistics requested',
      stats
    )

    return NextResponse.json(stats)
  } catch (error) {
    logger.error('Failed to get log stats:', error)
    
    await enhancedLogger.error(
      'api',
      'log-stats-api',
      'fetch_stats',
      'Failed to fetch log statistics',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to fetch log statistics' },
      { status: 500 }
    )
  }
}
