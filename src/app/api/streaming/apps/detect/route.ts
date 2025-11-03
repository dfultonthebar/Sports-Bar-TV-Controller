
/**
 * API Route: Detect Installed Streaming Apps
 * 
 * Detects which streaming apps are installed on a Fire TV device
 */

import { NextRequest, NextResponse } from 'next/server'
import { streamingManager } from '@/services/streaming-service-manager'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { deviceId, ipAddress, port = 5555, forceRefresh = false } = body

    if (!deviceId || !ipAddress) {
      return NextResponse.json(
        { error: 'deviceId and ipAddress are required' },
        { status: 400 }
      )
    }

    console.log(`[API] Detecting streaming apps on device ${deviceId}`)

    const installedApps = await streamingManager.getInstalledApps(
      deviceId,
      ipAddress,
      port,
      forceRefresh
    )

    const installedCount = installedApps.filter(a => a.isInstalled).length
    const totalCount = installedApps.length

    return NextResponse.json({
      success: true,
      deviceId,
      installedCount,
      totalCount,
      apps: installedApps
    })
  } catch (error: any) {
    console.error('[API] Error detecting streaming apps:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to detect streaming apps',
        message: error.message
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Return all available streaming apps in database
    const allApps = streamingManager.getAllApps()
    const sportsApps = streamingManager.getSportsApps()
    const appsWithApis = streamingManager.getAppsWithApis()

    return NextResponse.json({
      success: true,
      apps: {
        all: allApps,
        sports: sportsApps,
        withApis: appsWithApis
      }
    })
  } catch (error: any) {
    console.error('[API] Error getting streaming apps:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get streaming apps',
        message: error.message
      },
      { status: 500 }
    )
  }
}
