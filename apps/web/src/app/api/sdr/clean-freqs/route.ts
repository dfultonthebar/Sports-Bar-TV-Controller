/**
 * GET /api/sdr/clean-freqs
 *
 * v2.52.13 (Tier 2/4 AI integration). Operator/UI on-demand endpoint
 * that returns the top-N quietest freqs in the SLX-D G58 band based
 * on the last 7 days of SDR spectrum data, excluding either the
 * currently-tuned Shure freqs (default) or an explicit exclusion set
 * passed by the caller.
 *
 * Bartender-grade copy from this endpoint (used by the UI):
 *   "Move Mic 2 to 491.2 MHz — it's been clean 99.4% of the past
 *    week (avg −88 dBm)."
 *
 * Query params:
 *   exclude=484.7,510.9     comma-separated freqs (MHz) to avoid.
 *                           If omitted, defaults to the live Shure
 *                           receiver freqs.
 *   topN=3                  how many suggestions to return (default 3)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { findCleanFreqs } from '@sports-bar/scheduler'
import { logger } from '@sports-bar/logger'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const url = new URL(request.url)
    const excludeRaw = url.searchParams.get('exclude')
    const topNRaw = url.searchParams.get('topN')
    const excludeFreqsMhz = excludeRaw
      ? excludeRaw
          .split(',')
          .map((s) => parseFloat(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
      : undefined
    const topN = topNRaw ? Math.min(10, Math.max(1, parseInt(topNRaw, 10))) : 3

    const suggestions = await findCleanFreqs({ excludeFreqsMhz, topN })

    return NextResponse.json({
      success: true,
      excludedFreqsMhz: excludeFreqsMhz ?? null,
      topN,
      suggestions,
      note:
        suggestions.length === 0
          ? 'No SDR data available yet. The watcher needs ~7 days of sweep history to score freqs reliably; freshly-installed SDRs return empty until that data accumulates.'
          : null,
    })
  } catch (err) {
    logger.error('[SDR-CLEAN-FREQS] query failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'clean-freqs query failed' },
      { status: 500 },
    )
  }
}
