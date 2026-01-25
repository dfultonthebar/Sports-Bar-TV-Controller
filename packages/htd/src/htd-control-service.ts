/**
 * HTD Control Service
 *
 * High-level service for controlling HTD audio systems
 * Provides zone control, state management, and connection pooling
 */

import { EventEmitter } from 'events';
import { logger } from '@sports-bar/logger';
import type {
  HTDDeviceConfig,
  HTDDeviceConfigRequired,
  HTDZoneState,
  HTDControlServiceConfig,
  HTDConnectionState,
} from './types';
import { HTDTcpClient } from './htd-tcp-client';
import {
  buildCommand,
  buildQueryCommand,
  parseAllZones,
  calculateVolumeSteps,
} from './htd-protocol';
import {
  HTD_COMMANDS,
  HTD_DATA,
  HTD_DEFAULT_CONFIG,
  getSourceDataCode,
  validateZone,
  validateSource,
  getModelConfig,
} from './config';

/**
 * Apply defaults to device configuration
 */
function applyConfigDefaults(config: HTDDeviceConfig): HTDDeviceConfigRequired {
  return {
    id: config.id,
    name: config.name,
    model: config.model,
    connectionType: config.connectionType,
    ipAddress: config.ipAddress ?? HTD_DEFAULT_CONFIG.ipAddress,
    port: config.port ?? HTD_DEFAULT_CONFIG.port,
    serialPort: config.serialPort ?? HTD_DEFAULT_CONFIG.serialPort,
    baudRate: config.baudRate ?? HTD_DEFAULT_CONFIG.baudRate,
    commandDelay: config.commandDelay ?? HTD_DEFAULT_CONFIG.commandDelay,
  };
}

/**
 * HTD Control Service
 *
 * Features:
 * - Zone power, volume, mute, source, and tone control
 * - Automatic state polling
 * - Auto-reconnect on disconnect
 * - Event-based state updates
 */
