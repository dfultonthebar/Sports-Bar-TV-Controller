/**
 * HTD Protocol Implementation
 *
 * Command encoding and response parsing for HTD audio controllers
 */

import type { HTDCommand, HTDZoneState, HTDZoneRawData, HTDModel } from './types';
import {
  HTD_START_BYTE,
  HTD_CONSTANT_BYTE,
  HTD_VOLUME,
  HTD_RESPONSE,
  HTD_ZONE_OFFSETS,
  HTD_FLAGS,
  HTD_MODEL_CONFIGS,
} from './config';

/**
 * Calculate checksum for a command
 * Checksum is the sum of all bytes, masked to 1 byte (& 0xFF)
 */
export function calculateChecksum(bytes: number[]): number {
  return bytes.reduce((sum, byte) => sum + byte, 0) & 0xff;
}

/**
 * Build a 6-byte command buffer
 *
 * Format: [0x02] [0x00] [zone] [cmd] [data] [checksum]
 *
 * @param zone - Target zone (1-12)
 * @param commandCode - Command code (e.g., 0x04 for control)
 * @param dataCode - Data code (e.g., 0x20 for power on)
 * @returns Buffer containing the 6-byte command
 */
export function buildCommand(zone: number, commandCode: number, dataCode: number): Buffer {
  const bytes = [HTD_START_BYTE, HTD_CONSTANT_BYTE, zone, commandCode, dataCode];
  const checksum = calculateChecksum(bytes);
  return Buffer.from([...bytes, checksum]);
}

/**
 * Build a command from an HTDCommand object
 */
export function buildCommandFromObject(command: HTDCommand): Buffer {
  return buildCommand(command.zone, command.commandCode, command.dataCode);
}

/**
 * Build a query command to get all zone states
 *
 * @param model - HTD model to determine number of zones
 * @returns Buffer containing the query command
 */
export function buildQueryCommand(model: HTDModel): Buffer {
  const config = HTD_MODEL_CONFIGS[model];
  // Query command uses zone 0 to query all zones
  // Command code 0x06, data is number of zones
  return buildCommand(0, 0x06, config.zones);
}

/**
 * Convert raw volume (196-256, 0=256) to percentage (0-100)
 */
export function volumeToPercent(rawVolume: number): number {
  // Handle wraparound: 0 is treated as 256 (max volume)
  const adjusted = rawVolume === 0 ? HTD_VOLUME.RAW_MAX : rawVolume;

  // Clamp to valid range
  if (adjusted < HTD_VOLUME.RAW_MIN) return HTD_VOLUME.PERCENT_MIN;
  if (adjusted > HTD_VOLUME.RAW_MAX) return HTD_VOLUME.PERCENT_MAX;

  // Convert to percentage
  const percent = Math.round(
    ((adjusted - HTD_VOLUME.RAW_MIN) / HTD_VOLUME.RAW_RANGE) * HTD_VOLUME.PERCENT_MAX
  );

  return Math.max(HTD_VOLUME.PERCENT_MIN, Math.min(HTD_VOLUME.PERCENT_MAX, percent));
}

/**
 * Convert percentage (0-100) to raw volume (196-256)
 */
export function percentToVolume(percent: number): number {
  // Clamp to valid range
  const clampedPercent = Math.max(
    HTD_VOLUME.PERCENT_MIN,
    Math.min(HTD_VOLUME.PERCENT_MAX, percent)
  );

  // Convert to raw value
  const raw = Math.round((clampedPercent / HTD_VOLUME.PERCENT_MAX) * HTD_VOLUME.RAW_RANGE + HTD_VOLUME.RAW_MIN);

  // Handle max volume wraparound (256 -> 0)
  return raw >= HTD_VOLUME.RAW_MAX ? 0 : raw;
}

/**
 * Convert raw tone/balance value to signed value (-7 to +7)
 * Raw values: 0-14 where 7 is center
 */
export function rawToSignedTone(raw: number): number {
  return raw - 7;
}

/**
 * Convert signed tone/balance value (-7 to +7) to raw value (0-14)
 */
export function signedToneToRaw(signed: number): number {
  return signed + 7;
}

/**
 * Parse raw zone data from response bytes
 *
 * @param data - Buffer containing zone data (14 bytes per zone)
 * @param offset - Byte offset to start reading from
 * @returns Parsed raw zone data
 */
