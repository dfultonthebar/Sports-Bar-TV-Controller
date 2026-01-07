/**
 * DMX Connection Manager
 * Singleton registry for managing multiple DMX adapters
 * Routes universe data to the correct adapter based on universe assignment
 */

import { EventEmitter } from 'events'
import { USBDMXClient, USBDMXConfig } from './clients/usb-dmx-client'
import { ArtNetClient, ArtNetConfig } from './clients/artnet-client'
import { MaestroClient, MaestroConfig } from './clients/maestro-client'
import { DMX_CONFIG, USBAdapterModel, ArtNetAdapterModel } from './config'
import { dmxLogger } from './dmx-logger'

export type DMXClient = USBDMXClient | ArtNetClient | MaestroClient

export interface AdapterRegistration {
  id: string
  name: string
  type: 'usb' | 'artnet' | 'maestro'
  client: DMXClient
  universeStart: number
  universeCount: number
  config: USBDMXConfig | ArtNetConfig | MaestroConfig
  status: 'connected' | 'disconnected' | 'error'
  lastSeen: Date | null
  refCount: number
}

/**
 * DMX Connection Manager (Singleton)
 * Manages multiple DMX adapters and routes data to correct universe handlers
 */
class DMXConnectionManagerClass extends EventEmitter {
  private static instance: DMXConnectionManagerClass | null = null
  private adapters: Map<string, AdapterRegistration> = new Map()
  private universeToAdapter: Map<number, string> = new Map() // Universe -> Adapter ID mapping
  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor() {
    super()
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupIdleAdapters(), 60000)
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DMXConnectionManagerClass {
    if (!DMXConnectionManagerClass.instance) {
      DMXConnectionManagerClass.instance = new DMXConnectionManagerClass()
    }
    return DMXConnectionManagerClass.instance
  }

  /**
   * Register a USB DMX adapter
   */
  async registerUSBAdapter(
    id: string,
    name: string,
    config: USBDMXConfig,
    universeStart: number = 0,
    universeCount: number = 1
  ): Promise<AdapterRegistration> {
    if (this.adapters.has(id)) {
      const existing = this.adapters.get(id)!
      existing.refCount++
      return existing
    }

    const client = new USBDMXClient(config)

    const registration: AdapterRegistration = {
      id,
      name,
      type: 'usb',
      client,
      universeStart,
      universeCount,
      config,
      status: 'disconnected',
      lastSeen: null,
      refCount: 1,
    }

    // Set up event handlers
    client.on('connected', () => {
      registration.status = 'connected'
      registration.lastSeen = new Date()
      this.emit('adapterConnected', id)
    })

    client.on('disconnected', () => {
      registration.status = 'disconnected'
      this.emit('adapterDisconnected', id)
    })

    client.on('error', (error) => {
      registration.status = 'error'
      this.emit('adapterError', id, error)
    })

    // Register adapter
    this.adapters.set(id, registration)

    // Map universes to this adapter
    for (let i = 0; i < universeCount; i++) {
      this.universeToAdapter.set(universeStart + i, id)
    }

    dmxLogger.info('Registered USB DMX adapter', {
      id,
      name,
      serialPort: config.serialPort,
      universes: `${universeStart}-${universeStart + universeCount - 1}`,
    })

    // Connect
    try {
      await client.connect()
    } catch (error) {
      dmxLogger.error('Failed to connect USB adapter', error, { id })
      registration.status = 'error'
    }

    return registration
  }

