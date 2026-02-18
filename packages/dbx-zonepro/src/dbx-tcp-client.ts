/**
 * dbx ZonePRO TCP Client
 *
 * TCP/Ethernet client for dbx ZonePRO m-models (640m, 641m, 1260m, 1261m).
 * Implements HiQnet v1.0 protocol over TCP (port 3804).
 *
 * IMPORTANT: TCP connections do NOT use RS-232 framing (no start byte,
 * no frame count, no CRC checksum). TCP handles its own reliability.
 * Keep-alive pings are also NOT needed over TCP.
 */

import { Socket } from 'net'
import { EventEmitter } from 'events'
import { logger } from '@sports-bar/logger'
import { DBX_NETWORK_CONFIG, percentToVolume } from './config'
import {
  type HiQnetAddress,
  TcpFrameBuffer,
  buildVolumeSetFrame,
  buildMuteSetFrame,
  buildSourceSetFrame,
  buildRecallSceneFrame,
  buildGetFrame,
  DEFAULT_ROUTER_OBJECTS,
  parseTcpFrame,
} from './dbx-protocol'

export interface DbxTcpClientConfig {
  ipAddress: string
  port?: number
  autoReconnect?: boolean
  connectionTimeout?: number
  // HiQnet addressing - MUST be configured per installation
  deviceAddress?: number // ZonePRO's HiQnet node address (default: 0x0001)
  routerObjects?: HiQnetAddress[] // Router Object addresses from ZonePRO Designer
}

export interface DbxClientEvents {
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  data: (data: Buffer) => void
  response: (response: any) => void
}

/**
 * TCP client for dbx ZonePRO m-model processors
 */
export class DbxTcpClient extends EventEmitter {
  private config: Required<Omit<DbxTcpClientConfig, 'deviceAddress' | 'routerObjects'>>
  private deviceAddress: number
  private routerObjects: HiQnetAddress[]
  private socket: Socket | null = null
  private connected: boolean = false
  private connecting: boolean = false
  private frameBuffer: TcpFrameBuffer = new TcpFrameBuffer()
  private sequenceNumber: number = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0

  constructor(config: DbxTcpClientConfig) {
    super()

    this.config = {
      ipAddress: config.ipAddress,
      port: config.port ?? DBX_NETWORK_CONFIG.TCP_PORT,
      autoReconnect: config.autoReconnect ?? true,
      connectionTimeout: config.connectionTimeout ?? DBX_NETWORK_CONFIG.CONNECTION_TIMEOUT,
    }

    this.deviceAddress = config.deviceAddress ?? 0x0001
    this.routerObjects = config.routerObjects ?? DEFAULT_ROUTER_OBJECTS.map(obj => ({
      ...obj,
      device: this.deviceAddress,
    }))

    logger.info('[DBX-TCP] Client initialized', {
      data: {
        ipAddress: this.config.ipAddress,
        port: this.config.port,
        deviceAddress: `0x${this.deviceAddress.toString(16).padStart(4, '0')}`,
        routerObjects: this.routerObjects.length,
      },
    })
  }

  /**
   * Update Router Object addresses (from ZonePRO Designer configuration)
   */
  setRouterObjects(objects: HiQnetAddress[]): void {
    this.routerObjects = objects
    logger.info('[DBX-TCP] Router objects updated', {
      data: { count: objects.length },
    })
  }

  /**
   * Get the Router Object address for a zone
   */
  getRouterAddress(zone: number): HiQnetAddress {
    if (zone < 0 || zone >= this.routerObjects.length) {
      throw new Error(`Zone ${zone} out of range (0-${this.routerObjects.length - 1})`)
    }
    return this.routerObjects[zone]
  }

