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
 * Uses serialized connect-per-command pattern: opens a fresh TCP connection
 * for each command, sends the frame, and closes. Commands are queued so only
 * one TCP connection is open at a time (dbx only handles one at a time).
 */
export class DbxTcpClient extends EventEmitter {
  private config: Required<Omit<DbxTcpClientConfig, 'deviceAddress' | 'routerObjects'>>
  private deviceAddress: number
  private routerObjects: HiQnetAddress[]
  private sequenceNumber: number = 0
  private _initialized: boolean = false
  // Command queue - dbx only handles one TCP connection at a time
  private sendQueue: Array<{ frame: Buffer; resolve: (v: any) => void; reject: (e: any) => void }> = []
  private sending: boolean = false

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

    logger.info('[DBX-TCP] Client initialized (serialized connect-per-command)', {
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
   * Connect - just marks client as ready (no test connection needed)
   */
  async connect(): Promise<void> {
    this._initialized = true
    logger.info('[DBX-TCP] Client ready', {
      data: { ipAddress: this.config.ipAddress, port: this.config.port },
    })
    this.emit('connected')
  }

  disconnect(): void {
    this._initialized = false
  }

  isConnected(): boolean {
    return this._initialized
  }

  private getNextSequence(): number {
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xFFFF
    return this.sequenceNumber
  }

  /**
   * Queue a frame to send. Only one TCP connection at a time.
   */
  private sendFrame(frame: Buffer): Promise<any> {
    return new Promise((resolve, reject) => {
      this.sendQueue.push({ frame, resolve, reject })
      this.processQueue()
    })
  }

  /**
   * Process the send queue serially - one TCP connection at a time
   */
  private async processQueue(): Promise<void> {
    if (this.sending || this.sendQueue.length === 0) return
    this.sending = true

    while (this.sendQueue.length > 0) {
      const { frame, resolve, reject } = this.sendQueue.shift()!
      try {
        await this.sendFrameNow(frame)
        resolve({ success: true })
      } catch (err) {
        reject(err)
      }
    }

    this.sending = false
  }

  /**
   * Open TCP, send frame, wait for write to flush, close
   */
  private sendFrameNow(frame: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket()
      socket.setNoDelay(true)

      const timer = setTimeout(() => {
        socket.destroy()
        reject(new Error('Connection timeout'))
      }, 2000)

      socket.on('connect', () => {
        clearTimeout(timer)
        socket.write(frame, (err) => {
          if (err) {
            socket.destroy()
            reject(err)
          } else {
            // Small delay to let data flush before closing
            setTimeout(() => {
              socket.destroy()
              resolve()
            }, 20)
          }
        })
      })

      socket.on('error', (error) => {
        clearTimeout(timer)
        socket.destroy()
        reject(error)
      })

      socket.connect(this.config.port, this.config.ipAddress)
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
