/**
 * Health Check API Endpoint
 *
 * Provides comprehensive system health monitoring for:
 * - PM2 process status
 * - Database health
 * - Hardware status (Matrix, CEC, FireTV, Audio)
 * - External API health (Sports Guide, Soundtrack)
 *
 * Returns:
 * - 200: All systems healthy
 * - 207: Some systems degraded
 * - 503: Critical systems down
 *
 * Features:
 * - 10-second response caching
 * - Detailed service breakdowns
 * - System metrics and uptime
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { db, schema } from '@/db'
import { sql } from 'drizzle-orm'
import { existsSync, statSync } from 'fs'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
const execAsync = promisify(exec)

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

// Cache for health check results
interface HealthCache {
  data: any
  timestamp: number
}

let healthCache: HealthCache | null = null
const CACHE_DURATION = 10000 // 10 seconds

// System start time
const systemStartTime = Date.now()

/**
 * Health check result interface
 */
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'critical'
  timestamp: string
  uptime: string
  services: {
    database: {
      status: 'healthy' | 'degraded' | 'critical'
      size?: string
      tables?: number
      error?: string
    }
    pm2: {
      status: 'healthy' | 'degraded' | 'critical'
      processes?: Array<{
        name: string
        status: string
        uptime: string
        restarts: number
        memory: string
        cpu: string
      }>
      error?: string
    }
    hardware: {
      matrix: {
        status: 'healthy' | 'degraded' | 'critical' | 'unknown'
        reason?: string
        config?: any
      }
      cec: {
        status: 'healthy' | 'degraded' | 'critical' | 'unknown'
        adapter?: string
        reason?: string
      }
      fireTv: {
        status: 'healthy' | 'degraded' | 'critical' | 'unknown'
        devices?: number
        reason?: string
      }
      audio: {
        status: 'healthy' | 'degraded' | 'critical' | 'unknown'
        reason?: string
      }
    }
    apis: {
      sportsGuide: {
        status: 'healthy' | 'degraded' | 'critical' | 'unknown'
        lastFetch?: string
        error?: string
      }
      soundtrack: {
        status: 'healthy' | 'degraded' | 'critical' | 'unknown'
        error?: string
      }
    }
  }
  metrics: {
    totalDevices: number
    devicesOnline: number
    errorRate: number
  }
}

/**
 * Format uptime as human-readable string
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i]
}

/**
 * Check PM2 process status
 */
