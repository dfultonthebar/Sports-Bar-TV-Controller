/**
 * Comprehensive Atlas Control Service
 * 
 * Provides centralized management of Atlas processor connections including:
 * - TCP control connections with JSON-RPC 2.0
 * - UDP metering subscriptions
 * - Keep-alive mechanism (every 4 minutes)
 * - Automatic reconnection
 * - State persistence via Drizzle ORM
 */

import { Socket } from 'net'
import dgram from 'dgram'
import { EventEmitter } from 'events'
import { atlasLogger } from './atlas-logger'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { 
  ATLAS_CONFIG, 
  ATLAS_METHODS, 
  ATLAS_FORMATS,
  createKeepAliveMessage,
  getParameterName 
} from '@/config/atlasConfig'

export interface AtlasControlConfig {
  ipAddress: string
  tcpPort?: number
  udpPort?: number
  processorId: string
  autoReconnect?: boolean
  enableMetering?: boolean
}

export interface AtlasCommand {
  method: 'set' | 'bmp' | 'sub' | 'unsub' | 'get'
  param: string
  value?: number | string
  format?: 'val' | 'pct' | 'str'
}

export interface MeterUpdate {
  param: string
  meterType: string
  index: number
  level: number
  timestamp: Date
}

/**
 * Atlas Control Service
 * Manages TCP control connection and UDP metering for a single Atlas processor
 */
export class AtlasControlService extends EventEmitter {
  private config: Required<AtlasControlConfig>
  private tcpSocket: Socket | null = null
  private udpSocket: dgram.Socket | null = null
  private connected: boolean = false
  private commandId: number = 1
  private responseBuffer: string = ''
  private keepAliveInterval: NodeJS.Timeout | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0
  
  private pendingResponses: Map<number, {
    resolve: (value: any) => void
    reject: (reason: any) => void
    timeout: NodeJS.Timeout
  }> = new Map()

  constructor(config: AtlasControlConfig) {
    super()
    this.config = {
      ipAddress: config.ipAddress,
      tcpPort: config.tcpPort || ATLAS_CONFIG.TCP_CONTROL_PORT,
      udpPort: config.udpPort || ATLAS_CONFIG.UDP_METERING_PORT,
      processorId: config.processorId,
      autoReconnect: config.autoReconnect ?? true,
      enableMetering: config.enableMetering ?? true
    }
  }

  /**
   * Connect to Atlas processor (both TCP and UDP if enabled)
   */
  async connect(): Promise<void> {
    try {
      // Connect TCP for control
      await this.connectTCP()
      
      // Connect UDP for metering if enabled
      if (this.config.enableMetering) {
        await this.connectUDP()
      }
      
      // Start keep-alive mechanism
      this.startKeepAlive()
      
      // Update connection state in database
      await this.updateConnectionState(true)
      
      this.emit('connected')
    } catch (error) {
      atlasLogger.error('CONNECTION', 'Failed to connect', error)
      throw error
    }
  }

