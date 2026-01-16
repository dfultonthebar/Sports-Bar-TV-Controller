/**
 * Scheduler Logs API
 * GET /api/scheduler/logs - Query scheduler logs with filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, schema, eq, and, desc, gte, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const hours = parseInt(searchParams.get('hours') || '24', 10)
    const component = searchParams.get('component')
    const operation = searchParams.get('operation')
    const level = searchParams.get('level')
    const correlationId = searchParams.get('correlationId')
    const success = searchParams.get('success')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500)

    // Calculate time boundary
    const now = Math.floor(Date.now() / 1000)
    const sinceTime = now - (hours * 60 * 60)

    // Build query conditions
    const conditions: any[] = [
      gte(schema.schedulerLogs.createdAt, sinceTime),
    ]

    if (component) {
      conditions.push(eq(schema.schedulerLogs.component, component))
    }

    if (operation) {
      conditions.push(eq(schema.schedulerLogs.operation, operation))
    }

    if (level) {
      conditions.push(eq(schema.schedulerLogs.level, level))
    }

    if (correlationId) {
      conditions.push(eq(schema.schedulerLogs.correlationId, correlationId))
    }

    if (success !== null && success !== undefined) {
      const successBool = success === 'true'
      conditions.push(eq(schema.schedulerLogs.success, successBool))
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.schedulerLogs)
      .where(and(...conditions))

    const totalCount = countResult[0]?.count || 0

    // Get paginated logs
    const offset = (page - 1) * limit
    const logs = await db
      .select()
      .from(schema.schedulerLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.schedulerLogs.createdAt))
      .limit(limit)
      .offset(offset)

    // Format logs for response
    const formattedLogs = logs.map(log => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      createdAtFormatted: new Date(log.createdAt * 1000).toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: page * limit < totalCount,
        },
        filters: {
          hours,
          component,
          operation,
          level,
          correlationId,
          success,
        },
      },
    })
  } catch (error: any) {
    logger.error('[SCHEDULER-LOGS-API] Error fetching logs:', { error })
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
