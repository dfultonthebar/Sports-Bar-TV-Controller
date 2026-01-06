/**
 * Fire TV Current App API
 *
 * Get the currently running app on a Fire TV device
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { connectionManager } from '@/services/firetv-connection-manager'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '@sports-bar/logger'

const DATA_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')

// Known streaming app package names with friendly names
const APP_NAMES: Record<string, string> = {
  'com.amazon.tv.launcher': 'Home',
  'com.amazon.avod': 'Prime Video',
  'com.amazon.avod.thirdpartyclient': 'Prime Video',
  'com.netflix.ninja': 'Netflix',
  'com.disney.disneyplus': 'Disney+',
  'com.hulu.plus': 'Hulu',
  'com.hbo.hbonow': 'HBO Max',
  'com.wbd.stream': 'Max',
  'com.espn.gtv': 'ESPN',
  'com.fox.now': 'Fox Sports',
  'com.cbs.app': 'Paramount+',
  'com.peacocktv.peacockandroid': 'Peacock',
  'com.tubitv': 'Tubi',
  'com.pluto.tv': 'Pluto TV',
  'com.google.android.youtube.tv': 'YouTube',
  'com.amazon.firetv.youtube': 'YouTube',
  'com.apple.atve.amazon.appletv': 'Apple TV+',
  'air.com.vudu.air.DownloaderTablet': 'Vudu',
  'com.sling': 'Sling TV',
  'com.fubotv.roku': 'fuboTV',
  'com.directv.dvrscheduler': 'DirecTV Stream',
  'com.att.tv': 'AT&T TV',
  'com.nfl.gsis.firetv': 'NFL',
  'com.mlb.atbat': 'MLB.tv',
  'com.nba.gametime.gs': 'NBA App',
  'com.espn.score_center': 'ESPN ScoreCenter',
  'com.btn2go': 'Big Ten+',
  'com.peacock.peacockfiretv': 'Peacock',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { deviceId } = await params

  try {
    // Look up device info from data file
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    const device = parsed.devices?.find((d: any) => d.id === deviceId)

    if (!device) {
      return NextResponse.json({
        success: false,
        error: 'Device not found',
        currentApp: null
      }, { status: 404 })
    }

    // Get or create connection for this device
    const client = await connectionManager.getOrCreateConnection(
      deviceId,
      device.ipAddress,
      device.port || 5555
    )

    // Get current app using ADB
    const appInfo = await client.getCurrentApp()

    if (!appInfo) {
      return NextResponse.json({
        success: true,
        currentApp: null,
        message: 'Could not determine current app'
      })
    }

    // Get friendly name for the app
    const friendlyName = APP_NAMES[appInfo.packageName] || appInfo.packageName.split('.').pop() || 'Unknown'

    logger.info(`[FIRETV API] Current app for ${deviceId}: ${friendlyName} (${appInfo.packageName})`)

    return NextResponse.json({
      success: true,
      currentApp: {
        packageName: appInfo.packageName,
        activityName: appInfo.activityName,
        friendlyName
      }
    })

  } catch (error: any) {
    logger.error(`[FIRETV API] Error getting current app for ${deviceId}:`, error)
    return NextResponse.json({
      success: false,
      error: error.message,
      currentApp: null
    }, { status: 500 })
  }
}
