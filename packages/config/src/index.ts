/**
 * @sports-bar/config
 *
 * Shared configuration and validation schemas for Sports Bar TV Controller
 *
 * Usage:
 *   // Import validation schemas
 *   import { uuidSchema, deviceIdSchema, z } from '@sports-bar/config/validation'
 *
 *   // Import rate limiting config
 *   import { RATE_LIMIT_POLICIES, getRateLimitForEndpoint } from '@sports-bar/config'
 *
 *   // Import Fire TV config
 *   import { getFireTVConfig, calculateBackoffDelay } from '@sports-bar/config'
 *
 *   // Extend TypeScript configs
 *   // In your tsconfig.json: { "extends": "@sports-bar/config/tsconfig/next.json" }
 */

// Re-export all validation schemas
export * from './validation'

// Rate Limiting Configuration
export {
  RATE_LIMIT_POLICIES,
  EXTERNAL_API_THROTTLING,
  RATE_LIMIT_HEADERS,
  MEMORY_CONFIG,
  ENDPOINT_RATE_LIMITS,
  RATE_LIMIT_FEATURES,
  DEV_OVERRIDES,
  getRateLimitForEndpoint,
  getAdjustedLimits,
} from './rate-limits'

// Fire TV Configuration
export {
  type FireTVConfig,
  defaultFireTVConfig,
  devFireTVConfig,
  prodFireTVConfig,
  getFireTVConfig,
  calculateBackoffDelay,
} from './firetv-config'
