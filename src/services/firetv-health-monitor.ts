/**
 * Fire TV Health Monitor - Background Service
 * 
 * Continuously monitors Fire TV device connections and automatically
 * reconnects devices that have lost connection.
 */

import { connectionManager, FireTVDevice } from './firetv-connection-manager'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')

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
 */
class FireTVHealthMonitor {
  private static instance: FireTVHealthMonitor
  private monitorInterval: NodeJS.Timeout | null = null
  private readonly HEALTH_CHECK_INTERVAL = 60000 // Check every 60 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  private readonly RECONNECT_BACKOFF_BASE = 2000 // Start with 2 seconds
  private readonly RECONNECT_BACKOFF_MAX = 60000 // Max 60 seconds between attempts
  
  private healthStatus: Map<string, HealthCheckResult> = new Map()
  private reconnectAttempts: Map<string, number> = new Map()
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map()
  private isMonitoring: boolean = false

  private constructor() {
    console.log('[HEALTH MONITOR] Initializing Fire TV Health Monitor')
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FireTVHealthMonitor {
    if (!FireTVHealthMonitor.instance) {
      FireTVHealthMonitor.instance = new FireTVHealthMonitor()
    }
    return FireTVHealthMonitor.instance
  }

  /**
   * Start monitoring all registered devices
   */
  public async start(): Promise<void> {
    if (this.isMonitoring) {
      console.log('[HEALTH MONITOR] Already monitoring')
      return
    }

    console.log('[HEALTH MONITOR] Starting health monitoring...')
    this.isMonitoring = true

    // Initialize connection manager
    await connectionManager.initialize()

    // Perform initial health check
    await this.performHealthCheck()

    // Start periodic health checks
    this.monitorInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, this.HEALTH_CHECK_INTERVAL)

    console.log(`[HEALTH MONITOR] Health monitoring started (interval: ${this.HEALTH_CHECK_INTERVAL / 1000}s)`)
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    console.log('[HEALTH MONITOR] Stopping health monitoring...')
    
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
    console.log('[HEALTH MONITOR] Health monitoring stopped')
  }

