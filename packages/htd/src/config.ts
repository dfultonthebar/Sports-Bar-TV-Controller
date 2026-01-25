/**
 * HTD Audio System Protocol Constants and Configuration
 *
 * Supports MC-66, MCA-66, Lync 6, and Lync 12 whole-house audio controllers
 */

import type { HTDModel, HTDModelConfig } from './types';

/**
 * Protocol start byte (constant for all commands)
 */
export const HTD_START_BYTE = 0x02;

/**
 * Protocol constant byte (always 0x00)
 */
export const HTD_CONSTANT_BYTE = 0x00;

/**
 * Command codes
 */
export const HTD_COMMANDS = {
  /** Control command - for zone control operations */
  CONTROL: 0x04,
  /** Query command - for reading zone states */
  QUERY_ZONES: 0x06,
} as const;

/**
 * Data codes for control commands (command code 0x04)
 */
export const HTD_DATA = {
  // Source selection (0x03 = Source 1, 0x08 = Source 6)
  SOURCE_1: 0x03,
  SOURCE_2: 0x04,
  SOURCE_3: 0x05,
  SOURCE_4: 0x06,
  SOURCE_5: 0x07,
  SOURCE_6: 0x08,

  // Volume control
  VOLUME_UP: 0x09,
  VOLUME_DOWN: 0x0a,

  // Power control (single zone)
  POWER_ON_ZONE: 0x20,
  POWER_OFF_ZONE: 0x21,

  // Mute control
  MUTE_TOGGLE: 0x22,

  // Tone control
  BASS_UP: 0x26,
  BASS_DOWN: 0x27,
  TREBLE_UP: 0x28,
  TREBLE_DOWN: 0x29,

  // Balance control
  BALANCE_RIGHT: 0x2a,
  BALANCE_LEFT: 0x2b,

  // Power control (all zones)
  POWER_ON_ALL: 0x38,
  POWER_OFF_ALL: 0x39,

  // Do Not Disturb
  DND_ON: 0x3e,
  DND_OFF: 0x3f,

  // Party mode (follow zone 1)
  PARTY_ON: 0x6f,
  PARTY_OFF: 0x70,
} as const;

/**
 * Source number to data code mapping
 */
export function getSourceDataCode(source: number): number {
  if (source < 1 || source > 6) {
    throw new Error(`Invalid source number: ${source}. Must be 1-6.`);
  }
  return 0x02 + source; // Source 1 = 0x03, Source 6 = 0x08
}

/**
 * Network configuration defaults
 */
export const HTD_NETWORK_CONFIG = {
  /** Default TCP port for HTD gateway (WGW-SLX) */
  DEFAULT_PORT: 10006,
  /** Connection timeout in milliseconds */
  CONNECT_TIMEOUT: 5000,
  /** Command response timeout in milliseconds */
  RESPONSE_TIMEOUT: 3000,
  /** Delay between commands in milliseconds */
  COMMAND_DELAY: 100,
  /** Keep-alive interval in milliseconds */
  KEEPALIVE_INTERVAL: 30000,
} as const;

/**
 * Serial port configuration defaults (RS-232)
 */
export const HTD_SERIAL_CONFIG = {
  /** Default baud rate */
  BAUD_RATE: 57600,
  /** Data bits */
  DATA_BITS: 8,
  /** Stop bits */
  STOP_BITS: 1,
  /** Parity */
  PARITY: 'none' as const,
  /** Flow control */
  FLOW_CONTROL: false,
} as const;

/**
 * Volume conversion constants
 * HTD uses raw values 196-256 (0 wraps to 256)
 */
export const HTD_VOLUME = {
  /** Minimum raw volume value */
  RAW_MIN: 196,
  /** Maximum raw volume value (0 is treated as 256) */
  RAW_MAX: 256,
  /** Range of raw values */
  RAW_RANGE: 60, // 256 - 196
  /** Minimum percentage */
  PERCENT_MIN: 0,
  /** Maximum percentage */
  PERCENT_MAX: 100,
} as const;

/**
 * Zone state response parsing constants
 * Response is 14 bytes per zone
 */
export const HTD_RESPONSE = {
  /** Bytes per zone in state response */
  BYTES_PER_ZONE: 14,
  /** Expected header bytes */
  HEADER_SIZE: 2,
  /** Response start byte */
  START_BYTE: 0x02,
} as const;

/**
 * Zone data byte offsets within zone response (14 bytes)
 */
export const HTD_ZONE_OFFSETS = {
  ZONE: 0,
  POWER: 1,
  SOURCE: 2,
  VOLUME: 3,
  TREBLE: 4,
  BASS: 5,
  BALANCE: 6,
  FLAGS: 7,
  // Bytes 8-13 are reserved/unused
} as const;

/**
 * Flag bits in the FLAGS byte
 */
export const HTD_FLAGS = {
  MUTE: 0x01,
  DO_NOT_DISTURB: 0x02,
  PARTY_MODE: 0x04,
} as const;

/**
 * Model-specific configurations
 */
export const HTD_MODEL_CONFIGS: Record<HTDModel, HTDModelConfig> = {
  'MC-66': {
    name: 'MC-66',
    zones: 6,
    sources: 6,
    hasAmplifier: false,
    supportsWebSocket: false,
  },
  'MCA-66': {
    name: 'MCA-66',
    zones: 6,
    sources: 6,
    hasAmplifier: true,
    supportsWebSocket: false,
  },
  Lync6: {
    name: 'Lync 6',
    zones: 6,
    sources: 6,
    hasAmplifier: true,
    supportsWebSocket: true,
  },
  Lync12: {
    name: 'Lync 12',
    zones: 12,
    sources: 6,
    hasAmplifier: true,
    supportsWebSocket: true,
  },
};

/**
 * Get model configuration
 */
export function getModelConfig(model: HTDModel): HTDModelConfig {
  return HTD_MODEL_CONFIGS[model];
}

/**
 * Validate zone number for a given model
 */
export function validateZone(zone: number, model: HTDModel): boolean {
  const config = HTD_MODEL_CONFIGS[model];
  return zone >= 1 && zone <= config.zones;
}

/**
 * Validate source number (1-6 for all models)
 */
export function validateSource(source: number): boolean {
  return source >= 1 && source <= 6;
}

/**
 * Default device configuration values
 */
export const HTD_DEFAULT_CONFIG = {
  port: HTD_NETWORK_CONFIG.DEFAULT_PORT,
  baudRate: HTD_SERIAL_CONFIG.BAUD_RATE,
  commandDelay: HTD_NETWORK_CONFIG.COMMAND_DELAY,
  ipAddress: '',
  serialPort: '/dev/ttyUSB0',
} as const;
