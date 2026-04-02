/**
 * Wolf Pack Chassis Configuration Types
 *
 * JSON driver file schema for multi-chassis support.
 * Each chassis has its own entry in wolfpack-devices.json.
 */

export interface WolfpackChassisInput {
  channel: number
  label: string
  deviceType: string
  isActive: boolean
}

export interface WolfpackChassisOutput {
  channel: number
  label: string
  zone: string
  isActive: boolean
}

export interface WolfpackChassisCredentials {
  username: string
  password: string
}

export interface WolfpackChassisConfig {
  /** Stable slug identifier, e.g. "wp-graystone-video" */
  id: string
  /** Human-readable name, e.g. "Graystone Video Matrix" */
  name: string
  /** Model identifier, e.g. "WP-36X36" */
  model: string
  /** Role this chassis serves */
  role: 'video' | 'audio' | 'combined'
  /** Network address */
  ipAddress: string
  /** Control protocol */
  protocol: 'HTTP' | 'TCP' | 'UDP'
  /** TCP control port (default 23) */
  tcpPort: number
  /** UDP control port (default 4000) */
  udpPort: number
  /** Web UI / HTTP API credentials */
  credentials: WolfpackChassisCredentials
  /** If true, this is the default chassis for legacy endpoints */
  isPrimary: boolean
  /** Output offset for multi-card routing (e.g., +32 for audio outputs 33-36) */
  outputOffset: number
  /** Input channel definitions */
  inputs: WolfpackChassisInput[]
  /** Output channel definitions */
  outputs: WolfpackChassisOutput[]
  /** Audio breakaway configuration */
  audioBreakaway: {
    enabled: boolean
    /** Output offset for dedicated audio outputs */
    outputOffset: number
  }
}

export interface WolfpackDevicesFile {
  chassis: WolfpackChassisConfig[]
}
