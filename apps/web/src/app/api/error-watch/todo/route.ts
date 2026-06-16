/**
 * POST /api/error-watch/todo
 *
 * Called by the error-watch bot (scripts/watchers/error-watch.sh) when it
 * detects an error signature. Auto-files a TODO so operators see it on the
 * System Admin → Todos list — but DEDUPED: one open TODO per signature.
 *
 * Body: { signature: string }  (the shell only sends the safe signature label;
 * the human-readable sample + source file are pulled from the latest
 * error_watch_events row for that signature, so the shell needs no JSON escaping.)
 *
 * Dedup rule: skip if an OPEN TODO (status != COMPLETE) already tagged
 * `errorwatch:<signature>` exists. After an operator marks it COMPLETE, a
 * fresh recurrence re-files a new TODO (the error came back = worth re-alerting).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { findFirst, create, and, eq, ne, like } from '@/lib/db-helpers'
import { schema } from '@/db'
import { syncTodosToGitHub } from '@/lib/gitSync'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import {
  isDiagnoseEnabled,
  runDiagnose,
  buildDiagnosisDescription,
  DIAGNOSED_TAG,
} from '@/lib/error-watch/diagnose'

export const dynamic = 'force-dynamic'

// Signatures that mean "data/process integrity" get CRITICAL; the rest HIGH.
function priorityForSignature(sig: string): string {
  return /fk_constraint|constraint|crash|\boom\b|unhandled|fatal|db_lock|locked|migration|exited|segfault/i.test(sig)
    ? 'CRITICAL'
    : 'HIGH'
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const body = await request.json().catch(() => ({}))
    const signature = String(body?.signature || '').trim()
    if (!signature) {
      return NextResponse.json({ success: false, error: 'signature required' }, { status: 400 })
    }
    const tag = `errorwatch:${signature}`

    // Dedup — already an OPEN todo for this signature? Then do nothing.
    // When diagnose is OFF, tags are stored as the bare `errorwatch:<sig>`, so
    // the original exact-match `eq` is used unchanged. When diagnose is ON, the
    // stored tag carries a `,diagnosed:1` suffix, so dedup must prefix-match
    // (`errorwatch:<sig>%`) to still find the prior open TODO. The OFF branch is
    // byte-for-byte the pre-Hermes query.
    const dedupTagMatch = isDiagnoseEnabled()
      ? like(schema.todos.tags, `${tag}%`)
      : eq(schema.todos.tags, tag)
    const existing = await findFirst('todos', {
      where: and(dedupTagMatch, ne(schema.todos.status, 'COMPLETE')),
    })
    if (existing) {
      return NextResponse.json({ success: true, created: false, reason: 'open todo exists', id: (existing as any).id })
    }

    // Pull the freshest sample + source for this signature from the watcher's events.
    const rows = (await db.all(sql`
      SELECT sample, source_file, COUNT(*) AS n
      FROM error_watch_events
      WHERE kind = 'error' AND signature = ${signature}
      ORDER BY detected_at DESC
      LIMIT 1
    `)) as Array<{ sample: string; source_file: string | null; n: number }>
    const sample = (rows[0]?.sample || '').slice(0, 400)
    const sourceFile = rows[0]?.source_file || '(unknown)'

    let description =
      `Auto-filed by the error-watch bot — this error signature appeared in the PM2 logs.\n\n` +
      `Sample: ${sample || '(no sample captured)'}\n` +
      `Source: ${sourceFile}\n\n` +
      `Investigate, fix, then mark COMPLETE. If it recurs after being closed it will re-file.`
    let tags = tag

    // Hermes Layer 1 — diagnose enrichment (flag-gated, default OFF). When
    // DIAGNOSE_ENABLED is unset the block below never runs, so the path above
    // is byte-for-byte unchanged. See docs/HERMES_AUTONOMOUS_OPS_PLAN.md.
    if (isDiagnoseEnabled()) {
      try {
        const diagnosis = await runDiagnose({
          signature,
          sample,
          logContext: `Source: ${sourceFile}`,
        })
        description += buildDiagnosisDescription(diagnosis)
      } catch (err) {
        // Diagnose must never block the TODO — log and file unchanged.
        logger.debug(`[ERROR-WATCH-TODO] diagnose skipped: ${(err as Error)?.message}`)
      }
      // Mark as diagnosed even when the step found nothing, so it isn't re-run.
      tags = `${tag},${DIAGNOSED_TAG}`
    }

    const todo = await create('todos', {
      title: `Error watch: ${signature}`,
      description,
      priority: priorityForSignature(signature),
      status: 'PLANNED',
      category: 'Error Watch',
      tags,
    })

    syncTodosToGitHub(`chore: auto-file error-watch TODO - ${signature}`).catch((err) =>
      logger.debug(`[ERROR-WATCH-TODO] github sync skipped: ${(err as Error)?.message}`),
    )

    logger.info(`[ERROR-WATCH-TODO] filed TODO for signature '${signature}'`)
    return NextResponse.json({ success: true, created: true, id: (todo as any).id })
  } catch (err) {
    logger.error('[ERROR-WATCH-TODO] failed to file todo:', err)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
