import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

type DropRow = {
  id: string
  processor_id: string
  zone_number: number
  zone_name: string | null
  previous_volume: number
  new_volume: number
  delta: number
  source_at_drop: number | null
  muted_at_drop: number
  gap_seconds: number
  explained: number
  detected_at: number
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500)
    const onlySilent = searchParams.get('silent') === 'true'
    const zone = searchParams.get('zone')

    const rows = await db.all<DropRow>(sql`
      SELECT id, processor_id, zone_number, zone_name,
             previous_volume, new_volume, delta,
             source_at_drop, muted_at_drop, gap_seconds,
             explained, detected_at
      FROM atlas_drop_events
      WHERE 1=1
        ${onlySilent ? sql`AND explained = 0` : sql``}
        ${zone ? sql`AND zone_number = ${parseInt(zone, 10)}` : sql``}
      ORDER BY detected_at DESC
      LIMIT ${limit}
    `)

    return NextResponse.json({
      success: true,
      count: rows.length,
      drops: rows.map((r) => ({
        ...r,
        muted_at_drop: r.muted_at_drop === 1,
        explained: r.explained === 1,
        detected_at_iso: new Date(r.detected_at * 1000).toISOString(),
      })),
    })
  } catch (err) {
    logger.error('[ATLAS-DROPS] Failed to query atlas_drop_events:', err)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
