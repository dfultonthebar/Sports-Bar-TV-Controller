/**
 * Scheduler Logs Export API
 * GET /api/scheduler/logs/export - Export scheduler logs as JSON file
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, schema, eq, and, desc, gte } from '@sports-bar/database'
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

    // Get all matching logs (no pagination for export)
    const logs = await db
      .select()
      .from(schema.schedulerLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.schedulerLogs.createdAt))
      .limit(10000) // Safety limit

    // Format logs for export
    const formattedLogs = logs.map(log => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      createdAtFormatted: new Date(log.createdAt * 1000).toISOString(),
    }))

    // Create export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      filters: {
        hours,
        component,
        operation,
        level,
        correlationId,
        success,
      },
      totalRecords: formattedLogs.length,
      logs: formattedLogs,
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `scheduler-logs-${timestamp}.json`

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    logger.error('[SCHEDULER-LOGS-EXPORT-API] Error exporting logs:', { error })
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
