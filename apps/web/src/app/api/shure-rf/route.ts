/**
 * GET /api/shure-rf
 *
 * Read access to the shure_rf_events audit table. Powers the bartender
 * RF-interference banner + an operator-facing history view.
 *
 * Query params:
 *   ?active=true   — only events in the last ACTIVE_WINDOW_SECS (30s)
 *                    + summary fields for the banner
 *   ?limit=50      — paginate (default 50, max 500)
 *   ?receiver=ID   — filter to one receiver
 *   ?channel=N     — filter to one channel
 *
 * Mirrors /api/atlas-priority's response shape so the bartender Audio
 * tab can poll both endpoints with the same parser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

type EventRow = {
  id: string
  receiver_id: string
  receiver_name: string | null
  ip_address: string | null
  channel: number
  event_type: string
  rssi_dbm: number | null
  frequency_mhz: number | null
  tx_type: string | null
  note: string | null
  detected_at: number
}

const ACTIVE_WINDOW_SECS = 30

const ACTIVE_EVENT_TYPES = new Set([
  'rf_interference',
  'rf_interference_heartbeat',
])

export async function GET(request: NextRequest) {
  // HARDWARE bucket — same reasoning as /api/shure-rf/status.
  // The admin page also polls /api/shure-rf?active=true every 10s
  // (6/min) and the bartender banner polls active events similarly;
  // they all share the same default budget unless we split them out.
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const onlyActive = searchParams.get('active') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 500)
    const receiver = searchParams.get('receiver')
    const channelStr = searchParams.get('channel')
    const channel = channelStr ? parseInt(channelStr, 10) : null

    const nowSec = Math.floor(Date.now() / 1000)
    const cutoff = nowSec - ACTIVE_WINDOW_SECS

    const rows = await db.all<EventRow>(sql`
      SELECT id, receiver_id, receiver_name, ip_address, channel, event_type,
             rssi_dbm, frequency_mhz, tx_type, note, detected_at
      FROM shure_rf_events
      WHERE 1=1
        ${onlyActive ? sql`AND detected_at >= ${cutoff}` : sql``}
        ${receiver ? sql`AND receiver_id = ${receiver}` : sql``}
        ${channel !== null && Number.isFinite(channel) ? sql`AND channel = ${channel}` : sql``}
      ORDER BY detected_at DESC
      LIMIT ${limit}
    `)

    const events = rows.map((r) => ({
      ...r,
      detected_at_iso: new Date(r.detected_at * 1000).toISOString(),
      seconds_ago: nowSec - r.detected_at,
    }))

    // Build summary for banner consumption — collapse heartbeats per
    // receiver:channel and only count rows whose event_type indicates
    // currently-hot RF.
    const activeRows = rows.filter(
      (r) => r.detected_at >= cutoff && ACTIVE_EVENT_TYPES.has(r.event_type),
    )
    const seen = new Set<string>()
    const activeChannels = activeRows
      .filter((r) => {
        const k = `${r.receiver_id}:${r.channel}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((r) => ({
        receiverId: r.receiver_id,
        receiverName: r.receiver_name,
        channel: r.channel,
        frequencyMhz: r.frequency_mhz,
        rssiDbm: r.rssi_dbm,
        secondsAgo: nowSec - r.detected_at,
      }))

    return NextResponse.json({
      success: true,
      active: activeChannels.length > 0,
      activeChannels,
      windowSeconds: ACTIVE_WINDOW_SECS,
      count: events.length,
      events,
    })
  } catch (err) {
    logger.error('[SHURE-RF] Failed to query shure_rf_events:', err)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}
