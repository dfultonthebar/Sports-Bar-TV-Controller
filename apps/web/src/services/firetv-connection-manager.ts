/**
 * Fire TV Connection Manager - Global Singleton Service
 * 
 * Manages persistent ADB connections to all Fire TV devices.
 * Provides connection pooling, health monitoring, and automatic reconnection.
 */

import { ADBClient } from '@/lib/firecube/adb-client'
import { promises as fs } from 'fs'
import path from 'path'
import { getFireTVConfig } from '@/config/firetv-config'

import { logger } from '@sports-bar/logger'
import { withFileLock } from '@/lib/file-lock'

const DATA_FILE = path.join(process.cwd(), 'data', 'firetv-devices.json')
const config = getFireTVConfig()

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
  commandQueue: QueuedCommand[]
}

export interface QueuedCommand {
  id: string
  command: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  timestamp: Date
  retries: number
}

/**
 * Singleton connection manager for Fire TV devices
 */
class FireTVConnectionManager {
  private static instance: FireTVConnectionManager
  private connections: Map<string, ConnectionInfo> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private initialized: boolean = false
  private readonly MAX_QUEUED_COMMANDS = 50 // Max commands to queue per device
  private readonly COMMAND_QUEUE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

  private constructor() {
    logger.info('[CONNECTION MANAGER] Initializing Fire TV Connection Manager')
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
      logger.info('[CONNECTION MANAGER] Already initialized')
      return
    }

    logger.info('[CONNECTION MANAGER] Loading registered devices...')
    const devices = await this.loadDevices()
    
    logger.info(`[CONNECTION MANAGER] Found ${devices.length} registered devices`)
    
    // Pre-connect to all devices (non-blocking)
    for (const device of devices) {
      // Don't await - let connections happen in background
      this.getOrCreateConnection(device.id, device.ipAddress, device.port)
        .catch(error => {
          logger.error(`[CONNECTION MANAGER] Failed to initialize connection for ${device.name}:`, error.message)
        })
    }

