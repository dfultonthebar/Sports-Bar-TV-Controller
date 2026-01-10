import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)

    // Query parameters
    const controllerId = searchParams.get('controllerId')
    const actionType = searchParams.get('actionType')
    const triggeredBy = searchParams.get('triggeredBy')
    const successOnly = searchParams.get('success') === 'true'
    const failuresOnly = searchParams.get('failures') === 'true'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let logs = await db.select()
      .from(schema.dmxExecutionLogs)
      .orderBy(desc(schema.dmxExecutionLogs.executedAt))
      .all()

    // Filter in JS (drizzle-orm sqlite has limited WHERE support for multiple conditions)
    let filtered = logs

    if (controllerId) {
      filtered = filtered.filter(log => log.controllerId === controllerId)
    }

    if (actionType) {
      filtered = filtered.filter(log => log.actionType === actionType)
    }

    if (triggeredBy) {
      filtered = filtered.filter(log => log.triggeredBy === triggeredBy)
    }

    if (successOnly) {
      filtered = filtered.filter(log => log.success === true)
    }

    if (failuresOnly) {
      filtered = filtered.filter(log => log.success === false)
    }

    if (startDate) {
      const start = new Date(startDate).toISOString()
      filtered = filtered.filter(log => log.executedAt >= start)
    }

    if (endDate) {
      const end = new Date(endDate).toISOString()
      filtered = filtered.filter(log => log.executedAt <= end)
    }

    // Get total count before pagination
    const totalCount = filtered.length

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit)

    // Parse metadata JSON
    const parsed = paginated.map(log => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }))

    // Calculate statistics
    const stats = {
      total: totalCount,
      successful: filtered.filter(l => l.success).length,
      failed: filtered.filter(l => !l.success).length,
      byActionType: {} as Record<string, number>,
      byTriggeredBy: {} as Record<string, number>,
    }

    for (const log of filtered) {
      stats.byActionType[log.actionType] = (stats.byActionType[log.actionType] || 0) + 1
      if (log.triggeredBy) {
        stats.byTriggeredBy[log.triggeredBy] = (stats.byTriggeredBy[log.triggeredBy] || 0) + 1
      }
    }

    return NextResponse.json({
      success: true,
      logs: parsed,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      stats,
    })
  } catch (error) {
    logger.error('[DMX] Error loading execution logs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load logs' },
      { status: 500 }
    )
  }
}
