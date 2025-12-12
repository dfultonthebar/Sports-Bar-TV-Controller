import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

// GET /api/matrix/current-channels - Get current channel info for all inputs
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Get all current channel records
    const currentChannels = await db
      .select()
      .from(schema.inputCurrentChannels)
      .all()

    // Transform into a map for easy lookup by input number
    const channelMap: Record<number, {
      channelNumber: string
      channelName: string | null
      deviceType: string
      inputLabel: string
      lastTuned: string
    }> = {}

    currentChannels.forEach(channel => {
      channelMap[channel.inputNum] = {
        channelNumber: channel.channelNumber,
        channelName: channel.channelName,
        deviceType: channel.deviceType,
        inputLabel: channel.inputLabel,
        lastTuned: channel.lastTuned
      }
    })

    return NextResponse.json({
      success: true,
      channels: channelMap,
      count: currentChannels.length
    })
  } catch (error) {
    logger.error('[Current Channels] Error fetching current channels:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch current channel information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
