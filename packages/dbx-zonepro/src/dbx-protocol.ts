/**
 * HiQnet v1.0 Protocol Implementation for dbx ZonePRO
 *
 * This module implements the binary protocol used by dbx ZonePRO processors.
 * The protocol is based on HiQnet (Harman's network protocol) version 1.0.
 *
 * Frame Structure:
 * - Start byte: 0x64 ('d')
 * - Length: 2 bytes (big-endian, includes everything after length)
 * - Header: Device addressing and message info
 * - Payload: Command-specific data
 * - Checksum: CCITT-8 CRC
 *
 * Note: All multi-byte values are big-endian.
 */

import { DBX_PROTOCOL } from './config'

// HiQnet message header structure
export interface HiQnetHeader {
  version: number // Protocol version (typically 1)
  headerLength: number // Length of header
  messageLength: number // Total message length
  sourceAddress: number // Source device address (32-bit)
  destinationAddress: number // Destination device address (32-bit)
  messageId: number // Message type ID (16-bit)
  flags: number // Message flags (16-bit)
  hopCount: number // Network hop count
  sequenceNumber: number // Message sequence number (16-bit)
}

// State variable set command structure
export interface StateVariableSet {
  objectId: number // Object ID (32-bit)
  stateVariableId: number // State variable ID (16-bit)
  dataType: number // Data type (8-bit)
  value: number // Value to set
}

/**
 * Calculate CCITT-8 CRC checksum
 *
 * This is the standard 8-bit CRC used in HiQnet protocol.
 * Polynomial: x^8 + x^2 + x + 1 (0x07)
 *
 * @param data - Buffer to calculate CRC for
 * @returns 8-bit CRC value
 */
export function calculateCRC8(data: Buffer): number {
  const polynomial = 0x07
  let crc = 0x00

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ polynomial) & 0xff
      } else {
        crc = (crc << 1) & 0xff
      }
    }
  }

  return crc
}

/**
 * Build a HiQnet frame with proper header and checksum
 *
 * @param messageId - Message ID (from DBX_PROTOCOL.MESSAGE_ID)
 * @param payload - Command payload data
 * @param sequenceNumber - Message sequence number
 * @returns Complete frame buffer ready to send
 */
export function buildFrame(
  messageId: number,
  payload: Buffer,
  sequenceNumber: number = 0
): Buffer {
  // Header structure (simplified for ZonePRO):
  // - Version: 1 byte (0x01)
  // - Header length: 1 byte
  // - Message length: 2 bytes (big-endian)
  // - Source address: 4 bytes (we use 0x00000000)
  // - Destination address: 4 bytes (typically 0x00000001 for ZonePRO)
  // - Message ID: 2 bytes (big-endian)
  // - Flags: 2 bytes (0x0000)
  // - Hop count: 1 byte (0x00)
  // - Sequence number: 2 bytes (big-endian)

  const headerLength = 21 // Fixed header size for HiQnet v1.0
  const messageLength = headerLength + payload.length

  // Allocate buffer for complete frame
  // Frame: Start byte (1) + Length (2) + Message + CRC (1)
  const frameLength = 1 + 2 + messageLength + 1
  const frame = Buffer.alloc(frameLength)

  let offset = 0

  // Start byte
  frame.writeUInt8(DBX_PROTOCOL.FRAME_START_BYTE, offset++)

  // Message length (big-endian, 16-bit)
  frame.writeUInt16BE(messageLength, offset)
  offset += 2

  // Protocol version
  frame.writeUInt8(0x01, offset++)

  // Header length
  frame.writeUInt8(headerLength, offset++)

  // Message length (repeated in header)
  frame.writeUInt16BE(messageLength, offset)
  offset += 2

  // Source address (32-bit, big-endian) - 0x00000000 for host
  frame.writeUInt32BE(0x00000000, offset)
  offset += 4

  // Destination address (32-bit, big-endian) - 0x00000001 for ZonePRO
  frame.writeUInt32BE(0x00000001, offset)
  offset += 4

  // Message ID (16-bit, big-endian)
  frame.writeUInt16BE(messageId, offset)
  offset += 2

  // Flags (16-bit) - 0x0000 for normal messages
  frame.writeUInt16BE(0x0000, offset)
  offset += 2

  // Hop count
  frame.writeUInt8(0x00, offset++)

  // Sequence number (16-bit, big-endian)
  frame.writeUInt16BE(sequenceNumber & 0xffff, offset)
  offset += 2

  // Copy payload
  payload.copy(frame, offset)
  offset += payload.length

  // Calculate CRC over message portion (after length bytes)
  const messageData = frame.slice(3, offset)
  const crc = calculateCRC8(messageData)
  frame.writeUInt8(crc, offset)

  return frame
}

