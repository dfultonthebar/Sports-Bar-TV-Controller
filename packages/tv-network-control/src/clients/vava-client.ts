/**
 * VAVA Projector Client
 * HTTP-based control via EShare server (port 8000)
 *
 * Protocol: HTTP GET requests to /remote/* endpoints
 * Power on: Wake-on-LAN magic packet
 * Power off: Android keycode 26 (KEYCODE_POWER)
 * Input switching: Navigate home screen tiles (HOME → arrow keys → SELECT)
 *
 * Home screen layout:
 *   Row 1: [HDMI 1] [App Store] ...
 *   Row 2: [HDMI 2] [HDMI 3]   ...
 */

import * as dgram from 'dgram'
import { BaseTVClient } from './base-client'
import { TVDeviceConfig, CommandResult } from '../types'
import { logger } from '@sports-bar/logger'

const VAVA_PORT = 8000
const REQUEST_TIMEOUT_MS = 5000

// Android keycodes
const KEYCODE_POWER = 26
const KEYCODE_HOME = 3
const KEYCODE_DPAD_UP = 19
const KEYCODE_DPAD_DOWN = 20
const KEYCODE_DPAD_LEFT = 21
const KEYCODE_DPAD_RIGHT = 22
const KEYCODE_DPAD_CENTER = 23
const KEYCODE_SLEEP = 223
const KEYCODE_WAKEUP = 224

export class VavaTVClient extends BaseTVClient {
  constructor(config: TVDeviceConfig) {
    super(config)
  }

  async connect(): Promise<void> {
    // Stateless HTTP — no persistent connection needed
  }

  disconnect(): void {
    // Stateless HTTP — nothing to disconnect
  }

