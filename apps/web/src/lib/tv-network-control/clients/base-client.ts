/**
 * Base TV Client - Abstract Base Class
 * Provides common interface for all TV network control clients
 */

import { TVDeviceConfig, CommandResult } from '../types'

export abstract class BaseTVClient {
  protected config: TVDeviceConfig

  constructor(config: TVDeviceConfig) {
    this.config = config
  }

  /**
   * Connect to the TV device
   * May involve authentication/pairing for some brands
   */
  abstract connect(): Promise<void>

  /**
   * Disconnect from the TV device
   * Clean up any open connections or timers
   */
  abstract disconnect(): void

  /**
   * Power on the TV
   */
  abstract powerOn(): Promise<CommandResult>

  /**
   * Power off the TV
   */
  abstract powerOff(): Promise<CommandResult>

  /**
   * Set volume level (0-100)
   * Not all TVs support direct volume setting
   */
  abstract setVolume(level: number): Promise<CommandResult>

  /**
   * Increase volume
   */
  abstract volumeUp(): Promise<CommandResult>

  /**
   * Decrease volume
   */
  abstract volumeDown(): Promise<CommandResult>

  /**
   * Toggle mute
   */
  abstract volumeMute(): Promise<CommandResult>

  /**
   * Switch to specific HDMI input (1-4)
   */
  abstract switchInput(input: number): Promise<CommandResult>

  /**
   * Send a key press command
   */
  abstract sendKey(key: string): Promise<CommandResult>

  /**
   * Test connection to the TV
   */
  abstract testConnection(): Promise<boolean>

  /**
   * Get device information
   */
  abstract getDeviceInfo(): Promise<{ model?: string; serialNumber?: string; softwareVersion?: string }>

  /**
   * Get current IP address
   */
  getIpAddress(): string {
    return this.config.ipAddress
  }

  /**
   * Get current port
   */
  getPort(): number {
    return this.config.port
  }

  /**
   * Get device configuration
   */
  getConfig(): TVDeviceConfig {
    return { ...this.config }
  }
}
