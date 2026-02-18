/**
 * HiQnet v1.0 Protocol Implementation for dbx ZonePRO (TCP)
 *
 * IMPORTANT: TCP and RS-232 use DIFFERENT framing!
 * - RS-232: Frame Start (0x64) + Frame Count + Message + CRC checksum
 * - TCP: Just the raw HiQnet message (no FS, FC, or CRC)
 *
 * TCP Header Structure (25 bytes minimum):
 * - Version: 1 byte (0x01 for ZonePRO)
 * - Header Length: 1 byte (0x19 = 25)
 * - Message Length: 4 bytes (ULONG, big-endian) - total from version through payload
 * - Source Address: 6 bytes (device:2 + VD:1 + object:3)
 * - Dest Address: 6 bytes (device:2 + VD:1 + object:3)
 * - Message ID: 2 bytes
 * - Flags: 2 bytes
 * - Hop Count: 1 byte (0x05)
 * - Sequence Number: 2 bytes
 *
 * MultiParamSet (0x0100) payload:
 * - Num SVs: 2 bytes
 * - Per SV: SV_ID (2 bytes) + Data Type (1 byte) + Value (variable)
 * NOTE: Object ID is in the header dest address, NOT in the payload!
 *
 * HiQnet Data Types:
 * - 0 = BYTE (signed, 1 byte)
 * - 1 = UBYTE (unsigned, 1 byte)
 * - 2 = WORD (signed, 2 bytes)
 * - 3 = UWORD (unsigned, 2 bytes)
 * - 4 = LONG (signed, 4 bytes)
 * - 5 = ULONG (unsigned, 4 bytes)
 *
 * Router Object State Variables:
 * - SV 0x0000 = Input Source Selection (UBYTE)
 * - SV 0x0001 = Master Fader/Volume (UWORD, 0-415)
 * - SV 0x0002 = Master Mute (UBYTE, 0=unmute, 1=mute)
 */

import { DBX_PROTOCOL } from './config'

// HiQnet 6-byte fully qualified address
export interface HiQnetAddress {
  device: number  // Device address (16-bit)
  vd: number      // Virtual Device (8-bit)
  object: number  // Object address (24-bit, 3 bytes)
}

// Default source address for third-party controllers
export const CONTROLLER_ADDRESS: HiQnetAddress = {
  device: 0x0033,
  vd: 0x00,
  object: 0x000000,
}

// Default ZonePRO Router Object IDs
// These MUST be configured per installation via ZonePRO Designer (Ctrl+Shift+O)
// Confirmed from ZonePRO Designer on 1260m:
//   12z1: b0=31(0x1F), b1=0, b2=5, b3=1(VD) → vd:0x01, object:0x05001F
export const DEFAULT_ROUTER_OBJECTS: HiQnetAddress[] = [
  { device: 0x0001, vd: 0x01, object: 0x05001F }, // Ch1 Router (12z1, confirmed: b0=31,b1=0,b2=5)
  { device: 0x0001, vd: 0x01, object: 0x050120 }, // Ch2 Router (12z2, confirmed: b0=32,b1=1,b2=5)
  { device: 0x0001, vd: 0x01, object: 0x050221 }, // Ch3 Router (estimated)
  { device: 0x0001, vd: 0x01, object: 0x050322 }, // Ch4 Router (estimated)
  { device: 0x0001, vd: 0x01, object: 0x050423 }, // Ch5 Router (estimated)
  { device: 0x0001, vd: 0x01, object: 0x050524 }, // Ch6 Router (estimated)
]

// HiQnet data type constants
export const HIQNET_DATA_TYPE = {
  BYTE: 0,    // signed 8-bit
  UBYTE: 1,   // unsigned 8-bit
  WORD: 2,    // signed 16-bit
  UWORD: 3,   // unsigned 16-bit
  LONG: 4,    // signed 32-bit
  ULONG: 5,   // unsigned 32-bit
} as const

// TCP header constants
const HIQNET_VERSION = 0x01
const HIQNET_HEADER_LENGTH = 25 // 0x19
const HIQNET_HOP_COUNT = 0x05

// HiQnet message header structure
export interface HiQnetHeader {
  version: number
  headerLength: number
  messageLength: number
  sourceAddress: HiQnetAddress
  destinationAddress: HiQnetAddress
  messageId: number
  flags: number
  hopCount: number
  sequenceNumber: number
}

/**
 * Write a 6-byte HiQnet address to a buffer
 */
