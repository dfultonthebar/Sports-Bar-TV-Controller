/**
 * API Route: FireStick Scout - Can Show Query
 *
 * Query which Fire TV devices can show a specific streaming service or game.
 * Used by the AI Game Plan to assign streaming-only games to capable TVs.
 *
 * Example queries:
 * - GET /api/firestick-scout/can-show?app=peacock
 * - GET /api/firestick-scout/can-show?league=NFL
 * - GET /api/firestick-scout/can-show?game=Steelers+vs+Ravens&league=NFL
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const searchParams = request.nextUrl.searchParams
    const appName = searchParams.get('app')?.toLowerCase()
    const league = searchParams.get('league')
    const game = searchParams.get('game')

    // Get all Fire TV statuses
    const allStatuses = await db.select().from(schema.firestickLiveStatus).all()

    // Get app registry
    const appRegistry = await db.select().from(schema.firestickAppRegistry).all()
    const appsByPackage = new Map(appRegistry.map(app => [app.packageName, app]))
    const appsByName = new Map(appRegistry.map(app => [app.appName.toLowerCase(), app]))

    // Determine online status (heartbeat within 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    // Parse and enhance statuses
    const statuses = allStatuses.map(status => {
      const isOnline = status.lastHeartbeat && status.lastHeartbeat > twoMinutesAgo
      const installedApps = status.installedApps ? JSON.parse(status.installedApps) : []
      const loggedInApps = status.loggedInApps ? JSON.parse(status.loggedInApps) : []

      return {
        deviceId: status.deviceId,
        deviceName: status.deviceName,
        isOnline,
        currentApp: status.currentApp,
        currentAppName: status.currentAppName,
        currentGame: status.currentGame,
        installedApps,
        loggedInApps,
        ipAddress: status.ipAddress
      }
    })

    // Filter based on query
    let capableDevices: typeof statuses = []
    let matchedApp: typeof appRegistry[0] | null = null
    let matchedApps: typeof appRegistry = []

    if (appName) {
      // Find app by name
      matchedApp = appsByName.get(appName) || null

      if (!matchedApp) {
        // Try partial match
        matchedApp = appRegistry.find(a =>
          a.appName.toLowerCase().includes(appName) ||
          a.packageName.toLowerCase().includes(appName)
        ) || null
      }

      if (matchedApp) {
        // Find devices that have this app installed and are logged in
        capableDevices = statuses.filter(s =>
          s.isOnline && (
            s.loggedInApps.includes(matchedApp!.packageName) ||
            s.installedApps.includes(matchedApp!.packageName)
          )
        )
      }
    } else if (league) {
      // Find all apps that support this league
      matchedApps = appRegistry.filter(app => {
        if (!app.supportedLeagues) return false
        const leagues = JSON.parse(app.supportedLeagues) as string[]
        return leagues.some(l => l.toLowerCase().includes(league.toLowerCase()))
      })

      const matchedPackages = new Set(matchedApps.map(a => a.packageName))

      // Find devices that have any of these apps
      capableDevices = statuses.filter(s =>
        s.isOnline && (
          s.loggedInApps.some((pkg: string) => matchedPackages.has(pkg)) ||
          s.installedApps.some((pkg: string) => matchedPackages.has(pkg))
        )
      )
    }

    // Sort by preference: devices currently showing related content first
    capableDevices.sort((a, b) => {
      // Prefer devices already showing the right app
      if (matchedApp) {
        const aHasApp = a.currentApp === matchedApp.packageName
        const bHasApp = b.currentApp === matchedApp.packageName
        if (aHasApp && !bHasApp) return -1
        if (!aHasApp && bHasApp) return 1
      }

      // Prefer logged-in over just installed
      if (matchedApp) {
        const aLoggedIn = a.loggedInApps.includes(matchedApp.packageName)
        const bLoggedIn = b.loggedInApps.includes(matchedApp.packageName)
        if (aLoggedIn && !bLoggedIn) return -1
        if (!aLoggedIn && bLoggedIn) return 1
      }

      return 0
    })

    // Build response
    const response: any = {
      success: true,
      query: { app: appName, league, game },
      canShow: capableDevices.length > 0,
      deviceCount: capableDevices.length,
      devices: capableDevices.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        currentApp: d.currentAppName,
        currentGame: d.currentGame,
        isShowingRequestedApp: matchedApp ? d.currentApp === matchedApp.packageName : false,
        isLoggedIn: matchedApp ? d.loggedInApps.includes(matchedApp.packageName) : true,
        ipAddress: d.ipAddress
      }))
    }

    if (matchedApp) {
      response.matchedApp = {
        name: matchedApp.appName,
        package: matchedApp.packageName,
        supportedLeagues: matchedApp.supportedLeagues ? JSON.parse(matchedApp.supportedLeagues) : [],
        launchCommand: matchedApp.launchCommand,
        deepLinkPattern: matchedApp.deepLinkPattern,
        searchDeepLink: matchedApp.searchDeepLink
      }
    }

    if (matchedApps.length > 0) {
      response.matchedApps = matchedApps.map(app => ({
        name: app.appName,
        package: app.packageName,
        supportedLeagues: app.supportedLeagues ? JSON.parse(app.supportedLeagues) : []
      }))
    }

    // Add recommendation
    if (capableDevices.length > 0) {
      const best = capableDevices[0]
      response.recommendation = {
        deviceId: best.deviceId,
        deviceName: best.deviceName,
        reason: best.currentApp === matchedApp?.packageName
          ? 'Already showing the right app'
          : best.loggedInApps.includes(matchedApp?.packageName || '')
            ? 'Logged into the required app'
            : 'Has the app installed'
      }
    }

    logger.info(`[FIRESTICK_SCOUT] Can-show query: app=${appName}, league=${league} -> ${capableDevices.length} capable devices`)

    return NextResponse.json(response)
  } catch (error: any) {
    logger.error('[FIRESTICK_SCOUT] Error in can-show query:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to query device capabilities',
      details: error.message
    }, { status: 500 })
  }
}
