/**
 * Lutron LEAP (Lutron Extensible Application Protocol) Client
 * TLS-based control for RadioRA 3 and Caseta systems
 *
 * Protocol Reference:
 * - RadioRA 3: Port 8081 with certificate authentication
 * - Caseta Pro: Port 8083 with certificate authentication
 *
 * LEAP uses a JSON-based messaging protocol over TLS
 */

import * as tls from 'tls'
import * as fs from 'fs'
import { EventEmitter } from 'events'
import { LUTRON_CONFIG } from '../config'
import { lightingLogger } from '../commercial-lighting-logger'

export interface LEAPConfig {
  host: string
  port?: number // 8081 for RadioRA 3, 8083 for Caseta
  keyFile?: string // Path to client key
  certFile?: string // Path to client cert
  caFile?: string // Path to CA cert (bridge cert)
  reconnect?: boolean
}

export interface LEAPDevice {
  id: string
  href: string
  name: string
  deviceType: string
  model?: string
  serialNumber?: string
  zoneId?: string
}

export interface LEAPZone {
  id: string
  href: string
  name: string
  controlType: string // 'Dimmed' | 'Switched' | 'Shade'
  level?: number
  associatedArea?: string
}

export interface LEAPScene {
  id: string
  href: string
  name: string
  areaId?: string
}

export interface LEAPArea {
  id: string
  href: string
  name: string
  occupancyStatus?: string
}

export interface LEAPButtonGroup {
  id: string
  href: string
  deviceId: string
  buttons: LEAPButton[]
}

export interface LEAPButton {
  buttonNumber: number
  name?: string
  engraving?: string
}

export interface LEAPEvent {
  type: 'zone' | 'device' | 'button' | 'occupancy' | 'scene'
  href: string
  data: Record<string, unknown>
  raw: string
}

export interface LEAPStatus {
  connected: boolean
  host: string
  port: number
  lastActivity: Date | null
  subscribed: boolean
}

// LEAP Message Types
type CommuniqueType =
  | 'ReadRequest'
  | 'ReadResponse'
  | 'CreateRequest'
  | 'CreateResponse'
  | 'UpdateRequest'
  | 'UpdateResponse'
  | 'DeleteRequest'
  | 'DeleteResponse'
  | 'SubscribeRequest'
  | 'SubscribeResponse'
  | 'ExceptionResponse'

interface LEAPMessage {
  CommuniqueType: CommuniqueType
  Header: {
    MessageBodyType?: string
    StatusCode?: {
      code: number
      message?: string
    }
    Url?: string
    ClientTag?: string
  }
  Body?: Record<string, unknown>
}

/**
 * Lutron LEAP Client
 * Handles TLS communication with Lutron RadioRA 3 and Caseta systems
 */
export class LutronLEAPClient extends EventEmitter {
  private socket: tls.TLSSocket | null = null
  private config: Required<LEAPConfig>
  private connected: boolean = false
  private subscribed: boolean = false
  private reconnecting: boolean = false
  private reconnectAttempts: number = 0
  private lastActivity: Date | null = null
  private messageId: number = 1
  private responseBuffer: string = ''
  private pendingRequests: Map<
    string,
    {
      resolve: (value: LEAPMessage) => void
      reject: (error: Error) => void
      timeout: NodeJS.Timeout
    }
  > = new Map()

  // Cached data
  private devices: Map<string, LEAPDevice> = new Map()
  private zones: Map<string, LEAPZone> = new Map()
  private scenes: Map<string, LEAPScene> = new Map()
  private areas: Map<string, LEAPArea> = new Map()

  constructor(config: LEAPConfig) {
    super()

    this.config = {
      host: config.host,
      port: config.port ?? LUTRON_CONFIG.LEAP_PORT,
      keyFile: config.keyFile ?? '',
      certFile: config.certFile ?? '',
      caFile: config.caFile ?? '',
      reconnect: config.reconnect ?? true,
    }
  }

