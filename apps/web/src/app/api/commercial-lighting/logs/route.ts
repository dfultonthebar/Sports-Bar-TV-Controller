/**
 * Commercial Lighting Logs API
 * GET /api/commercial-lighting/logs - Query execution logs
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET - Query logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const systemId = searchParams.get('systemId')
    const actionType = searchParams.get('actionType')
    const targetId = searchParams.get('targetId')
    const triggeredBy = searchParams.get('triggeredBy')
    const successOnly = searchParams.get('successOnly') === 'true'
    const failedOnly = searchParams.get('failedOnly') === 'true'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query with joins
    const logs = await db
      .select({
        id: schema.commercialLightingLogs.id,
        systemId: schema.commercialLightingLogs.systemId,
        actionType: schema.commercialLightingLogs.actionType,
        targetId: schema.commercialLightingLogs.targetId,
        targetName: schema.commercialLightingLogs.targetName,
        value: schema.commercialLightingLogs.value,
        success: schema.commercialLightingLogs.success,
        errorMessage: schema.commercialLightingLogs.errorMessage,
        triggeredBy: schema.commercialLightingLogs.triggeredBy,
        metadata: schema.commercialLightingLogs.metadata,
        executedAt: schema.commercialLightingLogs.executedAt,
        systemName: schema.commercialLightingSystems.name,
        systemType: schema.commercialLightingSystems.systemType,
      })
      .from(schema.commercialLightingLogs)
      .leftJoin(
        schema.commercialLightingSystems,
        eq(schema.commercialLightingLogs.systemId, schema.commercialLightingSystems.id)
      )
      .orderBy(desc(schema.commercialLightingLogs.executedAt))
      .limit(limit)
      .offset(offset)

    // Filter in JS (drizzle-orm chaining can be complex)
    let filtered = logs

    if (systemId) {
      filtered = filtered.filter(l => l.systemId === systemId)
    }
    if (actionType) {
      filtered = filtered.filter(l => l.actionType === actionType)
    }
    if (targetId) {
      filtered = filtered.filter(l => l.targetId === targetId)
    }
    if (triggeredBy) {
      filtered = filtered.filter(l => l.triggeredBy === triggeredBy)
    }
    if (successOnly) {
      filtered = filtered.filter(l => l.success)
    }
    if (failedOnly) {
      filtered = filtered.filter(l => !l.success)
    }
    if (startDate) {
      filtered = filtered.filter(l => l.executedAt && l.executedAt >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter(l => l.executedAt && l.executedAt <= endDate)
    }

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.commercialLightingLogs)
      .get()

    // Get summary stats
    const stats = await db
      .select({
        totalLogs: sql<number>`count(*)`,
        successCount: sql<number>`sum(case when success = 1 then 1 else 0 end)`,
        failureCount: sql<number>`sum(case when success = 0 then 1 else 0 end)`,
      })
      .from(schema.commercialLightingLogs)
      .get()

    // Parse metadata and value fields
    const parsedLogs = filtered.map(log => ({
      ...log,
      value: log.value ? tryParseJson(log.value) : null,
      metadata: log.metadata ? tryParseJson(log.metadata) : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        logs: parsedLogs,
        pagination: {
          limit,
          offset,
          total: totalCount?.count || 0,
          hasMore: offset + filtered.length < (totalCount?.count || 0),
        },
        stats: {
          total: stats?.totalLogs || 0,
          success: stats?.successCount || 0,
          failure: stats?.failureCount || 0,
          successRate: stats?.totalLogs
            ? ((stats.successCount || 0) / stats.totalLogs * 100).toFixed(1) + '%'
            : '0%',
        },
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch logs', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}

function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}
