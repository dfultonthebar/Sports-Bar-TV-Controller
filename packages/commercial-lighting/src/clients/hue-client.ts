/**
 * Philips Hue Client
 * REST API v2 control for Philips Hue bridges
 *
 * API Reference: https://developers.meethue.com/
 */

import { EventEmitter } from 'events'
import https from 'https'
import { HUE_CONFIG } from '../config'
import { lightingLogger } from '../commercial-lighting-logger'

export interface HueClientConfig {
  bridgeIp: string
  applicationKey?: string
  port?: number
}

export interface HueBridge {
  id: string
  internalipaddress: string
  name?: string
}

export interface HueLight {
  id: string
  id_v1?: string
  owner: { rid: string; rtype: string }
  metadata: { name: string; archetype: string }
  on: { on: boolean }
  dimming?: { brightness: number; min_dim_level?: number }
  color_temperature?: { mirek: number; mirek_valid: boolean }
  color?: { xy: { x: number; y: number }; gamut_type: string }
  dynamics?: { status: string; speed: number }
  type: string
  // Convenience properties (populated by client)
  name?: string
  capabilities?: string[]
}

export interface HueRoom {
  id: string
  id_v1?: string
  metadata: { name: string; archetype: string }
  children: Array<{ rid: string; rtype: string }>
  services: Array<{ rid: string; rtype: string }>
  type: string
  // Convenience properties (populated by client)
  name?: string
  lights?: string[]
}

export interface HueScene {
  id: string
  id_v1?: string
  metadata: { name: string; image?: { rid: string; rtype: string } }
  group: { rid: string; rtype: string }
  actions: Array<{
    target: { rid: string; rtype: string }
    action: {
      on?: { on: boolean }
      dimming?: { brightness: number }
      color_temperature?: { mirek: number }
      color?: { xy: { x: number; y: number } }
    }
  }>
  palette?: {
    color: Array<{ color: { xy: { x: number; y: number } }; dimming: { brightness: number } }>
    dimming: Array<{ brightness: number }>
    color_temperature: Array<{ color_temperature: { mirek: number }; dimming: { brightness: number } }>
  }
  speed: number
  auto_dynamic: boolean
  status: { active: string }
  type: string
  // Convenience property (populated by client)
  name?: string
}

export interface HueLightState {
  on?: boolean
  brightness?: number
  colorTemperature?: number // mirek (153-500)
  color?: { x: number; y: number }
  transitionTime?: number // ms
}

export interface HueClientStatus {
  connected: boolean
  bridgeIp: string
  hasApplicationKey: boolean
  lastActivity: Date | null
}

/**
 * Philips Hue Client
 * Handles REST API v2 communication with Hue bridges
 */
export class HueClient extends EventEmitter {
  private config: Required<HueClientConfig>
  private connected: boolean = false
  private lastActivity: Date | null = null
  private httpsAgent: https.Agent

