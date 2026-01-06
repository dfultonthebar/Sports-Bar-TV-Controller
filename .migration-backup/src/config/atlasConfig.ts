/**
 * Atlas IED Atmosphere AZM4/AZM8 Configuration
 * 
 * Constants and configuration for Atlas audio processors based on
 * ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf specification
 */

// Network Configuration
export const ATLAS_CONFIG = {
  // Default ports
  TCP_CONTROL_PORT: 5321,      // Port for JSON-RPC control commands
  UDP_METERING_PORT: 3131,     // Port for meter data subscriptions
  HTTP_WEB_PORT: 80,           // Port for HTTP web interface
  HTTPS_PORT: 443,             // Port for HTTPS/SSL
  
  // Timeouts (in milliseconds)
  CONNECTION_TIMEOUT: 5000,    // Connection timeout
  COMMAND_TIMEOUT: 5000,       // Command response timeout
  KEEP_ALIVE_INTERVAL: 240000, // Keep-alive interval (4 minutes)
  RECONNECT_DELAY: 5000,       // Delay before reconnection attempt
  MAX_RECONNECT_ATTEMPTS: 10,  // Maximum reconnection attempts
  
  // Protocol
  JSONRPC_VERSION: '2.0',
  MESSAGE_TERMINATOR: '\r\n',
  
  // Device Models
  MODELS: {
    AZM4: {
      name: 'AZM4',
      maxZones: 4,
      maxSources: 6,
      maxGroups: 4,
      maxScenes: 32,
      maxMessages: 64
    },
    AZMP4: {
      name: 'AZMP4',
      maxZones: 4,
      maxSources: 10,
      maxGroups: 4,
      maxScenes: 32,
      maxMessages: 64
    },
    AZM8: {
      name: 'AZM8',
      maxZones: 8,
      maxSources: 9,
      maxGroups: 8,
      maxScenes: 32,
      maxMessages: 64
    },
    AZMP8: {
      name: 'AZMP8',
      maxZones: 8,
      maxSources: 14,
      maxGroups: 8,
      maxScenes: 32,
      maxMessages: 64
    }
  }
} as const

// Parameter Types and Ranges
export const ATLAS_PARAMETERS = {
  // Zone Parameters
  ZONE_SOURCE: {
    prefix: 'ZoneSource',
    format: 'val',
    min: -1,  // -1 = no source
    max: 13,  // 0-13 for sources (model dependent)
    readOnly: false,
    description: 'Zone source selection'
  },
  ZONE_GAIN: {
    prefix: 'ZoneGain',
    format: 'val', // dB
    formatAlt: 'pct', // percentage (0-100)
    min: -80,  // dB
    max: 0,    // dB
    readOnly: false,
    description: 'Zone output gain/volume'
  },
  ZONE_MUTE: {
    prefix: 'ZoneMute',
    format: 'val',
    min: 0,  // 0 = unmuted
    max: 1,  // 1 = muted
    readOnly: false,
    description: 'Zone mute state'
  },
  ZONE_NAME: {
    prefix: 'ZoneName',
    format: 'str',
    readOnly: true,
    description: 'Zone name (as configured in Atlas)'
  },
  ZONE_METER: {
    prefix: 'ZoneMeter',
    format: 'val', // dB
    readOnly: true,
    description: 'Zone output meter level'
  },
  
  // Source Parameters
  SOURCE_NAME: {
    prefix: 'SourceName',
    format: 'str',
    readOnly: true,
    description: 'Source name (as configured in Atlas)'
  },
  SOURCE_MUTE: {
    prefix: 'SourceMute',
    format: 'val',
    min: 0,
    max: 1,
    readOnly: false,
    description: 'Source mute state'
  },
  SOURCE_GAIN: {
    prefix: 'SourceGain',
    format: 'val', // dB
    formatAlt: 'pct',
    min: -80,
    max: 0,
    readOnly: false,
    description: 'Source input gain'
  },
  SOURCE_METER: {
    prefix: 'SourceMeter',
    format: 'val', // dB
    readOnly: true,
    description: 'Source input meter level'
  },
  
  // Input/Output Parameters
  INPUT_GAIN: {
    prefix: 'InputGain',
    format: 'val', // dB
    formatAlt: 'pct',
    min: -20,
    max: 20,
    readOnly: false,
    description: 'Physical input gain'
  },
  INPUT_MUTE: {
    prefix: 'InputMute',
    format: 'val',
    min: 0,
    max: 1,
    readOnly: false,
    description: 'Physical input mute'
  },
  INPUT_METER: {
    prefix: 'InputMeter',
    format: 'val', // dB
    readOnly: true,
    description: 'Physical input meter level'
  },
  OUTPUT_GAIN: {
    prefix: 'OutputGain',
    format: 'val', // dB
    formatAlt: 'pct',
    min: -80,
    max: 0,
    readOnly: false,
    description: 'Physical output gain'
  },
  OUTPUT_MUTE: {
    prefix: 'OutputMute',
    format: 'val',
    min: 0,
    max: 1,
    readOnly: false,
    description: 'Physical output mute'
  },
  OUTPUT_METER: {
    prefix: 'OutputMeter',
    format: 'val', // dB
    readOnly: true,
    description: 'Physical output meter level'
  },
  
  // Group Parameters (Zone Combining)
  GROUP_ACTIVE: {
    prefix: 'GroupActive',
    format: 'val',
    min: 0,  // 0 = inactive (deactivate/split)
    max: 1,  // 1 = active (activate/combine)
    readOnly: false,
    description: 'Group activation state for combining zones'
  },
  
  // Scene Parameters
  RECALL_SCENE: {
    prefix: 'RecallScene',
    format: 'val',
    min: 0,
    max: 31,  // 0-31 for scene index
    readOnly: false,
    isAction: true,
    description: 'Recall a saved scene'
  },
  
  // Message Parameters
  PLAY_MESSAGE: {
    prefix: 'PlayMessage',
    format: 'val',
    min: 0,
    max: 63,  // 0-63 for message index
    readOnly: false,
    isAction: true,
    description: 'Play a stored message'
  },
  
  // System Parameters
  KEEP_ALIVE: {
    prefix: 'KeepAlive',
    format: 'str',
    readOnly: true,
    description: 'Keep-alive parameter for maintaining connection'
  }
} as const

