/**
 * POST /api/maintenance-todo
 *
 * General source-tagged maintenance-todo creator (Hermes Phase 2). Used by:
 *  - the @sports-bar/mcp `create_maintenance_todo` agent tool (source='ai-chat'), and
 *  - hardware watchers that auto-file todos on significant events (source='watcher').
 *
 * Guarded write: the only mutation an agent can cause here is appending a
 * REVIEWABLE todo to the System Admin list — never a hardware action. Optional
 * `dedupeKey` collapses repeats (one OPEN todo per key; re-files after the
 * operator marks it COMPLETE, like the error-watch auto-filer).
 *
 * Body: { title: string, description?: string, priority?: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL',
 *         category?: string, source?: 'ai-chat'|'watcher'|string, dedupeKey?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { findFirst, create, and, eq, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { syncTodosToGitHub } from '@/lib/gitSync'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

const PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const body = await request.json().catch(() => ({}))
    const title = String(body?.title || '').trim().slice(0, 200)
    if (!title) {
      return NextResponse.json({ success: false, error: 'title required' }, { status: 400 })
    }
    const priority = PRIORITIES.has(String(body?.priority)) ? String(body.priority) : 'MEDIUM'
    const source = String(body?.source || 'ai-chat').slice(0, 40)
    const category = String(body?.category || 'Maintenance').slice(0, 60)
    const dedupeKey = body?.dedupeKey ? String(body.dedupeKey).slice(0, 120) : null
    const tag = dedupeKey ? `auto:${dedupeKey}` : `source:${source}`

    // Dedup — if a dedupeKey is given and an OPEN todo with this tag exists, do nothing.
    if (dedupeKey) {
      const existing = await findFirst('todos', {
        where: and(eq(schema.todos.tags, tag), ne(schema.todos.status, 'COMPLETE')),
      })
      if (existing) {
        return NextResponse.json({ success: true, created: false, reason: 'open todo exists', id: (existing as any).id })
      }
    }

    const description =
      String(body?.description || '').slice(0, 2000) +
      `\n\n(auto-filed via /api/maintenance-todo, source=${source})`

    const todo = await create('todos', {
      title,
      description,
      priority,
      status: 'PLANNED',
      category,
      tags: tag,
    })

    syncTodosToGitHub(`chore: auto-file maintenance TODO (${source}) - ${title.slice(0, 50)}`).catch((err) =>
      logger.debug(`[MAINTENANCE-TODO] github sync skipped: ${(err as Error)?.message}`),
    )

    logger.info(`[MAINTENANCE-TODO] filed '${title}' (source=${source}, priority=${priority})`)
    return NextResponse.json({ success: true, created: true, id: (todo as any).id })
  } catch (err) {
    logger.error('[MAINTENANCE-TODO] failed to file todo:', err)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
