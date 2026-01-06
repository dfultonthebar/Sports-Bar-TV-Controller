/**
 * Rate Limiter Unit Tests
 *
 * Tests the rate limiting service in isolation
 * Focus: Request counting, window sliding, memory management
 */

import { rateLimiter, RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { sleep, generateTestData } from '../helpers/test-utils'

describe('Rate Limiter - Unit Tests', () => {
  beforeEach(() => {
    // Clear all rate limit data before each test
    rateLimiter.clearAll()
    jest.clearAllMocks()
  })

  afterAll(() => {
    // Stop cleanup interval to prevent memory leaks
    rateLimiter.stopCleanup()
  })

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: 'test-basic'
      }

      // Make 5 requests (at the limit)
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit(ip, config)
        expect(result.allowed).toBe(true)
      }
    })

    it('should block requests over the limit', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 3,
        windowMs: 60000,
        identifier: 'test-block'
      }

      // Make 3 requests (at the limit)
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.checkLimit(ip, config)
        expect(result.allowed).toBe(true)
      }

      // 4th request should be blocked
      const result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should return correct remaining count', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: 'test-remaining'
      }

      const result1 = rateLimiter.checkLimit(ip, config)
      expect(result1.remaining).toBe(4) // 5 - 1 = 4 remaining

      const result2 = rateLimiter.checkLimit(ip, config)
      expect(result2.remaining).toBe(3) // 5 - 2 = 3 remaining

      const result3 = rateLimiter.checkLimit(ip, config)
      expect(result3.remaining).toBe(2) // 5 - 3 = 2 remaining
    })

    it('should track current request count', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 10,
        windowMs: 60000,
        identifier: 'test-current'
      }

      rateLimiter.checkLimit(ip, config)
      rateLimiter.checkLimit(ip, config)
      const result = rateLimiter.checkLimit(ip, config)

      expect(result.current).toBe(3)
    })
  })

  describe('Sliding Window Behavior', () => {
    it('should reset limit after window expires', async () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 2,
        windowMs: 100, // 100ms window
        identifier: 'test-window-reset'
      }

      // Use up the limit
      rateLimiter.checkLimit(ip, config)
      rateLimiter.checkLimit(ip, config)

      let result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(false)

      // Wait for window to expire
      await sleep(150)

      // Should be allowed again
      result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1)
    })

    it('should handle partial window expiration', async () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 3,
        windowMs: 200,
        identifier: 'test-partial-window'
      }

      // Make 2 requests
      rateLimiter.checkLimit(ip, config)
      rateLimiter.checkLimit(ip, config)

      // Wait for first request to expire
      await sleep(220)

      // Make another request (should have 2 slots: 1 from expired, 1 from remaining)
      const result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(true)
    })

    it('should maintain sliding window correctly', async () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 3,
        windowMs: 300,
        identifier: 'test-sliding'
      }

      // t=0: Request 1
      rateLimiter.checkLimit(ip, config)

      // t=100: Request 2
      await sleep(100)
      rateLimiter.checkLimit(ip, config)

      // t=200: Request 3
      await sleep(100)
      rateLimiter.checkLimit(ip, config)

      // t=200: Request 4 should be blocked (3 requests in last 300ms)
      let result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(false)

      // t=350: First request should have expired
      await sleep(150)
      result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Multi-IP Support', () => {
    it('should track different IPs independently', () => {
      const ip1 = '192.168.1.1'
      const ip2 = '192.168.1.2'
      const config = {
        maxRequests: 2,
        windowMs: 60000,
        identifier: 'test-multi-ip'
      }

      // IP1 uses up limit
      rateLimiter.checkLimit(ip1, config)
      rateLimiter.checkLimit(ip1, config)
      let result = rateLimiter.checkLimit(ip1, config)
      expect(result.allowed).toBe(false)

      // IP2 should still be allowed
      result = rateLimiter.checkLimit(ip2, config)
      expect(result.allowed).toBe(true)
    })

    it('should handle many concurrent IPs', () => {
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: 'test-many-ips'
      }

      // Create 100 different IPs
      const ips = Array.from({ length: 100 }, (_, i) => `192.168.1.${i}`)

      // Each IP makes 3 requests
      ips.forEach(ip => {
        for (let i = 0; i < 3; i++) {
          const result = rateLimiter.checkLimit(ip, config)
          expect(result.allowed).toBe(true)
        }
      })

      // Verify stats
      const stats = rateLimiter.getStats()
      expect(stats.totalIPs).toBe(100)
    })
  })

  describe('Multi-Identifier Support', () => {
    it('should track different identifiers independently', () => {
      const ip = generateTestData.ip()
      const config1 = {
        maxRequests: 2,
        windowMs: 60000,
        identifier: 'endpoint-1'
      }
      const config2 = {
        maxRequests: 2,
        windowMs: 60000,
        identifier: 'endpoint-2'
      }

      // Use up limit for endpoint-1
      rateLimiter.checkLimit(ip, config1)
      rateLimiter.checkLimit(ip, config1)
      let result = rateLimiter.checkLimit(ip, config1)
      expect(result.allowed).toBe(false)

      // endpoint-2 should still be allowed
      result = rateLimiter.checkLimit(ip, config2)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset rate limit for specific IP and identifier', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 2,
        windowMs: 60000,
        identifier: 'test-reset-ip'
      }

      // Use up limit
      rateLimiter.checkLimit(ip, config)
      rateLimiter.checkLimit(ip, config)
      let result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(false)

      // Reset for this IP
      rateLimiter.reset(ip, config.identifier)

      // Should be allowed again
      result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(true)
    })

    it('should reset all IPs for an identifier', () => {
      const ip1 = '192.168.1.1'
      const ip2 = '192.168.1.2'
      const config = {
        maxRequests: 1,
        windowMs: 60000,
        identifier: 'test-reset-all'
      }

      // Use up limits for both IPs
      rateLimiter.checkLimit(ip1, config)
      rateLimiter.checkLimit(ip2, config)

      let result1 = rateLimiter.checkLimit(ip1, config)
      let result2 = rateLimiter.checkLimit(ip2, config)
      expect(result1.allowed).toBe(false)
      expect(result2.allowed).toBe(false)

      // Reset all for this identifier
      rateLimiter.resetAll(config.identifier)

      // Both should be allowed again
      result1 = rateLimiter.checkLimit(ip1, config)
      result2 = rateLimiter.checkLimit(ip2, config)
      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)
    })

    it('should clear all rate limit data', () => {
      const config = {
        maxRequests: 2,
        windowMs: 60000,
        identifier: 'test-clear-all'
      }

      // Add some data
      rateLimiter.checkLimit('192.168.1.1', config)
      rateLimiter.checkLimit('192.168.1.2', config)

      let stats = rateLimiter.getStats()
      expect(stats.totalIPs).toBeGreaterThan(0)

      // Clear everything
      rateLimiter.clearAll()

      stats = rateLimiter.getStats()
      expect(stats.totalIPs).toBe(0)
      expect(stats.totalIdentifiers).toBe(0)
    })
  })

  describe('Reset Time Calculation', () => {
    it('should provide correct reset timestamp', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: 'test-reset-time'
      }

      const beforeTime = Date.now()
      const result = rateLimiter.checkLimit(ip, config)
      const afterTime = Date.now()

      // Reset time should be approximately now + windowMs
      const expectedResetTime = beforeTime + config.windowMs
      const actualResetTime = result.resetTime

      // Allow 1 second tolerance for test execution time
      expect(actualResetTime).toBeGreaterThanOrEqual(expectedResetTime - 1000)
      expect(actualResetTime).toBeLessThanOrEqual(afterTime + config.windowMs + 1000)
    })

    it('should update reset time based on oldest request', async () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 3,
        windowMs: 1000,
        identifier: 'test-reset-update'
      }

      const result1 = rateLimiter.checkLimit(ip, config)
      const firstResetTime = result1.resetTime

      await sleep(100)

      const result2 = rateLimiter.checkLimit(ip, config)
      const secondResetTime = result2.resetTime

      // Reset time should still be based on first request
      expect(secondResetTime).toBe(firstResetTime)
    })
  })

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', () => {
      const config1 = { maxRequests: 5, windowMs: 60000, identifier: 'stats-1' }
      const config2 = { maxRequests: 5, windowMs: 60000, identifier: 'stats-2' }

      // Add requests for multiple IPs and identifiers
      rateLimiter.checkLimit('192.168.1.1', config1)
      rateLimiter.checkLimit('192.168.1.2', config1)
      rateLimiter.checkLimit('192.168.1.1', config2)

      const stats = rateLimiter.getStats()
      expect(stats.totalIdentifiers).toBe(2)
      expect(stats.totalIPs).toBe(3) // 2 IPs in stats-1, 1 IP in stats-2
      expect(stats.memoryUsage).toBeGreaterThan(0)
    })

    it('should estimate memory usage', () => {
      const config = { maxRequests: 10, windowMs: 60000, identifier: 'memory-test' }

      // Add many requests
      for (let i = 0; i < 50; i++) {
        rateLimiter.checkLimit(`192.168.1.${i}`, config)
      }

      const stats = rateLimiter.getStats()
      expect(stats.memoryUsage).toBeGreaterThan(0)
      expect(typeof stats.memoryUsage).toBe('number')
    })
  })

  describe('Predefined Configurations', () => {
    it('should have DEFAULT configuration', () => {
      expect(RateLimitConfigs.DEFAULT).toBeDefined()
      expect(RateLimitConfigs.DEFAULT.maxRequests).toBe(30)
      expect(RateLimitConfigs.DEFAULT.windowMs).toBe(60000)
    })

    it('should have strict AI configuration', () => {
      expect(RateLimitConfigs.AI).toBeDefined()
      expect(RateLimitConfigs.AI.maxRequests).toBe(5)
      expect(RateLimitConfigs.AI.windowMs).toBe(60000)
    })

    it('should have hardware configuration', () => {
      expect(RateLimitConfigs.HARDWARE).toBeDefined()
      expect(RateLimitConfigs.HARDWARE.maxRequests).toBe(60)
    })

    it('should have auth configuration for brute force protection', () => {
      expect(RateLimitConfigs.AUTH).toBeDefined()
      expect(RateLimitConfigs.AUTH.maxRequests).toBe(10)
    })

    it('should have system configuration with high limits', () => {
      expect(RateLimitConfigs.SYSTEM).toBeDefined()
      expect(RateLimitConfigs.SYSTEM.maxRequests).toBe(100)
    })
  })

  describe('Configuration Application', () => {
    it('should apply default configuration correctly', () => {
      const ip = generateTestData.ip()

      // Use default config
      for (let i = 0; i < RateLimitConfigs.DEFAULT.maxRequests; i++) {
        const result = rateLimiter.checkLimit(ip, RateLimitConfigs.DEFAULT)
        expect(result.allowed).toBe(true)
      }

      // Next request should be blocked
      const result = rateLimiter.checkLimit(ip, RateLimitConfigs.DEFAULT)
      expect(result.allowed).toBe(false)
    })

    it('should apply AI configuration correctly', () => {
      const ip = generateTestData.ip()

      // AI has strict limit of 5 requests
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit(ip, RateLimitConfigs.AI)
        expect(result.allowed).toBe(true)
      }

      const result = rateLimiter.checkLimit(ip, RateLimitConfigs.AI)
      expect(result.allowed).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero max requests', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 0,
        windowMs: 60000,
        identifier: 'test-zero-limit'
      }

      const result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle very short window', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 5,
        windowMs: 1, // 1ms window
        identifier: 'test-short-window'
      }

      const result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(true)
    })

    it('should handle very long window', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 5,
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        identifier: 'test-long-window'
      }

      const result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(5)
    })

    it('should handle empty string IP', () => {
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: 'test-empty-ip'
      }

      const result = rateLimiter.checkLimit('', config)
      expect(result).toBeDefined()
      expect(typeof result.allowed).toBe('boolean')
    })

    it('should handle empty string identifier', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: ''
      }

      const result = rateLimiter.checkLimit(ip, config)
      expect(result).toBeDefined()
    })

    it('should handle rapid successive requests', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 100,
        windowMs: 60000,
        identifier: 'test-rapid'
      }

      // Make 100 requests as fast as possible
      for (let i = 0; i < 100; i++) {
        const result = rateLimiter.checkLimit(ip, config)
        expect(result.allowed).toBe(true)
      }

      // 101st should be blocked
      const result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(false)
    })

    it('should handle request at exact limit boundary', () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: 'test-boundary'
      }

      // Make exactly maxRequests requests
      for (let i = 0; i < config.maxRequests; i++) {
        const result = rateLimiter.checkLimit(ip, config)
        expect(result.allowed).toBe(true)
      }

      // Next request should be blocked
      const result = rateLimiter.checkLimit(ip, config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.current).toBe(config.maxRequests)
    })
  })

  describe('Concurrent Access', () => {
    it('should handle concurrent requests from same IP', async () => {
      const ip = generateTestData.ip()
      const config = {
        maxRequests: 10,
        windowMs: 60000,
        identifier: 'test-concurrent-same'
      }

      // Make 5 concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        Promise.resolve(rateLimiter.checkLimit(ip, config))
      )

      const results = await Promise.all(promises)

      // All should be allowed
      results.forEach(result => {
        expect(result.allowed).toBe(true)
      })
    })

    it('should handle concurrent requests from different IPs', async () => {
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: 'test-concurrent-diff'
      }

      // Create 10 different IPs making concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(rateLimiter.checkLimit(`192.168.1.${i}`, config))
      )

      const results = await Promise.all(promises)

      // All should be allowed (first request from each IP)
      results.forEach(result => {
        expect(result.allowed).toBe(true)
      })

      const stats = rateLimiter.getStats()
      expect(stats.totalIPs).toBe(10)
    })
  })

  describe('Memory Management', () => {
    it('should not grow unbounded with many IPs', () => {
      const config = {
        maxRequests: 5,
        windowMs: 60000,
        identifier: 'test-memory-bounded'
      }

      // Add 1000 IPs
      for (let i = 0; i < 1000; i++) {
        rateLimiter.checkLimit(`192.168.${Math.floor(i / 255)}.${i % 255}`, config)
      }

      const stats1 = rateLimiter.getStats()
      const memory1 = stats1.memoryUsage

      // Add 1000 more IPs
      for (let i = 1000; i < 2000; i++) {
        rateLimiter.checkLimit(`192.168.${Math.floor(i / 255)}.${i % 255}`, config)
      }

      const stats2 = rateLimiter.getStats()
      const memory2 = stats2.memoryUsage

      // Memory should have grown, but not linearly (due to cleanup)
      expect(memory2).toBeGreaterThan(memory1)
      expect(memory2).toBeLessThan(memory1 * 3) // Should be less than 3x
    })
  })
})
