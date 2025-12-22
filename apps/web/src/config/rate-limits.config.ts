/**
 * Bridge file for backwards compatibility
 * Re-exports from @sports-bar/config package
 */
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
} from '@sports-bar/config'
