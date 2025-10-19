
/**
 * Atlas TCP Client Library
 * 
 * Implements JSON-RPC 2.0 protocol for controlling AtlasIED Atmosphere audio processors
 * via TCP connection on port 5321.
 * 
 * Protocol Details:
 * - TCP Port: 5321 for commands and subscription updates
 * - UDP Port: 3131 for metering information
 * - Messages must be terminated with \r\n
 * - Parameters use 0-based indexing (Zone 1 = ZoneSource_0, etc.)
 * - JSON-RPC 2.0 format: {"jsonrpc":"2.0","method":"...","params":{...},"id":N}
 * 
 * @see ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf for protocol specification
 */

import { Socket } from 'net'
import { atlasLogger } from './atlas-logger'

export interface AtlasConnectionConfig {
  ipAddress: string
  port?: number
  timeout?: number
  maxRetries?: number
}

export interface AtlasCommand {
  method: 'set' | 'bmp' | 'sub' | 'unsub' | 'get'
  param: string
  value?: number | string
  format?: 'val' | 'pct' | 'str'
}

export interface AtlasResponse {
  success: boolean
  data?: any
  error?: string
}

/**
 * Atlas TCP Client for JSON-RPC 2.0 communication
 */
export class AtlasTCPClient {
  private socket: Socket | null = null
  private connected: boolean = false
  private readonly config: Required<AtlasConnectionConfig>
  private commandId: number = 1
  private responseBuffer: string = ''
  private pendingResponses: Map<number, {
    resolve: (value: any) => void
    reject: (reason: any) => void
    timeout: NodeJS.Timeout
  }> = new Map()

  constructor(config: AtlasConnectionConfig) {
    this.config = {
      ipAddress: config.ipAddress,
      port: config.port || 5321,  // Atlas uses port 5321 for TCP control (NOT port 23)
      timeout: config.timeout || 5000,
      maxRetries: config.maxRetries || 3
    }
    
    atlasLogger.info('CLIENT', `Atlas TCP Client initialized for ${this.config.ipAddress}:${this.config.port}`)
  }

  /**
   * Connect to the Atlas processor
   */
  async connect(): Promise<void> {
    if (this.connected && this.socket) {
      atlasLogger.debug('CLIENT', `Already connected to ${this.config.ipAddress}:${this.config.port}`)
      return
    }

    atlasLogger.connectionAttempt(this.config.ipAddress, this.config.port)

    return new Promise((resolve, reject) => {
      try {
        this.socket = new Socket()
        
        // Set timeout for connection
        this.socket.setTimeout(this.config.timeout)

        // Handle connection success
        this.socket.on('connect', () => {
          this.connected = true
          atlasLogger.connectionSuccess(this.config.ipAddress, this.config.port)
          resolve()
        })

        // Handle incoming data
        this.socket.on('data', (data) => {
          this.handleData(data)
        })

        // Handle connection errors
        this.socket.on('error', (error) => {
          atlasLogger.connectionFailed(this.config.ipAddress, this.config.port, error)
          this.connected = false
          reject(error)
        })

        // Handle connection timeout
        this.socket.on('timeout', () => {
          atlasLogger.connectionTimeout(this.config.ipAddress, this.config.port)
          this.socket?.destroy()
          this.connected = false
          reject(new Error('Connection timeout'))
        })

        // Handle connection close
        this.socket.on('close', () => {
          atlasLogger.connectionClosed(this.config.ipAddress, this.config.port)
          this.connected = false
          // Reject all pending responses
          this.pendingResponses.forEach(({ reject, timeout }) => {
            clearTimeout(timeout)
            reject(new Error('Connection closed'))
          })
          this.pendingResponses.clear()
        })

        // Initiate connection
        this.socket.connect(this.config.port, this.config.ipAddress)
      } catch (error) {
        atlasLogger.connectionFailed(this.config.ipAddress, this.config.port, error)
        reject(error)
      }
    })
  }

