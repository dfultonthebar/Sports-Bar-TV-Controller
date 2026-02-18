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
 * Uses connect-per-command pattern: opens a fresh TCP connection for each
 * command, sends the frame, and closes. This is reliable because:
 * - dbx ZonePRO is one-way (no feedback to read)
 * - Persistent connections can go stale without detection
 * - Each command completes independently
 */
export class DbxTcpClient extends EventEmitter {
  private config: Required<Omit<DbxTcpClientConfig, 'deviceAddress' | 'routerObjects'>>
  private deviceAddress: number
  private routerObjects: HiQnetAddress[]
  private sequenceNumber: number = 0
  private _initialized: boolean = false

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
   * "Connect" - validates reachability on first call
   * With connect-per-command, this just marks the client as initialized
   */
  async connect(): Promise<void> {
    if (this._initialized) return

    // Test connectivity once
    logger.info('[DBX-TCP] Testing connectivity...', {
      data: { ipAddress: this.config.ipAddress, port: this.config.port },
    })

    try {
      await this.sendOneShot(Buffer.alloc(0), true) // Just test connection
      this._initialized = true
      logger.info('[DBX-TCP] Connectivity confirmed', {
        data: { ipAddress: this.config.ipAddress, port: this.config.port },
      })
      this.emit('connected')
    } catch (error) {
      // Mark as initialized anyway - commands will retry per-call
      this._initialized = true
      logger.warn('[DBX-TCP] Initial connectivity test failed, will retry per-command', {
        data: { error: error instanceof Error ? error.message : String(error) },
      })
    }
  }

  /**
   * Disconnect (no-op for connect-per-command)
   */
  disconnect(): void {
    this._initialized = false
    logger.info('[DBX-TCP] Client disconnected')
  }

  /**
   * Always returns true once initialized (connect-per-command)
   */
  isConnected(): boolean {
    return this._initialized
  }

  /**
   * Get next sequence number
   */
  private getNextSequence(): number {
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xFFFF
    return this.sequenceNumber
  }

  /**
   * Open a fresh TCP connection, send frame, and close
   * This is the core send method - each call gets its own connection
   */
  private async sendOneShot(frame: Buffer, testOnly: boolean = false): Promise<any> {
    return new Promise((resolve, reject) => {
      const socket = new Socket()
      socket.setTimeout(this.config.connectionTimeout)
      socket.setNoDelay(true)

      const cleanup = () => {
        try { socket.destroy() } catch { /* ignore */ }
      }

      const connectionTimeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Connection timeout to ${this.config.ipAddress}:${this.config.port}`))
      }, this.config.connectionTimeout)

      socket.on('connect', () => {
        clearTimeout(connectionTimeout)

        if (testOnly) {
          cleanup()
          resolve({ success: true, test: true })
          return
        }

        logger.info('[DBX-TCP] Connected, sending frame', {
          data: {
            ipAddress: this.config.ipAddress,
            length: frame.length,
            hex: frame.toString('hex'),
          },
        })

        socket.write(frame, (writeError) => {
          // Close after sending - one-way protocol, no response expected
          cleanup()

          if (writeError) {
            logger.error('[DBX-TCP] Write error', { error: writeError })
            reject(writeError)
          } else {
            logger.info('[DBX-TCP] Frame sent successfully', {
              data: { length: frame.length },
            })
            resolve({ success: true })
          }
        })
      })

      socket.on('error', (error) => {
        clearTimeout(connectionTimeout)
        cleanup()
        logger.error('[DBX-TCP] Socket error', { error })
        reject(error)
      })

      socket.on('timeout', () => {
        clearTimeout(connectionTimeout)
        cleanup()
        reject(new Error('Socket timeout'))
      })

      socket.connect(this.config.port, this.config.ipAddress)
    })
  }

  /**
   * Send a frame with connect-per-command pattern
   */
  private async sendFrame(frame: Buffer): Promise<any> {
    return this.sendOneShot(frame)
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
