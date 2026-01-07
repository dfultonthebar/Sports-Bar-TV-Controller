/**
 * Commercial Lighting Control Package
 * Support for Lutron, Philips Hue, and other IP-based lighting systems
 *
 * @packageDocumentation
 */

// Configuration
export * from './config'

// Logger
export { lightingLogger, logger } from './commercial-lighting-logger'

// Clients
export {
  LutronLIPClient,
  type LutronLIPConfig,
  type LutronDevice,
  type LutronEvent,
  type LutronLIPStatus,
} from './clients/lutron-lip-client'

export {
  HueClient,
  type HueClientConfig,
  type HueBridge,
  type HueLight,
  type HueRoom,
  type HueScene,
  type HueLightState,
  type HueClientStatus,
} from './clients/hue-client'

// Connection Manager
export {
  commercialLightingManager,
  type LightingSystemConfig,
  type RegisteredSystem,
  type LightingManagerStatus,
} from './commercial-lighting-manager'

// Default export
export { commercialLightingManager as default } from './commercial-lighting-manager'
