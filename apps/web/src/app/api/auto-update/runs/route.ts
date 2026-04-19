/**
 * GET /api/auto-update/runs
 * List recent auto-update runs (parsed from local log files).
 */
import { NextRequest, NextResponse } from 'next/server'
import { listRuns } from '@/lib/auto-update/log-parser'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 200)

  try {
    const runs = listRuns(limit)
    return NextResponse.json({ runs, generatedAt: new Date().toISOString() })
  } catch (err: any) {
    logger.error('[AUTO-UPDATE-RUNS] list error:', err)
    return NextResponse.json({ success: false, error: err.message || 'List failed' }, { status: 500 })
  }
}
