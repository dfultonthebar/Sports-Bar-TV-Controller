/**
 * BSS Soundweb London BLU series type definitions
 */

export interface BssDeviceConfig {
  id: string
  name: string
  model: BssModel
  ipAddress: string
  port: number  // HiQnet default: 1023
  nodeAddress?: number  // HiQnet node address (0x1-0xFFFE)
  virtualDeviceId?: number
}

export type BssModel =
  | 'BLU-50'
  | 'BLU-100'
  | 'BLU-120'
  | 'BLU-160'
  | 'BLU-320'
  | 'BLU-800'
  | 'BLU-806'
  | 'BLU-806DA'

export interface BssModelConfig {
  inputs: number
  outputs: number
  zones: number
  hasDante: boolean
  hasCobraNet: boolean
  hasCardSlots: boolean
  bluLinkChannels: 48 | 256
}

export const BSS_MODEL_CONFIGS: Record<BssModel, BssModelConfig> = {
  'BLU-50': { inputs: 4, outputs: 4, zones: 4, hasDante: false, hasCobraNet: false, hasCardSlots: false, bluLinkChannels: 48 },
  'BLU-100': { inputs: 12, outputs: 8, zones: 8, hasDante: false, hasCobraNet: false, hasCardSlots: false, bluLinkChannels: 48 },
  'BLU-120': { inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: false, hasCardSlots: true, bluLinkChannels: 256 },
  'BLU-160': { inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: false, hasCardSlots: true, bluLinkChannels: 256 },
  'BLU-320': { inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: true, hasCardSlots: true, bluLinkChannels: 256 },
  'BLU-800': { inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: true, hasCardSlots: true, bluLinkChannels: 256 },
  'BLU-806': { inputs: 16, outputs: 16, zones: 8, hasDante: true, hasCobraNet: false, hasCardSlots: true, bluLinkChannels: 256 },
  'BLU-806DA': { inputs: 16, outputs: 16, zones: 8, hasDante: true, hasCobraNet: false, hasCardSlots: true, bluLinkChannels: 256 },
}

export interface BssConnectionState {
  isConnected: boolean
  lastConnected?: Date
  lastError?: string
  firmware?: string
  serialNumber?: string
}

export interface BssZoneState {
  zoneId: number
  name: string
  mute: boolean
  gain: number  // dB, typically -80 to +12
  source: number
}

export interface BssInputState {
  inputId: number
  name: string
  gain: number
  phantomPower?: boolean
  mute: boolean
}

export interface BssOutputState {
  outputId: number
  name: string
  gain: number
  mute: boolean
}

export interface BssDeviceState {
  connection: BssConnectionState
  zones: BssZoneState[]
  inputs: BssInputState[]
  outputs: BssOutputState[]
}

// HiQnet message types
export enum HiQnetMessageType {
  KeepAlive = 0x00,
  GetAttributes = 0x01,
  SetAttributes = 0x02,
  Subscribe = 0x03,
  Unsubscribe = 0x04,
  AttributeChanged = 0x05,
  LocateOn = 0x06,
  LocateOff = 0x07,
  RequestNetworkInfo = 0x08,
  NetworkInfo = 0x09,
}

export interface HiQnetMessage {
  version: number
  headerLength: number
  messageLength: number
  sourceAddress: number
  destinationAddress: number
  messageId: number
  flags: number
  hopCount: number
  sequenceNumber: number
  messageType: HiQnetMessageType
  payload: Buffer
}
