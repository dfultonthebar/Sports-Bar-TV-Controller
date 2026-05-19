import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

type EventRow = {
  id: string
  processor_id: string
  event_type: 'source_override' | 'mic_active' | 'rf_induced_mic_active' | 'mic_cleared'
  zone_number: number | null
  zone_name: string | null
  previous_source: number | null
  new_source: number | null
  input_index: number | null
  input_name: string | null
  input_level_db: number | null
  detected_at: number
}

const MIC_ON_TYPES = new Set(['mic_active', 'rf_induced_mic_active'])

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

    // Summary for UI badge — per-input latest-state rather than
    // "any row in window". Otherwise a stale heartbeat row hung
    // around for ~20s after the mic went silent before the banner
    // cleared (Holmgren 2026-05-18 operator complaint). With this:
    // a mic_cleared row on the falling edge immediately voids any
    // earlier mic_active/heartbeat rows for the same input.
    const activeRows = rows.filter((r) => r.detected_at >= cutoff)
    const latestByInput = new Map<number, EventRow>()
    for (const r of activeRows) {
      if (r.input_index === null) continue
      if (!latestByInput.has(r.input_index)) latestByInput.set(r.input_index, r)
    }
    const activeMics = Array.from(new Set(
      Array.from(latestByInput.values())
        .filter((r) => MIC_ON_TYPES.has(r.event_type))
        .map((r) => r.input_name)
        .filter(Boolean)
    ))
    const overriddenZones = Array.from(new Set(
      activeRows.filter((r) => r.event_type === 'source_override').map((r) => r.zone_name).filter(Boolean)
    ))

    return NextResponse.json({
      success: true,
      // Active = any mic currently on OR any unresolved source override.
      // Plain "rows in window" would stay true after a mic_cleared
      // row landed (since the cleared row itself is in the window).
      active: activeMics.length > 0 || overriddenZones.length > 0,
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