// JSON-RPC Methods
export const ATLAS_METHODS = {
  SET: 'set',           // Set parameter value
  BMP: 'bmp',           // Bump/adjust parameter value
  GET: 'get',           // Get current parameter value
  SUB: 'sub',           // Subscribe to parameter updates
  UNSUB: 'unsub',       // Unsubscribe from parameter updates
  UPDATE: 'update'      // Update notification (received from device)
} as const

// Parameter Formats
export const ATLAS_FORMATS = {
  VAL: 'val',   // Numeric value (e.g., dB, index)
  PCT: 'pct',   // Percentage (0-100)
  STR: 'str'    // String value
} as const

// Helper Functions
export function getParameterName(type: keyof typeof ATLAS_PARAMETERS, index: number): string {
  const param = ATLAS_PARAMETERS[type]
  return `${param.prefix}_${index}`
}

export function getModelConfig(model: string): typeof ATLAS_CONFIG.MODELS.AZMP8 | null {
  const normalizedModel = model.toUpperCase().replace(/[^A-Z0-9]/g, '')
  
  if (normalizedModel.includes('AZMP8') || normalizedModel === 'AZM8P') {
    return ATLAS_CONFIG.MODELS.AZMP8
  } else if (normalizedModel.includes('AZM8')) {
    return ATLAS_CONFIG.MODELS.AZM8
  } else if (normalizedModel.includes('AZMP4') || normalizedModel === 'AZM4P') {
    return ATLAS_CONFIG.MODELS.AZMP4
  } else if (normalizedModel.includes('AZM4')) {
    return ATLAS_CONFIG.MODELS.AZM4
  }
  
  // Default to AZMP8 for unknown models
  return ATLAS_CONFIG.MODELS.AZMP8
}

export function validateParameterValue(
  type: keyof typeof ATLAS_PARAMETERS,
  value: number | string
): boolean {
  const param = ATLAS_PARAMETERS[type]
  
  if (param.format === 'str') {
    return typeof value === 'string'
  }
  
  if (typeof value !== 'number') {
    return false
  }
  
  if (param.min !== undefined && value < param.min) {
    return false
  }
  
  if (param.max !== undefined && value > param.max) {
    return false
  }
  
  return true
}

// Keep-Alive Message (send every 4 minutes to prevent timeout)
export function createKeepAliveMessage(id: number): string {
  return JSON.stringify({
    jsonrpc: ATLAS_CONFIG.JSONRPC_VERSION,
    method: ATLAS_METHODS.GET,
    params: {
      param: getParameterName('KEEP_ALIVE', 0),
      fmt: ATLAS_FORMATS.STR
    },
    id
  }) + ATLAS_CONFIG.MESSAGE_TERMINATOR
}

// Default Credentials (from user documentation)
export const ATLAS_DEFAULT_CREDENTIALS = {
  username: 'admin',
  password: '6809233DjD$$$',
  alternativePasswords: ['admin', 'password', '']
} as const

export default ATLAS_CONFIG
