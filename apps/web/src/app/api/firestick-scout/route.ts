/**
 * API Route: FireStick Scout
 *
 * Receives heartbeat/status updates from FireStick Scout agents running on Fire TV devices.
 * Returns status of all Fire TV devices for the AI Game Plan.
 *
 * POST - Receive heartbeat from a Fire TV Scout agent
 * GET - Get all Fire TV device statuses (for AI Game Plan)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, gt, sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

// Schema for Scout heartbeat
const heartbeatSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  ipAddress: z.string().optional(),
  currentApp: z.string().optional(),
  currentAppName: z.string().optional(),
  appCategory: z.string().optional(),
  currentGame: z.string().optional(),
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  homeScore: z.string().optional(),
  awayScore: z.string().optional(),
  gameStatus: z.string().optional(),
  league: z.string().optional(),
  installedApps: z.array(z.string()).optional(),
  loggedInApps: z.array(z.string()).optional(),
  scoutVersion: z.string().optional()
})

// POST - Receive heartbeat from Fire TV Scout agent
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, heartbeatSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data
  const now = new Date().toISOString()

  try {
    // Check if device already exists
    const existing = await db
      .select()
      .from(schema.firestickLiveStatus)
      .where(eq(schema.firestickLiveStatus.deviceId, data.deviceId))
      .get()

    const statusData = {
      deviceName: data.deviceName || data.deviceId,
      ipAddress: data.ipAddress || null,
      currentApp: data.currentApp || null,
      currentAppName: data.currentAppName || null,
      appCategory: data.appCategory || null,
      currentGame: data.currentGame || null,
      homeTeam: data.homeTeam || null,
      awayTeam: data.awayTeam || null,
      homeScore: data.homeScore || null,
      awayScore: data.awayScore || null,
      gameStatus: data.gameStatus || null,
      league: data.league || null,
      installedApps: data.installedApps ? JSON.stringify(data.installedApps) : null,
      loggedInApps: data.loggedInApps ? JSON.stringify(data.loggedInApps) : null,
      isOnline: true,
      lastHeartbeat: now,
      scoutVersion: data.scoutVersion || null,
      updatedAt: now
    }

    if (existing) {
      // Update existing status
      await db
        .update(schema.firestickLiveStatus)
        .set(statusData)
        .where(eq(schema.firestickLiveStatus.id, existing.id))
        .run()

      logger.debug(`[FIRESTICK_SCOUT] Updated status for ${data.deviceId}: ${data.currentAppName || 'idle'}`)
    } else {
      // Create new status entry
      await db.insert(schema.firestickLiveStatus).values({
        deviceId: data.deviceId,
        ...statusData,
        createdAt: now
      }).run()

      logger.info(`[FIRESTICK_SCOUT] New device registered: ${data.deviceId} (${data.deviceName})`)
    }

    return NextResponse.json({
      success: true,
      message: 'Heartbeat received',
      deviceId: data.deviceId,
      timestamp: now
    })
  } catch (error: any) {
    logger.error('[FIRESTICK_SCOUT] Error processing heartbeat:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process heartbeat',
      details: error.message
    }, { status: 500 })
  }
}

// GET - Get all Fire TV device statuses
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const searchParams = request.nextUrl.searchParams
    const onlineOnly = searchParams.get('onlineOnly') === 'true'
    const appFilter = searchParams.get('app') // Filter by specific app package
    const leagueFilter = searchParams.get('league') // Filter by league capability

    // Get all device statuses
    let query = db.select().from(schema.firestickLiveStatus)

    const allStatuses = await query.all()

    // Mark devices as offline if no heartbeat in 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const statuses = allStatuses.map(status => {
      const isOnline = status.lastHeartbeat && status.lastHeartbeat > twoMinutesAgo
      return {
        ...status,
        isOnline,
        installedApps: status.installedApps ? JSON.parse(status.installedApps) : [],
        loggedInApps: status.loggedInApps ? JSON.parse(status.loggedInApps) : []
      }
    })

    // Apply filters
    let filteredStatuses = statuses

    if (onlineOnly) {
      filteredStatuses = filteredStatuses.filter(s => s.isOnline)
    }

    if (appFilter) {
      filteredStatuses = filteredStatuses.filter(s =>
        s.installedApps.includes(appFilter) || s.loggedInApps.includes(appFilter)
      )
    }

    // Get app registry for league filtering and app names
    const appRegistry = await db.select().from(schema.firestickAppRegistry).all()
    const appsByPackage = new Map(appRegistry.map(app => [app.packageName, app]))

    if (leagueFilter) {
      // Filter to devices that have an app supporting this league
      const appsForLeague = appRegistry.filter(app => {
        if (!app.supportedLeagues) return false
        const leagues = JSON.parse(app.supportedLeagues)
        return leagues.some((l: string) => l.toLowerCase().includes(leagueFilter.toLowerCase()))
      })
      const packageNames = appsForLeague.map(a => a.packageName)

      filteredStatuses = filteredStatuses.filter(s =>
        s.installedApps.some((app: string) => packageNames.includes(app)) ||
        s.loggedInApps.some((app: string) => packageNames.includes(app))
      )
    }

    // Enhance statuses with app info
    const enhancedStatuses = filteredStatuses.map(status => {
      const currentAppInfo = status.currentApp ? appsByPackage.get(status.currentApp) : null

      // Get capabilities - what can this device show
      const capabilities = status.loggedInApps.map((pkg: string) => {
        const app = appsByPackage.get(pkg)
        if (!app) return null
        return {
          app: app.appName,
          package: pkg,
          leagues: app.supportedLeagues ? JSON.parse(app.supportedLeagues) : [],
          hasDeepLink: !!app.deepLinkPattern
        }
      }).filter(Boolean)

      return {
        ...status,
        currentAppInfo: currentAppInfo ? {
          name: currentAppInfo.appName,
          category: currentAppInfo.appCategory,
          hasDeepLink: !!currentAppInfo.deepLinkPattern
        } : null,
        capabilities
      }
    })

    // Summary stats
    const summary = {
      total: statuses.length,
      online: statuses.filter(s => s.isOnline).length,
      showingGame: statuses.filter(s => s.currentGame).length,
      byApp: {} as Record<string, number>
    }

    // Count by current app
    for (const status of statuses) {
      if (status.currentAppName) {
        summary.byApp[status.currentAppName] = (summary.byApp[status.currentAppName] || 0) + 1
      }
    }

    return NextResponse.json({
      success: true,
      statuses: enhancedStatuses,
      summary,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    logger.error('[FIRESTICK_SCOUT] Error getting statuses:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get Fire TV statuses',
      details: error.message
    }, { status: 500 })
  }
}
