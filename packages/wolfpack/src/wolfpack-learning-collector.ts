/**
 * Wolfpack Learning Event Collector
 *
 * Fire-and-forget recording of routing outcomes during normal operations.
 * Uses synchronous .run() to never block callers.
 */

import { db, schema } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { randomUUID } from 'crypto'

interface RouteEventParams {
  chassisId?: string | null
  inputNum: number
  outputNum: number
  durationMs: number
  protocol?: string
  inputLabel?: string
  outputLabel?: string
  retryCount?: number
  wasRetrySuccessful?: boolean
  metadata?: Record<string, unknown>
}

interface ErrorEventParams {
  chassisId?: string | null
  errorMessage: string
  protocol?: string
  inputNum?: number
  outputNum?: number
  metadata?: Record<string, unknown>
}

function getTimeFields() {
  const now = new Date()
  return {
    dayOfWeek: now.getDay(),  // 0-6
    hourOfDay: now.getHours() // 0-23
  }
}

/**
 * Record a successful route operation.
 * Fire-and-forget — never throws or blocks.
 */
export function recordRouteSuccess(params: RouteEventParams): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()
    const isLatencySpike = params.durationMs > 2000

    db.insert(schema.wolfpackLearningEvents)
      .values({
        id: randomUUID(),
        eventType: isLatencySpike ? 'latency_spike' : 'route_success',
        chassisId: params.chassisId || null,
        inputNum: params.inputNum,
        outputNum: params.outputNum,
        inputLabel: params.inputLabel || null,
        outputLabel: params.outputLabel || null,
        success: true,
        durationMs: params.durationMs,
        dayOfWeek,
        hourOfDay,
        protocol: params.protocol || null,
        retryCount: params.retryCount || 0,
        wasRetrySuccessful: params.wasRetrySuccessful ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      })
      .run()
  } catch (err) {
    logger.debug('[WOLFPACK-LEARNING] Failed to record route success:', err)
  }
}

/**
 * Record a failed route operation.
 * Fire-and-forget — never throws or blocks.
 */
export function recordRouteFailure(params: RouteEventParams & { errorMessage: string }): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()

    db.insert(schema.wolfpackLearningEvents)
      .values({
        id: randomUUID(),
        eventType: 'route_failure',
        chassisId: params.chassisId || null,
        inputNum: params.inputNum,
        outputNum: params.outputNum,
        inputLabel: params.inputLabel || null,
        outputLabel: params.outputLabel || null,
        success: false,
        durationMs: params.durationMs,
        errorMessage: params.errorMessage,
        dayOfWeek,
        hourOfDay,
        protocol: params.protocol || null,
        retryCount: params.retryCount || 0,
        wasRetrySuccessful: params.wasRetrySuccessful ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      })
      .run()
  } catch (err) {
    logger.debug('[WOLFPACK-LEARNING] Failed to record route failure:', err)
  }
}

/**
 * Record a connection-level error (timeout, refused, etc).
 * Fire-and-forget — never throws or blocks.
 */
export function recordConnectionError(params: ErrorEventParams): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()
    const isTimeout = /timeout/i.test(params.errorMessage)

    db.insert(schema.wolfpackLearningEvents)
      .values({
        id: randomUUID(),
        eventType: isTimeout ? 'connection_timeout' : 'connection_error',
        chassisId: params.chassisId || null,
        inputNum: params.inputNum ?? null,
        outputNum: params.outputNum ?? null,
        success: false,
        errorMessage: params.errorMessage,
        dayOfWeek,
        hourOfDay,
        protocol: params.protocol || null,
        retryCount: 0,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      })
      .run()
  } catch (err) {
    logger.debug('[WOLFPACK-LEARNING] Failed to record connection error:', err)
  }
}
