/**
 * Philips Hue Bridge Discovery API
 * POST /api/commercial-lighting/hue/discover - Discover Hue bridges on network
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { HueClient } from '@sports-bar/commercial-lighting'

// POST - Discover Hue bridges
export async function POST() {
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
