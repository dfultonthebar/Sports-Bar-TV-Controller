/**
 * dbx ZonePRO TCP Client
 *
 * TCP/Ethernet client for dbx ZonePRO m-models (640m, 641m, 1260m, 1261m).
 * Implements HiQnet protocol over TCP with keep-alive ping mechanism.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Keep-alive ping every 1 second
 * - Command queue for thread-safe operation
 * - Event-based status updates
 */

import { Socket } from 'net'
import { EventEmitter } from 'events'
import { logger } from '@sports-bar/logger'
import { DBX_NETWORK_CONFIG, DBX_PROTOCOL, percentToVolume } from './config'
import {
  FrameBuffer,
  buildPingFrame,
  buildVolumeSetFrame,
  buildMuteSetFrame,
  buildSourceSetFrame,
  buildRecallSceneFrame,
  parseFrame,
} from './dbx-protocol'

export interface DbxTcpClientConfig {
  ipAddress: string
  port?: number
  autoReconnect?: boolean
  pingInterval?: number
  connectionTimeout?: number
}

export interface DbxClientEvents {
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  data: (data: Buffer) => void
  response: (response: any) => void
}

interface PendingCommand {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timeout: NodeJS.Timeout
}

/**
 * TCP client for dbx ZonePRO m-model processors
 */
export class DbxTcpClient extends EventEmitter {
  private config: Required<DbxTcpClientConfig>
  private socket: Socket | null = null
  private connected: boolean = false
  private connecting: boolean = false
  private frameBuffer: FrameBuffer = new FrameBuffer()
  private sequenceNumber: number = 0
  private pendingCommands: Map<number, PendingCommand> = new Map()
  private pingTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0

  constructor(config: DbxTcpClientConfig) {
    super()

    this.config = {
      ipAddress: config.ipAddress,
      port: config.port ?? DBX_NETWORK_CONFIG.TCP_PORT,
      autoReconnect: config.autoReconnect ?? true,
      pingInterval: config.pingInterval ?? DBX_NETWORK_CONFIG.PING_INTERVAL,
      connectionTimeout: config.connectionTimeout ?? DBX_NETWORK_CONFIG.CONNECTION_TIMEOUT,
    }

    logger.info('[DBX-TCP] Client initialized', {
      data: {
        ipAddress: this.config.ipAddress,
        port: this.config.port,
      },
    })
  }

