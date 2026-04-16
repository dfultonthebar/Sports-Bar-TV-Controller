/**
 * Atlas Pattern Learner
 *
 * Periodically analyzes atlasLearningEvents to discover audio-specific
 * patterns: input health, gain effectiveness, time-based clipping,
 * zone usage, processor reliability, and adjustment efficiency.
 */

import { db, schema, sql, lte } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

// ============================================================================
// Types
// ============================================================================

export interface AtlasLearnedPattern {
  id: string
  category: 'input_health' | 'gain_effectiveness' | 'time_pattern' | 'zone_usage' | 'reliability' | 'efficiency'
  title: string
  description: string
  confidence: number        // 0-100
  evidence: {
    sampleSize: number
    timeRangeStart: string
    timeRangeEnd: string
  }
  recommendations: string[]
  severity: 'info' | 'warning' | 'error' | 'critical'
  processorId?: string | null
  learnedAt: string
}

export interface AtlasLearningCycleResult {
  patterns: AtlasLearnedPattern[]
  eventsAnalyzed: number
  cycleTimestamp: string
  durationMs: number
}

// ============================================================================
// In-memory cache
// ============================================================================

let learnedPatternsCache: AtlasLearnedPattern[] = []
let lastRunTimestamp: string | null = null

export function getAtlasLearnedPatterns(): AtlasLearnedPattern[] {
  return learnedPatternsCache
}

