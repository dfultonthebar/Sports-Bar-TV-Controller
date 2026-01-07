/**
 * Maestro DMX Client
 * Extends Art-Net client with Maestro-specific preset and function button control
 * Maestro controllers support built-in presets that can be recalled via Art-Net OpTrigger
 */

import dgram from 'dgram'
import { ArtNetClient, ArtNetConfig } from './artnet-client'
import { DMX_CONFIG, ARTNET_ADAPTER_MODELS } from '../config'
import { dmxLogger } from '../dmx-logger'

export interface MaestroConfig extends ArtNetConfig {
  presetCount?: number       // Number of presets available (default: 12)
  functionCount?: number     // Number of function buttons (default: 8)
}

export interface MaestroStatus {
  connected: boolean
  currentPreset: number | null
  activeFunction: number | null
  ipAddress: string
  universeCount: number
}

/**
 * Maestro DMX Client
 * Provides access to Maestro's built-in presets and function buttons
 */
export class MaestroClient extends ArtNetClient {
  private maestroConfig: {
    presetCount: number
    functionCount: number
  }
  private currentPreset: number | null = null
  private activeFunction: number | null = null

  constructor(config: MaestroConfig) {
    super({
      ...config,
      adapterModel: 'maestro',
    })

    const maestroDefaults = ARTNET_ADAPTER_MODELS.maestro
    this.maestroConfig = {
      presetCount: config.presetCount ?? maestroDefaults.presetCount,
      functionCount: config.functionCount ?? maestroDefaults.functionCount,
    }
  }

  /**
   * Get Maestro status
   */
  getStatus(): MaestroStatus {
    return {
      connected: this.isConnected(),
      currentPreset: this.currentPreset,
      activeFunction: this.activeFunction,
      ipAddress: this.config.ipAddress,
      universeCount: ARTNET_ADAPTER_MODELS.maestro.universes,
    }
  }

  /**
   * Recall a Maestro preset
   * Maestro presets are stored scenes that can be triggered via Art-Net OpTrigger
   */
  async recallPreset(presetNumber: number): Promise<boolean> {
    if (presetNumber < 1 || presetNumber > this.maestroConfig.presetCount) {
      dmxLogger.error('Invalid preset number', undefined, {
        preset: presetNumber,
        maxPresets: this.maestroConfig.presetCount,
      })
      return false
    }

    if (!this.isConnected()) {
      dmxLogger.error('Maestro not connected')
      return false
    }

    try {
      // Build and send OpTrigger packet
      const packet = this.buildTriggerPacket(
        0x0000,        // OEM code (0 = broadcast)
        presetNumber,  // Key (preset number)
        0              // SubKey (not used for presets)
      )

      await this.sendPacket(packet)

      this.currentPreset = presetNumber
      dmxLogger.maestro('preset', presetNumber, true)

      this.emit('presetRecalled', presetNumber)
      return true

    } catch (error) {
      dmxLogger.error('Failed to recall Maestro preset', error, {
        preset: presetNumber,
      })
      dmxLogger.maestro('preset', presetNumber, false)
      return false
    }
  }

  /**
   * Trigger a Maestro function button
   * Function buttons can control various Maestro features (blackout, master intensity, etc.)
   */
  async triggerFunction(functionNumber: number): Promise<boolean> {
    if (functionNumber < 1 || functionNumber > this.maestroConfig.functionCount) {
      dmxLogger.error('Invalid function number', undefined, {
        function: functionNumber,
        maxFunctions: this.maestroConfig.functionCount,
      })
      return false
    }

    if (!this.isConnected()) {
      dmxLogger.error('Maestro not connected')
      return false
    }

    try {
      // Build and send OpTrigger packet with function key
      // Functions typically use key values above the preset range
      const functionKey = 100 + functionNumber // Offset to distinguish from presets
      const packet = this.buildTriggerPacket(
        0x0000,        // OEM code
        functionKey,   // Key (function number + offset)
        1              // SubKey (indicates function button)
      )

      await this.sendPacket(packet)

      this.activeFunction = functionNumber
      dmxLogger.maestro('function', functionNumber, true)

      this.emit('functionTriggered', functionNumber)

      // Clear active function after a short delay (function buttons are momentary)
      setTimeout(() => {
        this.activeFunction = null
      }, 500)

      return true

    } catch (error) {
      dmxLogger.error('Failed to trigger Maestro function', error, {
        function: functionNumber,
      })
      dmxLogger.maestro('function', functionNumber, false)
      return false
    }
  }