function writeAddress(buf: Buffer, offset: number, addr: HiQnetAddress): number {
  buf.writeUInt16BE(addr.device, offset)
  offset += 2
  buf.writeUInt8(addr.vd, offset)
  offset += 1
  // Write 3-byte object address (24-bit, big-endian)
  buf.writeUInt8((addr.object >> 16) & 0xFF, offset)
  buf.writeUInt8((addr.object >> 8) & 0xFF, offset + 1)
  buf.writeUInt8(addr.object & 0xFF, offset + 2)
  offset += 3
  return offset
}

/**
 * Read a 6-byte HiQnet address from a buffer
 */
function readAddress(buf: Buffer, offset: number): { addr: HiQnetAddress; newOffset: number } {
  const device = buf.readUInt16BE(offset)
  offset += 2
  const vd = buf.readUInt8(offset)
  offset += 1
  const object = (buf.readUInt8(offset) << 16) | (buf.readUInt8(offset + 1) << 8) | buf.readUInt8(offset + 2)
  offset += 3
  return { addr: { device, vd, object }, newOffset: offset }
}

/**
 * Build a HiQnet TCP frame (no RS-232 framing)
 *
 * @param messageId - Message ID (from DBX_PROTOCOL.MESSAGE_ID)
 * @param destAddress - Destination HiQnet address (device + VD + object)
 * @param payload - Command payload data
 * @param sequenceNumber - Message sequence number
 * @param sourceAddress - Source address (defaults to controller 0x0033)
 * @returns Buffer ready to send over TCP
 */
export function buildTcpFrame(
  messageId: number,
  destAddress: HiQnetAddress,
  payload: Buffer,
  sequenceNumber: number = 0,
  sourceAddress: HiQnetAddress = CONTROLLER_ADDRESS
): Buffer {
  const messageLength = HIQNET_HEADER_LENGTH + payload.length
  const frame = Buffer.alloc(messageLength)

  let offset = 0

  // Version
  frame.writeUInt8(HIQNET_VERSION, offset++)

  // Header length
  frame.writeUInt8(HIQNET_HEADER_LENGTH, offset++)

  // Message length (32-bit ULONG, big-endian)
  frame.writeUInt32BE(messageLength, offset)
  offset += 4

  // Source address (6 bytes)
  offset = writeAddress(frame, offset, sourceAddress)

  // Destination address (6 bytes)
  offset = writeAddress(frame, offset, destAddress)

  // Message ID (16-bit)
  frame.writeUInt16BE(messageId, offset)
  offset += 2

  // Flags (16-bit)
  frame.writeUInt16BE(0x0000, offset)
  offset += 2

  // Hop count
  frame.writeUInt8(HIQNET_HOP_COUNT, offset++)

  // Sequence number (16-bit)
  frame.writeUInt16BE(sequenceNumber & 0xFFFF, offset)
  offset += 2

  // Copy payload
  payload.copy(frame, offset)

  return frame
}

/**
 * Build MultiParamSet payload for setting state variables
 * NOTE: Object ID is NOT in the payload - it's in the header destination address
 *
 * @param svId - State Variable ID
 * @param value - Value to set
 * @param dataType - HiQnet data type (use HIQNET_DATA_TYPE constants)
 * @returns Payload buffer
 */
export function buildMultiParamSetPayload(
  svId: number,
  value: number,
  dataType: number = HIQNET_DATA_TYPE.UWORD
): Buffer {
  let valueLength: number
  switch (dataType) {
    case HIQNET_DATA_TYPE.BYTE:
    case HIQNET_DATA_TYPE.UBYTE:
      valueLength = 1
      break
    case HIQNET_DATA_TYPE.WORD:
    case HIQNET_DATA_TYPE.UWORD:
      valueLength = 2
      break
    case HIQNET_DATA_TYPE.LONG:
    case HIQNET_DATA_TYPE.ULONG:
      valueLength = 4
      break
    default:
      valueLength = 2
  }

  // Payload: NumSVs (2) + SV_ID (2) + DataType (1) + Value (variable)
  const payload = Buffer.alloc(2 + 2 + 1 + valueLength)
  let offset = 0

  // Number of SVs
  payload.writeUInt16BE(1, offset)
  offset += 2

  // SV ID
  payload.writeUInt16BE(svId, offset)
  offset += 2

  // Data type
  payload.writeUInt8(dataType, offset++)

  // Value
  switch (dataType) {
    case HIQNET_DATA_TYPE.BYTE:
    case HIQNET_DATA_TYPE.UBYTE:
      payload.writeUInt8(value & 0xFF, offset)
      break
    case HIQNET_DATA_TYPE.WORD:
      payload.writeInt16BE(value & 0xFFFF, offset)
      break
    case HIQNET_DATA_TYPE.UWORD:
      payload.writeUInt16BE(value & 0xFFFF, offset)
      break
    case HIQNET_DATA_TYPE.LONG:
      payload.writeInt32BE(value, offset)
      break
    case HIQNET_DATA_TYPE.ULONG:
      payload.writeUInt32BE(value, offset)
      break
  }

  return payload
}

