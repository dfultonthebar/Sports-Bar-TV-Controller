/**
 * API Route: FireStick Scout - Launch App/Content
 *
 * Launch a streaming app on a Fire TV device, optionally with a deep-link to specific content.
 *
 * POST /api/firestick-scout/launch
 * {
 *   deviceId: "fire-tv-1",
 *   app: "peacock",           // App name or package
 *   deepLink?: "search query" // Optional: search for specific content
 *   gameId?: "12345"          // Optional: deep-link to specific game
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const launchSchema = z.object({
  deviceId: z.string().min(1),
  app: z.string().min(1),
  searchQuery: z.string().optional(),
  gameId: z.string().optional(),
  contentId: z.string().optional()
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, launchSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { deviceId, app, searchQuery, gameId, contentId } = bodyValidation.data

  try {
    // Get device status to find IP address
    const deviceStatus = await db
      .select()
      .from(schema.firestickLiveStatus)
      .where(eq(schema.firestickLiveStatus.deviceId, deviceId))
      .get()

    // Also check Fire TV devices table
    const fireDevice = await db
      .select()
      .from(schema.fireTVDevices)
      .where(eq(schema.fireTVDevices.id, deviceId))
      .get()

    const ipAddress = deviceStatus?.ipAddress || fireDevice?.ipAddress

    if (!ipAddress) {
      return NextResponse.json({
        success: false,
        error: 'Device IP address not found',
        deviceId
      }, { status: 404 })
    }

    // Find app in registry
    const appRegistry = await db.select().from(schema.firestickAppRegistry).all()
    const appByName = appRegistry.find(a =>
      a.appName.toLowerCase() === app.toLowerCase() ||
      a.packageName.toLowerCase() === app.toLowerCase()
    )

    if (!appByName) {
      return NextResponse.json({
        success: false,
        error: `App '${app}' not found in registry`,
        availableApps: appRegistry.map(a => a.appName)
      }, { status: 404 })
    }

    // Build ADB command
    let adbCommand: string

    if (searchQuery && appByName.searchDeepLink) {
      // Use search deep-link
      const searchUrl = appByName.searchDeepLink.replace('{query}', encodeURIComponent(searchQuery))
      adbCommand = `adb -s ${ipAddress}:5555 shell am start -a android.intent.action.VIEW -d "${searchUrl}"`
    } else if ((gameId || contentId) && appByName.deepLinkPattern) {
      // Use content deep-link
      const contentUrl = appByName.deepLinkPattern
        .replace('{id}', gameId || contentId || '')
        .replace('{contentId}', contentId || '')
        .replace('{gameId}', gameId || '')
      adbCommand = `adb -s ${ipAddress}:5555 shell am start -a android.intent.action.VIEW -d "${contentUrl}"`
    } else if (appByName.launchCommand) {
      // Use basic launch command
      adbCommand = `adb -s ${ipAddress}:5555 shell ${appByName.launchCommand}`
    } else {
      // Fallback: launch by package
      adbCommand = `adb -s ${ipAddress}:5555 shell monkey -p ${appByName.packageName} -c android.intent.category.LAUNCHER 1`
    }

    logger.info(`[FIRESTICK_SCOUT] Launching ${appByName.appName} on ${deviceId} (${ipAddress})`)
    logger.debug(`[FIRESTICK_SCOUT] ADB command: ${adbCommand}`)

    // Execute ADB command
    const { execSync } = require('child_process')
    let result: string

    try {
      // First ensure we're connected to the device
      execSync(`adb connect ${ipAddress}:5555`, { timeout: 5000 })

      // Execute the launch command
      result = execSync(adbCommand, { timeout: 10000 }).toString()

      logger.info(`[FIRESTICK_SCOUT] Successfully launched ${appByName.appName} on ${deviceId}`)
    } catch (adbError: any) {
      logger.error(`[FIRESTICK_SCOUT] ADB command failed:`, adbError.message)

      return NextResponse.json({
        success: false,
        error: 'Failed to execute ADB command',
        details: adbError.message,
        command: adbCommand
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Launched ${appByName.appName} on ${deviceId}`,
      deviceId,
      app: appByName.appName,
      package: appByName.packageName,
      ipAddress,
      searchQuery,
      gameId,
      adbResult: result
    })
  } catch (error: any) {
    logger.error('[FIRESTICK_SCOUT] Error launching app:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to launch app',
      details: error.message
    }, { status: 500 })
  }
}
