/**
 * USB DMX Client
 * Supports Enttec DMX USB Pro, Enttec Open DMX USB, and PKnight CR011R adapters
 */

import { EventEmitter } from 'events'
import { DMX_CONFIG, ENTTEC_PRO, USB_ADAPTER_MODELS, USBAdapterModel } from '../config'
import { dmxLogger } from '../dmx-logger'

// SerialPort is dynamically imported to handle environments where it's not available
let SerialPort: typeof import('serialport').SerialPort | null = null

export interface USBDMXConfig {
  serialPort: string          // e.g., '/dev/ttyUSB0' or 'COM3'
  adapterModel: USBAdapterModel
  baudRate?: number
}

export interface USBDMXClientEvents {
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  data: (data: Buffer) => void
}

/**
 * USB DMX Client for serial-based DMX adapters
 */
export class USBDMXClient extends EventEmitter {
  private config: Required<USBDMXConfig>
  private port: InstanceType<typeof import('serialport').SerialPort> | null = null
  private connected: boolean = false
  private universe: Uint8Array
  private frameInterval: NodeJS.Timeout | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0

  constructor(config: USBDMXConfig) {
    super()
    this.config = {
      serialPort: config.serialPort,
      adapterModel: config.adapterModel,
      baudRate: config.baudRate ?? DMX_CONFIG.BAUD_RATE,
    }
    this.universe = new Uint8Array(DMX_CONFIG.CHANNELS_PER_UNIVERSE).fill(0)
  }