/**
 * Build MultiSVSet payload for setting a single state variable
 *
 * Used for setting volume, mute, source selection, etc.
 *
 * @param objectId - Object ID for the zone/input
 * @param stateVariableId - State variable ID (e.g., volume, mute)
 * @param value - Value to set
 * @param dataType - Data type (0x01 for uint8, 0x02 for uint16, 0x04 for uint32)
 * @returns Payload buffer
 */
export function buildMultiSVSetPayload(
  objectId: number,
  stateVariableId: number,
  value: number,
  dataType: number = 0x02 // Default to uint16
): Buffer {
  // MultiSVSet payload structure:
  // - Count: 2 bytes (number of SVs to set)
  // - For each SV:
  //   - Object ID: 4 bytes
  //   - State Variable ID: 2 bytes
  //   - Data type: 1 byte
  //   - Value: variable length based on data type

  let valueLength: number
  switch (dataType) {
    case 0x01:
      valueLength = 1 // uint8
      break
    case 0x02:
      valueLength = 2 // uint16
      break
    case 0x04:
      valueLength = 4 // uint32
      break
    default:
      valueLength = 2 // Default to uint16
  }

  const payloadLength = 2 + 4 + 2 + 1 + valueLength
  const payload = Buffer.alloc(payloadLength)

  let offset = 0

  // Count of state variables (1)
  payload.writeUInt16BE(1, offset)
  offset += 2

  // Object ID (32-bit, big-endian)
  payload.writeUInt32BE(objectId, offset)
  offset += 4

  // State Variable ID (16-bit, big-endian)
  payload.writeUInt16BE(stateVariableId, offset)
  offset += 2

  // Data type
  payload.writeUInt8(dataType, offset++)

  // Value based on data type
  switch (dataType) {
    case 0x01:
      payload.writeUInt8(value & 0xff, offset)
      break
    case 0x02:
      payload.writeUInt16BE(value & 0xffff, offset)
      break
    case 0x04:
      payload.writeUInt32BE(value, offset)
      break
  }

  return payload
}

/**
 * Build Get parameter payload
 *
 * @param objectId - Object ID for the zone/input
 * @param stateVariableId - State variable ID to get
 * @returns Payload buffer
 */
export function buildGetPayload(objectId: number, stateVariableId: number): Buffer {
  // Get payload structure:
  // - Count: 2 bytes
  // - Object ID: 4 bytes
  // - State Variable ID: 2 bytes

  const payload = Buffer.alloc(8)

  let offset = 0

  // Count of state variables to get (1)
  payload.writeUInt16BE(1, offset)
  offset += 2

  // Object ID (32-bit, big-endian)
  payload.writeUInt32BE(objectId, offset)
  offset += 4

  // State Variable ID (16-bit, big-endian)
  payload.writeUInt16BE(stateVariableId, offset)

  return payload
}

/**
 * Build Recall Scene/Preset payload
 *
 * @param sceneNumber - Scene number to recall (0-based or 1-based depending on device)
 * @returns Payload buffer
 */
export function buildRecallScenePayload(sceneNumber: number): Buffer {
  // Recall scene payload:
  // - Scene number: 2 bytes (big-endian)

  const payload = Buffer.alloc(2)
  payload.writeUInt16BE(sceneNumber & 0xffff, 0)

  return payload
}

/**
 * Build Ping/Keep-alive frame
 *
 * @param sequenceNumber - Sequence number for tracking
 * @returns Complete ping frame
 */
export function buildPingFrame(sequenceNumber: number = 0): Buffer {
  // Ping has no payload
  const emptyPayload = Buffer.alloc(0)
  return buildFrame(DBX_PROTOCOL.MESSAGE_ID.PING, emptyPayload, sequenceNumber)
}

