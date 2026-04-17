/**
 * Rate Limiting Middleware - Re-exported from @sports-bar/rate-limiting
 *
 * This file bridges the local import path to the shared package.
 */

export {
  withRateLimit,
  checkRateLimit,
  getClientIp,
  createRateLimitHeaders,
  createRateLimitResponse,
  addRateLimitHeaders,
  type RateLimitCheckResult
} from '@sports-bar/rate-limiting'

// Also re-export rate limiter types for convenience
export { RateLimitConfigs, type RateLimitConfig, type RateLimitResult } from '@sports-bar/rate-limiting'
