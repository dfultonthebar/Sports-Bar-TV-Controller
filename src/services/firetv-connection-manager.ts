/**
 * Fire TV Connection Manager - Global Singleton Service
 * 
 * Manages persistent ADB connections to all Fire TV devices.
 * Provides connection pooling, health monitoring, and automatic reconnection.
 */

import { ADBClient } from '@/lib/firecube/adb-client'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')

export interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceType: string
  isOnline: boolean
  adbEnabled?: boolean
  addedAt: string
  updatedAt?: string
  inputChannel?: number
  serialNumber?: string
  deviceModel?: string
  softwareVersion?: string
  lastSeen?: string
  keepAwakeEnabled?: boolean
  keepAwakeStart?: string
  keepAwakeEnd?: string
}

export interface ConnectionInfo {
  deviceId: string
  deviceAddress: string
  client: ADBClient
  lastActivity: Date
  connectionAttempts: number
  lastError?: string
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
}

/**
 * Singleton connection manager for Fire TV devices
 */
class FireTVConnectionManager {
  private static instance: FireTVConnectionManager
  private connections: Map<string, ConnectionInfo> = new Map()
  private readonly CONNECTION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private readonly KEEP_ALIVE_INTERVAL = 30000 // 30 seconds
  private readonly CONNECTION_TIMEOUT_CHECK_INTERVAL = 60000 // Check every minute
  private cleanupInterval: NodeJS.Timeout | null = null
  private initialized: boolean = false

