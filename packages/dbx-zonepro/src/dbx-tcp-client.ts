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
 * Protocol requirements:
 * - Send Resync_Request (0xF0) after connecting to sync the protocol state
 * - Send PING (0xF0 0x8C) every second when idle to keep connection active
 * - Without resync, the dbx enters a slow self-correcting state (~30s delay)
 */

import { Socket } from 'net'
import { EventEmitter } from 'events'
import { logger } from '@sports-bar/logger'
import { DBX_NETWORK_CONFIG, percentToVolume } from './config'
import {
  type HiQnetAddress,
  buildVolumeSetFrame,
  buildMuteSetFrame,
  buildSourceSetFrame,
  buildRecallSceneFrame,
  buildGetFrame,
  DEFAULT_ROUTER_OBJECTS,
} from './dbx-protocol'

// Protocol sync bytes
const RESYNC_REQUEST = 0xF0
const RESYNC_ACK = 0x8C
const PING_BYTES = Buffer.from([RESYNC_REQUEST, RESYNC_ACK])

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
 * Uses a persistent TCP connection with protocol resync and keepalive ping.
 * Commands are written directly to the socket. dbx ZonePRO is one-way
 * (no feedback), so we fire and forget.
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
  private pingInterval: ReturnType<typeof setInterval> | null = null
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

    logger.info('[DBX-TCP] Client initialized (persistent connection mode)', {
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
   * Sends resync byte and starts keepalive ping timer
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
        logger.info('[DBX-TCP] Connected', {
          data: { ipAddress: this.config.ipAddress, port: this.config.port, connectMs: Date.now() - connectStart },
        })

        // Send resync request to put dbx in known state
        this.sendResync()

        // Start keepalive ping timer
        this.startPingTimer()

        this.emit('connected')
        resolve()
      })

      socket.on('close', () => {
        this._connected = false
        this.socket = null
        this.stopPingTimer()
        this.emit('disconnected')
      })

      socket.on('error', (error) => {
        clearTimeout(timer)
        this._connected = false
        this.socket = null
        this.connecting = false
        this.connectPromise = null
        this.stopPingTimer()
        this.emit('error', error)
        reject(error)
      })

      socket.connect(this.config.port, this.config.ipAddress)
    })

    return this.connectPromise
  }

  /**
   * Send Resync_Request (0xF0) to sync protocol state
   * Without this, the dbx enters a slow self-correcting state (~30s delay)
   */
  private sendResync(): void {
    if (!this.socket) return
    const resyncBuf = Buffer.from([RESYNC_REQUEST])
    this.socket.write(resyncBuf, (err) => {
      if (err) {
        logger.error('[DBX-TCP] Resync send failed', { error: err })
      } else {
        logger.info('[DBX-TCP] Resync sent (0xF0)')
        this.lastSendTime = Date.now()
      }
    })
  }

  /**
   * Start keepalive ping timer - sends PING (0xF0 0x8C) every 1s when idle
   */
  private startPingTimer(): void {
    this.stopPingTimer()
    this.pingInterval = setInterval(() => {
      if (!this._connected || !this.socket) {
        this.stopPingTimer()
        return
      }

      // Only send ping if no message was sent in the last second
      if (Date.now() - this.lastSendTime >= 1000) {
        this.socket.write(PING_BYTES, (err) => {
          if (err) {
            logger.error('[DBX-TCP] Ping failed, connection dead', { error: err })
            this._connected = false
            this.socket?.destroy()
            this.socket = null
            this.stopPingTimer()
          }
        })
        this.lastSendTime = Date.now()
      }
    }, 1000)
  }

  /**
   * Stop keepalive ping timer
   */
  private stopPingTimer(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  disconnect(): void {
    this.stopPingTimer()
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
      this.stopPingTimer()
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
          this.stopPingTimer()
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
