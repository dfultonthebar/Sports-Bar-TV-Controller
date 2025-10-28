
/**
 * API Route: Launch Streaming App
 * 
 * Launches a streaming app on a Fire TV device
 */

import { NextRequest, NextResponse } from 'next/server'
import { streamingManager } from '@/services/streaming-service-manager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      deviceId, 
      ipAddress, 
      appId, 
      port = 5555,
      deepLink,
      activityName 
    } = body

    if (!deviceId || !ipAddress || !appId) {
      return NextResponse.json(
        { error: 'deviceId, ipAddress, and appId are required' },
        { status: 400 }
      )
    }

    console.log(`[API] Launching app ${appId} on device ${deviceId}`)

    const success = await streamingManager.launchApp(
      deviceId,
      ipAddress,
      appId,
      {
        deepLink,
        activityName
      },
      port
    )

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Successfully launched app ${appId}`,
        deviceId,
        appId
      })
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: `Failed to launch app ${appId}`,
          deviceId,
          appId
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[API] Error launching app:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to launch app',
        message: error.message
      },
      { status: 500 }
    )
  }
}