  constructor(config: HueClientConfig) {
    super()

    this.config = {
      bridgeIp: config.bridgeIp,
      applicationKey: config.applicationKey ?? '',
      port: config.port ?? HUE_CONFIG.PORT,
    }

    // Create HTTPS agent that ignores self-signed certificates (Hue bridge uses self-signed)
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    })
  }

  /**
   * Discover Hue bridges on the network
   */
  static async discoverBridges(): Promise<HueBridge[]> {
    try {
      // Use Philips discovery service
      const response = await fetch(HUE_CONFIG.DISCOVERY_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.status}`)
      }

      const bridges = await response.json() as HueBridge[]
      lightingLogger.discovery('Hue', bridges.length, { bridges })
      return bridges
    } catch (error) {
      lightingLogger.error('Hue bridge discovery failed', error)
      return []
    }
  }

  /**
   * Pair with a Hue bridge (user must press the button)
   * Returns the application key on success
   */
  async pairWithBridge(): Promise<string> {
    lightingLogger.pairing('Hue', 'started', { bridgeIp: this.config.bridgeIp })

    const startTime = Date.now()
    const pollInterval = HUE_CONFIG.PAIR_POLL_INTERVAL_MS

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await this.makeRequest<{ success?: { username: string }; error?: { type: number; description: string } }[]>(
            'POST',
            '/api',
            {
              devicetype: `${HUE_CONFIG.APP_NAME}#${HUE_CONFIG.DEVICE_TYPE}`,
              generateclientkey: true,
            },
            false // Don't require auth for pairing
          )

          if (response[0]?.success?.username) {
            const applicationKey = response[0].success.username
            this.config.applicationKey = applicationKey
            this.connected = true
            lightingLogger.pairing('Hue', 'success', { bridgeIp: this.config.bridgeIp })
            this.emit('paired', applicationKey)
            resolve(applicationKey)
            return
          }

          if (response[0]?.error?.type === 101) {
            // Link button not pressed - keep waiting
            lightingLogger.pairing('Hue', 'waiting')

            if (Date.now() - startTime < HUE_CONFIG.PAIR_TIMEOUT_MS) {
              setTimeout(poll, pollInterval)
            } else {
              lightingLogger.pairing('Hue', 'failed', { reason: 'timeout' })
              reject(new Error('Pairing timeout - bridge button not pressed'))
            }
          } else if (response[0]?.error) {
            lightingLogger.pairing('Hue', 'failed', { error: response[0].error })
            reject(new Error(response[0].error.description))
          }
        } catch (error) {
          lightingLogger.pairing('Hue', 'failed', { error })
          reject(error)
        }
      }

      poll()
    })
  }

  /**
   * Test connection to the bridge
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getBridgeInfo()
      this.connected = true
      this.emit('connected')
      lightingLogger.connection(this.config.bridgeIp, 'Hue', 'connected')
      return true
    } catch (error) {
      this.connected = false
      lightingLogger.connection(this.config.bridgeIp, 'Hue', 'error', { error })
      return false
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && !!this.config.applicationKey
  }

  /**
   * Get client status
   */
  getStatus(): HueClientStatus {
    return {
      connected: this.isConnected(),
      bridgeIp: this.config.bridgeIp,
      hasApplicationKey: !!this.config.applicationKey,
      lastActivity: this.lastActivity,
    }
  }

  /**
   * Get bridge information
   */
  async getBridgeInfo(): Promise<Record<string, unknown>> {
    const response = await this.makeRequest<{ data: Array<Record<string, unknown>> }>(
      'GET',
      `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.BRIDGE}`
    )
    return response.data[0] || {}
  }

  /**
   * Get all lights
   */
  async getLights(): Promise<HueLight[]> {
    const response = await this.makeRequest<{ data: HueLight[] }>(
      'GET',
      `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.LIGHT}`
    )
    return response.data || []
  }

  /**
   * Get a specific light
   */
  async getLight(lightId: string): Promise<HueLight | null> {
    try {
      const response = await this.makeRequest<{ data: HueLight[] }>(
        'GET',
        `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.LIGHT}/${lightId}`
      )
      return response.data[0] || null
    } catch {
      return null
    }
  }

  /**
   * Set light state
   */
  async setLightState(lightId: string, state: HueLightState): Promise<boolean> {
    const body: Record<string, unknown> = {}

    if (state.on !== undefined) {
      body.on = { on: state.on }
    }

    if (state.brightness !== undefined) {
      body.dimming = { brightness: Math.min(100, Math.max(0, state.brightness)) }
    }

    if (state.colorTemperature !== undefined) {
      body.color_temperature = { mirek: Math.min(500, Math.max(153, state.colorTemperature)) }
    }

    if (state.color !== undefined) {
      body.color = { xy: { x: state.color.x, y: state.color.y } }
    }

    if (state.transitionTime !== undefined) {
      body.dynamics = { duration: state.transitionTime }
    }

    try {
      await this.makeRequest(
        'PUT',
        `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.LIGHT}/${lightId}`,
        body
      )

      lightingLogger.deviceControl('Hue', lightId, 'state set', true, state as Record<string, unknown>)
      this.emit('lightStateChanged', { lightId, state })
      return true
    } catch (error) {
      lightingLogger.deviceControl('Hue', lightId, 'state set', false, { error })
      return false
    }
  }

  /**
   * Get all rooms
   */
  async getRooms(): Promise<HueRoom[]> {
    const response = await this.makeRequest<{ data: HueRoom[] }>(
      'GET',
      `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.ROOM}`
    )
    return response.data || []
  }

  /**
   * Get all zones
   */
  async getZones(): Promise<HueRoom[]> {
    const response = await this.makeRequest<{ data: HueRoom[] }>(
      'GET',
      `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.ZONE}`
    )
    return response.data || []
  }

  /**
   * Set room/zone group state
   */
  async setGroupState(groupId: string, state: HueLightState): Promise<boolean> {
    const body: Record<string, unknown> = {}

    if (state.on !== undefined) {
      body.on = { on: state.on }
    }

    if (state.brightness !== undefined) {
      body.dimming = { brightness: Math.min(100, Math.max(0, state.brightness)) }
    }

    if (state.colorTemperature !== undefined) {
      body.color_temperature = { mirek: Math.min(500, Math.max(153, state.colorTemperature)) }
    }

    if (state.color !== undefined) {
      body.color = { xy: { x: state.color.x, y: state.color.y } }
    }

    try {
      await this.makeRequest(
        'PUT',
        `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.GROUPED_LIGHT}/${groupId}`,
        body
      )

      lightingLogger.zoneControl('Hue', groupId, state.brightness ?? (state.on ? 100 : 0), true)
      this.emit('groupStateChanged', { groupId, state })
      return true
    } catch (error) {
      lightingLogger.zoneControl('Hue', groupId, state.brightness ?? 0, false)
      return false
    }
  }

  /**
   * Get all scenes
   */
  async getScenes(): Promise<HueScene[]> {
    const response = await this.makeRequest<{ data: HueScene[] }>(
      'GET',
      `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.SCENE}`
    )
    return response.data || []
  }

  /**
   * Recall a scene
   */
  async recallScene(sceneId: string): Promise<boolean> {
    try {
      await this.makeRequest(
        'PUT',
        `${HUE_CONFIG.API_RESOURCE}/${HUE_CONFIG.RESOURCE.SCENE}/${sceneId}`,
        { recall: { action: 'active' } }
      )

      lightingLogger.sceneRecall('Hue', sceneId, true)
      this.emit('sceneRecalled', { sceneId })
      return true
    } catch (error) {
      lightingLogger.sceneRecall('Hue', sceneId, false, { error })
      return false
    }
  }

  /**
   * Turn all lights on
   */
  async allOn(): Promise<boolean> {
    try {
      const rooms = await this.getRooms()
      const results = await Promise.all(
        rooms.map(room => {
          const groupedLight = room.services.find(s => s.rtype === 'grouped_light')
          if (groupedLight) {
            return this.setGroupState(groupedLight.rid, { on: true })
          }
          return Promise.resolve(true)
        })
      )
      return results.every(r => r)
    } catch (error) {
      lightingLogger.error('Failed to turn all lights on', error)
      return false
    }
  }

  /**
   * Turn all lights off
   */
  async allOff(): Promise<boolean> {
    try {
      const rooms = await this.getRooms()
      const results = await Promise.all(
        rooms.map(room => {
          const groupedLight = room.services.find(s => s.rtype === 'grouped_light')
          if (groupedLight) {
            return this.setGroupState(groupedLight.rid, { on: false })
          }
          return Promise.resolve(true)
        })
      )
      return results.every(r => r)
    } catch (error) {
      lightingLogger.error('Failed to turn all lights off', error)
      return false
    }
  }

  // Private methods

  private async makeRequest<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
    requireAuth: boolean = true
  ): Promise<T> {
    const url = `https://${this.config.bridgeIp}${path}`

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }

    if (requireAuth && this.config.applicationKey) {
      headers['hue-application-key'] = this.config.applicationKey
    }

    const options: RequestInit = {
      method,
      headers,
      // @ts-expect-error - Node.js fetch supports agent
      agent: this.httpsAgent,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      this.lastActivity = new Date()

      if (!response.ok) {
        const errorText = await response.text()
        lightingLogger.hueApi(method, path, false, { status: response.status, error: errorText })
        throw new Error(`Hue API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json() as T
      lightingLogger.hueApi(method, path, true)
      return data
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Hue API error')) {
        throw error
      }
      lightingLogger.hueApi(method, path, false, { error })
      throw error
    }
  }
}

export default HueClient
