/**
 * Circuit Breaker Status Monitoring Endpoint
 *
 * Provides real-time information about all circuit breakers in the system:
 * - Current state (open/closed/half-open)
 * - Failure statistics
 * - Performance metrics
 * - Next retry time (for open circuits)
 *
 * GET /api/circuit-breaker/status
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server'
import { circuitBreakerRegistry, getCircuitBreakerHealth } from '@/lib/circuit-breaker'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * GET /api/circuit-breaker/status
 *
 * Returns comprehensive status information for all circuit breakers
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const requestStart = Date.now()

  try {
    // Log monitoring request
    await enhancedLogger.info(
      'api',
      'circuit-breaker-status',
      'status_check',
      'Circuit breaker status requested'
    )

    // Get all circuit states
    const states = circuitBreakerRegistry.getCircuitStates()
    const health = getCircuitBreakerHealth()

    // Build response
    const response = {
      timestamp: new Date().toISOString(),
      healthy: health.healthy,
      summary: health.summary,
      totalCircuits: health.totalCircuits,
      openCircuits: health.openCircuits,
      circuitBreakers: states,
      requestDurationMs: Date.now() - requestStart
    }

    // Log if any circuits are open
    if (!health.healthy) {
      await enhancedLogger.warn(
        'api',
        'circuit-breaker-status',
        'unhealthy_circuits',
        `Some circuits are open: ${health.openCircuits.join(', ')}`,
        { openCircuits: health.openCircuits }
      )
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    const requestDuration = Date.now() - requestStart

    await enhancedLogger.error(
      'api',
      'circuit-breaker-status',
      'status_check_failed',
      'Failed to retrieve circuit breaker status',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: requestDuration
      },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve circuit breaker status',
        timestamp: new Date().toISOString(),
        durationMs: requestDuration
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/circuit-breaker/status
 *
 * Alternative method for getting status (useful for clients that prefer POST)
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  return GET(request)
}
