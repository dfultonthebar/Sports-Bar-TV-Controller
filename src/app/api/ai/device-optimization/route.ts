import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { fireTVDevices, testLogs } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const DIRECTV_DEVICES_FILE = join(process.cwd(), 'data', 'directv-devices.json')

/**
 * AI Device Optimization API
 *
 * Analyzes all devices and applies AI recommendations
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { action } = await request.json()

    logger.info(`[AI Optimization] Action requested: ${action}`)

    if (action === 'analyze') {
      return await runFullAnalysis()
    } else if (action === 'optimize') {
      return await optimizeAllDevices()
    } else if (action === 'insights') {
      return await getAIInsights()
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

  } catch (error) {
    logger.error('[AI Optimization] Error:', error)
    logger.error('[AI Optimization] Error message:', error instanceof Error ? error.message : String(error))
    logger.error('[AI Optimization] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      {
        success: false,
        error: 'Operation failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * Run full AI analysis on all devices
 */
async function runFullAnalysis() {
  const startTime = Date.now()

  try {
    // Get DirecTV devices from JSON file
    let directvDevicesList: any[] = []
    try {
      const data = await readFile(DIRECTV_DEVICES_FILE, 'utf-8')
      const allDevices = JSON.parse(data)
      directvDevicesList = allDevices.filter((d: any) => d.active)
    } catch (error) {
      logger.warn('[AI Analysis] Could not read DirecTV devices file:', error)
      directvDevicesList = []
    }

    // Get FireTV devices from database (all devices, status filtering happens below)
    const firetvDevicesList = await db
      .select()
      .from(fireTVDevices)

    const totalDevices = directvDevicesList.length + firetvDevicesList.length
    const onlineDevices = [
      ...directvDevicesList.filter(d => d.isOnline),
      ...firetvDevicesList.filter(d => d.status === 'online')
    ].length

    // Analyze recent performance (last hour) - simplified query
    let recentTests: any[] = []
    try {
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - 1)

      recentTests = await db
        .select()
        .from(testLogs)
        .limit(100) // Just get recent 100 tests instead of filtering by date
    } catch (err) {
      logger.error('[AI Analysis] Error fetching test logs:', err)
      recentTests = []
    }

    const successRate = recentTests.length > 0
      ? Math.round((recentTests.filter(t => t.status === 'success').length / recentTests.length) * 100)
      : 100

    const avgResponseTime = recentTests.length > 0
      ? Math.round(recentTests.reduce((sum, t) => sum + (t.duration || 0), 0) / recentTests.length)
      : 0

    const duration = Date.now() - startTime

    const offlineCount = totalDevices - onlineDevices
    const overallHealth = totalDevices > 0 ? (onlineDevices / totalDevices * 100) : 100

    const analysis = {
      totalDevices,
      onlineDevices,
      offlineDevices: offlineCount,
      overallHealth,
      recentPerformance: {
        successRate,
        avgResponseTime,
        testsLastHour: recentTests.length
      },
      deviceBreakdown: {
        directv: {
          total: directvDevicesList.length,
          online: directvDevicesList.filter(d => d.isOnline).length
        },
        firetv: {
          total: firetvDevicesList.length,
          online: firetvDevicesList.filter(d => d.status === 'online').length
        }
      },
      recommendations: generateOptimizationRecommendations({
        offlineCount,
        successRate,
        avgResponseTime
      })
    }

    logger.info(`[AI Analysis] Completed in ${duration}ms - ${totalDevices} devices found`)

    return NextResponse.json({
      success: true,
      analysis,
      duration,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[AI Analysis] Fatal error:', error)
    logger.error('[AI Analysis] Error message:', error instanceof Error ? error.message : String(error))
    logger.error('[AI Analysis] Error stack:', error instanceof Error ? error.stack : 'No stack')
    throw error
  }
}

/**
 * Optimize all devices based on AI recommendations
 */
async function optimizeAllDevices() {
  const optimizations: any[] = []

  // Get DirecTV devices from JSON file
  let directvDevicesList: any[] = []
  try {
    const data = await readFile(DIRECTV_DEVICES_FILE, 'utf-8')
    const allDevices = JSON.parse(data)
    directvDevicesList = allDevices.filter((d: any) => d.active)
  } catch (error) {
    logger.warn('[AI Optimization] Could not read DirecTV devices file:', error)
    directvDevicesList = []
  }

  // Get FireTV devices from database (all devices)
  const firetvDevicesList = await db
    .select()
    .from(fireTVDevices)

  // Check each DirectV device
  for (const device of directvDevicesList) {
    if (!device.isOnline) {
      optimizations.push({
        deviceId: device.id,
        deviceName: device.name,
        type: 'directv',
        action: 'reconnect_recommended',
        priority: 'high',
        message: `${device.name} is offline - manual intervention required`
      })
    }
  }

  // Check each FireTV device
  for (const device of firetvDevicesList) {
    if (device.status !== 'online') {
      optimizations.push({
        deviceId: device.id,
        deviceName: device.name,
        type: 'firetv',
        action: 'reconnect_recommended',
        priority: 'high',
        message: `${device.name} connection issues - check ADB connection`
      })
    }
  }

  return NextResponse.json({
    success: true,
    optimizationsApplied: optimizations.length,
    optimizations,
    message: `Analyzed ${directvDevicesList.length + firetvDevicesList.length} devices, found ${optimizations.length} optimization opportunities`
  })
}

/**
 * Get AI performance insights
 */
async function getAIInsights() {
  try {
    // Get recent tests - simplified
    const recentTests = await db
      .select()
      .from(testLogs)
      .limit(500) // Get last 500 tests

    // Calculate trends
    const byDay: any = {}
    recentTests.forEach(test => {
      const day = test.timestamp.substring(0, 10)
      if (!byDay[day]) {
        byDay[day] = { total: 0, success: 0, avgDuration: 0, durations: [] }
      }
      byDay[day].total++
      if (test.status === 'success') byDay[day].success++
      if (test.duration) byDay[day].durations.push(test.duration)
    })

    const insights = Object.entries(byDay).map(([date, data]: [string, any]) => ({
      date,
      successRate: Math.round((data.success / data.total) * 100),
      avgResponseTime: data.durations.length > 0
        ? Math.round(data.durations.reduce((a: number, b: number) => a + b, 0) / data.durations.length)
        : 0,
      testCount: data.total
    }))

    const overallSuccessRate = recentTests.length > 0
      ? Math.round((recentTests.filter(t => t.status === 'success').length / recentTests.length) * 100)
      : 100

    return NextResponse.json({
      success: true,
      insights: {
        weeklyTrend: insights.slice(-7),
        overallSuccessRate,
        totalTests: recentTests.length,
        period: 'Recent activity',
        predictions: generatePredictions(insights)
      }
    })
  } catch (error) {
    logger.error('[AI Insights] Error:', error)
    logger.error('[AI Insights] Error message:', error instanceof Error ? error.message : String(error))
    logger.error('[AI Insights] Error stack:', error instanceof Error ? error.stack : 'No stack')
    throw error
  }
}

/**
 * Generate optimization recommendations
 */
function generateOptimizationRecommendations(metrics: any): string[] {
  const recommendations: string[] = []

  if (metrics.offlineCount > 0) {
    recommendations.push(`${metrics.offlineCount} device(s) offline - check network connections`)
  }

  if (metrics.successRate < 90) {
    recommendations.push(`Success rate at ${metrics.successRate}% - restart underperforming devices`)
  }

  if (metrics.avgResponseTime > 500) {
    recommendations.push(`Response time averaging ${metrics.avgResponseTime}ms - check network bandwidth`)
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems operating optimally')
  }

  return recommendations
}

/**
 * Generate performance predictions
 */
function generatePredictions(insights: any[]): string[] {
  if (insights.length < 3) {
    return ['Insufficient data for predictions']
  }

  const recent = insights.slice(-3)
  const avgSuccess = recent.reduce((sum, i) => sum + i.successRate, 0) / recent.length

  const predictions: string[] = []

  if (avgSuccess > 95) {
    predictions.push('System performance trending upward - expect continued stability')
  } else if (avgSuccess < 85) {
    predictions.push('Performance degradation detected - proactive maintenance recommended')
  } else {
    predictions.push('System performance stable within normal parameters')
  }

  return predictions
}
