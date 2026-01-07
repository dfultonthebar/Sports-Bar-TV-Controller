/**
 * DMX Lighting Control Configuration
 * Constants, adapter definitions, and protocol settings
 */

// DMX512 Protocol Constants
export const DMX_CONFIG = {
  // Standard DMX512 settings
  CHANNELS_PER_UNIVERSE: 512,
  MAX_UNIVERSES: 4,
  MIN_CHANNEL: 1,
  MAX_CHANNEL: 512,
  MIN_VALUE: 0,
  MAX_VALUE: 255,

  // USB DMX timing (microseconds)
  BREAK_TIME_US: 176,
  MAB_TIME_US: 12,
  FRAME_TIME_US: 44,

  // Serial settings for USB DMX
  BAUD_RATE: 250000,
  DATA_BITS: 8,
  STOP_BITS: 2,
  PARITY: 'none' as const,

  // Art-Net protocol
  ARTNET_PORT: 6454,
  ARTNET_HEADER: Buffer.from([0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00]), // "Art-Net\0"
  ARTNET_VERSION: 14,

  // Art-Net OpCodes
  ARTNET_OP_OUTPUT: 0x5000,    // OpDmx - Send DMX data
  ARTNET_OP_POLL: 0x2000,      // OpPoll - Discovery
  ARTNET_OP_POLL_REPLY: 0x2100, // OpPollReply
  ARTNET_OP_TRIGGER: 0x9900,   // OpTrigger - For Maestro presets

  // Timing
  FRAME_RATE_HZ: 44,           // Standard DMX refresh rate
  COMMAND_TIMEOUT_MS: 5000,
  RECONNECT_DELAY_MS: 2000,
  MAX_RECONNECT_ATTEMPTS: 5,
  KEEPALIVE_INTERVAL_MS: 30000,

  // Effects
  STROBE_MIN_HZ: 1,
  STROBE_MAX_HZ: 25,
  FADE_STEP_MS: 25,            // Fade interpolation step
  DEFAULT_FADE_MS: 500,
} as const

// Supported USB DMX Adapter Models
export const USB_ADAPTER_MODELS = {
  'enttec-pro': {
    name: 'Enttec DMX USB Pro',
    vendorId: '0403',
    productId: '6001',
    protocol: 'enttec-pro',
    universes: 1,
    features: ['dmx-out', 'dmx-in', 'rdm'],
  },
  'enttec-open': {
    name: 'Enttec Open DMX USB',
    vendorId: '0403',
    productId: '6001',
    protocol: 'open-dmx',
    universes: 1,
    features: ['dmx-out'],
  },
  'pknight-cr011r': {
    name: 'PKnight CR011R',
    vendorId: null, // Generic serial
    productId: null,
    protocol: 'generic',
    universes: 1,
    features: ['dmx-out'],
  },
} as const

// Supported Art-Net Adapter Models
export const ARTNET_ADAPTER_MODELS = {
  'enttec-ode': {
    name: 'Enttec ODE',
    universes: 2,
    features: ['dmx-out', 'poe'],
  },
  'dmxking': {
    name: 'DMXking',
    universes: 4,
    features: ['dmx-out', 'dmx-in'],
  },
  'maestro': {
    name: 'Maestro DMX',
    universes: 2,
    features: ['dmx-out', 'presets', 'functions', 'chases'],
    presetCount: 12,
    functionCount: 8,
  },
  'generic-artnet': {
    name: 'Generic Art-Net Node',
    universes: 1,
    features: ['dmx-out'],
  },
} as const