/**
 * Build Volume Set frame
 *
 * @param zone - Zone number (0-based)
 * @param volume - Volume value (0-415)
 * @param stereo - If true, set both left and right channels
 * @param sequenceNumber - Sequence number
 * @returns Complete frame buffer
 */
export function buildVolumeSetFrame(
  zone: number,
  volume: number,
  stereo: boolean = true,
  sequenceNumber: number = 0
): Buffer {
  // Clamp volume to valid range
  const clampedVolume = Math.max(0, Math.min(415, Math.round(volume)))

  // Zone object IDs (typical ZonePRO addressing)
  // Zone 1 = 0x00010001, Zone 2 = 0x00010002, etc.
  const baseObjectId = 0x00010000 + zone + 1

  // State variable ID for volume (typically 0x0000 for main level)
  const volumeSVId = 0x0000

  if (stereo) {
    // Build payload for stereo pair (left and right channels)
    // Left channel object ID: base
    // Right channel object ID: base + 0x00100000

    const leftObjectId = baseObjectId
    const rightObjectId = baseObjectId + 0x00100000

    // Build combined payload for both channels
    const payload = Buffer.alloc(2 + (4 + 2 + 1 + 2) * 2) // Count + 2 SVs

    let offset = 0

    // Count of state variables (2 - left and right)
    payload.writeUInt16BE(2, offset)
    offset += 2

    // Left channel
    payload.writeUInt32BE(leftObjectId, offset)
    offset += 4
    payload.writeUInt16BE(volumeSVId, offset)
    offset += 2
    payload.writeUInt8(0x02, offset++) // uint16 data type
    payload.writeUInt16BE(clampedVolume, offset)
    offset += 2

    // Right channel
    payload.writeUInt32BE(rightObjectId, offset)
    offset += 4
    payload.writeUInt16BE(volumeSVId, offset)
    offset += 2
    payload.writeUInt8(0x02, offset++) // uint16 data type
    payload.writeUInt16BE(clampedVolume, offset)

    return buildFrame(DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET, payload, sequenceNumber)
  } else {
    // Single channel (mono)
    const payload = buildMultiSVSetPayload(baseObjectId, volumeSVId, clampedVolume, 0x02)
    return buildFrame(DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET, payload, sequenceNumber)
  }
}

/**
 * Build Mute Set frame
 *
 * @param zone - Zone number (0-based)
 * @param muted - true for mute, false for unmute
 * @param sequenceNumber - Sequence number
 * @returns Complete frame buffer
 */
export function buildMuteSetFrame(
  zone: number,
  muted: boolean,
  sequenceNumber: number = 0
): Buffer {
  // Zone object ID
  const objectId = 0x00010000 + zone + 1

  // State variable ID for mute (typically 0x0001)
  const muteSVId = 0x0001

  const payload = buildMultiSVSetPayload(
    objectId,
    muteSVId,
    muted ? DBX_PROTOCOL.MUTE_ON : DBX_PROTOCOL.MUTE_OFF,
    0x01 // uint8 for mute state
  )

  return buildFrame(DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET, payload, sequenceNumber)
}

/**
 * Build Source Selection frame
 *
 * @param zone - Zone number (0-based)
 * @param sourceIndex - Source index (0-based)
 * @param sequenceNumber - Sequence number
 * @returns Complete frame buffer
 */
export function buildSourceSetFrame(
  zone: number,
  sourceIndex: number,
  sequenceNumber: number = 0
): Buffer {
  // Zone object ID
  const objectId = 0x00010000 + zone + 1

  // State variable ID for source selection (typically 0x0002)
  const sourceSVId = 0x0002

  const payload = buildMultiSVSetPayload(objectId, sourceSVId, sourceIndex, 0x01) // uint8

  return buildFrame(DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET, payload, sequenceNumber)
}

/**
 * Build Recall Scene frame
 *
 * @param sceneNumber - Scene number to recall (1-based typically)
 * @param sequenceNumber - Sequence number
 * @returns Complete frame buffer
 */
