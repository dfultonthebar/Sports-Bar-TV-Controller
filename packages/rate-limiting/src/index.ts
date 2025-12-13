/**
 * @sports-bar/rate-limiting
 *
 * Rate limiting middleware for Sports Bar TV Controller API endpoints
 *
 * Features:
 * - Sliding window rate limiting algorithm
 * - Per-IP and per-endpoint tracking
 * - Automatic cleanup of expired entries
 * - Configurable limits per endpoint type
 * - Standard rate limit headers (X-RateLimit-*)
 */

// Rate limiter service and configurations
export {
  rateLimiter,
  RateLimitConfigs,
  type RateLimitConfig,
  type RateLimitResult
} from './rate-limiter'

// Middleware utilities
export {
  withRateLimit,
  checkRateLimit,
  getClientIp,
  createRateLimitHeaders,
  createRateLimitResponse,
  addRateLimitHeaders,
  type RateLimitCheckResult
} from './middleware'

// Request throttling for external APIs
export {
  RequestThrottler,
  ThrottleConfigs,
  espnThrottler,
  sportsDBThrottler,
  ollamaThrottler,
  defaultThrottler,
  type ThrottleConfig
} from './request-throttler'
