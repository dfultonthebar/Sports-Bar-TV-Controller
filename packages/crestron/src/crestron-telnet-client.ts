/**
 * Crestron Telnet Client
 *
 * TCP client for communicating with Crestron DM matrix switchers via Telnet (port 23)
 * or CTP (Crestron Terminal Protocol, port 41795).
 *
 * Commands are terminated with CR/LF (\r\n) and responses are parsed accordingly.
 */

import * as net from 'net'
import { logger } from '@sports-bar/logger'
import { CrestronResponse } from './types'

const DEFAULT_TELNET_PORT = 23
const CONNECTION_TIMEOUT = 10000
const COMMAND_TIMEOUT = 5000

export class CrestronTelnetClient {
  private socket: net.Socket | null = null
  private ipAddress: string
  private port: number
  private connected: boolean = false
  private responseBuffer: string = ''
  private commandQueue: Array<{
    command: string
    resolve: (value: CrestronResponse) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = []
  private processing: boolean = false

  constructor(ipAddress: string, port: number = DEFAULT_TELNET_PORT) {
    this.ipAddress = ipAddress
    this.port = port
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.socket) {
      return true
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy()
        }
        reject(new Error(`Connection timeout to ${this.ipAddress}:${this.port}`))
      }, CONNECTION_TIMEOUT)

      this.socket = new net.Socket()

      this.socket.on('connect', () => {
        clearTimeout(timeout)
        this.connected = true
        logger.info(`[CRESTRON] Connected to ${this.ipAddress}:${this.port}`)
        resolve(true)
      })

      this.socket.on('data', (data: Buffer) => {
        this.handleResponse(data.toString())
      })

      this.socket.on('error', (error) => {
        clearTimeout(timeout)
        logger.error(`[CRESTRON] Socket error: ${error.message}`)
        this.connected = false
        reject(error)
      })

      this.socket.on('close', () => {
        this.connected = false
        logger.info(`[CRESTRON] Connection closed to ${this.ipAddress}`)
      })

      this.socket.connect(this.port, this.ipAddress)
    })
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
      this.connected = false
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  private handleResponse(data: string): void {
    this.responseBuffer += data

    // Check if we have a complete response (ends with prompt or newline)
    if (this.responseBuffer.includes('\r\n') || this.responseBuffer.includes('>')) {
      const currentCommand = this.commandQueue[0]
      if (currentCommand) {
        clearTimeout(currentCommand.timeout)
        this.commandQueue.shift()

        currentCommand.resolve({
          success: true,
          data: this.responseBuffer.trim()
        })

        this.responseBuffer = ''
        this.processing = false
        this.processQueue()
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.commandQueue.length === 0) {
      return
    }

    this.processing = true
    const { command } = this.commandQueue[0]

    if (!this.socket || !this.connected) {
      const current = this.commandQueue.shift()
      if (current) {
        clearTimeout(current.timeout)
        current.reject(new Error('Not connected to Crestron device'))
      }
      this.processing = false
      return
    }

    this.responseBuffer = ''
    this.socket.write(command + '\r\n')
  }

  async sendCommand(command: string, timeout: number = COMMAND_TIMEOUT): Promise<CrestronResponse> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const index = this.commandQueue.findIndex(q => q.command === command)
        if (index !== -1) {
          this.commandQueue.splice(index, 1)
        }
        this.processing = false
        resolve({
          success: false,
          error: `Command timeout: ${command}`
        })
      }, timeout)

      this.commandQueue.push({
        command,
        resolve,
        reject,
        timeout: timeoutHandle
      })

      this.processQueue()
    })
  }

  /**
   * Set Audio/Video route (most common)
   * For DM-MD 8x8/16x16: output slots start at 17
   * For DM-MD 32x32: output slots start at 33
   */
  async setAVRoute(input: number, output: number, outputSlotOffset: number): Promise<CrestronResponse> {
    const outputSlot = output + outputSlotOffset - 1
    const command = `SETAVROUTE ${input} ${outputSlot}`
    logger.info(`[CRESTRON] Setting AV route: Input ${input} -> Output ${output} (slot ${outputSlot})`)
    return this.sendCommand(command)
  }

  /**
   * Set Video-only route (audio breakaway)
   */
  async setVideoRoute(input: number, output: number, outputSlotOffset: number): Promise<CrestronResponse> {
    const outputSlot = output + outputSlotOffset - 1
    const command = `SETVIDEOROUTE ${input} ${outputSlot}`
    logger.info(`[CRESTRON] Setting Video route: Input ${input} -> Output ${output} (slot ${outputSlot})`)
    return this.sendCommand(command)
  }

  /**
   * Set Audio-only route (audio breakaway)
   */
  async setAudioRoute(input: number, output: number, outputSlotOffset: number): Promise<CrestronResponse> {
    const outputSlot = output + outputSlotOffset - 1
    const command = `SETAUDIOROUTE ${input} ${outputSlot}`
    logger.info(`[CRESTRON] Setting Audio route: Input ${input} -> Output ${output} (slot ${outputSlot})`)
    return this.sendCommand(command)
  }

  /**
   * Set USB route
   */
  async setUSBRoute(input: number, output: number, outputSlotOffset: number): Promise<CrestronResponse> {
    const outputSlot = output + outputSlotOffset - 1
    const command = `SETUSBROUTE ${input} ${outputSlot}`
    logger.info(`[CRESTRON] Setting USB route: Input ${input} -> Output ${output} (slot ${outputSlot})`)
    return this.sendCommand(command)
  }

  /**
   * Get current routing status
   */
  async getRoutes(): Promise<CrestronResponse> {
    return this.sendCommand('DUMPDMROUTEI', 10000)
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<CrestronResponse> {
    return this.sendCommand('VER')
  }

  /**
   * Get hostname
   */
  async getHostname(): Promise<CrestronResponse> {
    return this.sendCommand('HOSTNAME')
  }

  /**
   * Set output volume (analog join)
   * Range: 0-65535 where 0 = -80dB, 65535 = 0dB
   */
  async setOutputVolume(output: number, level: number): Promise<CrestronResponse> {
    // Volume join starts at 0x11 for output 1
    const joinId = 0x10 + output
    const clampedLevel = Math.max(0, Math.min(65535, level))
    const command = `JOINSETANALOG ${joinId.toString(16)} ${clampedLevel}`
    logger.info(`[CRESTRON] Setting output ${output} volume to ${clampedLevel}`)
    return this.sendCommand(command)
  }

  /**
   * Mute output
   */
  async setOutputMute(output: number, mute: boolean): Promise<CrestronResponse> {
    // Mute digital join - exact join number depends on device programming
    const joinId = 0x20 + output
    const command = `JOINSETDIGITAL ${joinId.toString(16)} ${mute ? 1 : 0}`
    logger.info(`[CRESTRON] Setting output ${output} mute to ${mute}`)
    return this.sendCommand(command)
  }

  /**
   * Send raw command (for advanced/custom use)
   */
  async sendRawCommand(command: string): Promise<CrestronResponse> {
    logger.info(`[CRESTRON] Sending raw command: ${command}`)
    return this.sendCommand(command)
  }
}