export function getAtlasLastRunTimestamp(): string | null {
  return lastRunTimestamp
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Run a full learning cycle: analyze 30 days of events, discover patterns,
 * update in-memory cache.
 */
export async function runAtlasLearningCycle(): Promise<AtlasLearningCycleResult> {
  const cycleStart = Date.now()
  logger.info('[ATLAS-LEARNING] Starting learning cycle...')

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Count total events in window
    const countResult = db.select({ count: sql<number>`count(*)` })
      .from(schema.atlasLearningEvents)
      .where(sql`${schema.atlasLearningEvents.createdAt} >= ${thirtyDaysAgo}`)
      .get()

    const totalEvents = countResult?.count || 0

    if (totalEvents < 5) {
      logger.info(`[ATLAS-LEARNING] Only ${totalEvents} events in last 30 days — skipping analysis (need >= 5)`)
      lastRunTimestamp = now
      return {
        patterns: [],
        eventsAnalyzed: totalEvents,
        cycleTimestamp: now,
        durationMs: Date.now() - cycleStart,
      }
    }

    // Run all 6 analysis functions
    const patterns: AtlasLearnedPattern[] = []

    patterns.push(...analyzeInputHealth(thirtyDaysAgo, now))
    patterns.push(...analyzeGainEffectiveness(thirtyDaysAgo, now))
    patterns.push(...analyzeTimePatterns(thirtyDaysAgo, now))
    patterns.push(...analyzeZoneUsage(thirtyDaysAgo, now))
    patterns.push(...analyzeProcessorReliability(thirtyDaysAgo, now))
    patterns.push(...analyzeAdjustmentEfficiency(thirtyDaysAgo, now))

    // Update cache
    learnedPatternsCache = patterns
    lastRunTimestamp = now

    // Cleanup old events (>90 days)
    cleanupOldEvents()

    const durationMs = Date.now() - cycleStart
    logger.info(`[ATLAS-LEARNING] Cycle complete: ${patterns.length} patterns from ${totalEvents} events in ${durationMs}ms`)

    return {
      patterns,
      eventsAnalyzed: totalEvents,
      cycleTimestamp: now,
      durationMs,
    }
  } catch (error) {
    logger.error('[ATLAS-LEARNING] Learning cycle failed:', error)
    lastRunTimestamp = new Date().toISOString()
    return {
      patterns: [],
      eventsAnalyzed: 0,
      cycleTimestamp: lastRunTimestamp,
      durationMs: Date.now() - cycleStart,
    }
  }
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * 1. Input Health — group clipping_detected by inputNumber, flag chronic clippers (>10 events)
 */
function analyzeInputHealth(since: string, until: string): AtlasLearnedPattern[] {
  const patterns: AtlasLearnedPattern[] = []

  const rows = db.all<{ inputNumber: number; processorId: string; total: number }>(
    sql`SELECT inputNumber, processorId, COUNT(*) as total
        FROM AtlasLearningEvent
        WHERE createdAt >= ${since} AND eventType = 'clipping_detected' AND inputNumber IS NOT NULL
        GROUP BY inputNumber, processorId
        HAVING total >= 3`
  )

  for (const row of rows) {
    if (row.total >= 10) {
      patterns.push({
        id: `input-health-${row.processorId}-${row.inputNumber}`,
        category: 'input_health',
        title: `Input ${row.inputNumber} Chronic Clipping`,
        description: `Input ${row.inputNumber} clipped ${row.total} times in the last 30 days. This input may need gain reduction or a pad.`,
        confidence: Math.min(95, 50 + row.total),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          `Reduce gain on input ${row.inputNumber} by 3-6 dB`,
          'Check if the source device output level is too high',
          'Consider adding a hardware pad or attenuator',
        ],
        severity: row.total >= 50 ? 'error' : 'warning',
        processorId: row.processorId,
        learnedAt: new Date().toISOString(),
      })
    } else {
      patterns.push({
        id: `input-health-${row.processorId}-${row.inputNumber}`,
        category: 'input_health',
        title: `Input ${row.inputNumber} Occasional Clipping`,
        description: `Input ${row.inputNumber} clipped ${row.total} times in the last 30 days.`,
        confidence: Math.min(80, 40 + row.total * 3),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          `Monitor input ${row.inputNumber} during peak hours`,
        ],
        severity: 'info',
        processorId: row.processorId,
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

/**
 * 2. Gain Effectiveness — group gain_adjustment by inputNumber, compute movedTowardTarget ratio,
 *    flag inputs where AI "fights" (>30% moving away)
 */
function analyzeGainEffectiveness(since: string, until: string): AtlasLearnedPattern[] {
  const patterns: AtlasLearnedPattern[] = []

  const rows = db.all<{ inputNumber: number; processorId: string; total: number; towardTarget: number }>(
    sql`SELECT inputNumber, processorId, COUNT(*) as total,
            SUM(CASE WHEN movedTowardTarget = 1 THEN 1 ELSE 0 END) as towardTarget
        FROM AtlasLearningEvent
        WHERE createdAt >= ${since} AND eventType = 'gain_adjustment' AND inputNumber IS NOT NULL
        GROUP BY inputNumber, processorId
        HAVING total >= 10`
  )

  for (const row of rows) {
    const towardRatio = row.towardTarget / row.total
    const awayRatio = 1 - towardRatio

    if (awayRatio > 0.3) {
      const pct = (awayRatio * 100).toFixed(0)
      patterns.push({
        id: `gain-effectiveness-${row.processorId}-${row.inputNumber}`,
        category: 'gain_effectiveness',
        title: `Input ${row.inputNumber} AI Gain Fighting`,
        description: `Input ${row.inputNumber} moves away from target ${pct}% of the time (${row.total - row.towardTarget}/${row.total} adjustments). The AI gain system may be oscillating.`,
        confidence: Math.min(90, 50 + row.total),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          `Review target level for input ${row.inputNumber} — it may be unreachable`,
          'Consider increasing the tolerance threshold',
          'Check if the source signal is highly dynamic (e.g., live sports)',
        ],
        severity: awayRatio > 0.5 ? 'warning' : 'info',
        processorId: row.processorId,
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

/**
 * 3. Time Patterns — group clipping/gain events by dayOfWeek+hourOfDay, find elevated clipping windows
 */
function analyzeTimePatterns(since: string, until: string): AtlasLearnedPattern[] {
  const patterns: AtlasLearnedPattern[] = []

  const rows = db.all<{ dayOfWeek: number; hourOfDay: number; total: number }>(
    sql`SELECT dayOfWeek, hourOfDay, COUNT(*) as total
        FROM AtlasLearningEvent
        WHERE createdAt >= ${since} AND eventType = 'clipping_detected'
        GROUP BY dayOfWeek, hourOfDay
        HAVING total >= 3`
  )

  if (rows.length < 2) return patterns

  // Average clipping rate across all time slots
  const totalAll = rows.reduce((s, r) => s + r.total, 0)
  const avgPerSlot = totalAll / rows.length

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  for (const row of rows) {
    if (row.total > avgPerSlot * 2 && row.total >= 5) {
      const hour = row.hourOfDay
      const timeStr = `${hour % 12 || 12}${hour < 12 ? 'AM' : 'PM'}`
      patterns.push({
        id: `time-clipping-${row.dayOfWeek}-${row.hourOfDay}`,
        category: 'time_pattern',
        title: `Peak Clipping: ${dayNames[row.dayOfWeek]} ${timeStr}`,
        description: `${row.total} clipping events on ${dayNames[row.dayOfWeek]}s at ${timeStr} (avg: ${avgPerSlot.toFixed(1)} per slot). This likely coincides with peak bar activity.`,
        confidence: Math.min(90, 40 + row.total * 2),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          `Consider reducing input gain before ${dayNames[row.dayOfWeek]} ${timeStr}`,
          'This may coincide with game nights or live events',
          'Pre-configure a "loud night" scene with lower input gains',
        ],
        severity: row.total > avgPerSlot * 4 ? 'warning' : 'info',
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

/**
 * 4. Zone Usage — group zone events by zoneNumber, identify most/least active, frequently muted zones
 */
function analyzeZoneUsage(since: string, until: string): AtlasLearnedPattern[] {
  const patterns: AtlasLearnedPattern[] = []

  // Get zone activity counts
  const rows = db.all<{ zoneNumber: number; processorId: string; total: number; muteCount: number }>(
    sql`SELECT zoneNumber, processorId, COUNT(*) as total,
            SUM(CASE WHEN eventType = 'zone_mute_toggle' AND muted = 1 THEN 1 ELSE 0 END) as muteCount
        FROM AtlasLearningEvent
        WHERE createdAt >= ${since}
            AND eventType IN ('zone_volume_change', 'zone_mute_toggle', 'zone_source_change')
            AND zoneNumber IS NOT NULL
        GROUP BY zoneNumber, processorId
        HAVING total >= 3`
  )

  if (rows.length < 2) return patterns

  const avgActivity = rows.reduce((s, r) => s + r.total, 0) / rows.length

  for (const row of rows) {
    // Flag zones that are muted most of the time
    if (row.muteCount > 0 && row.muteCount / row.total > 0.6) {
      const mutePct = ((row.muteCount / row.total) * 100).toFixed(0)
      patterns.push({
        id: `zone-usage-muted-${row.processorId}-${row.zoneNumber}`,
        category: 'zone_usage',
        title: `Zone ${row.zoneNumber} Frequently Muted`,
        description: `Zone ${row.zoneNumber} is muted ${mutePct}% of the time (${row.muteCount}/${row.total} events). This zone may be misconfigured or unused.`,
        confidence: Math.min(85, 40 + row.total),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          `Verify zone ${row.zoneNumber} is assigned to the correct speaker area`,
          'Consider disabling this zone if not needed',
        ],
        severity: 'info',
        processorId: row.processorId,
        learnedAt: new Date().toISOString(),
      })
    }

    // Flag highly active zones
    if (row.total > avgActivity * 3 && row.total >= 10) {
      patterns.push({
        id: `zone-usage-active-${row.processorId}-${row.zoneNumber}`,
        category: 'zone_usage',
        title: `Zone ${row.zoneNumber} Most Active`,
        description: `Zone ${row.zoneNumber} has ${row.total} control events (avg: ${avgActivity.toFixed(0)}). This is the most adjusted zone.`,
        confidence: Math.min(85, 40 + row.total),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          'Consider if this zone needs different default levels',
          'Frequent adjustments may indicate the default volume is wrong',
        ],
        severity: 'info',
        processorId: row.processorId,
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

/**
 * 5. Processor Reliability — group connection events by processorId, compute uptime ratio
 */
function analyzeProcessorReliability(since: string, until: string): AtlasLearnedPattern[] {
  const patterns: AtlasLearnedPattern[] = []

  const rows = db.all<{ processorId: string; onlineCount: number; offlineCount: number; total: number }>(
    sql`SELECT processorId,
            SUM(CASE WHEN eventType = 'connection_online' THEN 1 ELSE 0 END) as onlineCount,
            SUM(CASE WHEN eventType = 'connection_offline' THEN 1 ELSE 0 END) as offlineCount,
            COUNT(*) as total
        FROM AtlasLearningEvent
        WHERE createdAt >= ${since} AND eventType IN ('connection_online', 'connection_offline')
        GROUP BY processorId
        HAVING total >= 2`
  )

  for (const row of rows) {
    if (row.offlineCount >= 2) {
      const offlinePct = ((row.offlineCount / row.total) * 100).toFixed(0)
      patterns.push({
        id: `reliability-${row.processorId}`,
        category: 'reliability',
        title: `Processor ${row.processorId.substring(0, 8)} Connection Issues`,
        description: `Processor went offline ${row.offlineCount} times in the last 30 days (${offlinePct}% of connection events). Check network stability.`,
        confidence: Math.min(90, 50 + row.total * 3),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          'Check Ethernet cable and switch port',
          'Verify processor has a static IP assignment',
          'Consider adding a UPS to prevent power interruptions',
        ],
        severity: row.offlineCount >= 5 ? 'warning' : 'info',
        processorId: row.processorId,
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

/**
 * 6. Adjustment Efficiency — compute adjustments-per-day per input,
 *    flag inputs needing constant adjustment (>50/day)
 */
function analyzeAdjustmentEfficiency(since: string, until: string): AtlasLearnedPattern[] {
  const patterns: AtlasLearnedPattern[] = []

  // Get days span
  const sinceDate = new Date(since)
  const untilDate = new Date(until)
  const daySpan = Math.max(1, Math.ceil((untilDate.getTime() - sinceDate.getTime()) / (24 * 60 * 60 * 1000)))

  const rows = db.all<{ inputNumber: number; processorId: string; total: number }>(
    sql`SELECT inputNumber, processorId, COUNT(*) as total
        FROM AtlasLearningEvent
        WHERE createdAt >= ${since} AND eventType = 'gain_adjustment' AND inputNumber IS NOT NULL
        GROUP BY inputNumber, processorId
        HAVING total >= 10`
  )

  for (const row of rows) {
    const perDay = row.total / daySpan
    if (perDay > 50) {
      patterns.push({
        id: `efficiency-${row.processorId}-${row.inputNumber}`,
        category: 'efficiency',
        title: `Input ${row.inputNumber} Excessive Adjustments`,
        description: `Input ${row.inputNumber} requires ~${Math.round(perDay)} AI gain adjustments per day (${row.total} total over ${daySpan} days). The target may be unreachable or the source is too dynamic.`,
        confidence: Math.min(90, 50 + Math.min(row.total, 40)),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          `Review the target level for input ${row.inputNumber}`,
          'Consider widening the tolerance band',
          'The source signal may be too dynamic for auto-gain',
          'Try increasing the adjustment interval from 500ms to 1000ms',
        ],
        severity: perDay > 200 ? 'warning' : 'info',
        processorId: row.processorId,
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Clean up events older than 90 days.
 */
function cleanupOldEvents(): void {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const result = db.delete(schema.atlasLearningEvents)
      .where(lte(schema.atlasLearningEvents.createdAt, ninetyDaysAgo))
      .run()

    if (result.changes > 0) {
      logger.info(`[ATLAS-LEARNING] Cleaned up ${result.changes} events older than 90 days`)
    }
  } catch (err) {
    logger.debug('[ATLAS-LEARNING] Cleanup failed:', err)
  }
}

/**
 * Get event count statistics for the API.
 */
export function getAtlasLearningStats(): {
  totalEvents: number
  recentEvents24h: number
  eventsByType: Record<string, number>
  lastRunTimestamp: string | null
} {
  const total = db.get<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM AtlasLearningEvent`
  )

  const recent = db.get<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM AtlasLearningEvent
        WHERE createdAt >= ${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`
  )

  const byType = db.all<{ eventType: string; count: number }>(
    sql`SELECT eventType, COUNT(*) as count FROM AtlasLearningEvent GROUP BY eventType`
  )

  const eventsByType: Record<string, number> = {}
  for (const row of byType) {
    eventsByType[row.eventType] = row.count
  }

  return {
    totalEvents: total?.count || 0,
    recentEvents24h: recent?.count || 0,
    eventsByType,
    lastRunTimestamp,
  }
}
