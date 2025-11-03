/**
 * Rate Limiting Configuration
 *
 * Centralized configuration for all rate limits and throttling settings
 * in the Sports Bar TV Controller application.
 *
 * This file defines:
 * - API endpoint rate limits
 * - External API throttling settings
 * - Request queue configurations
 *
 * Usage:
 * Import this config in your API routes or services to ensure
 * consistent rate limiting across the application.
 */

/**
 * Rate Limit Policies by Endpoint Type
 *
 * These limits are enforced per IP address using a sliding window algorithm.
 */
export const RATE_LIMIT_POLICIES = {
  /**
   * Default rate limit for general API endpoints
   * Applied to most standard API calls
   */
  DEFAULT: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'default',
    description: 'Standard API endpoints'
  },

  /**
   * Strict limit for AI endpoints (chat, analysis, etc.)
   * AI operations are computationally expensive
   */
  AI: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'ai',
    description: 'AI chat and analysis endpoints'
  },

  /**
   * Moderate limit for sports data endpoints
   * Sports data is frequently accessed but not computationally expensive
   */
  SPORTS: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'sports',
    description: 'Sports guide and schedule endpoints'
  },

  /**
   * Very strict limit for expensive operations
   * Operations like bulk processing, database rebuilds, etc.
   */
  EXPENSIVE: {
    maxRequests: 2,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'expensive',
    description: 'Resource-intensive operations'
  },

  /**
   * Permissive limit for device control endpoints
   * Need to allow quick successive commands for AV control
   */
  DEVICE_CONTROL: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'device-control',
    description: 'TV, audio, and device control endpoints'
  },

  /**
   * Moderate limit for logging and metrics endpoints
   */
  LOGGING: {
    maxRequests: 15,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'logging',
    description: 'Logging and metrics endpoints'
  }
} as const

/**
 * External API Throttling Configuration
 *
 * These settings control how we rate-limit our outgoing requests
 * to external APIs to avoid hitting their limits.
 */
export const EXTERNAL_API_THROTTLING = {
  /**
   * ESPN API Throttling
   * ESPN is generous with free tier but we want to be respectful
   */
  ESPN: {
    requestsPerSecond: 2,
    maxConcurrent: 3,
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 10000,
    description: 'ESPN sports data API'
  },

  /**
   * TheSportsDB API Throttling
   * Free tier, so we're very conservative
   */
  SPORTS_DB: {
    requestsPerSecond: 1,
    maxConcurrent: 2,
    maxRetries: 3,
    initialBackoffMs: 2000,
    maxBackoffMs: 15000,
    description: 'TheSportsDB API'
  },

  /**
   * Ollama (Local AI) Throttling
   * Local service, but resource-intensive
   * Only allow one AI request at a time to avoid overload
   */
  OLLAMA: {
    requestsPerSecond: 1,
    maxConcurrent: 1,
    maxRetries: 2,
    initialBackoffMs: 500,
    maxBackoffMs: 5000,
    description: 'Ollama local AI service'
  },

  /**
   * The Rail Media Sports Guide API
   * Paid service, moderate limits
   */
  RAIL_MEDIA: {
    requestsPerSecond: 2,
    maxConcurrent: 3,
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 10000,
    description: 'The Rail Media sports guide API'
  },

  /**
   * Default throttling for other external APIs
   */
  DEFAULT: {
    requestsPerSecond: 5,
    maxConcurrent: 5,
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 10000,
    description: 'Default external API throttling'
  }
} as const

/**
 * Rate Limit Response Headers
 *
 * Standard headers we include in rate-limited responses
 */
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After'
} as const

/**
 * Memory Management Configuration
 */
export const MEMORY_CONFIG = {
  /**
   * How often to clean up expired rate limit entries (ms)
   */
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes

  /**
   * How long to keep rate limit entries in memory (ms)
   * Entries older than this are removed during cleanup
   */
  ENTRY_MAX_AGE_MS: 60 * 60 * 1000, // 1 hour

  /**
   * Maximum number of unique IPs to track before forcing cleanup
   */
  MAX_IPS_TRACKED: 10000
} as const

