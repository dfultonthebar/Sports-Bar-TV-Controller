/**
 * DEPRECATED: This file has been moved to @sports-bar/utils
 *
 * This file is kept for backwards compatibility only.
 * Please import from @sports-bar/utils instead:
 *
 * @example
 * // Old (deprecated)
 * import { ConfigChangeTracker } from '@sports-bar/config'
 *
 * // New (recommended)
 * import { ConfigChangeTracker } from '@sports-bar/utils'
 */

export {
  ConfigChangeTracker,
  createConfigChangeTracker,
  type ConfigChangeEvent,
  type ConfigLogger,
  type ConfigEnhancedLogger as EnhancedLogger,
  type EnhancedLogEntry,
  type AutoSyncConfig,
  type AutoSyncClient,
  type ConfigChangeTrackerOptions,
} from '@sports-bar/utils'

// Backwards compatibility alias
export type { ConfigLogger as Logger } from '@sports-bar/utils'