  /**
   * Perform health check on all devices
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.log('[HEALTH MONITOR] ========================================')
      console.log('[HEALTH MONITOR] Performing health check...')
      console.log('[HEALTH MONITOR] Timestamp:', new Date().toISOString())
      
      const devices = await this.loadDevices()
      
      if (devices.length === 0) {
        console.log('[HEALTH MONITOR] No devices registered')
        return
      }

      console.log(`[HEALTH MONITOR] Checking ${devices.length} devices`)

      // Check each device
      for (const device of devices) {
        await this.checkDeviceHealth(device)
      }

      console.log('[HEALTH MONITOR] Health check complete')
      console.log('[HEALTH MONITOR] ========================================')
    } catch (error) {
      console.error('[HEALTH MONITOR] Error during health check:', error)
    }
  }

  /**
   * Check health of a single device
   */
  private async checkDeviceHealth(device: FireTVDevice): Promise<void> {
    const deviceAddress = `${device.ipAddress}:${device.port}`
    
    try {
      console.log(`[HEALTH MONITOR] Checking device: ${device.name} (${deviceAddress})`)
      
      // Get connection status from connection manager
      const connectionStatus = connectionManager.getConnectionStatus(device.id)
      
      if (!connectionStatus) {
        // No connection exists - try to create one
        console.log(`[HEALTH MONITOR] No connection found for ${device.name}, creating...`)
        
        try {
          await connectionManager.getOrCreateConnection(device.id, device.ipAddress, device.port)
          
          // Connection created successfully
          this.updateHealthStatus(device, true)
          this.resetReconnectAttempts(device.id)
          
          console.log(`[HEALTH MONITOR] ✅ ${device.name} is HEALTHY (newly connected)`)
        } catch (error: any) {
          // Connection failed
          this.updateHealthStatus(device, false, error.message)
          console.log(`[HEALTH MONITOR] ❌ ${device.name} is UNHEALTHY (connection failed)`)
          
          // Schedule reconnection with backoff
          this.scheduleReconnection(device)
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
          
          console.log(`[HEALTH MONITOR] ✅ ${device.name} is HEALTHY`)
        } catch (error: any) {
          // Connection appears broken
          console.log(`[HEALTH MONITOR] ❌ ${device.name} connection is broken (${error.message})`)
          this.updateHealthStatus(device, false, error.message)
          
          // Schedule reconnection
          this.scheduleReconnection(device)
        }
      } else {
        // Connection is not in connected state
        console.log(`[HEALTH MONITOR] ⚠️ ${device.name} status: ${connectionStatus.status}`)
        this.updateHealthStatus(device, false, `Status: ${connectionStatus.status}`)
        
        // Schedule reconnection if in error state
        if (connectionStatus.status === 'error') {
          this.scheduleReconnection(device)
        }
      }
    } catch (error: any) {
      console.error(`[HEALTH MONITOR] Error checking ${device.name}:`, error.message)
      this.updateHealthStatus(device, false, error.message)
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnection(device: FireTVDevice): void {
    const attempts = this.reconnectAttempts.get(device.id) || 0
    
    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`[HEALTH MONITOR] Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached for ${device.name}`)
      console.log(`[HEALTH MONITOR] Device ${device.name} marked as offline - will retry on next health check cycle`)
      return
    }

    // Clear any existing reconnect timer
    const existingTimer = this.reconnectTimers.get(device.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Calculate backoff delay using exponential backoff
    const backoffDelay = Math.min(
      this.RECONNECT_BACKOFF_BASE * Math.pow(2, attempts),
      this.RECONNECT_BACKOFF_MAX
    )

    console.log(`[HEALTH MONITOR] Scheduling reconnection for ${device.name} in ${backoffDelay / 1000}s (attempt ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`)

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
    
    console.log(`[HEALTH MONITOR] Attempting reconnection for ${device.name} (attempt ${attempts}/${this.MAX_RECONNECT_ATTEMPTS})`)

    try {
      await connectionManager.reconnect(device.id)
      
      // Reconnection successful
      console.log(`[HEALTH MONITOR] ✅ Reconnection successful for ${device.name}`)
      this.updateHealthStatus(device, true)
      this.resetReconnectAttempts(device.id)
      
    } catch (error: any) {
      console.error(`[HEALTH MONITOR] ❌ Reconnection failed for ${device.name}:`, error.message)
      this.updateHealthStatus(device, false, error.message)
      
      // Schedule another attempt if we haven't exceeded max attempts
      const currentAttempts = this.reconnectAttempts.get(device.id) || 0
      if (currentAttempts < this.MAX_RECONNECT_ATTEMPTS) {
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
    console.log('[HEALTH MONITOR] Force health check requested')
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
      console.error('[HEALTH MONITOR] Error loading devices:', error)
      return []
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
    isMonitoring: boolean
  } {
    const statuses = Array.from(this.healthStatus.values())
    
    return {
      totalDevices: statuses.length,
      healthyDevices: statuses.filter(s => s.isHealthy).length,
      unhealthyDevices: statuses.filter(s => !s.isHealthy).length,
      reconnectingDevices: statuses.filter(s => s.reconnectAttempts > 0).length,
      isMonitoring: this.isMonitoring
    }
  }
}

// Export singleton instance
export const healthMonitor = FireTVHealthMonitor.getInstance()

// Auto-start monitoring when module is loaded (in server environment)
if (typeof window === 'undefined') {
  // We're on the server - start monitoring after a short delay
  setTimeout(() => {
    healthMonitor.start().catch(error => {
      console.error('[HEALTH MONITOR] Failed to start:', error)
    })
  }, 5000) // Wait 5 seconds after server starts
}

// Cleanup on process termination
process.on('SIGTERM', () => {
  console.log('[HEALTH MONITOR] SIGTERM received')
  healthMonitor.stop()
})

process.on('SIGINT', () => {
  console.log('[HEALTH MONITOR] SIGINT received')
  healthMonitor.stop()
})
