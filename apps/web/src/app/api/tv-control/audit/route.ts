import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db, schema } from '@/db'
import { and, desc, eq, gte, like, or, sql } from 'drizzle-orm'

// GET /api/tv-control/audit?hours=24&action=off
//
// Returns TV power events from the AuditLog table so end-of-night bulk
// power-offs and morning power-ons are inspectable forever, not just
// until PM2 rotates its stdout logs. Scoped to resource='tv_power'.
//
// Query params:
//   hours    default 24, max 720 (30 days) — how far back to look
//   action   optional: 'on' | 'off' | 'toggle' | 'all' (default 'all')
//   limit    default 100, max 500
//
// Response rows are sorted newest-first. Each row's `metadata` is the
// parsed JSON of the audit metadata column (devices, success counts, etc).
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const url = new URL(request.url)
    const hours = Math.min(Math.max(parseInt(url.searchParams.get('hours') || '24', 10), 1), 720)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10), 1), 500)
    const actionParam = (url.searchParams.get('action') || 'all').toLowerCase()

    const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const whereParts: any[] = [
      eq(schema.auditLogs.resource, 'tv_power'),
      gte(schema.auditLogs.timestamp, sinceIso),
    ]

    // Narrow by action family. 'off' matches TV_POWER_OFF and
    // TV_POWER_BULK_OFF; 'on' matches both on variants.
    if (actionParam === 'on') {
      whereParts.push(or(
        eq(schema.auditLogs.action, 'TV_POWER_ON'),
        eq(schema.auditLogs.action, 'TV_POWER_BULK_ON'),
      )!)
    } else if (actionParam === 'off') {
      whereParts.push(or(
        eq(schema.auditLogs.action, 'TV_POWER_OFF'),
        eq(schema.auditLogs.action, 'TV_POWER_BULK_OFF'),
      )!)
    } else if (actionParam === 'toggle') {
      whereParts.push(or(
        eq(schema.auditLogs.action, 'TV_POWER_TOGGLE'),
        eq(schema.auditLogs.action, 'TV_POWER_BULK_TOGGLE'),
      )!)
    }

    const rows = await db
      .select()
      .from(schema.auditLogs)
      .where(and(...whereParts))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)

    const events = rows.map(row => {
      let metadata: any = null
      try { metadata = row.metadata ? JSON.parse(row.metadata) : null } catch {}
      let requestData: any = null
      try { requestData = row.requestData ? JSON.parse(row.requestData) : null } catch {}
      return {
        id: row.id,
        timestamp: row.timestamp,
        action: row.action,
        resourceId: row.resourceId,
        endpoint: row.endpoint,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        success: row.success,
        errorMessage: row.errorMessage,
        requestData,
        metadata,
      }
    })

    return NextResponse.json({
      success: true,
      hours,
      action: actionParam,
      count: events.length,
      events,
    })
  } catch (error: any) {
    logger.error('[TV-CONTROL] audit query failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Audit query failed' },
      { status: 500 },
    )
  }
}
