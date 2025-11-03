/**
 * CEC Command Statistics API
 *
 * GET /api/cec/cable-box/stats
 * Get command statistics for all cable boxes
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Get overall statistics
    const overallStats = await db
      .select({
        totalCommands: sql<number>`COUNT(*)`,
        successfulCommands: sql<number>`SUM(CASE WHEN ${schema.cecCommandLogs.success} = 1 THEN 1 ELSE 0 END)`,
        failedCommands: sql<number>`SUM(CASE WHEN ${schema.cecCommandLogs.success} = 0 THEN 1 ELSE 0 END)`,
        avgResponseTime: sql<number>`AVG(${schema.cecCommandLogs.responseTime})`,
      })
      .from(schema.cecCommandLogs)
      .execute()

    // Get per-device statistics
    const deviceStats = await db
      .select({
        deviceId: schema.cecCommandLogs.cecDeviceId,
        totalCommands: sql<number>`COUNT(*)`,
        successfulCommands: sql<number>`SUM(CASE WHEN ${schema.cecCommandLogs.success} = 1 THEN 1 ELSE 0 END)`,
        avgResponseTime: sql<number>`AVG(${schema.cecCommandLogs.responseTime})`,
      })
      .from(schema.cecCommandLogs)
      .groupBy(schema.cecCommandLogs.cecDeviceId)
      .execute()

    // Get most used commands
    const popularCommands = await db
      .select({
        command: schema.cecCommandLogs.command,
        count: sql<number>`COUNT(*)`,
        successRate: sql<number>`(SUM(CASE WHEN ${schema.cecCommandLogs.success} = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*))`,
      })
      .from(schema.cecCommandLogs)
      .groupBy(schema.cecCommandLogs.command)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10)
      .execute()

    return NextResponse.json({
      success: true,
      stats: {
        overall: overallStats[0] || {
          totalCommands: 0,
          successfulCommands: 0,
          failedCommands: 0,
          avgResponseTime: 0,
        },
        byDevice: deviceStats,
        popularCommands,
      },
    })
  } catch (error: any) {
    console.error('[API] Error fetching stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch statistics',
        stats: {
          overall: {
            totalCommands: 0,
            successfulCommands: 0,
            failedCommands: 0,
            avgResponseTime: 0,
          },
          byDevice: [],
          popularCommands: [],
        },
      },
      { status: 500 }
    )
  }
}
