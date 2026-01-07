/**
 * Commercial Lighting Control Configuration
 * Protocol constants for Lutron, Philips Hue, and other IP-based systems
 */

// Lutron Integration Protocol (LIP) Configuration
export const LUTRON_CONFIG = {
  // Default ports
  TELNET_PORT: 23,
  LEAP_PORT: 8081,
  CASETA_PORT: 8083,

  // Default credentials (RadioRA 2 / HomeWorks QS)
  DEFAULT_USERNAME: 'lutron',
  DEFAULT_PASSWORD: 'integration',

  // Connection settings
  CONNECT_TIMEOUT_MS: 10000,
  COMMAND_TIMEOUT_MS: 5000,
  KEEPALIVE_INTERVAL_MS: 60000,
  RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,

  // LIP Command prefixes
  COMMAND_PREFIX: '#',       // Send command
  QUERY_PREFIX: '?',         // Query state
  RESPONSE_PREFIX: '~',      // Response from system

  // LIP Actions
  ACTION_OUTPUT: 'OUTPUT',   // Dimmer/switch output
  ACTION_DEVICE: 'DEVICE',   // Keypad/sensor device
  ACTION_SYSTEM: 'SYSTEM',   // System-level commands
  ACTION_AREA: 'AREA',       // Area/room commands

  // Output component numbers
  OUTPUT_COMPONENT: {
    LEVEL: 1,                // Dimmer level (0-100)
    FLASH: 2,                // Flash indicator
    RAISE: 18,               // Raise (dimming up)
    LOWER: 19,               // Lower (dimming down)
    STOP: 20,                // Stop raise/lower
  },

  // Device actions
  DEVICE_ACTION: {
    PRESS: 3,                // Button press
    RELEASE: 4,              // Button release
    HOLD: 5,                 // Button hold
    DOUBLE_TAP: 6,           // Double tap
  },
} as const

// Philips Hue Configuration
export const HUE_CONFIG = {
  // Default port (HTTPS)
  PORT: 443,

  // Discovery endpoints
  DISCOVERY_URL: 'https://discovery.meethue.com',
  MDNS_SERVICE: '_hue._tcp.local',

  // API paths (v2)
  API_BASE: '/clip/v2',
  API_RESOURCE: '/clip/v2/resource',

  // Resource types
  RESOURCE: {
    LIGHT: 'light',
    ROOM: 'room',
    ZONE: 'zone',
    SCENE: 'scene',
    GROUPED_LIGHT: 'grouped_light',
    DEVICE: 'device',
    BRIDGE: 'bridge',
    BRIDGE_HOME: 'bridge_home',
    ENTERTAINMENT: 'entertainment',
  },

  // Connection settings
  CONNECT_TIMEOUT_MS: 10000,
  REQUEST_TIMEOUT_MS: 5000,
  PAIR_TIMEOUT_MS: 30000,
  PAIR_POLL_INTERVAL_MS: 1000,

  // SSE (Server-Sent Events) for real-time updates
  EVENTSTREAM_PATH: '/eventstream/clip/v2',

  // Application info for pairing
  APP_NAME: 'SportsBarTVController',
  DEVICE_TYPE: 'sports-bar-controller',
} as const

// System type definitions
export const LIGHTING_SYSTEM_TYPES = {
  'lutron-radiora2': {
    name: 'Lutron RadioRA 2',
    protocol: 'telnet',
    defaultPort: LUTRON_CONFIG.TELNET_PORT,
    supportsZones: true,
    supportsScenes: true,
    supportsDimming: true,
    requiresCredentials: true,
  },
  'lutron-radiora3': {
    name: 'Lutron RadioRA 3',
    protocol: 'leap',
    defaultPort: LUTRON_CONFIG.LEAP_PORT,
    supportsZones: true,
    supportsScenes: true,
    supportsDimming: true,
    requiresCertificate: true,
  },
  'lutron-homeworks': {
    name: 'Lutron HomeWorks QS',
    protocol: 'telnet',
    defaultPort: LUTRON_CONFIG.TELNET_PORT,
    supportsZones: true,
    supportsScenes: true,
    supportsDimming: true,
    requiresCredentials: true,
  },
  'lutron-caseta': {
    name: 'Lutron Caseta',
    protocol: 'leap',
    defaultPort: LUTRON_CONFIG.CASETA_PORT,
    supportsZones: true,
    supportsScenes: true,
    supportsDimming: true,
    requiresCertificate: true,
  },
  'philips-hue': {
    name: 'Philips Hue',
    protocol: 'rest',
    defaultPort: HUE_CONFIG.PORT,
    supportsZones: true,
    supportsScenes: true,
    supportsDimming: true,
    supportsColor: true,
    supportsColorTemp: true,
    requiresApplicationKey: true,
  },
} as const

export type LightingSystemType = keyof typeof LIGHTING_SYSTEM_TYPES

// Device type definitions
export const LIGHTING_DEVICE_TYPES = {
  dimmer: {
    name: 'Dimmer',
    capabilities: ['dimming', 'on_off'],
    defaultChannels: 1,
  },
  switch: {
    name: 'Switch',
    capabilities: ['on_off'],
    defaultChannels: 1,
  },
  'color-light': {
    name: 'Color Light',
    capabilities: ['dimming', 'on_off', 'color', 'color_temp'],
    defaultChannels: 1,
  },
  'white-light': {
    name: 'White Light',
    capabilities: ['dimming', 'on_off', 'color_temp'],
    defaultChannels: 1,
  },
  plug: {
    name: 'Smart Plug',
    capabilities: ['on_off'],
    defaultChannels: 1,
  },
  keypad: {
    name: 'Keypad',
    capabilities: ['buttons'],
    defaultChannels: 0,
  },
  sensor: {
    name: 'Sensor',
    capabilities: ['occupancy', 'daylight'],
    defaultChannels: 0,
  },
} as const

export type LightingDeviceType = keyof typeof LIGHTING_DEVICE_TYPES

// Scene categories
export const SCENE_CATEGORIES = [
  'general',
  'game-day',
  'celebration',
  'ambient',
  'cleaning',
  'closed',
] as const

export type SceneCategory = typeof SCENE_CATEGORIES[number]
