/**
 * dbx ZonePRO Serial (RS-232) Client
 *
 * RS-232 client for dbx ZonePRO processors (all models).
 * Implements HiQnet protocol over serial with the same interface as TCP client.
 *
 * Serial Configuration:
 * - Baud rate: 57600
 * - Data bits: 8
 * - Stop bits: 1
 * - Parity: None
 * - Flow control: None
 *
 * Requires null modem cable (TX->RX, RX->TX, GND->GND).
 */

import { EventEmitter } from 'events'
import { logger } from '@sports-bar/logger'
import { DBX_SERIAL_CONFIG, DBX_NETWORK_CONFIG, percentToVolume } from './config'
import {
  FrameBuffer,
  buildPingFrame,
  buildVolumeSetFrame,
  buildMuteSetFrame,
  buildSourceSetFrame,
  buildRecallSceneFrame,
} from './dbx-protocol'

// Dynamic import for serialport to handle environments without serial support
let SerialPort: any = null
let SerialPortModule: any = null

async function loadSerialPort() {
  if (!SerialPort) {
    try {
      SerialPortModule = await import('serialport')
      SerialPort = SerialPortModule.SerialPort
    } catch (error) {
      logger.error('[DBX-SERIAL] Failed to load serialport module', { error })
      throw new Error(
        'serialport module not available. Install with: npm install serialport'
      )
    }
  }
  return SerialPort
}

export interface DbxSerialClientConfig {
  port: string // Serial port path (e.g., '/dev/ttyUSB0', 'COM1')
  baudRate?: number
  autoReconnect?: boolean
  pingInterval?: number
}

interface PendingCommand {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timeout: NodeJS.Timeout
}

/**
 * RS-232 Serial client for dbx ZonePRO processors
 */
export class DbxSerialClient extends EventEmitter {
  private config: Required<DbxSerialClientConfig>
  private serialPort: any = null
  private connected: boolean = false
  private connecting: boolean = false
  private frameBuffer: FrameBuffer = new FrameBuffer()
  private sequenceNumber: number = 0
  private pendingCommands: Map<number, PendingCommand> = new Map()
  private pingTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0

  constructor(config: DbxSerialClientConfig) {
    super()

    this.config = {
      port: config.port,
      baudRate: config.baudRate ?? DBX_SERIAL_CONFIG.BAUD_RATE,
      autoReconnect: config.autoReconnect ?? true,
      pingInterval: config.pingInterval ?? DBX_NETWORK_CONFIG.PING_INTERVAL,
    }

    logger.info('[DBX-SERIAL] Client initialized', {
      data: {
        port: this.config.port,
        baudRate: this.config.baudRate,
      },
    })
  }

