export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { db } from '@/db'
import { fireTVDevices, matrixOutputs, audioProcessors, scheduledCommandLogs } from '@/db/schema'
import { eq, and, desc, sql, gte } from 'drizzle-orm'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

// Shared analysis logic to be used by both GET and POST handlers
async function performDeviceAnalysis(deviceFilter: string = 'all', timeframe: string = '24h') {
  // Calculate timeframe cutoff
  const timeframeCutoff = new Date()
  if (timeframe === '24h') {
    timeframeCutoff.setHours(timeframeCutoff.getHours() - 24)
  } else if (timeframe === '7d') {
    timeframeCutoff.setDate(timeframeCutoff.getDate() - 7)
  } else if (timeframe === '30d') {
    timeframeCutoff.setDate(timeframeCutoff.getDate() - 30)
  }

  // Query real devices from database
  // Only include devices that can actually be monitored (have bidirectional communication)
  const fireTVs = await db.select().from(fireTVDevices)

  // Query matrix configuration and outputs for monitoring
  const matrixOutputsList = await db.select().from(matrixOutputs).where(eq(matrixOutputs.isActive, true))

  // Query audio processors for monitoring
  const audioProcessorDevices = await db.select().from(audioProcessors)

  // Combine all MONITORABLE devices into a unified format
  // Exclude IR devices and cable boxes since they are one-way communication only
  const allDevices = [
    ...fireTVs.map(d => ({
      id: d.id,
      name: d.name,
      type: 'firetv' as const,
      status: d.status,
      lastSeen: d.lastSeen,
      metadata: { ipAddress: d.ipAddress, location: d.location }
    })),
    ...matrixOutputsList.map(d => ({
      id: d.id,
      name: d.label,
      type: 'matrix' as const,
      status: d.powerOn ? 'online' : 'offline',
      lastSeen: d.lastDiscovery || d.updatedAt,
      metadata: {
        tvBrand: d.tvBrand,
        tvModel: d.tvModel,
        cecAddress: d.cecAddress,
        selectedInput: d.selectedVideoInput
      }
    })),
    ...audioProcessorDevices.map(d => ({
      id: d.id,
      name: d.name,
      type: 'audio' as const,
      status: d.status,
      lastSeen: d.lastSeen,
      metadata: {
        model: d.model,
        ipAddress: d.ipAddress,
        zones: d.zones
      }
    }))
  ]

  // Filter devices if specific type requested
  const devices = deviceFilter !== 'all'
    ? allDevices.filter(d => d.type === deviceFilter)
    : allDevices

  // Query command logs for diagnostics (last 24 hours for performance)
  const recentCommandLogs = await db
    .select()
    .from(scheduledCommandLogs)
    .where(gte(scheduledCommandLogs.executedAt, timeframeCutoff.toISOString()))
    .orderBy(desc(scheduledCommandLogs.executedAt))
    .limit(1000)

  // Analyze command logs for errors and performance issues
  const deviceDiagnostics: Record<string, any[]> = {}

  for (const log of recentCommandLogs) {
    const deviceId = log.scheduledCommandId // This is a proxy for device activity

    if (!deviceDiagnostics[deviceId]) {
      deviceDiagnostics[deviceId] = []
    }

    if (!log.success) {
      deviceDiagnostics[deviceId].push({
        severity: 'high',
        status: 'active',
        issue: log.errorMessage || 'Command Execution Failed',
        type: 'connection',
        timestamp: log.executedAt
      })
    }
  }

  // Generate insights from real data - return in the format expected by DeviceAIAssistant component
  const insights: any[] = []
  const recommendations: any[] = []
  const metrics: any = {}

  // Analyze devices for insights
  for (const device of devices) {
    const diagnostics = deviceDiagnostics[device.id] || []

    // Check for offline devices
    if (device.status === 'offline') {
      insights.push({
        id: `insight-${device.id}-offline-${Date.now()}`,
        deviceId: device.id,
        deviceName: device.name,
        deviceType: device.type,
        type: 'troubleshooting',
        priority: 'high',
        title: `Device Offline`,
        description: `${device.name} is currently offline and unreachable`,
        recommendation: `Check power connection, network connectivity, and device status for ${device.name}`,
        confidence: 0.95,
        timestamp: new Date(),
        data: { status: device.status, lastSeen: device.lastSeen }
      })
    }

    // Check for devices with command errors
    if (diagnostics.length > 0) {
      const recentIssues = diagnostics.filter(d =>
        d.severity === 'high' || d.severity === 'critical'
      ).length

      if (recentIssues > 0) {
        insights.push({
          id: `insight-${device.id}-${Date.now()}`,
          deviceId: device.id,
          deviceName: device.name,
          deviceType: device.type,
          type: 'troubleshooting',
          priority: recentIssues > 2 ? 'high' : 'medium',
          title: `Command Execution Failures`,
          description: `Device has ${recentIssues} failed command attempts in the last ${timeframe}`,
          recommendation: `Check connection stability and device responsiveness for ${device.name}`,
          confidence: 0.85,
          timestamp: new Date(),
          data: { issuesCount: recentIssues, diagnostics: diagnostics }
        })
      }
    }

    // Check for stale devices (haven't been seen in a while)
    if (device.lastSeen) {
      const lastSeenDate = new Date(device.lastSeen)
      const hoursSinceLastSeen = (new Date().getTime() - lastSeenDate.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastSeen > 48 && device.status === 'online') {
        insights.push({
          id: `insight-${device.id}-stale-${Date.now()}`,
          deviceId: device.id,
          deviceName: device.name,
          deviceType: device.type,
          type: 'maintenance',
          priority: 'low',
          title: `Stale Device Status`,
          description: `${device.name} hasn't been seen in ${Math.floor(hoursSinceLastSeen)} hours`,
          recommendation: `Verify device is still online and update status if needed`,
          confidence: 0.70,
          timestamp: new Date(),
          data: { lastSeen: device.lastSeen, hoursSinceLastSeen }
        })
      }
    }

    // Calculate metrics for each device
    const deviceErrors = diagnostics.length // All diagnostics are errors
    const totalCommands = recentCommandLogs.filter(l => l.scheduledCommandId === device.id).length
    const errorRate = totalCommands > 0 ? (deviceErrors / totalCommands) * 100 : 0

    metrics[device.name] = {
      responsiveness: device.status === 'online' ? Math.max(0, 100 - errorRate) : 0,
      connectionStability: device.status === 'online' ? 95 : 0,
      errorRate: errorRate,
      usageFrequency: totalCommands,
      lastSeen: device.lastSeen ? new Date(device.lastSeen) : null,
      avgResponseTime: 120 // Would need response time tracking in command logs
    }
  }

  // Generate recommendations based on real data
  const issueTypes = new Map()
  const issueDeviceTypes = new Map<string, Set<string>>()

  for (const deviceId in deviceDiagnostics) {
    const device = devices.find(d => d.id === deviceId)
    if (!device) continue

    for (const diag of deviceDiagnostics[deviceId]) {
      if (diag.status !== 'resolved') {
        const key = diag.issue || diag.type
        issueTypes.set(key, (issueTypes.get(key) || 0) + 1)

        if (!issueDeviceTypes.has(key)) {
          issueDeviceTypes.set(key, new Set())
        }
        issueDeviceTypes.get(key)!.add(device.type)
      }
    }
  }

  // Add recommendations for offline devices
  const offlineCount = devices.filter(d => d.status === 'offline').length
  if (offlineCount > 0) {
    recommendations.push({
      type: 'maintenance_alert',
      message: `${offlineCount} device(s) are currently offline. This may affect service availability.`,
      action: `Check power, network connectivity, and restart offline devices. Review device logs for errors.`,
      priority: offlineCount > 2 ? 'high' : 'medium',
      deviceTypes: [...new Set(devices.filter(d => d.status === 'offline').map(d => d.type))]
    })
  }

  for (const [issue, count] of issueTypes.entries()) {
    if (count >= 1) {
      recommendations.push({
        type: 'maintenance_alert',
        message: `${count} device(s) experiencing ${issue}. This may affect user experience.`,
        action: `Investigate and resolve ${issue} across affected devices. Check device logs and network connectivity.`,
        priority: count > 2 ? 'high' : 'medium',
        deviceTypes: [...(issueDeviceTypes.get(issue) || new Set())]
      })
    }
  }

  // Filter based on device type
  let filteredInsights = insights
  let filteredRecommendations = recommendations

  if (deviceFilter !== 'all') {
    filteredInsights = insights.filter(insight => insight.deviceType === deviceFilter)
    filteredRecommendations = recommendations.filter(rec =>
      rec.deviceTypes.includes(deviceFilter)
    )
  }

  return {
    insights: filteredInsights,
    recommendations: filteredRecommendations,
    metrics: metrics
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const { searchParams } = new URL(request.url)
    const deviceFilter = searchParams.get('deviceType') || 'all'
    const timeframe = searchParams.get('timeframe') || '24h'

    const analysisResult = await performDeviceAnalysis(deviceFilter, timeframe)

    return NextResponse.json({
      success: true,
      ...analysisResult,
      analysisTimestamp: new Date().toISOString(),
      totalDevicesAnalyzed: Object.keys(analysisResult.metrics).length
    })

  } catch (error) {
    logger.error('[AI-ANALYSIS] Device AI analysis error (GET):', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze devices' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Body validation for POST requests
  const bodySchema = z.object({
    deviceFilter: z.string().optional(),
    timeframe: z.string().optional(),
    analysisTypes: z.array(z.string()).optional()
  })

  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { deviceFilter = 'all', timeframe = '24h' } = bodyValidation.data

    const analysisResult = await performDeviceAnalysis(deviceFilter, timeframe)

    return NextResponse.json({
      success: true,
      ...analysisResult,
      analysisTimestamp: new Date().toISOString(),
      totalDevicesAnalyzed: Object.keys(analysisResult.metrics).length
    })

  } catch (error) {
    logger.error('[AI-ANALYSIS] Device AI analysis error (POST):', error)
    logger.error('[AI-ANALYSIS] Error details:', {
      data: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      }
    })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze devices',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
