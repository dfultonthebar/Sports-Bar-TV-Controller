/**
 * Fire TV Health Monitor - Background Service
 * 
 * Continuously monitors Fire TV device connections and automatically
 * reconnects devices that have lost connection.
 */

import { connectionManager, FireTVDevice } from './firetv-connection-manager'
import { promises as fs } from 'fs'
import path from 'path'
import { getFireTVConfig, calculateBackoffDelay } from '@/config/firetv-config'

import { logger } from '@sports-bar/logger'
const DATA_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')
const config = getFireTVConfig()

export interface HealthCheckResult {
  deviceId: string
  deviceName: string
  deviceAddress: string
  isHealthy: boolean
  lastCheck: Date
  error?: string
  reconnectAttempts: number
}

/**
 * Singleton health monitor for Fire TV devices
 *
 * Uses global object to ensure true singleton across Next.js module contexts
 */
class FireTVHealthMonitor {
  private monitorInterval: NodeJS.Timeout | null = null

  private healthStatus: Map<string, HealthCheckResult> = new Map()
  private reconnectAttempts: Map<string, number> = new Map()
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map()
  private downSince: Map<string, Date> = new Map() // Track when device went down
  private alertsSent: Set<string> = new Set() // Track which devices we've alerted for
  private isMonitoring: boolean = false

  private constructor() {
    logger.info('[HEALTH MONITOR] Initializing Fire TV Health Monitor')
  }

  /**
   * Get singleton instance
   * Uses global object to prevent Next.js from creating multiple instances
   */
  public static getInstance(): FireTVHealthMonitor {
    // Use global object to ensure singleton across module contexts
    const globalAny = global as any
    if (!globalAny.__fireTVHealthMonitor) {
      globalAny.__fireTVHealthMonitor = new FireTVHealthMonitor()
    }
    return globalAny.__fireTVHealthMonitor
  }

  /**
   * Start monitoring all registered devices
   */
  public async start(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('[HEALTH MONITOR] Already monitoring - ignoring duplicate start() call')
      return
    }

    if (!config.healthCheck.enabled) {
      logger.info('[HEALTH MONITOR] Health monitoring is disabled in configuration')
      return
    }

    logger.info('[HEALTH MONITOR] Starting health monitoring...')
    logger.info(`[HEALTH MONITOR] Configuration:`)
    logger.info(`  - Check interval: ${config.healthCheck.interval / 1000}s`)
    logger.info(`  - Max reconnect attempts: ${config.reconnection.maxAttempts}`)
    logger.info(`  - Backoff strategy: ${config.reconnection.backoffStrategy}`)
    logger.info(`  - Alert threshold: ${config.alerts.downTimeThreshold / 1000}s`)

    this.isMonitoring = true

    // Initialize connection manager
    await connectionManager.initialize()

    // Perform initial health check
    await this.performHealthCheck()

