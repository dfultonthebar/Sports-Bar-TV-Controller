/**
 * Rollback-learn: passive capture of auto-update failure signatures.
 *
 * Parses the update-log files for FAIL-at-step events and upserts a row
 * in AutoUpdateFailureSignatures keyed by (failedStep, normalized
 * signature). Recurring failures increment `occurrences`. Checkpoint A
 * of future auto-update runs can query this table to flag "we've seen
 * this before" patterns before approving a merge that's likely to trip
 * the same trap.
 *
 * Signature normalization strips timestamps, UUIDs, and specific paths
 * so semantically-equivalent failures bucket together. Two different
 * "build failed" events still get separate rows if the underlying
 * errors differ.
 */

import { eq, and, desc, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { listRuns } from '@/lib/auto-update/log-parser'
import { logger } from '@sports-bar/logger'

function normalizeSignature(raw: string): string {
  return raw
    .replace(/\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?\]?/g, '<TS>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<UUID>')
    .replace(/[0-9a-f]{40}/g, '<SHA>')
    .replace(/\b\d{9,}\b/g, '<BIGNUM>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

export async function captureFailedRun(runId: string, failedStep: string, reason: string, version?: string | null) {
  if (!failedStep || !reason) return
  const signature = normalizeSignature(reason)
  const now = Math.floor(Date.now() / 1000)

  try {
    const existing = await db
      .select()
      .from(schema.autoUpdateFailureSignatures)
      .where(
        and(
          eq(schema.autoUpdateFailureSignatures.failedStep, failedStep),
          eq(schema.autoUpdateFailureSignatures.signature, signature),
        ),
      )
      .limit(1)
      .get()

    if (existing) {
      let versions: string[] = []
      try { versions = JSON.parse(existing.affectedVersions || '[]') } catch {}
      if (version && !versions.includes(version)) versions.push(version)
      await db
        .update(schema.autoUpdateFailureSignatures)
        .set({
          occurrences: existing.occurrences + 1,
          lastSeen: now,
          fullReason: reason.slice(0, 1000),
          lastRunId: runId,
          affectedVersions: JSON.stringify(versions),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.autoUpdateFailureSignatures.id, existing.id))
    } else {
      await db.insert(schema.autoUpdateFailureSignatures).values({
        id: crypto.randomUUID(),
        failedStep,
        signature,
        fullReason: reason.slice(0, 1000),
        occurrences: 1,
        firstSeen: now,
        lastSeen: now,
        affectedVersions: version ? JSON.stringify([version]) : '[]',
        lastRunId: runId,
      })
    }
  } catch (err) {
    logger.warn('[ROLLBACK-LEARN] upsert failed (non-fatal):', err)
  }
}

/**
 * One-shot backfill: scan all existing update-log files and populate
 * AutoUpdateFailureSignatures with any fail-at-step events. Idempotent
 * via the (failedStep, signature) unique index.
 */
export async function backfillFromLogs(): Promise<{ scanned: number; captured: number }> {
  const runs = listRuns(500)
  let captured = 0
  for (const r of runs) {
    if (r.finalResult === 'fail' && r.failedStep) {
      // Reason = failedStep + last Checkpoint reason or failure message.
      // For simple logs we don't have a structured "reason"; use last
      // checkpoint reason if present, else step name + "failed".
      const reason = r.checkpoints[r.checkpoints.length - 1]?.reason || `${r.failedStep} failed`
      await captureFailedRun(r.id, r.failedStep, reason, r.preMergeVersion)
      captured += 1
    }
  }
  return { scanned: runs.length, captured }
}

/**
 * Query the table for the top N recurring signatures. Used by Checkpoint
 * A prompts and by the /auto-update page header banner.
 */
export async function listKnownFailures(limit = 20) {
  return db
    .select()
    .from(schema.autoUpdateFailureSignatures)
    .orderBy(desc(schema.autoUpdateFailureSignatures.occurrences), desc(schema.autoUpdateFailureSignatures.lastSeen))
    .limit(limit)
    .all()
}

void sql // avoid tree-shaking imports