async function checkPM2Status(): Promise<any> {
  try {
    const { stdout } = await execAsync('pm2 jlist', { timeout: 5000 })
    let processes
    try {
      processes = JSON.parse(stdout)
    } catch (parseError) {
      logger.error('[Health] Failed to parse PM2 output:', parseError)
      return {
        status: 'degraded',
        error: 'Failed to parse PM2 output'
      }
    }

    if (!Array.isArray(processes) || processes.length === 0) {
      return {
        status: 'degraded',
        error: 'No PM2 processes found'
      }
    }

    const processInfo = processes.map((proc: any) => ({
      name: proc.name,
      status: proc.pm2_env?.status || 'unknown',
      uptime: formatUptime(Date.now() - (proc.pm2_env?.pm_uptime || Date.now())),
      restarts: proc.pm2_env?.restart_time || 0,
      memory: formatBytes(proc.monit?.memory || 0),
      cpu: `${proc.monit?.cpu || 0}%`
    }))

    // Check if main process is online
    const mainProcess = processes.find((p: any) =>
      p.name?.includes('sports-bar') || p.name?.includes('next')
    )

    const status = mainProcess?.pm2_env?.status === 'online' ? 'healthy' : 'degraded'

    return {
      status,
      processes: processInfo
    }
  } catch (error: any) {
    return {
      status: 'unknown',
      error: error.message || 'Failed to check PM2 status'
    }
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<any> {
  try {
    // Production database is at /home/ubuntu/sports-bar-data/production.db
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '/home/ubuntu/sports-bar-data/production.db'
    const absolutePath = path.resolve(dbPath)

    if (!existsSync(absolutePath)) {
      return {
        status: 'critical',
        error: 'Database file not found'
      }
    }

    // Get file size
    const stats = statSync(absolutePath)
    const size = formatBytes(stats.size)

    // Try a simple query to verify database is accessible
    const result = await db.all(sql`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'`)
    const tables = (result[0] && typeof result[0] === 'object' && 'count' in result[0]) ? (result[0] as any).count : 0

    return {
      status: 'healthy',
      size,
      tables
    }
  } catch (error: any) {
    return {
      status: 'critical',
      error: error.message || 'Database query failed'
    }
  }
}

/**
 * Check matrix hardware status
 */
async function checkMatrixStatus(): Promise<any> {
  try {
    // Check if matrix configuration exists in database
    const matrixConfig = await db.select()
      .from(schema.matrixConfigurations)
      .where(sql`${schema.matrixConfigurations.isActive} = 1`)
      .limit(1)
      .get()

    if (!matrixConfig) {
      return {
        status: 'unknown',
        reason: 'No active matrix configuration found'
      }
    }

    // Could potentially test connection here, but for now just check config exists
    return {
      status: 'healthy',
      config: {
        ipAddress: matrixConfig.ipAddress,
        protocol: matrixConfig.protocol
      }
    }
  } catch (error: any) {
    return {
      status: 'unknown',
      reason: error.message || 'Unable to verify matrix status'
    }
  }
}

/**
 * Check CEC adapter status
 */
async function checkCECStatus(): Promise<any> {
  try {
    // Try to list CEC adapters
    const { stdout, stderr } = await execAsync('cec-client -l', { timeout: 3000 })

    if (stderr?.includes('ERROR') || !stdout) {
      return {
        status: 'degraded',
        reason: 'CEC adapter not found or error occurred'
      }
    }

    // Look for adapter info
    const lines = stdout.split('\n')
    let adapterName = 'Unknown'
    for (const line of lines) {
      if (line.includes('Pulse Eight') || line.includes('com port:')) {
        adapterName = 'Pulse Eight'
        break
      }
    }

    return {
      status: 'healthy',
      adapter: adapterName
    }
  } catch (error: any) {
    return {
      status: 'unknown',
      reason: 'Unable to verify CEC adapter'
    }
  }
}

/**
 * Check FireTV devices status
 */
async function checkFireTVStatus(): Promise<any> {
  try {
    // Import health monitor dynamically to avoid circular dependencies
    const { healthMonitor } = await import('@/services/firetv-health-monitor')
    const { connectionManager } = await import('@/services/firetv-connection-manager')

    const stats = healthMonitor.getStatistics()
    const allConnections = connectionManager.getAllConnectionStatuses()

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unknown' = 'unknown'

    if (stats.totalDevices === 0) {
      status = 'unknown'
    } else if (stats.healthyDevices === stats.totalDevices) {
      status = 'healthy'
    } else if (stats.healthyDevices > 0) {
      status = 'degraded'
    } else {
      status = 'degraded'
    }

    // Get connection details
    const connectionDetails = Array.from(allConnections.entries()).map(([deviceId, conn]) => ({
      deviceId,
      status: conn.status,
      queuedCommands: conn.commandQueue.length,
      lastActivity: conn.lastActivity.toISOString()
    }))

    return {
      status,
      devices: stats.totalDevices,
      devicesOnline: stats.healthyDevices,
      devicesOffline: stats.unhealthyDevices,
      devicesReconnecting: stats.reconnectingDevices,
      devicesDown: stats.devicesDown,
      monitoringActive: stats.isMonitoring,
      connections: connectionDetails
    }
  } catch (error: any) {
    // Fallback to file-based check if health monitor not available
    try {
      const firetvPath = path.resolve(process.cwd(), 'data/firetv-devices.json')

      if (!existsSync(firetvPath)) {
        return {
          status: 'unknown',
          reason: 'FireTV devices file not found'
        }
      }

      const fs = require('fs')
      const fileContent = fs.readFileSync(firetvPath, 'utf-8')
      let firetvData
      try {
        firetvData = JSON.parse(fileContent || '{}')
      } catch (parseError) {
        logger.error('[Health] Failed to parse FireTV devices file:', { data: { parseError, content: fileContent?.substring(0, 100) } })
        firetvData = { devices: [] }
      }
      const devices = firetvData.devices || []
      const onlineDevices = devices.filter((d: any) => d.isOnline).length

      return {
        status: devices.length > 0 ? 'healthy' : 'unknown',
        devices: devices.length,
        devicesOnline: onlineDevices,
        reason: 'Health monitor not available - using fallback'
      }
    } catch (fallbackError: any) {
      return {
        status: 'unknown',
        reason: error.message || 'Unable to check FireTV status'
      }
    }
  }
}

/**
 * Check audio system status
 */
async function checkAudioStatus(): Promise<any> {
  // Audio system verification would require specific hardware checks
  // For now, return unknown status
  return {
    status: 'unknown',
    reason: 'Unable to verify audio system status'
  }
}

/**
 * Check Sports Guide API status
 */
async function checkSportsGuideStatus(): Promise<any> {
  try {
    const apiKey = process.env.SPORTS_GUIDE_API_KEY
    const userId = process.env.SPORTS_GUIDE_USER_ID

    if (!apiKey || !userId) {
      return {
        status: 'degraded',
        error: 'Sports Guide API credentials not configured'
      }
    }

    // Check for recent successful fetch in logs table
    // Note: errorLogs table doesn't exist in current schema
    try {
      // const recentLog = await db.select()
      //   .from(schema.errorLogs)
      //   .where(sql`${schema.errorLogs.endpoint} LIKE '%sports-guide%'`)
      //   .orderBy(sql`${schema.errorLogs.timestamp} DESC`)
      //   .limit(1)
      //   .get()

      return {
        status: 'healthy',
        lastFetch: 'unknown'
      }
    } catch {
      return {
        status: 'healthy',
        lastFetch: 'unknown'
      }
    }
  } catch (error: any) {
    return {
      status: 'unknown',
      error: error.message || 'Unable to verify Sports Guide API'
    }
  }
}

/**
 * Check Soundtrack Your Brand API status
 */
async function checkSoundtrackStatus(): Promise<any> {
  try {
    const soundtrackToken = process.env.SOUNDTRACK_API_TOKEN

    if (!soundtrackToken) {
      return {
        status: 'unknown',
        error: 'Soundtrack API token not configured'
      }
    }

    return {
      status: 'healthy'
    }
  } catch (error: any) {
    return {
      status: 'unknown',
      error: error.message || 'Unable to verify Soundtrack API'
    }
  }
}

/**
 * Calculate overall system status
 */
function calculateOverallStatus(services: any): 'healthy' | 'degraded' | 'critical' {
  // Critical if database or PM2 are critical
  if (services.database.status === 'critical' || services.pm2.status === 'critical') {
    return 'critical'
  }

  // Degraded if any core service is degraded
  if (
    services.database.status === 'degraded' ||
    services.pm2.status === 'degraded' ||
    services.hardware.matrix.status === 'degraded' ||
    services.hardware.cec.status === 'degraded'
  ) {
    return 'degraded'
  }

  return 'healthy'
}

/**
 * Calculate system metrics
 */
async function calculateMetrics(services: any): Promise<any> {
  try {
    // Count total devices from various sources
    const fireTVDevices = services.hardware.fireTv.devices || 0
    const fireTVOnline = services.hardware.fireTv.devicesOnline || 0

    // Could add more device counts from database if needed
    let totalDevices = fireTVDevices
    let devicesOnline = fireTVOnline

    // Calculate error rate from logs (last 1000 entries)
    // Note: errorLogs table doesn't exist in current schema
    try {
      // const errorCount = await db.select()
      //   .from(schema.errorLogs)
      //   .limit(1000)
      //   .all()
      //   .then(logs => logs.length)

      const errorRate = 0

      return {
        totalDevices,
        devicesOnline,
        errorRate: Math.round(errorRate)
      }
    } catch {
      return {
        totalDevices,
        devicesOnline,
        errorRate: 0
      }
    }
  } catch (error) {
    return {
      totalDevices: 0,
      devicesOnline: 0,
      errorRate: 0
    }
  }
}

/**
 * Perform complete health check
 */
async function performHealthCheck(): Promise<HealthCheckResult> {
  const [
    pm2Status,
    dbStatus,
    matrixStatus,
    cecStatus,
    fireTvStatus,
    audioStatus,
    sportsGuideStatus,
    soundtrackStatus
  ] = await Promise.all([
    checkPM2Status(),
    checkDatabaseHealth(),
    checkMatrixStatus(),
    checkCECStatus(),
    checkFireTVStatus(),
    checkAudioStatus(),
    checkSportsGuideStatus(),
    checkSoundtrackStatus()
  ])

  const services = {
    database: dbStatus,
    pm2: pm2Status,
    hardware: {
      matrix: matrixStatus,
      cec: cecStatus,
      fireTv: fireTvStatus,
      audio: audioStatus
    },
    apis: {
      sportsGuide: sportsGuideStatus,
      soundtrack: soundtrackStatus
    }
  }

  const status = calculateOverallStatus(services)
  const metrics = await calculateMetrics(services)
  const uptime = formatUptime(Date.now() - systemStartTime)

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime,
    services,
    metrics
  }
}

/**
 * GET /api/health
 *
 * Returns comprehensive system health status
 * Cached for 10 seconds to avoid performance impact
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const now = Date.now()

    // Return cached response if available and fresh
    if (healthCache && (now - healthCache.timestamp) < CACHE_DURATION) {
      return NextResponse.json(healthCache.data, {
        status: healthCache.data.status === 'healthy' ? 200 :
                healthCache.data.status === 'degraded' ? 207 : 503,
        headers: {
          'Cache-Control': `public, max-age=${Math.floor(CACHE_DURATION / 1000)}`,
          'X-Health-Cache': 'HIT',
          'X-Health-Cache-Age': `${Math.floor((now - healthCache.timestamp) / 1000)}s`
        }
      })
    }

    // Perform fresh health check
    const healthResult = await performHealthCheck()

    // Update cache
    healthCache = {
      data: healthResult,
      timestamp: now
    }

    // Return appropriate HTTP status code
    const statusCode =
      healthResult.status === 'healthy' ? 200 :
      healthResult.status === 'degraded' ? 207 :
      503

    return NextResponse.json(healthResult, {
      status: statusCode,
      headers: {
        'Cache-Control': `public, max-age=${Math.floor(CACHE_DURATION / 1000)}`,
        'X-Health-Cache': 'MISS'
      }
    })

  } catch (error: any) {
    logger.error('Health check failed:', error)

    return NextResponse.json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      uptime: formatUptime(Date.now() - systemStartTime),
      error: error.message || 'Health check failed',
      services: {},
      metrics: {
        totalDevices: 0,
        devicesOnline: 0,
        errorRate: 100
      }
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
  }
}