/**
 * Endpoint to Rate Limit Policy Mapping
 *
 * Map specific API routes to their rate limit policies
 */
export const ENDPOINT_RATE_LIMITS = {
  // AI Endpoints
  '/api/ai/enhanced-chat': 'AI',
  '/api/ai/tool-chat': 'AI',
  '/api/ai/log-analysis': 'AI',
  '/api/ai-assistant/analyze-logs': 'AI',
  '/api/devices/ai-analysis': 'AI',

  // Sports Data Endpoints
  '/api/sports-guide': 'SPORTS',
  '/api/sports-guide/scheduled': 'SPORTS',
  '/api/tv-guide/unified': 'SPORTS',
  '/api/unified-guide': 'SPORTS',

  // Device Control Endpoints
  '/api/directv-devices': 'DEVICE_CONTROL',
  '/api/ir-devices/send-command': 'DEVICE_CONTROL',
  '/api/matrix/switch-input-enhanced': 'DEVICE_CONTROL',
  '/api/cec/command': 'DEVICE_CONTROL',

  // Expensive Operations
  '/api/ai/rebuild-knowledge-base': 'EXPENSIVE',
  '/api/backup': 'EXPENSIVE',
  '/api/system/reboot': 'EXPENSIVE',

  // Logging
  '/api/logs/user-action': 'LOGGING',
  '/api/logs/error': 'LOGGING',
  '/api/logs/recent': 'LOGGING',

  // Default for everything else
  '*': 'DEFAULT'
} as const

/**
 * Feature Flags
 */
export const RATE_LIMIT_FEATURES = {
  /**
   * Enable rate limiting globally
   */
  ENABLED: process.env.RATE_LIMITING_ENABLED !== 'false',

  /**
   * Enable request throttling for external APIs
   */
  THROTTLING_ENABLED: process.env.API_THROTTLING_ENABLED !== 'false',

  /**
   * Log rate limit violations (for monitoring)
   */
  LOG_VIOLATIONS: process.env.LOG_RATE_LIMIT_VIOLATIONS !== 'false',

  /**
   * Enable metrics collection
   */
  COLLECT_METRICS: process.env.COLLECT_RATE_LIMIT_METRICS !== 'false'
} as const

/**
 * Development Mode Overrides
 *
 * In development, you might want to disable or relax rate limits
 */
export const DEV_OVERRIDES = {
  /**
   * Disable rate limiting in development
   */
  DISABLE_IN_DEV: process.env.NODE_ENV === 'development' &&
                  process.env.DISABLE_RATE_LIMITS_IN_DEV === 'true',

  /**
   * Multiply all limits by this factor in development
   * (e.g., 10 = 10x more permissive)
   */
  DEV_LIMIT_MULTIPLIER: process.env.NODE_ENV === 'development' ? 10 : 1
} as const

/**
 * Helper function to get rate limit config for an endpoint
 */
export function getRateLimitForEndpoint(endpoint: string) {
  const policy = ENDPOINT_RATE_LIMITS[endpoint as keyof typeof ENDPOINT_RATE_LIMITS] ||
                 ENDPOINT_RATE_LIMITS['*']
  return RATE_LIMIT_POLICIES[policy as keyof typeof RATE_LIMIT_POLICIES]
}

/**
 * Helper function to get adjusted limits for development
 */
export function getAdjustedLimits(config: typeof RATE_LIMIT_POLICIES[keyof typeof RATE_LIMIT_POLICIES]) {
  if (DEV_OVERRIDES.DISABLE_IN_DEV) {
    return {
      ...config,
      maxRequests: 999999 // Effectively unlimited
    }
  }

  return {
    ...config,
    maxRequests: config.maxRequests * DEV_OVERRIDES.DEV_LIMIT_MULTIPLIER
  }
}
