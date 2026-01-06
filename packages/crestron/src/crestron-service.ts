/**
 * Crestron DigitalMedia Matrix Service
 *
 * High-level service for controlling Crestron DM matrix switchers.
 * Supports device discovery, routing control, and status monitoring.
 */

import { logger } from '@sports-bar/logger'
import { CrestronTelnetClient } from './crestron-telnet-client'
import {
  CrestronDeviceConfig,
  CrestronDeviceState,
  CrestronConnectionState,
  CrestronRoute,
  CrestronRouteState,
  CRESTRON_MODEL_CONFIGS,
  CrestronModel,
  CrestronResponse
} from './types'

export class CrestronService {
  private client: CrestronTelnetClient
  private config: CrestronDeviceConfig
  private reconnectInterval: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5

  constructor(config: CrestronDeviceConfig) {
    this.config = config
    this.client = new CrestronTelnetClient(config.ipAddress, config.port)
  }

  /**
   * Connect to the Crestron device
   */
  async connect(): Promise<boolean> {
    try {
      const result = await this.client.connect()
      if (result) {
        this.reconnectAttempts = 0
        this.startReconnectMonitor()
      }
      return result
    } catch (error) {
      logger.error(`[CRESTRON] Failed to connect to ${this.config.name}:`, error)
      return false
    }
  }

  /**
   * Disconnect from the Crestron device
   */
  async disconnect(): Promise<void> {
    this.stopReconnectMonitor()
    await this.client.disconnect()
  }

