/**
 * dbx ZonePRO Configuration
 *
 * Protocol constants and model specifications for dbx ZonePRO audio processors.
 * Based on HiQnet v1.0 protocol specification.
 *
 * Supported Models:
 * - ZonePRO 640/640m  - 6 inputs, 4 outputs
 * - ZonePRO 641/641m  - 6 inputs, 4 outputs (with microphone preamps)
 * - ZonePRO 1260/1260m - 12 inputs, 6 outputs
 * - ZonePRO 1261/1261m - 12 inputs, 6 outputs (with microphone preamps)
 *
 * m-models have Ethernet connectivity in addition to RS-232.
 */

// Network Configuration
export const DBX_NETWORK_CONFIG = {
  // Ethernet port for m-models (640m, 641m, 1260m, 1261m)
  TCP_PORT: 3804,

  // Connection timeouts (in milliseconds)
  CONNECTION_TIMEOUT: 5000,
  COMMAND_TIMEOUT: 3000,
  PING_INTERVAL: 1000, // Keep-alive ping every 1 second
  RECONNECT_DELAY: 2000,
  MAX_RECONNECT_ATTEMPTS: 10,
} as const

// RS-232 Serial Configuration
export const DBX_SERIAL_CONFIG = {
  BAUD_RATE: 57600,
  DATA_BITS: 8,
  STOP_BITS: 1,
  PARITY: 'none' as const,

  // Null modem cable is required
  // TX->RX, RX->TX, GND->GND
} as const

// HiQnet Protocol Constants
export const DBX_PROTOCOL = {
  // Frame structure
  FRAME_START_BYTE: 0x64, // 'd' character - start of frame delimiter

  // Message IDs (HiQnet v1.0)
  MESSAGE_ID: {
    MULTI_SV_SET: 0x0100, // Multi-parameter State Variable Set
    GET: 0x0103, // Get parameter value
    RECALL_SCENE: 0x9001, // Recall preset/scene
    PING: 0x0000, // Keep-alive ping
  },

  // Volume/Gain range
  // dbx uses 0-415 scale for volume
  // 0 = -infinity (mute)
  // 415 = 0dB (unity gain)
  VOLUME_MIN: 0,
  VOLUME_MAX: 415,
  VOLUME_UNITY: 415, // 0dB

  // Mute values
  MUTE_ON: 1,
  MUTE_OFF: 0,
} as const

// ZonePRO Model Specifications
export const DBX_MODELS = {
  // ZonePRO 640 - 6 inputs, 4 outputs, RS-232 only
  ZONEPRO_640: {
    name: 'ZonePRO 640',
    model: '640',
    hasEthernet: false,
    inputs: 6,
    outputs: 4,
    maxZones: 4,
    maxScenes: 20,
    hasMicPreamps: false,
  },

  // ZonePRO 640m - 6 inputs, 4 outputs, with Ethernet
  ZONEPRO_640M: {
    name: 'ZonePRO 640m',
    model: '640m',
    hasEthernet: true,
    inputs: 6,
    outputs: 4,
    maxZones: 4,
    maxScenes: 20,
    hasMicPreamps: false,
  },

  // ZonePRO 641 - 6 inputs, 4 outputs, with mic preamps, RS-232 only
  ZONEPRO_641: {
    name: 'ZonePRO 641',
    model: '641',
    hasEthernet: false,
    inputs: 6,
    outputs: 4,
    maxZones: 4,
    maxScenes: 20,
    hasMicPreamps: true,
  },

  // ZonePRO 641m - 6 inputs, 4 outputs, with mic preamps and Ethernet
  ZONEPRO_641M: {
    name: 'ZonePRO 641m',
    model: '641m',
    hasEthernet: true,
    inputs: 6,
    outputs: 4,
    maxZones: 4,
    maxScenes: 20,
    hasMicPreamps: true,
  },

  // ZonePRO 1260 - 12 inputs, 6 outputs, RS-232 only
  ZONEPRO_1260: {
    name: 'ZonePRO 1260',
    model: '1260',
    hasEthernet: false,
    inputs: 12,
    outputs: 6,
    maxZones: 6,
    maxScenes: 20,
    hasMicPreamps: false,
  },

  // ZonePRO 1260m - 12 inputs, 6 outputs, with Ethernet
  ZONEPRO_1260M: {
    name: 'ZonePRO 1260m',
    model: '1260m',
    hasEthernet: true,
    inputs: 12,
    outputs: 6,
    maxZones: 6,
    maxScenes: 20,
    hasMicPreamps: false,
  },

  // ZonePRO 1261 - 12 inputs, 6 outputs, with mic preamps, RS-232 only
  ZONEPRO_1261: {
    name: 'ZonePRO 1261',
    model: '1261',
    hasEthernet: false,
    inputs: 12,
    outputs: 6,
    maxZones: 6,
    maxScenes: 20,
    hasMicPreamps: true,
  },

  // ZonePRO 1261m - 12 inputs, 6 outputs, with mic preamps and Ethernet
  ZONEPRO_1261M: {
    name: 'ZonePRO 1261m',
    model: '1261m',
    hasEthernet: true,
    inputs: 12,
    outputs: 6,
    maxZones: 6,
    maxScenes: 20,
    hasMicPreamps: true,
  },
} as const

