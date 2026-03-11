/**
 * @sports-bar/tv-network-control
 *
 * Network-based TV control for the Sports Bar TV Controller.
 * Provides clients for controlling Roku and other smart TVs via their network APIs.
 */

// Types
export {
  TVBrand,
  type TVDeviceConfig,
  TVControlCommand,
  TVDeviceStatus,
  type CommandResult,
} from './types'

// Utilities
export { CommandQueue } from './utils/command-queue'

// Clients
export { BaseTVClient } from './clients/base-client'
export { RokuTVClient } from './clients/roku-client'
export { SamsungTVClient } from './clients/samsung-client'