  /**
   * Connect to the dbx ZonePRO processor via serial port
   */
  async connect(): Promise<void> {
    if (this.connected) {
      logger.info('[DBX-SERIAL] Already connected')
      return
    }

    if (this.connecting) {
      logger.info('[DBX-SERIAL] Connection already in progress')
      return
    }

    this.connecting = true

    // Ensure serialport is loaded
    const SerialPortClass = await loadSerialPort()

    return new Promise((resolve, reject) => {
      logger.info('[DBX-SERIAL] Opening port...', {
        data: {
          port: this.config.port,
          baudRate: this.config.baudRate,
        },
      })

      // Close existing port if any
      if (this.serialPort) {
        try {
          this.serialPort.close()
        } catch {
          // Ignore cleanup errors
        }
        this.serialPort = null
      }

      try {
        this.serialPort = new SerialPortClass({
          path: this.config.port,
          baudRate: this.config.baudRate,
          dataBits: DBX_SERIAL_CONFIG.DATA_BITS,
          stopBits: DBX_SERIAL_CONFIG.STOP_BITS,
          parity: DBX_SERIAL_CONFIG.PARITY,
          autoOpen: false,
        })

        this.serialPort.on('open', () => {
          this.connected = true
          this.connecting = false
          this.reconnectAttempts = 0

          logger.info('[DBX-SERIAL] Port opened successfully', {
            data: { port: this.config.port },
          })

          // Start keep-alive ping
          this.startPing()

          this.emit('connected')
          resolve()
        })

        this.serialPort.on('data', (data: Buffer) => {
          this.handleData(data)
        })

        this.serialPort.on('error', (error: Error) => {
          this.connecting = false

          logger.error('[DBX-SERIAL] Port error', { error })
          this.emit('error', error)

          if (!this.connected) {
            reject(error)
          }
        })

        this.serialPort.on('close', () => {
          const wasConnected = this.connected
          this.connected = false
          this.connecting = false

          // Stop ping
          this.stopPing()

          // Clear pending commands
          this.pendingCommands.forEach(({ reject, timeout }) => {
            clearTimeout(timeout)
            reject(new Error('Port closed'))
          })
          this.pendingCommands.clear()

          // Clear frame buffer
          this.frameBuffer.clear()

          if (wasConnected) {
            logger.info('[DBX-SERIAL] Port closed', {
              data: { port: this.config.port },
            })
            this.emit('disconnected')

            // Auto-reconnect if enabled
            if (this.config.autoReconnect) {
              this.scheduleReconnect()
            }
          }
        })

        // Open the port
        this.serialPort.open((error?: Error) => {
          if (error) {
            this.connecting = false
            logger.error('[DBX-SERIAL] Failed to open port', { error })
            reject(error)
          }
        })
      } catch (error) {
        this.connecting = false
        logger.error('[DBX-SERIAL] Failed to create serial port', { error })
        reject(error)
      }
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

    // Close port
    if (this.serialPort && this.serialPort.isOpen) {
      this.serialPort.close()
    }
    this.serialPort = null

    this.connected = false
    this.connecting = false

    logger.info('[DBX-SERIAL] Disconnected by request')
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.serialPort !== null && this.serialPort.isOpen
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
        logger.debug('[DBX-SERIAL] Received frame', {
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
        logger.warn('[DBX-SERIAL] Received invalid frame (CRC mismatch)')
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
      if (this.connected && this.serialPort && this.serialPort.isOpen) {
        const pingFrame = buildPingFrame(this.getNextSequence())

        try {
          this.serialPort.write(pingFrame)
          logger.debug('[DBX-SERIAL] Ping sent')
        } catch (error) {
          logger.error('[DBX-SERIAL] Failed to send ping', { error })
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
      logger.error('[DBX-SERIAL] Max reconnection attempts reached', {
        data: {
          port: this.config.port,
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

    logger.info('[DBX-SERIAL] Scheduling reconnection', {
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
        logger.error('[DBX-SERIAL] Reconnection failed', { error })
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
    if (!this.connected || !this.serialPort || !this.serialPort.isOpen) {
      throw new Error('Not connected to dbx ZonePRO')
    }

    // Extract sequence number from frame
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
        this.serialPort.write(frame, (error?: Error) => {
          if (error) {
            if (waitForResponse) {
              const pending = this.pendingCommands.get(seqNum)
              if (pending) {
                clearTimeout(pending.timeout)
                this.pendingCommands.delete(seqNum)
              }
            }
            reject(error)
          } else {
            // Drain the port to ensure data is sent
            this.serialPort.drain((drainError?: Error) => {
              if (drainError) {
                logger.warn('[DBX-SERIAL] Drain warning', { error: drainError })
              }
              if (!waitForResponse) {
                resolve({ success: true })
              }
            })
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

    logger.info('[DBX-SERIAL] Setting volume', {
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
    logger.info('[DBX-SERIAL] Setting mute', {
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
    logger.info('[DBX-SERIAL] Setting source', {
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
    logger.info('[DBX-SERIAL] Recalling scene', {
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
  getConfig(): Required<DbxSerialClientConfig> {
    return { ...this.config }
  }

  /**
   * List available serial ports
   */
  static async listPorts(): Promise<any[]> {
    try {
      await loadSerialPort()
      const ports = await SerialPortModule.SerialPort.list()
      return ports
    } catch (error) {
      logger.error('[DBX-SERIAL] Failed to list ports', { error })
      return []
    }
  }
}

/**
 * Create and connect a serial client
 */
export async function createDbxSerialClient(
  config: DbxSerialClientConfig
): Promise<DbxSerialClient> {
  const client = new DbxSerialClient(config)
  await client.connect()
  return client
}

export default DbxSerialClient
