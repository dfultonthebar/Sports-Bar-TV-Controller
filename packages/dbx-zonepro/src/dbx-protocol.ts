/**
 * HiQnet v1.0 Protocol Implementation for dbx ZonePRO (TCP)
 *
 * CONFIRMED WORKING - Feb 2026, tested on ZonePRO 1260m at Lucky's 1313
 *
 * IMPORTANT: TCP and RS-232 use DIFFERENT framing!
 * - RS-232: 0xF0 prefix + Frame Start (0x64) + Frame Count (0x00) + Message + CCITT-8 checksum
 * - TCP: Just the raw HiQnet message (no prefix, no FS, FC, or checksum)
 *
 * TCP Header Structure (21 bytes):
 * - Version: 1 byte (0x01)
 * - Length: 4 bytes (ULONG) - total frame size from Version to end of payload
 * - Source Address: 6 bytes (VD:2 + Object:4)
 * - Dest Address: 6 bytes (VD:2 + Object:4)
 * - Message ID: 2 bytes (0x0100 = MultiSVSet)
 * - Flags: 2 bytes (0x0500 = hop count 5)
 *
 * Address format: UWORD(VirtualDevice) + ULONG(Object) = 6 bytes
 * - Source VD = 0x0033 (3rd-party controller), Source Object mirrors dest
 * - Dest VD = device node address (e.g. 0x001E for node 30)
 * - Object IDs from ZonePRO Designer (Ctrl+Shift+O), sent as b3,b2,b1,b0
 *
 * MultiSVSet (0x0100) payload:
 * - Num SVs: 2 bytes (UWORD)
 * - Per SV: SV_ID (2 bytes) + Data Type (1 byte) + Value (variable)
 *
 * Router Object State Variables:
 * - SV 0x0000 = Input Source Selection (UBYTE)
 * - SV 0x0001 = Master Fader/Volume (UWORD, 0-415)
 * - SV 0x0002 = Master Mute (UBYTE, 0=unmute, 1=mute)
 *
 * One-way protocol: dbx does NOT respond to 3rd-party commands (fire-and-forget)
 */

import { DBX_PROTOCOL } from './config'

// HiQnet 6-byte address: UWORD(VD) + ULONG(Object)
// The "device" field is the VD (VirtualDevice / node network address)
// The "vd" field is the internal VD index (high byte of the 4-byte object)
// The "object" field is the remaining 3 bytes of the object address
// On the wire: device(2) + vd(1) + object(3) = 6 bytes
export interface HiQnetAddress {
  device: number  // Network VD / device address (16-bit UWORD)
  vd: number      // Internal Virtual Device index (8-bit, high byte of object)
  object: number  // Object address (24-bit, lower 3 bytes)
}

// Source address for 3rd-party controller
// VD (device field) = 0x0033 per ZonePRO Protocol Guide
// The vd+object fields are set to mirror the destination per command
export const CONTROLLER_DEVICE: number = 0x0033

