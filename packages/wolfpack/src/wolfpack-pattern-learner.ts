/**
 * Wolfpack Pattern Learner
 *
 * Periodically analyzes wolfpackLearningEvents to discover reliability,
 * timing, performance, and failure patterns. Feeds learned patterns
 * into the AI analyzer and optionally into the RAG vector store.
 */

import { db, schema, sql, gte, lte } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

// ============================================================================
// Types
// ============================================================================

export interface LearnedPattern {
  id: string
  category: 'reliability' | 'timing' | 'protocol' | 'failure' | 'latency'
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
  chassisId?: string | null
  learnedAt: string
}

export interface LearningCycleResult {
  patterns: LearnedPattern[]
  eventsAnalyzed: number
  cycleTimestamp: string
  durationMs: number
}

// ============================================================================
// In-memory cache
// ============================================================================

let learnedPatternsCache: LearnedPattern[] = []
let lastRunTimestamp: string | null = null

export function getLearnedPatterns(): LearnedPattern[] {
  return learnedPatternsCache
}

export function getLastRunTimestamp(): string | null {
  return lastRunTimestamp
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Run a full learning cycle: analyze 30 days of events, discover patterns,
 * update in-memory cache, and optionally feed to RAG.
 */
export async function runLearningCycle(): Promise<LearningCycleResult> {
  const cycleStart = Date.now()
  logger.info('[WOLFPACK-LEARNING] Starting learning cycle...')

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Count total events in window
    const countResult = db.select({ count: sql<number>`count(*)` })
      .from(schema.wolfpackLearningEvents)
      .where(gte(schema.wolfpackLearningEvents.createdAt, thirtyDaysAgo))
      .get()

    const totalEvents = countResult?.count || 0

    if (totalEvents < 5) {
      logger.info(`[WOLFPACK-LEARNING] Only ${totalEvents} events in last 30 days — skipping analysis (need >= 5)`)
      lastRunTimestamp = now
      return {
        patterns: [],
        eventsAnalyzed: totalEvents,
        cycleTimestamp: now,
        durationMs: Date.now() - cycleStart,
      }
    }

    // Run all analysis functions
    const patterns: LearnedPattern[] = []

    patterns.push(...analyzeInputReliability(thirtyDaysAgo, now))
    patterns.push(...analyzeTimePatterns(thirtyDaysAgo, now))
    patterns.push(...analyzeProtocolPerformance(thirtyDaysAgo, now))
    patterns.push(...analyzeFailureModes(thirtyDaysAgo, now))
    patterns.push(...analyzeLatencyTrends(thirtyDaysAgo, now))

    // Update cache
    learnedPatternsCache = patterns
    lastRunTimestamp = now

    // Cleanup old events (>90 days)
    cleanupOldEvents()

    const durationMs = Date.now() - cycleStart
    logger.info(`[WOLFPACK-LEARNING] Cycle complete: ${patterns.length} patterns from ${totalEvents} events in ${durationMs}ms`)

    return {
      patterns,
      eventsAnalyzed: totalEvents,
      cycleTimestamp: now,
      durationMs,
    }
  } catch (error) {
    logger.error('[WOLFPACK-LEARNING] Learning cycle failed:', error)
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
 * 1. Input Reliability — group by inputNum, compute success rate per input,
 *    flag below-average inputs.
 */
function analyzeInputReliability(since: string, until: string): LearnedPattern[] {
  const patterns: LearnedPattern[] = []

  const rows = db.all<{ inputNum: number; total: number; successes: number }>(
    sql`SELECT inputNum, COUNT(*) as total, SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes
        FROM WolfpackLearningEvent
        WHERE createdAt >= ${since} AND inputNum IS NOT NULL
        GROUP BY inputNum
        HAVING total >= 3`
  )

  if (rows.length < 2) return patterns

  // Compute average success rate across all inputs
  const avgRate = rows.reduce((sum, r) => sum + (r.successes / r.total), 0) / rows.length

  for (const row of rows) {
    const rate = row.successes / row.total
    if (rate < avgRate - 0.1 && rate < 0.95) {
      const pct = (rate * 100).toFixed(1)
      patterns.push({
        id: `reliability-input-${row.inputNum}`,
        category: 'reliability',
        title: `Input ${row.inputNum} Below-Average Reliability`,
        description: `Input ${row.inputNum} has a ${pct}% success rate (avg: ${(avgRate * 100).toFixed(1)}%) over ${row.total} operations`,
        confidence: Math.min(95, 50 + row.total),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          `Check cable/connection on input ${row.inputNum}`,
          'Verify the source device is responding correctly',
          'Consider swapping to a different input port',
        ],
        severity: rate < 0.8 ? 'warning' : 'info',
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

/**
 * 2. Time Patterns — group by dayOfWeek+hourOfDay, find elevated failure
 *    time windows (e.g., game night detection).
 */
function analyzeTimePatterns(since: string, until: string): LearnedPattern[] {
  const patterns: LearnedPattern[] = []

  const rows = db.all<{ dayOfWeek: number; hourOfDay: number; total: number; failures: number }>(
    sql`SELECT dayOfWeek, hourOfDay, COUNT(*) as total,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures
        FROM WolfpackLearningEvent
        WHERE createdAt >= ${since}
        GROUP BY dayOfWeek, hourOfDay
        HAVING total >= 3`
  )

  if (rows.length < 3) return patterns

  // Average failure rate across all time slots
  const totalAll = rows.reduce((s, r) => s + r.total, 0)
  const failAll = rows.reduce((s, r) => s + r.failures, 0)
  const avgFailRate = failAll / totalAll

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  for (const row of rows) {
    const failRate = row.failures / row.total
    if (failRate > avgFailRate * 2 && failRate > 0.1 && row.failures >= 2) {
      const hour = row.hourOfDay
      const timeStr = `${hour % 12 || 12}${hour < 12 ? 'AM' : 'PM'}`
      patterns.push({
        id: `timing-${row.dayOfWeek}-${row.hourOfDay}`,
        category: 'timing',
        title: `Elevated Failures: ${dayNames[row.dayOfWeek]} ${timeStr}`,
        description: `${(failRate * 100).toFixed(0)}% failure rate on ${dayNames[row.dayOfWeek]}s at ${timeStr} (${row.failures}/${row.total} operations). Average failure rate is ${(avgFailRate * 100).toFixed(1)}%.`,
        confidence: Math.min(90, 40 + row.total * 2),
        evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          'This may coincide with peak bar activity or game nights',
          'Consider pre-routing channels before this time window',
          'Check if network bandwidth is saturated during this period',
        ],
        severity: failRate > 0.3 ? 'warning' : 'info',
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

/**
 * 3. Protocol Performance — compare TCP/UDP/HTTP success rates and avg latency.
 */
function analyzeProtocolPerformance(since: string, until: string): LearnedPattern[] {
  const patterns: LearnedPattern[] = []

  const rows = db.all<{ protocol: string; total: number; successes: number; avgMs: number }>(
    sql`SELECT protocol, COUNT(*) as total,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
            AVG(durationMs) as avgMs
        FROM WolfpackLearningEvent
        WHERE createdAt >= ${since} AND protocol IS NOT NULL
        GROUP BY protocol
        HAVING total >= 3`
  )

  if (rows.length < 2) return patterns

  // Find best protocol by success rate, then by latency
  const sorted = [...rows].sort((a, b) => {
    const rateA = a.successes / a.total
    const rateB = b.successes / b.total
    if (Math.abs(rateA - rateB) > 0.05) return rateB - rateA
    return a.avgMs - b.avgMs
  })

  const best = sorted[0]
  const bestRate = (best.successes / best.total * 100).toFixed(1)

  for (const row of rows) {
    if (row.protocol === best.protocol) continue
    const rate = (row.successes / row.total * 100).toFixed(1)
    const latencyDiff = Math.round(row.avgMs - best.avgMs)

    if (row.successes / row.total < best.successes / best.total - 0.05 || latencyDiff > 100) {
      patterns.push({
        id: `protocol-${row.protocol.toLowerCase()}`,
        category: 'protocol',
        title: `${best.protocol} Outperforms ${row.protocol}`,
        description: `${best.protocol}: ${bestRate}% success, ${Math.round(best.avgMs)}ms avg vs ${row.protocol}: ${rate}% success, ${Math.round(row.avgMs)}ms avg`,
        confidence: Math.min(90, 40 + Math.min(best.total, row.total)),
        evidence: { sampleSize: best.total + row.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          `Consider switching to ${best.protocol} for better reliability`,
          `${best.protocol} averages ${Math.round(best.avgMs)}ms vs ${Math.round(row.avgMs)}ms for ${row.protocol}`,
        ],
        severity: 'info',
        learnedAt: new Date().toISOString(),
      })
    }
  }

  return patterns
}

/**
 * 4. Failure Modes — group failures by errorMessage patterns.
 */
function analyzeFailureModes(since: string, until: string): LearnedPattern[] {
  const patterns: LearnedPattern[] = []

  const rows = db.all<{ errorMessage: string; total: number }>(
    sql`SELECT errorMessage, COUNT(*) as total
        FROM WolfpackLearningEvent
        WHERE createdAt >= ${since} AND success = 0 AND errorMessage IS NOT NULL
        GROUP BY errorMessage
        HAVING total >= 2
        ORDER BY total DESC
        LIMIT 5`
  )

  for (const row of rows) {
    const msg = row.errorMessage
    let severity: LearnedPattern['severity'] = 'warning'
    const recommendations: string[] = []

    if (/timeout/i.test(msg)) {
      recommendations.push('Check network latency to the matrix', 'Consider increasing timeout values')
    } else if (/refused|ECONNREFUSED/i.test(msg)) {
      recommendations.push('Verify the matrix is powered on', 'Check if another process is holding the connection')
      severity = 'error'
    } else if (/verification|verify/i.test(msg)) {
      recommendations.push('Route verification may be delayed — consider adding retry logic')
    } else {
      recommendations.push('Review error details and check hardware logs')
    }

    patterns.push({
      id: `failure-${msg.substring(0, 30).replace(/\W+/g, '-').toLowerCase()}`,
      category: 'failure',
      title: `Recurring Failure: ${msg.substring(0, 60)}`,
      description: `"${msg}" occurred ${row.total} times in the last 30 days`,
      confidence: Math.min(90, 50 + row.total * 3),
      evidence: { sampleSize: row.total, timeRangeStart: since, timeRangeEnd: until },
      recommendations,
      severity,
      learnedAt: new Date().toISOString(),
    })
  }

  return patterns
}

/**
 * 5. Latency Trends — compute avg/max latency, detect upward trends.
 */
function analyzeLatencyTrends(since: string, until: string): LearnedPattern[] {
  const patterns: LearnedPattern[] = []

  // Overall stats
  const stats = db.get<{ avgMs: number; maxMs: number; total: number }>(
    sql`SELECT AVG(durationMs) as avgMs, MAX(durationMs) as maxMs, COUNT(*) as total
        FROM WolfpackLearningEvent
        WHERE createdAt >= ${since} AND durationMs IS NOT NULL AND success = 1`
  )

  if (!stats || stats.total < 5) return patterns

  // Compare first half vs second half for trend detection
  const midpoint = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()

  const firstHalf = db.get<{ avgMs: number; total: number }>(
    sql`SELECT AVG(durationMs) as avgMs, COUNT(*) as total
        FROM WolfpackLearningEvent
        WHERE createdAt >= ${since} AND createdAt < ${midpoint} AND durationMs IS NOT NULL AND success = 1`
  )

  const secondHalf = db.get<{ avgMs: number; total: number }>(
    sql`SELECT AVG(durationMs) as avgMs, COUNT(*) as total
        FROM WolfpackLearningEvent
        WHERE createdAt >= ${midpoint} AND durationMs IS NOT NULL AND success = 1`
  )

  if (firstHalf && secondHalf && firstHalf.total >= 3 && secondHalf.total >= 3) {
    const increase = secondHalf.avgMs - firstHalf.avgMs
    const pctIncrease = (increase / firstHalf.avgMs) * 100

    if (pctIncrease > 30 && increase > 50) {
      patterns.push({
        id: 'latency-trend-increasing',
        category: 'latency',
        title: 'Latency Trending Upward',
        description: `Average latency increased from ${Math.round(firstHalf.avgMs)}ms to ${Math.round(secondHalf.avgMs)}ms (+${pctIncrease.toFixed(0)}%) over the last 30 days`,
        confidence: Math.min(85, 40 + Math.min(firstHalf.total, secondHalf.total)),
        evidence: { sampleSize: stats.total, timeRangeStart: since, timeRangeEnd: until },
        recommendations: [
          'Check network health and bandwidth',
          'Verify matrix firmware is up to date',
          'Look for new devices causing congestion',
        ],
        severity: pctIncrease > 100 ? 'warning' : 'info',
        learnedAt: new Date().toISOString(),
      })
    }
  }

  // Flag high average latency
  if (stats.avgMs > 1000) {
    patterns.push({
      id: 'latency-high-average',
      category: 'latency',
      title: 'High Average Routing Latency',
      description: `Average routing latency is ${Math.round(stats.avgMs)}ms (max: ${Math.round(stats.maxMs)}ms) across ${stats.total} successful operations`,
      confidence: Math.min(90, 50 + stats.total),
      evidence: { sampleSize: stats.total, timeRangeStart: since, timeRangeEnd: until },
      recommendations: [
        'Consider switching protocols (HTTP may have lower latency)',
        'Check for network congestion during routing operations',
      ],
      severity: stats.avgMs > 2000 ? 'warning' : 'info',
      learnedAt: new Date().toISOString(),
    })
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
    const result = db.delete(schema.wolfpackLearningEvents)
      .where(lte(schema.wolfpackLearningEvents.createdAt, ninetyDaysAgo))
      .run()

    if (result.changes > 0) {
      logger.info(`[WOLFPACK-LEARNING] Cleaned up ${result.changes} events older than 90 days`)
    }
  } catch (err) {
    logger.debug('[WOLFPACK-LEARNING] Cleanup failed:', err)
  }
}

/**
 * Get event count statistics for the API.
 */
export function getLearningStats(): {
  totalEvents: number
  recentEvents24h: number
  eventsByType: Record<string, number>
  lastRunTimestamp: string | null
} {
  const total = db.get<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM WolfpackLearningEvent`
  )

  const recent = db.get<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM WolfpackLearningEvent
        WHERE createdAt >= ${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`
  )

  const byType = db.all<{ eventType: string; count: number }>(
    sql`SELECT eventType, COUNT(*) as count FROM WolfpackLearningEvent GROUP BY eventType`
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
