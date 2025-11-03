/**
 * Rate Limiting Service
 *
 * Implements sliding window rate limiting for API endpoints
 * Stores rate limit data in memory with automatic cleanup
 *
 * Features:
 * - Sliding window algorithm for accurate rate limiting
 * - Per-IP and per-endpoint tracking
 * - Automatic cleanup of expired entries
 * - Configurable limits per endpoint
 * - Rate limit headers (X-RateLimit-*)
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Unique identifier for this rate limiter */
  identifier: string
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining in current window */
  remaining: number
  /** Unix timestamp when the rate limit resets */
  resetTime: number
  /** Total limit for this endpoint */
  limit: number
  /** Current request count */
  current: number
}

interface RequestRecord {
  timestamp: number
  ip: string
}

class RateLimiterService {
  // Map of identifier -> IP -> timestamps
  private requests: Map<string, Map<string, number[]>> = new Map()

  // Cleanup interval (runs every 5 minutes)
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

  constructor() {
    // Start automatic cleanup
    this.startCleanup()
  }

  /**
   * Check if a request should be allowed based on rate limits
   */
  checkLimit(ip: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const { maxRequests, windowMs, identifier } = config

    // Get or create the request map for this identifier
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, new Map())
    }
    const identifierRequests = this.requests.get(identifier)!

    // Get or create the request timestamps for this IP
    if (!identifierRequests.has(ip)) {
      identifierRequests.set(ip, [])
    }
    const ipRequests = identifierRequests.get(ip)!

    // Remove timestamps outside the current window
    const windowStart = now - windowMs
    const validRequests = ipRequests.filter(timestamp => timestamp > windowStart)

    // Update the stored requests
    identifierRequests.set(ip, validRequests)

    // Check if limit is exceeded
    const allowed = validRequests.length < maxRequests
    const remaining = Math.max(0, maxRequests - validRequests.length)

    // Calculate reset time (when the oldest request in window expires)
    const resetTime = validRequests.length > 0
      ? validRequests[0] + windowMs
      : now + windowMs

    // If allowed, add this request timestamp
    if (allowed) {
      validRequests.push(now)
      identifierRequests.set(ip, validRequests)
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      resetTime,
      limit: maxRequests,
      current: validRequests.length
    }
  }

  /**
   * Reset rate limit for a specific IP and identifier
   */
  reset(ip: string, identifier: string): void {
    const identifierRequests = this.requests.get(identifier)
    if (identifierRequests) {
      identifierRequests.delete(ip)
    }
  }

  /**
   * Reset all rate limits for an identifier
   */
  resetAll(identifier: string): void {
    this.requests.delete(identifier)
  }

  /**
   * Get current statistics for monitoring
   */
  getStats(): {
    totalIdentifiers: number
    totalIPs: number
    memoryUsage: number
  } {
    let totalIPs = 0
    this.requests.forEach(identifierMap => {
      totalIPs += identifierMap.size
    })

    // Rough estimate of memory usage
    const memoryUsage = this.requests.size * 1024 + totalIPs * 512 // bytes

    return {
      totalIdentifiers: this.requests.size,
      totalIPs,
      memoryUsage
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    this.requests.forEach((identifierMap, identifier) => {
      identifierMap.forEach((timestamps, ip) => {
        // Remove timestamps older than 1 hour (conservative cleanup)
        const validTimestamps = timestamps.filter(
          timestamp => now - timestamp < 60 * 60 * 1000
        )

        if (validTimestamps.length === 0) {
          identifierMap.delete(ip)
          cleaned++
        } else if (validTimestamps.length < timestamps.length) {
          identifierMap.set(ip, validTimestamps)
        }
      })

      // Remove empty identifier maps
      if (identifierMap.size === 0) {
        this.requests.delete(identifier)
      }
    })

    if (cleaned > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleaned} expired IP entries`)
    }
  }

  /**
   * Start automatic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.CLEANUP_INTERVAL_MS)

    // Don't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Stop automatic cleanup (for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clearAll(): void {
    this.requests.clear()
  }
}

// Singleton instance
export const rateLimiter = new RateLimiterService()

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // Default rate limit for general API endpoints
  DEFAULT: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'default'
  },

  // Stricter limit for AI endpoints
  AI: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'ai'
  },

  // More permissive for sports data
  SPORTS: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'sports'
  },

  // Very strict for expensive operations
  EXPENSIVE: {
    maxRequests: 2,
    windowMs: 60 * 1000, // 1 minute
    identifier: 'expensive'
  }
} as const