  /**
   * Disconnect from the Atlas processor
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
      this.connected = false
      atlasLogger.connectionClosed(this.config.ipAddress, this.config.port)
    }
  }

  /**
   * Handle incoming data from the socket
   */
  private handleData(data: Buffer): void {
    // Append data to buffer
    this.responseBuffer += data.toString()

    // Process complete messages (terminated with \r\n)
    let newlineIndex: number
    while ((newlineIndex = this.responseBuffer.indexOf('\r\n')) !== -1) {
      const message = this.responseBuffer.substring(0, newlineIndex)
      this.responseBuffer = this.responseBuffer.substring(newlineIndex + 2)

      if (message.length > 0) {
        this.handleMessage(message)
      }
    }
  }

  /**
   * Handle a complete JSON-RPC message
   */
  private handleMessage(message: string): void {
    try {
      const response = JSON.parse(message)
      
      atlasLogger.commandResponse(response, this.config.ipAddress)
      
      // Handle responses with ID (responses to our commands)
      if (response.id !== undefined) {
        const pending = this.pendingResponses.get(response.id)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingResponses.delete(response.id)
          
          if (response.error) {
            atlasLogger.error('RESPONSE', `Command ${response.id} returned error`, response.error)
            pending.reject(new Error(response.error.message || 'Atlas command error'))
          } else {
            pending.resolve(response)
          }
        }
      }
      
      // Handle update messages (subscribed parameter updates)
      if (response.method === 'update') {
        atlasLogger.parameterUpdate(
          response.params?.param || 'unknown',
          response.params,
          this.config.ipAddress
        )
      }
    } catch (error) {
      atlasLogger.error('RESPONSE', `Error parsing message: ${message}`, error)
    }
  }

  /**
   * Send a command to the Atlas processor
   */
  private async sendCommand(command: AtlasCommand, withResponse: boolean = true): Promise<any> {
    if (!this.connected || !this.socket) {
      const error = new Error('Not connected to Atlas processor')
      atlasLogger.error('COMMAND', 'Attempted to send command while not connected', { command })
      throw error
    }

    const id = this.commandId++
    
    // Build JSON-RPC message
    let message: any = {
      jsonrpc: '2.0',
      method: command.method
    }

    // Build params based on method
    if (command.method === 'set' || command.method === 'bmp') {
      message.params = {
        param: command.param
      }
      
      if (command.format === 'pct') {
        message.params.pct = command.value
      } else if (command.format === 'str') {
        message.params.str = command.value
      } else {
        message.params.val = command.value
      }
    } else if (command.method === 'sub' || command.method === 'unsub' || command.method === 'get') {
      message.params = {
        param: command.param,
        fmt: command.format || 'val'
      }
    }

    // Add ID if we want a response
    if (withResponse) {
      message.id = id
    }

    // Convert to JSON and add terminator
    const jsonMessage = JSON.stringify(message) + '\r\n'
    
    atlasLogger.commandSent(message, this.config.ipAddress)

    // Send the message
    this.socket.write(jsonMessage)

    // If we don't need a response, return immediately
    if (!withResponse) {
      return { success: true }
    }

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(id)
        atlasLogger.commandTimeout(message, this.config.ipAddress)
        reject(new Error('Command timeout'))
      }, this.config.timeout)

      this.pendingResponses.set(id, { resolve, reject, timeout })
    })
  }

  /**
   * Set zone source
   * @param zoneIndex Zone index (0-based, Zone 1 = 0)
   * @param sourceIndex Source index (0-based, -1 for no source)
   */
  async setZoneSource(zoneIndex: number, sourceIndex: number): Promise<AtlasResponse> {
    try {
      const param = `ZoneSource_${zoneIndex}`
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: sourceIndex,
        format: 'val'
      })

      atlasLogger.info('COMMAND', `Set ${param} to ${sourceIndex}`)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'set', param: `ZoneSource_${zoneIndex}` }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Set zone volume
   * @param zoneIndex Zone index (0-based)
   * @param gainDb Gain in dB (-80 to 0) or percentage if usePct is true
   * @param usePct Use percentage format (0-100) instead of dB
   */
  async setZoneVolume(zoneIndex: number, gainDb: number, usePct: boolean = true): Promise<AtlasResponse> {
    try {
      const param = `ZoneGain_${zoneIndex}`
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: gainDb,
        format: usePct ? 'pct' : 'val'
      })

      atlasLogger.info('COMMAND', `Set ${param} to ${gainDb}${usePct ? '%' : 'dB'}`)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'set', param: `ZoneGain_${zoneIndex}` }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Set zone mute state
   * @param zoneIndex Zone index (0-based)
   * @param muted true to mute, false to unmute
   */
  async setZoneMute(zoneIndex: number, muted: boolean): Promise<AtlasResponse> {
    try {
      const param = `ZoneMute_${zoneIndex}`
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: muted ? 1 : 0,
        format: 'val'
      })

      atlasLogger.info('COMMAND', `Set ${param} to ${muted ? 'muted' : 'unmuted'}`)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'set', param: `ZoneMute_${zoneIndex}` }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Recall a scene
   * @param sceneIndex Scene index (0-based)
   */
  async recallScene(sceneIndex: number): Promise<AtlasResponse> {
    try {
      const param = 'RecallScene'
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: sceneIndex,
        format: 'val'
      })

      atlasLogger.info('COMMAND', `Recalled scene ${sceneIndex}`)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'set', param: 'RecallScene' }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Play a message
   * @param messageIndex Message index (0-based)
   */
  async playMessage(messageIndex: number): Promise<AtlasResponse> {
    try {
      const param = 'PlayMessage'
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: messageIndex,
        format: 'val'
      })

      atlasLogger.info('COMMAND', `Playing message ${messageIndex}`)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'set', param: 'PlayMessage' }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Activate/deactivate a group (combine zones)
   * @param groupIndex Group index (0-based)
   * @param active true to activate (combine), false to deactivate
   */
  async setGroupActive(groupIndex: number, active: boolean): Promise<AtlasResponse> {
    try {
      const param = `GroupActive_${groupIndex}`
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: active ? 1 : 0,
        format: 'val'
      })

      atlasLogger.info('COMMAND', `Set group ${groupIndex} to ${active ? 'active' : 'inactive'}`)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'set', param: `GroupActive_${groupIndex}` }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Subscribe to parameter updates
   * @param param Parameter name (e.g., 'ZoneGain_0')
   * @param format Format ('val', 'pct', or 'str')
   */
  async subscribe(param: string, format: 'val' | 'pct' | 'str' = 'val'): Promise<AtlasResponse> {
    try {
      const response = await this.sendCommand({
        method: 'sub',
        param,
        format
      })

      atlasLogger.info('COMMAND', `Subscribed to ${param} (${format})`)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'sub', param }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Unsubscribe from parameter updates
   * @param param Parameter name (e.g., 'ZoneGain_0')
   * @param format Format ('val', 'pct', or 'str')
   */
  async unsubscribe(param: string, format: 'val' | 'pct' | 'str' = 'val'): Promise<AtlasResponse> {
    try {
      const response = await this.sendCommand({
        method: 'unsub',
        param,
        format
      })

      atlasLogger.info('COMMAND', `Unsubscribed from ${param} (${format})`)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'unsub', param }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get current value of a parameter
   * @param param Parameter name (e.g., 'ZoneSource_0')
   * @param format Format ('val', 'pct', or 'str')
   */
  async getParameter(param: string, format: 'val' | 'pct' | 'str' = 'val'): Promise<AtlasResponse> {
    try {
      const response = await this.sendCommand({
        method: 'get',
        param,
        format
      })

      atlasLogger.debug('COMMAND', `Got ${param}`, response)
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.commandError({ method: 'get', param }, error, this.config.ipAddress)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null
  }
}

/**
 * Helper function to create and connect to an Atlas processor
 */
export async function createAtlasClient(config: AtlasConnectionConfig): Promise<AtlasTCPClient> {
  const client = new AtlasTCPClient(config)
  await client.connect()
  return client
}

/**
 * Helper function to execute a command with automatic connection management
 */
export async function executeAtlasCommand(
  config: AtlasConnectionConfig,
  commandFn: (client: AtlasTCPClient) => Promise<AtlasResponse>
): Promise<AtlasResponse> {
  const client = new AtlasTCPClient(config)
  
  try {
    await client.connect()
    const result = await commandFn(client)
    return result
  } catch (error) {
    atlasLogger.error('CLIENT', 'Command execution error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    client.disconnect()
  }
}
