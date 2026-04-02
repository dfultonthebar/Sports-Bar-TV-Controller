/**
 * Atlas Learning Event Collector
 *
 * Fire-and-forget recording of audio gain adjustments, clipping events,
 * zone changes, and connection state changes during normal operations.
 * Uses synchronous .run() to never block callers — critical for the 500ms gain loop.
 */

import { db, schema } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { randomUUID } from 'crypto'

// ============================================================================
// Helpers
// ============================================================================

function getTimeFields() {
  const now = new Date()
  return {
    dayOfWeek: now.getDay(),   // 0-6
    hourOfDay: now.getHours(), // 0-23
  }
}

// ============================================================================
// 1. Record Gain Adjustment (successful)
// ============================================================================

interface GainAdjustmentParams {
  processorId: string
  inputNumber: number
  previousGain: number
  newGain: number
  currentLevel: number
  targetLevel: number
  adjustmentMode: 'fast' | 'slow'
  durationMs?: number
}

/**
 * Record a successful gain adjustment.
 * Automatically computes movedTowardTarget.
 * Fire-and-forget — never throws or blocks.
 */
export function recordGainAdjustment(params: GainAdjustmentParams): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()
    const distanceBefore = Math.abs(params.targetLevel - params.currentLevel)
    // Estimate level after adjustment: currentLevel + (newGain - previousGain)
    const estimatedNewLevel = params.currentLevel + (params.newGain - params.previousGain)
    const distanceAfter = Math.abs(params.targetLevel - estimatedNewLevel)
    const movedTowardTarget = distanceAfter < distanceBefore

    db.insert(schema.atlasLearningEvents)
      .values({
        id: randomUUID(),
        eventType: 'gain_adjustment',
        processorId: params.processorId,
        inputNumber: params.inputNumber,
        success: true,
        previousGain: params.previousGain,
        newGain: params.newGain,
        currentLevel: params.currentLevel,
        targetLevel: params.targetLevel,
        adjustmentMode: params.adjustmentMode,
        movedTowardTarget,
        durationMs: params.durationMs ?? null,
        dayOfWeek,
        hourOfDay,
      })
      .run()
  } catch (err) {
    logger.debug('[ATLAS-LEARNING] Failed to record gain adjustment:', err)
  }
}

// ============================================================================
// 2. Record Gain Adjustment Failure
// ============================================================================

interface GainAdjustmentFailureParams {
  processorId: string
  inputNumber: number
  previousGain: number
  newGain: number
  errorMessage: string
}

/**
 * Record a failed gain adjustment.
 * Fire-and-forget — never throws or blocks.
 */
export function recordGainAdjustmentFailure(params: GainAdjustmentFailureParams): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()

    db.insert(schema.atlasLearningEvents)
      .values({
        id: randomUUID(),
        eventType: 'gain_adjustment_failed',
        processorId: params.processorId,
        inputNumber: params.inputNumber,
        success: false,
        previousGain: params.previousGain,
        newGain: params.newGain,
        errorMessage: params.errorMessage,
        dayOfWeek,
        hourOfDay,
      })
      .run()
  } catch (err) {
    logger.debug('[ATLAS-LEARNING] Failed to record gain adjustment failure:', err)
  }
}

// ============================================================================
// 3. Record Clipping Event
// ============================================================================

interface ClippingEventParams {
  processorId: string
  inputNumber: number
  level: number
  peak: number
}

/**
 * Record a clipping detection event.
 * Fire-and-forget — never throws or blocks.
 */
export function recordClippingEvent(params: ClippingEventParams): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()

    db.insert(schema.atlasLearningEvents)
      .values({
        id: randomUUID(),
        eventType: 'clipping_detected',
        processorId: params.processorId,
        inputNumber: params.inputNumber,
        success: true, // event recorded successfully, not "success" of audio
        currentLevel: params.level,
        metadata: JSON.stringify({ peak: params.peak }),
        dayOfWeek,
        hourOfDay,
      })
      .run()
  } catch (err) {
    logger.debug('[ATLAS-LEARNING] Failed to record clipping event:', err)
  }
}

// ============================================================================
// 4. Record Zone Change
// ============================================================================

interface ZoneChangeParams {
  processorId: string
  zoneNumber: number
  changeType: 'volume' | 'mute' | 'source'
  previousVolume?: number
  newVolume?: number
  muted?: boolean
  sourceValue?: string | number
}

/**
 * Record a zone control change (volume, mute, or source).
 * Fire-and-forget — never throws or blocks.
 */
export function recordZoneChange(params: ZoneChangeParams): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()
    const eventTypeMap = {
      volume: 'zone_volume_change',
      mute: 'zone_mute_toggle',
      source: 'zone_source_change',
    } as const

    db.insert(schema.atlasLearningEvents)
      .values({
        id: randomUUID(),
        eventType: eventTypeMap[params.changeType],
        processorId: params.processorId,
        zoneNumber: params.zoneNumber,
        success: true,
        previousVolume: params.previousVolume ?? null,
        newVolume: params.newVolume ?? null,
        muted: params.muted ?? null,
        metadata: params.sourceValue != null ? JSON.stringify({ source: params.sourceValue }) : null,
        dayOfWeek,
        hourOfDay,
      })
      .run()
  } catch (err) {
    logger.debug('[ATLAS-LEARNING] Failed to record zone change:', err)
  }
}

// ============================================================================
// 5. Record Connection Change
// ============================================================================

interface ConnectionChangeParams {
  processorId: string
  online: boolean
  errorMessage?: string
}

/**
 * Record a processor connection state change (online/offline).
 * Fire-and-forget — never throws or blocks.
 */
export function recordConnectionChange(params: ConnectionChangeParams): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()

    db.insert(schema.atlasLearningEvents)
      .values({
        id: randomUUID(),
        eventType: params.online ? 'connection_online' : 'connection_offline',
        processorId: params.processorId,
        success: params.online,
        errorMessage: params.errorMessage ?? null,
        dayOfWeek,
        hourOfDay,
      })
      .run()
  } catch (err) {
    logger.debug('[ATLAS-LEARNING] Failed to record connection change:', err)
  }
}

// ============================================================================
// 6. Record Signal Snapshot
// ============================================================================

interface SignalSnapshotParams {
  processorId: string
  signalLevels: Record<number, number>  // inputNumber -> level
  clippingInputs: number[]              // input numbers currently clipping
}

/**
 * Record a periodic signal snapshot (all input levels + clipping state).
 * Fire-and-forget — never throws or blocks.
 */
export function recordSignalSnapshot(params: SignalSnapshotParams): void {
  try {
    const { dayOfWeek, hourOfDay } = getTimeFields()

    db.insert(schema.atlasLearningEvents)
      .values({
        id: randomUUID(),
        eventType: 'signal_snapshot',
        processorId: params.processorId,
        success: true,
        signalLevels: JSON.stringify(params.signalLevels),
        clippingInputs: JSON.stringify(params.clippingInputs),
        dayOfWeek,
        hourOfDay,
      })
      .run()
  } catch (err) {
    logger.debug('[ATLAS-LEARNING] Failed to record signal snapshot:', err)
  }
}