    this.initialized = true
    logger.info('[CONNECTION MANAGER] Initialization complete')
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
      logger.info(`[CONNECTION MANAGER] Reusing existing connection for ${deviceAddress}`)
      return existing.client
    }

    // Create new connection
    logger.info(`[CONNECTION MANAGER] Creating new connection for ${deviceAddress}`)

    const client = new ADBClient(ipAddress, port, {
      keepAliveInterval: config.connection.keepAliveInterval,
      connectionTimeout: config.connection.connectionTimeout
    })

    // Store connection info
    const connectionInfo: ConnectionInfo = {
      deviceId,
      deviceAddress,
      client,
      lastActivity: new Date(),
      connectionAttempts: 0,
      status: 'connecting',
      commandQueue: []
    }

    this.connections.set(deviceId, connectionInfo)

    try {
      // Attempt to connect
      const connected = await client.connect()
      
      if (connected) {
        connectionInfo.status = 'connected'
        connectionInfo.connectionAttempts = 0
        logger.info(`[CONNECTION MANAGER] Successfully connected to ${deviceAddress}`)

        // Update device status in database
        await this.updateDeviceStatus(deviceId, true)

        // Process any queued commands
        this.processQueuedCommands(deviceId).catch(error => {
          logger.error(`[CONNECTION MANAGER] Error processing queued commands:`, error)
        })

        return client
      } else {
        connectionInfo.status = 'error'
        connectionInfo.lastError = 'Connection failed'
        logger.error(`[CONNECTION MANAGER] Failed to connect to ${deviceAddress}`)
        throw new Error('Connection failed')
      }
    } catch (error: any) {
      connectionInfo.status = 'error'
      connectionInfo.lastError = error.message
      connectionInfo.connectionAttempts++
      logger.error(`[CONNECTION MANAGER] Connection error for ${deviceAddress}:`, error.message)
      
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
      logger.info(`[CONNECTION MANAGER] No connection found for device ${deviceId}`)
      return
    }

    logger.info(`[CONNECTION MANAGER] Disconnecting ${connection.deviceAddress}`)
    
    try {
      await connection.client.disconnect()
      connection.client.cleanup()
    } catch (error) {
      logger.error(`[CONNECTION MANAGER] Error disconnecting ${connection.deviceAddress}:`, error)
    }

    this.connections.delete(deviceId)
    await this.updateDeviceStatus(deviceId, false)
  }

  /**
   * Reconnect a device (disconnect and reconnect)
   */
  public async reconnect(deviceId: string): Promise<ADBClient> {
    logger.info(`[CONNECTION MANAGER] Reconnecting device ${deviceId}`)
    
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
    logger.info('[CONNECTION MANAGER] Disconnecting all devices...')
    
    const disconnectPromises = Array.from(this.connections.keys()).map(deviceId =>
      this.disconnect(deviceId)
    )

    await Promise.all(disconnectPromises)
    
    logger.info('[CONNECTION MANAGER] All devices disconnected')
  }

  /**
   * Execute a command with automatic queueing during disconnection
   */
  public async executeCommand<T>(
    deviceId: string,
    command: () => Promise<T>,
    options: { allowQueue?: boolean } = {}
  ): Promise<T> {
    const connection = this.connections.get(deviceId)

    if (!connection) {
      throw new Error(`No connection found for device ${deviceId}`)
    }

    // If connected, execute immediately
    if (connection.status === 'connected') {
      try {
        const result = await command()
        connection.lastActivity = new Date()
        return result
      } catch (error) {
        // Connection may have broken - mark as error
        connection.status = 'error'
        throw error
      }
    }

    // If not connected and queueing is disabled, throw error
    if (!options.allowQueue) {
      throw new Error(`Device ${deviceId} is not connected (status: ${connection.status})`)
    }

    // Queue the command
    return new Promise<T>((resolve, reject) => {
      // Check queue size
      if (connection.commandQueue.length >= this.MAX_QUEUED_COMMANDS) {
        reject(new Error('Command queue is full'))
        return
      }

      const queuedCommand: QueuedCommand = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        command: command as () => Promise<any>,
        resolve,
        reject,
        timestamp: new Date(),
        retries: 0
      }

      connection.commandQueue.push(queuedCommand)
      logger.info(`[CONNECTION MANAGER] Command queued for ${connection.deviceAddress} (${connection.commandQueue.length} in queue)`)

      // Set timeout for queued command
      setTimeout(() => {
        const index = connection.commandQueue.findIndex(c => c.id === queuedCommand.id)
        if (index !== -1) {
          connection.commandQueue.splice(index, 1)
          reject(new Error('Command timeout - device did not reconnect in time'))
        }
      }, this.COMMAND_QUEUE_TIMEOUT)
    })
  }

  /**
   * Process queued commands for a device (called after reconnection)
   */
  private async processQueuedCommands(deviceId: string): Promise<void> {
    const connection = this.connections.get(deviceId)

    if (!connection || connection.status !== 'connected') {
      return
    }

    const queue = connection.commandQueue
    if (queue.length === 0) {
      return
    }

    logger.info(`[CONNECTION MANAGER] Processing ${queue.length} queued commands for ${connection.deviceAddress}`)

    // Process commands one by one
    while (queue.length > 0) {
      const queuedCommand = queue.shift()!

      try {
        const result = await queuedCommand.command()
        queuedCommand.resolve(result)
        logger.info(`[CONNECTION MANAGER] Queued command executed successfully`)
      } catch (error: any) {
        logger.error(`[CONNECTION MANAGER] Queued command failed:`, error.message)
        queuedCommand.reject(error)

        // If connection broke while processing queue, stop
        if (connection.status !== 'connected') {
          logger.info(`[CONNECTION MANAGER] Connection lost while processing queue, stopping`)
          break
        }
      }

      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.info(`[CONNECTION MANAGER] Finished processing queued commands`)
  }

  /**
   * Start cleanup timer to remove stale connections
   */
  private startCleanupTimer(): void {
    // Clear existing interval if any to prevent memory leaks
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, config.lifecycle.cleanupInterval)

    logger.info('[CONNECTION MANAGER] Cleanup timer started')
  }

  /**
   * Clean up stale connections (inactive for too long)
   */
  private async cleanupStaleConnections(): Promise<void> {
    const now = new Date()
    const staleConnections: string[] = []

    for (const [deviceId, connection] of this.connections.entries()) {
      const inactiveTime = now.getTime() - connection.lastActivity.getTime()

      if (inactiveTime > config.lifecycle.inactivityTimeout) {
        logger.info(`[CONNECTION MANAGER] Connection ${connection.deviceAddress} inactive for ${Math.floor(inactiveTime / 1000 / 60)} minutes`)
        staleConnections.push(deviceId)
      }
    }

    // Cleanup stale connections
    for (const deviceId of staleConnections) {
      // Reject any queued commands first
      const connection = this.connections.get(deviceId)
      if (connection) {
        for (const cmd of connection.commandQueue) {
          cmd.reject(new Error('Connection closed due to inactivity'))
        }
        connection.commandQueue = []
      }

      await this.disconnect(deviceId)
    }

    if (staleConnections.length > 0) {
      logger.info(`[CONNECTION MANAGER] Cleaned up ${staleConnections.length} stale connections`)
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
      logger.error('[CONNECTION MANAGER] Error loading devices:', error)
      return []
    }
  }

  /**
   * Update device online status in database
   * Uses file lock to prevent race conditions during concurrent updates
   */
  private async updateDeviceStatus(deviceId: string, isOnline: boolean): Promise<void> {
    try {
      await withFileLock(DATA_FILE, async () => {
        const data = await fs.readFile(DATA_FILE, 'utf-8')
        const parsed = JSON.parse(data)

        const device = parsed.devices.find((d: FireTVDevice) => d.id === deviceId)

        if (device) {
          device.isOnline = isOnline
          device.lastSeen = new Date().toISOString()

          await fs.writeFile(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8')

          logger.info(`[CONNECTION MANAGER] Updated device ${deviceId} status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
        }
      })
    } catch (error) {
      logger.error('[CONNECTION MANAGER] Error updating device status:', error)
    }
  }

  /**
   * Cleanup on shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('[CONNECTION MANAGER] Shutting down...')
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    await this.disconnectAll()
    
    logger.info('[CONNECTION MANAGER] Shutdown complete')
  }
}

// Export singleton instance
export const connectionManager = FireTVConnectionManager.getInstance()

// Cleanup on process termination
process.on('SIGTERM', async () => {
  logger.info('[CONNECTION MANAGER] SIGTERM received')
  await connectionManager.shutdown()
})

process.on('SIGINT', async () => {
  logger.info('[CONNECTION MANAGER] SIGINT received')
  await connectionManager.shutdown()
})
