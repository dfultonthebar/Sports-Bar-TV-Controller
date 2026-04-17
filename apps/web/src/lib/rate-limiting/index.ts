/**
 * Rate Limiting - Re-exported from @sports-bar/rate-limiting
 *
 * This file bridges the local import path (@/lib/rate-limiting) to the shared package.
 * All rate limiting functionality is maintained in the @sports-bar/rate-limiting package.
 */

// Re-export everything from the rate-limiting package
export {
  // Rate limiter service and configurations
  rateLimiter,
  RateLimitConfigs,
  type RateLimitConfig,
  type RateLimitResult,
  // Middleware utilities
  withRateLimit,
  checkRateLimit,
  getClientIp,
  createRateLimitHeaders,
  createRateLimitResponse,
  addRateLimitHeaders,
  type RateLimitCheckResult,
  // Request throttling for external APIs
  RequestThrottler,
  ThrottleConfigs,
  espnThrottler,
  sportsDBThrottler,
  ollamaThrottler,
  defaultThrottler,
  type ThrottleConfig
} from '@sports-bar/rate-limiting'
