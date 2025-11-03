
/**
 * API Route: Launch Streaming App
 *
 * Launches a streaming app on a Fire TV device
 */

import { NextRequest, NextResponse } from 'next/server'
import { streamingManager } from '@/services/streaming-service-manager'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const SUBSCRIBED_APPS_FILE = join(process.cwd(), 'data', 'subscribed-streaming-apps.json')

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const {
      deviceId,
      ipAddress,
      appId,
      port = 5555,
      deepLink,
      activityName: providedActivityName
    } = body

    if (!deviceId || !ipAddress || !appId) {
      return NextResponse.json(
        { error: 'deviceId, ipAddress, and appId are required' },
        { status: 400 }
      )
    }

    console.log(`[API] Launching app ${appId} on device ${deviceId}`)

    // Try to get activity name from subscribed apps config if not provided
    let activityName = providedActivityName
    if (!activityName) {
      try {
        const data = await readFile(SUBSCRIBED_APPS_FILE, 'utf-8')
        const config = JSON.parse(data)
        const appConfig = config.subscribedApps.find((app: any) => app.appId === appId)
        if (appConfig?.activityName) {
          activityName = appConfig.activityName
          console.log(`[API] Using activity name from config: ${activityName}`)
        }
      } catch (error) {
        console.log('[API] Could not load activity name from config')
      }
    }

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
