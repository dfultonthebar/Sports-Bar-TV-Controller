/**
 * Sharp Aquos TV Client
 * TCP-based client for Sharp Aquos TV control via IP (port 10002)
 *
 * Protocol: RS-232 over TCP — 8-byte commands (4-char cmd + 4-char param + \r)
 * Responses: "OK\r" on success, "ERR\r" on error, or numeric value for queries
 */

import * as net from 'net'
import { BaseTVClient } from './base-client'
import { TVDeviceConfig, CommandResult } from '../types'
import { logger } from '@sports-bar/logger'

const SHARP_PORT = 10002
const COMMAND_TIMEOUT_MS = 5000

export class SharpTVClient extends BaseTVClient {
  constructor(config: TVDeviceConfig) {
    super(config)
    logger.info(`[SHARP] Client initialized for ${config.ipAddress}:${config.port || SHARP_PORT}`)
  }

  /**
   * Send a raw Sharp command and return the response
   * Commands are 4 chars + 4 chars param, terminated with \r
   */
  private sendCommand(command: string): Promise<string> {
    const port = this.config.port || SHARP_PORT
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      let response = ''

      const timeout = setTimeout(() => {
        socket.destroy()
        reject(new Error('Command timeout'))
      }, COMMAND_TIMEOUT_MS)

      socket.connect(port, this.config.ipAddress, () => {
        socket.write(command + '\r')
      })

      socket.on('data', (data) => {
        response += data.toString()
        // Sharp responses end with \r
        if (response.includes('\r')) {
          clearTimeout(timeout)
          socket.destroy()
          resolve(response.trim())
        }
      })

      socket.on('error', (err) => {
        clearTimeout(timeout)
        socket.destroy()
        reject(err)
      })
    })
  }

  /**
   * Pad a Sharp command to 8 characters: 4-char command + 4-char parameter
   */
  private padCommand(cmd: string, param: string): string {
    return (cmd + param).padEnd(8, ' ')
  }

  async connect(): Promise<void> {
    // Sharp uses stateless TCP — no persistent connection needed
  }

  disconnect(): void {
    // No persistent connection to close
  }

  async powerOn(): Promise<CommandResult> {
    try {
      logger.info(`[SHARP] Powering on ${this.config.ipAddress}`)
      const resp = await this.sendCommand(this.padCommand('POWR', '1   '))
      if (resp === 'OK') {
        return { success: true, message: 'Power on sent' }
      }
      return { success: false, error: `Unexpected response: ${resp}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async powerOff(): Promise<CommandResult> {
    try {
      logger.info(`[SHARP] Powering off ${this.config.ipAddress}`)
      const resp = await this.sendCommand(this.padCommand('POWR', '0   '))
      if (resp === 'OK') {
        return { success: true, message: 'Power off sent' }
      }
      return { success: false, error: `Unexpected response: ${resp}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async volumeUp(): Promise<CommandResult> {
    try {
      // Get current volume, increase by 2
      const current = await this.getVolume()
      const next = Math.min(60, current + 2)
      return this.setVolume(next)
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async volumeDown(): Promise<CommandResult> {
    try {
      const current = await this.getVolume()
      const next = Math.max(0, current - 2)
      return this.setVolume(next)
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async setVolume(level: number): Promise<CommandResult> {
    try {
      const vol = Math.max(0, Math.min(60, Math.round(level)))
      logger.info(`[SHARP] Setting volume to ${vol} on ${this.config.ipAddress}`)
      const param = vol.toString().padStart(4, ' ')
      const resp = await this.sendCommand(this.padCommand('VOLM', param))
      if (resp === 'OK') {
        return { success: true, message: `Volume set to ${vol}` }
      }
      return { success: false, error: `Unexpected response: ${resp}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async volumeMute(): Promise<CommandResult> {
    try {
      // Query current mute state and toggle
      const resp = await this.sendCommand(this.padCommand('MUTE', '?   '))
      const currentMute = parseInt(resp)
      // 1 = muted, 2 = unmuted
      const newMute = currentMute === 1 ? '2   ' : '1   '
      logger.info(`[SHARP] Toggling mute on ${this.config.ipAddress}`)
      const muteResp = await this.sendCommand(this.padCommand('MUTE', newMute))
      if (muteResp === 'OK') {
        return { success: true, message: `Mute ${newMute.trim() === '1' ? 'on' : 'off'}` }
      }
      return { success: false, error: `Unexpected response: ${muteResp}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Switch HDMI input (1-4)
   * Sharp Aquos HDMI inputs map to IAVD values:
   * HDMI 1 = 1, HDMI 2 = 2, HDMI 3 = 3, HDMI 4 = 4
   */
  async switchInput(input: number): Promise<CommandResult> {
    if (input < 1 || input > 4) {
      return { success: false, error: `Invalid HDMI input: ${input}. Must be 1-4.` }
    }
    try {
      logger.info(`[SHARP] Switching to HDMI ${input} on ${this.config.ipAddress}`)
      const param = input.toString().padStart(4, ' ')
      const resp = await this.sendCommand(this.padCommand('IAVD', param))
      if (resp === 'OK') {
        return { success: true, message: `Switched to HDMI ${input}` }
      }
      return { success: false, error: `Unexpected response: ${resp}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async sendKey(key: string): Promise<CommandResult> {
    // Map common keys to Sharp commands
    const keyMap: Record<string, string> = {
      'KEY_POWER': this.padCommand('POWR', '0   '),
      'KEY_POWERON': this.padCommand('POWR', '1   '),
      'KEY_POWEROFF': this.padCommand('POWR', '0   '),
      'KEY_VOLUP': this.padCommand('RCKY', '33  '),
      'KEY_VOLDOWN': this.padCommand('RCKY', '32  '),
      'KEY_MUTE': this.padCommand('RCKY', '31  '),
      'KEY_HDMI1': this.padCommand('IAVD', '1   '),
      'KEY_HDMI2': this.padCommand('IAVD', '2   '),
      'KEY_HDMI3': this.padCommand('IAVD', '3   '),
      'KEY_HDMI4': this.padCommand('IAVD', '4   '),
    }

    const cmd = keyMap[key]
    if (!cmd) {
      return { success: false, error: `Unsupported key: ${key}` }
    }

    try {
      const resp = await this.sendCommand(cmd)
      if (resp === 'OK') {
        return { success: true, message: `Key ${key} sent` }
      }
      return { success: false, error: `Unexpected response: ${resp}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const resp = await this.sendCommand(this.padCommand('POWR', '?   '))
      return resp === '0' || resp === '1'
    } catch {
      return false
    }
  }

  async getDeviceInfo(): Promise<{ model?: string; serialNumber?: string; softwareVersion?: string }> {
    try {
      const model = await this.sendCommand(this.padCommand('MNRD', '1   ')).catch(() => undefined)
      return { model }
    } catch {
      return {}
    }
  }

  /**
   * Get current power state: true = on, false = off/standby
   */
  async getPowerState(): Promise<boolean> {
    const resp = await this.sendCommand(this.padCommand('POWR', '?   '))
    return resp === '1'
  }

  /**
   * Get current volume level (0-60)
   */
  async getVolume(): Promise<number> {
    const resp = await this.sendCommand(this.padCommand('VOLM', '?   '))
    return parseInt(resp) || 0
  }

  /**
   * Get current input number
   */
  async getCurrentInput(): Promise<number> {
    const resp = await this.sendCommand(this.padCommand('IAVD', '?   '))
    return parseInt(resp) || 0
  }
}
