/**
 * Commercial Lighting Connection Manager
 * Singleton manager for multiple lighting systems (Lutron, Hue, etc.)
 */

import { EventEmitter } from 'events'
import { LutronLIPClient, LutronLIPConfig, LutronDevice } from './clients/lutron-lip-client'
import { HueClient, HueClientConfig, HueBridge, HueLight, HueRoom, HueScene, HueLightState } from './clients/hue-client'
import { LightingSystemType, LIGHTING_SYSTEM_TYPES } from './config'
import { lightingLogger } from './commercial-lighting-logger'

export interface LightingSystemConfig {
  id: string
  name: string
  systemType: LightingSystemType
  ipAddress: string
  port?: number
  username?: string
  password?: string
  applicationKey?: string
  certificate?: string
}

export interface RegisteredSystem {
  id: string
  name: string
  systemType: LightingSystemType
  config: LightingSystemConfig
  client: LutronLIPClient | HueClient
  connected: boolean
  lastActivity: Date | null
  refCount: number
}

export interface LightingManagerStatus {
  systemCount: number
  connectedCount: number
  systems: Array<{
    id: string
    name: string
    systemType: LightingSystemType
    connected: boolean
    lastActivity: Date | null
  }>
}

/**
 * Commercial Lighting Connection Manager
 * Manages connections to multiple lighting systems
 */
class CommercialLightingManagerClass extends EventEmitter {
  private systems: Map<string, RegisteredSystem> = new Map()
  private static instance: CommercialLightingManagerClass | null = null

