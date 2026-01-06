/**
 * BSS Soundweb London BLU Service
 *
 * High-level service for controlling BSS Soundweb London audio processors.
 * Supports device discovery, zone control, and configuration probing.
 */

import { logger } from '@sports-bar/logger'
import { HiQnetClient } from './hiqnet-client'
import {
  BssDeviceConfig,
  BssDeviceState,
  BssConnectionState,
  BssZoneState,
  BssInputState,
  BssOutputState,
  BSS_MODEL_CONFIGS,
  BssModel
} from './types'

export class BssService {
  private client: HiQnetClient
  private config: BssDeviceConfig
  private keepAliveInterval: NodeJS.Timeout | null = null

  constructor(config: BssDeviceConfig) {
    this.config = config
    this.client = new HiQnetClient(config.ipAddress, config.port)
  }

  /**
   * Connect to the BSS device
   */
  async connect(): Promise<boolean> {
    try {
      const result = await this.client.connect()
      if (result) {
        // Start keep-alive timer (every 30 seconds)
        this.startKeepAlive()
      }
      return result
    } catch (error) {
      logger.error(`[BSS] Failed to connect to ${this.config.name}:`, error)
      return false
    }
  }

  /**
   * Disconnect from the BSS device
   */
  async disconnect(): Promise<void> {
    this.stopKeepAlive()
    await this.client.disconnect()
  }

  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(async () => {
      try {
        await this.client.sendKeepAlive()
      } catch (error) {
        logger.warn(`[BSS] Keep-alive failed for ${this.config.name}`)
      }
    }, 30000)
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
  }

  /**
   * Test connection to the BSS device
   */
  async testConnection(): Promise<{ success: boolean; message: string; deviceInfo?: any }> {
    try {
      await this.connect()

      if (!this.client.isConnected()) {
        return { success: false, message: 'Failed to establish connection' }
      }

      // Try to get device info
      const nodeAddress = this.config.nodeAddress || 0x00010001
      const networkInfo = await this.client.getNetworkInfo(nodeAddress)

      await this.disconnect()

      return {
        success: true,
        message: 'Successfully connected to BSS device',
        deviceInfo: {
          model: this.config.model,
          ipAddress: this.config.ipAddress,
          port: this.config.port
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
   * Probe device for configuration (sources, zones, outputs)
   * This attempts to discover the actual configuration from the device
   */
  async probeConfiguration(): Promise<{
    success: boolean
    zones?: BssZoneState[]
    inputs?: BssInputState[]
    outputs?: BssOutputState[]
    error?: string
  }> {
    try {
      await this.connect()

      if (!this.client.isConnected()) {
        return { success: false, error: 'Failed to connect to device' }
      }

      const modelConfig = BSS_MODEL_CONFIGS[this.config.model as BssModel]
      if (!modelConfig) {
        return { success: false, error: `Unknown model: ${this.config.model}` }
      }

      // For now, return defaults based on model config
      // TODO: Implement actual HiQnet object discovery
      const zones: BssZoneState[] = []
      const inputs: BssInputState[] = []
      const outputs: BssOutputState[] = []

      // Generate default zone states based on model
      for (let i = 0; i < modelConfig.zones; i++) {
        zones.push({
          zoneId: i + 1,
          name: `Zone ${i + 1}`,
          mute: false,
          gain: 0,
          source: 1
        })
      }

      // Generate default input states
      for (let i = 0; i < modelConfig.inputs; i++) {
        inputs.push({
          inputId: i + 1,
          name: `Input ${i + 1}`,
          gain: 0,
          mute: false,
          phantomPower: false
        })
      }

      // Generate default output states
      for (let i = 0; i < modelConfig.outputs; i++) {
        outputs.push({
          outputId: i + 1,
          name: `Output ${i + 1}`,
          gain: 0,
          mute: false
        })
      }

      await this.disconnect()

      return {
        success: true,
        zones,
        inputs,
        outputs
      }
    } catch (error: any) {
      logger.error(`[BSS] Probe failed for ${this.config.name}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get the current device state
   */
  async getDeviceState(): Promise<BssDeviceState> {
    const connection: BssConnectionState = {
      isConnected: this.client.isConnected(),
      lastConnected: new Date()
    }

    // TODO: Query actual state from device
    const modelConfig = BSS_MODEL_CONFIGS[this.config.model as BssModel]

    return {
      connection,
      zones: Array.from({ length: modelConfig?.zones || 8 }, (_, i) => ({
        zoneId: i + 1,
        name: `Zone ${i + 1}`,
        mute: false,
        gain: 0,
        source: 1
      })),
      inputs: Array.from({ length: modelConfig?.inputs || 12 }, (_, i) => ({
        inputId: i + 1,
        name: `Input ${i + 1}`,
        gain: 0,
        mute: false
      })),
      outputs: Array.from({ length: modelConfig?.outputs || 8 }, (_, i) => ({
        outputId: i + 1,
        name: `Output ${i + 1}`,
        gain: 0,
        mute: false
      }))
    }
  }

  /**
   * Set zone mute state
   */
  async setZoneMute(zoneId: number, mute: boolean): Promise<boolean> {
    try {
      // TODO: Implement via HiQnet protocol
      logger.info(`[BSS] Set zone ${zoneId} mute to ${mute}`)
      return true
    } catch (error) {
      logger.error(`[BSS] Failed to set zone mute:`, error)
      return false
    }
  }

  /**
   * Set zone gain (volume)
   */
  async setZoneGain(zoneId: number, gain: number): Promise<boolean> {
    try {
      // TODO: Implement via HiQnet protocol
      // Gain typically ranges from -80dB to +12dB
      const clampedGain = Math.max(-80, Math.min(12, gain))
      logger.info(`[BSS] Set zone ${zoneId} gain to ${clampedGain}dB`)
      return true
    } catch (error) {
      logger.error(`[BSS] Failed to set zone gain:`, error)
      return false
    }
  }

  /**
   * Set zone source
   */
  async setZoneSource(zoneId: number, sourceId: number): Promise<boolean> {
    try {
      // TODO: Implement via HiQnet protocol
      logger.info(`[BSS] Set zone ${zoneId} source to ${sourceId}`)
      return true
    } catch (error) {
      logger.error(`[BSS] Failed to set zone source:`, error)
      return false
    }
  }

  /**
   * Flash the locate LED on the device (helps identify which unit)
   */
  async locate(duration: number = 5000): Promise<void> {
    const nodeAddress = this.config.nodeAddress || 0x00010001
    await this.client.locateOn(nodeAddress)
    setTimeout(() => {
      this.client.locateOff(nodeAddress)
    }, duration)
  }

  /**
   * Get model configuration
   */
  getModelConfig(): typeof BSS_MODEL_CONFIGS[BssModel] | undefined {
    return BSS_MODEL_CONFIGS[this.config.model as BssModel]
  }
}

/**
 * Factory function to create a BSS service instance
 */
export function createBssService(config: BssDeviceConfig): BssService {
  return new BssService(config)
}