// Type for model configuration
export type DbxModelConfig = (typeof DBX_MODELS)[keyof typeof DBX_MODELS]

// Type for model names
export type DbxModelName = keyof typeof DBX_MODELS

/**
 * Get model configuration by model string
 */
export function getModelConfig(model: string): DbxModelConfig | null {
  const normalizedModel = model.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (normalizedModel.includes('1261M') || normalizedModel === 'ZONEPRO1261M') {
    return DBX_MODELS.ZONEPRO_1261M
  } else if (normalizedModel.includes('1261') || normalizedModel === 'ZONEPRO1261') {
    return DBX_MODELS.ZONEPRO_1261
  } else if (normalizedModel.includes('1260M') || normalizedModel === 'ZONEPRO1260M') {
    return DBX_MODELS.ZONEPRO_1260M
  } else if (normalizedModel.includes('1260') || normalizedModel === 'ZONEPRO1260') {
    return DBX_MODELS.ZONEPRO_1260
  } else if (normalizedModel.includes('641M') || normalizedModel === 'ZONEPRO641M') {
    return DBX_MODELS.ZONEPRO_641M
  } else if (normalizedModel.includes('641') || normalizedModel === 'ZONEPRO641') {
    return DBX_MODELS.ZONEPRO_641
  } else if (normalizedModel.includes('640M') || normalizedModel === 'ZONEPRO640M') {
    return DBX_MODELS.ZONEPRO_640M
  } else if (normalizedModel.includes('640') || normalizedModel === 'ZONEPRO640') {
    return DBX_MODELS.ZONEPRO_640
  }

  return null
}

/**
 * Check if a model supports Ethernet connectivity
 */
export function supportsEthernet(model: string): boolean {
  const config = getModelConfig(model)
  return config?.hasEthernet ?? false
}

/**
 * Convert dB value to dbx volume scale (0-415)
 * @param db - Decibel value (-infinity to 0dB)
 * @returns Volume value (0-415)
 */
export function dbToVolume(db: number): number {
  if (db <= -80) {
    return 0 // Mute/minimum
  }
  if (db >= 0) {
    return 415 // Unity gain
  }
  // Linear interpolation: -80dB = 0, 0dB = 415
  return Math.round(((db + 80) / 80) * 415)
}

/**
 * Convert dbx volume scale (0-415) to dB
 * @param volume - Volume value (0-415)
 * @returns Decibel value
 */
export function volumeToDb(volume: number): number {
  if (volume <= 0) {
    return -80 // Practical minimum (treat as -infinity)
  }
  if (volume >= 415) {
    return 0 // Unity gain
  }
  // Linear interpolation
  return (volume / 415) * 80 - 80
}

/**
 * Convert percentage (0-100) to dbx volume scale (0-415)
 * @param percent - Percentage value (0-100)
 * @returns Volume value (0-415)
 */
export function percentToVolume(percent: number): number {
  const clamped = Math.max(0, Math.min(100, percent))
  return Math.round((clamped / 100) * 415)
}

/**
 * Convert dbx volume scale (0-415) to percentage
 * @param volume - Volume value (0-415)
 * @returns Percentage value (0-100)
 */
export function volumeToPercent(volume: number): number {
  const clamped = Math.max(0, Math.min(415, volume))
  return Math.round((clamped / 415) * 100)
}

export default {
  DBX_NETWORK_CONFIG,
  DBX_SERIAL_CONFIG,
  DBX_PROTOCOL,
  DBX_MODELS,
  getModelConfig,
  supportsEthernet,
  dbToVolume,
  volumeToDb,
  percentToVolume,
  volumeToPercent,
}