  /**
   * Register an Art-Net adapter
   */
  async registerArtNetAdapter(
    id: string,
    name: string,
    config: ArtNetConfig,
    universeStart: number = 0,
    universeCount: number = 1
  ): Promise<AdapterRegistration> {
    if (this.adapters.has(id)) {
      const existing = this.adapters.get(id)!
      existing.refCount++
      return existing
    }

    const client = new ArtNetClient(config)

    const registration: AdapterRegistration = {
      id,
      name,
      type: 'artnet',
      client,
      universeStart,
      universeCount,
      config,
      status: 'disconnected',
      lastSeen: null,
      refCount: 1,
    }

    // Set up event handlers
    client.on('connected', () => {
      registration.status = 'connected'
      registration.lastSeen = new Date()
      this.emit('adapterConnected', id)
    })

    client.on('disconnected', () => {
      registration.status = 'disconnected'
      this.emit('adapterDisconnected', id)
    })

    client.on('error', (error) => {
      registration.status = 'error'
      this.emit('adapterError', id, error)
    })

    // Register adapter
    this.adapters.set(id, registration)

    // Map universes to this adapter
    for (let i = 0; i < universeCount; i++) {
      this.universeToAdapter.set(universeStart + i, id)
    }

    dmxLogger.info('Registered Art-Net adapter', {
      id,
      name,
      ipAddress: config.ipAddress,
      universes: `${universeStart}-${universeStart + universeCount - 1}`,
    })

    // Connect
    try {
      await client.connect()
    } catch (error) {
      dmxLogger.error('Failed to connect Art-Net adapter', error, { id })
      registration.status = 'error'
    }

    return registration
  }

  /**
   * Register a Maestro DMX adapter
   */
  async registerMaestroAdapter(
    id: string,
    name: string,
    config: MaestroConfig,
    universeStart: number = 0,
    universeCount: number = 2
  ): Promise<AdapterRegistration> {
    if (this.adapters.has(id)) {
      const existing = this.adapters.get(id)!
      existing.refCount++
      return existing
    }

    const client = new MaestroClient(config)

    const registration: AdapterRegistration = {
      id,
      name,
      type: 'maestro',
      client,
      universeStart,
      universeCount,
      config,
      status: 'disconnected',
      lastSeen: null,
      refCount: 1,
    }

    // Set up event handlers
    client.on('connected', () => {
      registration.status = 'connected'
      registration.lastSeen = new Date()
      this.emit('adapterConnected', id)
    })

    client.on('disconnected', () => {
      registration.status = 'disconnected'
      this.emit('adapterDisconnected', id)
    })

    client.on('error', (error) => {
      registration.status = 'error'
      this.emit('adapterError', id, error)
    })

    client.on('presetRecalled', (presetNumber) => {
      this.emit('maestroPresetRecalled', id, presetNumber)
    })

    client.on('functionTriggered', (functionNumber) => {
      this.emit('maestroFunctionTriggered', id, functionNumber)
    })

    // Register adapter
    this.adapters.set(id, registration)

    // Map universes to this adapter
    for (let i = 0; i < universeCount; i++) {
      this.universeToAdapter.set(universeStart + i, id)
    }

    dmxLogger.info('Registered Maestro adapter', {
      id,
      name,
      ipAddress: config.ipAddress,
      presets: (config as MaestroConfig).presetCount ?? 12,
      universes: `${universeStart}-${universeStart + universeCount - 1}`,
    })

    // Connect
    try {
      await client.connect()
    } catch (error) {
      dmxLogger.error('Failed to connect Maestro adapter', error, { id })
      registration.status = 'error'
    }

    return registration
  }

  /**
   * Get an adapter by ID
   */
  getAdapter(id: string): AdapterRegistration | undefined {
    return this.adapters.get(id)
  }

  /**
   * Get adapter for a specific universe
   */
  getAdapterForUniverse(universe: number): AdapterRegistration | undefined {
    const adapterId = this.universeToAdapter.get(universe)
    if (adapterId) {
      return this.adapters.get(adapterId)
    }
    return undefined
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): AdapterRegistration[] {
    return Array.from(this.adapters.values())
  }

  /**
   * Get all Maestro adapters (for preset/function access)
   */
  getMaestroAdapters(): AdapterRegistration[] {
    return Array.from(this.adapters.values()).filter(a => a.type === 'maestro')
  }