/**
 * Build Volume Set frame for a zone's Router object
 *
 * @param destAddress - Router object's HiQnet address
 * @param volume - Volume value (0-415, where 215 = 0dB, 415 = +20dB)
 * @param sequenceNumber - Sequence number
 * @returns TCP frame buffer
 */
export function buildVolumeSetFrame(
  destAddress: HiQnetAddress,
  volume: number,
  sequenceNumber: number = 0
): Buffer {
  const clampedVolume = Math.max(0, Math.min(415, Math.round(volume)))

  // SV 0x0001 = Master Fader, Data Type 3 = UWORD
  const payload = buildMultiParamSetPayload(0x0001, clampedVolume, HIQNET_DATA_TYPE.UWORD)

  return buildTcpFrame(
    DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET,
    destAddress,
    payload,
    sequenceNumber
  )
}

/**
 * Build Mute Set frame for a zone's Router object
 *
 * @param destAddress - Router object's HiQnet address
 * @param muted - true for mute, false for unmute
 * @param sequenceNumber - Sequence number
 * @returns TCP frame buffer
 */
export function buildMuteSetFrame(
  destAddress: HiQnetAddress,
  muted: boolean,
  sequenceNumber: number = 0
): Buffer {
  // SV 0x0002 = Master Mute, Data Type 1 = UBYTE
  const payload = buildMultiParamSetPayload(
    0x0002,
    muted ? DBX_PROTOCOL.MUTE_ON : DBX_PROTOCOL.MUTE_OFF,
    HIQNET_DATA_TYPE.UBYTE
  )

  return buildTcpFrame(
    DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET,
    destAddress,
    payload,
    sequenceNumber
  )
}

/**
 * Build Source Selection frame for a zone's Router object
 *
 * @param destAddress - Router object's HiQnet address
 * @param sourceIndex - Source index (0=none, 1=first input, 2=second, etc.)
 * @param sequenceNumber - Sequence number
 * @returns TCP frame buffer
 */
export function buildSourceSetFrame(
  destAddress: HiQnetAddress,
  sourceIndex: number,
  sequenceNumber: number = 0
): Buffer {
  // SV 0x0000 = Input Source Selection, Data Type 1 = UBYTE
  const payload = buildMultiParamSetPayload(0x0000, sourceIndex, HIQNET_DATA_TYPE.UBYTE)

  return buildTcpFrame(
    DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET,
    destAddress,
    payload,
    sequenceNumber
  )
}

/**
 * Build Recall Scene frame
 *
 * @param destAddress - Device address for scene recall
 * @param sceneNumber - Scene number to recall (1-based)
 * @param sequenceNumber - Sequence number
 * @returns TCP frame buffer
 */
export function buildRecallSceneFrame(
  destAddress: HiQnetAddress,
  sceneNumber: number,
  sequenceNumber: number = 0
): Buffer {
  const payload = Buffer.alloc(2)
  payload.writeUInt16BE(sceneNumber & 0xFFFF, 0)

  return buildTcpFrame(
    DBX_PROTOCOL.MESSAGE_ID.RECALL_SCENE,
    destAddress,
    payload,
    sequenceNumber
  )
}

/**
 * Build a MultiParamGet frame to read a state variable
 *
 * @param destAddress - Object's HiQnet address
 * @param svId - State Variable ID to read
 * @param sequenceNumber - Sequence number
 * @returns TCP frame buffer
 */
export function buildGetFrame(
  destAddress: HiQnetAddress,
  svId: number,
  sequenceNumber: number = 0
): Buffer {
  // Get payload: NumSVs (2) + SV_ID (2)
  const payload = Buffer.alloc(4)
  payload.writeUInt16BE(1, 0)   // 1 SV to get
  payload.writeUInt16BE(svId, 2)

  return buildTcpFrame(
    DBX_PROTOCOL.MESSAGE_ID.GET,
    destAddress,
    payload,
    sequenceNumber
  )
}

/**
 * Parse a received HiQnet TCP frame
 *
 * @param data - Received data buffer (raw TCP, no RS-232 framing)
 * @returns Parsed frame or null if invalid/incomplete
 */
