/**
 * Atlas AZMP8 TCP Client Library
 * 
 * Implements JSON-RPC 2.0 communication protocol for Atlas AZMP8 audio processors
 * Based on ATS006993-B-AZM4-AZM8-3rd-Party-Control manual
 * 
 * Protocol Details:
 * - Uses TCP port 5321 (default)
 * - JSON-RPC 2.0 format
 * - Messages must be newline delimited (\r\n)
 * - Methods: set, bmp (bump), sub (subscribe), unsub (unsubscribe), get
 * - Response methods: update, getResp, error
 */

import * as net from 'net'

export interface AtlasMessage {
  jsonrpc: '2.0'
  method: 'set' | 'bmp' | 'sub' | 'unsub' | 'get'
  params: any
  id?: number
}

export interface AtlasResponse {
  jsonrpc: '2.0'
  result?: any
  error?: {
    code: number
    message: string
  }
  id?: number
}

export interface AtlasConfig {
  inputs?: Array<{ name: string; gain?: number; mute?: boolean }>
  outputs?: Array<{ name: string; gain?: number; mute?: boolean; source?: number }>
  scenes?: Array<{ name: string }>
  messages?: Array<{ name: string }>
}

export class AtlasTCPClient {
  private host: string
  private port: number
  private socket: net.Socket | null = null
  private messageId = 0
  private responseBuffer = ''
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void
    reject: (error: any) => void
    timeout: NodeJS.Timeout
  }>()

  constructor(host: string, port: number = 5321) {
    this.host = host
    this.port = port
  }

  /**
   * Connect to Atlas device
   */
  async connect(timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy()
        }
        reject(new Error(`Connection timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      this.socket = new net.Socket()
      
      this.socket.on('data', (data) => {
        this.handleData(data)
      })

      this.socket.on('error', (err) => {
        console.error('[Atlas TCP] Socket error:', err)
        this.rejectAllPending(err)
      })

      this.socket.on('close', () => {
        console.log('[Atlas TCP] Connection closed')
        this.socket = null
      })

      this.socket.connect(this.port, this.host, () => {
        clearTimeout(timeoutHandle)
        console.log(`[Atlas TCP] Connected to ${this.host}:${this.port}`)
        resolve()
      })

      this.socket.on('error', (err) => {
        clearTimeout(timeoutHandle)
        reject(err)
      })
    })
  }

  /**
   * Disconnect from Atlas device
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this.rejectAllPending(new Error('Connection closed'))
  }

  /**
   * Handle incoming data from Atlas device
   */
  private handleData(data: Buffer): void {
    this.responseBuffer += data.toString()
    
    // Process complete messages (newline delimited)
    const messages = this.responseBuffer.split('\n')
    this.responseBuffer = messages.pop() || ''
    
    for (const message of messages) {
      if (message.trim()) {
        try {
          const response: AtlasResponse = JSON.parse(message)
          this.handleResponse(response)
        } catch (err) {
          console.error('[Atlas TCP] Failed to parse response:', message, err)
        }
      }
    }
  }

  /**
   * Handle parsed response from Atlas device
   */
  private handleResponse(response: AtlasResponse): void {
    console.log('[Atlas TCP] Received response:', JSON.stringify(response))
    
    if (response.id !== undefined) {
      const pending = this.pendingRequests.get(response.id)
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(response.id)
        
        if (response.error) {
          pending.reject(new Error(`Atlas error: ${response.error.message}`))
        } else {
          pending.resolve(response.result)
        }
      }
    }
  }

  /**
   * Send a message to Atlas device and wait for response
   */
  private async sendMessage(message: AtlasMessage, timeoutMs: number = 5000): Promise<any> {
    if (!this.socket) {
      throw new Error('Not connected to Atlas device')
    }

    const id = ++this.messageId
    message.id = id

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      // Format message with newline delimiter
      const messageStr = JSON.stringify(message) + '\r\n'
      console.log('[Atlas TCP] Sending message:', messageStr.trim())
      
      this.socket!.write(messageStr, (err) => {
        if (err) {
          clearTimeout(timeout)
          this.pendingRequests.delete(id)
          reject(err)
        }
      })
    })
  }

  /**
   * Get parameter value from Atlas device
   */
  async getParameter(param: string, format: 'val' | 'pct' | 'str' = 'val'): Promise<any> {
    const message: AtlasMessage = {
      jsonrpc: '2.0',
      method: 'get',
      params: { param, fmt: format }
    }
    const result = await this.sendMessage(message)
    
    // Extract value from JSON-RPC result array
    // Response format: [{"param":"SourceName_0","str":"Matrix 1"}]
    if (Array.isArray(result) && result.length > 0) {
      const paramData = result[0]
      if (format === 'str' && paramData.str !== undefined) {
        return paramData.str
      } else if (format === 'val' && paramData.val !== undefined) {
        return paramData.val
      } else if (format === 'pct' && paramData.pct !== undefined) {
        return paramData.pct
      }
    }
    
    return result
  }

  /**
   * Set parameter value on Atlas device
   */
  async setParameter(param: string, value: number | string, format: 'val' | 'pct' | 'str' = 'val'): Promise<void> {
    const params: any = { param }
    params[format] = value
    
    const message: AtlasMessage = {
      jsonrpc: '2.0',
      method: 'set',
      params
    }
    await this.sendMessage(message)
  }

  /**
   * Get all Source parameters (names, gains, mutes)
   */
  async getAllSources(sourceCount: number): Promise<Array<{ name: string; gain: number; mute: boolean }>> {
    console.log(`[Atlas TCP] Fetching ${sourceCount} sources...`)
    const sources = []
    
    for (let i = 0; i < sourceCount; i++) {
      try {
        const [name, gain, mute] = await Promise.all([
          this.getParameter(`SourceName_${i}`, 'str').catch(() => `Source ${i + 1}`),
          this.getParameter(`SourceGain_${i}`, 'val').catch(() => -40),
          this.getParameter(`SourceMute_${i}`, 'val').catch(() => 0)
        ])
        
        sources.push({
          name: name || `Source ${i + 1}`,
          gain: typeof gain === 'number' ? gain : -40,
          mute: mute === 1
        })
        
        console.log(`[Atlas TCP] Source ${i}: ${sources[i].name}, gain=${sources[i].gain}, mute=${sources[i].mute}`)
      } catch (err) {
        console.error(`[Atlas TCP] Failed to fetch source ${i}:`, err)
        sources.push({ name: `Source ${i + 1}`, gain: -40, mute: false })
      }
    }
    
    return sources
  }

  /**
   * Get all Zone/Output parameters
   */
  async getAllZones(zoneCount: number): Promise<Array<{ name: string; gain: number; mute: boolean; source: number }>> {
    console.log(`[Atlas TCP] Fetching ${zoneCount} zones...`)
    const zones = []
    
    for (let i = 0; i < zoneCount; i++) {
      try {
        const [name, gain, mute, source] = await Promise.all([
          this.getParameter(`ZoneName_${i}`, 'str').catch(() => `Zone ${i + 1}`),
          this.getParameter(`ZoneGain_${i}`, 'val').catch(() => -40),
          this.getParameter(`ZoneMute_${i}`, 'val').catch(() => 0),
          this.getParameter(`ZoneSource_${i}`, 'val').catch(() => -1)
        ])
        
        zones.push({
          name: name || `Zone ${i + 1}`,
          gain: typeof gain === 'number' ? gain : -40,
          mute: mute === 1,
          source: typeof source === 'number' ? source : -1
        })
        
        console.log(`[Atlas TCP] Zone ${i}: ${zones[i].name}, gain=${zones[i].gain}, mute=${zones[i].mute}, source=${zones[i].source}`)
      } catch (err) {
        console.error(`[Atlas TCP] Failed to fetch zone ${i}:`, err)
        zones.push({ name: `Zone ${i + 1}`, gain: -40, mute: false, source: -1 })
      }
    }
    
    return zones
  }

  /**
   * Get all Scene names
   */
  async getAllScenes(sceneCount: number): Promise<Array<{ name: string }>> {
    console.log(`[Atlas TCP] Fetching ${sceneCount} scenes...`)
    const scenes = []
    
    for (let i = 0; i < sceneCount; i++) {
      try {
        const name = await this.getParameter(`SceneName_${i}`, 'str').catch(() => `Scene ${i + 1}`)
        scenes.push({ name: name || `Scene ${i + 1}` })
        console.log(`[Atlas TCP] Scene ${i}: ${scenes[i].name}`)
      } catch (err) {
        console.error(`[Atlas TCP] Failed to fetch scene ${i}:`, err)
        scenes.push({ name: `Scene ${i + 1}` })
      }
    }
    
    return scenes
  }

  /**
   * Download full configuration from Atlas device
   */
  async downloadConfiguration(inputCount: number = 8, outputCount: number = 8, sceneCount: number = 3): Promise<AtlasConfig> {
    console.log('[Atlas TCP] Starting configuration download...')
    console.log(`[Atlas TCP] Parameters: inputs=${inputCount}, outputs=${outputCount}, scenes=${sceneCount}`)
    
    try {
      // Fetch all configuration parameters
      const [inputs, outputs, scenes] = await Promise.all([
        this.getAllSources(inputCount),
        this.getAllZones(outputCount),
        this.getAllScenes(sceneCount)
      ])
      
      const config: AtlasConfig = {
        inputs,
        outputs,
        scenes,
        messages: []
      }
      
      console.log('[Atlas TCP] Configuration download complete!')
      console.log(`[Atlas TCP] Downloaded: ${inputs.length} inputs, ${outputs.length} outputs, ${scenes.length} scenes`)
      
      return config
    } catch (err) {
      console.error('[Atlas TCP] Configuration download failed:', err)
      throw err
    }
  }

  /**
   * Upload configuration to Atlas device
   */
  async uploadConfiguration(config: AtlasConfig): Promise<void> {
    console.log('[Atlas TCP] Starting configuration upload...')
    
    try {
      // Upload all inputs
      if (config.inputs) {
        console.log(`[Atlas TCP] Uploading ${config.inputs.length} inputs...`)
        for (let i = 0; i < config.inputs.length; i++) {
          const input = config.inputs[i]
          try {
            // Note: Input names are read-only, can only set gain and mute
            if (input.gain !== undefined) {
              await this.setParameter(`SourceGain_${i}`, input.gain, 'val')
              console.log(`[Atlas TCP] Set SourceGain_${i} = ${input.gain}`)
            }
            if (input.mute !== undefined) {
              await this.setParameter(`SourceMute_${i}`, input.mute ? 1 : 0, 'val')
              console.log(`[Atlas TCP] Set SourceMute_${i} = ${input.mute ? 1 : 0}`)
            }
          } catch (err) {
            console.error(`[Atlas TCP] Failed to upload input ${i}:`, err)
          }
        }
      }
      
      // Upload all outputs
      if (config.outputs) {
        console.log(`[Atlas TCP] Uploading ${config.outputs.length} outputs...`)
        for (let i = 0; i < config.outputs.length; i++) {
          const output = config.outputs[i]
          try {
            // Note: Zone names are read-only, can only set gain, mute, and source
            if (output.gain !== undefined) {
              await this.setParameter(`ZoneGain_${i}`, output.gain, 'val')
              console.log(`[Atlas TCP] Set ZoneGain_${i} = ${output.gain}`)
            }
            if (output.mute !== undefined) {
              await this.setParameter(`ZoneMute_${i}`, output.mute ? 1 : 0, 'val')
              console.log(`[Atlas TCP] Set ZoneMute_${i} = ${output.mute ? 1 : 0}`)
            }
            if (output.source !== undefined) {
              await this.setParameter(`ZoneSource_${i}`, output.source, 'val')
              console.log(`[Atlas TCP] Set ZoneSource_${i} = ${output.source}`)
            }
          } catch (err) {
            console.error(`[Atlas TCP] Failed to upload output ${i}:`, err)
          }
        }
      }
      
      console.log('[Atlas TCP] Configuration upload complete!')
    } catch (err) {
      console.error('[Atlas TCP] Configuration upload failed:', err)
      throw err
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }
}

/**
 * Helper function to connect and execute operations
 */
export async function withAtlasConnection<T>(
  host: string,
  port: number,
  operation: (client: AtlasTCPClient) => Promise<T>
): Promise<T> {
  const client = new AtlasTCPClient(host, port)
  try {
    await client.connect()
    return await operation(client)
  } finally {
    client.disconnect()
  }
}
