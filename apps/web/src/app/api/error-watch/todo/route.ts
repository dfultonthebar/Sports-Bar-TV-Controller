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
import { findFirst, create, and, eq, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { syncTodosToGitHub } from '@/lib/gitSync'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

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
    const existing = await findFirst('todos', {
      where: and(eq(schema.todos.tags, tag), ne(schema.todos.status, 'COMPLETE')),
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

    const todo = await create('todos', {
      title: `Error watch: ${signature}`,
      description:
        `Auto-filed by the error-watch bot — this error signature appeared in the PM2 logs.\n\n` +
        `Sample: ${sample || '(no sample captured)'}\n` +
        `Source: ${sourceFile}\n\n` +
        `Investigate, fix, then mark COMPLETE. If it recurs after being closed it will re-file.`,
      priority: priorityForSignature(signature),
      status: 'PLANNED',
      category: 'Error Watch',
      tags: tag,
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
