/**
 * Scheduler Metrics API
 * GET /api/scheduler/metrics - Get aggregated scheduler metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, schema, eq, and, desc, gte, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24', 10)

    const now = Math.floor(Date.now() / 1000)
    const sinceTime = now - (hours * 60 * 60)
    const lastHour = now - 3600

    // Get hourly metrics for the time period
    const hourlyMetrics = await db
      .select()
      .from(schema.schedulerMetrics)
      .where(gte(schema.schedulerMetrics.periodStart, sinceTime * 1000)) // periodStart is in ms
      .orderBy(desc(schema.schedulerMetrics.periodStart))

    // Get logs summary for last hour by component
    const componentBreakdown = await db
      .select({
        component: schema.schedulerLogs.component,
        successCount: sql<number>`SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END)`,
        failureCount: sql<number>`SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END)`,
        totalCount: sql<number>`COUNT(*)`,
        avgDuration: sql<number>`AVG(durationMs)`,
      })
      .from(schema.schedulerLogs)
      .where(gte(schema.schedulerLogs.createdAt, lastHour))
      .groupBy(schema.schedulerLogs.component)

    // Get logs summary for last hour by operation
    const operationBreakdown = await db
      .select({
        operation: schema.schedulerLogs.operation,
        successCount: sql<number>`SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END)`,
        failureCount: sql<number>`SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END)`,
        totalCount: sql<number>`COUNT(*)`,
        avgDuration: sql<number>`AVG(durationMs)`,
      })
      .from(schema.schedulerLogs)
      .where(gte(schema.schedulerLogs.createdAt, lastHour))
      .groupBy(schema.schedulerLogs.operation)

    // Get recent errors
    const recentErrors = await db
      .select()
      .from(schema.schedulerLogs)
      .where(
        and(
          gte(schema.schedulerLogs.createdAt, sinceTime),
          eq(schema.schedulerLogs.level, 'error')
        )
      )
      .orderBy(desc(schema.schedulerLogs.createdAt))
      .limit(10)

    // Calculate overall stats from logs
    const overallStats = await db
      .select({
        totalCount: sql<number>`COUNT(*)`,
        successCount: sql<number>`SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END)`,
        failureCount: sql<number>`SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END)`,
        avgDuration: sql<number>`AVG(durationMs)`,
        minDuration: sql<number>`MIN(durationMs)`,
        maxDuration: sql<number>`MAX(durationMs)`,
      })
      .from(schema.schedulerLogs)
      .where(gte(schema.schedulerLogs.createdAt, sinceTime))

    const stats = overallStats[0] || {
      totalCount: 0,
      successCount: 0,
      failureCount: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
    }
    const successRate = stats.totalCount > 0
      ? ((stats.successCount || 0) / stats.totalCount * 100).toFixed(1)
      : '0.0'

    return NextResponse.json({
      success: true,
      data: {
        period: {
          hours,
          sinceTime,
          sinceTimeFormatted: new Date(sinceTime * 1000).toISOString(),
        },
        summary: {
          totalOperations: stats.totalCount || 0,
          successCount: stats.successCount || 0,
          failureCount: stats.failureCount || 0,
          successRate: parseFloat(successRate),
          avgDurationMs: Math.round(stats.avgDuration || 0),
          minDurationMs: stats.minDuration || 0,
          maxDurationMs: stats.maxDuration || 0,
        },
        byComponent: componentBreakdown.map(c => ({
          component: c.component,
          successCount: c.successCount || 0,
          failureCount: c.failureCount || 0,
          totalCount: c.totalCount || 0,
          avgDurationMs: Math.round(c.avgDuration || 0),
        })),
        byOperation: operationBreakdown.map(o => ({
          operation: o.operation,
          successCount: o.successCount || 0,
          failureCount: o.failureCount || 0,
          totalCount: o.totalCount || 0,
          avgDurationMs: Math.round(o.avgDuration || 0),
        })),
        hourlyMetrics: hourlyMetrics.map(m => ({
          ...m,
          componentBreakdown: m.componentBreakdown ? JSON.parse(m.componentBreakdown) : null,
          periodStartFormatted: new Date(m.periodStart).toISOString(),
        })),
        recentErrors: recentErrors.map(e => ({
          id: e.id,
          correlationId: e.correlationId,
          component: e.component,
          operation: e.operation,
          message: e.message,
          errorMessage: e.errorMessage,
          createdAt: e.createdAt,
          createdAtFormatted: new Date(e.createdAt * 1000).toISOString(),
        })),
      },
    })
  } catch (error: any) {
    logger.error('[SCHEDULER-METRICS-API] Error fetching metrics:', { error })
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
