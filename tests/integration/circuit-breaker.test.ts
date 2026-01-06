/**
 * Circuit Breaker Integration Tests
 *
 * Comprehensive test suite for circuit breaker functionality:
 * - Circuit opening after threshold failures
 * - Circuit closing after successful requests
 * - Fallback execution when circuit is open
 * - Timeout behavior
 * - Status endpoint functionality
 *
 * @version 1.0.0
 */

import { createCircuitBreaker, circuitBreakerRegistry, getCircuitBreakerHealth } from '@/lib/circuit-breaker'

// Mock enhanced logger to prevent file system operations in tests
jest.mock('@/lib/enhanced-logger', () => ({
  enhancedLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  }
}))

describe('Circuit Breaker Integration Tests', () => {
  // Helper function to create a delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  describe('Circuit Opening and Closing', () => {
    it('should open circuit after threshold failures', async () => {
      let callCount = 0
      const failingFunction = async () => {
        callCount++
        throw new Error('Simulated failure')
      }

      const breaker = createCircuitBreaker(
        failingFunction,
        {
          name: 'test-failing-circuit',
          timeout: 1000,
          errorThresholdPercentage: 50,
          resetTimeout: 1000,
          volumeThreshold: 3
        }
      )

      // Make several failing requests
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should now be open
      expect(breaker.opened).toBe(true)
      expect(callCount).toBeLessThan(5) // Some requests should be rejected
    })

    it('should close circuit after successful requests in half-open state', async () => {
      let shouldFail = true
      const intermittentFunction = async () => {
        if (shouldFail) {
          throw new Error('Simulated failure')
        }
        return 'success'
      }

      const breaker = createCircuitBreaker(
        intermittentFunction,
        {
          name: 'test-recovery-circuit',
          timeout: 1000,
          errorThresholdPercentage: 50,
          resetTimeout: 500,
          volumeThreshold: 3
        }
      )

      // Cause failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.opened).toBe(true)

      // Wait for reset timeout
      await delay(600)

      // Now allow success
      shouldFail = false

      // Make successful requests
      const result = await breaker.fire()
      expect(result).toBe('success')

      // Circuit should eventually close
      expect(breaker.opened).toBe(false)
    })
  })

  describe('Fallback Execution', () => {
    it('should execute fallback when circuit is open', async () => {
      const failingFunction = async () => {
        throw new Error('Always fails')
      }

      const fallbackFunction = async () => {
        return 'fallback-data'
      }

      const breaker = createCircuitBreaker(
        failingFunction,
        {
          name: 'test-fallback-circuit',
          timeout: 1000,
          errorThresholdPercentage: 50,
          resetTimeout: 5000,
          volumeThreshold: 3
        },
        fallbackFunction
      )

      // Cause failures to open circuit
      for (let i = 0; i < 5; i++) {
        await breaker.fire()
      }

      // Circuit should be open, fallback should be used
      expect(breaker.opened).toBe(true)
      const result = await breaker.fire()
      expect(result).toBe('fallback-data')
    })

    it('should not execute fallback when circuit is closed', async () => {
      const successFunction = async () => {
        return 'primary-data'
      }

      const fallbackFunction = async () => {
        return 'fallback-data'
      }

      const breaker = createCircuitBreaker(
        successFunction,
        {
          name: 'test-no-fallback-circuit',
          timeout: 1000
        },
        fallbackFunction
      )

      const result = await breaker.fire()
      expect(result).toBe('primary-data')
    })
  })

  describe('Timeout Behavior', () => {
    it('should timeout long-running requests', async () => {
      const slowFunction = async () => {
        await delay(2000) // 2 second delay
        return 'completed'
      }

      const breaker = createCircuitBreaker(
        slowFunction,
        {
          name: 'test-timeout-circuit',
          timeout: 500, // 500ms timeout
          errorThresholdPercentage: 50,
          volumeThreshold: 3
        }
      )

      // Should timeout
      await expect(breaker.fire()).rejects.toThrow()
    })

    it('should succeed for requests within timeout', async () => {
      const fastFunction = async () => {
        await delay(100) // 100ms delay
        return 'completed'
      }

      const breaker = createCircuitBreaker(
        fastFunction,
        {
          name: 'test-fast-circuit',
          timeout: 500 // 500ms timeout
        }
      )

      const result = await breaker.fire()
      expect(result).toBe('completed')
    })
  })

  describe('Circuit Breaker Statistics', () => {
    it('should track success and failure counts', async () => {
      let shouldFail = false
      const testFunction = async () => {
        if (shouldFail) {
          throw new Error('Test failure')
        }
        return 'success'
      }

      const breaker = createCircuitBreaker(
        testFunction,
        {
          name: 'test-stats-circuit',
          timeout: 1000
        }
      )

      // Successful calls
      await breaker.fire()
      await breaker.fire()

      // Failed calls
      shouldFail = true
      try {
        await breaker.fire()
      } catch (error) {
        // Expected
      }

      const stats = breaker.stats
      expect(stats.successes).toBe(2)
      expect(stats.failures).toBe(1)
    })
  })

  describe('Circuit Breaker Registry', () => {
    it('should register circuit breakers globally', () => {
      const breaker = createCircuitBreaker(
        async () => 'test',
        {
          name: 'test-registry-circuit'
        }
      )

      const registered = circuitBreakerRegistry.get('test-registry-circuit')
      expect(registered).toBeDefined()
      expect(registered).toBe(breaker)
    })

    it('should provide circuit states for all breakers', () => {
      createCircuitBreaker(
        async () => 'test',
        {
          name: 'test-state-circuit-1'
        }
      )

      createCircuitBreaker(
        async () => 'test',
        {
          name: 'test-state-circuit-2'
        }
      )

      const states = circuitBreakerRegistry.getCircuitStates()
      expect(states['test-state-circuit-1']).toBeDefined()
      expect(states['test-state-circuit-2']).toBeDefined()
      expect(states['test-state-circuit-1'].state).toBe('closed')
    })

    it('should provide health summary', async () => {
      // Create a healthy circuit
      createCircuitBreaker(
        async () => 'test',
        {
          name: 'test-health-circuit-healthy'
        }
      )

      const health = getCircuitBreakerHealth()
      expect(health.healthy).toBeDefined()
      expect(health.totalCircuits).toBeGreaterThan(0)
      expect(Array.isArray(health.openCircuits)).toBe(true)
    })
  })

  describe('Multiple Circuit Breakers', () => {
    it('should handle multiple independent circuit breakers', async () => {
      const breaker1 = createCircuitBreaker(
        async () => 'breaker1-success',
        {
          name: 'test-multi-circuit-1',
          timeout: 1000
        }
      )

      const breaker2 = createCircuitBreaker(
        async () => {
          throw new Error('breaker2-failure')
        },
        {
          name: 'test-multi-circuit-2',
          timeout: 1000,
          volumeThreshold: 2
        }
      )

      // Breaker 1 should succeed
      const result1 = await breaker1.fire()
      expect(result1).toBe('breaker1-success')
      expect(breaker1.opened).toBe(false)

      // Breaker 2 should fail and eventually open
      for (let i = 0; i < 5; i++) {
        try {
          await breaker2.fire()
        } catch (error) {
          // Expected
        }
      }
      expect(breaker2.opened).toBe(true)

      // Breaker 1 should still be closed
      expect(breaker1.opened).toBe(false)
    })
  })

  describe('Circuit Breaker with Arguments', () => {
    it('should pass arguments correctly through circuit breaker', async () => {
      const addFunction = async (a: number, b: number) => {
        return a + b
      }

      const breaker = createCircuitBreaker(
        addFunction,
        {
          name: 'test-args-circuit',
          timeout: 1000
        }
      )

      const result = await breaker.fire(5, 3)
      expect(result).toBe(8)
    })

    it('should pass arguments to fallback function', async () => {
      const failingFunction = async (value: string) => {
        throw new Error('Always fails')
      }

      const fallbackFunction = async (value: string) => {
        return `fallback-${value}`
      }

      const breaker = createCircuitBreaker(
        failingFunction,
        {
          name: 'test-args-fallback-circuit',
          timeout: 1000,
          errorThresholdPercentage: 50,
          volumeThreshold: 2
        },
        fallbackFunction
      )

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await breaker.fire('test')
      }

      expect(breaker.opened).toBe(true)
      const result = await breaker.fire('data')
      expect(result).toBe('fallback-data')
    })
  })

  describe('Circuit Breaker Event Logging', () => {
    it('should emit events for circuit state changes', (done) => {
      const failingFunction = async () => {
        throw new Error('Test failure')
      }

      const breaker = createCircuitBreaker(
        failingFunction,
        {
          name: 'test-events-circuit',
          timeout: 1000,
          errorThresholdPercentage: 50,
          volumeThreshold: 2
        }
      )

      let openEventFired = false

      breaker.on('open', () => {
        openEventFired = true
      })

      // Generate failures
      Promise.all([
        breaker.fire().catch(() => {}),
        breaker.fire().catch(() => {}),
        breaker.fire().catch(() => {}),
        breaker.fire().catch(() => {}),
        breaker.fire().catch(() => {})
      ]).then(() => {
        expect(openEventFired).toBe(true)
        done()
      })
    })
  })
})

describe('Circuit Breaker Status Endpoint', () => {
  it('should return status for all circuit breakers', async () => {
    // Create a test circuit breaker
    createCircuitBreaker(
      async () => 'test',
      {
        name: 'test-endpoint-circuit'
      }
    )

    const states = circuitBreakerRegistry.getCircuitStates()
    expect(states).toBeDefined()
    expect(typeof states).toBe('object')

    // Check that our test circuit is in the states
    expect(states['test-endpoint-circuit']).toBeDefined()
    expect(states['test-endpoint-circuit'].state).toBe('closed')
  })
})
