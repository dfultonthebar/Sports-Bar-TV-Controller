import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { testLogs, systemSettings } from '@/db/schema'
import { eq, desc, and, gte } from 'drizzle-orm'
import { getAISportsContextProvider } from '@/lib/ai-sports-context'
import { logger } from '@/lib/logger'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

const DIRECTV_DEVICES_FILE = join(process.cwd(), 'data', 'directv-devices.json')

/**
 * Real AI Insights for DirecTV Devices
 *
 * Generates intelligent channel suggestions and health metrics based on:
 * - Actual device performance history
 * - Real upcoming sports events from AI Sports Context
 * - Historical command success rates
 * - Network performance metrics
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { deviceId } = bodyValidation.data

    logger.info(`[AI Insights] Generating insights for device: ${deviceId}`)

    // 1. Get device info from JSON file
    let device: any = null
    try {
      const data = await readFile(DIRECTV_DEVICES_FILE, 'utf-8')
      const allDevices = JSON.parse(data)
      device = allDevices.find((d: any) => d.id === deviceId)
    } catch (error) {
      logger.error('[AI Insights] Error reading DirecTV devices file:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to read device data' },
        { status: 500 }
      )
    }

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // 2. Get Sports Context for intelligent channel suggestions
    const sportsProvider = getAISportsContextProvider()
    const sportsContext = await sportsProvider.getSportsContext()

    // 3. Calculate real health metrics from device history
    const healthMetrics = await calculateRealHealthMetrics(deviceId, device)

    // 4. Generate sports-aware channel suggestions
    const channelSuggestions = generateSportsAwareChannelSuggestions(
      sportsContext,
      device
    )

    // 5. Generate smart alerts based on real data
    const alerts = await generateSmartAlerts(
      deviceId,
      device,
      healthMetrics,
      sportsContext
    )

    logger.info(`[AI Insights] Generated ${channelSuggestions.length} suggestions, ${alerts.length} alerts`)

    return NextResponse.json({
      success: true,
      channelSuggestions,
      healthMetrics,
      alerts,
      analysisTimestamp: new Date().toISOString(),
      deviceId,
      deviceName: device.name
    })

  } catch (error) {
    logger.error('[AI Insights] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate AI insights' },
      { status: 500 }
    )
  }
}

/**
 * Calculate real health metrics from device history
 */
async function calculateRealHealthMetrics(deviceId: string, device: any) {
  // Get recent test logs for this device (last 24 hours)
  const oneDayAgo = new Date()
  oneDayAgo.setHours(oneDayAgo.getHours() - 24)

  const recentLogs = await db
    .select()
    .from(testLogs)
    .where(
      and(
        eq(testLogs.testType, 'directv_command'),
        gte(testLogs.timestamp, oneDayAgo.toISOString())
      )
    )
    .orderBy(desc(testLogs.timestamp))
    .limit(100)

  // Calculate real metrics
  const deviceLogs = recentLogs.filter((log: any) =>
    log.metadata && JSON.parse(log.metadata).deviceId === deviceId
  )

  const totalCommands = deviceLogs.length
  const successfulCommands = deviceLogs.filter((log: any) => log.status === 'success').length

  const avgResponseTime = totalCommands > 0
    ? Math.round(deviceLogs.reduce((sum: number, log: any) => sum + (log.duration || 0), 0) / totalCommands)
    : 0

  const commandSuccessRate = totalCommands > 0
    ? Math.round((successfulCommands / totalCommands) * 100)
    : 100

  // Connection stability based on device online status
  const connectionStability = device.isOnline ? 100 : 0

  const predictedIssues: string[] = []

  // Real issue detection
  if (avgResponseTime > 500) {
    predictedIssues.push('High response time detected - network optimization recommended')
  }
  if (commandSuccessRate < 90) {
    predictedIssues.push(`Command success rate at ${commandSuccessRate}% - device may need restart`)
  }
  if (!device.isOnline) {
    predictedIssues.push('Device offline - check network connection and power')
  }

  return {
    responseTime: avgResponseTime,
    connectionStability,
    commandSuccessRate,
    lastHealthCheck: new Date(),
    predictedIssues,
    totalCommandsLast24h: totalCommands
  }
}