// Default ZonePRO 1260m Router Object IDs (Lucky's 1313)
// CONFIRMED via mute/volume testing Feb 2026
// Object IDs are installation-specific - get from ZonePRO Designer (Ctrl+Shift+O)
export const DEFAULT_ROUTER_OBJECTS: HiQnetAddress[] = [
  { device: 0x001E, vd: 0x01, object: 0x05001F }, // Ch1 Router (Main Bar) - CONFIRMED
  { device: 0x001E, vd: 0x01, object: 0x050020 }, // Ch2 Router (Banquet) - CONFIRMED
  { device: 0x001E, vd: 0x01, object: 0x050021 }, // Ch3 Router (estimated)
  { device: 0x001E, vd: 0x01, object: 0x050022 }, // Ch4 Router (estimated)
  { device: 0x001E, vd: 0x01, object: 0x050023 }, // Ch5 Router (estimated)
  { device: 0x001E, vd: 0x01, object: 0x050024 }, // Ch6 Router (estimated)
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

// TCP header: 21 bytes (confirmed working format)
// Version(1) + Length(4) + Src(6) + Dst(6) + MsgID(2) + Flags(2)
const HIQNET_VERSION = 0x01
const HIQNET_HEADER_SIZE = 21
const HIQNET_FLAGS = 0x0500 // Hop count 5 (from Protocol Guide examples)

// Router Object State Variable IDs
export const ROUTER_SV = {
  INPUT_SOURCE: 0x0000,  // UBYTE - input source selection
  MASTER_FADER: 0x0001,  // UWORD - volume (0-415)
  MASTER_MUTE: 0x0002,   // UBYTE - mute (0=off, 1=on)
} as const

// HiQnet message header structure
export interface HiQnetHeader {
  version: number
  messageLength: number
  sourceAddress: HiQnetAddress
  destinationAddress: HiQnetAddress
  messageId: number
  flags: number
}

/**
 * Write a 6-byte HiQnet address to a buffer
 * Format: device(UWORD:2) + vd(UBYTE:1) + object(3 bytes) = 6 bytes
 */
function writeAddress(buf: Buffer, offset: number, addr: HiQnetAddress): number {
  buf.writeUInt16BE(addr.device, offset)
  offset += 2
  buf.writeUInt8(addr.vd, offset)
  offset += 1
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
 * Confirmed working format: 21-byte header + payload
 *
 * Source address mirrors destination but with device=0x0033 (3rd-party controller)
 */
export function buildTcpFrame(
  messageId: number,
  destAddress: HiQnetAddress,
  payload: Buffer,
  _sequenceNumber: number = 0
): Buffer {
  const totalLength = HIQNET_HEADER_SIZE + payload.length
  const frame = Buffer.alloc(totalLength)

  let offset = 0

  // Version
  frame.writeUInt8(HIQNET_VERSION, offset++)

  // Length: total frame size from Version to end of payload
  frame.writeUInt32BE(totalLength, offset)
  offset += 4

  // Source address: 3rd-party controller (0x0033) + mirror dest object
  const sourceAddress: HiQnetAddress = {
    device: CONTROLLER_DEVICE,
    vd: destAddress.vd,
    object: destAddress.object,
  }
  offset = writeAddress(frame, offset, sourceAddress)

  // Destination address
  offset = writeAddress(frame, offset, destAddress)

  // Message ID
  frame.writeUInt16BE(messageId, offset)
  offset += 2

  // Flags
  frame.writeUInt16BE(HIQNET_FLAGS, offset)
  offset += 2

  // Copy payload
  payload.copy(frame, offset)

  return frame
}

/**
 * Build MultiSVSet payload for setting state variables
 * Payload: NumSVs(2) + SV_ID(2) + DataType(1) + Value(variable)
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

  const payload = Buffer.alloc(2 + 2 + 1 + valueLength)
  let offset = 0

  payload.writeUInt16BE(1, offset)        // NumSVs = 1
  offset += 2
  payload.writeUInt16BE(svId, offset)     // SV_ID
  offset += 2
  payload.writeUInt8(dataType, offset++)  // DataType

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
 * SV_ID=0x0001, DataType=UWORD, Value=0-415
 */
export function buildVolumeSetFrame(
  destAddress: HiQnetAddress,
  volume: number,
  sequenceNumber: number = 0
): Buffer {
  const clampedVolume = Math.max(0, Math.min(415, Math.round(volume)))
  const payload = buildMultiParamSetPayload(ROUTER_SV.MASTER_FADER, clampedVolume, HIQNET_DATA_TYPE.UWORD)
  return buildTcpFrame(DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET, destAddress, payload, sequenceNumber)
}

/**
 * Build Mute Set frame for a zone's Router object
 * SV_ID=0x0002, DataType=UBYTE, Value=0/1
 */
export function buildMuteSetFrame(
  destAddress: HiQnetAddress,
  muted: boolean,
  sequenceNumber: number = 0
): Buffer {
  const payload = buildMultiParamSetPayload(ROUTER_SV.MASTER_MUTE, muted ? 1 : 0, HIQNET_DATA_TYPE.UBYTE)
  return buildTcpFrame(DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET, destAddress, payload, sequenceNumber)
}

/**
 * Build Source Selection frame for a zone's Router object
 * SV_ID=0x0000, DataType=UBYTE, Value=source index
 */
export function buildSourceSetFrame(
  destAddress: HiQnetAddress,
  sourceIndex: number,
  sequenceNumber: number = 0
): Buffer {
  const payload = buildMultiParamSetPayload(ROUTER_SV.INPUT_SOURCE, sourceIndex, HIQNET_DATA_TYPE.UBYTE)
  return buildTcpFrame(DBX_PROTOCOL.MESSAGE_ID.MULTI_SV_SET, destAddress, payload, sequenceNumber)
}

/**
 * Build Recall Scene frame
 */
export function buildRecallSceneFrame(
  destAddress: HiQnetAddress,
  sceneNumber: number,
  sequenceNumber: number = 0
): Buffer {
  const payload = Buffer.alloc(2)
  payload.writeUInt16BE(sceneNumber & 0xFFFF, 0)
  return buildTcpFrame(DBX_PROTOCOL.MESSAGE_ID.RECALL_SCENE, destAddress, payload, sequenceNumber)
}

/**
 * Build a MultiParamGet frame to read a state variable
 */
export function buildGetFrame(
  destAddress: HiQnetAddress,
  svId: number,
  sequenceNumber: number = 0
): Buffer {
  const payload = Buffer.alloc(4)
  payload.writeUInt16BE(1, 0)
  payload.writeUInt16BE(svId, 2)
  return buildTcpFrame(DBX_PROTOCOL.MESSAGE_ID.GET, destAddress, payload, sequenceNumber)
}

/**
 * Parse a received HiQnet TCP frame (21-byte header)
 */
export function parseTcpFrame(data: Buffer): {
  header: HiQnetHeader
  payload: Buffer
  valid: boolean
} | null {
  if (data.length < HIQNET_HEADER_SIZE) {
    return null
  }

  const version = data.readUInt8(0)
  const messageLength = data.readUInt32BE(1)

  if (data.length < messageLength) {
    return null
  }

  let offset = 5

  const { addr: sourceAddress, newOffset: afterSrc } = readAddress(data, offset)
  offset = afterSrc

  const { addr: destinationAddress, newOffset: afterDst } = readAddress(data, offset)
  offset = afterDst

  const messageId = data.readUInt16BE(offset)
  offset += 2

  const flags = data.readUInt16BE(offset)
  offset += 2

  const payload = data.subarray(HIQNET_HEADER_SIZE, messageLength)

  return {
    header: {
      version,
      messageLength,
      sourceAddress,
      destinationAddress,
      messageId,
      flags,
    },
    payload,
    valid: true,
  }
}

/**
 * TCP Frame buffer for accumulating received data
 */
export class TcpFrameBuffer {
  private buffer: Buffer = Buffer.alloc(0)

  append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data])
  }

  extractFrame(): ReturnType<typeof parseTcpFrame> {
    if (this.buffer.length < HIQNET_HEADER_SIZE) {
      return null
    }

    const messageLength = this.buffer.readUInt32BE(1)

    if (messageLength > 65535 || messageLength < HIQNET_HEADER_SIZE) {
      this.buffer = this.buffer.subarray(1)
      return null
    }

    if (this.buffer.length < messageLength) {
      return null
    }

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
// Legacy exports for backward compatibility
// ============================================================

// Backward-compatible CONTROLLER_ADDRESS
export const CONTROLLER_ADDRESS: HiQnetAddress = {
  device: CONTROLLER_DEVICE,
  vd: 0x00,
  object: 0x000000,
}

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

export const FrameBuffer = TcpFrameBuffer

export function buildFrame(
  messageId: number,
  payload: Buffer,
  sequenceNumber: number = 0
): Buffer {
  return buildTcpFrame(messageId, DEFAULT_ROUTER_OBJECTS[0], payload, sequenceNumber)
}

export function buildMultiSVSetPayload(
  _objectId: number,
  stateVariableId: number,
  value: number,
  dataType: number = HIQNET_DATA_TYPE.UWORD
): Buffer {
  return buildMultiParamSetPayload(stateVariableId, value, dataType)
}

export function buildGetPayload(_objectId: number, stateVariableId: number): Buffer {
  const payload = Buffer.alloc(4)
  payload.writeUInt16BE(1, 0)
  payload.writeUInt16BE(stateVariableId, 2)
  return payload
}

export function buildRecallScenePayload(sceneNumber: number): Buffer {
  const payload = Buffer.alloc(2)
  payload.writeUInt16BE(sceneNumber & 0xFFFF, 0)
  return payload
}

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
  ROUTER_SV,
  CONTROLLER_ADDRESS,
  CONTROLLER_DEVICE,
  DEFAULT_ROUTER_OBJECTS,
  calculateCRC8,
  FrameBuffer,
  buildFrame,
  buildMultiSVSetPayload,
  buildGetPayload,
  buildRecallScenePayload,
  buildPingFrame,
  parseFrame,
}
