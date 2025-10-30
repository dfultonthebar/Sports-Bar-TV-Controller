/**
 * Cable Box Channel Tuning API
 *
 * POST /api/cec/cable-box/tune
 * Tune a cable box to a specific channel
 */

import { NextRequest, NextResponse } from 'next/server'
import { CableBoxCECService } from '@/lib/cable-box-cec-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cableBoxId, channel } = body

    // Validate input
    if (!cableBoxId) {
      return NextResponse.json(
        {
          success: false,
          error: 'cableBoxId is required',
        },
        { status: 400 }
      )
    }

    if (!channel) {
      return NextResponse.json(
        {
          success: false,
          error: 'channel is required',
        },
        { status: 400 }
      )
    }

    // Validate channel format (numbers and optional dot for sub-channels)
    if (!/^[0-9.]+$/.test(channel)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid channel format. Use numbers only (e.g., "206" or "2.1")',
        },
        { status: 400 }
      )
    }

    console.log(`[API] Tuning cable box ${cableBoxId} to channel ${channel}`)

    const cecService = CableBoxCECService.getInstance()
    const result = await cecService.tuneChannel(cableBoxId, channel)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully tuned to channel ${channel}${result.deviceResponded ? ' (device acknowledged)' : ' (command sent)'}`,
        executionTime: result.executionTime,
        deviceResponded: result.deviceResponded,
        channel,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to tune channel',
          executionTime: result.executionTime,
          deviceResponded: result.deviceResponded,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[API] Error tuning channel:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to tune channel',
      },
      { status: 500 }
    )
  }
}
