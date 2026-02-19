/**
 * dbx ZonePRO TCP Client
 *
 * TCP/Ethernet client for dbx ZonePRO m-models (640m, 641m, 1260m, 1261m).
 * Implements HiQnet v1.0 protocol over TCP (port 3804).
 *
 * Uses connect-per-command pattern: connect → send → disconnect.
 * The dbx stops reading from persistent/long-lived connections, so each
 * command gets a fresh TCP session. Commands are serialized through a
 * queue to prevent rapid reconnection which can lock up the dbx.
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

/**
 * TCP client for dbx ZonePRO m-model processors
 *
 * Uses connect-per-command with a serialized queue.
 * Each command: connect → send → brief pause → disconnect.
 * Queue ensures only one TCP session at a time.
 */
export class DbxTcpClient extends EventEmitter {
  private config: Required<Omit<DbxTcpClientConfig, 'deviceAddress' | 'routerObjects'>>
  private deviceAddress: number
  private routerObjects: HiQnetAddress[]
  private sequenceNumber: number = 0
  private _connected: boolean = false
  private commandQueue: Array<{ frame: Buffer; resolve: (v: any) => void; reject: (e: Error) => void }> = []
  private processing: boolean = false

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

    logger.info('[DBX-TCP] Client initialized (connect-per-command mode)', {
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
   * No-op for API compatibility - connection is per-command now
   */
  async connect(): Promise<void> {
    this._connected = true
  }

  disconnect(): void {
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
   * Queue a frame for sending. Commands are serialized so only one
   * TCP session is active at a time.
   */
  private async sendFrame(frame: Buffer): Promise<any> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ frame, resolve, reject })
      this.processQueue()
    })
  }

  /**
   * Process the command queue - one command at a time.
   * Each command: connect → send → 200ms pause → disconnect
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.commandQueue.length > 0) {
      const cmd = this.commandQueue.shift()!

      try {
        await this.connectSendDisconnect(cmd.frame)
        cmd.resolve({ success: true })
      } catch (err: any) {
        cmd.reject(err)
      }

      // Brief pause between commands to let dbx recover
      if (this.commandQueue.length > 0) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    this.processing = false
  }

  /**
   * Single atomic operation: connect → send → pause → disconnect
   */
  private connectSendDisconnect(frame: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket()
      socket.setNoDelay(true)

      const timer = setTimeout(() => {
        socket.destroy()
        reject(new Error('Connection timeout'))
      }, 3000)

      socket.on('connect', () => {
        clearTimeout(timer)

        logger.info('[DBX-TCP] Sending frame', {
          data: { length: frame.length, hex: frame.toString('hex') },
        })

        socket.write(frame, (err) => {
          if (err) {
            socket.destroy()
            reject(err)
            return
          }

          // Give the dbx 200ms to read the data before closing
          setTimeout(() => {
            socket.destroy()
            resolve()
          }, 200)
        })
      })

      socket.on('error', (error) => {
        clearTimeout(timer)
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
