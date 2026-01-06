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

// Scheduler Types and Interfaces
export {
  type FireCubeDevice,
  type FireCubeApp,
  type KeepAwakeLog,
  type ConnectionManagerAdapter,
  type FireCubeDeviceRepository,
  type FireCubeAppRepository,
  type KeepAwakeLogRepository,
  type FireCubeRepository,
  type KnownSportsApp,
  type SubscriptionCheckResult,
  type KeepAwakeStatus,
  KNOWN_SPORTS_APPS
} from './scheduler-types'

// Keep-Awake Scheduler
export {
  KeepAwakeScheduler,
  createKeepAwakeScheduler,
  type KeepAwakeSchedulerConfig
} from './keep-awake-scheduler'

// Subscription Detector
export {
  SubscriptionDetector,
  createSubscriptionDetector,
  type SubscriptionDetectorConfig
} from './subscription-detector'

// App Discovery Service
export {
  AppDiscoveryService,
  createAppDiscoveryService,
  type AppDiscoveryConfig,
  type AppDiscoveryRepository,
  type AppDiscoveryDeviceRepository,
  type AppDiscoveryLogger,
  type InstalledApp
} from './app-discovery'

// Subscription Polling (simple ADB-based)
export {
  pollRealFireTVSubscriptions,
  type Subscription as FireTVSubscription,
  type FireTVDeviceInfo
} from './subscription-polling'