  /**
   * Connect to the dbx ZonePRO processor
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return
    }
    if (this.connecting) {
      return
    }

    this.connecting = true

    return new Promise((resolve, reject) => {
      logger.info('[DBX-TCP] Connecting...', {
        data: { ipAddress: this.config.ipAddress, port: this.config.port },
      })

      if (this.socket) {
        try { this.socket.destroy() } catch { /* ignore */ }
        this.socket = null
      }

      this.socket = new Socket()
      this.socket.setTimeout(this.config.connectionTimeout)
      this.socket.setNoDelay(true)
      this.socket.setKeepAlive(true, 30000)

      const connectionTimeout = setTimeout(() => {
        this.connecting = false
        const error = new Error('Connection timeout')
        logger.error('[DBX-TCP] Connection timeout', { error })
        this.socket?.destroy()
        reject(error)
      }, this.config.connectionTimeout)

      this.socket.on('connect', () => {
        clearTimeout(connectionTimeout)
        this.connected = true
        this.connecting = false
        this.reconnectAttempts = 0
        this.socket?.setTimeout(0)

        logger.info('[DBX-TCP] Connected successfully', {
          data: { ipAddress: this.config.ipAddress, port: this.config.port },
        })

        // No ping needed over TCP - TCP has its own keepalive
        this.emit('connected')
        resolve()
      })

      this.socket.on('data', (data) => {
        this.handleData(data)
      })

      this.socket.on('error', (error) => {
        clearTimeout(connectionTimeout)
        this.connecting = false
        logger.error('[DBX-TCP] Socket error', { error })
        this.emit('error', error)
        if (!this.connected) {
          reject(error)
        }
      })

      this.socket.on('close', () => {
        const wasConnected = this.connected
        this.connected = false
        this.connecting = false
        this.frameBuffer.clear()

        if (wasConnected) {
          logger.info('[DBX-TCP] Disconnected', {
            data: { ipAddress: this.config.ipAddress },
          })
          this.emit('disconnected')
          if (this.config.autoReconnect) {
            this.scheduleReconnect()
          }
        }
      })

      this.socket.on('timeout', () => {
        logger.warn('[DBX-TCP] Socket timeout')
        this.socket?.destroy()
      })

      this.socket.connect(this.config.port, this.config.ipAddress)
    })
  }

  /**
   * Disconnect from the processor
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this.connected = false
    this.connecting = false
    logger.info('[DBX-TCP] Disconnected by request')
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null && !this.socket.destroyed
  }

  /**
   * Handle incoming data (for any responses the ZonePRO might send)
   */
  private handleData(data: Buffer): void {
    logger.debug('[DBX-TCP] Received data', { data: { length: data.length, hex: data.toString('hex') } })
    this.frameBuffer.append(data)

    let frame
    while ((frame = this.frameBuffer.extractFrame()) !== null) {
      if (frame && frame.valid) {
        logger.info('[DBX-TCP] Received valid frame', {
          data: {
            messageId: `0x${frame.header.messageId.toString(16)}`,
            sequenceNumber: frame.header.sequenceNumber,
          },
        })
        this.emit('response', frame)
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectAttempts++
    if (this.reconnectAttempts > DBX_NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      logger.error('[DBX-TCP] Max reconnection attempts reached')
      this.emit('error', new Error('Max reconnection attempts reached'))
      return
    }

    const delay = Math.min(
      DBX_NETWORK_CONFIG.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      30000
    )

    logger.info('[DBX-TCP] Scheduling reconnection', {
      data: { attempt: this.reconnectAttempts, delay },
    })

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.connect()
      } catch (error) {
        logger.error('[DBX-TCP] Reconnection failed', { error })
      }
    }, delay)
  }

  /**
   * Get next sequence number
   */
  private getNextSequence(): number {
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xFFFF
    return this.sequenceNumber
  }

  /**
   * Send a raw buffer over TCP
   */
  private async sendFrame(frame: Buffer): Promise<any> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to dbx ZonePRO')
    }

    return new Promise((resolve, reject) => {
      logger.debug('[DBX-TCP] Sending frame', {
        data: { length: frame.length, hex: frame.toString('hex') },
      })

      this.socket!.write(frame, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve({ success: true })
        }
      })
    })
  }

  /**
   * Set volume for a zone
   * @param zone - Zone number (0-based)
   * @param volume - Volume value (0-415) or percentage if usePercent=true
   * @param usePercent - Interpret volume as percentage (default: false)
   */
  async setVolume(zone: number, volume: number, _stereo: boolean = true, usePercent: boolean = false): Promise<any> {
    const actualVolume = usePercent ? percentToVolume(volume) : volume
    const destAddress = this.getRouterAddress(zone)

    logger.info('[DBX-TCP] Setting volume', {
      data: {
        zone,
        volume: actualVolume,
        dest: `${destAddress.device.toString(16)}:${destAddress.vd.toString(16)}:${destAddress.object.toString(16)}`,
      },
    })

    const frame = buildVolumeSetFrame(destAddress, actualVolume, this.getNextSequence())
    return this.sendFrame(frame)
  }

  /**
   * Set mute state for a zone
   * @param zone - Zone number (0-based)
   * @param muted - true to mute, false to unmute
   */
  async setMute(zone: number, muted: boolean): Promise<any> {
    const destAddress = this.getRouterAddress(zone)

    logger.info('[DBX-TCP] Setting mute', {
      data: {
        zone,
        muted,
        dest: `${destAddress.device.toString(16)}:${destAddress.vd.toString(16)}:${destAddress.object.toString(16)}`,
      },
    })

    const frame = buildMuteSetFrame(destAddress, muted, this.getNextSequence())
    return this.sendFrame(frame)
  }

  /**
   * Set source for a zone
   * @param zone - Zone number (0-based)
   * @param sourceIndex - Source index (0=none, 1=first input, etc.)
   */
  async setSource(zone: number, sourceIndex: number): Promise<any> {
    const destAddress = this.getRouterAddress(zone)

    logger.info('[DBX-TCP] Setting source', {
      data: {
        zone,
        sourceIndex,
        dest: `${destAddress.device.toString(16)}:${destAddress.vd.toString(16)}:${destAddress.object.toString(16)}`,
      },
    })

    const frame = buildSourceSetFrame(destAddress, sourceIndex, this.getNextSequence())
    return this.sendFrame(frame)
  }

  /**
   * Recall a scene/preset
   * @param sceneNumber - Scene number to recall
   */
  async recallScene(sceneNumber: number): Promise<any> {
    // Scene recall targets the device, not a specific object
    const destAddress: HiQnetAddress = {
      device: this.deviceAddress,
      vd: 0x00,
      object: 0x000000,
    }

    logger.info('[DBX-TCP] Recalling scene', { data: { sceneNumber } })

    const frame = buildRecallSceneFrame(destAddress, sceneNumber, this.getNextSequence())
    return this.sendFrame(frame)
  }

  /**
   * Try to read a state variable (may not get response - ZonePRO is mostly one-way)
   */
  async getStateVariable(zone: number, svId: number): Promise<any> {
    const destAddress = this.getRouterAddress(zone)

    logger.info('[DBX-TCP] Getting state variable', {
      data: { zone, svId: `0x${svId.toString(16)}` },
    })

    const frame = buildGetFrame(destAddress, svId, this.getNextSequence())
    return this.sendFrame(frame)
  }

  /**
   * Send raw bytes (for diagnostic/testing)
   */
  async sendRawBytes(bytes: Buffer): Promise<any> {
    logger.info('[DBX-TCP] Sending raw bytes', {
      data: { length: bytes.length, hex: bytes.toString('hex') },
    })
    return this.sendFrame(bytes)
  }

  /**
   * Get connection configuration
   */
  getConfig(): DbxTcpClientConfig {
    return {
      ...this.config,
      deviceAddress: this.deviceAddress,
      routerObjects: [...this.routerObjects],
    }
  }
}

/**
 * Create and connect a TCP client
 */
export async function createDbxTcpClient(config: DbxTcpClientConfig): Promise<DbxTcpClient> {
  const client = new DbxTcpClient(config)
  await client.connect()
  return client
}

export default DbxTcpClient
