/**
 * Philips Hue Bridge Discovery API
 * POST /api/commercial-lighting/hue/discover - Discover Hue bridges on network
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { logger } from '@sports-bar/logger'
import { HueClient } from '@sports-bar/commercial-lighting'

// POST - Discover Hue bridges
export async function POST() {
  // v2.54.46 — Grok audit pass 1+2 HIGH: this route family previously
  // bypassed auth + rate-limit. Hardware-control surface; requires STAFF.
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response
  const auth = await requireAuth(request, 'STAFF', { auditAction: 'lighting_control' })
  if (!auth.allowed) return auth.response || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const bridges = await HueClient.discoverBridges()

    logger.info('[LIGHTING] Hue bridge discovery completed', {
      count: bridges.length,
    })

    return NextResponse.json({
      success: true,
      data: {
        bridges,
        count: bridges.length,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Hue bridge discovery failed', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to discover Hue bridges' },
      { status: 500 }
    )
  }
}
