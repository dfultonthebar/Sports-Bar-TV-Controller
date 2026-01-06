import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

interface DeviceStatus {
  id: string
  name: string
  type: 'tv' | 'cable_box' | 'audio' | 'matrix' | 'other'
  status: 'online' | 'degraded' | 'offline' | 'unknown'
  health: number // 0-100
  lastSeen?: Date
  responseTime?: number
  issues: string[]
  quickActions: Array<{ label: string; action: string; params?: any }>
}

interface SystemHealthReport {
  timestamp: Date
  overall: {
    status: 'healthy' | 'degraded' | 'critical'
    health: number
    devicesOnline: number
    devicesTotal: number
    activeIssues: number
  }
  categories: {
    tvs: DeviceStatus[]
    cableBoxes: DeviceStatus[]
    audioZones: DeviceStatus[]
    matrix: DeviceStatus[]
    other: DeviceStatus[]
  }
  aiSuggestions: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low'
    message: string
    action?: string
    deviceId?: string
  }>
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const report: SystemHealthReport = {
      timestamp: new Date(),
      overall: {
        status: 'healthy',
        health: 100,
        devicesOnline: 0,
        devicesTotal: 0,
        activeIssues: 0
      },
      categories: {
        tvs: [],
        cableBoxes: [],
        audioZones: [],
        matrix: [],
        other: []
      },
      aiSuggestions: []
    }

    // Check Matrix Outputs (TVs)
    const outputs = await db
      .select()
      .from(schema.matrixOutputs)
      .where(eq(schema.matrixOutputs.isActive, true))
      .orderBy(asc(schema.matrixOutputs.channelNumber))
      .all()

    for (const output of outputs) {
      const device: DeviceStatus = {
        id: `tv-${output.id}`,
        name: output.label || `TV ${output.channelNumber}`,
        type: 'tv',
        status: 'unknown',
        health: 100,
        issues: [],
        quickActions: []
      }

      // Check if output is currently routed
      const activeMatrix = await db
        .select()
        .from(schema.matrixConfigurations)
        .where(eq(schema.matrixConfigurations.isActive, true))
        .limit(1)
        .get()

      if (activeMatrix) {
        // TV is online if part of active matrix
        device.status = 'online'
        device.quickActions.push({
          label: 'Switch Input',
          action: 'route_input',
          params: { output: output.channelNumber }
        })
      } else {
        device.status = 'unknown'
        device.issues.push('Matrix configuration not active')
      }

      report.categories.tvs.push(device)
      report.overall.devicesTotal++
      if (device.status === 'online') report.overall.devicesOnline++
    }

    // Check FireTV Devices
    const firetvDevices = await db
      .select()
      .from(schema.fireTVDevices)
      .all()

    for (const ftv of firetvDevices) {
      const device: DeviceStatus = {
        id: `firetv-${ftv.id}`,
        name: ftv.name,
        type: 'cable_box',
        status: ftv.status === 'connected' ? 'online' : 'offline',
        health: ftv.status === 'connected' ? 100 : 0,
        lastSeen: ftv.lastSeen ? new Date(ftv.lastSeen) : undefined,
        issues: [],
        quickActions: []
      }

      if (ftv.status !== 'connected') {
        device.issues.push(`Status: ${ftv.status}`)
        report.overall.activeIssues++
      }

      device.quickActions.push(
        { label: 'Launch App', action: 'firetv_app', params: { deviceId: ftv.id } },
        { label: 'Reconnect', action: 'firetv_reconnect', params: { deviceId: ftv.id } }
      )

      report.categories.cableBoxes.push(device)
      report.overall.devicesTotal++
      if (device.status === 'online') report.overall.devicesOnline++
    }

    // Check Soundtrack Audio Zones
    try {
      const soundtrackConfig = await db
        .select()
        .from(schema.soundtrackConfigs)
        .limit(1)
        .get()

      if (soundtrackConfig?.isActive && soundtrackConfig.apiKey) {
        const api = getSoundtrackAPI(soundtrackConfig.apiKey)
        const zones = await api.listSoundZones()

        for (const zone of zones) {
          // Note: Soundtrack API does not provide currentPlayback data via GraphQL
          // Zones are marked as online if they exist in the API response
          const device: DeviceStatus = {
            id: `audio-${zone.id}`,
            name: zone.name,
            type: 'audio',
            status: 'online', // Zone exists and is accessible via API
            health: 100,
            issues: [],
            quickActions: []
          }

          device.quickActions.push(
            { label: zone.currentPlayback?.playing ? 'Pause' : 'Play', action: 'soundtrack_toggle', params: { zoneId: zone.id } },
            { label: 'Volume', action: 'soundtrack_volume', params: { zoneId: zone.id } }
          )

          report.categories.audioZones.push(device)
          report.overall.devicesTotal++
          if (device.status === 'online') report.overall.devicesOnline++
        }
      }
    } catch (error) {
      logger.error('Error checking Soundtrack zones:', error)
      report.aiSuggestions.push({
        priority: 'medium',
        message: 'Unable to check Soundtrack audio zones. Check API configuration.',
        action: 'check_soundtrack_config'
      })
    }

    // Check Matrix Configuration
    const matrixConfig = await db
      .select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (matrixConfig) {
      const device: DeviceStatus = {
        id: `matrix-${matrixConfig.id}`,
        name: `Wolf Pack Matrix (${matrixConfig.ipAddress})`,
        type: 'matrix',
        status: 'online',
        health: 100,
        issues: [],
        quickActions: [
          { label: 'Route Input', action: 'matrix_route' },
          { label: 'View Routing', action: 'view_matrix' }
        ]
      }

      report.categories.matrix.push(device)
      report.overall.devicesTotal++
      report.overall.devicesOnline++
    } else {
      report.aiSuggestions.push({
        priority: 'high',
        message: 'No active matrix configuration found. Video routing may not work.',
        action: 'configure_matrix'
      })
    }

    // Calculate overall health
    const healthScores = [
      ...report.categories.tvs,
      ...report.categories.cableBoxes,
      ...report.categories.audioZones,
      ...report.categories.matrix
    ].map(d => d.health)

    if (healthScores.length > 0) {
      report.overall.health = Math.round(
        healthScores.reduce((sum, h) => sum + h, 0) / healthScores.length
      )
    }

    // Determine overall status
    if (report.overall.health >= 90) {
      report.overall.status = 'healthy'
    } else if (report.overall.health >= 70) {
      report.overall.status = 'degraded'
    } else {
      report.overall.status = 'critical'
    }

    // Generate AI suggestions based on issues
    if (report.overall.activeIssues > 0) {
      report.aiSuggestions.push({
        priority: 'high',
        message: `${report.overall.activeIssues} device(s) are offline or having issues. Click to view details and recommended actions.`,
        action: 'view_issues'
      })
    }

    // Check for devices with degraded performance
    const degradedDevices = [
      ...report.categories.tvs,
      ...report.categories.cableBoxes,
      ...report.categories.audioZones
    ].filter(d => d.status === 'degraded')

    if (degradedDevices.length > 0) {
      report.aiSuggestions.push({
        priority: 'medium',
        message: `${degradedDevices.length} device(s) showing degraded performance. Consider restarting during off-peak hours.`,
        action: 'schedule_maintenance'
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    logger.error('Error generating system health report:', error)
    logger.error('System health error details:', error)
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    logger.error('Error message:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      {
        error: 'Failed to generate health report',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
