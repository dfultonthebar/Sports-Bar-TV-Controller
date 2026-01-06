/**
 * Multi-View Card Serial Client
 *
 * RS-232 communication via USB serial adapter
 * Uses the 'serialport' npm package
 */

import { SerialPort } from 'serialport'
import { logger } from '@sports-bar/logger'
import { SerialConfig, MultiViewCommandResult } from './types'
import { commandToHexString, parseResponse } from './commands'

// Default serial configuration for multi-view card
const DEFAULT_CONFIG: Omit<SerialConfig, 'path'> = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
}

export class MultiViewSerialClient {
  private port: SerialPort | null = null
  private config: SerialConfig
  private responseBuffer: string = ''
  private responseTimeout: NodeJS.Timeout | null = null

  constructor(devicePath: string, baudRate: number = 115200) {
    this.config = {
      ...DEFAULT_CONFIG,
      path: devicePath,
      baudRate
    }
  }

  /**
   * Connect to the serial port
   */
  async connect(): Promise<MultiViewCommandResult> {
    return new Promise((resolve) => {
      try {
        if (this.port?.isOpen) {
          resolve({ success: true, message: 'Already connected' })
          return
        }

        this.port = new SerialPort({
          path: this.config.path,
          baudRate: this.config.baudRate,
          dataBits: this.config.dataBits,
          stopBits: this.config.stopBits,
          parity: this.config.parity,
          autoOpen: false
        })

        this.port.on('data', (data: Buffer) => {
          this.responseBuffer += data.toString()
        })

        this.port.on('error', (err) => {
          logger.error(`[MULTIVIEW] Serial port error: ${err.message}`)
        })

        this.port.open((err) => {
          if (err) {
            logger.error(`[MULTIVIEW] Failed to open ${this.config.path}: ${err.message}`)
            resolve({ success: false, message: `Failed to open port: ${err.message}` })
          } else {
            logger.info(`[MULTIVIEW] Connected to ${this.config.path} at ${this.config.baudRate} baud`)
            resolve({ success: true, message: 'Connected successfully' })
          }
        })
      } catch (error: any) {
        logger.error(`[MULTIVIEW] Connection error: ${error.message}`)
        resolve({ success: false, message: error.message })
      }
    })
  }

  /**
   * Disconnect from the serial port
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.port?.isOpen) {
        this.port.close((err) => {
          if (err) {
            logger.error(`[MULTIVIEW] Error closing port: ${err.message}`)
          }
          this.port = null
          resolve()
        })
      } else {
        this.port = null
        resolve()
      }
    })
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.port?.isOpen ?? false
  }

  /**
   * Send a command and wait for response
   *
   * @param command - Command buffer to send
   * @param timeout - Response timeout in ms (default 2000)
   */
  async sendCommand(command: Buffer, timeout: number = 2000): Promise<MultiViewCommandResult> {
    return new Promise(async (resolve) => {
      if (!this.port?.isOpen) {
        const connectResult = await this.connect()
        if (!connectResult.success) {
          resolve(connectResult)
          return
        }
      }

      this.responseBuffer = ''

      const hexStr = commandToHexString(command)
      logger.debug(`[MULTIVIEW] Sending command: ${hexStr}`)

      this.port!.write(command, (writeErr) => {
        if (writeErr) {
          logger.error(`[MULTIVIEW] Write error: ${writeErr.message}`)
          resolve({ success: false, message: `Write error: ${writeErr.message}` })
          return
        }

        this.port!.drain((drainErr) => {
          if (drainErr) {
            logger.error(`[MULTIVIEW] Drain error: ${drainErr.message}`)
          }

          // Wait for response
          this.responseTimeout = setTimeout(() => {
            const response = this.responseBuffer.trim()
            if (response) {
              const parsed = parseResponse(response)
              logger.debug(`[MULTIVIEW] Response: ${response}`)
              resolve({ ...parsed, response })
            } else {
              // No response - assume success (some devices don't respond)
              logger.debug('[MULTIVIEW] No response received, assuming success')
              resolve({ success: true, message: 'Command sent (no response)' })
            }
          }, timeout)
        })
      })
    })
  }

  /**
   * Send a raw string command (for ASCII commands like "GET HELP")
   */
  async sendStringCommand(command: string, timeout: number = 2000): Promise<MultiViewCommandResult> {
    const buffer = Buffer.from(command + '\r\n')
    return this.sendCommand(buffer, timeout)
  }

  /**
   * Test connection by sending a simple query
   */
  async testConnection(): Promise<MultiViewCommandResult> {
    const connectResult = await this.connect()
    if (!connectResult.success) {
      return connectResult
    }

    // Try to get help/status
    const result = await this.sendStringCommand('GET HELP', 3000)

    return {
      success: true,
      message: 'Connection test successful',
      response: result.response
    }
  }
}

/**
 * List available serial ports
 * Useful for UI to show dropdown of available ports
 */
export async function listSerialPorts(): Promise<{ path: string; manufacturer?: string }[]> {
  try {
    const ports = await SerialPort.list()
    return ports
      .filter(p => p.path.includes('ttyUSB') || p.path.includes('ttyACM'))
      .map(p => ({
        path: p.path,
        manufacturer: p.manufacturer
      }))
  } catch (error: any) {
    logger.error(`[MULTIVIEW] Error listing serial ports: ${error.message}`)
    return []
  }
}

/**
 * Check if a serial port exists and is accessible
 */
export async function checkSerialPort(path: string): Promise<boolean> {
  try {
    const ports = await SerialPort.list()
    return ports.some(p => p.path === path)
  } catch {
    return false
  }
}
