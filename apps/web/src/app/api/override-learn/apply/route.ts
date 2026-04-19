/**
 * POST /api/override-learn/apply
 * DELETE /api/override-learn/apply?id=<uuid>
 * GET /api/override-learn/apply
 *
 * Manage durable override-recommendation decisions written to
 * ScheduledOverrideDefaults. The scheduler consults this table when
 * building the initial tv_output_ids list for new allocations.
 *
 * POST body (upsert):
 *   {
 *     team: string,         // required — "Miami Marlins"
 *     outputNum: number,    // required — TV output number (1..N)
 *     action: 'exclude' | 'include',  // required — derived from override direction
 *     isHomeTeam?: boolean,
 *     league?: string,
 *     occurrences?: number, // how many source events derived this decision
 *     notes?: string,
 *     appliedBy?: string    // defaults to 'operator'
 *   }
 *
 * The action semantics:
 *   - 'exclude': never auto-route this team to this output (from recurring
 *     'remove' override events). Scheduler strips this output from the
 *     default tv_output_ids when creating new allocations for this team.
 *   - 'include': always auto-route this team to this output (from recurring
 *     'add' override events). Scheduler adds this output to the default
 *     tv_output_ids.
 */
import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'

const ApplySchema = z.object({
  team: z.string().min(1).max(200),
  outputNum: z.number().int().positive(),
  action: z.enum(['exclude', 'include']),
  isHomeTeam: z.boolean().optional(),
  league: z.string().max(50).optional(),
  occurrences: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
  appliedBy: z.string().max(100).optional(),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, ApplySchema)
  if (!bodyValidation.success) return bodyValidation.error

  const { team, outputNum, action, isHomeTeam, league, occurrences, notes, appliedBy } =
    bodyValidation.data

  try {
    // Upsert on UNIQUE(team, outputNum, action) — if the row already
    // exists (e.g. operator clicks Apply twice), we refresh the
    // occurrences + appliedAt rather than erroring.
    const existing = await db
      .select()
      .from(schema.scheduledOverrideDefaults)
      .where(
        and(
          eq(schema.scheduledOverrideDefaults.team, team),
          eq(schema.scheduledOverrideDefaults.outputNum, outputNum),
          eq(schema.scheduledOverrideDefaults.action, action),
        ),
      )
      .limit(1)
      .get()

    const nowIso = new Date().toISOString()

    let resultId: string
    if (existing) {
      await db
        .update(schema.scheduledOverrideDefaults)
        .set({
          isHomeTeam: isHomeTeam ?? existing.isHomeTeam,
          league: league ?? existing.league,
          occurrences: occurrences ?? existing.occurrences,
          notes: notes ?? existing.notes,
          appliedAt: nowIso,
          appliedBy: appliedBy ?? existing.appliedBy,
        })
        .where(eq(schema.scheduledOverrideDefaults.id, existing.id))
      resultId = existing.id
    } else {
      const id = crypto.randomUUID()
      await db.insert(schema.scheduledOverrideDefaults).values({
        id,
        team,
        outputNum,
        action,
        isHomeTeam: isHomeTeam ?? false,
        league: league ?? null,
        occurrences: occurrences ?? 1,
        notes: notes ?? null,
        appliedAt: nowIso,
        appliedBy: appliedBy ?? 'operator',
      })
      resultId = id
    }

    // Audit trail: write a SchedulerLog row so the decision is visible
    // in the live scheduler dashboard alongside the raw override-learn
    // events and the hourly digester recommendations.
    await db.insert(schema.schedulerLogs).values({
      id: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      component: 'override-digest',
      operation: 'applied',
      level: isHomeTeam ? 'warn' : 'info',
      message: `Applied: ${action === 'exclude' ? 'never route' : 'always route'} ${team} ${action === 'exclude' ? 'to' : 'to'} TV ${outputNum}${isHomeTeam ? ' (home team)' : ''}${existing ? ' — refreshed' : ''}`,
      success: true,
      metadata: JSON.stringify({
        team,
        outputNum,
        action,
        isHomeTeam: isHomeTeam ?? false,
        league: league ?? null,
        occurrences: occurrences ?? 1,
        existing: !!existing,
        appliedBy: appliedBy ?? 'operator',
      }),
    })

    logger.info(
      `[OVERRIDE-APPLY] ${team} × TV ${outputNum} × ${action} ${existing ? 'refreshed' : 'applied'} by ${appliedBy ?? 'operator'}`,
    )

    return NextResponse.json({
      success: true,
      id: resultId,
      refreshed: !!existing,
    })
  } catch (err: any) {
    logger.error('[OVERRIDE-APPLY] error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Apply failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: 'id query param required' }, { status: 400 })
  }

  try {
    const existing = await db
      .select()
      .from(schema.scheduledOverrideDefaults)
      .where(eq(schema.scheduledOverrideDefaults.id, id))
      .limit(1)
      .get()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    await db.delete(schema.scheduledOverrideDefaults).where(eq(schema.scheduledOverrideDefaults.id, id))

    await db.insert(schema.schedulerLogs).values({
      id: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      component: 'override-digest',
      operation: 'reverted',
      level: 'info',
      message: `Reverted: ${existing.team} × TV ${existing.outputNum} × ${existing.action}`,
      success: true,
      metadata: JSON.stringify({ team: existing.team, outputNum: existing.outputNum, action: existing.action }),
    })

    logger.info(`[OVERRIDE-APPLY] Reverted ${existing.team} × TV ${existing.outputNum} × ${existing.action}`)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    logger.error('[OVERRIDE-APPLY] revert error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Revert failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const rows = await db.select().from(schema.scheduledOverrideDefaults).all()
    return NextResponse.json({ applied: rows })
  } catch (err: any) {
    logger.error('[OVERRIDE-APPLY] list error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'List failed' },
      { status: 500 },
    )
  }
}