  /**
   * Set master intensity (if supported by Maestro)
   * This is typically function button 1 or a dedicated DMX channel
   */
  async setMasterIntensity(intensity: number): Promise<boolean> {
    const value = Math.min(255, Math.max(0, Math.round(intensity * 2.55)))

    // Some Maestro models use a specific channel for master intensity
    // This implementation sends it as a function with value
    try {
      const packet = this.buildTriggerPacket(
        0x0000,
        200,           // Master intensity key
        value          // SubKey contains the intensity value
      )

      await this.sendPacket(packet)
      dmxLogger.info('Set Maestro master intensity', { intensity, value })
      return true

    } catch (error) {
      dmxLogger.error('Failed to set master intensity', error)
      return false
    }
  }

  /**
   * Blackout (all lights off)
   */
  async maestroBlackout(): Promise<boolean> {
    // Blackout is typically function 1 on most Maestro controllers
    return this.triggerFunction(1)
  }

  /**
   * Get list of available presets
   */
  getPresets(): { number: number; available: boolean }[] {
    return Array.from({ length: this.maestroConfig.presetCount }, (_, i) => ({
      number: i + 1,
      available: true, // In a real implementation, we'd query the device
    }))
  }

  /**
   * Get list of available functions
   */
  getFunctions(): { number: number; name: string }[] {
    // Standard Maestro function buttons
    const standardFunctions = [
      { number: 1, name: 'Blackout' },
      { number: 2, name: 'Full On' },
      { number: 3, name: 'Strobe' },
      { number: 4, name: 'Chase' },
      { number: 5, name: 'Sound Active' },
      { number: 6, name: 'Manual' },
      { number: 7, name: 'Auto' },
      { number: 8, name: 'Program' },
    ]

    return standardFunctions.slice(0, this.maestroConfig.functionCount)
  }

  /**
   * Build Art-Net OpTrigger packet
   * Used for Maestro preset recall and function button triggers
   */
  private buildTriggerPacket(oem: number, key: number, subKey: number): Buffer {
    // Art-Net OpTrigger packet structure:
    // Bytes 0-7: ID "Art-Net\0"
    // Bytes 8-9: OpCode (0x9900 little-endian)
    // Bytes 10-11: Protocol Version (14, big-endian)
    // Bytes 12-13: Filler (0)
    // Bytes 14-15: OEM code (manufacturer ID, big-endian)
    // Byte 16: Key
    // Byte 17: SubKey

    const packet = Buffer.alloc(18)

    // Art-Net header
    DMX_CONFIG.ARTNET_HEADER.copy(packet, 0)

    // OpCode (OpTrigger = 0x9900, little-endian)
    packet.writeUInt16LE(DMX_CONFIG.ARTNET_OP_TRIGGER, 8)

    // Protocol version (big-endian)
    packet.writeUInt16BE(DMX_CONFIG.ARTNET_VERSION, 10)

    // Filler
    packet[12] = 0
    packet[13] = 0

    // OEM code (big-endian)
    packet.writeUInt16BE(oem, 14)

    // Key
    packet[16] = key & 0xff

    // SubKey
    packet[17] = subKey & 0xff

    return packet
  }

  /**
   * Handle incoming messages (override to handle Maestro-specific responses)
   */
  protected handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    super.handleMessage(msg, rinfo)

    // Handle Maestro-specific responses if needed
    // (Maestro may send status updates via Art-Net)
  }
}

export default MaestroClient