  private startReconnectMonitor(): void {
    this.reconnectInterval = setInterval(async () => {
      if (!this.client.isConnected()) {
        logger.warn(`[CRESTRON] Connection lost to ${this.config.name}, attempting reconnect...`)
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          try {
            await this.client.connect()
            logger.info(`[CRESTRON] Reconnected to ${this.config.name}`)
            this.reconnectAttempts = 0
          } catch (error) {
            logger.error(`[CRESTRON] Reconnect attempt ${this.reconnectAttempts} failed`)
          }
        }
      }
    }, 30000)
  }

  private stopReconnectMonitor(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval)
      this.reconnectInterval = null
    }
  }

  /**
   * Test connection to the Crestron device
   */
  async testConnection(): Promise<{ success: boolean; message: string; deviceInfo?: any }> {
    try {
      await this.connect()

      if (!this.client.isConnected()) {
        return { success: false, message: 'Failed to establish connection' }
      }

      // Try to get device info
      const versionResponse = await this.client.getDeviceInfo()
      const hostnameResponse = await this.client.getHostname()

      await this.disconnect()

      return {
        success: true,
        message: 'Successfully connected to Crestron device',
        deviceInfo: {
          model: this.config.model,
          ipAddress: this.config.ipAddress,
          port: this.config.port,
          version: versionResponse.data,
          hostname: hostnameResponse.data
        }
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      }
    }
  }

  /**
   * Get model configuration
   */
  getModelConfig() {
    return CRESTRON_MODEL_CONFIGS[this.config.model as CrestronModel]
  }

  /**
   * Set A/V route (video + audio together)
   */
  async setRoute(input: number, output: number): Promise<CrestronResponse> {
    const modelConfig = this.getModelConfig()
    if (!modelConfig) {
      return { success: false, error: `Unknown model: ${this.config.model}` }
    }

    if (input < 1 || input > modelConfig.inputs) {
      return { success: false, error: `Input ${input} out of range (1-${modelConfig.inputs})` }
    }

    if (output < 1 || output > modelConfig.outputs) {
      return { success: false, error: `Output ${output} out of range (1-${modelConfig.outputs})` }
    }

    return this.client.setAVRoute(input, output, modelConfig.outputSlotOffset)
  }

  /**
   * Set video-only route (audio breakaway)
   */
  async setVideoRoute(input: number, output: number): Promise<CrestronResponse> {
    const modelConfig = this.getModelConfig()
    if (!modelConfig) {
      return { success: false, error: `Unknown model: ${this.config.model}` }
    }

    if (!modelConfig.hasAudioBreakaway) {
      return { success: false, error: 'This model does not support audio breakaway' }
    }

    return this.client.setVideoRoute(input, output, modelConfig.outputSlotOffset)
  }

  /**
   * Set audio-only route (audio breakaway)
   */
  async setAudioRoute(input: number, output: number): Promise<CrestronResponse> {
    const modelConfig = this.getModelConfig()
    if (!modelConfig) {
      return { success: false, error: `Unknown model: ${this.config.model}` }
    }

    if (!modelConfig.hasAudioBreakaway) {
      return { success: false, error: 'This model does not support audio breakaway' }
    }

    return this.client.setAudioRoute(input, output, modelConfig.outputSlotOffset)
  }

  /**
   * Set USB route
   */
  async setUSBRoute(input: number, output: number): Promise<CrestronResponse> {
    const modelConfig = this.getModelConfig()
    if (!modelConfig) {
      return { success: false, error: `Unknown model: ${this.config.model}` }
    }

    if (!modelConfig.hasUSBRouting) {
      return { success: false, error: 'This model does not support USB routing' }
    }

    return this.client.setUSBRoute(input, output, modelConfig.outputSlotOffset)
  }

  /**
   * Get current routing state
   */
  async getRoutes(): Promise<{ success: boolean; routes?: CrestronRoute[]; error?: string }> {
    try {
      const response = await this.client.getRoutes()

      if (!response.success) {
        return { success: false, error: response.error }
      }

      // Parse DUMPDMROUTEI response
      // Format varies by model but typically shows input->output mappings
      const routes: CrestronRoute[] = []

      if (response.data) {
        // Basic parsing - actual format depends on firmware version
        const lines = response.data.split('\n')
        for (const line of lines) {
          // Look for route information patterns
          const match = line.match(/(\d+)\s*->\s*(\d+)/i)
          if (match) {
            routes.push({
              input: parseInt(match[1]),
              output: parseInt(match[2]),
              routeType: 'av'
            })
          }
        }
      }

      return { success: true, routes }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Set output volume
   * @param output Output number (1-based)
   * @param volumePercent Volume percentage (0-100)
   */
  async setOutputVolume(output: number, volumePercent: number): Promise<CrestronResponse> {
    // Convert percentage to 0-65535 range
    const level = Math.round((volumePercent / 100) * 65535)
    return this.client.setOutputVolume(output, level)
  }

  /**
   * Set output mute
   */
  async setOutputMute(output: number, mute: boolean): Promise<CrestronResponse> {
    return this.client.setOutputMute(output, mute)
  }

  /**
   * Get current device state
   */
  async getDeviceState(): Promise<CrestronDeviceState> {
    const connection: CrestronConnectionState = {
      isConnected: this.client.isConnected(),
      lastConnected: new Date()
    }

    const routeResult = await this.getRoutes()

    const routing: CrestronRouteState = {
      routes: routeResult.routes || [],
      lastUpdated: new Date()
    }

    return {
      connection,
      routing,
      inputLabels: new Map(),
      outputLabels: new Map()
    }
  }

  /**
   * Probe device for configuration
   */
  async probeConfiguration(): Promise<{
    success: boolean
    inputs?: number
    outputs?: number
    hasAudioBreakaway?: boolean
    hasUSBRouting?: boolean
    error?: string
  }> {
    try {
      await this.connect()

      if (!this.client.isConnected()) {
        return { success: false, error: 'Failed to connect to device' }
      }

      const modelConfig = this.getModelConfig()
      if (!modelConfig) {
        return { success: false, error: `Unknown model: ${this.config.model}` }
      }

      await this.disconnect()

      return {
        success: true,
        inputs: modelConfig.inputs,
        outputs: modelConfig.outputs,
        hasAudioBreakaway: modelConfig.hasAudioBreakaway,
        hasUSBRouting: modelConfig.hasUSBRouting
      }
    } catch (error: any) {
      logger.error(`[CRESTRON] Probe failed for ${this.config.name}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Send raw command (for diagnostics/testing)
   */
  async sendRawCommand(command: string): Promise<CrestronResponse> {
    return this.client.sendRawCommand(command)
  }
}

/**
 * Factory function to create a Crestron service instance
 */
export function createCrestronService(config: CrestronDeviceConfig): CrestronService {
  return new CrestronService(config)
}