  /**
   * Connect to the dbx ZonePRO processor
   */
  async connect(): Promise<void> {
    if (this.connected) {
      logger.info('[DBX-TCP] Already connected')
      return
    }

    if (this.connecting) {
      logger.info('[DBX-TCP] Connection already in progress')
      return
    }

    this.connecting = true

    return new Promise((resolve, reject) => {
      logger.info('[DBX-TCP] Connecting...', {
        data: {
          ipAddress: this.config.ipAddress,
          port: this.config.port,
        },
      })

      // Clean up existing socket
      if (this.socket) {
        try {
          this.socket.destroy()
        } catch {
          // Ignore cleanup errors
        }
        this.socket = null
      }

      this.socket = new Socket()
      this.socket.setTimeout(this.config.connectionTimeout)
      this.socket.setNoDelay(true) // Disable Nagle's algorithm for low latency
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
        this.socket?.setTimeout(0) // Disable timeout after connection

        logger.info('[DBX-TCP] Connected successfully', {
          data: {
            ipAddress: this.config.ipAddress,
            port: this.config.port,
          },
        })

        // Start keep-alive ping
        this.startPing()

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

        // Stop ping
        this.stopPing()

        // Clear pending commands
        this.pendingCommands.forEach(({ reject, timeout }) => {
          clearTimeout(timeout)
          reject(new Error('Connection closed'))
        })
        this.pendingCommands.clear()

        // Clear frame buffer
        this.frameBuffer.clear()

        if (wasConnected) {
          logger.info('[DBX-TCP] Disconnected', {
            data: { ipAddress: this.config.ipAddress },
          })
          this.emit('disconnected')

          // Auto-reconnect if enabled
          if (this.config.autoReconnect) {
            this.scheduleReconnect()
          }
        }
      })

      this.socket.on('timeout', () => {
        logger.warn('[DBX-TCP] Socket timeout')
        this.socket?.destroy()
      })

      // Initiate connection
      this.socket.connect(this.config.port, this.config.ipAddress)
    })
  }

  /**
   * Disconnect from the processor
   */
  disconnect(): void {
    // Cancel any pending reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Stop ping
    this.stopPing()

    // Close socket
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
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    this.frameBuffer.append(data)

    // Extract all complete frames
    let frame
    while ((frame = this.frameBuffer.extractFrame()) !== null) {
      if (frame.valid) {
        logger.debug('[DBX-TCP] Received frame', {
          data: {
            messageId: frame.header.messageId,
            sequenceNumber: frame.header.sequenceNumber,
          },
        })

        // Resolve pending command if this is a response
        const pending = this.pendingCommands.get(frame.header.sequenceNumber)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingCommands.delete(frame.header.sequenceNumber)
          pending.resolve(frame)
        }

        this.emit('response', frame)
      } else {
        logger.warn('[DBX-TCP] Received invalid frame (CRC mismatch)')
      }
    }
  }

  /**
   * Start keep-alive ping mechanism
   */
  private startPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
    }

    this.pingTimer = setInterval(() => {
      if (this.connected && this.socket) {
        const pingFrame = buildPingFrame(this.getNextSequence())

        try {
          this.socket.write(pingFrame)
          logger.debug('[DBX-TCP] Ping sent')
        } catch (error) {
          logger.error('[DBX-TCP] Failed to send ping', { error })
        }
      }
    }, this.config.pingInterval)
  }

  /**
   * Stop keep-alive ping
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return // Already scheduled
    }

    this.reconnectAttempts++

    if (this.reconnectAttempts > DBX_NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      logger.error('[DBX-TCP] Max reconnection attempts reached', {
        data: {
          ipAddress: this.config.ipAddress,
          attempts: this.reconnectAttempts,
        },
      })
      this.emit('error', new Error('Max reconnection attempts reached'))
      return
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, 32s (max 30s)
    const delay = Math.min(
      DBX_NETWORK_CONFIG.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      30000
    )

    logger.info('[DBX-TCP] Scheduling reconnection', {
      data: {
        attempt: this.reconnectAttempts,
        delay,
      },
    })

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null

      try {
        await this.connect()
      } catch (error) {
        logger.error('[DBX-TCP] Reconnection failed', { error })
        // Will auto-retry via close handler
      }
    }, delay)
  }

  /**
   * Get next sequence number
   */
  private getNextSequence(): number {
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xffff
    return this.sequenceNumber
  }

  /**
   * Send a frame and optionally wait for response
   */
  private async sendFrame(frame: Buffer, waitForResponse: boolean = true): Promise<any> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to dbx ZonePRO')
    }

    // Extract sequence number from frame (at offset 19-20 in header)
    const seqNum = frame.readUInt16BE(20)

    return new Promise((resolve, reject) => {
      if (waitForResponse) {
        const timeout = setTimeout(() => {
          this.pendingCommands.delete(seqNum)
          reject(new Error('Command timeout'))
        }, DBX_NETWORK_CONFIG.COMMAND_TIMEOUT)

        this.pendingCommands.set(seqNum, { resolve, reject, timeout })
      }

      try {
        this.socket!.write(frame, (error) => {
          if (error) {
            if (waitForResponse) {
              const pending = this.pendingCommands.get(seqNum)
              if (pending) {
                clearTimeout(pending.timeout)
                this.pendingCommands.delete(seqNum)
              }
            }
            reject(error)
          } else if (!waitForResponse) {
            resolve({ success: true })
          }
        })
      } catch (error) {
        if (waitForResponse) {
          const pending = this.pendingCommands.get(seqNum)
          if (pending) {
            clearTimeout(pending.timeout)
            this.pendingCommands.delete(seqNum)
          }
        }
        reject(error)
      }
    })
  }

  /**
   * Set volume for a zone
   *
   * @param zone - Zone number (0-based)
   * @param volume - Volume value (0-415) or percentage if usePercent=true
   * @param stereo - Control stereo pair (default: true)
   * @param usePercent - Interpret volume as percentage (default: false)
   */
  async setVolume(
    zone: number,
    volume: number,
    stereo: boolean = true,
    usePercent: boolean = false
  ): Promise<any> {
    const actualVolume = usePercent ? percentToVolume(volume) : volume

    logger.info('[DBX-TCP] Setting volume', {
      data: { zone, volume: actualVolume, stereo },
    })

    const frame = buildVolumeSetFrame(zone, actualVolume, stereo, this.getNextSequence())
    return this.sendFrame(frame, false) // Volume set doesn't need response
  }

  /**
   * Set mute state for a zone
   *
   * @param zone - Zone number (0-based)
   * @param muted - true to mute, false to unmute
   */
  async setMute(zone: number, muted: boolean): Promise<any> {
    logger.info('[DBX-TCP] Setting mute', {
      data: { zone, muted },
    })

    const frame = buildMuteSetFrame(zone, muted, this.getNextSequence())
    return this.sendFrame(frame, false)
  }

  /**
   * Set source for a zone
   *
   * @param zone - Zone number (0-based)
   * @param sourceIndex - Source index (0-based)
   */
  async setSource(zone: number, sourceIndex: number): Promise<any> {
    logger.info('[DBX-TCP] Setting source', {
      data: { zone, sourceIndex },
    })

    const frame = buildSourceSetFrame(zone, sourceIndex, this.getNextSequence())
    return this.sendFrame(frame, false)
  }

  /**
   * Recall a scene/preset
   *
   * @param sceneNumber - Scene number to recall
   */
  async recallScene(sceneNumber: number): Promise<any> {
    logger.info('[DBX-TCP] Recalling scene', {
      data: { sceneNumber },
    })

    const frame = buildRecallSceneFrame(sceneNumber, this.getNextSequence())
    return this.sendFrame(frame, false)
  }

  /**
   * Send raw frame (for advanced usage)
   *
   * @param frame - Raw frame buffer
   * @param waitForResponse - Whether to wait for response
   */
  async sendRawFrame(frame: Buffer, waitForResponse: boolean = false): Promise<any> {
    return this.sendFrame(frame, waitForResponse)
  }

  /**
   * Get connection configuration
   */
  getConfig(): Required<DbxTcpClientConfig> {
    return { ...this.config }
  }
}

/**
 * Create and connect a TCP client
 */
export async function createDbxTcpClient(
  config: DbxTcpClientConfig
): Promise<DbxTcpClient> {
  const client = new DbxTcpClient(config)
  await client.connect()
  return client
}

export default DbxTcpClient
