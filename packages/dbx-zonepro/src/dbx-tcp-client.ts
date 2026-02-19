/**
 * dbx ZonePRO TCP Client
 *
 * TCP/Ethernet client for dbx ZonePRO m-models (640m, 641m, 1260m, 1261m).
 * Implements HiQnet v1.0 protocol over TCP (port 3804).
 *
 * Uses a persistent connection with idle timeout. The dbx only accepts
 * one TCP connection at a time, and TIME_WAIT sockets from rapid
 * connect/disconnect block new connections. Keeping the socket open
 * avoids this. If the send buffer backs up (dbx stopped reading),
 * the connection is torn down and rebuilt.
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

export interface DbxTcpClientConfig {
  ipAddress: string
  port?: number
  autoReconnect?: boolean
  connectionTimeout?: number
  // HiQnet addressing - MUST be configured per installation
  deviceAddress?: number // ZonePRO's HiQnet node address (default: 0x001E = Node 30)
  routerObjects?: HiQnetAddress[] // Router Object addresses from ZonePRO Designer
}

export interface DbxClientEvents {
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  data: (data: Buffer) => void
  response: (response: any) => void
}

// Idle timeout before closing persistent connection (ms)
const IDLE_TIMEOUT = 30_000

/**
 * TCP client for dbx ZonePRO m-model processors
 *
 * Keeps a persistent TCP socket. Commands write directly to it.
 * If the socket is dead or send buffer backed up, reconnects automatically.
 * Socket closes after IDLE_TIMEOUT of no commands.
 */
export class DbxTcpClient extends EventEmitter {
  private config: Required<Omit<DbxTcpClientConfig, 'deviceAddress' | 'routerObjects'>>
  private deviceAddress: number
  private routerObjects: HiQnetAddress[]
  private sequenceNumber: number = 0
  private socket: Socket | null = null
  private _connected: boolean = false
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private connectPromise: Promise<void> | null = null

  constructor(config: DbxTcpClientConfig) {
    super()

    this.config = {
      ipAddress: config.ipAddress,
      port: config.port ?? DBX_NETWORK_CONFIG.TCP_PORT,
      autoReconnect: config.autoReconnect ?? true,
      connectionTimeout: config.connectionTimeout ?? DBX_NETWORK_CONFIG.CONNECTION_TIMEOUT,
    }

    this.deviceAddress = config.deviceAddress ?? 0x001E
    this.routerObjects = config.routerObjects ?? DEFAULT_ROUTER_OBJECTS.map(obj => ({
      ...obj,
      device: this.deviceAddress,
    }))

    logger.info('[DBX-TCP] Client initialized (persistent mode)', {
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
   * No-op for API compatibility - real connection happens on first command
   */
  async connect(): Promise<void> {
    this._connected = true
  }

  disconnect(): void {
    this.closeSocket()
    this._connected = false
  }

  isConnected(): boolean {
    return this._connected
  }

  private getNextSequence(): number {
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xFFFF
    return this.sequenceNumber
  }

  /**
   * Close the socket and clear timers
   */
  private closeSocket(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.destroy()
      this.socket = null
    }
    this.connectPromise = null
  }

  /**
   * Reset the idle timer - closes socket after IDLE_TIMEOUT of no commands
   */
  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
    }
    this.idleTimer = setTimeout(() => {
      logger.info('[DBX-TCP] Idle timeout, closing connection')
      this.closeSocket()
    }, IDLE_TIMEOUT)
  }

  /**
   * Get or create a TCP connection to the dbx
   */
  private async ensureSocket(): Promise<Socket> {
    // If socket exists and send buffer is healthy, reuse it
    if (this.socket && !this.socket.destroyed && this.socket.writableLength < 100) {
      return this.socket
    }

    // If socket exists but stale (send buffer backed up), tear it down
    if (this.socket) {
      logger.info('[DBX-TCP] Socket stale or destroyed, reconnecting', {
        data: {
          destroyed: this.socket.destroyed,
          writableLength: this.socket.writableLength,
        },
      })
      this.closeSocket()
    }

    // If a connect is already in progress, wait for it
    if (this.connectPromise) {
      await this.connectPromise
      if (this.socket && !this.socket.destroyed) {
        return this.socket
      }
    }

    // Open new connection
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = new Socket()
      socket.setNoDelay(true)

      const timer = setTimeout(() => {
        socket.destroy()
        this.connectPromise = null
        reject(new Error('Connection timeout'))
      }, 5000)

      socket.on('connect', () => {
        clearTimeout(timer)
        this.socket = socket
        this.connectPromise = null
        logger.info('[DBX-TCP] Connected')
        this.emit('connected')
        resolve()
      })

      socket.on('close', () => {
        if (this.socket === socket) {
          this.socket = null
        }
        this.emit('disconnected')
      })

      socket.on('error', (error) => {
        clearTimeout(timer)
        logger.error('[DBX-TCP] Socket error', { error })
        if (this.socket === socket) {
          this.socket = null
        }
        this.connectPromise = null
        this.emit('error', error)
        reject(error)
      })

      socket.connect(this.config.port, this.config.ipAddress)
    })

    await this.connectPromise
    return this.socket!
  }

  /**
   * Send a frame over the persistent connection
   */
  private async sendFrame(frame: Buffer): Promise<any> {
    const socket = await this.ensureSocket()
    this.resetIdleTimer()

    logger.info('[DBX-TCP] Sending frame', {
      data: { length: frame.length, hex: frame.toString('hex') },
    })

    return new Promise((resolve, reject) => {
      socket.write(frame, (err) => {
        if (err) {
          logger.error('[DBX-TCP] Write error', { error: err })
          this.closeSocket()
          reject(err)
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