  /**
   * Set channel value on correct adapter
   */
  setChannel(universe: number, channel: number, value: number): void {
    const adapter = this.getAdapterForUniverse(universe)
    if (!adapter) {
      dmxLogger.warn('No adapter registered for universe', { universe })
      return
    }

    adapter.client.setChannel(channel, value, universe)
    adapter.lastSeen = new Date()
  }

  /**
   * Set multiple channels on correct adapter
   */
  setChannels(universe: number, startChannel: number, values: number[]): void {
    const adapter = this.getAdapterForUniverse(universe)
    if (!adapter) {
      dmxLogger.warn('No adapter registered for universe', { universe })
      return
    }

    adapter.client.setChannels(startChannel, values, universe)
    adapter.lastSeen = new Date()
  }

  /**
   * Set entire universe
   */
  setUniverse(universe: number, data: Uint8Array | number[]): void {
    const adapter = this.getAdapterForUniverse(universe)
    if (!adapter) {
      dmxLogger.warn('No adapter registered for universe', { universe })
      return
    }

    adapter.client.setUniverse(data, universe)
    adapter.lastSeen = new Date()
  }

  /**
   * Blackout all adapters
   */
  blackoutAll(): void {
    for (const adapter of this.adapters.values()) {
      adapter.client.blackout()
    }
    dmxLogger.info('Blackout all adapters')
  }

  /**
   * Recall Maestro preset
   */
  async recallMaestroPreset(adapterId: string, presetNumber: number): Promise<boolean> {
    const adapter = this.adapters.get(adapterId)
    if (!adapter || adapter.type !== 'maestro') {
      dmxLogger.error('Adapter not found or not Maestro type', undefined, { adapterId })
      return false
    }

    const client = adapter.client as MaestroClient
    return client.recallPreset(presetNumber)
  }

  /**
   * Trigger Maestro function
   */
  async triggerMaestroFunction(adapterId: string, functionNumber: number): Promise<boolean> {
    const adapter = this.adapters.get(adapterId)
    if (!adapter || adapter.type !== 'maestro') {
      dmxLogger.error('Adapter not found or not Maestro type', undefined, { adapterId })
      return false
    }

    const client = adapter.client as MaestroClient
    return client.triggerFunction(functionNumber)
  }

  /**
   * Release adapter (decrement ref count)
   */
  releaseAdapter(id: string): void {
    const adapter = this.adapters.get(id)
    if (adapter) {
      adapter.refCount = Math.max(0, adapter.refCount - 1)
      dmxLogger.debug('Released adapter reference', { id, refCount: adapter.refCount })
    }
  }

  /**
   * Disconnect and remove adapter
   */
  async disconnectAdapter(id: string): Promise<void> {
    const adapter = this.adapters.get(id)
    if (!adapter) return

    // Disconnect client
    adapter.client.disconnect()

    // Remove universe mappings
    for (let i = 0; i < adapter.universeCount; i++) {
      this.universeToAdapter.delete(adapter.universeStart + i)
    }

    // Remove adapter
    this.adapters.delete(id)

    dmxLogger.info('Disconnected and removed adapter', { id })
  }

  /**
   * Cleanup idle adapters (those with 0 ref count and no recent activity)
   */
  private cleanupIdleAdapters(): void {
    const idleThreshold = 10 * 60 * 1000 // 10 minutes
    const now = Date.now()

    for (const [id, adapter] of this.adapters) {
      if (adapter.refCount === 0 && adapter.lastSeen) {
        const idleTime = now - adapter.lastSeen.getTime()
        if (idleTime > idleThreshold) {
          dmxLogger.info('Cleaning up idle adapter', { id, idleMinutes: Math.floor(idleTime / 60000) })
          this.disconnectAdapter(id)
        }
      }
    }
  }

  /**
   * Shutdown all adapters
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    for (const id of this.adapters.keys()) {
      await this.disconnectAdapter(id)
    }

    dmxLogger.info('DMX Connection Manager shutdown complete')
  }
}

// Export singleton instance
export const dmxConnectionManager = DMXConnectionManagerClass.getInstance()

// Export class for type checking
export { DMXConnectionManagerClass }