  /**
   * Send an Android keycode via EShare HTTP API
   */
  private async sendKeycode(keycode: number): Promise<CommandResult> {
    const port = this.config.port || VAVA_PORT
    const url = `http://${this.config.ipAddress}:${port}/remote/keycode_control?keycode=${keycode}`

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      const text = await response.text()
      if (text.includes('OK')) {
        return { success: true, message: `Keycode ${keycode} sent` }
      }
      return { success: false, error: `Unexpected response: ${text.substring(0, 100)}` }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout — projector may be off' }
      }
      return { success: false, error: error.message }
    }
  }

  /**
   * Send a sequence of keycodes with delays between them
   */
  private async sendKeycodeSequence(keycodes: number[], delayMs = 300): Promise<CommandResult> {
    for (const keycode of keycodes) {
      const result = await this.sendKeycode(keycode)
      if (!result.success) return result
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
    return { success: true, message: 'Keycode sequence sent' }
  }

  /**
   * Send Wake-on-LAN magic packet to power on
   */
  private sendWOL(): Promise<CommandResult> {
    return new Promise((resolve) => {
      const mac = this.config.macAddress
      if (!mac) {
        resolve({ success: false, error: 'No MAC address configured for WOL' })
        return
      }

      try {
        const macBytes = Buffer.from(mac.replace(/[:-]/g, ''), 'hex')
        const magic = Buffer.alloc(102)
        for (let i = 0; i < 6; i++) magic[i] = 0xff
        for (let i = 0; i < 16; i++) macBytes.copy(magic, 6 + i * 6)

        const socket = dgram.createSocket('udp4')
        socket.on('error', () => socket.close())

        socket.bind(() => {
          socket.setBroadcast(true)
          let sent = 0
          const targets = ['255.255.255.255', '10.11.3.255', this.config.ipAddress]

          for (const target of targets) {
            socket.send(magic, 0, magic.length, 9, target, () => {
              sent++
              if (sent === targets.length) {
                socket.close()
                resolve({ success: true, message: 'WOL packet sent' })
              }
            })
          }
        })
      } catch (error: any) {
        resolve({ success: false, error: error.message })
      }
    })
  }

  async powerOn(): Promise<CommandResult> {
    logger.info(`[VAVA] Power ON (WAKEUP): ${this.config.ipAddress}`)
    return this.sendKeycode(KEYCODE_WAKEUP)
  }

  async powerOff(): Promise<CommandResult> {
    // VAVA kills NIC on ALL sleep/power commands — full shutdown, unrecoverable over network.
    // Only the physical remote can bring it back. Block software power-off to prevent this.
    logger.warn(`[VAVA] Power off blocked — VAVA cannot be powered on again over network. Use physical remote.`)
    return {
      success: false,
      error: 'VAVA projector cannot be powered off remotely. It kills all network services and can only be restarted with the physical remote. Use the physical remote to power off.'
    }
  }

  async getPowerState(): Promise<boolean> {
    try {
      const port = this.config.port || VAVA_PORT
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const response = await fetch(`http://${this.config.ipAddress}:${port}/remote/get_volume`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const text = await response.text()
      return text.includes("'status':'ok'")
    } catch {
      return false
    }
  }

  /**
   * Switch HDMI input by navigating the home screen tiles
   *
   * Layout:
   *   Row 1: [HDMI 1] ...
   *   Row 2: [HDMI 2] [HDMI 3]
   *
   * HDMI 1: HOME → SELECT
   * HDMI 2: HOME → DOWN → SELECT
   * HDMI 3: HOME → DOWN → RIGHT → SELECT
   */
  async switchInput(input: number): Promise<CommandResult> {
    let sequence: number[]

    switch (input) {
      case 1:
        sequence = [KEYCODE_HOME, KEYCODE_DPAD_CENTER]
        break
      case 2:
        sequence = [KEYCODE_HOME, KEYCODE_DPAD_DOWN, KEYCODE_DPAD_CENTER]
        break
      case 3:
        sequence = [KEYCODE_HOME, KEYCODE_DPAD_DOWN, KEYCODE_DPAD_RIGHT, KEYCODE_DPAD_CENTER]
        break
      default:
        return { success: false, error: `Invalid input: ${input}. VAVA supports HDMI 1-3.` }
    }

    logger.info(`[VAVA] Switch to HDMI${input}: ${this.config.ipAddress}`)
    return this.sendKeycodeSequence(sequence)
  }

  async setVolume(level: number): Promise<CommandResult> {
    const port = this.config.port || VAVA_PORT
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      await fetch(`http://${this.config.ipAddress}:${port}/remote/volume_control?mute=false&volume=${level}`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return { success: true, message: `Volume set to ${level}` }
    } catch {
      return { success: false, error: 'Volume control failed' }
    }
  }

  async volumeUp(): Promise<CommandResult> {
    return this.sendKeycode(24) // KEYCODE_VOLUME_UP
  }

  async volumeDown(): Promise<CommandResult> {
    return this.sendKeycode(25) // KEYCODE_VOLUME_DOWN
  }

  async volumeMute(): Promise<CommandResult> {
    return this.sendKeycode(164) // KEYCODE_VOLUME_MUTE
  }

  async sendKey(key: string): Promise<CommandResult> {
    const keyMap: Record<string, number> = {
      HOME: KEYCODE_HOME, BACK: 4, UP: KEYCODE_DPAD_UP, DOWN: KEYCODE_DPAD_DOWN,
      LEFT: KEYCODE_DPAD_LEFT, RIGHT: KEYCODE_DPAD_RIGHT, SELECT: KEYCODE_DPAD_CENTER,
      POWER: KEYCODE_POWER, MENU: 82,
    }
    const keycode = keyMap[key.toUpperCase()]
    if (!keycode) return { success: false, error: `Unknown key: ${key}` }
    return this.sendKeycode(keycode)
  }

  async testConnection(): Promise<boolean> {
    return this.getPowerState()
  }

  async getDeviceInfo(): Promise<{ model?: string; serialNumber?: string; softwareVersion?: string }> {
    try {
      const port = this.config.port || VAVA_PORT
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const response = await fetch(`http://${this.config.ipAddress}:${port}/remote/get_wifi_info?m_action=get_wifi_info`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const text = await response.text()
      const nameMatch = text.match(/deviceName:'([^']+)'/)
      return { model: nameMatch?.[1] || 'VAVA Projector' }
    } catch {
      return { model: 'VAVA Projector' }
    }
  }
}