    // Clear existing interval if any to prevent memory leaks
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
    }

    // Start periodic health checks
    this.monitorInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, config.healthCheck.interval)

    logger.info(`[HEALTH MONITOR] Health monitoring started`)
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    logger.info('[HEALTH MONITOR] Stopping health monitoring...')
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer)
    }
    this.reconnectTimers.clear()

    this.isMonitoring = false
    logger.info('[HEALTH MONITOR] Health monitoring stopped')
  }

  /**
   * Perform health check on all devices
   */
  private async performHealthCheck(): Promise<void> {
    try {
      if (config.logging.logHealthChecks) {
        logger.info('[HEALTH MONITOR] ========================================')
        logger.info('[HEALTH MONITOR] Performing health check...')
        logger.info('[HEALTH MONITOR] Timestamp:', { data: new Date().toISOString() })
      }

      const devices = await this.loadDevices()

      if (devices.length === 0) {
        if (config.logging.logHealthChecks) {
          logger.info('[HEALTH MONITOR] No devices registered')
        }
        return
      }

      if (config.logging.logHealthChecks) {
        logger.info(`[HEALTH MONITOR] Checking ${devices.length} devices`)
      }

      // Check each device
      for (const device of devices) {
        await this.checkDeviceHealth(device)
      }

      // Check for devices down longer than threshold
      if (config.alerts.enabled) {
        this.checkDownTimeAlerts()
      }

      if (config.logging.logHealthChecks) {
        logger.info('[HEALTH MONITOR] Health check complete')
        logger.info('[HEALTH MONITOR] ========================================')
      }
    } catch (error) {
      logger.error('[HEALTH MONITOR] Error during health check:', error)
    }
  }

  /**
   * Check health of a single device
   */
  private async checkDeviceHealth(device: FireTVDevice): Promise<void> {
    const deviceAddress = `${device.ipAddress}:${device.port}`

    try {
      if (config.logging.logHealthChecks) {
        logger.info(`[HEALTH MONITOR] Checking device: ${device.name} (${deviceAddress})`)
      }

      // Get connection status from connection manager
      const connectionStatus = connectionManager.getConnectionStatus(device.id)

      if (!connectionStatus) {
        // No connection exists - try to create one
        if (config.logging.logHealthChecks) {
          logger.info(`[HEALTH MONITOR] No connection found for ${device.name}, creating...`)
        }

        try {
          await connectionManager.getOrCreateConnection(device.id, device.ipAddress, device.port)

          // Connection created successfully
          this.updateHealthStatus(device, true)
          this.resetReconnectAttempts(device.id)
          this.clearDownTime(device.id)

          logger.info(`[HEALTH MONITOR] ✅ ${device.name} is HEALTHY (newly connected)`)
        } catch (error: any) {
          // Connection failed
          this.updateHealthStatus(device, false, error.message)
          this.trackDownTime(device.id)

          logger.info(`[HEALTH MONITOR] ❌ ${device.name} is UNHEALTHY (connection failed)`)

          // Schedule reconnection with backoff
          if (config.reconnection.enabled) {
            this.scheduleReconnection(device)
          }
        }

        return
      }

      // Connection exists - check if it's healthy
      if (connectionStatus.status === 'connected') {
        // Try a simple command to verify connection is actually alive
        try {
          const client = connectionStatus.client
          await client.executeShellCommand('echo healthcheck')

          // Connection is healthy
          this.updateHealthStatus(device, true)
          this.resetReconnectAttempts(device.id)
          this.clearDownTime(device.id)

          if (config.logging.logHealthChecks) {
            logger.info(`[HEALTH MONITOR] ✅ ${device.name} is HEALTHY`)
          }
        } catch (error: any) {
          // Connection appears broken
          logger.info(`[HEALTH MONITOR] ❌ ${device.name} connection is broken (${error.message})`)
          this.updateHealthStatus(device, false, error.message)
          this.trackDownTime(device.id)

          // Schedule reconnection
          if (config.reconnection.enabled) {
            this.scheduleReconnection(device)
          }
        }
      } else {
        // Connection is not in connected state
        logger.info(`[HEALTH MONITOR] ⚠️ ${device.name} status: ${connectionStatus.status}`)
        this.updateHealthStatus(device, false, `Status: ${connectionStatus.status}`)
        this.trackDownTime(device.id)

        // Schedule reconnection if in error state
        if (connectionStatus.status === 'error' && config.reconnection.enabled) {
          this.scheduleReconnection(device)
        }
      }
    } catch (error: any) {
      logger.error(`[HEALTH MONITOR] Error checking ${device.name}:`, error.message)
      this.updateHealthStatus(device, false, error.message)
      this.trackDownTime(device.id)
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnection(device: FireTVDevice): void {
    const attempts = this.reconnectAttempts.get(device.id) || 0

    if (attempts >= config.reconnection.maxAttempts) {
      logger.info(`[HEALTH MONITOR] Max reconnection attempts (${config.reconnection.maxAttempts}) reached for ${device.name}`)
      logger.info(`[HEALTH MONITOR] Device ${device.name} marked as offline - will retry on next health check cycle`)
      return
    }

    // Clear any existing reconnect timer
    const existingTimer = this.reconnectTimers.get(device.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Calculate backoff delay using configured strategy
    const backoffDelay = calculateBackoffDelay(attempts, config.reconnection)

    if (config.logging.logReconnections) {
      logger.info(`[HEALTH MONITOR] Scheduling reconnection for ${device.name} in ${backoffDelay / 1000}s (attempt ${attempts + 1}/${config.reconnection.maxAttempts})`)
    }

    // Schedule reconnection
    const timer = setTimeout(async () => {
      await this.attemptReconnection(device)
    }, backoffDelay)

    this.reconnectTimers.set(device.id, timer)
    this.reconnectAttempts.set(device.id, attempts + 1)
  }

  /**
   * Attempt to reconnect a device
   */
  private async attemptReconnection(device: FireTVDevice): Promise<void> {
    const attempts = this.reconnectAttempts.get(device.id) || 0

    if (config.logging.logReconnections) {
      logger.info(`[HEALTH MONITOR] Attempting reconnection for ${device.name} (attempt ${attempts}/${config.reconnection.maxAttempts})`)
    }

    try {
      await connectionManager.reconnect(device.id)

      // Reconnection successful
      logger.info(`[HEALTH MONITOR] ✅ Reconnection successful for ${device.name}`)
      this.updateHealthStatus(device, true)

      if (config.reconnection.resetOnSuccess) {
        this.resetReconnectAttempts(device.id)
      }

      this.clearDownTime(device.id)

    } catch (error: any) {
      logger.error(`[HEALTH MONITOR] ❌ Reconnection failed for ${device.name}:`, error.message)
      this.updateHealthStatus(device, false, error.message)

      // Schedule another attempt if we haven't exceeded max attempts
      const currentAttempts = this.reconnectAttempts.get(device.id) || 0
      if (currentAttempts < config.reconnection.maxAttempts) {
        this.scheduleReconnection(device)
      }
    }
  }

  /**
   * Update health status for a device
   */
  private updateHealthStatus(device: FireTVDevice, isHealthy: boolean, error?: string): void {
    const deviceAddress = `${device.ipAddress}:${device.port}`
    const attempts = this.reconnectAttempts.get(device.id) || 0
    
    this.healthStatus.set(device.id, {
      deviceId: device.id,
      deviceName: device.name,
      deviceAddress,
      isHealthy,
      lastCheck: new Date(),
      error,
      reconnectAttempts: attempts
    })
  }

  /**
   * Reset reconnect attempts for a device
   */
  private resetReconnectAttempts(deviceId: string): void {
    this.reconnectAttempts.delete(deviceId)
    
    const timer = this.reconnectTimers.get(deviceId)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(deviceId)
    }
  }

  /**
   * Get health status for all devices
   */
  public getHealthStatus(): Map<string, HealthCheckResult> {
    return new Map(this.healthStatus)
  }

  /**
   * Get health status for a specific device
   */
  public getDeviceHealthStatus(deviceId: string): HealthCheckResult | null {
    return this.healthStatus.get(deviceId) || null
  }

  /**
   * Force a health check now
   */
  public async forceHealthCheck(): Promise<void> {
    logger.info('[HEALTH MONITOR] Force health check requested')
    await this.performHealthCheck()
  }

  /**
   * Load devices from database
   */
  private async loadDevices(): Promise<FireTVDevice[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      return parsed.devices || []
    } catch (error) {
      logger.error('[HEALTH MONITOR] Error loading devices:', error)
      return []
    }
  }

  /**
   * Track when a device went down
   */
  private trackDownTime(deviceId: string): void {
    if (!this.downSince.has(deviceId)) {
      this.downSince.set(deviceId, new Date())
      logger.info(`[HEALTH MONITOR] Device ${deviceId} marked as down at ${new Date().toISOString()}`)
    }
  }

  /**
   * Clear down time tracking for a device
   */
  private clearDownTime(deviceId: string): void {
    if (this.downSince.has(deviceId)) {
      const downTime = Date.now() - this.downSince.get(deviceId)!.getTime()
      logger.info(`[HEALTH MONITOR] Device ${deviceId} recovered after ${Math.floor(downTime / 1000)}s downtime`)
      this.downSince.delete(deviceId)
      this.alertsSent.delete(deviceId)
    }
  }

  /**
   * Check for devices that have been down longer than threshold and alert
   */
  private checkDownTimeAlerts(): void {
    const now = Date.now()

    for (const [deviceId, downSince] of this.downSince.entries()) {
      const downTime = now - downSince.getTime()

      // Check if device has been down longer than threshold
      if (downTime > config.alerts.downTimeThreshold && !this.alertsSent.has(deviceId)) {
        const health = this.healthStatus.get(deviceId)
        const deviceName = health?.deviceName || deviceId

        logger.error(`[HEALTH MONITOR] 🚨 ALERT: Device ${deviceName} has been down for ${Math.floor(downTime / 1000 / 60)} minutes`)
        logger.error(`[HEALTH MONITOR] Last error: ${health?.error || 'Unknown'}`)

        // Mark alert as sent
        this.alertsSent.add(deviceId)

        // In the future, this could send notifications via email, Slack, etc.
      }
    }
  }

  /**
   * Get monitoring statistics
   */
  public getStatistics(): {
    totalDevices: number
    healthyDevices: number
    unhealthyDevices: number
    reconnectingDevices: number
    devicesDown: number
    isMonitoring: boolean
  } {
    const statuses = Array.from(this.healthStatus.values())

    return {
      totalDevices: statuses.length,
      healthyDevices: statuses.filter(s => s.isHealthy).length,
      unhealthyDevices: statuses.filter(s => !s.isHealthy).length,
      reconnectingDevices: statuses.filter(s => s.reconnectAttempts > 0).length,
      devicesDown: this.downSince.size,
      isMonitoring: this.isMonitoring
    }
  }
}

// Export singleton getter (NOT instance) to avoid module loading issues
// IMPORTANT: Always call getInstance() instead of exporting the instance directly
// This prevents Next.js from creating multiple instances during module loading
export const healthMonitor = FireTVHealthMonitor.getInstance()

// Note: Health monitor is started via instrumentation.ts
// Do NOT auto-start here to prevent duplicate instances

// Cleanup on process termination
// Use getInstance() to ensure we get the correct singleton instance
process.on('SIGTERM', () => {
  logger.info('[HEALTH MONITOR] SIGTERM received')
  FireTVHealthMonitor.getInstance().stop()
})

process.on('SIGINT', () => {
  logger.info('[HEALTH MONITOR] SIGINT received')
  FireTVHealthMonitor.getInstance().stop()
})
