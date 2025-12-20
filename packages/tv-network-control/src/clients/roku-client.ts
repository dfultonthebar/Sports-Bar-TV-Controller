/**
 * Roku TV Client
 * HTTP REST API client for Roku TV control (External Control Protocol - ECP)
 *
 * Documentation: https://developer.roku.com/docs/developer-program/debugging/external-control-api.md
 * Protocol: HTTP REST API on port 8060
 * Authentication: None required (easiest to implement)
 */

import axios, { AxiosInstance, AxiosError } from 'axios'
import { BaseTVClient } from './base-client'
import { TVDeviceConfig, CommandResult } from '../types'
import { logger } from '@sports-bar/logger'

interface RokuDeviceInfo {
  modelName?: string
  modelNumber?: string
  serialNumber?: string
  softwareVersion?: string
  userDeviceName?: string
}

/**
 * Command queue for managing sequential command execution
 * Prevents concurrent requests that could interfere with each other
 */
class CommandQueue {
  private queue: (() => Promise<any>)[] = []
  private processing = false

  async enqueue<T>(command: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await command()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const command = this.queue.shift()!
      try {
        await command()
      } catch (error) {
        logger.error('[ROKU] Command queue execution error', { error })
      }

      // Small delay between commands to prevent overwhelming the device
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    this.processing = false
  }
}

export class RokuTVClient extends BaseTVClient {
  private axios: AxiosInstance
  private commandQueue: CommandQueue

