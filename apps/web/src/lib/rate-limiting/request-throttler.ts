/**
 * Request Throttler Bridge
 * Re-exports from @sports-bar/rate-limiting for backward compatibility.
 */
export {
  RequestThrottler,
  ThrottleConfigs,
  espnThrottler,
  sportsDBThrottler,
  ollamaThrottler,
  defaultThrottler,
  type ThrottleConfig
} from '@sports-bar/rate-limiting'
