/**
 * Audit Log API Endpoint (Admin Only)
 *
 * GET /api/auth/audit-log - Get audit logs with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuditLogs, getAuditLogStats, exportAuditLogs, requireAuth } from '@/lib/auth'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Require ADMIN role
  const authCheck = await requireAuth(request, 'ADMIN')
  if (!authCheck.allowed) {
    return authCheck.response!
  }

  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const filters = {
      sessionId: searchParams.get('sessionId') || undefined,
      apiKeyId: searchParams.get('apiKeyId') || undefined,
      action: searchParams.get('action') || undefined,
      resource: searchParams.get('resource') || undefined,
      success: searchParams.get('success') ? searchParams.get('success') === 'true' : undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    }

    const export_format = searchParams.get('export')

    if (export_format === 'json') {
      const exportData = await exportAuditLogs(filters)

      return new NextResponse(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename=audit-log-${new Date().toISOString()}.json`,
        },
      })
    }

    const logs = await getAuditLogs(filters)

    // Get stats if requested
    const includeStats = searchParams.get('stats') === 'true'
    let stats = undefined

    if (includeStats) {
      stats = await getAuditLogStats(
        undefined,
        filters.startDate,
        filters.endDate
      )
    }

    return NextResponse.json({
      success: true,
      logs,
      stats,
      filters: {
        ...filters,
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
      },
    })
  } catch (error) {
    logger.error('Error getting audit logs:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to get audit logs' },
      { status: 500 }
    )
  }
}