  constructor(config: TVDeviceConfig) {
    super(config)

    // Initialize axios instance with base URL and timeout
    this.axios = axios.create({
      baseURL: `http://${config.ipAddress}:${config.port || 8060}`,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    // Initialize command queue
    this.commandQueue = new CommandQueue()

    logger.info(`[ROKU] Client initialized for ${config.ipAddress}:${config.port || 8060}`)
  }

  /**
   * Connect to Roku TV
   * Roku doesn't require authentication, so this just tests connectivity
   */
  async connect(): Promise<void> {
    try {
      logger.info(`[ROKU] Connecting to ${this.config.ipAddress}...`)

      const isConnected = await this.testConnection()
      if (!isConnected) {
        throw new Error('Failed to connect to Roku TV')
      }

      logger.info(`[ROKU] Successfully connected to ${this.config.ipAddress}`)
    } catch (error) {
      logger.error(`[ROKU] Connection error`, { error })
      throw error
    }
  }

  /**
   * Disconnect from Roku TV
   * No persistent connection to clean up for HTTP-based protocol
   */
  disconnect(): void {
    logger.info(`[ROKU] Disconnecting from ${this.config.ipAddress}`)
    // No persistent connection to close for HTTP REST API
  }

  /**
   * Send a key press to the Roku TV
   * @param key - Key name (e.g., 'PowerOn', 'VolumeUp', 'Home')
   */
  async sendKey(key: string): Promise<CommandResult> {
    return this.commandQueue.enqueue(async () => {
      try {
        logger.info(`[ROKU] Sending key: ${key} to ${this.config.ipAddress}`)

        await this.axios.post(`/keypress/${key}`)

        logger.info(`[ROKU] Successfully sent key: ${key}`)
        return {
          success: true,
          message: `Key ${key} sent successfully`,
        }
      } catch (error) {
        return this.handleError(`Failed to send key ${key}`, error)
      }
    })
  }

  /**
   * Power on the TV
   */
  async powerOn(): Promise<CommandResult> {
    logger.info(`[ROKU] Powering on ${this.config.ipAddress}`)
    return this.sendKey('PowerOn')
  }

  /**
   * Power off the TV
   */
  async powerOff(): Promise<CommandResult> {
    logger.info(`[ROKU] Powering off ${this.config.ipAddress}`)
    return this.sendKey('PowerOff')
  }

  /**
   * Increase volume
   */
  async volumeUp(): Promise<CommandResult> {
    logger.info(`[ROKU] Volume up on ${this.config.ipAddress}`)
    return this.sendKey('VolumeUp')
  }

  /**
   * Decrease volume
   */
  async volumeDown(): Promise<CommandResult> {
    logger.info(`[ROKU] Volume down on ${this.config.ipAddress}`)
    return this.sendKey('VolumeDown')
  }

  /**
   * Toggle mute
   */
  async volumeMute(): Promise<CommandResult> {
    logger.info(`[ROKU] Mute toggle on ${this.config.ipAddress}`)
    return this.sendKey('VolumeMute')
  }

  /**
   * Set volume level
   * Note: Roku doesn't support direct volume setting via ECP API
   * This method calculates the difference and sends multiple up/down commands
   * @param level - Target volume level (0-100)
   */
  async setVolume(level: number): Promise<CommandResult> {
    return this.commandQueue.enqueue(async () => {
      try {
        logger.info(`[ROKU] Setting volume to ${level} on ${this.config.ipAddress}`)

        // Roku doesn't support direct volume setting
        // We would need to implement a workaround with multiple volume up/down commands
        // For now, return a not supported message
        logger.warn('[ROKU] Direct volume setting not supported by Roku ECP API')

        return {
          success: false,
          error: 'Direct volume setting not supported. Use volumeUp/volumeDown instead.',
        }
      } catch (error) {
        return this.handleError('Failed to set volume', error)
      }
    })
  }

  /**
   * Switch to HDMI input
   * @param input - HDMI input number (1-4)
   */
  async switchInput(input: number): Promise<CommandResult> {
    return this.commandQueue.enqueue(async () => {
      try {
        logger.info(`[ROKU] Switching to HDMI ${input} on ${this.config.ipAddress}`)

        if (input < 1 || input > 4) {
          throw new Error(`Invalid HDMI input: ${input}. Must be 1-4.`)
        }

        await this.axios.post(`/keypress/InputHDMI${input}`)

        logger.info(`[ROKU] Successfully switched to HDMI ${input}`)
        return {
          success: true,
          message: `Switched to HDMI ${input}`,
        }
      } catch (error) {
        return this.handleError(`Failed to switch to HDMI ${input}`, error)
      }
    })
  }

  /**
   * Navigate to home screen
   */
  async home(): Promise<CommandResult> {
    logger.info(`[ROKU] Navigating to home on ${this.config.ipAddress}`)
    return this.sendKey('Home')
  }

  /**
   * Test connection to Roku TV
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info(`[ROKU] Testing connection to ${this.config.ipAddress}`)

      const response = await this.axios.get('/query/device-info')

      if (response.status === 200) {
        logger.info(`[ROKU] Connection test successful for ${this.config.ipAddress}`)
        return true
      }

      logger.warn(`[ROKU] Connection test failed for ${this.config.ipAddress}: unexpected status ${response.status}`)
      return false
    } catch (error) {
      logger.error(`[ROKU] Connection test failed for ${this.config.ipAddress}`, { error })
      return false
    }
  }

  /**
   * Get device information from Roku TV
   */
  async getDeviceInfo(): Promise<{ model?: string; serialNumber?: string; softwareVersion?: string }> {
    try {
      logger.info(`[ROKU] Getting device info from ${this.config.ipAddress}`)

      const response = await this.axios.get('/query/device-info')

      // Parse XML response (Roku returns XML format)
      const xmlData = response.data
      const deviceInfo = this.parseDeviceInfo(xmlData)

      logger.info(`[ROKU] Device info retrieved: ${JSON.stringify(deviceInfo)}`)

      return {
        model: deviceInfo.modelName || deviceInfo.modelNumber,
        serialNumber: deviceInfo.serialNumber,
        softwareVersion: deviceInfo.softwareVersion,
      }
    } catch (error) {
      logger.error(`[ROKU] Failed to get device info`, { error })
      return {}
    }
  }

  /**
   * Get active app information
   */
  async getActiveApp(): Promise<{ appId?: string; appName?: string } | null> {
    try {
      logger.info(`[ROKU] Getting active app from ${this.config.ipAddress}`)

      const response = await this.axios.get('/query/active-app')
      const xmlData = response.data

      // Parse XML to extract app info
      const appIdMatch = xmlData.match(/id="(\d+)"/)
      const appNameMatch = xmlData.match(/>([^<]+)</)

      if (appIdMatch) {
        const appInfo = {
          appId: appIdMatch[1],
          appName: appNameMatch ? appNameMatch[1] : undefined,
        }

        logger.info(`[ROKU] Active app: ${JSON.stringify(appInfo)}`)
        return appInfo
      }

      return null
    } catch (error) {
      logger.error(`[ROKU] Failed to get active app`, { error })
      return null
    }
  }

  /**
   * Launch an app by ID
   * @param appId - Roku app ID (e.g., '12' for Netflix)
   */
  async launchApp(appId: string): Promise<CommandResult> {
    return this.commandQueue.enqueue(async () => {
      try {
        logger.info(`[ROKU] Launching app ${appId} on ${this.config.ipAddress}`)

        await this.axios.post(`/launch/${appId}`)

        logger.info(`[ROKU] Successfully launched app ${appId}`)
        return {
          success: true,
          message: `Launched app ${appId}`,
        }
      } catch (error) {
        return this.handleError(`Failed to launch app ${appId}`, error)
      }
    })
  }

  /**
   * Parse XML device info response
   * Basic XML parsing - could be enhanced with xml2js library
   */
  private parseDeviceInfo(xmlData: string): RokuDeviceInfo {
    const info: RokuDeviceInfo = {}

    // Simple regex-based XML parsing
    const modelNameMatch = xmlData.match(/<model-name>([^<]+)<\/model-name>/)
    const modelNumberMatch = xmlData.match(/<model-number>([^<]+)<\/model-number>/)
    const serialNumberMatch = xmlData.match(/<serial-number>([^<]+)<\/serial-number>/)
    const softwareVersionMatch = xmlData.match(/<software-version>([^<]+)<\/software-version>/)
    const userDeviceNameMatch = xmlData.match(/<user-device-name>([^<]+)<\/user-device-name>/)

    if (modelNameMatch) info.modelName = modelNameMatch[1]
    if (modelNumberMatch) info.modelNumber = modelNumberMatch[1]
    if (serialNumberMatch) info.serialNumber = serialNumberMatch[1]
    if (softwareVersionMatch) info.softwareVersion = softwareVersionMatch[1]
    if (userDeviceNameMatch) info.userDeviceName = userDeviceNameMatch[1]

    return info
  }

  /**
   * Handle errors consistently
   */
  private handleError(message: string, error: unknown): CommandResult {
    const errorMessage = this.formatError(error)
    logger.error(`[ROKU] ${message}: ${errorMessage}`)

    return {
      success: false,
      error: `${message}: ${errorMessage}`,
    }
  }

  /**
   * Format error for logging and responses
   */
  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError
      if (axiosError.response) {
        return `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`
      } else if (axiosError.request) {
        return 'No response from device (network error or device offline)'
      } else {
        return axiosError.message
      }
    } else if (error instanceof Error) {
      return error.message
    } else {
      return String(error)
    }
  }
}
