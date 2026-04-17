import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { refreshSamsungModelCatalog } from '@/lib/samsung-model-probe'

// POST /api/tv-discovery/probe-models
// Walk every Samsung TV in the DB, probe :8001/api/v2/, and update the
// model column with the live modelName. Safe to call on demand or from a
// background scheduler. Returns a summary of what changed.
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const result = await refreshSamsungModelCatalog()
    logger.info(
      `[TV-DISCOVERY] Samsung model refresh: probed=${result.probed}, updated=${result.updated}, unreachable=${result.unreachable}`
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    logger.error('[TV-DISCOVERY] probe-models failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Model probe failed' },
      { status: 500 }
    )
  }
}
