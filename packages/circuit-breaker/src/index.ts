/**
 * Circuit Breaker Utility Module
 *
 * Provides reusable circuit breaker functionality for external API calls
 * to prevent cascading failures and resource exhaustion.
 *
 * Key Features:
 * - Automatic failure detection and circuit opening
 * - Configurable thresholds and timeouts
 * - Fallback support for graceful degradation
 * - Comprehensive event logging
 * - Circuit state monitoring
 * - TypeScript type safety
 *
 * @module circuit-breaker
 * @version 1.0.0
 */

import CircuitBreaker from 'opossum'
import { logger } from '@sports-bar/logger'

/**
 * Configuration options for circuit breaker creation
 */
export interface CircuitBreakerOptions {
  /**
   * Name identifier for this circuit breaker (used in logging)
   */
  name: string

  /**
   * Request timeout in milliseconds
   * @default 10000 (10 seconds)
   */
  timeout?: number

  /**
   * Percentage of failed requests that triggers circuit open
   * @default 50 (50% failure rate)
   */
  errorThresholdPercentage?: number

  /**
   * Time in milliseconds before attempting to close an open circuit
   * @default 30000 (30 seconds)
   */
  resetTimeout?: number

  /**
   * Time window for counting failures in milliseconds
   * @default 60000 (60 seconds)
   */
  rollingCountTimeout?: number

  /**
   * Minimum number of requests before circuit can open
   * @default 10
   */
  volumeThreshold?: number

  /**
   * Enable detailed logging for debugging
   * @default false
   */
  enableDebugLogging?: boolean
}

/**
 * Statistics for a circuit breaker instance
 */
export interface CircuitBreakerStats {
  failures: number
  successes: number
  rejects: number
  timeouts: number
  fires: number
  fallbacks: number
  cacheHits: number
  cacheMisses: number
  latencyMean: number
  percentiles: {
    '0.0': number
    '0.25': number
    '0.5': number
    '0.75': number
    '0.9': number
    '0.95': number
    '0.99': number
    '0.995': number
    '1.0': number
  }
}

/**
 * Circuit breaker registry for tracking all instances
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker<any[], any>> = new Map()

  register(name: string, breaker: CircuitBreaker<any[], any>): void {
    this.breakers.set(name, breaker)
  }

  get(name: string): CircuitBreaker<any[], any> | undefined {
    return this.breakers.get(name)
  }

  getAll(): Map<string, CircuitBreaker<any[], any>> {
    return this.breakers
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {}
    this.breakers.forEach((breaker, name) => {
      const breakerStats = breaker.stats
      stats[name] = {
        failures: breakerStats.failures,
        successes: breakerStats.successes,
        rejects: breakerStats.rejects,
        timeouts: breakerStats.timeouts,
        fires: breakerStats.fires,
        fallbacks: breakerStats.fallbacks,
        cacheHits: breakerStats.cacheHits,
        cacheMisses: breakerStats.cacheMisses,
        latencyMean: breakerStats.latencyMean,
        percentiles: breakerStats.percentiles as any
      }
    })
    return stats
  }

  getCircuitStates(): Record<string, { state: string; stats: CircuitBreakerStats; opened?: string; nextAttempt?: string }> {
    const states: Record<string, any> = {}
    this.breakers.forEach((breaker, name) => {
      const state = breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed'
      const breakerStats = breaker.stats

      states[name] = {
        state,
        stats: {
          failures: breakerStats.failures,
          successes: breakerStats.successes,
          rejects: breakerStats.rejects,
          timeouts: breakerStats.timeouts,
          fires: breakerStats.fires,
          fallbacks: breakerStats.fallbacks,
          cacheHits: breakerStats.cacheHits,
          cacheMisses: breakerStats.cacheMisses,
          latencyMean: breakerStats.latencyMean,
          percentiles: breakerStats.percentiles as any
        }
      }

      if (breaker.opened) {
        states[name].opened = new Date().toISOString()
        // Calculate next retry time
        const resetTimeout = (breaker as any).options.resetTimeout || 30000
        states[name].nextAttempt = new Date(Date.now() + resetTimeout).toISOString()
      }
    })
    return states
  }
}

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry()

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<CircuitBreakerOptions, 'name'>> = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50, // Open after 50% failures
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 60000, // 60 second failure window
  volumeThreshold: 10, // Need at least 10 requests before circuit can open
  enableDebugLogging: false
}

/**
 * Create a circuit breaker for an async function
 *
 * @template T - Return type of the wrapped function
 * @param asyncFunction - The async function to wrap with circuit breaker
 * @param options - Circuit breaker configuration options
 * @param fallback - Optional fallback function called when circuit is open
 * @returns Configured circuit breaker instance
 *
 * @example
 * ```typescript
 * const breaker = createCircuitBreaker(
 *   async (url: string) => fetch(url),
 *   { name: 'external-api' },
 *   async () => ({ cached: true, data: [] })
 * )
 *
 * const result = await breaker.fire('https://api.example.com/data')
 * ```
 */
