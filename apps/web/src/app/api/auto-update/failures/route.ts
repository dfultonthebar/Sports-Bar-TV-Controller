/**
 * GET /api/auto-update/failures — list known failure signatures
 * POST /api/auto-update/failures { action: 'backfill' } — scan local logs
 * POST /api/auto-update/failures { action: 'capture', runId, failedStep, reason, version? }
 *   — hook for auto-update.sh to record a new failure (called by the
 *     FAILURE-CAPTURE step added in the same release).
 */
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { captureFailedRun, backfillFromLogs, listKnownFailures } from '@/lib/auto-update/rollback-learn'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response
  try {
    const rows = await listKnownFailures(20)
    return NextResponse.json({ failures: rows })
  } catch (err: any) {
    logger.error('[ROLLBACK-LEARN] GET error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response
  try {
    const body = await request.json()
    if (body.action === 'backfill') {
      const result = await backfillFromLogs()
      return NextResponse.json({ success: true, ...result })
    }
    if (body.action === 'capture') {
      if (!body.runId || !body.failedStep || !body.reason) {
        return NextResponse.json({ success: false, error: 'Missing runId/failedStep/reason' }, { status: 400 })
      }
      await captureFailedRun(body.runId, body.failedStep, body.reason, body.version ?? null)
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    logger.error('[ROLLBACK-LEARN] POST error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Failed' }, { status: 500 })
  }
}