  private constructor() {
    super()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CommercialLightingManagerClass {
    if (!CommercialLightingManagerClass.instance) {
      CommercialLightingManagerClass.instance = new CommercialLightingManagerClass()
    }
    return CommercialLightingManagerClass.instance
  }

  /**
   * Register a Lutron system (RadioRA 2, HomeWorks QS)
   */
  async registerLutronSystem(config: LightingSystemConfig): Promise<string> {
    // Check if already registered
    if (this.systems.has(config.id)) {
      const existing = this.systems.get(config.id)!
      existing.refCount++
      lightingLogger.info('Lutron system already registered, incrementing refCount', {
        id: config.id,
        refCount: existing.refCount,
      })
      return config.id
    }

    const clientConfig: LutronLIPConfig = {
      host: config.ipAddress,
      port: config.port,
      username: config.username,
      password: config.password,
    }

    const client = new LutronLIPClient(clientConfig)

    // Set up event handlers
    client.on('connected', () => {
      const system = this.systems.get(config.id)
      if (system) {
        system.connected = true
        system.lastActivity = new Date()
      }
      this.emit('systemConnected', { id: config.id, type: config.systemType })
    })

    client.on('disconnected', () => {
      const system = this.systems.get(config.id)
      if (system) {
        system.connected = false
      }
      this.emit('systemDisconnected', { id: config.id, type: config.systemType })
    })

    client.on('outputChanged', (data) => {
      this.emit('deviceStateChanged', { systemId: config.id, ...data })
    })

    client.on('event', (event) => {
      this.emit('lutronEvent', { systemId: config.id, event })
    })

    const system: RegisteredSystem = {
      id: config.id,
      name: config.name,
      systemType: config.systemType,
      config,
      client,
      connected: false,
      lastActivity: null,
      refCount: 1,
    }

    this.systems.set(config.id, system)

    lightingLogger.info('Registered Lutron system', {
      id: config.id,
      name: config.name,
      type: config.systemType,
      host: config.ipAddress,
    })

    return config.id
  }

  /**
   * Register a Philips Hue system
   */
  async registerHueSystem(config: LightingSystemConfig): Promise<string> {
    // Check if already registered
    if (this.systems.has(config.id)) {
      const existing = this.systems.get(config.id)!
      existing.refCount++
      lightingLogger.info('Hue system already registered, incrementing refCount', {
        id: config.id,
        refCount: existing.refCount,
      })
      return config.id
    }

    const clientConfig: HueClientConfig = {
      bridgeIp: config.ipAddress,
      applicationKey: config.applicationKey,
      port: config.port,
    }

    const client = new HueClient(clientConfig)

    // Set up event handlers
    client.on('connected', () => {
      const system = this.systems.get(config.id)
      if (system) {
        system.connected = true
        system.lastActivity = new Date()
      }
      this.emit('systemConnected', { id: config.id, type: config.systemType })
    })

    client.on('lightStateChanged', (data) => {
      this.emit('deviceStateChanged', { systemId: config.id, ...data })
    })

    client.on('sceneRecalled', (data) => {
      this.emit('sceneRecalled', { systemId: config.id, ...data })
    })

    client.on('paired', (applicationKey) => {
      this.emit('huePaired', { systemId: config.id, applicationKey })
    })

    const system: RegisteredSystem = {
      id: config.id,
      name: config.name,
      systemType: config.systemType,
      config,
      client,
      connected: false,
      lastActivity: null,
      refCount: 1,
    }

    this.systems.set(config.id, system)

    lightingLogger.info('Registered Hue system', {
      id: config.id,
      name: config.name,
      bridgeIp: config.ipAddress,
    })

    return config.id
  }

  /**
   * Unregister a system
   */
  unregisterSystem(systemId: string): void {
    const system = this.systems.get(systemId)
    if (!system) return

    system.refCount--

    if (system.refCount <= 0) {
      // Disconnect client
      if (system.client instanceof LutronLIPClient) {
        system.client.disconnect()
      }
      // HueClient doesn't have persistent connection

      this.systems.delete(systemId)

      lightingLogger.info('Unregistered lighting system', {
        id: systemId,
        type: system.systemType,
      })
    } else {
      lightingLogger.info('Decremented system refCount', {
        id: systemId,
        refCount: system.refCount,
      })
    }
  }

  /**
   * Connect to a system
   */
  async connectSystem(systemId: string): Promise<boolean> {
    const system = this.systems.get(systemId)
    if (!system) {
      lightingLogger.error('System not found', undefined, { systemId })
      return false
    }

    try {
      if (system.client instanceof LutronLIPClient) {
        await system.client.connect()
      } else if (system.client instanceof HueClient) {
        await system.client.testConnection()
      }

      system.connected = true
      system.lastActivity = new Date()

      lightingLogger.connection(systemId, system.systemType, 'connected')
      return true
    } catch (error) {
      lightingLogger.connection(systemId, system.systemType, 'error', { error })
      return false
    }
  }

  /**
   * Disconnect from a system
   */
  disconnectSystem(systemId: string): void {
    const system = this.systems.get(systemId)
    if (!system) return

    if (system.client instanceof LutronLIPClient) {
      system.client.disconnect()
    }

    system.connected = false
    lightingLogger.connection(systemId, system.systemType, 'disconnected')
  }

  /**
   * Get a registered system
   */
  getSystem(systemId: string): RegisteredSystem | undefined {
    return this.systems.get(systemId)
  }

  /**
   * Get all registered systems
   */
  getAllSystems(): RegisteredSystem[] {
    return Array.from(this.systems.values())
  }

  /**
   * Get manager status
   */
  getStatus(): LightingManagerStatus {
    const systems = Array.from(this.systems.values())
    return {
      systemCount: systems.length,
      connectedCount: systems.filter(s => s.connected).length,
      systems: systems.map(s => ({
        id: s.id,
        name: s.name,
        systemType: s.systemType,
        connected: s.connected,
        lastActivity: s.lastActivity,
      })),
    }
  }

  // Unified Control Interface

  /**
   * Set zone/room level (works across system types)
   */
  async setZoneLevel(
    systemId: string,
    zoneId: string | number,
    level: number,
    fadeTime?: number
  ): Promise<boolean> {
    const system = this.systems.get(systemId)
    if (!system || !system.connected) {
      lightingLogger.error('System not found or not connected', undefined, { systemId })
      return false
    }

    try {
      if (system.client instanceof LutronLIPClient) {
        // For Lutron, zoneId is the integration ID
        const integrationId = typeof zoneId === 'number' ? zoneId : parseInt(zoneId, 10)
        return await system.client.setOutputLevel(integrationId, level, fadeTime)
      } else if (system.client instanceof HueClient) {
        // For Hue, zoneId is the grouped_light resource ID
        return await system.client.setGroupState(String(zoneId), {
          on: level > 0,
          brightness: level,
          transitionTime: fadeTime ? fadeTime * 1000 : undefined,
        })
      }

      return false
    } catch (error) {
      lightingLogger.error('Failed to set zone level', error, { systemId, zoneId, level })
      return false
    }
  }

  /**
   * Set device state (works across system types)
   */
  async setDeviceState(
    systemId: string,
    deviceId: string | number,
    state: HueLightState & { level?: number }
  ): Promise<boolean> {
    const system = this.systems.get(systemId)
    if (!system || !system.connected) {
      lightingLogger.error('System not found or not connected', undefined, { systemId })
      return false
    }

    try {
      if (system.client instanceof LutronLIPClient) {
        // For Lutron, only level control is supported via LIP
        const integrationId = typeof deviceId === 'number' ? deviceId : parseInt(deviceId, 10)
        const level = state.level ?? (state.brightness ?? (state.on ? 100 : 0))
        return await system.client.setOutputLevel(integrationId, level)
      } else if (system.client instanceof HueClient) {
        return await system.client.setLightState(String(deviceId), state)
      }

      return false
    } catch (error) {
      lightingLogger.error('Failed to set device state', error, { systemId, deviceId, state })
      return false
    }
  }

  /**
   * Recall a scene (works across system types)
   */
  async recallScene(
    systemId: string,
    sceneId: string | number,
    sceneButtonId?: number // For Lutron button-based scenes
  ): Promise<boolean> {
    const system = this.systems.get(systemId)
    if (!system || !system.connected) {
      lightingLogger.error('System not found or not connected', undefined, { systemId })
      return false
    }

    try {
      if (system.client instanceof LutronLIPClient) {
        // For Lutron, scene is recalled by pressing a keypad button
        const deviceId = typeof sceneId === 'number' ? sceneId : parseInt(sceneId, 10)
        const buttonId = sceneButtonId ?? 1
        return await system.client.recallScene(deviceId, buttonId)
      } else if (system.client instanceof HueClient) {
        return await system.client.recallScene(String(sceneId))
      }

      return false
    } catch (error) {
      lightingLogger.error('Failed to recall scene', error, { systemId, sceneId })
      return false
    }
  }

  /**
   * All lights on (works across system types)
   */
  async allOn(systemId: string): Promise<boolean> {
    const system = this.systems.get(systemId)
    if (!system || !system.connected) {
      lightingLogger.error('System not found or not connected', undefined, { systemId })
      return false
    }

    try {
      if (system.client instanceof LutronLIPClient) {
        // For Lutron, would need to iterate registered devices
        const devices = system.client.getDevices()
        const results = await Promise.all(
          devices
            .filter(d => d.deviceType === 'dimmer' || d.deviceType === 'switch')
            .map(d => system.client instanceof LutronLIPClient
              ? (system.client as LutronLIPClient).setOutputLevel(d.integrationId, 100)
              : Promise.resolve(false)
            )
        )
        return results.every(r => r)
      } else if (system.client instanceof HueClient) {
        return await system.client.allOn()
      }

      return false
    } catch (error) {
      lightingLogger.error('Failed to turn all on', error, { systemId })
      return false
    }
  }

  /**
   * All lights off (works across system types)
   */
  async allOff(systemId: string): Promise<boolean> {
    const system = this.systems.get(systemId)
    if (!system || !system.connected) {
      lightingLogger.error('System not found or not connected', undefined, { systemId })
      return false
    }

    try {
      if (system.client instanceof LutronLIPClient) {
        // For Lutron, would need to iterate registered devices
        const devices = system.client.getDevices()
        const results = await Promise.all(
          devices
            .filter(d => d.deviceType === 'dimmer' || d.deviceType === 'switch')
            .map(d => system.client instanceof LutronLIPClient
              ? (system.client as LutronLIPClient).setOutputLevel(d.integrationId, 0)
              : Promise.resolve(false)
            )
        )
        return results.every(r => r)
      } else if (system.client instanceof HueClient) {
        return await system.client.allOff()
      }

      return false
    } catch (error) {
      lightingLogger.error('Failed to turn all off', error, { systemId })
      return false
    }
  }

  // Discovery Methods

  /**
   * Discover Hue bridges on the network
   */
  async discoverHueBridges(): Promise<HueBridge[]> {
    return HueClient.discoverBridges()
  }

  /**
   * Start Hue bridge pairing (user must press button)
   */
  async startHuePairing(systemId: string): Promise<string> {
    const system = this.systems.get(systemId)
    if (!system || !(system.client instanceof HueClient)) {
      throw new Error('System not found or not a Hue system')
    }

    return system.client.pairWithBridge()
  }

  // System-Specific Methods

  /**
   * Get Lutron client for system-specific operations
   */
  getLutronClient(systemId: string): LutronLIPClient | null {
    const system = this.systems.get(systemId)
    if (system?.client instanceof LutronLIPClient) {
      return system.client
    }
    return null
  }

  /**
   * Get Hue client for system-specific operations
   */
  getHueClient(systemId: string): HueClient | null {
    const system = this.systems.get(systemId)
    if (system?.client instanceof HueClient) {
      return system.client
    }
    return null
  }

  /**
   * Register Lutron device for tracking
   */
  registerLutronDevice(systemId: string, device: LutronDevice): void {
    const client = this.getLutronClient(systemId)
    if (client) {
      client.registerDevice(device)
    }
  }

  /**
   * Get Lutron devices
   */
  getLutronDevices(systemId: string): LutronDevice[] {
    const client = this.getLutronClient(systemId)
    return client ? client.getDevices() : []
  }

  /**
   * Get Hue lights
   */
  async getHueLights(systemId: string): Promise<HueLight[]> {
    const client = this.getHueClient(systemId)
    return client ? client.getLights() : []
  }

  /**
   * Get Hue rooms
   */
  async getHueRooms(systemId: string): Promise<HueRoom[]> {
    const client = this.getHueClient(systemId)
    return client ? client.getRooms() : []
  }

  /**
   * Get Hue scenes
   */
  async getHueScenes(systemId: string): Promise<HueScene[]> {
    const client = this.getHueClient(systemId)
    return client ? client.getScenes() : []
  }
}

// Export singleton instance
export const commercialLightingManager = CommercialLightingManagerClass.getInstance()

export default commercialLightingManager
