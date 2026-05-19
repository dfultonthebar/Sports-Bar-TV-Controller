/**
 * POST /api/neighborhood/ingest/bananas
 *
 * Manual trigger for the Bananas Entertainment ingestion sweep. The
 * scheduler runs this every 6 hours automatically; this endpoint exists
 * for testing, debugging, and operator-initiated re-pulls (e.g. after
 * adding a venue that previously caused skips).
 *
 * Auth: ADMIN.
 * Rate limit: DATABASE_WRITE — this issues UPSERTs, and the underlying
 *             scraper hits an external site we don't want to hammer.
 *
 * Response shape mirrors the BananasIngestionStats interface returned by
 * the underlying ingestion module, plus an audit pointer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { runBananasIngestion } from '@sports-bar/scheduler'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'NEIGHBORHOOD_INGEST_BANANAS',
    auditResource: 'neighborhood-events',
  })
  if (!authResult.allowed) return authResult.response!

  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  const startMs = Date.now()
  try {
    logger.info('[NEIGHBORHOOD-INGEST-BANANAS] Manual ingestion triggered', {
      data: {
        role: authResult.role,
        sessionId: authResult.sessionId,
      },
    })

    const stats = await runBananasIngestion()
    const durationMs = Date.now() - startMs

    return NextResponse.json({
      success: true,
      durationMs,
      stats,
    })
  } catch (err: any) {
    const durationMs = Date.now() - startMs
    logger.error('[NEIGHBORHOOD-INGEST-BANANAS] Manual ingestion failed:', err)
    return NextResponse.json(
      {
        success: false,
        durationMs,
        error: err?.message || String(err),
      },
      { status: 500 },
    )
  }
}
