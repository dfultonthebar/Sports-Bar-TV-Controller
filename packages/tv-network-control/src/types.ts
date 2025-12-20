/**
 * TV Network Control - Type Definitions
 * Shared types for network-based TV control across multiple brands
 */

/**
 * Supported TV brands for network control
 */
export enum TVBrand {
  ROKU = 'Roku',
  SAMSUNG = 'Samsung',
  LG = 'LG',
  SONY = 'Sony',
  VIZIO = 'Vizio',
  SHARP = 'Sharp',
  HISENSE = 'Hisense',
}

/**
 * TV device configuration
 */
export interface TVDeviceConfig {
  ipAddress: string
  port: number
  brand: TVBrand
  model?: string
  macAddress?: string

  // Authentication credentials (brand-specific)
  authToken?: string      // Samsung, Vizio
  clientKey?: string      // LG
  psk?: string           // Sony

  // Matrix integration
  matrixOutputId?: string

  // Capabilities
  supportsPower?: boolean
  supportsVolume?: boolean
  supportsInput?: boolean
}

/**
 * TV control command types
 */
export enum TVControlCommand {
  // Power
  POWER_ON = 'PowerOn',
  POWER_OFF = 'PowerOff',
  POWER_TOGGLE = 'PowerToggle',

  // Volume
  VOLUME_UP = 'VolumeUp',
  VOLUME_DOWN = 'VolumeDown',
  VOLUME_MUTE = 'VolumeMute',
  VOLUME_SET = 'VolumeSet',

  // Input switching
  INPUT_HDMI1 = 'InputHDMI1',
  INPUT_HDMI2 = 'InputHDMI2',
  INPUT_HDMI3 = 'InputHDMI3',
  INPUT_HDMI4 = 'InputHDMI4',
  INPUT_TUNER = 'InputTuner',
  INPUT_AV1 = 'InputAV1',

  // Navigation
  HOME = 'Home',
  BACK = 'Back',
  UP = 'Up',
  DOWN = 'Down',
  LEFT = 'Left',
  RIGHT = 'Right',
  SELECT = 'Select',

  // Media
  PLAY = 'Play',
  PAUSE = 'Pause',
  STOP = 'Stop',
  REWIND = 'Rev',
  FAST_FORWARD = 'Fwd',

  // Other
  INFO = 'Info',
  SEARCH = 'Search',
}

/**
 * TV device status
 */
export enum TVDeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  PAIRING = 'pairing',
  ERROR = 'error',
}

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean
  message?: string
  error?: string
}
