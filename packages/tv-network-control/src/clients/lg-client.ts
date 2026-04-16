/**
 * LG WebOS TV Client
 * Controls LG TVs via WebSocket SSAP protocol on port 3001 (WSS)
 */

import { BaseTVClient } from './base-client'
import { CommandResult, TVDeviceConfig } from '../types'

// WebSocket imported dynamically to avoid bundling issues
let WebSocket: any

function getWebSocket() {
  if (!WebSocket) {
    WebSocket = require('ws')
  }
  return WebSocket
}

export class LGTVClient extends BaseTVClient {
  private ws: any = null
  private clientKey: string | undefined

  constructor(config: TVDeviceConfig) {
    super(config)
    this.clientKey = config.clientKey
  }

  private sendAndWait(ws: any, message: any, timeoutMs = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      const handler = (data: any) => {
        const msg = JSON.parse(data.toString())
        if (msg.id === message.id || msg.type === 'registered') {
          clearTimeout(timer)
          ws.removeListener('message', handler)
          resolve(msg)
        }
      }
      ws.on('message', handler)
      ws.send(JSON.stringify(message))
    })
  }

  private async createConnection(): Promise<any> {
    const WS = getWebSocket()
    return new Promise((resolve, reject) => {
      const ws = new WS(`wss://${this.config.ipAddress}:${this.config.port || 3001}`, {
        rejectUnauthorized: false,
        handshakeTimeout: 5000,
      })
      ws.on('open', () => resolve(ws))
      ws.on('error', (e: Error) => reject(e))
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    })
  }

  private async register(ws: any): Promise<void> {
    const payload: any = this.clientKey
      ? { 'client-key': this.clientKey }
      : {
          forcePairing: false,
          pairingType: 'PROMPT',
          manifest: {
            manifestVersion: 1,
            permissions: ['CONTROL_POWER', 'CONTROL_INPUT_TV', 'CONTROL_AUDIO', 'READ_POWER_STATE'],
          },
        }

    const response = await this.sendAndWait(ws, { type: 'register', id: 'reg_0', payload }, 8000)
    if (response.payload?.['client-key']) {
      this.clientKey = response.payload['client-key']
    }
  }

  async connect(): Promise<void> {
    this.ws = await this.createConnection()
    await this.register(this.ws)
  }

  disconnect(): void {
    if (this.ws) {
      try { this.ws.close() } catch (_) {}
      this.ws = null
    }
  }

  async powerOn(): Promise<CommandResult> {
    // LG TVs in standby may not accept WebSocket connections
    // Wake-on-LAN is the reliable way to power on
    if (this.config.macAddress) {
      try {
        await this.sendWOL(this.config.macAddress)
        return { success: true, message: 'Wake-on-LAN sent' }
      } catch (e: any) {
        return { success: false, error: `WOL failed: ${e.message}` }
      }
    }

    // Try WebSocket power on as fallback
    try {
      const ws = await this.createConnection()
      await this.register(ws)
      // TV is already on if we can connect
      ws.close()
      return { success: true, message: 'TV is already on' }
    } catch {
      return { success: false, error: 'TV unreachable — may need Wake-on-LAN (MAC address required)' }
    }
  }

  async powerOff(): Promise<CommandResult> {
    try {
      const ws = await this.createConnection()
      await this.register(ws)
      const result = await this.sendAndWait(ws, {
        type: 'request',
        id: 'power_off',
        uri: 'ssap://system/turnOff',
      })
      ws.close()
      return { success: result.payload?.returnValue !== false, message: 'Power off sent' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  async setVolume(level: number): Promise<CommandResult> {
    try {
      const ws = await this.createConnection()
      await this.register(ws)
      const result = await this.sendAndWait(ws, {
        type: 'request',
        id: 'set_vol',
        uri: 'ssap://audio/setVolume',
        payload: { volume: level },
      })
      ws.close()
      return { success: result.payload?.returnValue !== false }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  async volumeUp(): Promise<CommandResult> {
    return this.sendSSAPCommand('ssap://audio/volumeUp', 'vol_up')
  }

  async volumeDown(): Promise<CommandResult> {
    return this.sendSSAPCommand('ssap://audio/volumeDown', 'vol_down')
  }

  async volumeMute(): Promise<CommandResult> {
    return this.sendSSAPCommand('ssap://audio/setMute', 'mute', { mute: true })
  }

  async switchInput(input: number): Promise<CommandResult> {
    return this.setInput(`HDMI_${input}`)
  }

  async sendKey(key: string): Promise<CommandResult> {
    return this.sendSSAPCommand('ssap://com.webos.service.networkinput/getPointerInputSocket', 'key_' + key)
  }

  async testConnection(): Promise<boolean> {
    try {
      const state = await this.getPowerState()
      return state !== 'Offline'
    } catch {
      return false
    }
  }

  async getDeviceInfo(): Promise<{ model?: string; serialNumber?: string; softwareVersion?: string }> {
    try {
      const ws = await this.createConnection()
      await this.register(ws)
      const result = await this.sendAndWait(ws, {
        type: 'request', id: 'info', uri: 'ssap://system/getSystemInfo',
      })
      ws.close()
      return {
        model: result.payload?.modelName,
        serialNumber: result.payload?.serialNumber,
        softwareVersion: result.payload?.firmwareVersion,
      }
    } catch {
      return {}
    }
  }

  private async sendSSAPCommand(uri: string, id: string, payload?: any): Promise<CommandResult> {
    try {
      const ws = await this.createConnection()
      await this.register(ws)
      const msg: any = { type: 'request', id, uri }
      if (payload) msg.payload = payload
      const result = await this.sendAndWait(ws, msg)
      ws.close()
      return { success: result.payload?.returnValue !== false }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  async setInput(inputId: string): Promise<CommandResult> {
    try {
      const ws = await this.createConnection()
      await this.register(ws)
      const result = await this.sendAndWait(ws, {
        type: 'request',
        id: 'set_input',
        uri: 'ssap://tv/switchInput',
        payload: { inputId },
      })
      ws.close()
      return { success: result.payload?.returnValue !== false }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  async getPowerState(): Promise<string> {
    try {
      const ws = await this.createConnection()
      await this.register(ws)
      const result = await this.sendAndWait(ws, {
        type: 'request',
        id: 'power_state',
        uri: 'ssap://com.webos.service.tvpower/power/getPowerState',
      })
      ws.close()
      return result.payload?.state || 'Unknown'
    } catch {
      return 'Offline'
    }
  }

  private async sendWOL(mac: string): Promise<void> {
    const dgram = require('dgram')
    const macBytes = mac.replace(/[:-]/g, '').match(/.{2}/g)!.map((b: string) => parseInt(b, 16))
    const magicPacket = Buffer.alloc(102)
    for (let i = 0; i < 6; i++) magicPacket[i] = 0xff
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 6; j++) {
        magicPacket[6 + i * 6 + j] = macBytes[j]
      }
    }
    await new Promise<void>((resolve, reject) => {
      const client = dgram.createSocket('udp4')
      client.once('listening', () => {
        client.setBroadcast(true)
        client.send(magicPacket, 0, magicPacket.length, 9, '255.255.255.255', (err: Error | null) => {
          client.close()
          err ? reject(err) : resolve()
        })
      })
      client.on('error', (err: Error) => { client.close(); reject(err) })
      client.bind()
    })
  }

  getClientKey(): string | undefined {
    return this.clientKey
  }
}
