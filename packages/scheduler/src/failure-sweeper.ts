/**
 * Failure Sweeper
 *
 * Hourly batch job that tails `SchedulerLog` for recent failures,
 * buckets them by (component, operation, first-line-of-message), and
 * emits a single `[failure-sweep]` warn row when a cluster of ≥3
 * failures shares the same signature in the last hour.
 *
 * Why: individual error rows are already in SchedulerLog, but nobody
 * reads them until something breaks spectacularly. This sweeper
 * promotes repeating failures to a higher-visibility row so they show
 * up on the live watcher and the SchedulerLogsDashboard.
 *
 * Tonight at Lucky's, this would have flagged the UUID parseInt bug
 * hours earlier — every failed scheduler tune wrote a success=0 row,
 * but we only noticed when the bartender said 14 TVs were on the wrong
 * inputs.
 *
 * Signature function is intentionally coarse: component + operation +
 * first 60 chars of message. Long error messages that differ only in
 * IDs (channel number, output number) still collapse into one bucket.
 */

import { db, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { v4 as uuidv4 } from 'uuid'

const LOOKBACK_SECONDS = 3600 // 1 hour
const MIN_CLUSTER_SIZE = 3
const MESSAGE_SIGNATURE_LENGTH = 60

interface FailureCluster {
  component: string
  operation: string
  signature: string
  count: number
  firstSeen: number
  lastSeen: number
  sampleMessage: string
}

export async function runFailureSweep(): Promise<{ clusters: FailureCluster[]; scanned: number }> {
  const cutoff = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS

  // Pull everything classifiable as a failure: level error/warn OR
  // success=0. Excludes override-learn/warn and override-digest/warn
  // because those are intentional high-visibility-but-healthy signals.
  const rows = await db.all(sql`
    SELECT component, operation, level, message, createdAt
    FROM SchedulerLog
    WHERE createdAt >= ${cutoff}
      AND (success = 0 OR level IN ('error', 'warn'))
      AND component NOT IN ('override-learn', 'override-digest', 'failure-sweep')
  `) as Array<{ component: string; operation: string; level: string; message: string; createdAt: number }>

  const buckets = new Map<string, FailureCluster>()
  for (const r of rows) {
    const sig = (r.message || '').substring(0, MESSAGE_SIGNATURE_LENGTH)
    const key = `${r.component}\u0000${r.operation}\u0000${sig}`
    const existing = buckets.get(key)
    if (existing) {
      existing.count += 1
      if (r.createdAt > existing.lastSeen) existing.lastSeen = r.createdAt
      if (r.createdAt < existing.firstSeen) existing.firstSeen = r.createdAt
    } else {
      buckets.set(key, {
        component: r.component,
        operation: r.operation,
        signature: sig,
        count: 1,
        firstSeen: r.createdAt,
        lastSeen: r.createdAt,
        sampleMessage: r.message,
      })
    }
  }

  const clusters = Array.from(buckets.values())
    .filter(c => c.count >= MIN_CLUSTER_SIZE)
    .sort((a, b) => b.count - a.count)

  const nowUnix = Math.floor(Date.now() / 1000)
  const correlationId = uuidv4()

  // Always emit the sweep summary so the watcher sees the sweeper is
  // alive. The summary row itself is at level='info' — only the
  // per-cluster rows escalate to 'warn'.
  await db.run(sql`
    INSERT INTO SchedulerLog
      (id, correlationId, component, operation, level, message, success, metadata, createdAt)
    VALUES (
      ${uuidv4()},
      ${correlationId},
      'failure-sweep',
      'scan',
      'info',
      ${`Scanned ${rows.length} failure events in last hour → ${clusters.length} clusters (≥${MIN_CLUSTER_SIZE} occurrences)`},
      1,
      ${JSON.stringify({ scanned: rows.length, clusters: clusters.length, lookbackSeconds: LOOKBACK_SECONDS })},
      ${nowUnix}
    )
  `)

  for (const c of clusters) {
    const msg = `Recurring failure [${c.component}/${c.operation}] ${c.count}× in last hour: ${c.signature}`
    await db.run(sql`
      INSERT INTO SchedulerLog
        (id, correlationId, component, operation, level, message, success, metadata, createdAt)
      VALUES (
        ${uuidv4()},
        ${correlationId},
        'failure-sweep',
        'cluster',
        'warn',
        ${msg},
        1,
        ${JSON.stringify(c)},
        ${nowUnix}
      )
    `)
  }

  logger.info(`[FAILURE-SWEEP] Scanned ${rows.length} failure events → ${clusters.length} clusters`)
  return { clusters, scanned: rows.length }
}
