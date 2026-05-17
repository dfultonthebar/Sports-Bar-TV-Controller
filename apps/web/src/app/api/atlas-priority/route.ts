import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

type EventRow = {
  id: string
  processor_id: string
  event_type: 'source_override' | 'mic_active'
  zone_number: number | null
  zone_name: string | null
  previous_source: number | null
  new_source: number | null
  input_index: number | null
  input_name: string | null
  input_level_db: number | null
  detected_at: number
}

const ACTIVE_WINDOW_SECS = 30

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const onlyActive = searchParams.get('active') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 500)
    const nowSec = Math.floor(Date.now() / 1000)
    const cutoff = nowSec - ACTIVE_WINDOW_SECS

    const rows = await db.all<EventRow>(sql`
      SELECT id, processor_id, event_type, zone_number, zone_name,
             previous_source, new_source, input_index, input_name,
             input_level_db, detected_at
      FROM atlas_priority_events
      WHERE 1=1
        ${onlyActive ? sql`AND detected_at >= ${cutoff}` : sql``}
      ORDER BY detected_at DESC
      LIMIT ${limit}
    `)

    const events = rows.map((r) => ({
      ...r,
      detected_at_iso: new Date(r.detected_at * 1000).toISOString(),
      seconds_ago: nowSec - r.detected_at,
    }))

    // Summary for UI badge — is anything currently active?
    const activeRows = rows.filter((r) => r.detected_at >= cutoff)
    const activeMics = Array.from(new Set(
      activeRows.filter((r) => r.event_type === 'mic_active').map((r) => r.input_name).filter(Boolean)
    ))
    const overriddenZones = Array.from(new Set(
      activeRows.filter((r) => r.event_type === 'source_override').map((r) => r.zone_name).filter(Boolean)
    ))

    return NextResponse.json({
      success: true,
      active: activeRows.length > 0,
      activeMics,
      overriddenZones,
      windowSeconds: ACTIVE_WINDOW_SECS,
      count: events.length,
      events,
    })
  } catch (err) {
    logger.error('[ATLAS-PRIORITY] Failed to query atlas_priority_events:', err)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