  /**
   * Connect to the USB DMX adapter
   */
  async connect(): Promise<void> {
    if (this.connected) {
      dmxLogger.warn('USB DMX client already connected', { port: this.config.serialPort })
      return
    }

    try {
      // Dynamically import serialport
      if (!SerialPort) {
        const serialportModule = await import('serialport')
        SerialPort = serialportModule.SerialPort
      }

      const adapterInfo = USB_ADAPTER_MODELS[this.config.adapterModel]
      dmxLogger.info(`Connecting to ${adapterInfo.name}`, { port: this.config.serialPort })

      this.port = new SerialPort({
        path: this.config.serialPort,
        baudRate: this.config.baudRate,
        dataBits: DMX_CONFIG.DATA_BITS,
        stopBits: DMX_CONFIG.STOP_BITS,
        parity: DMX_CONFIG.PARITY,
        autoOpen: false,
      })

      // Set up event handlers
      this.port.on('open', () => {
        this.connected = true
        this.reconnectAttempts = 0
        dmxLogger.connection(this.config.serialPort, 'connected', {
          adapter: this.config.adapterModel,
        })
        this.emit('connected')
        this.startFrameOutput()
      })

      this.port.on('error', (error) => {
        dmxLogger.error('Serial port error', error, { port: this.config.serialPort })
        this.emit('error', error)
        this.handleDisconnect()
      })

      this.port.on('close', () => {
        dmxLogger.connection(this.config.serialPort, 'disconnected')
        this.emit('disconnected')
        this.handleDisconnect()
      })

      this.port.on('data', (data: Buffer) => {
        this.emit('data', data)
      })

      // Open the port
      await new Promise<void>((resolve, reject) => {
        this.port!.open((error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })

    } catch (error) {
      dmxLogger.error('Failed to connect to USB DMX adapter', error, {
        port: this.config.serialPort,
        adapter: this.config.adapterModel,
      })
      throw error
    }
  }

  /**
   * Disconnect from the adapter
   */
  disconnect(): void {
    this.stopFrameOutput()

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.port && this.port.isOpen) {
      this.port.close()
    }

    this.port = null
    this.connected = false
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.port !== null && this.port.isOpen
  }

  /**
   * Set a single DMX channel value
   */
  setChannel(channel: number, value: number): void {
    if (channel < 1 || channel > DMX_CONFIG.CHANNELS_PER_UNIVERSE) {
      throw new Error(`Channel must be between 1 and ${DMX_CONFIG.CHANNELS_PER_UNIVERSE}`)
    }
    if (value < 0 || value > 255) {
      throw new Error('Value must be between 0 and 255')
    }
    this.universe[channel - 1] = value
  }

  /**
   * Set multiple consecutive DMX channels
   */
  setChannels(startChannel: number, values: number[]): void {
    for (let i = 0; i < values.length; i++) {
      const channel = startChannel + i
      if (channel <= DMX_CONFIG.CHANNELS_PER_UNIVERSE) {
        this.universe[channel - 1] = Math.min(255, Math.max(0, values[i]))
      }
    }
  }

  /**
   * Set entire universe at once
   */
  setUniverse(data: Uint8Array | number[]): void {
    const len = Math.min(data.length, DMX_CONFIG.CHANNELS_PER_UNIVERSE)
    for (let i = 0; i < len; i++) {
      this.universe[i] = data[i]
    }
  }

  /**
   * Get current universe data
   */
  getUniverse(): Uint8Array {
    return new Uint8Array(this.universe)
  }

  /**
   * Set all channels to zero (blackout)
   */
  blackout(): void {
    this.universe.fill(0)
  }

  /**
   * Send the current universe data immediately
   */
  async sendFrame(): Promise<void> {
    if (!this.isConnected()) {
      return
    }

    try {
      const protocol = USB_ADAPTER_MODELS[this.config.adapterModel].protocol

      switch (protocol) {
        case 'enttec-pro':
          await this.sendEnttecProFrame()
          break
        case 'open-dmx':
          await this.sendOpenDMXFrame()
          break
        case 'generic':
        default:
          await this.sendGenericFrame()
          break
      }
    } catch (error) {
      dmxLogger.error('Failed to send DMX frame', error)
    }
  }

  /**
   * Send frame using Enttec Pro protocol
   */
  private async sendEnttecProFrame(): Promise<void> {
    // Enttec Pro packet format:
    // [START_OF_MSG] [LABEL] [DATA_LENGTH_LSB] [DATA_LENGTH_MSB] [DATA...] [END_OF_MSG]

    const dataLength = DMX_CONFIG.CHANNELS_PER_UNIVERSE + 1 // +1 for start code
    const packet = Buffer.alloc(dataLength + 5)

    packet[0] = ENTTEC_PRO.START_OF_MSG
    packet[1] = ENTTEC_PRO.LABEL_DMX_OUT
    packet[2] = dataLength & 0xff        // LSB
    packet[3] = (dataLength >> 8) & 0xff // MSB
    packet[4] = 0                        // DMX start code (always 0)

    // Copy universe data
    for (let i = 0; i < DMX_CONFIG.CHANNELS_PER_UNIVERSE; i++) {
      packet[5 + i] = this.universe[i]
    }

    packet[dataLength + 4] = ENTTEC_PRO.END_OF_MSG

    await this.writeToPort(packet)
  }

  /**
   * Send frame using Open DMX protocol (break-based timing)
   * Note: Open DMX requires precise timing which may not be achievable in Node.js
   */
  private async sendOpenDMXFrame(): Promise<void> {
    // Open DMX uses break/MAB timing - send raw DMX data
    // The FTDI chip handles the break timing
    const packet = Buffer.alloc(DMX_CONFIG.CHANNELS_PER_UNIVERSE + 1)
    packet[0] = 0 // Start code

    for (let i = 0; i < DMX_CONFIG.CHANNELS_PER_UNIVERSE; i++) {
      packet[i + 1] = this.universe[i]
    }

    await this.writeToPort(packet)
  }

  /**
   * Send frame using generic serial protocol
   */
  private async sendGenericFrame(): Promise<void> {
    // Generic adapters often use simple serial output
    // Similar to Open DMX but without specific timing requirements
    const packet = Buffer.alloc(DMX_CONFIG.CHANNELS_PER_UNIVERSE + 1)
    packet[0] = 0 // Start code

    for (let i = 0; i < DMX_CONFIG.CHANNELS_PER_UNIVERSE; i++) {
      packet[i + 1] = this.universe[i]
    }

    await this.writeToPort(packet)
  }

  /**
   * Write data to serial port with promise wrapper
   */
  private writeToPort(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        reject(new Error('Serial port not open'))
        return
      }

      this.port.write(data, (error) => {
        if (error) {
          reject(error)
        } else {
          this.port!.drain((drainError) => {
            if (drainError) {
              reject(drainError)
            } else {
              resolve()
            }
          })
        }
      })
    })
  }

  /**
   * Start automatic frame output at DMX refresh rate
   */
  private startFrameOutput(): void {
    if (this.frameInterval) {
      return
    }

    const intervalMs = Math.floor(1000 / DMX_CONFIG.FRAME_RATE_HZ)
    this.frameInterval = setInterval(() => {
      this.sendFrame().catch(() => {
        // Error already logged in sendFrame
      })
    }, intervalMs)

    dmxLogger.debug('Started DMX frame output', {
      intervalMs,
      frameRate: DMX_CONFIG.FRAME_RATE_HZ,
    })
  }

  /**
   * Stop automatic frame output
   */
  private stopFrameOutput(): void {
    if (this.frameInterval) {
      clearInterval(this.frameInterval)
      this.frameInterval = null
      dmxLogger.debug('Stopped DMX frame output')
    }
  }

  /**
   * Handle disconnect and attempt reconnection
   */
  private handleDisconnect(): void {
    this.connected = false
    this.stopFrameOutput()

    if (this.reconnectAttempts < DMX_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++
      const delay = DMX_CONFIG.RECONNECT_DELAY_MS * this.reconnectAttempts

      dmxLogger.info(`Attempting reconnect in ${delay}ms`, {
        attempt: this.reconnectAttempts,
        maxAttempts: DMX_CONFIG.MAX_RECONNECT_ATTEMPTS,
      })

      this.reconnectTimeout = setTimeout(() => {
        this.connect().catch((error) => {
          dmxLogger.error('Reconnect failed', error)
        })
      }, delay)
    } else {
      dmxLogger.error('Max reconnect attempts reached', undefined, {
        port: this.config.serialPort,
      })
    }
  }
}

export default USBDMXClient
