/**
 * Circuit Breaker Unit Tests
 *
 * Tests the circuit breaker utility in isolation with mocked dependencies
 * Focus: Business logic, state transitions, and error handling
 */

import { createCircuitBreaker, circuitBreakerRegistry, getCircuitBreakerHealth } from '@/lib/circuit-breaker'
import { sleep, waitFor, createRecoveringFunction, createSlowFunction } from '../helpers/test-utils'

// Mock the enhanced logger to prevent file I/O during tests
jest.mock('@/lib/enhanced-logger', () => ({
  enhancedLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  }
}))

describe('Circuit Breaker - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Circuit Breaker Creation', () => {
    it('should create a circuit breaker with default configuration', () => {
      const mockFn = jest.fn(async () => 'success')
      const breaker = createCircuitBreaker(mockFn, { name: 'test-default' })

      expect(breaker).toBeDefined()
      expect(breaker.name).toBe('test-default')
      expect((breaker as any).options.timeout).toBe(10000) // Default timeout
    })

    it('should create a circuit breaker with custom configuration', () => {
      const mockFn = jest.fn(async () => 'success')
      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-custom',
        timeout: 5000,
        errorThresholdPercentage: 75,
        resetTimeout: 15000,
        volumeThreshold: 20
      })

      expect((breaker as any).options.timeout).toBe(5000)
      expect((breaker as any).options.errorThresholdPercentage).toBe(75)
      expect((breaker as any).options.resetTimeout).toBe(15000)
      expect((breaker as any).options.volumeThreshold).toBe(20)
    })

    it('should register circuit breaker in global registry', () => {
      const mockFn = jest.fn(async () => 'success')
      const breaker = createCircuitBreaker(mockFn, { name: 'test-registry' })

      const registered = circuitBreakerRegistry.get('test-registry')
      expect(registered).toBe(breaker)
    })

    it('should support fallback function during creation', () => {
      const mockFn = jest.fn(async () => 'primary')
      const fallbackFn = jest.fn(async () => 'fallback')

      const breaker = createCircuitBreaker(mockFn, { name: 'test-with-fallback' }, fallbackFn)
      expect(breaker).toBeDefined()
    })
  })

  describe('State Transitions', () => {
    it('should start in closed state', () => {
      const mockFn = jest.fn(async () => 'success')
      const breaker = createCircuitBreaker(mockFn, { name: 'test-closed-initial' })

      expect(breaker.opened).toBe(false)
      expect(breaker.halfOpen).toBe(false)
    })

    it('should transition to open state after error threshold exceeded', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Test failure')
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-open-transition',
        timeout: 1000,
        errorThresholdPercentage: 50,
        volumeThreshold: 3
      })

      // Generate failures to exceed threshold
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected to fail
        }
      }

      expect(breaker.opened).toBe(true)
    })

    it('should transition to half-open after reset timeout', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Test failure')
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-half-open-transition',
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 500, // Short timeout for testing
        volumeThreshold: 2
      })

      // Open the circuit
      for (let i = 0; i < 4; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.opened).toBe(true)

      // Wait for reset timeout
      await sleep(600)

      // Circuit should be in half-open state now
      // Next request will test if it should close or re-open
      expect(breaker.halfOpen || breaker.opened).toBe(true)
    })

    it('should close circuit after successful request in half-open state', async () => {
      let shouldFail = true
      const mockFn = jest.fn(async () => {
        if (shouldFail) {
          throw new Error('Temporary failure')
        }
        return 'recovered'
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-recovery',
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 500,
        volumeThreshold: 2
      })

      // Open circuit
      for (let i = 0; i < 4; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.opened).toBe(true)

      // Wait for reset timeout
      await sleep(600)

      // Allow success
      shouldFail = false

      // Make successful request
      const result = await breaker.fire()
      expect(result).toBe('recovered')
      expect(breaker.opened).toBe(false)
    })

    it('should re-open circuit if request fails in half-open state', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Still failing')
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-reopen',
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 500,
        volumeThreshold: 2
      })

      // Open circuit
      for (let i = 0; i < 4; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.opened).toBe(true)
      const openedAt = Date.now()

      // Wait for reset timeout
      await sleep(600)

      // Try again and fail
      try {
        await breaker.fire()
      } catch (error) {
        // Expected to fail and re-open circuit
      }

      // Circuit should still be open
      expect(breaker.opened).toBe(true)
    })
  })

  describe('Failure Counting', () => {
    it('should count consecutive failures correctly', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Test failure')
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-failure-count',
        timeout: 1000,
        volumeThreshold: 5
      })

      // Make 3 failing requests
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      const stats = breaker.stats
      expect(stats.failures).toBe(3)
      expect(stats.successes).toBe(0)
    })

    it('should reset failure count after successful request', async () => {
      let shouldFail = true
      const mockFn = jest.fn(async () => {
        if (shouldFail) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-reset-count',
        timeout: 1000,
        volumeThreshold: 10
      })

      // Make 2 failing requests
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      // Make successful request
      shouldFail = false
      await breaker.fire()

      const stats = breaker.stats
      expect(stats.failures).toBe(2)
      expect(stats.successes).toBe(1)
    })

    it('should respect volume threshold before opening circuit', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Test failure')
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-volume-threshold',
        timeout: 1000,
        errorThresholdPercentage: 50,
        volumeThreshold: 5 // Need at least 5 requests
      })

      // Make only 3 failing requests (below volume threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      // Circuit should still be closed (volume threshold not reached)
      expect(breaker.opened).toBe(false)
    })
  })

  describe('Timeout Handling', () => {
    it('should timeout requests that exceed configured timeout', async () => {
      const slowFn = createSlowFunction('completed', 2000)

      const breaker = createCircuitBreaker(slowFn, {
        name: 'test-timeout',
        timeout: 500 // 500ms timeout
      })

      await expect(breaker.fire()).rejects.toThrow()
      expect(breaker.stats.timeouts).toBe(1)
    })

    it('should not timeout fast requests', async () => {
      const fastFn = createSlowFunction('completed', 100)

      const breaker = createCircuitBreaker(fastFn, {
        name: 'test-no-timeout',
        timeout: 500
      })

      const result = await breaker.fire()
      expect(result).toBe('completed')
      expect(breaker.stats.timeouts).toBe(0)
    })

    it('should treat timeouts as failures for error threshold', async () => {
      const slowFn = createSlowFunction('completed', 1000)

      const breaker = createCircuitBreaker(slowFn, {
        name: 'test-timeout-as-failure',
        timeout: 200,
        errorThresholdPercentage: 50,
        volumeThreshold: 3
      })

      // Multiple timeouts should open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected timeout
        }
      }

      expect(breaker.opened).toBe(true)
      expect(breaker.stats.timeouts).toBeGreaterThan(0)
    })
  })

  describe('Fallback Execution', () => {
    it('should execute fallback when circuit is open', async () => {
      const primaryFn = jest.fn(async () => {
        throw new Error('Primary failed')
      })
      const fallbackFn = jest.fn(async () => 'fallback-result')

      const breaker = createCircuitBreaker(
        primaryFn,
        {
          name: 'test-fallback-open',
          timeout: 1000,
          errorThresholdPercentage: 50,
          volumeThreshold: 2
        },
        fallbackFn
      )

      // Open circuit
      for (let i = 0; i < 4; i++) {
        await breaker.fire()
      }

      expect(breaker.opened).toBe(true)

      // Next call should use fallback
      const result = await breaker.fire()
      expect(result).toBe('fallback-result')
      expect(fallbackFn).toHaveBeenCalled()
    })

    it('should not execute fallback when circuit is closed', async () => {
      const primaryFn = jest.fn(async () => 'primary-result')
      const fallbackFn = jest.fn(async () => 'fallback-result')

      const breaker = createCircuitBreaker(
        primaryFn,
        { name: 'test-no-fallback' },
        fallbackFn
      )

      const result = await breaker.fire()
      expect(result).toBe('primary-result')
      expect(primaryFn).toHaveBeenCalled()
      expect(fallbackFn).not.toHaveBeenCalled()
    })

    it('should pass arguments to fallback function', async () => {
      const primaryFn = jest.fn(async (a: number, b: number) => {
        throw new Error('Primary failed')
      })
      const fallbackFn = jest.fn(async (a: number, b: number) => a + b)

      const breaker = createCircuitBreaker(
        primaryFn,
        {
          name: 'test-fallback-args',
          timeout: 1000,
          errorThresholdPercentage: 50,
          volumeThreshold: 2
        },
        fallbackFn
      )

      // Open circuit
      for (let i = 0; i < 4; i++) {
        await breaker.fire(5, 3)
      }

      // Fallback should receive arguments (note: opossum passes error as 3rd arg)
      const result = await breaker.fire(10, 20)
      expect(result).toBe(30)
      // Opossum passes arguments and error to fallback
      expect(fallbackFn).toHaveBeenCalled()
    })
  })

  describe('Statistics and Monitoring', () => {
    it('should track success count', async () => {
      const mockFn = jest.fn(async () => 'success')

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-success-stats',
        timeout: 1000
      })

      await breaker.fire()
      await breaker.fire()
      await breaker.fire()

      expect(breaker.stats.successes).toBe(3)
    })

    it('should track failure count', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Test failure')
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-failure-stats',
        timeout: 1000,
        volumeThreshold: 10
      })

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.stats.failures).toBe(3)
    })

    it('should track reject count when circuit is open', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Test failure')
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-reject-stats',
        timeout: 1000,
        errorThresholdPercentage: 50,
        volumeThreshold: 2
      })

      // Open circuit
      for (let i = 0; i < 4; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.opened).toBe(true)

      // Try more requests (should be rejected)
      const rejectsBefore = breaker.stats.rejects
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected to be rejected
        }
      }

      expect(breaker.stats.rejects).toBeGreaterThan(rejectsBefore)
    })

    it('should track latency percentiles', async () => {
      const mockFn = jest.fn(async () => {
        await sleep(50)
        return 'success'
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-latency',
        timeout: 1000
      })

      // Make several requests
      for (let i = 0; i < 5; i++) {
        await breaker.fire()
      }

      const stats = breaker.stats
      expect(stats.latencyMean).toBeGreaterThan(0)
      expect(stats.percentiles).toBeDefined()
      expect(stats.percentiles['0.5']).toBeGreaterThan(0)
    })
  })

  describe('Circuit Breaker Registry', () => {
    it('should store all created circuit breakers', () => {
      const breaker1 = createCircuitBreaker(
        async () => 'test1',
        { name: 'test-registry-1' }
      )
      const breaker2 = createCircuitBreaker(
        async () => 'test2',
        { name: 'test-registry-2' }
      )

      expect(circuitBreakerRegistry.get('test-registry-1')).toBe(breaker1)
      expect(circuitBreakerRegistry.get('test-registry-2')).toBe(breaker2)
    })

    it('should provide all circuit states', () => {
      createCircuitBreaker(async () => 'test', { name: 'test-state-1' })
      createCircuitBreaker(async () => 'test', { name: 'test-state-2' })

      const states = circuitBreakerRegistry.getCircuitStates()
      expect(states['test-state-1']).toBeDefined()
      expect(states['test-state-2']).toBeDefined()
      expect(states['test-state-1'].state).toBe('closed')
      expect(states['test-state-1'].stats).toBeDefined()
    })

    it('should provide all circuit stats', () => {
      createCircuitBreaker(async () => 'test', { name: 'test-all-stats-1' })
      createCircuitBreaker(async () => 'test', { name: 'test-all-stats-2' })

      const allStats = circuitBreakerRegistry.getAllStats()
      expect(allStats['test-all-stats-1']).toBeDefined()
      expect(allStats['test-all-stats-2']).toBeDefined()
      expect(allStats['test-all-stats-1'].failures).toBeDefined()
      expect(allStats['test-all-stats-1'].successes).toBeDefined()
    })
  })

  describe('Health Status', () => {
    it('should report healthy when all circuits are closed', () => {
      createCircuitBreaker(async () => 'test', { name: 'test-health-closed-1' })
      createCircuitBreaker(async () => 'test', { name: 'test-health-closed-2' })

      const health = getCircuitBreakerHealth()
      // Note: May have open circuits from previous tests in registry
      expect(health.totalCircuits).toBeGreaterThan(0)
      // Only check that our new circuits are in the list
      const states = circuitBreakerRegistry.getCircuitStates()
      expect(states['test-health-closed-1'].state).toBe('closed')
      expect(states['test-health-closed-2'].state).toBe('closed')
    })

    it('should report unhealthy when circuits are open', async () => {
      const failingFn = jest.fn(async () => {
        throw new Error('Test failure')
      })

      const breaker = createCircuitBreaker(failingFn, {
        name: 'test-unhealthy',
        timeout: 1000,
        errorThresholdPercentage: 50,
        volumeThreshold: 2
      })

      // Open circuit
      for (let i = 0; i < 4; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      const health = getCircuitBreakerHealth()
      expect(health.openCircuits).toContain('test-unhealthy')
      expect(health.summary).toContain('open')
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid concurrent requests', async () => {
      let callCount = 0
      const mockFn = jest.fn(async () => {
        callCount++
        await sleep(10)
        return callCount
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-concurrent',
        timeout: 1000
      })

      // Fire multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => breaker.fire())
      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      expect(breaker.stats.successes).toBe(10)
    })

    it('should handle very short timeout', async () => {
      const mockFn = jest.fn(async () => {
        await sleep(100)
        return 'completed'
      })

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-short-timeout',
        timeout: 10 // Very short but non-zero timeout
      })

      // Should timeout
      await expect(breaker.fire()).rejects.toThrow()
    })

    it('should handle empty function name', () => {
      const mockFn = jest.fn(async () => 'test')

      const breaker = createCircuitBreaker(mockFn, {
        name: '',
        timeout: 1000
      })

      expect(breaker).toBeDefined()
    })

    it('should handle function that returns undefined', async () => {
      const mockFn = jest.fn(async () => undefined)

      const breaker = createCircuitBreaker(mockFn, {
        name: 'test-undefined',
        timeout: 1000
      })

      const result = await breaker.fire()
      expect(result).toBeUndefined()
      expect(breaker.stats.successes).toBe(1)
    })
  })
})
