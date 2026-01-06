/**
 * @sports-bar/directv
 *
 * DirecTV SHEF API client and discovery for Sports Bar TV Controller
 * Provides control and channel tuning for DirecTV receivers
 */

// Types
export * from './types'

// Constants
export * from './constants'

// SHEF Client
export { SHEFClient } from './shef-client'

// Discovery Service
export { DirecTVDiscovery } from './discovery'

// Channel Guide Service
export { ChannelGuideService } from './channel-guide'

// Command Mapper
export { CommandMapper } from './command-mapper'

// Logger
export {
  direcTVLogger,
  createErrorDetails,
  withTiming,
  LogLevel,
  DirecTVOperation,
  type DirecTVLogEntry
} from './directv-logger'

// Guide Service
export {
  fetchDirecTVGuide,
  fetchChannelProgramInfo,
  fetchMultipleChannelProgramInfo,
  getDirecTVDevice,
  getAllDirecTVDevices,
  type DirecTVProgramInfo,
  type DirecTVDevice,
  type DirecTVGuideResult,
  type DirecTVGuideOptions
} from './directv-guide-service'

// Subscription Service
export {
  pollRealDirecTVSubscriptions,
  determinePackageType,
  type Subscription,
  type DirecTVDeviceInfo
} from './subscription-service'