  /**
   * Connect TCP socket for control
   */
  private async connectTCP(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.tcpSocket = new Socket()
      
      this.tcpSocket.setTimeout(ATLAS_CONFIG.CONNECTION_TIMEOUT)
      
      this.tcpSocket.on('connect', () => {
        this.connected = true
        this.reconnectAttempts = 0
        atlasLogger.connectionSuccess(this.config.ipAddress, this.config.tcpPort)
        resolve()
      })
      
      this.tcpSocket.on('data', (data) => {
        this.handleTCPData(data)
      })
      
      this.tcpSocket.on('error', (error) => {
        atlasLogger.connectionFailure(this.config.ipAddress, this.config.tcpPort, error)
        this.connected = false
        if (this.pendingResponses.size === 0) {
          // Only reject if this is during initial connection
          reject(error)
        } else {
          this.emit('error', error)
          if (this.config.autoReconnect) {
            this.scheduleReconnect()
          }
        }
      })
      
      this.tcpSocket.on('timeout', () => {
        atlasLogger.error('CONNECTION', 'TCP connection timeout', {
          ipAddress: this.config.ipAddress,
          port: this.config.tcpPort
        })
        this.tcpSocket?.destroy()
        reject(new Error('Connection timeout'))
      })
      
      this.tcpSocket.on('close', () => {
        atlasLogger.connectionClosed(this.config.ipAddress, this.config.tcpPort)
        this.connected = false
        this.emit('disconnected')
        
        // Reject all pending responses
        this.pendingResponses.forEach(({ reject, timeout }) => {
          clearTimeout(timeout)
          reject(new Error('Connection closed'))
        })
        this.pendingResponses.clear()
        
        // Stop keep-alive
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval)
          this.keepAliveInterval = null
        }
        
        // Update database state
        this.updateConnectionState(false).catch(console.error)
        
        // Auto-reconnect if enabled
        if (this.config.autoReconnect) {
          this.scheduleReconnect()
        }
      })
      
      // Initiate connection
      atlasLogger.connectionAttempt(this.config.ipAddress, this.config.tcpPort)
      this.tcpSocket.connect(this.config.tcpPort, this.config.ipAddress)
    })
  }

  /**
   * Connect UDP socket for metering
   */
  private async connectUDP(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.udpSocket = dgram.createSocket('udp4')
        
        this.udpSocket.on('listening', () => {
          const address = this.udpSocket?.address()
          atlasLogger.info('UDP', 'UDP metering socket listening', {
            ipAddress: this.config.ipAddress,
            port: this.config.udpPort,
            localPort: address
          })
          resolve()
        })
        
        this.udpSocket.on('message', (msg, rinfo) => {
          this.handleUDPMessage(msg, rinfo)
        })
        
        this.udpSocket.on('error', (error) => {
          atlasLogger.error('UDP', 'UDP socket error', error)
          this.emit('udpError', error)
          // UDP errors shouldn't prevent TCP connection
          resolve()
        })
        
        // Bind to UDP port
        this.udpSocket.bind(this.config.udpPort)
      } catch (error) {
        atlasLogger.error('UDP', 'Failed to create UDP socket', error)
        // UDP failure shouldn't prevent TCP connection
        resolve()
      }
    })
  }

  /**
   * Disconnect from Atlas processor
   */
  disconnect(): void {
    // Stop keep-alive
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
    
    // Cancel any pending reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    // Close TCP socket
    if (this.tcpSocket) {
      this.tcpSocket.destroy()
      this.tcpSocket = null
    }
    
    // Close UDP socket
    if (this.udpSocket) {
      this.udpSocket.close()
      this.udpSocket = null
    }
    
    this.connected = false
    this.emit('disconnected')
  }

  /**
   * Handle incoming TCP data
   */
  private handleTCPData(data: Buffer): void {
    this.responseBuffer += data.toString()
    
    let newlineIndex: number
    while ((newlineIndex = this.responseBuffer.indexOf('\r\n')) !== -1) {
      const message = this.responseBuffer.substring(0, newlineIndex)
      this.responseBuffer = this.responseBuffer.substring(newlineIndex + 2)
      
      if (message.length > 0) {
        this.handleTCPMessage(message)
      }
    }
  }

  /**
   * Handle a complete TCP JSON-RPC message
   */
  private handleTCPMessage(message: string): void {
    try {
      const response = JSON.parse(message)
      atlasLogger.responseReceived(response, this.config.ipAddress)
      
      // Handle responses with ID (responses to our commands)
      if (response.id !== undefined) {
        const pending = this.pendingResponses.get(response.id)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingResponses.delete(response.id)
          
          if (response.error) {
            pending.reject(new Error(response.error.message || 'Command error'))
          } else {
            pending.resolve(response)
          }
        }
      }
      
      // Handle update messages (subscribed parameter updates)
      if (response.method === 'update') {
        this.handleParameterUpdate(response.params)
      }
    } catch (error) {
      atlasLogger.error('PARSING', 'Failed to parse TCP message', { message, error })
    }
  }

  /**
   * Handle UDP meter messages
   */
  private handleUDPMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const message = msg.toString()
      const data = JSON.parse(message)
      
      if (data.method === 'update') {
        const params = data.params
        const param = params.param || ''
        
        // Check if this is a meter update
        if (param.includes('Meter')) {
          const meterUpdate: MeterUpdate = {
            param: param,
            meterType: param.split('_')[0],
            index: parseInt(param.split('_')[1] || '0'),
            level: params.val || params.pct || 0,
            timestamp: new Date()
          }
          
          this.emit('meterUpdate', meterUpdate)
          
          // Store in database
          this.storeMeterReading(meterUpdate).catch(console.error)
        }
      }
    } catch (error) {
      atlasLogger.error('UDP', 'Failed to parse UDP message', error)
    }
  }

  /**
   * Handle parameter update from subscription
   */
  private async handleParameterUpdate(params: any): Promise<void> {
    try {
      const param = params.param
      const value = params.val !== undefined ? params.val : 
                   params.pct !== undefined ? params.pct : 
                   params.str !== undefined ? params.str : null
      
      if (param && value !== null) {
        // Update parameter in database
        await db.insert(schema.atlasParameters)
          .values({
            processorId: this.config.processorId,
            paramName: param,
            paramType: param.split('_')[0],
            paramIndex: parseInt(param.split('_')[1] || '0'),
            currentValue: String(value),
            format: params.val !== undefined ? 'val' : 
                   params.pct !== undefined ? 'pct' : 'str',
            lastUpdated: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .onConflictDoUpdate({
            target: [schema.atlasParameters.processorId, schema.atlasParameters.paramName],
            set: {
              currentValue: String(value),
              lastUpdated: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          })
        
        this.emit('parameterUpdate', { param, value, params })
      }
    } catch (error) {
      atlasLogger.error('PARAMETER_UPDATE', 'Failed to handle parameter update', error)
    }
  }

  /**
   * Store meter reading in database
   */
  private async storeMeterReading(meter: MeterUpdate): Promise<void> {
    try {
      await db.insert(schema.atlasMeterReadings)
        .values({
          processorId: this.config.processorId,
          meterType: meter.meterType,
          meterIndex: meter.index,
          meterName: meter.param,
          level: meter.level,
          timestamp: meter.timestamp.toISOString()
        })
      
      // Keep only recent readings (last 1000 per processor)
      const readings = await db.select()
        .from(schema.atlasMeterReadings)
        .where(eq(schema.atlasMeterReadings.processorId, this.config.processorId))
        .orderBy(schema.atlasMeterReadings.timestamp)
        .all()
      
      if (readings.length > 1000) {
        const toDelete = readings.slice(0, readings.length - 1000)
        for (const reading of toDelete) {
          await db.delete(schema.atlasMeterReadings)
            .where(eq(schema.atlasMeterReadings.id, reading.id))
        }
      }
    } catch (error) {
      atlasLogger.error('METER_STORAGE', 'Failed to store meter reading', error)
    }
  }

  /**
   * Send a command to Atlas processor
   */
  async sendCommand(command: AtlasCommand, withResponse: boolean = true): Promise<any> {
    if (!this.connected || !this.tcpSocket) {
      throw new Error('Not connected to Atlas processor')
    }
    
    const id = this.commandId++
    
    const message: any = {
      jsonrpc: ATLAS_CONFIG.JSONRPC_VERSION,
      method: command.method
    }
    
    // Build params
    if (command.method === 'set' || command.method === 'bmp') {
      message.params = { param: command.param }
      
      if (command.format === 'pct') {
        message.params.pct = command.value
      } else if (command.format === 'str') {
        message.params.str = command.value
      } else {
        message.params.val = command.value
      }
    } else {
      message.params = {
        param: command.param,
        fmt: command.format || 'val'
      }
    }
    
    if (withResponse) {
      message.id = id
    }
    
    const jsonMessage = JSON.stringify(message) + ATLAS_CONFIG.MESSAGE_TERMINATOR
    atlasLogger.commandSent(message, this.config.ipAddress)
    
    this.tcpSocket.write(jsonMessage)
    
    if (!withResponse) {
      return { success: true }
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(id)
        atlasLogger.commandTimeout(id, this.config.ipAddress)
        reject(new Error('Command timeout'))
      }, ATLAS_CONFIG.COMMAND_TIMEOUT)
      
      this.pendingResponses.set(id, { resolve, reject, timeout })
    })
  }

  /**
   * Start keep-alive mechanism (send every 4 minutes)
   */
  private startKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
    }
    
    this.keepAliveInterval = setInterval(async () => {
      try {
        if (this.connected && this.tcpSocket) {
          const keepAliveMsg = createKeepAliveMessage(this.commandId++)
          this.tcpSocket.write(keepAliveMsg)
          
          // Update last keep-alive time in database
          await db.update(schema.atlasConnectionStates)
            .set({
              lastKeepAlive: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .where(eq(schema.atlasConnectionStates.processorId, this.config.processorId))
          
          atlasLogger.info('KEEP_ALIVE', 'Keep-alive sent', {
            ipAddress: this.config.ipAddress
          })
        }
      } catch (error) {
        atlasLogger.error('KEEP_ALIVE', 'Failed to send keep-alive', error)
      }
    }, ATLAS_CONFIG.KEEP_ALIVE_INTERVAL)
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return // Already scheduled
    }
    
    this.reconnectAttempts++
    
    if (this.reconnectAttempts > ATLAS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      atlasLogger.error('RECONNECT', 'Max reconnection attempts reached', {
        ipAddress: this.config.ipAddress,
        attempts: this.reconnectAttempts
      })
      this.emit('maxReconnectAttemptsReached')
      return
    }
    
    const delay = Math.min(
      ATLAS_CONFIG.RECONNECT_DELAY * this.reconnectAttempts,
      60000 // Max 60 seconds
    )
    
    atlasLogger.info('RECONNECT', 'Scheduling reconnection', {
      ipAddress: this.config.ipAddress,
      attempt: this.reconnectAttempts,
      delay
    })
    
    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null
      try {
        await this.connect()
      } catch (error) {
        atlasLogger.error('RECONNECT', 'Reconnection failed', error)
        this.scheduleReconnect()
      }
    }, delay)
  }

  /**
   * Update connection state in database
   */
  private async updateConnectionState(connected: boolean): Promise<void> {
    try {
      const now = new Date().toISOString()
      
      const existing = await db.select()
        .from(schema.atlasConnectionStates)
        .where(eq(schema.atlasConnectionStates.processorId, this.config.processorId))
        .limit(1)
        .get()
      
      if (existing) {
        await db.update(schema.atlasConnectionStates)
          .set({
            isConnected: connected ? 1 : 0,
            ...(connected ? { lastConnected: now, connectionErrors: 0 } : { lastDisconnected: now }),
            reconnectAttempts: this.reconnectAttempts,
            updatedAt: now
          })
          .where(eq(schema.atlasConnectionStates.processorId, this.config.processorId))
      } else {
        await db.insert(schema.atlasConnectionStates)
          .values({
            processorId: this.config.processorId,
            isConnected: connected,
            lastConnected: connected ? now : null,
            lastDisconnected: connected ? null : now,
            tcpPort: this.config.tcpPort,
            udpPort: this.config.udpPort,
            createdAt: now,
            updatedAt: now
          })
      }
    } catch (error) {
      atlasLogger.error('DATABASE', 'Failed to update connection state', error)
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get connection config
   */
  getConfig(): Required<AtlasControlConfig> {
    return { ...this.config }
  }
}

// Global service registry
const serviceRegistry: Map<string, AtlasControlService> = new Map()

/**
 * Get or create Atlas control service for a processor
 */
export async function getAtlasControlService(
  processorId: string
): Promise<AtlasControlService> {
  // Check if service already exists
  if (serviceRegistry.has(processorId)) {
    return serviceRegistry.get(processorId)!
  }
  
  // Load processor from database
  const processor = await db.select()
    .from(schema.audioProcessors)
    .where(eq(schema.audioProcessors.id, processorId))
    .limit(1)
    .get()
  
  if (!processor) {
    throw new Error(`Processor not found: ${processorId}`)
  }
  
  // Create new service
  const service = new AtlasControlService({
    ipAddress: processor.ipAddress,
    tcpPort: processor.tcpPort || ATLAS_CONFIG.TCP_CONTROL_PORT,
    processorId: processor.id,
    autoReconnect: true,
    enableMetering: true
  })
  
  // Connect
  await service.connect()
  
  // Store in registry
  serviceRegistry.set(processorId, service)
  
  // Clean up on disconnect
  service.once('maxReconnectAttemptsReached', () => {
    serviceRegistry.delete(processorId)
  })
  
  return service
}

/**
 * Disconnect and remove service from registry
 */
export function disconnectAtlasControlService(processorId: string): void {
  const service = serviceRegistry.get(processorId)
  if (service) {
    service.disconnect()
    serviceRegistry.delete(processorId)
  }
}

/**
 * Disconnect all services
 */
export function disconnectAllServices(): void {
  serviceRegistry.forEach(service => service.disconnect())
  serviceRegistry.clear()
}

export default AtlasControlService
