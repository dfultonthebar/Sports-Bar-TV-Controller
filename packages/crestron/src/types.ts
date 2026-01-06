/**
 * Crestron DigitalMedia Matrix Switcher Type Definitions
 *
 * Supports DM-MD series matrix switchers controlled via Telnet (port 23)
 * or CTP (Crestron Terminal Protocol, port 41795)
 */

export interface CrestronDeviceConfig {
  id: string
  name: string
  model: CrestronModel
  ipAddress: string
  port: number  // Telnet: 23, CTP: 41795
  username?: string
  password?: string
  description?: string
}

export type CrestronModel =
  // DM-MD Modular Matrix Switchers
  | 'DM-MD8X8'
  | 'DM-MD8X8-CPU3'
  | 'DM-MD16X16'
  | 'DM-MD16X16-CPU3'
  | 'DM-MD32X32'
  | 'DM-MD32X32-CPU3'
  | 'DM-MD64X64'
  | 'DM-MD128X128'
  // HD-MD HDMI Switchers (smaller/simpler)
  | 'HD-MD4X2-4KZ-E'
  | 'HD-MD6X2-4KZ-E'
  | 'HD-MD8X2-4KZ-E'
  | 'HD-MD4X1-4KZ-E'
  // DMPS Presentation Systems with Matrix
  | 'DMPS3-4K-350-C'
  | 'DMPS3-4K-150-C'
  | 'DMPS3-4K-100-C'
  // NVX (Network AV)
  | 'DM-NVX-DIR-80'
  | 'DM-NVX-DIR-160'
  | 'DM-NVX-DIR-ENT'

export interface CrestronModelConfig {
  inputs: number
  outputs: number
  outputSlotOffset: number  // DM-MD 8x8/16x16 = 17, 32x32 = 33
  hasAudioBreakaway: boolean
  hasUSBRouting: boolean
  protocol: 'telnet' | 'ctp' | 'nvx-api'
  defaultPort: number
  series: 'DM-MD' | 'HD-MD' | 'DMPS' | 'NVX'
}

export const CRESTRON_MODEL_CONFIGS: Record<CrestronModel, CrestronModelConfig> = {
  // DM-MD Modular Matrix Switchers (Telnet control)
  'DM-MD8X8': {
    inputs: 8, outputs: 8, outputSlotOffset: 17,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'telnet', defaultPort: 23, series: 'DM-MD'
  },
  'DM-MD8X8-CPU3': {
    inputs: 8, outputs: 8, outputSlotOffset: 17,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'telnet', defaultPort: 23, series: 'DM-MD'
  },
  'DM-MD16X16': {
    inputs: 16, outputs: 16, outputSlotOffset: 17,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'telnet', defaultPort: 23, series: 'DM-MD'
  },
  'DM-MD16X16-CPU3': {
    inputs: 16, outputs: 16, outputSlotOffset: 17,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'telnet', defaultPort: 23, series: 'DM-MD'
  },
  'DM-MD32X32': {
    inputs: 32, outputs: 32, outputSlotOffset: 33,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'telnet', defaultPort: 23, series: 'DM-MD'
  },
  'DM-MD32X32-CPU3': {
    inputs: 32, outputs: 32, outputSlotOffset: 33,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'telnet', defaultPort: 23, series: 'DM-MD'
  },
  'DM-MD64X64': {
    inputs: 64, outputs: 64, outputSlotOffset: 65,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'telnet', defaultPort: 23, series: 'DM-MD'
  },
  'DM-MD128X128': {
    inputs: 128, outputs: 128, outputSlotOffset: 129,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'telnet', defaultPort: 23, series: 'DM-MD'
  },

  // HD-MD HDMI Switchers (simpler, smaller venues)
  'HD-MD4X2-4KZ-E': {
    inputs: 4, outputs: 2, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: false,
    protocol: 'telnet', defaultPort: 23, series: 'HD-MD'
  },
  'HD-MD6X2-4KZ-E': {
    inputs: 6, outputs: 2, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: false,
    protocol: 'telnet', defaultPort: 23, series: 'HD-MD'
  },
  'HD-MD8X2-4KZ-E': {
    inputs: 8, outputs: 2, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: false,
    protocol: 'telnet', defaultPort: 23, series: 'HD-MD'
  },
  'HD-MD4X1-4KZ-E': {
    inputs: 4, outputs: 1, outputSlotOffset: 1,
    hasAudioBreakaway: false, hasUSBRouting: false,
    protocol: 'telnet', defaultPort: 23, series: 'HD-MD'
  },

  // DMPS Presentation Systems (all-in-one with matrix)
  'DMPS3-4K-350-C': {
    inputs: 8, outputs: 3, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'ctp', defaultPort: 41795, series: 'DMPS'
  },
  'DMPS3-4K-150-C': {
    inputs: 6, outputs: 2, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'ctp', defaultPort: 41795, series: 'DMPS'
  },
  'DMPS3-4K-100-C': {
    inputs: 4, outputs: 2, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: false,
    protocol: 'ctp', defaultPort: 41795, series: 'DMPS'
  },

  // NVX Network AV Director (software-based routing)
  'DM-NVX-DIR-80': {
    inputs: 80, outputs: 80, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'nvx-api', defaultPort: 443, series: 'NVX'
  },
  'DM-NVX-DIR-160': {
    inputs: 160, outputs: 160, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'nvx-api', defaultPort: 443, series: 'NVX'
  },
  'DM-NVX-DIR-ENT': {
    inputs: 500, outputs: 500, outputSlotOffset: 1,
    hasAudioBreakaway: true, hasUSBRouting: true,
    protocol: 'nvx-api', defaultPort: 443, series: 'NVX'
  },
}

export interface CrestronConnectionState {
  isConnected: boolean
  lastConnected?: Date
  lastError?: string
  firmware?: string
  serialNumber?: string
}

export interface CrestronRoute {
  input: number
  output: number
  routeType: 'av' | 'video' | 'audio' | 'usb'
}

export interface CrestronRouteState {
  routes: CrestronRoute[]
  lastUpdated: Date
}

export interface CrestronDeviceState {
  connection: CrestronConnectionState
  routing: CrestronRouteState
  inputLabels: Map<number, string>
  outputLabels: Map<number, string>
}

export interface CrestronCommand {
  command: string
  expectedResponse?: string
  timeout?: number
}

export interface CrestronResponse {
  success: boolean
  data?: string
  error?: string
}
