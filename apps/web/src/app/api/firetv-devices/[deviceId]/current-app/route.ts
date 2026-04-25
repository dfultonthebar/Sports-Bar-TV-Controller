/**
 * Fire TV Current App API
 *
 * Get the currently running app on a Fire TV device
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { connectionManager } from '@/services/firetv-connection-manager'
import { getFireTVDeviceById } from '@/lib/device-db'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

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
  'com.foxsports.videogo': 'Fox Sports',
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
    // Look up device info from database
    const device = await getFireTVDeviceById(deviceId)

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

    // Mirror into InputCurrentChannel so the bartender remote input list
    // shows the running app even when the scout APK doesn't report it
    // (older scout builds, scout-disabled boxes). Same write shape as the
    // firestick-scout heartbeat path (channelNumber="APP", channelName=
    // friendly name) — UI render branch keys on channelNumber==="APP".
    if (device.inputChannel) {
      try {
        const now = new Date().toISOString()
        const existingChannel = await db.select().from(schema.inputCurrentChannels)
          .where(eq(schema.inputCurrentChannels.inputNum, device.inputChannel)).get()
        const channelData = {
          inputLabel: device.name || 'Fire TV',
          deviceType: 'firetv',
          deviceId,
          channelNumber: 'APP',
          channelName: friendlyName,
          presetId: null,
          lastTuned: now,
          updatedAt: now,
        }
        if (existingChannel) {
          await db.update(schema.inputCurrentChannels)
            .set(channelData)
            .where(eq(schema.inputCurrentChannels.id, existingChannel.id))
        } else {
          await db.insert(schema.inputCurrentChannels).values({
            id: crypto.randomUUID(),
            inputNum: device.inputChannel,
            ...channelData,
          })
        }
      } catch (mirrorErr: any) {
        logger.warn(`[FIRETV API] Failed to mirror current app into InputCurrentChannel: ${mirrorErr.message}`)
      }
    }

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
