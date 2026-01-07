/**
 * Lutron LIP (Lutron Integration Protocol) Client
 * Telnet-based control for RadioRA 2 and HomeWorks QS systems
 *
 * Protocol Reference: https://assets.lutron.com/a/documents/040249.pdf
 */

import { Socket } from 'net'
import { EventEmitter } from 'events'
import { LUTRON_CONFIG } from '../config'
import { lightingLogger } from '../commercial-lighting-logger'

export interface LutronLIPConfig {
  host: string
  port?: number
  username?: string
  password?: string
  keepAlive?: boolean
  reconnect?: boolean
}

export interface LutronDevice {
  integrationId: number
  name: string
  deviceType: 'dimmer' | 'switch' | 'keypad' | 'sensor' | 'shade'
  zoneId?: string
  currentLevel?: number
  isOn?: boolean
}

export interface LutronEvent {
  type: 'output' | 'device' | 'system' | 'area'
  integrationId: number
  component: number
  value: number | string
  raw: string
}

export interface LutronLIPStatus {
  connected: boolean
  host: string
  port: number
  lastActivity: Date | null
  deviceCount: number
}

/**
 * Lutron LIP Client
 * Handles Telnet communication with Lutron RadioRA 2 and HomeWorks QS systems
 */
export class LutronLIPClient extends EventEmitter {
  private socket: Socket | null = null
  private config: Required<LutronLIPConfig>
  private connected: boolean = false
  private authenticated: boolean = false
  private reconnecting: boolean = false
  private reconnectAttempts: number = 0
  private lastActivity: Date | null = null
  private keepAliveTimer: NodeJS.Timeout | null = null
  private responseBuffer: string = ''
  private pendingCommands: Map<string, {
    resolve: (value: string) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = new Map()
  private devices: Map<number, LutronDevice> = new Map()

  constructor(config: LutronLIPConfig) {
    super()

    this.config = {
      host: config.host,
      port: config.port ?? LUTRON_CONFIG.TELNET_PORT,
      username: config.username ?? LUTRON_CONFIG.DEFAULT_USERNAME,
      password: config.password ?? LUTRON_CONFIG.DEFAULT_PASSWORD,
      keepAlive: config.keepAlive ?? true,
      reconnect: config.reconnect ?? true,
    }
  }

  /**
   * Connect to the Lutron system
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup()
        reject(new Error(`Connection timeout to ${this.config.host}:${this.config.port}`))
      }, LUTRON_CONFIG.CONNECT_TIMEOUT_MS)

      this.socket = new Socket()

      this.socket.on('connect', () => {
        lightingLogger.info('Lutron TCP connected', {
          host: this.config.host,
          port: this.config.port,
        })
        // Wait for login prompt
      })

      this.socket.on('data', async (data) => {
        this.handleData(data.toString())

        // Handle authentication flow
        if (!this.authenticated) {
          const dataStr = data.toString().toLowerCase()

          if (dataStr.includes('login:')) {
            this.socket?.write(`${this.config.username}\r\n`)
          } else if (dataStr.includes('password:')) {
            this.socket?.write(`${this.config.password}\r\n`)
          } else if (dataStr.includes('gnet>') || dataStr.includes('qnet>')) {
            // Successfully authenticated
            this.authenticated = true
            this.connected = true
            this.lastActivity = new Date()
            this.reconnectAttempts = 0

            clearTimeout(timeout)
            this.startKeepAlive()

            lightingLogger.connection(this.config.host, 'Lutron', 'connected')
            this.emit('connected')
            resolve()
          } else if (dataStr.includes('bad') || dataStr.includes('invalid')) {
            clearTimeout(timeout)
            this.cleanup()
            reject(new Error('Authentication failed: Invalid credentials'))
          }
        }
      })

      this.socket.on('error', (error) => {
        lightingLogger.error('Lutron socket error', error)
        clearTimeout(timeout)
        this.handleDisconnect(error)
        if (!this.connected) {
          reject(error)
        }
      })

      this.socket.on('close', () => {
        this.handleDisconnect()
      })

      this.socket.on('timeout', () => {
        lightingLogger.warn('Lutron socket timeout')
        this.handleDisconnect(new Error('Socket timeout'))
      })

      // Set socket options
      this.socket.setTimeout(LUTRON_CONFIG.COMMAND_TIMEOUT_MS)

      // Connect
      this.socket.connect(this.config.port, this.config.host)
    })
  }

  /**
   * Disconnect from the Lutron system
   */
  disconnect(): void {
    this.config.reconnect = false // Prevent auto-reconnect
    this.cleanup()
    this.emit('disconnected')
    lightingLogger.connection(this.config.host, 'Lutron', 'disconnected')
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.authenticated
  }

  /**
   * Get client status
   */
  getStatus(): LutronLIPStatus {
    return {
      connected: this.isConnected(),
      host: this.config.host,
      port: this.config.port,
      lastActivity: this.lastActivity,
      deviceCount: this.devices.size,
    }
  }

  /**
   * Set output level (dimmer or switch)
   * @param integrationId - The integration ID of the output
   * @param level - Level 0-100 (0 = off, 100 = full on)
   * @param fadeTime - Optional fade time in seconds
   */
  async setOutputLevel(integrationId: number, level: number, fadeTime?: number): Promise<boolean> {
    const clampedLevel = Math.min(100, Math.max(0, Math.round(level)))

    let command = `${LUTRON_CONFIG.COMMAND_PREFIX}${LUTRON_CONFIG.ACTION_OUTPUT},${integrationId},${LUTRON_CONFIG.OUTPUT_COMPONENT.LEVEL},${clampedLevel}`

    if (fadeTime !== undefined && fadeTime > 0) {
      // Format: #OUTPUT,<id>,1,<level>,<fade>
      const fadeStr = fadeTime.toFixed(2)
      command = `${LUTRON_CONFIG.COMMAND_PREFIX}${LUTRON_CONFIG.ACTION_OUTPUT},${integrationId},${LUTRON_CONFIG.OUTPUT_COMPONENT.LEVEL},${clampedLevel},${fadeStr}`
    }

    try {
      await this.sendCommand(command)

      // Update local device state
      const device = this.devices.get(integrationId)
      if (device) {
        device.currentLevel = clampedLevel
        device.isOn = clampedLevel > 0
      }

      lightingLogger.lutronCommand(command, undefined, true)
      this.emit('outputChanged', { integrationId, level: clampedLevel })
      return true
    } catch (error) {
      lightingLogger.lutronCommand(command, undefined, false)
      return false
    }
  }

  /**
   * Query current output level
   * @param integrationId - The integration ID of the output
   */
  async getOutputLevel(integrationId: number): Promise<number> {
    const command = `${LUTRON_CONFIG.QUERY_PREFIX}${LUTRON_CONFIG.ACTION_OUTPUT},${integrationId},${LUTRON_CONFIG.OUTPUT_COMPONENT.LEVEL}`

    try {
      const response = await this.sendCommand(command)

      // Parse response: ~OUTPUT,<id>,1,<level>
      const match = response.match(/~OUTPUT,(\d+),1,([\d.]+)/)
      if (match) {
        const level = parseFloat(match[2])
        return Math.round(level)
      }

      return 0
    } catch (error) {
      lightingLogger.error('Failed to query output level', error, { integrationId })
      throw error
    }
  }

  /**
   * Press a button on a keypad
   * @param deviceId - The integration ID of the keypad
   * @param buttonId - The button number (1-based)
   */
  async pressButton(deviceId: number, buttonId: number): Promise<boolean> {
    // Press command
    const pressCommand = `${LUTRON_CONFIG.COMMAND_PREFIX}${LUTRON_CONFIG.ACTION_DEVICE},${deviceId},${buttonId},${LUTRON_CONFIG.DEVICE_ACTION.PRESS}`

    try {
      await this.sendCommand(pressCommand)

      // Send release after short delay
      setTimeout(async () => {
        const releaseCommand = `${LUTRON_CONFIG.COMMAND_PREFIX}${LUTRON_CONFIG.ACTION_DEVICE},${deviceId},${buttonId},${LUTRON_CONFIG.DEVICE_ACTION.RELEASE}`
        await this.sendCommand(releaseCommand).catch(() => {})
      }, 100)

      lightingLogger.deviceControl('Lutron', `Device ${deviceId}`, `button ${buttonId} pressed`, true)
      this.emit('buttonPressed', { deviceId, buttonId })
      return true
    } catch (error) {
      lightingLogger.deviceControl('Lutron', `Device ${deviceId}`, `button ${buttonId} pressed`, false)
      return false
    }
  }

  /**
   * Recall a scene by pressing its keypad button
   * @param sceneDeviceId - The integration ID of the keypad with the scene button
   * @param sceneButtonId - The button number for the scene
   */
  async recallScene(sceneDeviceId: number, sceneButtonId: number): Promise<boolean> {
    const success = await this.pressButton(sceneDeviceId, sceneButtonId)

    if (success) {
      lightingLogger.sceneRecall('Lutron', `${sceneDeviceId}:${sceneButtonId}`, true)
      this.emit('sceneRecalled', { deviceId: sceneDeviceId, buttonId: sceneButtonId })
    } else {
      lightingLogger.sceneRecall('Lutron', `${sceneDeviceId}:${sceneButtonId}`, false)
    }

    return success
  }

  /**
   * Start raising (dimming up)
   */
  async startRaise(integrationId: number): Promise<boolean> {
    const command = `${LUTRON_CONFIG.COMMAND_PREFIX}${LUTRON_CONFIG.ACTION_OUTPUT},${integrationId},${LUTRON_CONFIG.OUTPUT_COMPONENT.RAISE}`
    try {
      await this.sendCommand(command)
      return true
    } catch {
      return false
    }
  }

  /**
   * Start lowering (dimming down)
   */
  async startLower(integrationId: number): Promise<boolean> {
    const command = `${LUTRON_CONFIG.COMMAND_PREFIX}${LUTRON_CONFIG.ACTION_OUTPUT},${integrationId},${LUTRON_CONFIG.OUTPUT_COMPONENT.LOWER}`
    try {
      await this.sendCommand(command)
      return true
    } catch {
      return false
    }
  }

  /**
   * Stop raising/lowering
   */
  async stopRaiseLower(integrationId: number): Promise<boolean> {
    const command = `${LUTRON_CONFIG.COMMAND_PREFIX}${LUTRON_CONFIG.ACTION_OUTPUT},${integrationId},${LUTRON_CONFIG.OUTPUT_COMPONENT.STOP}`
    try {
      await this.sendCommand(command)
      return true
    } catch {
      return false
    }
  }

  /**
   * Register a device for tracking
   */
  registerDevice(device: LutronDevice): void {
    this.devices.set(device.integrationId, device)
    lightingLogger.debug('Registered Lutron device', { device })
  }

  /**
   * Get all registered devices
   */
  getDevices(): LutronDevice[] {
    return Array.from(this.devices.values())
  }

  /**
   * Get a specific device by integration ID
   */
  getDevice(integrationId: number): LutronDevice | undefined {
    return this.devices.get(integrationId)
  }

  // Private methods

  private async sendCommand(command: string): Promise<string> {
    if (!this.isConnected() || !this.socket) {
      throw new Error('Not connected to Lutron system')
    }

    return new Promise((resolve, reject) => {
      const commandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId)
        reject(new Error(`Command timeout: ${command}`))
      }, LUTRON_CONFIG.COMMAND_TIMEOUT_MS)

      this.pendingCommands.set(commandId, { resolve, reject, timeout })

      // Send command with carriage return
      this.socket!.write(`${command}\r\n`, (error) => {
        if (error) {
          clearTimeout(timeout)
          this.pendingCommands.delete(commandId)
          reject(error)
        } else {
          this.lastActivity = new Date()

          // For commands (not queries), resolve immediately
          if (command.startsWith(LUTRON_CONFIG.COMMAND_PREFIX)) {
            clearTimeout(timeout)
            this.pendingCommands.delete(commandId)
            resolve('')
          }
        }
      })
    })
  }

  private handleData(data: string): void {
    this.responseBuffer += data
    this.lastActivity = new Date()

    // Process complete lines
    const lines = this.responseBuffer.split(/\r?\n/)
    this.responseBuffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Parse response
      if (trimmed.startsWith(LUTRON_CONFIG.RESPONSE_PREFIX)) {
        const event = this.parseResponse(trimmed)
        if (event) {
          this.emit('event', event)

          // Update local device state
          if (event.type === 'output' && event.component === LUTRON_CONFIG.OUTPUT_COMPONENT.LEVEL) {
            const device = this.devices.get(event.integrationId)
            if (device) {
              device.currentLevel = Number(event.value)
              device.isOn = Number(event.value) > 0
            }
            this.emit('outputChanged', {
              integrationId: event.integrationId,
              level: Number(event.value),
            })
          }
        }

        // Resolve pending queries
        for (const [id, pending] of this.pendingCommands) {
          clearTimeout(pending.timeout)
          pending.resolve(trimmed)
          this.pendingCommands.delete(id)
          break // Only resolve one
        }
      }
    }
  }

  private parseResponse(response: string): LutronEvent | null {
    // Response format: ~<ACTION>,<id>,<component>,<value>
    const match = response.match(/~(\w+),(\d+),(\d+),(.+)/)
    if (!match) return null

    const [, action, id, component, value] = match

    let type: LutronEvent['type']
    switch (action.toUpperCase()) {
      case 'OUTPUT':
        type = 'output'
        break
      case 'DEVICE':
        type = 'device'
        break
      case 'SYSTEM':
        type = 'system'
        break
      case 'AREA':
        type = 'area'
        break
      default:
        return null
    }

    return {
      type,
      integrationId: parseInt(id, 10),
      component: parseInt(component, 10),
      value: isNaN(Number(value)) ? value : Number(value),
      raw: response,
    }
  }

  private handleDisconnect(error?: Error): void {
    const wasConnected = this.connected
    this.cleanup()

    if (wasConnected) {
      lightingLogger.connection(this.config.host, 'Lutron', 'disconnected', {
        error: error?.message,
      })
      this.emit('disconnected', error)

      // Attempt reconnection
      if (this.config.reconnect && !this.reconnecting) {
        this.attemptReconnect()
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnecting) return
    if (this.reconnectAttempts >= LUTRON_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      lightingLogger.error('Max reconnection attempts reached', undefined, {
        host: this.config.host,
        attempts: this.reconnectAttempts,
      })
      this.emit('reconnectFailed')
      return
    }

    this.reconnecting = true
    this.reconnectAttempts++

    const delay = Math.min(
      LUTRON_CONFIG.RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      60000
    )

    lightingLogger.info(`Attempting reconnection in ${delay}ms`, {
      attempt: this.reconnectAttempts,
      maxAttempts: LUTRON_CONFIG.MAX_RECONNECT_ATTEMPTS,
    })

    setTimeout(async () => {
      this.reconnecting = false
      try {
        await this.connect()
        lightingLogger.info('Reconnection successful')
        this.emit('reconnected')
      } catch (error) {
        lightingLogger.error('Reconnection failed', error)
        this.attemptReconnect()
      }
    }, delay)
  }

  private startKeepAlive(): void {
    if (!this.config.keepAlive) return

    this.stopKeepAlive()
    this.keepAliveTimer = setInterval(() => {
      if (this.isConnected()) {
        // Send a query to keep connection alive
        this.sendCommand(`${LUTRON_CONFIG.QUERY_PREFIX}${LUTRON_CONFIG.ACTION_SYSTEM},1,1`).catch(() => {})
      }
    }, LUTRON_CONFIG.KEEPALIVE_INTERVAL_MS)
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
  }

  private cleanup(): void {
    this.connected = false
    this.authenticated = false
    this.stopKeepAlive()

    // Clear pending commands
    for (const [, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Connection closed'))
    }
    this.pendingCommands.clear()

    // Close socket
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.destroy()
      this.socket = null
    }

    this.responseBuffer = ''
  }
}

export default LutronLIPClient