export function parseTcpFrame(data: Buffer): {
  header: HiQnetHeader
  payload: Buffer
  valid: boolean
} | null {
  // Minimum: version(1) + hdrlen(1) + msglen(4) = 6 bytes to read length
  if (data.length < 6) {
    return null
  }

  const version = data.readUInt8(0)
  const headerLength = data.readUInt8(1)
  const messageLength = data.readUInt32BE(2)

  // Check if we have the complete message
  if (data.length < messageLength) {
    return null
  }

  // Minimum header is 25 bytes
  if (headerLength < 25) {
    return { header: {} as HiQnetHeader, payload: Buffer.alloc(0), valid: false }
  }

  let offset = 6

  // Source address (6 bytes)
  const { addr: sourceAddress, newOffset: afterSrc } = readAddress(data, offset)
  offset = afterSrc

  // Destination address (6 bytes)
  const { addr: destinationAddress, newOffset: afterDst } = readAddress(data, offset)
  offset = afterDst

  // Message ID
  const messageId = data.readUInt16BE(offset)
  offset += 2

  // Flags
  const flags = data.readUInt16BE(offset)
  offset += 2

  // Hop count
  const hopCount = data.readUInt8(offset++)

  // Sequence number
  const sequenceNumber = data.readUInt16BE(offset)
  offset += 2

  // Payload is everything after header
  const payload = data.subarray(headerLength, messageLength)

  return {
    header: {
      version,
      headerLength,
      messageLength,
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
 * TCP Frame buffer for accumulating received data
 * TCP frames have no start byte delimiter - uses message length field
 */
export class TcpFrameBuffer {
  private buffer: Buffer = Buffer.alloc(0)

  append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data])
  }

  extractFrame(): ReturnType<typeof parseTcpFrame> {
    // Need at least 6 bytes to read the message length
    if (this.buffer.length < 6) {
      return null
    }

    // Read message length (4 bytes at offset 2)
    const messageLength = this.buffer.readUInt32BE(2)

    // Sanity check
    if (messageLength > 65535 || messageLength < 25) {
      // Invalid length - discard first byte and try again
      this.buffer = this.buffer.subarray(1)
      return null
    }

    // Check if we have the complete frame
    if (this.buffer.length < messageLength) {
      return null
    }

    // Extract frame data
    const frameData = this.buffer.subarray(0, messageLength)
    this.buffer = this.buffer.subarray(messageLength)

    return parseTcpFrame(frameData)
  }

  clear(): void {
    this.buffer = Buffer.alloc(0)
  }

  get size(): number {
    return this.buffer.length
  }
}

// ============================================================
// Legacy exports for backward compatibility (RS-232 framing)
// ============================================================

/** Calculate CCITT-8 CRC checksum (RS-232 only) */
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

// Keep old FrameBuffer as alias for RS-232 use
export const FrameBuffer = TcpFrameBuffer

// Legacy buildFrame - now calls buildTcpFrame with default address
export function buildFrame(
  messageId: number,
  payload: Buffer,
  sequenceNumber: number = 0
): Buffer {
  return buildTcpFrame(
    messageId,
    DEFAULT_ROUTER_OBJECTS[0],
    payload,
    sequenceNumber
  )
}

// Legacy buildMultiSVSetPayload
export function buildMultiSVSetPayload(
  _objectId: number,
  stateVariableId: number,
  value: number,
  dataType: number = HIQNET_DATA_TYPE.UWORD
): Buffer {
  return buildMultiParamSetPayload(stateVariableId, value, dataType)
}

// Legacy buildGetPayload
export function buildGetPayload(_objectId: number, stateVariableId: number): Buffer {
  const payload = Buffer.alloc(4)
  payload.writeUInt16BE(1, 0)
  payload.writeUInt16BE(stateVariableId, 2)
  return payload
}

// Legacy buildRecallScenePayload
export function buildRecallScenePayload(sceneNumber: number): Buffer {
  const payload = Buffer.alloc(2)
  payload.writeUInt16BE(sceneNumber & 0xFFFF, 0)
  return payload
}

// No ping needed over TCP
export function buildPingFrame(_sequenceNumber: number = 0): Buffer {
  return Buffer.alloc(0)
}

export function parseFrame(data: Buffer) {
  return parseTcpFrame(data)
}

export default {
  buildTcpFrame,
  buildMultiParamSetPayload,
  buildVolumeSetFrame,
  buildMuteSetFrame,
  buildSourceSetFrame,
  buildRecallSceneFrame,
  buildGetFrame,
  parseTcpFrame,
  TcpFrameBuffer,
  HIQNET_DATA_TYPE,
  CONTROLLER_ADDRESS,
  DEFAULT_ROUTER_OBJECTS,
  // Legacy
  calculateCRC8,
  FrameBuffer,
  buildFrame,
  buildMultiSVSetPayload,
  buildGetPayload,
  buildRecallScenePayload,
  buildPingFrame,
  parseFrame,
}