export function buildRecallSceneFrame(
  sceneNumber: number,
  sequenceNumber: number = 0
): Buffer {
  const payload = buildRecallScenePayload(sceneNumber)
  return buildFrame(DBX_PROTOCOL.MESSAGE_ID.RECALL_SCENE, payload, sequenceNumber)
}

/**
 * Parse a received HiQnet frame
 *
 * @param data - Received data buffer
 * @returns Parsed frame or null if invalid
 */
export function parseFrame(data: Buffer): {
  header: HiQnetHeader
  payload: Buffer
  valid: boolean
} | null {
  if (data.length < 4) {
    return null // Too short
  }

  // Check start byte
  if (data[0] !== DBX_PROTOCOL.FRAME_START_BYTE) {
    return null // Invalid start byte
  }

  // Read message length
  const messageLength = data.readUInt16BE(1)

  // Check if we have complete frame
  if (data.length < 3 + messageLength + 1) {
    return null // Incomplete frame
  }

  // Extract message data (after start byte and length)
  const messageData = data.slice(3, 3 + messageLength)

  // Verify CRC
  const receivedCRC = data[3 + messageLength]
  const calculatedCRC = calculateCRC8(messageData)

  if (receivedCRC !== calculatedCRC) {
    return {
      header: {} as HiQnetHeader,
      payload: Buffer.alloc(0),
      valid: false,
    }
  }

  // Parse header
  let offset = 0

  const version = messageData.readUInt8(offset++)
  const headerLength = messageData.readUInt8(offset++)
  const msgLength = messageData.readUInt16BE(offset)
  offset += 2

  const sourceAddress = messageData.readUInt32BE(offset)
  offset += 4

  const destinationAddress = messageData.readUInt32BE(offset)
  offset += 4

  const messageId = messageData.readUInt16BE(offset)
  offset += 2

  const flags = messageData.readUInt16BE(offset)
  offset += 2

  const hopCount = messageData.readUInt8(offset++)

  const sequenceNumber = messageData.readUInt16BE(offset)
  offset += 2

  // Extract payload (everything after header)
  const payload = messageData.slice(headerLength)

  return {
    header: {
      version,
      headerLength,
      messageLength: msgLength,
      sourceAddress,
      destinationAddress,
      messageId,
      flags,
      hopCount,
      sequenceNumber,
    },
    payload,
    valid: true,
  }
}

/**
 * Frame buffer class for accumulating received data
 *
 * Handles partial frames and extracts complete messages.
 */
export class FrameBuffer {
  private buffer: Buffer = Buffer.alloc(0)

  /**
   * Add received data to buffer
   */
  append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data])
  }

  /**
   * Try to extract a complete frame
   *
   * @returns Parsed frame or null if no complete frame available
   */
  extractFrame(): ReturnType<typeof parseFrame> {
    // Look for start byte
    const startIndex = this.buffer.indexOf(DBX_PROTOCOL.FRAME_START_BYTE)
    if (startIndex === -1) {
      this.buffer = Buffer.alloc(0) // No start byte, discard all
      return null
    }

    // Discard data before start byte
    if (startIndex > 0) {
      this.buffer = this.buffer.slice(startIndex)
    }

    // Check if we have enough data for length field
    if (this.buffer.length < 3) {
      return null
    }

    // Read message length
    const messageLength = this.buffer.readUInt16BE(1)

    // Check if we have complete frame
    const frameLength = 3 + messageLength + 1 // start + length + message + crc
    if (this.buffer.length < frameLength) {
      return null
    }

    // Extract frame data
    const frameData = this.buffer.slice(0, frameLength)

    // Remove frame from buffer
    this.buffer = this.buffer.slice(frameLength)

    // Parse and return
    return parseFrame(frameData)
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = Buffer.alloc(0)
  }

  /**
   * Get current buffer size
   */
  get size(): number {
    return this.buffer.length
  }
}

export default {
  calculateCRC8,
  buildFrame,
  buildMultiSVSetPayload,
  buildGetPayload,
  buildRecallScenePayload,
  buildPingFrame,
  buildVolumeSetFrame,
  buildMuteSetFrame,
  buildSourceSetFrame,
  buildRecallSceneFrame,
  parseFrame,
  FrameBuffer,
}
