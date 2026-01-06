/**
 * dbx ZonePRO Control Service
 *
 * High-level unified service for controlling dbx ZonePRO audio processors.
 * Provides a consistent interface for both TCP (m-models) and RS-232 connections.
 *
 * Features:
 * - Automatic connection type detection based on model
 * - Connection pooling and management
 * - Zone, source, mute, and scene control
 * - Stereo pair support
 * - Event-based status updates
 */

import { EventEmitter } from 'events'
import { logger } from '@sports-bar/logger'
import {
  DBX_MODELS,
  DbxModelConfig,
  getModelConfig,
  supportsEthernet,
  percentToVolume,
  volumeToPercent,
  dbToVolume,
  volumeToDb,
  DBX_PROTOCOL,
} from './config'
import { DbxTcpClient, DbxTcpClientConfig } from './dbx-tcp-client'
import { DbxSerialClient, DbxSerialClientConfig } from './dbx-serial-client'

export interface DbxControlServiceConfig {
  // Device identification
  deviceId: string
  model: string

  // Connection options (provide one)
  ipAddress?: string // For m-models with Ethernet
  serialPort?: string // For RS-232 connection

  // Optional settings
  port?: number // TCP port override (default: 3804)
  baudRate?: number // Serial baud rate override (default: 57600)
  autoReconnect?: boolean // Auto-reconnect on disconnect (default: true)
}

export interface ZoneState {
  zone: number
  volume: number // 0-415
  volumePercent: number // 0-100
  volumeDb: number // -80 to 0
  muted: boolean
  source: number
}

export interface DbxControlEvents {
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  zoneUpdate: (state: ZoneState) => void
}

/**
 * High-level control service for dbx ZonePRO processors
 */
export class DbxControlService extends EventEmitter {
  private config: DbxControlServiceConfig
  private modelConfig: DbxModelConfig
  private client: DbxTcpClient | DbxSerialClient | null = null
  private connectionType: 'tcp' | 'serial' | null = null
  private zoneStates: Map<number, ZoneState> = new Map()

  constructor(config: DbxControlServiceConfig) {
    super()

    this.config = config

    // Validate model
    const modelConfig = getModelConfig(config.model)
    if (!modelConfig) {
      throw new Error(`Unknown dbx ZonePRO model: ${config.model}`)
    }
    this.modelConfig = modelConfig

    // Determine connection type
    if (config.ipAddress && supportsEthernet(config.model)) {
      this.connectionType = 'tcp'
    } else if (config.serialPort) {
      this.connectionType = 'serial'
    } else if (config.ipAddress && !supportsEthernet(config.model)) {
      throw new Error(
        `Model ${config.model} does not support Ethernet. Use serialPort for RS-232 connection.`
      )
    } else {
      throw new Error('Either ipAddress or serialPort must be provided')
    }

    // Initialize zone states
    for (let i = 0; i < this.modelConfig.maxZones; i++) {
      this.zoneStates.set(i, {
        zone: i,
        volume: DBX_PROTOCOL.VOLUME_UNITY, // Default to unity gain
        volumePercent: 100,
        volumeDb: 0,
        muted: false,
        source: 0,
      })
    }

    logger.info('[DBX-CONTROL] Service initialized', {
      data: {
        deviceId: config.deviceId,
        model: this.modelConfig.name,
        connectionType: this.connectionType,
        maxZones: this.modelConfig.maxZones,
      },
    })
  }

  /**
   * Connect to the dbx ZonePRO processor
   */
  async connect(): Promise<void> {
    if (this.client && this.client.isConnected()) {
      logger.info('[DBX-CONTROL] Already connected')
      return
    }

    try {
      if (this.connectionType === 'tcp') {
        const tcpConfig: DbxTcpClientConfig = {
          ipAddress: this.config.ipAddress!,
          port: this.config.port,
          autoReconnect: this.config.autoReconnect ?? true,
        }

        this.client = new DbxTcpClient(tcpConfig)
      } else {
        const serialConfig: DbxSerialClientConfig = {
          port: this.config.serialPort!,
          baudRate: this.config.baudRate,
          autoReconnect: this.config.autoReconnect ?? true,
        }

        this.client = new DbxSerialClient(serialConfig)
      }

      // Set up event handlers
      this.client.on('connected', () => {
        logger.info('[DBX-CONTROL] Connected', {
          data: { deviceId: this.config.deviceId },
        })
        this.emit('connected')
      })

      this.client.on('disconnected', () => {
        logger.info('[DBX-CONTROL] Disconnected', {
          data: { deviceId: this.config.deviceId },
        })
        this.emit('disconnected')
      })

      this.client.on('error', (error) => {
        logger.error('[DBX-CONTROL] Error', { error })
        this.emit('error', error)
      })

      this.client.on('response', (response) => {
        this.handleResponse(response)
      })

      // Connect
      await this.client.connect()
    } catch (error) {
      logger.error('[DBX-CONTROL] Connection failed', { error })
      throw error
    }
  }

