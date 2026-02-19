/**
 * dbx ZonePRO TCP Client
 *
 * TCP/Ethernet client for dbx ZonePRO m-models (640m, 641m, 1260m, 1261m).
 * Implements HiQnet v1.0 protocol over TCP (port 3804).
 *
 * Uses a persistent TCP connection. The dbx only accepts one connection
 * at a time and becomes unresponsive to new connections after rapid
 * connect/disconnect cycles. Keeping one socket open avoids this.
 *
 * IMPORTANT: TCP uses raw HiQnet frames (version 0x01 header).
 * Do NOT send RS-232 sync bytes (0xF0, 0x8C) over TCP - they corrupt
 * the protocol stream. Keepalive uses a proper HiQnet DiscoInfo frame.
 */

import { Socket } from 'net'
import { EventEmitter } from 'events'
import { logger } from '@sports-bar/logger'
import { DBX_NETWORK_CONFIG, percentToVolume } from './config'
import {
  type HiQnetAddress,
  buildTcpFrame,
  buildVolumeSetFrame,
  buildMuteSetFrame,
  buildSourceSetFrame,
  buildRecallSceneFrame,
  buildGetFrame,
  CONTROLLER_ADDRESS,
  DEFAULT_ROUTER_OBJECTS,
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
 *
 * Uses a persistent TCP connection with HiQnet-level keepalive.
 * Commands are written directly to the socket.
 */
export class DbxTcpClient extends EventEmitter {
  private config: Required<Omit<DbxTcpClientConfig, 'deviceAddress' | 'routerObjects'>>
  private deviceAddress: number
  private routerObjects: HiQnetAddress[]
  private sequenceNumber: number = 0
  private socket: Socket | null = null
  private _connected: boolean = false
  private connecting: boolean = false
  private connectPromise: Promise<void> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private lastSendTime: number = 0

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
   * Connect to the dbx ZonePRO - opens persistent TCP connection
   * Starts HiQnet heartbeat timer to keep connection alive
   */
  async connect(): Promise<void> {
    if (this._connected && this.socket) return
    if (this.connecting && this.connectPromise) return this.connectPromise

    this.connecting = true
    const connectStart = Date.now()
    logger.info('[DBX-TCP] Connecting...', {
      data: { ipAddress: this.config.ipAddress, port: this.config.port },
    })
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = new Socket()
      socket.setNoDelay(true)
      socket.setKeepAlive(true, 5000)

      const timer = setTimeout(() => {
        socket.destroy()
        this.connecting = false
        this.connectPromise = null
        reject(new Error('Connection timeout'))
      }, 3000)

      socket.on('connect', () => {
        clearTimeout(timer)
        this.socket = socket
        this._connected = true
        this.connecting = false
        this.connectPromise = null
        this.lastSendTime = Date.now()
        logger.info('[DBX-TCP] Connected', {
          data: { ipAddress: this.config.ipAddress, port: this.config.port, connectMs: Date.now() - connectStart },
        })

        // Start HiQnet heartbeat (proper DiscoInfo frame, not RS-232 sync bytes)
        this.startHeartbeat()

        this.emit('connected')
        resolve()
      })

      socket.on('data', (data) => {
        // Log any data received from dbx (usually silent, but may respond to DiscoInfo)
        logger.debug('[DBX-TCP] Received data', {
          data: { length: data.length, hex: data.toString('hex').substring(0, 60) },
        })
        this.emit('data', data)
      })

      socket.on('close', () => {
        logger.info('[DBX-TCP] Connection closed')
        this._connected = false
        this.socket = null
        this.stopHeartbeat()
        this.emit('disconnected')
      })

      socket.on('error', (error) => {
        clearTimeout(timer)
        logger.error('[DBX-TCP] Socket error', { error })
        this._connected = false
        this.socket = null
        this.connecting = false
        this.connectPromise = null
        this.stopHeartbeat()
        this.emit('error', error)
        reject(error)
      })

      socket.connect(this.config.port, this.config.ipAddress)
    })

    return this.connectPromise
  }

  /**
   * Start HiQnet heartbeat - sends a DiscoInfo frame every 10s when idle
   * This keeps the connection active at the HiQnet protocol level.
   * Uses proper HiQnet frames, NOT RS-232 sync bytes.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    // Build a minimal HiQnet DiscoInfo frame (Message ID 0x0000) as heartbeat
    const heartbeatFrame = buildTcpFrame(
      0x0000, // DiscoInfo - discovery/keepalive
      { device: this.deviceAddress, vd: 0x00, object: 0x000000 },
      Buffer.alloc(0), // Empty payload for ping
      0,
      CONTROLLER_ADDRESS
    )

    this.heartbeatInterval = setInterval(() => {
      if (!this._connected || !this.socket) {
        this.stopHeartbeat()
        return
      }

      // Only send heartbeat if no message was sent in the last 10s
      if (Date.now() - this.lastSendTime >= 10000) {
        this.socket.write(heartbeatFrame, (err) => {
          if (err) {
            logger.error('[DBX-TCP] Heartbeat failed, connection dead', { error: err })
            this._connected = false
            this.socket?.destroy()
            this.socket = null
            this.stopHeartbeat()
          } else {
            this.lastSendTime = Date.now()
          }
        })
      }
    }, 10000)
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this._connected = false
    this.connecting = false
    this.connectPromise = null
  }

  isConnected(): boolean {
    return this._connected && this.socket !== null
  }

  private getNextSequence(): number {
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xFFFF
    return this.sequenceNumber
  }

  /**
   * Ensure connected, then write frame to persistent socket
   * Reconnects automatically if the socket has dropped
   */
  private async sendFrame(frame: Buffer): Promise<any> {
    // Reconnect if needed
    if (!this._connected || !this.socket) {
      await this.connect()
    }

    // Check for stale connection: if send buffer has backed up,
    // the dbx has stopped reading and the connection is dead
    if (this.socket && this.socket.writableLength > 100) {
      logger.info('[DBX-TCP] Send buffer backed up, reconnecting', {
        data: { buffered: this.socket.writableLength },
      })
      this.stopHeartbeat()
      this.socket.destroy()
      this.socket = null
      this._connected = false
      await this.connect()
    }

    logger.info('[DBX-TCP] Sending frame', {
      data: { length: frame.length, hex: frame.toString('hex') },
    })

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('No socket available'))
        return
      }

      this.socket.write(frame, (err) => {
        if (err) {
          logger.error('[DBX-TCP] Write error, reconnecting', { error: err })
          this._connected = false
          this.socket?.destroy()
          this.socket = null
          this.stopHeartbeat()
          reject(err)
        } else {
          this.lastSendTime = Date.now()
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
    const frame = buildVolumeSetFrame(destAddress, actualVolume, this.getNextSequence())
    return this.sendFrame(frame)
  }

  async setMute(zone: number, muted: boolean): Promise<any> {
    const destAddress = this.getRouterAddress(zone)
    const frame = buildMuteSetFrame(destAddress, muted, this.getNextSequence())
    return this.sendFrame(frame)
  }

  async setSource(zone: number, sourceIndex: number): Promise<any> {
    const destAddress = this.getRouterAddress(zone)
    const frame = buildSourceSetFrame(destAddress, sourceIndex, this.getNextSequence())
    return this.sendFrame(frame)
  }

  /**
   * Recall a scene/preset
   * @param sceneNumber - Scene number to recall
   */
  async recallScene(sceneNumber: number): Promise<any> {
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
