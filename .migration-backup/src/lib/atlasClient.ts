/**
 * Atlas TCP/UDP Client Library
 * 
 * Implements JSON-RPC 2.0 protocol for controlling AtlasIED Atmosphere audio processors
 * 
 * CRITICAL PROTOCOL REQUIREMENTS (from ATS006993-B specification):
 * - TCP Port 5321 for commands and responses
 * - UDP Port 3131 for meter subscription updates
 * - Messages MUST be newline-terminated with "\n" (not "\r\n")
 * - GET responses use method "getResp" with "params" (not "result")
 * - Keep-alive: send "get" for "KeepAlive" every 4-5 minutes
 * - Subscriptions are lost on disconnect - must resubscribe on reconnect
 * - Parameters are 0-indexed (ZoneSource_0 is Zone 1)
 * 
 * @see ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf for protocol specification
 */

import { Socket } from 'net'
import * as dgram from 'dgram'
import { atlasLogger } from './atlas-logger'

export interface AtlasConnectionConfig {
  ipAddress: string
  tcpPort?: number
  udpPort?: number
  timeout?: number
  maxRetries?: number
  keepAliveInterval?: number
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

interface PendingCommand {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timeout: NodeJS.Timeout
}

interface Subscription {
  param: string
  format: 'val' | 'pct' | 'str'
}

/**
 * Atlas TCP/UDP Client for JSON-RPC 2.0 communication
 * 
 * This implementation follows the official AtlasIED Atmosphere protocol specification.
 */
export class AtlasTCPClient {
  private tcpSocket: Socket | null = null
  private udpSocket: dgram.Socket | null = null
  private connected: boolean = false
  private readonly config: Required<AtlasConnectionConfig>
  private commandId: number = 1
  private responseBuffer: string = ''
  private pendingResponses: Map<number, PendingCommand> = new Map()
  private subscriptions: Set<string> = new Set()
  private keepAliveTimer: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 10

  constructor(config: AtlasConnectionConfig) {
    this.config = {
      ipAddress: config.ipAddress,
      tcpPort: config.tcpPort || 5321,  // TCP control port
      udpPort: config.udpPort || 3131,  // UDP meter port
      timeout: config.timeout || 10000,  // Increased default timeout to 10 seconds
      maxRetries: config.maxRetries || 3,
      keepAliveInterval: config.keepAliveInterval || 240000 // 4 minutes
    }
    
    atlasLogger.info('CLIENT_INIT', 'Atlas TCP client initialized', {
      ipAddress: this.config.ipAddress,
      tcpPort: this.config.tcpPort,
      udpPort: this.config.udpPort,
      timeout: this.config.timeout
    })
  }

  /**
   * Connect to the Atlas processor with retry logic
   */
  async connect(): Promise<void> {
    if (this.connected && this.tcpSocket) {
      atlasLogger.info('CONNECTION', 'Already connected to Atlas processor', {
        ipAddress: this.config.ipAddress,
        port: this.config.tcpPort
      })
      return
    }

    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.attemptConnection(attempt)
        this.reconnectAttempts = 0
        return // Connection successful
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < this.config.maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          atlasLogger.warn('CONNECTION', `Connection attempt ${attempt} failed, retrying in ${retryDelay}ms...`, {
            ipAddress: this.config.ipAddress,
            port: this.config.tcpPort,
            error: lastError.message
          })
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }
    
    // All retries failed
    atlasLogger.error('CONNECTION', `Failed to connect after ${this.config.maxRetries} attempts`, {
      ipAddress: this.config.ipAddress,
      port: this.config.tcpPort,
      error: lastError
    })
    throw lastError || new Error('Connection failed')
  }