  /**
   * Disconnect from the processor
   */
  disconnect(): void {
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }

    logger.info('[DBX-CONTROL] Disconnected', {
      data: { deviceId: this.config.deviceId },
    })
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.client.isConnected()
  }

  /**
   * Handle response from device
   */
  private handleResponse(response: any): void {
    // Parse response and update zone states if applicable
    // This would be expanded based on the actual response format
    logger.debug('[DBX-CONTROL] Response received', { data: response })
  }

  /**
   * Set volume for a zone
   *
   * @param zone - Zone number (0-based)
   * @param value - Volume value
   * @param options - Volume options
   */
  async setVolume(
    zone: number,
    value: number,
    options: {
      type?: 'raw' | 'percent' | 'db'
      stereo?: boolean
    } = {}
  ): Promise<void> {
    this.validateZone(zone)
    this.ensureConnected()

    const { type = 'percent', stereo = true } = options

    // Convert to raw volume value (0-415)
    let rawVolume: number
    switch (type) {
      case 'percent':
        rawVolume = percentToVolume(value)
        break
      case 'db':
        rawVolume = dbToVolume(value)
        break
      case 'raw':
      default:
        rawVolume = Math.max(0, Math.min(415, Math.round(value)))
        break
    }

    logger.info('[DBX-CONTROL] Setting volume', {
      data: {
        deviceId: this.config.deviceId,
        zone,
        rawVolume,
        percent: volumeToPercent(rawVolume),
        db: volumeToDb(rawVolume),
        stereo,
      },
    })

    await this.client!.setVolume(zone, rawVolume, stereo)

    // Update local state
    const state = this.zoneStates.get(zone)!
    state.volume = rawVolume
    state.volumePercent = volumeToPercent(rawVolume)
    state.volumeDb = volumeToDb(rawVolume)

    this.emit('zoneUpdate', state)
  }

  /**
   * Get volume for a zone
   */
  getVolume(
    zone: number,
    format: 'raw' | 'percent' | 'db' = 'percent'
  ): number {
    this.validateZone(zone)

    const state = this.zoneStates.get(zone)!

    switch (format) {
      case 'percent':
        return state.volumePercent
      case 'db':
        return state.volumeDb
      case 'raw':
      default:
        return state.volume
    }
  }

  /**
   * Increase volume by percentage
   */
  async volumeUp(zone: number, amount: number = 5, stereo: boolean = true): Promise<void> {
    const currentPercent = this.getVolume(zone, 'percent')
    const newPercent = Math.min(100, currentPercent + amount)
    await this.setVolume(zone, newPercent, { type: 'percent', stereo })
  }

  /**
   * Decrease volume by percentage
   */
  async volumeDown(zone: number, amount: number = 5, stereo: boolean = true): Promise<void> {
    const currentPercent = this.getVolume(zone, 'percent')
    const newPercent = Math.max(0, currentPercent - amount)
    await this.setVolume(zone, newPercent, { type: 'percent', stereo })
  }

  /**
   * Set mute state for a zone
   *
   * @param zone - Zone number (0-based)
   * @param muted - true to mute, false to unmute
   */
  async setMute(zone: number, muted: boolean): Promise<void> {
    this.validateZone(zone)
    this.ensureConnected()

    logger.info('[DBX-CONTROL] Setting mute', {
      data: {
        deviceId: this.config.deviceId,
        zone,
        muted,
      },
    })

    await this.client!.setMute(zone, muted)

    // Update local state
    const state = this.zoneStates.get(zone)!
    state.muted = muted

    this.emit('zoneUpdate', state)
  }

  /**
   * Toggle mute state for a zone
   */
  async toggleMute(zone: number): Promise<boolean> {
    this.validateZone(zone)

    const state = this.zoneStates.get(zone)!
    const newMuted = !state.muted

    await this.setMute(zone, newMuted)
    return newMuted
  }

  /**
   * Check if a zone is muted
   */
  isMuted(zone: number): boolean {
    this.validateZone(zone)
    return this.zoneStates.get(zone)!.muted
  }

  /**
   * Set source for a zone
   *
   * @param zone - Zone number (0-based)
   * @param sourceIndex - Source index (0-based)
   */
  async setSource(zone: number, sourceIndex: number): Promise<void> {
    this.validateZone(zone)
    this.validateSource(sourceIndex)
    this.ensureConnected()

    logger.info('[DBX-CONTROL] Setting source', {
      data: {
        deviceId: this.config.deviceId,
        zone,
        sourceIndex,
      },
    })

    await this.client!.setSource(zone, sourceIndex)

    // Update local state
    const state = this.zoneStates.get(zone)!
    state.source = sourceIndex

    this.emit('zoneUpdate', state)
  }

  /**
   * Get current source for a zone
   */
  getSource(zone: number): number {
    this.validateZone(zone)
    return this.zoneStates.get(zone)!.source
  }

  /**
   * Recall a scene/preset
   *
   * @param sceneNumber - Scene number (1-based typically, device dependent)
   */
  async recallScene(sceneNumber: number): Promise<void> {
    if (sceneNumber < 1 || sceneNumber > this.modelConfig.maxScenes) {
      throw new Error(
        `Scene number must be between 1 and ${this.modelConfig.maxScenes}`
      )
    }

    this.ensureConnected()

    logger.info('[DBX-CONTROL] Recalling scene', {
      data: {
        deviceId: this.config.deviceId,
        sceneNumber,
      },
    })

    await this.client!.recallScene(sceneNumber)
  }

  /**
   * Get zone state
   */
  getZoneState(zone: number): ZoneState {
    this.validateZone(zone)
    return { ...this.zoneStates.get(zone)! }
  }

  /**
   * Get all zone states
   */
  getAllZoneStates(): ZoneState[] {
    return Array.from(this.zoneStates.values()).map((state) => ({ ...state }))
  }

  /**
   * Get model configuration
   */
  getModelConfig(): DbxModelConfig {
    return { ...this.modelConfig }
  }

  /**
   * Get service configuration
   */
  getConfig(): DbxControlServiceConfig {
    return { ...this.config }
  }

  /**
   * Get connection type
   */
  getConnectionType(): 'tcp' | 'serial' | null {
    return this.connectionType
  }

  /**
   * Validate zone number
   */
  private validateZone(zone: number): void {
    if (zone < 0 || zone >= this.modelConfig.maxZones) {
      throw new Error(
        `Zone must be between 0 and ${this.modelConfig.maxZones - 1}`
      )
    }
  }

  /**
   * Validate source index
   */
  private validateSource(sourceIndex: number): void {
    if (sourceIndex < 0 || sourceIndex >= this.modelConfig.inputs) {
      throw new Error(
        `Source index must be between 0 and ${this.modelConfig.inputs - 1}`
      )
    }
  }

  /**
   * Ensure client is connected
   */
  private ensureConnected(): void {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('Not connected to dbx ZonePRO')
    }
  }
}

