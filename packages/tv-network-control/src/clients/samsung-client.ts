/**
 * Samsung TV Client
 * WebSocket-based client for Samsung Tizen TV control (2016+)
 *
 * Protocol: WebSocket on port 8002 (wss://) with Samsung SmartView API
 * Authentication: Token-based (obtained via TV popup pairing)
 * Power On: Wake-on-LAN UDP magic packet
 * Device Info: REST API on port 8001
 */

import WebSocket from 'ws'
import * as dgram from 'dgram'
import { BaseTVClient } from './base-client'
import { TVDeviceConfig, CommandResult } from '../types'
import { CommandQueue } from '../utils/command-queue'
import { logger } from '@sports-bar/logger'

const SAMSUNG_APP_NAME = 'SportsBarController'
const WS_PORT = 8002
const REST_PORT = 8001
const IDLE_TIMEOUT_MS = 60_000
const WOL_PORT = 9

export class SamsungTVClient extends BaseTVClient {
  private ws: WebSocket | null = null
  private commandQueue: CommandQueue
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private connecting = false
  private ready = false

  constructor(config: TVDeviceConfig) {
    super(config)
    this.commandQueue = new CommandQueue({ delayMs: 150, label: 'SAMSUNG' })
    logger.info(`[SAMSUNG] Client initialized for ${config.ipAddress}:${config.port || WS_PORT}`)
  }

  /**
   * Build the WebSocket URL for Samsung TV connection
   */
  private buildWsUrl(): string {
    const nameB64 = Buffer.from(SAMSUNG_APP_NAME).toString('base64')
    const port = this.config.port || WS_PORT
    let url = `wss://${this.config.ipAddress}:${port}/api/v2/channels/samsung.remote.control?name=${nameB64}`
    if (this.config.authToken) {
      url += `&token=${this.config.authToken}`
    }
    return url
  }

