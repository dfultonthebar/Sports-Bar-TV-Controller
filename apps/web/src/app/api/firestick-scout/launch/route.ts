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
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { spawnSync } from 'child_process'

// Security: Validate IP address format
function isValidIPAddress(ip: string): boolean {
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipPattern.test(ip)) return false
  const parts = ip.split('.').map(Number)
  return parts.every(p => p >= 0 && p <= 255)
}

// Security: Validate package name format (alphanumeric, dots, underscores)
function isValidPackageName(pkg: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9._]*$/.test(pkg)
}

// Execute ADB command safely using spawnSync with argument arrays
function execAdb(args: string[], timeout: number = 10000): { success: boolean; output: string; error?: string } {
  try {
    const result = spawnSync('adb', args, { timeout, encoding: 'utf8' })
    if (result.error) {
      return { success: false, output: '', error: result.error.message }
    }
    if (result.status !== 0 && result.stderr) {
      return { success: false, output: result.stdout || '', error: result.stderr }
    }
    return { success: true, output: result.stdout || '' }
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
}

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

    // Security: Validate IP address format
    if (!isValidIPAddress(ipAddress)) {
      logger.warn('[FIRESTICK-SCOUT] Invalid IP address format', { ipAddress })
      return NextResponse.json({
        success: false,
        error: 'Invalid IP address format'
      }, { status: 400 })
    }

    // Security: Validate package name
    if (!isValidPackageName(appByName.packageName)) {
      logger.warn('[FIRESTICK-SCOUT] Invalid package name format', { packageName: appByName.packageName })
      return NextResponse.json({
        success: false,
        error: 'Invalid package name format'
      }, { status: 400 })
    }

    const deviceTarget = `${ipAddress}:5555`

    logger.info('[FIRESTICK-SCOUT] Launching app', { app: appByName.appName, deviceId, ipAddress })

    // First ensure we're connected to the device
    const connectResult = execAdb(['connect', deviceTarget], 5000)
    if (!connectResult.success) {
      logger.error('[FIRESTICK-SCOUT] Failed to connect to device', { error: connectResult.error })
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to device',
        details: connectResult.error
      }, { status: 500 })
    }

    // Build and execute ADB command safely using argument arrays
    let launchResult: { success: boolean; output: string; error?: string }
    let commandDescription: string

    if (searchQuery && appByName.searchDeepLink) {
      // Use search deep-link
      const searchUrl = appByName.searchDeepLink.replace('{query}', encodeURIComponent(searchQuery))
      launchResult = execAdb(['-s', deviceTarget, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', searchUrl])
      commandDescription = `search: ${searchQuery}`
    } else if ((gameId || contentId) && appByName.deepLinkPattern) {
      // Use content deep-link
      const contentUrl = appByName.deepLinkPattern
        .replace('{id}', gameId || contentId || '')
        .replace('{contentId}', contentId || '')
        .replace('{gameId}', gameId || '')
      launchResult = execAdb(['-s', deviceTarget, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', contentUrl])
      commandDescription = `deeplink: ${contentUrl}`
    } else if (appByName.launchCommand) {
      // Use basic launch command - parse it safely
      // launchCommand format expected: "am start -n com.package/.Activity"
      const launchParts = appByName.launchCommand.split(/\s+/).filter(Boolean)
      launchResult = execAdb(['-s', deviceTarget, 'shell', ...launchParts])
      commandDescription = `launch command`
    } else {
      // Fallback: launch by package using monkey
      launchResult = execAdb(['-s', deviceTarget, 'shell', 'monkey', '-p', appByName.packageName, '-c', 'android.intent.category.LAUNCHER', '1'])
      commandDescription = `monkey launch`
    }

    if (!launchResult.success) {
      logger.error('[FIRESTICK-SCOUT] ADB command failed', { error: launchResult.error })
      return NextResponse.json({
        success: false,
        error: 'Failed to execute ADB command',
        details: launchResult.error
      }, { status: 500 })
    }

    logger.info('[FIRESTICK-SCOUT] Successfully launched app', { app: appByName.appName, deviceId })

    return NextResponse.json({
      success: true,
      message: `Launched ${appByName.appName} on ${deviceId}`,
      deviceId,
      app: appByName.appName,
      package: appByName.packageName,
      ipAddress,
      searchQuery,
      gameId,
      adbResult: launchResult.output
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