/**
 * Generate channel suggestions based on actual upcoming sports events
 */
function generateSportsAwareChannelSuggestions(sportsContext: any, device: any) {
  const suggestions: any[] = []

  // Check for games in the next 2 hours
  const upcomingGames = sportsContext.upcomingGames.filter(
    (game: any) => game.hoursUntilGame >= 0 && game.hoursUntilGame <= 2
  )

  if (upcomingGames.length > 0) {
    for (const game of upcomingGames.slice(0, 3)) {
      let channelNumber = '206' // Default ESPN
      let channelName = 'ESPN'

      // Map league to likely channel
      if (game.league === 'NFL') {
        channelNumber = '212'
        channelName = 'NFL Network / RedZone'
      } else if (game.league === 'NBA') {
        channelNumber = '216'
        channelName = 'NBA TV'
      } else if (game.league === 'MLB') {
        channelNumber = '213'
        channelName = 'MLB Network'
      } else if (game.league === 'NHL') {
        channelNumber = '215'
        channelName = 'NHL Network'
      }

      suggestions.push({
        channel: channelNumber,
        name: channelName,
        reason: `${game.league}: ${game.eventName} starts in ${Math.round(game.hoursUntilGame)} hour(s)`,
        confidence: game.importance === 'critical' ? 0.95 : game.importance === 'high' ? 0.85 : 0.75,
        category: 'sports',
        gameInfo: {
          league: game.league,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          time: game.eventTime,
          importance: game.importance
        }
      })
    }
  }

  // Add general sports recommendations if games are further out
  const nextBigGame = sportsContext.nextBigGame
  if (nextBigGame && suggestions.length === 0) {
    suggestions.push({
      channel: '206',
      name: 'ESPN',
      reason: `${nextBigGame.eventName} coming up ${nextBigGame.when}`,
      confidence: 0.70,
      category: 'sports'
    })
  }

  return suggestions
}

/**
 * Generate real alerts based on device status and sports schedule
 */
async function generateSmartAlerts(
  deviceId: string,
  device: any,
  healthMetrics: any,
  sportsContext: any
) {
  const alerts: any[] = []

  // Critical: Device offline
  if (!device.isOnline) {
    alerts.push({
      id: `alert_${Date.now()}_offline`,
      type: 'maintenance',
      message: `${device.name} is currently offline and unreachable`,
      severity: 'high',
      deviceId,
      timestamp: new Date(),
      autoResolvable: false
    })
  }

  // Performance degradation
  if (healthMetrics.commandSuccessRate < 90 && healthMetrics.commandSuccessRate > 0) {
    alerts.push({
      id: `alert_${Date.now()}_performance`,
      type: 'maintenance',
      message: `Command success rate is ${healthMetrics.commandSuccessRate}% - consider restarting device`,
      severity: 'medium',
      deviceId,
      timestamp: new Date(),
      autoResolvable: true
    })
  }

  // Network latency
  if (healthMetrics.responseTime > 500) {
    alerts.push({
      id: `alert_${Date.now()}_latency`,
      type: 'optimization',
      message: `Average response time is ${healthMetrics.responseTime}ms - network optimization recommended`,
      severity: 'low',
      deviceId,
      timestamp: new Date(),
      autoResolvable: true
    })
  }

  // Predictive: Upcoming game alert
  const soonGames = sportsContext.upcomingGames.filter(
    (g: any) => g.hoursUntilGame > 0 && g.hoursUntilGame < 1 && (g.importance === 'high' || g.importance === 'critical')
  )

  if (soonGames.length > 0 && device.isOnline) {
    alerts.push({
      id: `alert_${Date.now()}_pregame`,
      type: 'prediction',
      message: `${soonGames.length} important game(s) starting soon - device ready and online`,
      severity: 'low',
      deviceId,
      timestamp: new Date(),
      autoResolvable: false
    })
  }

  return alerts
}
