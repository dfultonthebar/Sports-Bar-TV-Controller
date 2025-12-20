/**
 * @sports-bar/firecube - Fire TV/Cube ADB control package
 *
 * Core functionality for Fire TV device management:
 * - ADB client with keep-alive support
 * - Device discovery (network scan and ADB)
 * - Type definitions and constants
 */

// Types and constants
export * from './types'

// Fire TV utilities
export {
  type FireTVDevice,
  type StreamingApp,
  FIRETV_SPORTS_APPS,
  SPORTS_QUICK_ACCESS,
  generateFireTVDeviceId
} from './firetv-utils'

// ADB Client
export { ADBClient, type ADBConnectionOptions } from './adb-client'

// Discovery
export { FireCubeDiscovery } from './discovery'

// Sideload Service
export { SideloadService } from './sideload-service'

// Sports Content Detector
export { SportsContentDetector } from './sports-content-detector'
