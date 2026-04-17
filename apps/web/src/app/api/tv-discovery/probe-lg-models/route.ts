import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { refreshLGModelCatalog } from '@/lib/lg-model-probe'

// POST /api/tv-discovery/probe-lg-models
// Walk every LG TV in the DB, probe via SSAP getSystemInfo on port 3001,
// and update the model column with the live modelName. Parallel to the
// Samsung /probe-models endpoint. Returns a summary of what changed.
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const result = await refreshLGModelCatalog()
    logger.info(
      `[TV-DISCOVERY] LG model refresh: probed=${result.probed}, updated=${result.updated}, unreachable=${result.unreachable}`,
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    logger.error('[TV-DISCOVERY] probe-lg-models failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'LG model probe failed' },
      { status: 500 },
    )
  }
}