  private constructor() {
    console.log('[CONNECTION MANAGER] Initializing Fire TV Connection Manager')
    this.startCleanupTimer()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FireTVConnectionManager {
    if (!FireTVConnectionManager.instance) {
      FireTVConnectionManager.instance = new FireTVConnectionManager()
    }
    return FireTVConnectionManager.instance
  }

  /**
   * Initialize manager with all registered devices
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[CONNECTION MANAGER] Already initialized')
      return
    }

    console.log('[CONNECTION MANAGER] Loading registered devices...')
    const devices = await this.loadDevices()
    
    console.log(`[CONNECTION MANAGER] Found ${devices.length} registered devices`)
    
    // Pre-connect to all devices (non-blocking)
    for (const device of devices) {
      // Don't await - let connections happen in background
      this.getOrCreateConnection(device.id, device.ipAddress, device.port)
        .catch(error => {
          console.error(`[CONNECTION MANAGER] Failed to initialize connection for ${device.name}:`, error.message)
        })
    }

    this.initialized = true
    console.log('[CONNECTION MANAGER] Initialization complete')
  }

  /**
   * Get or create a connection to a Fire TV device
   */
  public async getOrCreateConnection(
    deviceId: string,
    ipAddress: string,
    port: number = 5555
  ): Promise<ADBClient> {
    const deviceAddress = `${ipAddress}:${port}`
    
    // Check for existing connection
    const existing = this.connections.get(deviceId)
    
    if (existing && existing.status === 'connected') {
      // Update last activity
      existing.lastActivity = new Date()
      console.log(`[CONNECTION MANAGER] Reusing existing connection for ${deviceAddress}`)
      return existing.client
    }

    // Create new connection
    console.log(`[CONNECTION MANAGER] Creating new connection for ${deviceAddress}`)
    
    const client = new ADBClient(ipAddress, port, {
      keepAliveInterval: this.KEEP_ALIVE_INTERVAL,
      connectionTimeout: 5000
    })

    // Store connection info
    const connectionInfo: ConnectionInfo = {
      deviceId,
      deviceAddress,
      client,
      lastActivity: new Date(),
      connectionAttempts: 0,
      status: 'connecting'
    }

    this.connections.set(deviceId, connectionInfo)

    try {
      // Attempt to connect
      const connected = await client.connect()
      
      if (connected) {
        connectionInfo.status = 'connected'
        connectionInfo.connectionAttempts = 0
        console.log(`[CONNECTION MANAGER] Successfully connected to ${deviceAddress}`)
        
        // Update device status in database
        await this.updateDeviceStatus(deviceId, true)
        
        return client
      } else {
        connectionInfo.status = 'error'
        connectionInfo.lastError = 'Connection failed'
        console.error(`[CONNECTION MANAGER] Failed to connect to ${deviceAddress}`)
        throw new Error('Connection failed')
      }
    } catch (error: any) {
      connectionInfo.status = 'error'
      connectionInfo.lastError = error.message
      connectionInfo.connectionAttempts++
      console.error(`[CONNECTION MANAGER] Connection error for ${deviceAddress}:`, error.message)
      
      // Update device status in database
      await this.updateDeviceStatus(deviceId, false)
      
      throw error
    }
  }

  /**
   * Get connection status for a device
   */
  public getConnectionStatus(deviceId: string): ConnectionInfo | null {
    return this.connections.get(deviceId) || null
  }

  /**
   * Get all connection statuses
   */
  public getAllConnectionStatuses(): Map<string, ConnectionInfo> {
    return new Map(this.connections)
  }

  /**
   * Disconnect a specific device
   */
  public async disconnect(deviceId: string): Promise<void> {
    const connection = this.connections.get(deviceId)
    
    if (!connection) {
      console.log(`[CONNECTION MANAGER] No connection found for device ${deviceId}`)
      return
    }

    console.log(`[CONNECTION MANAGER] Disconnecting ${connection.deviceAddress}`)
    
    try {
      await connection.client.disconnect()
      connection.client.cleanup()
    } catch (error) {
      console.error(`[CONNECTION MANAGER] Error disconnecting ${connection.deviceAddress}:`, error)
    }

    this.connections.delete(deviceId)
    await this.updateDeviceStatus(deviceId, false)
  }

  /**
   * Reconnect a device (disconnect and reconnect)
   */
  public async reconnect(deviceId: string): Promise<ADBClient> {
    console.log(`[CONNECTION MANAGER] Reconnecting device ${deviceId}`)
    
    // Get device info
    const devices = await this.loadDevices()
    const device = devices.find(d => d.id === deviceId)
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found`)
    }

    // Disconnect if connected
    await this.disconnect(deviceId)

    // Wait a moment before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create new connection
    return this.getOrCreateConnection(deviceId, device.ipAddress, device.port)
  }

  /**
   * Disconnect all devices
   */
  public async disconnectAll(): Promise<void> {
    console.log('[CONNECTION MANAGER] Disconnecting all devices...')
    
    const disconnectPromises = Array.from(this.connections.keys()).map(deviceId =>
      this.disconnect(deviceId)
    )

    await Promise.all(disconnectPromises)
    
    console.log('[CONNECTION MANAGER] All devices disconnected')
  }

  /**
   * Start cleanup timer to remove stale connections
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, this.CONNECTION_TIMEOUT_CHECK_INTERVAL)
    
    console.log('[CONNECTION MANAGER] Cleanup timer started')
  }

  /**
   * Clean up stale connections (inactive for too long)
   */
  private async cleanupStaleConnections(): Promise<void> {
    const now = new Date()
    const staleConnections: string[] = []

    for (const [deviceId, connection] of this.connections.entries()) {
      const inactiveTime = now.getTime() - connection.lastActivity.getTime()
      
      if (inactiveTime > this.CONNECTION_TIMEOUT) {
        console.log(`[CONNECTION MANAGER] Connection ${connection.deviceAddress} inactive for ${Math.floor(inactiveTime / 1000 / 60)} minutes`)
        staleConnections.push(deviceId)
      }
    }

    // Cleanup stale connections
    for (const deviceId of staleConnections) {
      await this.disconnect(deviceId)
    }

    if (staleConnections.length > 0) {
      console.log(`[CONNECTION MANAGER] Cleaned up ${staleConnections.length} stale connections`)
    }
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
      console.error('[CONNECTION MANAGER] Error loading devices:', error)
      return []
    }
  }

  /**
   * Update device online status in database
   */
  private async updateDeviceStatus(deviceId: string, isOnline: boolean): Promise<void> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      
      const device = parsed.devices.find((d: FireTVDevice) => d.id === deviceId)
      
      if (device) {
        device.isOnline = isOnline
        device.lastSeen = new Date().toISOString()
        
        await fs.writeFile(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8')
        
        console.log(`[CONNECTION MANAGER] Updated device ${deviceId} status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
      }
    } catch (error) {
      console.error('[CONNECTION MANAGER] Error updating device status:', error)
    }
  }

  /**
   * Cleanup on shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('[CONNECTION MANAGER] Shutting down...')
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    await this.disconnectAll()
    
    console.log('[CONNECTION MANAGER] Shutdown complete')
  }
}

// Export singleton instance
export const connectionManager = FireTVConnectionManager.getInstance()

// Cleanup on process termination
process.on('SIGTERM', async () => {
  console.log('[CONNECTION MANAGER] SIGTERM received')
  await connectionManager.shutdown()
})

process.on('SIGINT', async () => {
  console.log('[CONNECTION MANAGER] SIGINT received')
  await connectionManager.shutdown()
})