  /**
   * Single connection attempt
   */
  private async attemptConnection(attempt: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        atlasLogger.connectionAttempt(this.config.ipAddress, this.config.tcpPort)
        
        // Clean up any existing socket
        if (this.tcpSocket) {
          try {
            this.tcpSocket.destroy()
          } catch (e) {
            // Ignore errors during cleanup
          }
          this.tcpSocket = null
        }
        
        this.tcpSocket = new Socket()
        
        // Set socket options for better reliability
        this.tcpSocket.setKeepAlive(true, 30000)  // Enable TCP keepalive
        this.tcpSocket.setNoDelay(true)  // Disable Nagle's algorithm for low-latency
        
        // Set timeout for connection
        this.tcpSocket.setTimeout(this.config.timeout)

        // Handle connection success
        this.tcpSocket.on('connect', () => {
          this.connected = true
          atlasLogger.connectionSuccess(this.config.ipAddress, this.config.tcpPort)
          
          // CRITICAL FIX: Clear the connection timeout after successful connection
          // The timeout was causing immediate disconnections after connecting
          if (this.tcpSocket) {
            this.tcpSocket.setTimeout(0)  // Disable timeout - we'll use keepalive instead
          }
          
          // Start keep-alive mechanism
          this.startKeepAlive()
          
          // Resubscribe to all previous subscriptions
          this.resubscribeAll()
          
          // Initialize UDP socket for meter updates
          this.initializeUdpSocket()
          
          resolve()
        })

        // Handle incoming data
        this.tcpSocket.on('data', (data) => {
          this.handleTcpData(data)
        })

        // Handle connection errors
        this.tcpSocket.on('error', (error: any) => {
          const errorMessage = this.getConnectionErrorMessage(error)
          atlasLogger.connectionFailure(this.config.ipAddress, this.config.tcpPort, errorMessage)
          this.connected = false
          this.tcpSocket?.destroy()
          reject(new Error(errorMessage))
        })

        // Handle connection timeout
        this.tcpSocket.on('timeout', () => {
          const timeoutError = new Error('Connection timeout')
          atlasLogger.connectionFailure(this.config.ipAddress, this.config.tcpPort, timeoutError)
          this.tcpSocket?.destroy()
          this.connected = false
          reject(timeoutError)
        })

        // Handle connection close
        this.tcpSocket.on('close', () => {
          atlasLogger.connectionClosed(this.config.ipAddress, this.config.tcpPort)
          this.connected = false
          
          // Stop keep-alive
          if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer)
            this.keepAliveTimer = null
          }
          
          // Reject all pending responses
          this.pendingResponses.forEach(({ reject, timeout }) => {
            clearTimeout(timeout)
            reject(new Error('Connection closed'))
          })
          this.pendingResponses.clear()
          
          // Attempt reconnection
          this.handleReconnection()
        })

        // Initiate connection
        this.tcpSocket.connect(this.config.tcpPort, this.config.ipAddress)
      } catch (error) {
        atlasLogger.connectionFailure(this.config.ipAddress, this.config.tcpPort, error)
        reject(error)
      }
    })
  }

  /**
   * Initialize UDP socket for meter updates
   * 
   * CRITICAL FIX: Uses SO_REUSEADDR to allow multiple processes (PM2 cluster workers)
   * to bind to the same UDP port. This prevents EADDRINUSE errors in cluster mode.
   */
  private initializeUdpSocket(): void {
    try {
      if (this.udpSocket) {
        this.udpSocket.close()
      }

      // Create UDP socket with reuseAddr option to support PM2 cluster mode
      this.udpSocket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true  // Allow multiple processes to bind to the same port
      })

      this.udpSocket.on('message', (msg) => {
        this.handleUdpData(msg)
      })

      this.udpSocket.on('error', (error) => {
        atlasLogger.error('UDP', 'UDP socket error', error)
      })

      // Bind with reuseAddr to allow PM2 cluster workers to share the port
      this.udpSocket.bind({
        port: this.config.udpPort,
        exclusive: false  // Allow port sharing across cluster workers
      })
      
      atlasLogger.info('UDP', 'UDP socket initialized for meter updates', {
        port: this.config.udpPort,
        reuseAddr: true,
        exclusive: false
      })
    } catch (error) {
      atlasLogger.error('UDP', 'Failed to initialize UDP socket', error)
    }
  }

  /**
   * Get a user-friendly error message from a connection error
   */
  private getConnectionErrorMessage(error: any): string {
    const code = error.code || error.errno
    const message = error.message || String(error)
    
    if (code === 'ECONNREFUSED') {
      return `Connection refused by Atlas processor at ${this.config.ipAddress}:${this.config.tcpPort}. Please verify the IP address and port, and ensure the processor is powered on and network accessible.`
    } else if (code === 'ETIMEDOUT' || code === 'ETIME OUT') {
      return `Connection timed out connecting to ${this.config.ipAddress}:${this.config.tcpPort}. The processor may be unreachable or the network is slow.`
    } else if (code === 'EHOSTUNREACH') {
      return `Host unreachable at ${this.config.ipAddress}. Please check network connectivity and routing.`
    } else if (code === 'ENETUNREACH') {
      return `Network unreachable for ${this.config.ipAddress}. Please check network configuration.`
    } else if (code === 'ENOTFOUND') {
      return `Host not found: ${this.config.ipAddress}. Please verify the IP address.`
    } else {
      return `Connection error: ${message} (${code || 'unknown'})`
    }
  }

  /**
   * Handle reconnection attempts
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      atlasLogger.error('RECONNECT', 'Max reconnection attempts reached', {
        attempts: this.reconnectAttempts
      })
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000)
    
    atlasLogger.info('RECONNECT', `Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`, {
      ipAddress: this.config.ipAddress
    })

    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        atlasLogger.error('RECONNECT', 'Reconnection failed', error)
      }
    }, delay)
  }

  /**
   * Start keep-alive mechanism
   * Sends "get" for "KeepAlive" parameter every 4 minutes
   */
  private startKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
    }

    this.keepAliveTimer = setInterval(async () => {
      try {
        atlasLogger.debug('KEEPALIVE', 'Sending keep-alive', {
          ipAddress: this.config.ipAddress
        })
        
        await this.getParameter('KeepAlive', 'str')
      } catch (error) {
        atlasLogger.error('KEEPALIVE', 'Keep-alive failed', error)
      }
    }, this.config.keepAliveInterval)
  }

  /**
   * Resubscribe to all previous subscriptions
   * Called after reconnection
   */
  private async resubscribeAll(): Promise<void> {
    if (this.subscriptions.size === 0) {
      return
    }

    atlasLogger.info('RESUBSCRIBE', `Resubscribing to ${this.subscriptions.size} parameters`, {
      ipAddress: this.config.ipAddress
    })

    for (const subKey of this.subscriptions) {
      try {
        const [param, format] = subKey.split(':')
        await this.subscribe(param, format as 'val' | 'pct' | 'str')
      } catch (error) {
        atlasLogger.error('RESUBSCRIBE', `Failed to resubscribe to ${subKey}`, error)
      }
    }
  }

  /**
   * Disconnect from the Atlas processor
   */
  disconnect(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }

    if (this.tcpSocket) {
      this.tcpSocket.destroy()
      this.tcpSocket = null
      this.connected = false
    }

    if (this.udpSocket) {
      this.udpSocket.close()
      this.udpSocket = null
    }

    atlasLogger.info('DISCONNECT', 'Disconnected from Atlas processor', {
      ipAddress: this.config.ipAddress
    })
  }

  /**
   * Handle incoming TCP data
   * 
   * CRITICAL: Messages are terminated with "\n" (newline), NOT "\r\n"
   */
  private handleTcpData(data: Buffer): void {
    // Append data to buffer
    this.responseBuffer += data.toString()

    // Process complete messages (terminated with \n)
    let newlineIndex: number
    while ((newlineIndex = this.responseBuffer.indexOf('\n')) !== -1) {
      const message = this.responseBuffer.substring(0, newlineIndex).trim()
      this.responseBuffer = this.responseBuffer.substring(newlineIndex + 1)

      if (message.length > 0) {
        this.handleMessage(message, 'TCP')
      }
    }
  }

  /**
   * Handle incoming UDP data for meter updates
   */
  private handleUdpData(data: Buffer): void {
    const message = data.toString().trim()
    if (message.length > 0) {
      this.handleMessage(message, 'UDP')
    }
  }

  /**
   * Handle a complete JSON-RPC message
   * 
   * CRITICAL: GET responses use method "getResp" with "params", NOT "result"
   * Response format: {"jsonrpc":"2.0","method":"getResp","params":{"param":"ZoneName_0","str":"Main Bar"}}
   */
  private handleMessage(message: string, source: 'TCP' | 'UDP'): void {
    try {
      const response = JSON.parse(message)
      
      atlasLogger.responseReceived(response, this.config.ipAddress)
      
      // Handle "getResp" method (response to "get" command)
      if (response.method === 'getResp') {
        // Find pending response by matching parameter name
        // Response format: {"jsonrpc":"2.0","method":"getResp","params":{"param":"ZoneName_0","str":"Main Bar"}}
        if (response.id !== undefined) {
          const pending = this.pendingResponses.get(response.id)
          if (pending) {
            clearTimeout(pending.timeout)
            this.pendingResponses.delete(response.id)
            pending.resolve(response)
          }
        }
      }
      
      // Handle responses with ID (standard JSON-RPC responses)
      else if (response.id !== undefined) {
        const pending = this.pendingResponses.get(response.id)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingResponses.delete(response.id)
          
          if (response.error) {
            atlasLogger.error('RESPONSE', 'Atlas command error', response.error)
            pending.reject(new Error(response.error.message || 'Atlas command error'))
          } else {
            pending.resolve(response)
          }
        }
      }
      
      // Handle "update" method (subscription updates)
      else if (response.method === 'update') {
        const param = response.params?.param || 'unknown'
        const value = response.params?.val !== undefined ? response.params.val 
                    : response.params?.pct !== undefined ? response.params.pct 
                    : response.params?.str
        
        atlasLogger.parameterUpdate(param, value, this.config.ipAddress)
        
        // Emit update event (can be extended for real-time UI updates)
        this.handleParameterUpdate(param, value, response.params)
      }
    } catch (error) {
      atlasLogger.error('PARSING', 'Error parsing message from Atlas', { 
        message, 
        source,
        error 
      })
    }
  }

  /**
   * Handle parameter update from subscription
   * Override this method to implement custom update handling
   */
  protected handleParameterUpdate(param: string, value: any, fullParams: any): void {
    // Default implementation: just log
    // Subclasses can override this for custom handling
  }

  /**
   * Send a command to the Atlas processor
   * 
   * CRITICAL: Messages MUST be terminated with "\n" (newline), NOT "\r\n"
   */
  private async sendCommand(command: AtlasCommand, withResponse: boolean = true): Promise<any> {
    if (!this.connected || !this.tcpSocket || this.tcpSocket.destroyed) {
      atlasLogger.error('COMMAND', 'Cannot send command - not connected', {
        connected: this.connected,
        hasSocket: !!this.tcpSocket,
        socketDestroyed: this.tcpSocket?.destroyed
      })
      throw new Error(`Not connected to Atlas processor at ${this.config.ipAddress}:${this.config.tcpPort}`)
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

    // Convert to JSON and add newline terminator (NOT \r\n)
    const jsonMessage = JSON.stringify(message) + '\n'
    
    atlasLogger.commandSent(message, this.config.ipAddress)

    // Send the message
    this.tcpSocket.write(jsonMessage)

    // If we don't need a response, return immediately
    if (!withResponse) {
      return { success: true }
    }

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(id)
        atlasLogger.commandTimeout(id, this.config.ipAddress)
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
      atlasLogger.zoneControl('SET_SOURCE', zoneIndex, sourceIndex, this.config.ipAddress)
      
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: sourceIndex,
        format: 'val'
      })

      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('ZONE_CONTROL', 'Error setting zone source', { zoneIndex, sourceIndex, error })
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
      atlasLogger.zoneControl('SET_VOLUME', zoneIndex, `${gainDb}${usePct ? '%' : 'dB'}`, this.config.ipAddress)
      
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: gainDb,
        format: usePct ? 'pct' : 'val'
      })

      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('ZONE_CONTROL', 'Error setting zone volume', { zoneIndex, gainDb, usePct, error })
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
      atlasLogger.zoneControl('SET_MUTE', zoneIndex, muted, this.config.ipAddress)
      
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: muted ? 1 : 0,
        format: 'val'
      })

      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('ZONE_CONTROL', 'Error setting zone mute', { zoneIndex, muted, error })
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

      atlasLogger.info('SCENE', `Recalled scene ${sceneIndex}`, {
        ipAddress: this.config.ipAddress
      })
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('SCENE', 'Error recalling scene', { sceneIndex, error })
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

      atlasLogger.info('MESSAGE', `Playing message ${messageIndex}`, {
        ipAddress: this.config.ipAddress
      })
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('MESSAGE', 'Error playing message', { messageIndex, error })
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

      atlasLogger.info('GROUP', `Set group ${groupIndex} to ${active ? 'active' : 'inactive'}`, {
        ipAddress: this.config.ipAddress
      })
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('GROUP', 'Error setting group active', { groupIndex, active, error })
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Set group source
   * @param groupIndex Group index (0-based)
   * @param sourceIndex Source index (0-based, -1 for no source)
   */
  async setGroupSource(groupIndex: number, sourceIndex: number): Promise<AtlasResponse> {
    try {
      const param = `GroupSource_${groupIndex}`
      atlasLogger.info('GROUP', `Setting group ${groupIndex} source to ${sourceIndex}`, {
        ipAddress: this.config.ipAddress
      })
      
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: sourceIndex,
        format: 'val'
      })

      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('GROUP', 'Error setting group source', { groupIndex, sourceIndex, error })
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Set group volume
   * @param groupIndex Group index (0-based)
   * @param gainDb Gain in dB (-80 to 0)
   */
  async setGroupVolume(groupIndex: number, gainDb: number): Promise<AtlasResponse> {
    try {
      const param = `GroupGain_${groupIndex}`
      atlasLogger.info('GROUP', `Setting group ${groupIndex} volume to ${gainDb}dB`, {
        ipAddress: this.config.ipAddress
      })
      
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: gainDb,
        format: 'val'
      })

      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('GROUP', 'Error setting group volume', { groupIndex, gainDb, error })
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Set group mute state
   * @param groupIndex Group index (0-based)
   * @param muted true to mute, false to unmute
   */
  async setGroupMute(groupIndex: number, muted: boolean): Promise<AtlasResponse> {
    try {
      const param = `GroupMute_${groupIndex}`
      atlasLogger.info('GROUP', `Setting group ${groupIndex} mute to ${muted}`, {
        ipAddress: this.config.ipAddress
      })
      
      const response = await this.sendCommand({
        method: 'set',
        param,
        value: muted ? 1 : 0,
        format: 'val'
      })

      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('GROUP', 'Error setting group mute', { groupIndex, muted, error })
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
      }, false) // Don't wait for response

      // Track subscription for reconnection
      this.subscriptions.add(`${param}:${format}`)

      atlasLogger.info('SUBSCRIBE', `Subscribed to ${param} (${format})`, {
        ipAddress: this.config.ipAddress
      })
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('SUBSCRIBE', 'Error subscribing', { param, format, error })
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
      }, false) // Don't wait for response

      // Remove from subscriptions
      this.subscriptions.delete(`${param}:${format}`)

      atlasLogger.info('UNSUBSCRIBE', `Unsubscribed from ${param} (${format})`, {
        ipAddress: this.config.ipAddress
      })
      return { success: true, data: response }
    } catch (error) {
      atlasLogger.error('UNSUBSCRIBE', 'Error unsubscribing', { param, format, error })
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get current value of a parameter
   * 
   * CRITICAL: Response uses method "getResp" with "params"
   * Response format: {"jsonrpc":"2.0","method":"getResp","params":{"param":"ZoneName_0","str":"Main Bar"}}
   * 
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

      atlasLogger.debug('GET', `Got ${param}`, { 
        ipAddress: this.config.ipAddress,
        response 
      })
      
      // Extract value from response based on format
      let value = null
      
      // Handle "getResp" method response (params object)
      if (response.method === 'getResp' && response.params) {
        if (format === 'val') {
          value = response.params.val
        } else if (format === 'pct') {
          value = response.params.pct
        } else if (format === 'str') {
          value = response.params.str
        }
      } 
      // Handle result array response (newer firmware format)
      else if (response.result && Array.isArray(response.result) && response.result.length > 0) {
        const resultObj = response.result[0]
        if (format === 'val') {
          value = resultObj.val
        } else if (format === 'pct') {
          value = resultObj.pct
        } else if (format === 'str') {
          value = resultObj.str
        }
      }
      // Handle direct result value (fallback)
      else if (response.result !== undefined && !Array.isArray(response.result)) {
        value = response.result
      }

      return { 
        success: true, 
        data: {
          ...response,
          value // Add extracted value for convenience
        }
      }
    } catch (error) {
      atlasLogger.error('GET', 'Error getting parameter', { param, format, error })
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
    return this.connected && this.tcpSocket !== null
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
    atlasLogger.error('COMMAND', 'Command execution error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    client.disconnect()
  }
}
