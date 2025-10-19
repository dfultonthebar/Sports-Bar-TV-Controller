/**
 * Atlas TCP Client for AZM4/AZM8 Third-Party Control
 * Implements JSON-RPC 2.0 protocol for Atlas Atmosphere processors
 */

import net from 'net'
import { atlasLogger } from './atlas-logger'

interface AtlasCommand {
  jsonrpc: '2.0'
  method: 'set' | 'bmp' | 'sub' | 'unsub' | 'get'
  params: any
  id?: number
}

interface AtlasResponse {
  jsonrpc: '2.0'
  result?: any
  error?: any
  id?: number
}

export class AtlasTCPClient {
  private host: string
  private port: number
  private socket: net.Socket | null = null
  private connected: boolean = false
  private commandId: number = 1

  constructor(host: string, port: number = 5321) {  // Atlas AZMP8 uses port 5321 for TCP control
    this.host = host
    this.port = port
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket()
      
      this.socket.connect(this.port, this.host, () => {
        this.connected = true
        console.log(`Connected to Atlas processor at ${this.host}:${this.port}`)
        resolve()
      })

      this.socket.on('error', (err) => {
        console.error('Atlas TCP connection error:', err)
        this.connected = false
        reject(err)
      })

      this.socket.on('close', () => {
        this.connected = false
        console.log('Atlas TCP connection closed')
      })
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
      this.connected = false
    }
  }

  private async sendCommand(command: AtlasCommand): Promise<AtlasResponse | null> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to Atlas processor')
    }

    return new Promise((resolve, reject) => {
      const commandStr = JSON.stringify(command) + '\r\n'
      
      this.socket!.write(commandStr, (err) => {
        if (err) {
          reject(err)
          return
        }

        // For commands without ID, we don't expect a response
        if (!command.id) {
          resolve(null)
          return
        }

        // Set up response handler
        const timeout = setTimeout(() => {
          reject(new Error('Command timeout'))
        }, 5000)

        this.socket!.once('data', (data) => {
          clearTimeout(timeout)
          try {
            const response = JSON.parse(data.toString().trim())
            resolve(response)
          } catch (err) {
            reject(new Error('Invalid response from Atlas processor'))
          }
        })
      })
    })
  }

  /**
   * Set zone source (ZoneSource_X parameter)
   * @param zoneIndex - Zone index (0-based, e.g., 0 for Zone 1)
   * @param sourceIndex - Source index (0-based, or -1 for no source)
   */
  async setZoneSource(zoneIndex: number, sourceIndex: number): Promise<void> {
    const command: AtlasCommand = {
      jsonrpc: '2.0',
      method: 'set',
      params: {
        param: `ZoneSource_${zoneIndex}`,
        val: sourceIndex
      }
    }

    await this.sendCommand(command)
    console.log(`Set Zone ${zoneIndex + 1} source to ${sourceIndex}`)
  }

  /**
   * Set zone volume (ZoneGain_X parameter)
   * @param zoneIndex - Zone index (0-based)
   * @param volume - Volume in dB (-80 to 0) or percentage (0-100)
   * @param usePercent - If true, use percentage format
   */
  async setZoneVolume(zoneIndex: number, volume: number, usePercent: boolean = true): Promise<void> {
    const command: AtlasCommand = {
      jsonrpc: '2.0',
      method: 'set',
      params: {
        param: `ZoneGain_${zoneIndex}`,
        [usePercent ? 'pct' : 'val']: volume
      }
    }

    await this.sendCommand(command)
    console.log(`Set Zone ${zoneIndex + 1} volume to ${volume}${usePercent ? '%' : 'dB'}`)
  }

  /**
   * Set zone mute state (ZoneMute_X parameter)
   * @param zoneIndex - Zone index (0-based)
   * @param muted - true to mute, false to unmute
   */
  async setZoneMute(zoneIndex: number, muted: boolean): Promise<void> {
    const command: AtlasCommand = {
      jsonrpc: '2.0',
      method: 'set',
      params: {
        param: `ZoneMute_${zoneIndex}`,
        val: muted ? 1 : 0
      }
    }

    await this.sendCommand(command)
    console.log(`${muted ? 'Muted' : 'Unmuted'} Zone ${zoneIndex + 1}`)
  }

  /**
   * Subscribe to zone parameters for real-time updates
   */
  async subscribeToZone(zoneIndex: number): Promise<void> {
    const params = [
      { param: `ZoneGain_${zoneIndex}`, fmt: 'val' },
      { param: `ZoneMute_${zoneIndex}`, fmt: 'val' },
      { param: `ZoneSource_${zoneIndex}`, fmt: 'val' }
    ]

    const command: AtlasCommand = {
      jsonrpc: '2.0',
      method: 'sub',
      params
    }

    await this.sendCommand(command)
    console.log(`Subscribed to Zone ${zoneIndex + 1} parameters`)
  }

  /**
   * Get current zone source
   */
  async getZoneSource(zoneIndex: number): Promise<number> {
    const command: AtlasCommand = {
      jsonrpc: '2.0',
      method: 'get',
      params: {
        param: `ZoneSource_${zoneIndex}`,
        fmt: 'val'
      },
      id: this.commandId++
    }

    const response = await this.sendCommand(command)
    return response?.result || -1
  }
}

export default AtlasTCPClient