// Service registry for managing multiple processors
const serviceRegistry: Map<string, DbxControlService> = new Map()

/**
 * Get or create a control service for a device
 */
export async function getDbxControlService(
  config: DbxControlServiceConfig
): Promise<DbxControlService> {
  // Check if service already exists
  if (serviceRegistry.has(config.deviceId)) {
    const existing = serviceRegistry.get(config.deviceId)!
    if (existing.isConnected()) {
      return existing
    }
    // Service exists but not connected, reconnect
    await existing.connect()
    return existing
  }

  // Create new service
  const service = new DbxControlService(config)
  await service.connect()

  // Store in registry
  serviceRegistry.set(config.deviceId, service)

  // Clean up on disconnect (if not auto-reconnecting)
  service.once('error', () => {
    if (!config.autoReconnect) {
      serviceRegistry.delete(config.deviceId)
    }
  })

  return service
}

/**
 * Disconnect and remove a service from registry
 */
export function disconnectDbxService(deviceId: string): void {
  const service = serviceRegistry.get(deviceId)
  if (service) {
    service.disconnect()
    serviceRegistry.delete(deviceId)
  }
}

/**
 * Disconnect all services
 */
export function disconnectAllDbxServices(): void {
  serviceRegistry.forEach((service) => service.disconnect())
  serviceRegistry.clear()
}

/**
 * List all registered services
 */
export function listDbxServices(): string[] {
  return Array.from(serviceRegistry.keys())
}

export default DbxControlService
