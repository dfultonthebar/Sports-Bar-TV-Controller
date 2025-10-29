import { NextRequest, NextResponse } from 'next/server'
import { findMany, findFirst, eq, asc } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'

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
    const outputs = await findMany('matrixOutputs', {
      where: eq(schema.matrixOutputs.isActive, true),
      orderBy: asc(schema.matrixOutputs.channelNumber)
    })

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
      const activeMatrix = await findFirst('matrixConfigurations', {
        where: eq(schema.matrixConfigurations.isActive, true)
      })

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

    // Check DirectV Devices
    const directvDevices = await findMany('directvDevices', {
      where: eq(schema.directvDevices.isActive, true)
    })

    for (const dv of directvDevices) {
      const device: DeviceStatus = {
        id: `directv-${dv.id}`,
        name: dv.name,
        type: 'cable_box',
        status: dv.isOnline ? 'online' : 'offline',
        health: dv.isOnline ? 100 : 0,
        lastSeen: dv.lastSeen ? new Date(dv.lastSeen) : undefined,
        issues: [],
        quickActions: []
      }

      if (!dv.isOnline) {
        device.issues.push('Device offline')
        report.overall.activeIssues++
      }

      // Check last seen time
      if (dv.lastSeen) {
        const minutesSinceLastSeen = (Date.now() - new Date(dv.lastSeen).getTime()) / 1000 / 60
        if (minutesSinceLastSeen > 60) {
          device.status = 'degraded'
          device.health = 50
          device.issues.push(`Last seen ${Math.round(minutesSinceLastSeen)} minutes ago`)
        }
      }

      device.quickActions.push(
        { label: 'Change Channel', action: 'directv_channel', params: { deviceId: dv.id } },
        { label: 'Restart', action: 'directv_restart', params: { deviceId: dv.id } }
      )

      report.categories.cableBoxes.push(device)
      report.overall.devicesTotal++
      if (device.status === 'online') report.overall.devicesOnline++
    }

    // Check FireTV Devices
    const firetvDevices = await findMany('firetvDevices', {
      where: eq(schema.firetvDevices.isActive, true)
    })

    for (const ftv of firetvDevices) {
      const device: DeviceStatus = {
        id: `firetv-${ftv.id}`,
        name: ftv.name,
        type: 'cable_box',
        status: ftv.connectionStatus === 'connected' ? 'online' : 'offline',
        health: ftv.connectionStatus === 'connected' ? 100 : 0,
        lastSeen: ftv.lastConnected ? new Date(ftv.lastConnected) : undefined,
        issues: [],
        quickActions: []
      }

      if (ftv.connectionStatus !== 'connected') {
        device.issues.push(`Status: ${ftv.connectionStatus}`)
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
      const soundtrackConfig = await findFirst('soundtrackConfigs')
      if (soundtrackConfig?.isActive && soundtrackConfig.apiKey) {
        const api = getSoundtrackAPI(soundtrackConfig.apiKey)
        const zones = await api.listSoundZones()

        for (const zone of zones) {
          const device: DeviceStatus = {
            id: `audio-${zone.id}`,
            name: zone.name,
            type: 'audio',
            status: zone.currentPlayback ? 'online' : 'degraded',
            health: zone.currentPlayback ? 100 : 70,
            issues: [],
            quickActions: []
          }

          if (!zone.currentPlayback) {
            device.issues.push('No playback data available')
          } else if (!zone.currentPlayback.playing) {
            device.issues.push('Paused')
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
    const matrixConfig = await findFirst('matrixConfigurations', {
      where: eq(schema.matrixConfigurations.isActive, true)
    })

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
    return NextResponse.json(
      { error: 'Failed to generate health report' },
      { status: 500 }
    )
  }
}