  /**
   * Connect to the Samsung TV via WebSocket
   * Waits for the ms.channel.connect event before resolving,
   * which confirms the TV is ready to accept commands.
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN && this.ready) return
    if (this.connecting) {
      // Wait for existing connection attempt
      await new Promise<void>((resolve, reject) => {
        const check = setInterval(() => {
          if (!this.connecting) {
            clearInterval(check)
            if (this.ws?.readyState === WebSocket.OPEN && this.ready) resolve()
            else reject(new Error('Connection attempt failed'))
          }
        }, 100)
        setTimeout(() => { clearInterval(check); reject(new Error('Connection wait timeout')) }, 10_000)
      })
      return
    }

    this.connecting = true
    this.ready = false
    const url = this.buildWsUrl()

    try {
      logger.info(`[SAMSUNG] Connecting to ${this.config.ipAddress}...`)

      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(url, { rejectUnauthorized: false })
        const timeout = setTimeout(() => {
          ws.terminate()
          reject(new Error('WebSocket connection timeout'))
        }, 10_000)

        ws.on('open', () => {
          this.ws = ws
          this.resetIdleTimer()
          logger.info(`[SAMSUNG] WebSocket open for ${this.config.ipAddress}, waiting for channel connect...`)
        })

        ws.on('error', (err) => {
          clearTimeout(timeout)
          logger.error(`[SAMSUNG] WebSocket error`, { error: err.message })
          reject(err)
        })

        ws.on('close', () => {
          this.ws = null
          this.ready = false
          this.clearIdleTimer()
          logger.info(`[SAMSUNG] WebSocket closed for ${this.config.ipAddress}`)
        })

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString())
            logger.debug(`[SAMSUNG] Message received`, { event: msg.event })

            // Handle token response from initial pairing
            if (msg.data?.token) {
              this.config.authToken = msg.data.token
              logger.info(`[SAMSUNG] Token received for ${this.config.ipAddress}`)
            }

            // TV is ready to accept commands after channel connect
            if (msg.event === 'ms.channel.connect') {
              clearTimeout(timeout)
              this.ready = true
              logger.info(`[SAMSUNG] Connected and ready: ${this.config.ipAddress}`)
              resolve()
            }

            // Handle auth errors
            if (msg.event === 'ms.error') {
              logger.warn(`[SAMSUNG] TV error: ${msg.data?.message} for ${this.config.ipAddress}`)
            }
          } catch {
            // Non-JSON messages are ignored
          }
        })
      })
    } finally {
      this.connecting = false
    }
  }

  /**
   * Ensure WebSocket is connected before sending commands
   */
  private async ensureConnection(): Promise<void> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      await this.connect()
    }
    this.resetIdleTimer()
  }

  /**
   * Reset the idle disconnect timer
   */
  private resetIdleTimer(): void {
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      logger.info(`[SAMSUNG] Idle timeout, disconnecting ${this.config.ipAddress}`)
      this.disconnect()
    }, IDLE_TIMEOUT_MS)
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  /**
   * Disconnect from the Samsung TV
   */
  disconnect(): void {
    this.clearIdleTimer()
    if (this.ws) {
      logger.info(`[SAMSUNG] Disconnecting from ${this.config.ipAddress}`)
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Send a Samsung key command via WebSocket
   */
  async sendKey(key: string): Promise<CommandResult> {
    return this.commandQueue.enqueue(async () => {
      try {
        await this.ensureConnection()

        const payload = JSON.stringify({
          method: 'ms.remote.control',
          params: {
            Cmd: 'Click',
            DataOfCmd: key,
            Option: 'false',
            TypeOfRemote: 'SendRemoteKey',
          },
        })

        logger.info(`[SAMSUNG] Sending key: ${key} to ${this.config.ipAddress}`)

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return { success: false, error: 'WebSocket not connected' }
        }

        this.ws.send(payload)

        return { success: true, message: `Key ${key} sent successfully` }
      } catch (error) {
        return this.handleError(`Failed to send key ${key}`, error)
      }
    })
  }

  /**
   * Power on via Wake-on-LAN + KEY_POWER
   * WoL wakes the network interface, then KEY_POWER turns the screen on.
   * Some Samsung TVs (especially on ethernet) need both steps.
   */
  async powerOn(): Promise<CommandResult> {
    try {
      const mac = this.config.macAddress
      if (!mac) {
        return { success: false, error: 'MAC address required for Wake-on-LAN power on' }
      }

      logger.info(`[SAMSUNG] Sending WOL to ${mac} for ${this.config.ipAddress}`)
      await this.sendWOL(mac)

      // Wait for the TV to become reachable, then check if screen is actually on
      // Some Samsung TVs fully power on from WoL alone; others need KEY_POWER too.
      // Check PowerState via REST API to avoid toggling an already-on TV back off.
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2000)
          const response = await fetch(`http://${this.config.ipAddress}:${REST_PORT}/api/v2/`, {
            signal: controller.signal,
          })
          clearTimeout(timeout)
          if (response.ok) {
            const data = await response.json()
            const powerState = data?.device?.PowerState
            logger.info(`[SAMSUNG] TV reachable after WOL, PowerState=${powerState} for ${this.config.ipAddress}`)

            if (powerState === 'on' || !powerState) {
              // WoL fully powered on the TV — no KEY_POWER needed.
              // Some older Samsung TVs (Series 6) don't report PowerState at all,
              // but if the REST API is reachable after WoL, the TV is on.
              return { success: true, message: `WOL powered on TV (attempt ${attempt + 1})` }
            }

            if (powerState === 'standby') {
              // TV is explicitly in standby — send KEY_POWER to wake the screen
              logger.info(`[SAMSUNG] TV in standby, sending KEY_POWER to ${this.config.ipAddress}`)
              await this.sendKey('KEY_POWER')
              return { success: true, message: `WOL + KEY_POWER sent (attempt ${attempt + 1})` }
            }

            // Unknown power state — safer to just return WoL success
            return { success: true, message: `WOL sent, PowerState=${powerState} (attempt ${attempt + 1})` }
          }
        } catch {
          logger.debug(`[SAMSUNG] TV not yet reachable (attempt ${attempt + 1}/10)`)
        }
      }

      // WoL sent but couldn't confirm TV is reachable
      return { success: true, message: 'Wake-on-LAN packet sent (TV not yet reachable for status check)' }
    } catch (error) {
      return this.handleError('Failed to power on', error)
    }
  }

  /**
   * Power off via WebSocket KEY_POWER toggle
   * Samsung TVs don't support KEY_POWEROFF — only KEY_POWER (toggle)
   */
  async powerOff(): Promise<CommandResult> {
    logger.info(`[SAMSUNG] Powering off ${this.config.ipAddress}`)
    return this.sendKey('KEY_POWER')
  }

  async volumeUp(): Promise<CommandResult> {
    logger.info(`[SAMSUNG] Volume up on ${this.config.ipAddress}`)
    return this.sendKey('KEY_VOLUP')
  }

  async volumeDown(): Promise<CommandResult> {
    logger.info(`[SAMSUNG] Volume down on ${this.config.ipAddress}`)
    return this.sendKey('KEY_VOLDOWN')
  }

  async volumeMute(): Promise<CommandResult> {
    logger.info(`[SAMSUNG] Mute toggle on ${this.config.ipAddress}`)
    return this.sendKey('KEY_MUTE')
  }

  /**
   * Direct volume setting not supported by Samsung SmartView API
   */
  async setVolume(_level: number): Promise<CommandResult> {
    return {
      success: false,
      error: 'Direct volume setting not supported. Use volumeUp/volumeDown instead.',
    }
  }

  /**
   * Switch HDMI input (1-4)
   */
  async switchInput(input: number): Promise<CommandResult> {
    if (input < 1 || input > 4) {
      return { success: false, error: `Invalid HDMI input: ${input}. Must be 1-4.` }
    }

    logger.info(`[SAMSUNG] Switching to HDMI ${input} on ${this.config.ipAddress}`)
    return this.sendKey(`KEY_HDMI${input}`)
  }

  /**
   * Test connection via REST API on port 8001
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info(`[SAMSUNG] Testing connection to ${this.config.ipAddress}`)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`http://${this.config.ipAddress}:${REST_PORT}/api/v2/`, {
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.ok) {
        logger.info(`[SAMSUNG] Connection test successful for ${this.config.ipAddress}`)
        return true
      }

      logger.warn(`[SAMSUNG] Connection test failed: HTTP ${response.status}`)
      return false
    } catch (error) {
      logger.error(`[SAMSUNG] Connection test failed for ${this.config.ipAddress}`, { error })
      return false
    }
  }

  /**
   * Get device info via REST API on port 8001
   */
  async getDeviceInfo(): Promise<{ model?: string; serialNumber?: string; softwareVersion?: string }> {
    try {
      logger.info(`[SAMSUNG] Getting device info from ${this.config.ipAddress}`)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`http://${this.config.ipAddress}:${REST_PORT}/api/v2/`, {
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) return {}

      const data = await response.json()
      const device = data?.device || {}

      logger.info(`[SAMSUNG] Device info: ${device.ModelName || 'unknown'}`)

      return {
        model: device.ModelName,
        serialNumber: device.WifiMac,
        softwareVersion: device.FirmwareVersion,
      }
    } catch (error) {
      logger.error(`[SAMSUNG] Failed to get device info`, { error })
      return {}
    }
  }

  /**
   * Initiate pairing flow — connect without token, wait for TV popup approval
   * Returns the auth token if approved within timeout
   */
  async pair(timeoutMs = 30_000): Promise<string> {
    logger.info(`[SAMSUNG] Starting pairing for ${this.config.ipAddress} (timeout: ${timeoutMs}ms)`)

    // Connect without token
    const savedToken = this.config.authToken
    this.config.authToken = undefined
    this.disconnect()

    try {
      await this.connect()

      // Wait for token to arrive via WebSocket message handler
      const token = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Pairing timeout — no approval received from TV'))
        }, timeoutMs)

        const checkToken = setInterval(() => {
          if (this.config.authToken) {
            clearTimeout(timeout)
            clearInterval(checkToken)
            resolve(this.config.authToken)
          }
        }, 500)
      })

      logger.info(`[SAMSUNG] Pairing successful for ${this.config.ipAddress}`)
      return token
    } catch (error) {
      // Restore previous token on failure
      this.config.authToken = savedToken
      this.disconnect()
      throw error
    }
  }

  /**
   * Send Wake-on-LAN magic packet
   */
  private sendWOL(macAddress: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Parse MAC address (supports : or - separators)
      const macBytes = macAddress
        .replace(/[:-]/g, '')
        .match(/.{2}/g)
        ?.map((b) => parseInt(b, 16))

      if (!macBytes || macBytes.length !== 6) {
        reject(new Error(`Invalid MAC address: ${macAddress}`))
        return
      }

      // Build 102-byte magic packet: 6 bytes of 0xFF + MAC repeated 16 times
      const magicPacket = Buffer.alloc(102)
      for (let i = 0; i < 6; i++) {
        magicPacket[i] = 0xff
      }
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 6; j++) {
          magicPacket[6 + i * 6 + j] = macBytes[j]
        }
      }

      const client = dgram.createSocket('udp4')

      client.once('error', (err) => {
        client.close()
        reject(err)
      })

      // Send WOL to multiple broadcast addresses for reliability
      const broadcastAddresses = ['255.255.255.255', '10.11.3.255', this.config.ipAddress]

      client.bind(() => {
        client.setBroadcast(true)
        let sent = 0
        for (const addr of broadcastAddresses) {
          client.send(magicPacket, 0, magicPacket.length, WOL_PORT, addr, (err) => {
            sent++
            if (err) logger.warn(`[SAMSUNG] WOL send to ${addr} failed: ${err.message}`)
            if (sent === broadcastAddresses.length) {
              client.close()
              resolve()
            }
          })
        }
      })
    })
  }

  private handleError(message: string, error: unknown): CommandResult {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[SAMSUNG] ${message}: ${errorMessage}`)
    return { success: false, error: `${message}: ${errorMessage}` }
  }
}
