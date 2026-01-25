/**
 * @sports-bar/htd
 *
 * HTD (Home Theater Direct) whole-house audio system control package
 *
 * Supports:
 * - MC-66 / MCA-66 controllers
 * - Lync 6 / Lync 12 controllers
 * - TCP connection via WGW-SLX gateway
 * - RS-232 serial connection (planned)
 */

// Types
export type {
  HTDModel,
  HTDConnectionType,
  HTDModelConfig,
  HTDDeviceConfig,
  HTDDeviceConfigRequired,
  HTDZoneState,
  HTDZoneRawData,
  HTDCommand,
  HTDPendingCommand,
  HTDConnectionState,
  HTDControlServiceConfig,
  HTDControlEvents,
  HTDControlCommand,
  HTDControlRequest,
  HTDControlResponse,
} from './types';

// Configuration constants
export {
  HTD_START_BYTE,
  HTD_CONSTANT_BYTE,
  HTD_COMMANDS,
  HTD_DATA,
  HTD_NETWORK_CONFIG,
  HTD_SERIAL_CONFIG,
  HTD_VOLUME,
  HTD_RESPONSE,
  HTD_ZONE_OFFSETS,
  HTD_FLAGS,
  HTD_MODEL_CONFIGS,
  HTD_DEFAULT_CONFIG,
  getSourceDataCode,
  getModelConfig,
  validateZone,
  validateSource,
} from './config';

// Protocol utilities
export {
  calculateChecksum,
  buildCommand,
  buildCommandFromObject,
  buildQueryCommand,
  volumeToPercent,
  percentToVolume,
  rawToSignedTone,
  signedToneToRaw,
  parseZoneRawData,
  rawDataToZoneState,
  parseZoneState,
  parseAllZones,
  isValidResponse,
  calculateVolumeSteps,
  formatCommandHex,
  parseHexString,
} from './htd-protocol';

// TCP Client
export { HTDTcpClient } from './htd-tcp-client';
export type { HTDTcpClientConfig, HTDTcpClientEvents } from './htd-tcp-client';

// Control Service
export {
  HTDControlService,
  getHTDService,
  disconnectHTDService,
  disconnectAllHTDServices,
  getActiveHTDServiceIds,
  hasHTDService,
} from './htd-control-service';