  /**
   * Connect to the Lutron LEAP system
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

      const tlsOptions: tls.ConnectionOptions = {
        host: this.config.host,
        port: this.config.port,
        rejectUnauthorized: false, // Lutron uses self-signed certs
      }

      // Load certificates if provided
      if (this.config.keyFile && fs.existsSync(this.config.keyFile)) {
        tlsOptions.key = fs.readFileSync(this.config.keyFile)
      }
      if (this.config.certFile && fs.existsSync(this.config.certFile)) {
        tlsOptions.cert = fs.readFileSync(this.config.certFile)
      }
      if (this.config.caFile && fs.existsSync(this.config.caFile)) {
        tlsOptions.ca = fs.readFileSync(this.config.caFile)
      }

      this.socket = tls.connect(tlsOptions, () => {
        clearTimeout(timeout)
        this.connected = true
        this.lastActivity = new Date()
        this.reconnectAttempts = 0

        lightingLogger.connection(this.config.host, 'Lutron LEAP', 'connected')
        this.emit('connected')
        resolve()
      })

      this.socket.on('data', (data: Buffer) => {
        this.handleData(data)
      })

      this.socket.on('error', (error: Error) => {
        lightingLogger.error('Lutron LEAP socket error', error)
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
        lightingLogger.warn('Lutron LEAP socket timeout')
        this.handleDisconnect(new Error('Socket timeout'))
      })

      this.socket.setTimeout(LUTRON_CONFIG.COMMAND_TIMEOUT_MS)
    })
  }

  /**
   * Disconnect from the Lutron LEAP system
   */
  disconnect(): void {
    this.config.reconnect = false // Prevent auto-reconnect
    this.cleanup()
    this.emit('disconnected')
    lightingLogger.connection(this.config.host, 'Lutron LEAP', 'disconnected')
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get client status
   */
  getStatus(): LEAPStatus {
    return {
      connected: this.connected,
      host: this.config.host,
      port: this.config.port,
      lastActivity: this.lastActivity,
      subscribed: this.subscribed,
    }
  }

  /**
   * Set zone level (dimmer or switch)
   * @param zoneId - The zone ID or href
   * @param level - Level 0-100
   */
  async setZoneLevel(zoneId: string, level: number): Promise<boolean> {
    const clampedLevel = Math.min(100, Math.max(0, Math.round(level)))
    const href = this.normalizeZoneHref(zoneId)

    try {
      await this.sendMessage({
        CommuniqueType: 'CreateRequest',
        Header: {
          Url: `${href}/commandprocessor`,
        },
        Body: {
          Command: {
            CommandType: 'GoToLevel',
            Parameter: [
              {
                Type: 'Level',
                Value: clampedLevel,
              },
            ],
          },
        },
      })

      // Update local cache
      const zone = this.zones.get(zoneId)
      if (zone) {
        zone.level = clampedLevel
      }

      lightingLogger.zoneControl('Lutron LEAP', zoneId, clampedLevel, true)
      this.emit('zoneChanged', { zoneId, level: clampedLevel })
      return true
    } catch (error) {
      lightingLogger.zoneControl('Lutron LEAP', zoneId, clampedLevel, false)
      return false
    }
  }

  /**
   * Query current zone level
   * @param zoneId - The zone ID or href
   */
  async getZoneLevel(zoneId: string): Promise<number> {
    const href = this.normalizeZoneHref(zoneId)

    try {
      const response = await this.sendMessage({
        CommuniqueType: 'ReadRequest',
        Header: {
          Url: `${href}/status`,
        },
      })

      if (response.Body && 'ZoneStatus' in response.Body) {
        const zoneStatus = response.Body.ZoneStatus as { Level?: number }
        return zoneStatus.Level ?? 0
      }

      return 0
    } catch (error) {
      lightingLogger.error('Failed to query zone level', error, { zoneId })
      throw error
    }
  }

  /**
   * Press a button on a keypad
   * @param deviceId - The device ID or href
   * @param buttonNumber - The button number
   */
  async pressButton(deviceId: string, buttonNumber: number): Promise<boolean> {
    const href = this.normalizeDeviceHref(deviceId)

    try {
      // Press the button
      await this.sendMessage({
        CommuniqueType: 'CreateRequest',
        Header: {
          Url: `${href}/buttongroup/expanded`,
        },
        Body: {
          Command: {
            CommandType: 'PressAndRelease',
            ButtonGroupSetting: {
              Button: {
                href: `${href}/button/${buttonNumber}`,
              },
            },
          },
        },
      })

      lightingLogger.deviceControl('Lutron LEAP', deviceId, `button ${buttonNumber} pressed`, true)
      this.emit('buttonPressed', { deviceId, buttonNumber })
      return true
    } catch (error) {
      lightingLogger.deviceControl(
        'Lutron LEAP',
        deviceId,
        `button ${buttonNumber} pressed`,
        false
      )
      return false
    }
  }

  /**
   * Activate a scene
   * @param sceneId - The scene ID or href
   */
  async activateScene(sceneId: string): Promise<boolean> {
    const href = this.normalizeSceneHref(sceneId)

    try {
      await this.sendMessage({
        CommuniqueType: 'CreateRequest',
        Header: {
          Url: `${href}/commandprocessor`,
        },
        Body: {
          Command: {
            CommandType: 'ActivatePreset',
          },
        },
      })

      lightingLogger.sceneRecall('Lutron LEAP', sceneId, true)
      this.emit('sceneActivated', { sceneId })
      return true
    } catch (error) {
      lightingLogger.sceneRecall('Lutron LEAP', sceneId, false)
      return false
    }
  }

  /**
   * Get all devices from the system
   */
  async getDevices(): Promise<LEAPDevice[]> {
    try {
      const response = await this.sendMessage({
        CommuniqueType: 'ReadRequest',
        Header: {
          Url: '/device',
        },
      })

      if (response.Body && 'Devices' in response.Body) {
        const rawDevices = response.Body.Devices as Array<{
          href: string
          Name?: string
          DeviceType?: string
          ModelNumber?: string
          SerialNumber?: string
        }>

        const devices: LEAPDevice[] = rawDevices.map((d) => ({
          id: this.extractIdFromHref(d.href),
          href: d.href,
          name: d.Name || 'Unknown Device',
          deviceType: d.DeviceType || 'Unknown',
          model: d.ModelNumber,
          serialNumber: d.SerialNumber,
        }))

        // Update cache
        devices.forEach((device) => {
          this.devices.set(device.id, device)
        })

        lightingLogger.discovery('Lutron LEAP', devices.length, {
          host: this.config.host,
        })

        return devices
      }

      return []
    } catch (error) {
      lightingLogger.error('Failed to get devices', error)
      return []
    }
  }

  /**
   * Get all zones from the system
   */
  async getZones(): Promise<LEAPZone[]> {
    try {
      const response = await this.sendMessage({
        CommuniqueType: 'ReadRequest',
        Header: {
          Url: '/zone',
        },
      })

      if (response.Body && 'Zones' in response.Body) {
        const rawZones = response.Body.Zones as Array<{
          href: string
          Name?: string
          ControlType?: string
          AssociatedArea?: { href: string }
        }>

        const zones: LEAPZone[] = rawZones.map((z) => ({
          id: this.extractIdFromHref(z.href),
          href: z.href,
          name: z.Name || 'Unknown Zone',
          controlType: z.ControlType || 'Dimmed',
          associatedArea: z.AssociatedArea?.href
            ? this.extractIdFromHref(z.AssociatedArea.href)
            : undefined,
        }))

        // Update cache
        zones.forEach((zone) => {
          this.zones.set(zone.id, zone)
        })

        return zones
      }

      return []
    } catch (error) {
      lightingLogger.error('Failed to get zones', error)
      return []
    }
  }

  /**
   * Get all scenes (presets) from the system
   */
  async getScenes(): Promise<LEAPScene[]> {
    try {
      const response = await this.sendMessage({
        CommuniqueType: 'ReadRequest',
        Header: {
          Url: '/preset',
        },
      })

      if (response.Body && 'Presets' in response.Body) {
        const rawScenes = response.Body.Presets as Array<{
          href: string
          Name?: string
          AssociatedArea?: { href: string }
        }>

        const scenes: LEAPScene[] = rawScenes.map((s) => ({
          id: this.extractIdFromHref(s.href),
          href: s.href,
          name: s.Name || 'Unknown Scene',
          areaId: s.AssociatedArea?.href
            ? this.extractIdFromHref(s.AssociatedArea.href)
            : undefined,
        }))

        // Update cache
        scenes.forEach((scene) => {
          this.scenes.set(scene.id, scene)
        })

        return scenes
      }

      return []
    } catch (error) {
      lightingLogger.error('Failed to get scenes', error)
      return []
    }
  }

  /**
   * Get all areas from the system
   */
  async getAreas(): Promise<LEAPArea[]> {
    try {
      const response = await this.sendMessage({
        CommuniqueType: 'ReadRequest',
        Header: {
          Url: '/area',
        },
      })

      if (response.Body && 'Areas' in response.Body) {
        const rawAreas = response.Body.Areas as Array<{
          href: string
          Name?: string
        }>

        const areas: LEAPArea[] = rawAreas.map((a) => ({
          id: this.extractIdFromHref(a.href),
          href: a.href,
          name: a.Name || 'Unknown Area',
        }))

        // Update cache
        areas.forEach((area) => {
          this.areas.set(area.id, area)
        })

        return areas
      }

      return []
    } catch (error) {
      lightingLogger.error('Failed to get areas', error)
      return []
    }
  }

  /**
   * Subscribe to real-time events from the system
   */
  async subscribeToEvents(): Promise<void> {
    if (this.subscribed) {
      return
    }

    try {
      // Subscribe to zone status changes
      await this.sendMessage({
        CommuniqueType: 'SubscribeRequest',
        Header: {
          Url: '/zone/status',
        },
      })

      // Subscribe to button events
      await this.sendMessage({
        CommuniqueType: 'SubscribeRequest',
        Header: {
          Url: '/button/status',
        },
      })

      // Subscribe to occupancy events
      await this.sendMessage({
        CommuniqueType: 'SubscribeRequest',
        Header: {
          Url: '/occupancygroup/status',
        },
      })

      this.subscribed = true
      lightingLogger.info('Subscribed to LEAP events', { host: this.config.host })
      this.emit('subscribed')
    } catch (error) {
      lightingLogger.error('Failed to subscribe to events', error)
      throw error
    }
  }

  // Private methods

  private async sendMessage(body: Omit<LEAPMessage, 'Header'> & { Header: Partial<LEAPMessage['Header']> }): Promise<LEAPMessage> {
    if (!this.isConnected() || !this.socket) {
      throw new Error('Not connected to Lutron LEAP system')
    }

    const clientTag = `${this.messageId++}`
    const message: LEAPMessage = {
      ...body,
      Header: {
        ...body.Header,
        ClientTag: clientTag,
      },
    } as LEAPMessage

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(clientTag)
        reject(new Error(`Message timeout: ${message.CommuniqueType}`))
      }, LUTRON_CONFIG.COMMAND_TIMEOUT_MS)