export class HTDControlService extends EventEmitter {
  private client: HTDTcpClient | null = null;
  private config: HTDDeviceConfigRequired;
  private serviceConfig: HTDControlServiceConfig;
  private zoneStates: Map<number, HTDZoneState> = new Map();
  private connectionState: HTDConnectionState = {
    isConnected: false,
    reconnectAttempts: 0,
  };
  private pollInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: HTDControlServiceConfig) {
    super();
    this.config = applyConfigDefaults(config);
    this.serviceConfig = {
      ...config,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      reconnectDelay: config.reconnectDelay ?? 2000,
      pollInterval: config.pollInterval ?? 5000,
    };
  }

  /**
   * Connect to the HTD device
   */
  async connect(): Promise<void> {
    if (this.config.connectionType === 'serial') {
      throw new Error('Serial connection not yet implemented. Use TCP connection.');
    }

    if (!this.config.ipAddress) {
      throw new Error('IP address is required for TCP connection');
    }

    this.client = new HTDTcpClient({
      ipAddress: this.config.ipAddress,
      port: this.config.port,
      commandDelay: this.config.commandDelay,
    });

    // Set up client event handlers
    this.client.on('connected', () => {
      this.connectionState.isConnected = true;
      this.connectionState.lastConnected = new Date();
      this.connectionState.reconnectAttempts = 0;
      this.connectionState.lastError = undefined;
      this.emit('connected');
      this.startPolling();
    });

    this.client.on('disconnected', () => {
      this.connectionState.isConnected = false;
      this.emit('disconnected');
      this.stopPolling();
      this.handleReconnect();
    });

    this.client.on('error', (error) => {
      this.connectionState.lastError = error.message;
      this.emit('error', error);
    });

    try {
      await this.client.connect();
    } catch (error: any) {
      this.connectionState.lastError = error.message;
      throw error;
    }
  }

  /**
   * Disconnect from the HTD device
   */
  async disconnect(): Promise<void> {
    this.stopPolling();
    this.clearReconnectTimeout();

    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }

    this.connectionState.isConnected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  /**
   * Get connection state
   */
  getConnectionState(): HTDConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get device configuration
   */
  getConfig(): HTDDeviceConfigRequired {
    return { ...this.config };
  }

  /**
   * Get model configuration
   */
  getModelConfig() {
    return getModelConfig(this.config.model);
  }

  // ==================== Zone Control Methods ====================

  /**
   * Set zone power
   */
  async setZonePower(zone: number, on: boolean): Promise<void> {
    this.validateZone(zone);

    const dataCode = on ? HTD_DATA.POWER_ON_ZONE : HTD_DATA.POWER_OFF_ZONE;
    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, dataCode);

    await this.sendCommand(command);
    logger.info(`[HTD] Zone ${zone} power ${on ? 'on' : 'off'}`);
  }

  /**
   * Set all zones power
   */
  async setAllZonesPower(on: boolean): Promise<void> {
    const dataCode = on ? HTD_DATA.POWER_ON_ALL : HTD_DATA.POWER_OFF_ALL;
    // Use zone 1 for all-zones command (zone is ignored but required)
    const command = buildCommand(1, HTD_COMMANDS.CONTROL, dataCode);

    await this.sendCommand(command);
    logger.info(`[HTD] All zones power ${on ? 'on' : 'off'}`);
  }

  /**
   * Volume up
   */
  async volumeUp(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.VOLUME_UP);
    await this.sendCommand(command);
  }

  /**
   * Volume down
   */
  async volumeDown(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.VOLUME_DOWN);
    await this.sendCommand(command);
  }

  /**
   * Set volume to a specific percentage
   *
   * Note: HTD only supports relative volume (up/down), so this method
   * calculates the number of steps needed and sends multiple commands.
   */
  async setVolume(zone: number, targetPercent: number): Promise<void> {
    this.validateZone(zone);

    // Get current state
    const currentState = this.zoneStates.get(zone);
    if (!currentState) {
      // If we don't have current state, refresh first
      await this.refreshZoneStates();
      const newState = this.zoneStates.get(zone);
      if (!newState) {
        throw new Error(`Could not get current state for zone ${zone}`);
      }
      return this.setVolumeFromCurrent(zone, newState.volume, targetPercent);
    }

    return this.setVolumeFromCurrent(zone, currentState.volume, targetPercent);
  }

  /**
   * Set volume from a known current level
   */
  private async setVolumeFromCurrent(
    zone: number,
    currentPercent: number,
    targetPercent: number
  ): Promise<void> {
    const { direction, steps } = calculateVolumeSteps(currentPercent, targetPercent);

    if (steps === 0) {
      return;
    }

    const dataCode = direction === 'up' ? HTD_DATA.VOLUME_UP : HTD_DATA.VOLUME_DOWN;

    logger.debug(`[HTD] Zone ${zone} volume: ${currentPercent}% -> ${targetPercent}% (${steps} steps ${direction})`);

    // Send volume commands with delay between each
    for (let i = 0; i < steps; i++) {
      const command = buildCommand(zone, HTD_COMMANDS.CONTROL, dataCode);
      await this.sendCommand(command);
    }

    logger.info(`[HTD] Zone ${zone} volume set to ~${targetPercent}%`);
  }

  /**
   * Toggle mute
   */
  async toggleMute(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.MUTE_TOGGLE);
    await this.sendCommand(command);
    logger.info(`[HTD] Zone ${zone} mute toggled`);
  }

  /**
   * Set source
   */
  async setSource(zone: number, source: number): Promise<void> {
    this.validateZone(zone);

    if (!validateSource(source)) {
      throw new Error(`Invalid source: ${source}. Must be 1-6.`);
    }

    const dataCode = getSourceDataCode(source);
    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, dataCode);

    await this.sendCommand(command);
    logger.info(`[HTD] Zone ${zone} source set to ${source}`);
  }

  // ==================== Tone Control Methods ====================

  /**
   * Bass up
   */
  async bassUp(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.BASS_UP);
    await this.sendCommand(command);
  }

  /**
   * Bass down
   */
  async bassDown(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.BASS_DOWN);
    await this.sendCommand(command);
  }

  /**
   * Treble up
   */
  async trebleUp(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.TREBLE_UP);
    await this.sendCommand(command);
  }

  /**
   * Treble down
   */
  async trebleDown(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.TREBLE_DOWN);
    await this.sendCommand(command);
  }

  /**
   * Balance left
   */
  async balanceLeft(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.BALANCE_LEFT);
    await this.sendCommand(command);
  }

  /**
   * Balance right
   */
  async balanceRight(zone: number): Promise<void> {
    this.validateZone(zone);

    const command = buildCommand(zone, HTD_COMMANDS.CONTROL, HTD_DATA.BALANCE_RIGHT);
    await this.sendCommand(command);
  }

  // ==================== State Methods ====================

  /**
   * Refresh all zone states from device
   */
  async refreshZoneStates(): Promise<HTDZoneState[]> {
    if (!this.client?.isConnected()) {
      throw new Error('Not connected');
    }

    const command = buildQueryCommand(this.config.model);
    const response = await this.client.sendCommand(command);

    const zones = parseAllZones(response, this.config.model);

    // Update cached states
    for (const zone of zones) {
      const previous = this.zoneStates.get(zone.zone);
      this.zoneStates.set(zone.zone, zone);

      // Emit update if state changed
      if (!previous || JSON.stringify(previous) !== JSON.stringify(zone)) {
        this.emit('zoneUpdate', zone);
      }
    }

    this.emit('zonesUpdate', zones);
    return zones;
  }

  /**
   * Get cached zone state
   */
  getZoneState(zone: number): HTDZoneState | undefined {
    return this.zoneStates.get(zone);
  }

  /**
   * Get all cached zone states
   */
  getAllZoneStates(): HTDZoneState[] {
    return Array.from(this.zoneStates.values());
  }

  // ==================== Private Methods ====================

  /**
   * Send a command through the client
   */
  private async sendCommand(command: Buffer): Promise<Buffer> {
    if (!this.client?.isConnected()) {
      throw new Error('Not connected');
    }

    return this.client.sendCommand(command);
  }

  /**
   * Validate zone number
   */
  private validateZone(zone: number): void {
    if (!validateZone(zone, this.config.model)) {
      const modelConfig = getModelConfig(this.config.model);
      throw new Error(`Invalid zone: ${zone}. Must be 1-${modelConfig.zones}.`);
    }
  }

  /**
   * Start state polling
   */
  private startPolling(): void {
    if (this.serviceConfig.pollInterval && this.serviceConfig.pollInterval > 0) {
      this.pollInterval = setInterval(async () => {
        try {
          await this.refreshZoneStates();
        } catch (error: unknown) {
          logger.error(`[HTD] Poll error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }, this.serviceConfig.pollInterval);

      // Initial poll
      this.refreshZoneStates().catch((err: unknown) => {
        logger.error(`[HTD] Initial poll error: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }

  /**
   * Stop state polling
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Handle reconnection
   */
  private handleReconnect(): void {
    if (!this.serviceConfig.autoReconnect) {
      return;
    }

    if (
      this.serviceConfig.maxReconnectAttempts &&
      this.connectionState.reconnectAttempts >= this.serviceConfig.maxReconnectAttempts
    ) {
      logger.error('[HTD] Max reconnect attempts reached');
      return;
    }

    this.connectionState.reconnectAttempts++;
    this.emit('reconnecting', this.connectionState.reconnectAttempts);

    logger.info(
      `[HTD] Reconnecting (attempt ${this.connectionState.reconnectAttempts}/${this.serviceConfig.maxReconnectAttempts})...`
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error: unknown) {
        logger.error(`[HTD] Reconnect failed: ${error instanceof Error ? error.message : String(error)}`);
        this.handleReconnect();
      }
    }, this.serviceConfig.reconnectDelay);
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// ==================== Service Factory ====================

/**
 * Active service instances (connection pooling)
 */
const activeServices: Map<string, HTDControlService> = new Map();

/**
 * Get or create an HTD service instance
 *
 * @param config - Device configuration
 * @returns HTD control service instance
 */
export function getHTDService(config: HTDControlServiceConfig): HTDControlService {
  const existing = activeServices.get(config.id);
  if (existing) {
    return existing;
  }

  const service = new HTDControlService(config);
  activeServices.set(config.id, service);
  return service;
}

/**
 * Disconnect and remove a specific HTD service
 *
 * @param deviceId - Device ID to disconnect
 */
export async function disconnectHTDService(deviceId: string): Promise<void> {
  const service = activeServices.get(deviceId);
  if (service) {
    await service.disconnect();
    activeServices.delete(deviceId);
    logger.info(`[HTD] Service ${deviceId} disconnected and removed`);
  }
}

/**
 * Disconnect and remove all HTD services
 */
export async function disconnectAllHTDServices(): Promise<void> {
  const disconnectPromises = Array.from(activeServices.entries()).map(
    async ([id, service]) => {
      try {
        await service.disconnect();
        logger.info(`[HTD] Service ${id} disconnected`);
      } catch (error: unknown) {
        logger.error(`[HTD] Error disconnecting service ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  await Promise.all(disconnectPromises);
  activeServices.clear();
  logger.info('[HTD] All services disconnected');
}

/**
 * Get all active service IDs
 */
export function getActiveHTDServiceIds(): string[] {
  return Array.from(activeServices.keys());
}

/**
 * Check if a service exists
 */
export function hasHTDService(deviceId: string): boolean {
  return activeServices.has(deviceId);
}
