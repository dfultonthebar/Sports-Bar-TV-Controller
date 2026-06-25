
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { routeMatrix } from '@/lib/matrix-control'
import { logSchedulingEvent } from '@/lib/scheduling-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { updateRoutesCache } from '@/app/api/matrix/routes/route'
import { reportToFlywheel } from '@/lib/flywheel'


export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation - extend schema to accept source parameter
  const extendedSchema = z.object({
    input: z.union([z.string(), z.number()]),
    output: z.union([z.string(), z.number()]),
    // 'auto-reallocator' added in v2.26.2 — the scheduler's revert-to-defaults
    // path calls this endpoint with source='auto-reallocator'. Previously
    // rejected by the enum, causing silent revert failure (the calling code
    // logged "revert complete" even though every matrix route was 400'd
    // before reaching the Wolf Pack).
    // 'manual_schedule' added (Wave 1, intelligence roadmap) — the
    // execute-single-game path (AIGamePlanModal, ScheduledGamesPanel) sends
    // source='manual_schedule'. Previously rejected by the enum, so EVERY
    // routing call from that path returned HTTP 400 and silently failed with
    // tvsControlled=0 — the TV never changed, with zero diagnostic.
    source: z.enum(['bartender', 'ai_scheduler', 'manual', 'manual_schedule', 'system', 'auto-reallocator']).optional().default('bartender'),
    bartenderId: z.string().optional(),
  })

  const bodyValidation = await validateRequestBody(request, extendedSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Security: use validated data
  const { data } = bodyValidation
  const { input, output, source, bartenderId } = data

  // Convert to numbers if strings
  const inputNum = typeof input === 'string' ? parseInt(input, 10) : input
  const outputNum = typeof output === 'string' ? parseInt(output, 10) : output

  try {

    // Get active matrix config for port limits
    const activeConfig = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    const maxInput = activeConfig?.inputCount || 48
    const maxOutput = activeConfig?.outputCount || 48

    // Validate input parameters
    if (!inputNum || !outputNum || inputNum < 1 || outputNum < 1 || inputNum > maxInput || outputNum > maxOutput) {
      return NextResponse.json(
        { error: `Invalid input (max ${maxInput}) or output (max ${maxOutput}) channel` },
        { status: 400 }
      )
    }

    // Use shared matrix routing logic
    const success = await routeMatrix(inputNum, outputNum)

    if (!success) {
      return NextResponse.json({
        error: `Failed to route input ${input} to output ${output}`,
        success: false
      }, { status: 500 })
    }

    // Update the /api/matrix/routes cache in-place with the new state we
    // just applied, and refresh its TTL. This means the bartender remote's
    // next poll (which fires every 15s while the Video or Routing tab is
    // open) returns the already-correct state from cache and does NOT hit
    // the Wolf Pack hardware again — eliminating the double-beep pattern
    // where a click caused one beep for the route command itself and a
    // second beep seconds later when the client polled and the cache was
    // invalidated. We know the new state locally; no need to re-ask the
    // Wolf Pack and no need for the o2ox read-query quirk to risk a
    // 0xFFFF settling-window sentinel that could briefly blank the
    // Routing tab checkmark.
    updateRoutesCache(outputNum, inputNum)

    // Track routing in MatrixRoute table and set manual override for bartender changes
    try {
      const now = new Date().toISOString()

      // Check if route exists
      const existingRoute = await db.select()
        .from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.outputNum, outputNum))
        .limit(1)
        .get()

      // Calculate override duration for bartender changes
      let manualOverrideUntil: string | null = null
      if (source === 'bartender' || source === 'manual') {
        // Import smart override calculator to determine duration based on game
        const { calculateSmartOverrideDuration } = await import('@/lib/scheduler/smart-override')

        // Get the channel being played on this input
        const inputChannel = await db.select()
          .from(schema.inputCurrentChannels)
          .where(eq(schema.inputCurrentChannels.inputNum, inputNum))
          .limit(1)
          .get()

        if (inputChannel?.channelNumber) {
          const overrideResult = await calculateSmartOverrideDuration(inputChannel.channelNumber)
          manualOverrideUntil = new Date(Date.now() + overrideResult.durationMs).toISOString()

          logger.info(
            `[MATRIX_ROUTE] Bartender override set for output ${outputNum}: ` +
            `${overrideResult.durationMinutes} minutes (${overrideResult.reason})`
          )
        } else {
          // Default 4 hours if no channel info
          manualOverrideUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
          logger.info(`[MATRIX_ROUTE] Bartender override set for output ${outputNum}: 4 hours (default)`)
        }
      }

      if (existingRoute) {
        // Update existing route
        await db.update(schema.matrixRoutes)
          .set({
            inputNum,
            updatedAt: now,
            ...(source === 'bartender' || source === 'manual' ? {
              manualOverrideUntil,
              lastManualChangeBy: bartenderId || 'bartender',
              lastManualChangeAt: now,
            } : {})
          })
          .where(eq(schema.matrixRoutes.outputNum, outputNum))
      } else {
        // Create new route
        await db.insert(schema.matrixRoutes)
          .values({
            inputNum,
            outputNum,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            ...(source === 'bartender' || source === 'manual' ? {
              manualOverrideUntil,
              lastManualChangeBy: bartenderId || 'bartender',
              lastManualChangeAt: now,
            } : {})
          })
      }
    } catch (dbError: any) {
      logger.warn(`[MATRIX_ROUTE] Could not track route in database: ${dbError.message}`)
      // Don't fail the request if tracking fails
    }

    // Override-learn: when a bartender changes a route during an active
    // scheduled allocation (game has not yet ended), patch that allocation's
    // tv_output_ids so the hourly pattern-analyzer learns from the correction.
    // The window is open while the allocation's game is CURRENTLY RUNNING:
    // it has STARTED (allocated_at <= now) AND has not ended (expected_free_at
    // >= now, OR still status='active' for overruns).
    // Bartender corrections frequently happen 10+ minutes after game start
    // (allocated_at = tuneAtUnix = game start time), and the old
    // "allocated_at >= now-600" gate silently excluded every such correction,
    // dropping the strongest pattern-learning signal (fixed v2.55.40).
    // The OR-status-active leg covers games that run PAST their estimated end
    // (extra innings, overtime, rain delay): expected_free_at < now there,
    // but the allocation is still status='active' until the auto-reallocator
    // marks it completed at real game end — which closes the window naturally
    // (added v2.55.46).
    // The allocated_at <= now lower bound (v2.55.72) is CRITICAL: without it,
    // FUTURE pending allocations (tomorrow's / Friday's games pre-scheduled on
    // the SAME input source) have expected_free_at days out, pass the filter,
    // and a tonight-only tweak silently rewrites those future games' layouts
    // (and triple-logs the override, inflating the digest). The window must
    // mean "the game on right now", not "any allocation not yet ended".
    // Home-team overrides (Brewers/Bucks/Badgers/etc. from HomeTeam table)
    // are logged at warn level so operators can filter to the strongest
    // signals.
    if (source === 'bartender') {
      try {
        const { sql } = await import('drizzle-orm')
        const nowUnix = Math.floor(Date.now() / 1000)

        const recent = await db.all(sql`
          SELECT
            a.id AS allocation_id,
            a.input_source_id,
            a.tv_output_ids,
            a.game_schedule_id,
            s.matrix_input_id,
            COALESCE(mi.channelNumber, CASE WHEN s.matrix_input_id != '' AND s.matrix_input_id NOT GLOB '*[^0-9]*' THEN CAST(s.matrix_input_id AS INTEGER) END) AS matrix_input_num,
            g.home_team_name,
            g.away_team_name,
            g.league,
            EXISTS(
              SELECT 1 FROM HomeTeam h
              WHERE h.teamName = g.home_team_name OR h.teamName = g.away_team_name
            ) AS is_home_team_game
          FROM input_source_allocations a
          JOIN input_sources s ON s.id = a.input_source_id
          LEFT JOIN MatrixInput mi ON mi.id = s.matrix_input_id
          LEFT JOIN game_schedules g ON g.id = a.game_schedule_id
          WHERE a.status IN ('active','pending','tuning')
            AND a.allocated_at <= ${nowUnix}
            AND (a.expected_free_at >= ${nowUnix} OR a.status = 'active')
        `) as Array<{
          allocation_id: string
          input_source_id: string
          tv_output_ids: string
          game_schedule_id: string
          matrix_input_id: string | null
          matrix_input_num: number | null
          home_team_name: string | null
          away_team_name: string | null
          league: string | null
          is_home_team_game: number
        }>

        for (const row of recent) {
          let tvList: number[] = []
          try { tvList = JSON.parse(row.tv_output_ids) } catch { continue }
          // v2.82.45 — if we can't resolve the source's channel, do NOT risk mis-stripping a TV
          // off an active game. The 2026-06-24 Greenville Brewers bug: matrix_input_num was NULL
          // for cable sources (matrix_input_id holds the channel number, not the MatrixInput UUID),
          // so a bartender re-route ONTO the game's own input was misread as "removed" and every
          // TV got stripped. The COALESCE above now resolves the channel for both id forms; this
          // guard is the belt-and-suspenders for any source we still can't resolve.
          if (row.matrix_input_num == null) continue
          const hadOutput = tvList.includes(outputNum)
          const movedOntoScheduled = row.matrix_input_num === inputNum
          if (!hadOutput && !movedOntoScheduled) continue

          let newList = tvList
          let action: 'added' | 'removed' = 'added'
          if (movedOntoScheduled && !hadOutput) {
            newList = [...tvList, outputNum].sort((a, b) => a - b)
            action = 'added'
          } else if (hadOutput && !movedOntoScheduled) {
            newList = tvList.filter(n => n !== outputNum)
            action = 'removed'
          } else {
            continue
          }

          await db.update(schema.inputSourceAllocations)
            .set({
              tvOutputIds: JSON.stringify(newList),
              tvCount: newList.length,
              updatedAt: Math.floor(Date.now() / 1000),
            })
            .where(eq(schema.inputSourceAllocations.id, row.allocation_id))

          const team = row.home_team_name || row.away_team_name || 'unknown'
          const isHomeTeam = row.is_home_team_game === 1
          const msg = `Bartender ${action} output ${outputNum} ${action === 'added' ? 'onto' : 'from'} scheduled ${team}${isHomeTeam ? ' (home team)' : ''} [${row.league || '?'}] — patched tv_output_ids to ${JSON.stringify(newList)}`

          await db.insert(schema.schedulerLogs).values({
            correlationId: row.allocation_id,
            component: 'override-learn',
            operation: action === 'added' ? 'add' : 'remove',
            level: isHomeTeam ? 'warn' : 'info',
            message: msg,
            gameId: row.game_schedule_id,
            inputSourceId: row.input_source_id,
            allocationId: row.allocation_id,
            deviceId: String(outputNum),
            success: true,
            metadata: JSON.stringify({
              team,
              isHomeTeam,
              league: row.league,
              outputNum,
              inputNum,
              prevOutputs: tvList,
              newOutputs: newList,
              bartenderId: bartenderId || 'bartender',
            }),
          })

          logger.info(`[OVERRIDE-LEARN] ${msg}`)

          // v2.82.x — Hermes/flywheel capture of the override-learn correction.
          // CRITICAL guardrail (the Greenville mode): if this removal emptied an
          // active game's allocation, the game is now playing on NO screens —
          // report a WARNING so Hermes sees it. Fire-and-forget, never blocks.
          {
            const flLoc = process.env.LOCATION_NAME || process.env.LOCATION_ID || 'unknown'
            const flGame = `${row.home_team_name || '?'} vs ${row.away_team_name || '?'}`
            if (action === 'removed' && newList.length === 0) {
              reportToFlywheel('fleet-scheduler', `⚠ Scheduler: bartender removed last TV (output ${outputNum}) from active game ${flGame} — game is on no screens @ ${flLoc}`)
            } else {
              reportToFlywheel('fleet-scheduler', `Override-learn: bartender ${action} output ${outputNum} ${action === 'added' ? 'onto' : 'from'} ${flGame}${isHomeTeam ? ' (home team)' : ''} — now ${newList.length} TVs @ ${flLoc}`)
            }
          }

          // v2.55.42 — mirror override-learn into the dedicated scheduling
          // log so the operator can grep one file for the full team-routing
          // story (manual schedules + AI suggestions + override-learn).
          // Best-effort: failures don't block the matrix route itself.
          await logSchedulingEvent({
            level: isHomeTeam ? 'warn' : 'info',
            source: 'override-learn',
            action: 'allocation_updated',
            game: {
              home: row.home_team_name ?? undefined,
              away: row.away_team_name ?? undefined,
              league: row.league ?? undefined,
            },
            targets: {
              tvOutputIds: newList,
              inputSourceId: row.input_source_id ?? undefined,
            },
            outcome: {
              allocationId: row.allocation_id,
              status: 'active',
            },
            note: `bartender ${action} output ${outputNum} on team=${team}${isHomeTeam ? ' (HOME TEAM)' : ''} — prev=[${tvList.join(',')}] → new=[${newList.join(',')}]`,
          })
        }
      } catch (learnError: any) {
        logger.warn(`[OVERRIDE-LEARN] Failed to record override: ${learnError.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully routed input ${input} to output ${output}`,
      command: `${input}X${output}.`,
      route: { input, output },
      source,
      overrideApplied: source === 'bartender' || source === 'manual'
    })

  } catch (error) {
    logger.error('Error routing signal:', error)
    return NextResponse.json(
      { error: 'Failed to route signal' },
      { status: 500 }
    )
  }
}