      this.pendingRequests.set(clientTag, { resolve, reject, timeout })

      const jsonMessage = JSON.stringify(message)
      lightingLogger.debug('LEAP send', { message: jsonMessage })

      // LEAP messages are terminated with CRLF
      this.socket!.write(`${jsonMessage}\r\n`, (error) => {
        if (error) {
          clearTimeout(timeout)
          this.pendingRequests.delete(clientTag)
          reject(error)
        } else {
          this.lastActivity = new Date()
        }
      })
    })
  }

  private handleData(data: Buffer): void {
    this.responseBuffer += data.toString()
    this.lastActivity = new Date()

    // LEAP messages are JSON objects separated by CRLF
    const lines = this.responseBuffer.split(/\r?\n/)
    this.responseBuffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const message = JSON.parse(trimmed) as LEAPMessage
        this.handleMessage(message)
      } catch (error) {
        lightingLogger.warn('Failed to parse LEAP message', { line: trimmed })
      }
    }
  }

  private handleMessage(message: LEAPMessage): void {
    lightingLogger.debug('LEAP received', { message: JSON.stringify(message) })

    // Check for response to pending request
    const clientTag = message.Header?.ClientTag
    if (clientTag && this.pendingRequests.has(clientTag)) {
      const pending = this.pendingRequests.get(clientTag)!
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(clientTag)

      if (message.CommuniqueType === 'ExceptionResponse') {
        const errorMessage = message.Header?.StatusCode?.message || 'Unknown error'
        pending.reject(new Error(`LEAP error: ${errorMessage}`))
      } else {
        pending.resolve(message)
      }
      return
    }

    // Handle unsolicited events (subscriptions)
    this.handleEvent(message)
  }

  private handleEvent(message: LEAPMessage): void {
    const url = message.Header?.Url || ''
    const body = message.Body

    if (!body) return

    let event: LEAPEvent | null = null

    if (url.includes('/zone/') && 'ZoneStatus' in body) {
      const zoneStatus = body.ZoneStatus as { Zone?: { href: string }; Level?: number }
      const zoneHref = zoneStatus.Zone?.href || url
      const zoneId = this.extractIdFromHref(zoneHref)

      // Update cache
      const zone = this.zones.get(zoneId)
      if (zone && zoneStatus.Level !== undefined) {
        zone.level = zoneStatus.Level
      }

      event = {
        type: 'zone',
        href: zoneHref,
        data: { level: zoneStatus.Level },
        raw: JSON.stringify(message),
      }

      this.emit('zoneChanged', { zoneId, level: zoneStatus.Level })
    } else if (url.includes('/button/') && 'ButtonStatus' in body) {
      const buttonStatus = body.ButtonStatus as {
        Button?: { href: string }
        ButtonEvent?: { EventType: string }
      }
      const buttonHref = buttonStatus.Button?.href || url
      const eventType = buttonStatus.ButtonEvent?.EventType

      event = {
        type: 'button',
        href: buttonHref,
        data: { eventType },
        raw: JSON.stringify(message),
      }

      if (eventType === 'Press') {
        this.emit('buttonPressed', { href: buttonHref })
      }
    } else if (url.includes('/occupancygroup/') && 'OccupancyGroupStatus' in body) {
      const occupancyStatus = body.OccupancyGroupStatus as {
        OccupancyGroup?: { href: string }
        OccupancyStatus?: string
      }
      const occupancyHref = occupancyStatus.OccupancyGroup?.href || url

      event = {
        type: 'occupancy',
        href: occupancyHref,
        data: { status: occupancyStatus.OccupancyStatus },
        raw: JSON.stringify(message),
      }

      this.emit('occupancyChanged', {
        href: occupancyHref,
        status: occupancyStatus.OccupancyStatus,
      })
    }

    if (event) {
      this.emit('event', event)
    }
  }

  private normalizeZoneHref(zoneId: string): string {
    if (zoneId.startsWith('/zone/')) return zoneId
    return `/zone/${zoneId}`
  }

  private normalizeDeviceHref(deviceId: string): string {
    if (deviceId.startsWith('/device/')) return deviceId
    return `/device/${deviceId}`
  }

  private normalizeSceneHref(sceneId: string): string {
    if (sceneId.startsWith('/preset/')) return sceneId
    return `/preset/${sceneId}`
  }

  private extractIdFromHref(href: string): string {
    // Extract ID from href like "/zone/123" -> "123"
    const match = href.match(/\/(\d+)$/)
    return match ? match[1] : href
  }

  private handleDisconnect(error?: Error): void {
    const wasConnected = this.connected
    this.cleanup()

    if (wasConnected) {
      lightingLogger.connection(this.config.host, 'Lutron LEAP', 'disconnected', {
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

    lightingLogger.info(`Attempting LEAP reconnection in ${delay}ms`, {
      attempt: this.reconnectAttempts,
      maxAttempts: LUTRON_CONFIG.MAX_RECONNECT_ATTEMPTS,
    })

    setTimeout(async () => {
      this.reconnecting = false
      try {
        await this.connect()
        lightingLogger.info('LEAP reconnection successful')

        // Re-subscribe to events
        if (this.subscribed) {
          this.subscribed = false
          await this.subscribeToEvents()
        }

        this.emit('reconnected')
      } catch (error) {
        lightingLogger.error('LEAP reconnection failed', error)
        this.attemptReconnect()
      }
    }, delay)
  }

  private cleanup(): void {
    this.connected = false
    this.subscribed = false

    // Clear pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    // Close socket
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.destroy()
      this.socket = null
    }

    this.responseBuffer = ''
  }
}

export default LutronLEAPClient