export function createCircuitBreaker<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: CircuitBreakerOptions,
  fallback?: (...args: any[]) => Promise<T>
): CircuitBreaker<any[], T> {
  const config = { ...DEFAULT_CONFIG, ...options }

  // Log circuit breaker creation
  logger.info(`[CIRCUIT-BREAKER] Creating circuit breaker: ${config.name}`, {
    data: {
      timeout: config.timeout,
      errorThresholdPercentage: config.errorThresholdPercentage,
      resetTimeout: config.resetTimeout,
      rollingCountTimeout: config.rollingCountTimeout,
      volumeThreshold: config.volumeThreshold,
      hasFallback: !!fallback
    }
  })

  // Create circuit breaker instance
  const breaker = new CircuitBreaker(asyncFunction, {
    timeout: config.timeout,
    errorThresholdPercentage: config.errorThresholdPercentage,
    resetTimeout: config.resetTimeout,
    rollingCountTimeout: config.rollingCountTimeout,
    volumeThreshold: config.volumeThreshold,
    name: config.name
  })

  // Register fallback if provided
  if (fallback) {
    breaker.fallback(fallback)
  }

  // Wire up event logging
  setupCircuitBreakerLogging(breaker, config.name, config.enableDebugLogging)

  // Register in global registry
  circuitBreakerRegistry.register(config.name, breaker)

  return breaker
}

/**
 * Setup comprehensive event logging for a circuit breaker
 */
function setupCircuitBreakerLogging(
  breaker: CircuitBreaker<any[], any>,
  name: string,
  enableDebug: boolean
): void {
  // Circuit opened - CRITICAL event
  breaker.on('open', () => {
    logger.error(`[CIRCUIT-BREAKER] Circuit breaker opened: ${name}`, {
      data: { circuitBreaker: name, reason: 'Error threshold exceeded', stats: breaker.stats }
    })
  })

  // Circuit half-open - attempting to recover
  breaker.on('halfOpen', () => {
    logger.info(`[CIRCUIT-BREAKER] Circuit breaker attempting recovery: ${name}`, {
      data: { circuitBreaker: name, stats: breaker.stats }
    })
  })

  // Circuit closed - recovered successfully
  breaker.on('close', () => {
    logger.info(`[CIRCUIT-BREAKER] Circuit breaker closed: ${name}`, {
      data: { circuitBreaker: name, status: 'Recovered', stats: breaker.stats }
    })
  })

  // Fallback executed
  breaker.on('fallback', (result) => {
    logger.warn(`[CIRCUIT-BREAKER] Fallback executed for circuit: ${name}`, {
      data: { circuitBreaker: name, fallbackResult: typeof result, stats: breaker.stats }
    })
  })

  // Request rejected (circuit is open)
  breaker.on('reject', () => {
    logger.warn(`[CIRCUIT-BREAKER] Request rejected by circuit breaker: ${name}`, {
      data: { circuitBreaker: name, reason: 'Circuit is open', stats: breaker.stats }
    })
  })

  // Request timeout
  breaker.on('timeout', () => {
    logger.error(`[CIRCUIT-BREAKER] Request timeout in circuit: ${name}`, {
      data: { circuitBreaker: name, timeout: (breaker as any).options?.timeout, stats: breaker.stats }
    })
  })

  // Request failure
  breaker.on('failure', (error) => {
    logger.error(`[CIRCUIT-BREAKER] Request failed in circuit: ${name}`, {
      data: { circuitBreaker: name, error: error.message, errorType: error.name, stats: breaker.stats }
    })
  })

  // Request success (only log in debug mode to avoid log spam)
  if (enableDebug) {
    breaker.on('success', (result) => {
      logger.debug(`[CIRCUIT-BREAKER] Request succeeded in circuit: ${name}`, {
        data: { circuitBreaker: name, resultType: typeof result, stats: breaker.stats }
      })
    })
  }

  // Request fired (only log in debug mode)
  if (enableDebug) {
    breaker.on('fire', () => {
      logger.debug(`[CIRCUIT-BREAKER] Request fired through circuit: ${name}`, {
        data: { circuitBreaker: name, state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed' }
      })
    })
  }

  // Cache hit (if cache is enabled)
  breaker.on('cacheHit', () => {
    if (enableDebug) {
      logger.debug(`[CIRCUIT-BREAKER] Cache hit in circuit: ${name}`, {
        data: { circuitBreaker: name }
      })
    }
  })

  // Cache miss (if cache is enabled)
  breaker.on('cacheMiss', () => {
    if (enableDebug) {
      logger.debug(`[CIRCUIT-BREAKER] Cache miss in circuit: ${name}`, {
        data: { circuitBreaker: name }
      })
    }
  })
}

/**
 * Helper function to create a circuit breaker with sensible defaults for external APIs
 */
export function createAPICircuitBreaker<T>(
  name: string,
  asyncFunction: (...args: any[]) => Promise<T>,
  fallback?: (...args: any[]) => Promise<T>
): CircuitBreaker<any[], T> {
  return createCircuitBreaker(asyncFunction, { name }, fallback)
}

/**
 * Helper function to create a circuit breaker with custom timeout
 */
export function createCircuitBreakerWithTimeout<T>(
  name: string,
  asyncFunction: (...args: any[]) => Promise<T>,
  timeout: number,
  fallback?: (...args: any[]) => Promise<T>
): CircuitBreaker<any[], T> {
  return createCircuitBreaker(asyncFunction, { name, timeout }, fallback)
}

/**
 * Get circuit breaker health summary
 */
export function getCircuitBreakerHealth(): {
  healthy: boolean
  openCircuits: string[]
  totalCircuits: number
  summary: string
} {
  const states = circuitBreakerRegistry.getCircuitStates()
  const openCircuits = Object.entries(states)
    .filter(([_, state]) => state.state === 'open')
    .map(([name]) => name)

  const totalCircuits = Object.keys(states).length
  const healthy = openCircuits.length === 0

  return {
    healthy,
    openCircuits,
    totalCircuits,
    summary: healthy
      ? `All ${totalCircuits} circuits healthy`
      : `${openCircuits.length} of ${totalCircuits} circuits open: ${openCircuits.join(', ')}`
  }
}

/**
 * Export types for external use
 */
export type { default as CircuitBreaker } from 'opossum'