export function parseZoneRawData(data: Buffer, offset: number): HTDZoneRawData {
  return {
    zone: data[offset + HTD_ZONE_OFFSETS.ZONE],
    power: data[offset + HTD_ZONE_OFFSETS.POWER],
    source: data[offset + HTD_ZONE_OFFSETS.SOURCE],
    volume: data[offset + HTD_ZONE_OFFSETS.VOLUME],
    treble: data[offset + HTD_ZONE_OFFSETS.TREBLE],
    bass: data[offset + HTD_ZONE_OFFSETS.BASS],
    balance: data[offset + HTD_ZONE_OFFSETS.BALANCE],
    flags: data[offset + HTD_ZONE_OFFSETS.FLAGS],
  };
}

/**
 * Convert raw zone data to zone state
 */
export function rawDataToZoneState(raw: HTDZoneRawData): HTDZoneState {
  return {
    zone: raw.zone,
    power: raw.power === 1,
    muted: (raw.flags & HTD_FLAGS.MUTE) !== 0,
    volume: volumeToPercent(raw.volume),
    rawVolume: raw.volume,
    source: raw.source,
    bass: rawToSignedTone(raw.bass),
    treble: rawToSignedTone(raw.treble),
    balance: rawToSignedTone(raw.balance),
    doNotDisturb: (raw.flags & HTD_FLAGS.DO_NOT_DISTURB) !== 0,
    partyMode: (raw.flags & HTD_FLAGS.PARTY_MODE) !== 0,
  };
}

/**
 * Parse a single zone state from response
 *
 * @param data - Buffer containing zone response data
 * @param offset - Byte offset to start reading from
 * @returns Parsed zone state
 */
export function parseZoneState(data: Buffer, offset: number = 0): HTDZoneState {
  const rawData = parseZoneRawData(data, offset);
  return rawDataToZoneState(rawData);
}

/**
 * Parse all zone states from a query response
 *
 * @param data - Buffer containing full query response
 * @param model - HTD model to determine expected zone count
 * @returns Array of parsed zone states
 */
export function parseAllZones(data: Buffer, model: HTDModel): HTDZoneState[] {
  const config = HTD_MODEL_CONFIGS[model];
  const zones: HTDZoneState[] = [];

  // Skip header bytes if present
  let offset = 0;
  if (data[0] === HTD_RESPONSE.START_BYTE) {
    offset = HTD_RESPONSE.HEADER_SIZE;
  }

  // Parse each zone
  for (let i = 0; i < config.zones; i++) {
    const zoneOffset = offset + i * HTD_RESPONSE.BYTES_PER_ZONE;

    // Check if we have enough data
    if (zoneOffset + HTD_RESPONSE.BYTES_PER_ZONE > data.length) {
      break;
    }

    zones.push(parseZoneState(data, zoneOffset));
  }

  return zones;
}

/**
 * Validate a response buffer
 *
 * @param data - Response buffer to validate
 * @returns true if response appears valid
 */
export function isValidResponse(data: Buffer): boolean {
  if (data.length < HTD_RESPONSE.BYTES_PER_ZONE) {
    return false;
  }

  // Check for start byte
  if (data[0] !== HTD_RESPONSE.START_BYTE) {
    return false;
  }

  return true;
}

/**
 * Calculate number of volume steps needed to reach target
 *
 * Since HTD only supports relative volume (up/down), we need to
 * calculate steps from current to target volume.
 *
 * @param currentPercent - Current volume percentage (0-100)
 * @param targetPercent - Target volume percentage (0-100)
 * @returns Object with direction and number of steps
 */
export function calculateVolumeSteps(
  currentPercent: number,
  targetPercent: number
): { direction: 'up' | 'down'; steps: number } {
  const diff = targetPercent - currentPercent;

  // Each step is approximately 1.67% (100/60)
  const stepsPerPercent = HTD_VOLUME.RAW_RANGE / HTD_VOLUME.PERCENT_MAX;
  const steps = Math.abs(Math.round(diff * stepsPerPercent));

  return {
    direction: diff >= 0 ? 'up' : 'down',
    steps,
  };
}

/**
 * Format a command buffer as hex string for logging
 */
export function formatCommandHex(buffer: Buffer): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/**
 * Parse a hex string into a Buffer
 */
export function parseHexString(hex: string): Buffer {
  const cleanHex = hex.replace(/\s+/g, '');
  const bytes = cleanHex.match(/.{1,2}/g) || [];
  return Buffer.from(bytes.map((b) => parseInt(b, 16)));
}