// DMX Fixture Types
export const FIXTURE_TYPES = {
  'led-par': {
    name: 'LED Par Can',
    icon: 'lightbulb',
    defaultChannels: 7,
    commonCapabilities: ['rgb', 'dimmer', 'strobe'],
  },
  'moving-head': {
    name: 'Moving Head',
    icon: 'move',
    defaultChannels: 16,
    commonCapabilities: ['rgb', 'dimmer', 'pan', 'tilt', 'gobo', 'strobe'],
  },
  'strobe': {
    name: 'Strobe Light',
    icon: 'zap',
    defaultChannels: 2,
    commonCapabilities: ['dimmer', 'strobe-speed'],
  },
  'fog-machine': {
    name: 'Fog Machine',
    icon: 'cloud',
    defaultChannels: 2,
    commonCapabilities: ['output', 'fan'],
  },
  'led-strip': {
    name: 'LED Strip / Tape',
    icon: 'minus',
    defaultChannels: 4,
    commonCapabilities: ['rgb', 'dimmer'],
  },
  'pin-spot': {
    name: 'Pin Spot',
    icon: 'target',
    defaultChannels: 1,
    commonCapabilities: ['dimmer'],
  },
  'laser': {
    name: 'Laser',
    icon: 'crosshair',
    defaultChannels: 8,
    commonCapabilities: ['color', 'pattern', 'x-axis', 'y-axis'],
  },
  'generic': {
    name: 'Generic DMX Fixture',
    icon: 'box',
    defaultChannels: 1,
    commonCapabilities: ['dimmer'],
  },
} as const

// Scene Categories
export const SCENE_CATEGORIES = {
  'general': { name: 'General', icon: 'sun', color: '#f59e0b' },
  'game-day': { name: 'Game Day', icon: 'trophy', color: '#22c55e' },
  'celebration': { name: 'Celebration', icon: 'party-popper', color: '#ec4899' },
  'ambient': { name: 'Ambient', icon: 'moon', color: '#8b5cf6' },
  'special': { name: 'Special Event', icon: 'star', color: '#3b82f6' },
} as const

// Effect Types
export const EFFECT_TYPES = {
  'strobe': {
    name: 'Strobe',
    icon: 'zap',
    defaultDuration: 5000,
    params: ['speed', 'intensity'],
  },
  'color-burst': {
    name: 'Color Burst',
    icon: 'sparkles',
    defaultDuration: 3000,
    params: ['colors', 'speed'],
  },
  'chase': {
    name: 'Chase',
    icon: 'arrow-right',
    defaultDuration: 10000,
    params: ['colors', 'speed', 'direction'],
  },
  'fade': {
    name: 'Fade',
    icon: 'sunset',
    defaultDuration: 2000,
    params: ['fromColor', 'toColor'],
  },
  'rainbow': {
    name: 'Rainbow',
    icon: 'rainbow',
    defaultDuration: 5000,
    params: ['speed'],
  },
  'pulse': {
    name: 'Pulse',
    icon: 'heart-pulse',
    defaultDuration: 3000,
    params: ['color', 'speed', 'minIntensity', 'maxIntensity'],
  },
} as const

// Game Event Types for DMX Triggers
export const GAME_EVENT_TYPES = {
  'goal': { name: 'Goal (Hockey)', sports: ['nhl'] },
  'touchdown': { name: 'Touchdown', sports: ['nfl', 'ncaaf'] },
  'field-goal': { name: 'Field Goal', sports: ['nfl', 'ncaaf'] },
  'home-run': { name: 'Home Run', sports: ['mlb'] },
  'three-pointer': { name: '3-Pointer', sports: ['nba', 'ncaab'] },
  'score-change': { name: 'Any Score Change', sports: ['all'] },
  'game-start': { name: 'Game Start', sports: ['all'] },
  'game-end': { name: 'Game End', sports: ['all'] },
  'halftime': { name: 'Halftime', sports: ['nfl', 'nba', 'ncaaf', 'ncaab'] },
} as const

// Enttec Pro Protocol Constants
export const ENTTEC_PRO = {
  START_OF_MSG: 0x7e,
  END_OF_MSG: 0xe7,
  LABEL_DMX_OUT: 6,
  LABEL_DMX_IN: 5,
  LABEL_GET_WIDGET_PARAMS: 3,
  LABEL_SET_WIDGET_PARAMS: 4,
} as const

// Type exports
export type USBAdapterModel = keyof typeof USB_ADAPTER_MODELS
export type ArtNetAdapterModel = keyof typeof ARTNET_ADAPTER_MODELS
export type FixtureType = keyof typeof FIXTURE_TYPES
export type SceneCategory = keyof typeof SCENE_CATEGORIES
export type EffectType = keyof typeof EFFECT_TYPES
export type GameEventType = keyof typeof GAME_EVENT_TYPES
