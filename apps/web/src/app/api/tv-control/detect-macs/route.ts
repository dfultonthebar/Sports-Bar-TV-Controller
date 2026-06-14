import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { backfillMissingMacs } from '@/lib/mac-discovery'
import { logger } from '@sports-bar/logger'

/**
 * POST /api/tv-control/detect-macs
 *
 * On-demand MAC auto-discovery for NetworkTVDevice rows that are missing a
 * macAddress. Pings each candidate to populate the ARP cache, reads the MAC
 * back, and persists it. Optional body: { deviceId } to target one TV.
 * (Also runs automatically on a 30-min schedule from instrumentation.ts.)
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const body = await request.json().catch(() => ({} as any))
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : undefined

    const summary = await backfillMissingMacs(deviceId)

    const message =
      summary.checked === 0
        ? 'All TVs already have a MAC address — nothing to detect.'
        : `Detected ${summary.filled} of ${summary.checked} missing MAC(s). ${
            summary.checked - summary.filled
          } TV(s) were unreachable (powered off or not on this network).`

    return NextResponse.json({ success: true, message, ...summary })
  } catch (error: any) {
    logger.error('[MAC-DISCOVERY] detect-macs failed:', error)
    return NextResponse.json(
      { success: false, error: 'MAC detection failed: ' + (error?.message || 'unknown error') },
      { status: 500 }
    )
  }
}
