
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { routeMatrix } from '@/lib/matrix-control'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { updateRoutesCache } from '@/app/api/matrix/routes/route'


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
    source: z.enum(['bartender', 'ai_scheduler', 'manual', 'system', 'auto-reallocator']).optional().default('bartender'),
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

    // Override-learn: when a bartender changes a route within 10 min of an
    // active scheduled allocation, patch that allocation's tv_output_ids so
    // the hourly pattern-analyzer learns from the correction (the bartender
    // knows the room better than whoever originally scheduled the TVs).
    // Home-team overrides (Brewers/Bucks/Badgers/etc. from HomeTeam table)
    // are logged at warn level so operators can filter to the strongest
    // signals.
    if (source === 'bartender') {
      try {
        const { sql } = await import('drizzle-orm')
        const windowStart = Math.floor(Date.now() / 1000) - 600 // 10 min

        const recent = await db.all(sql`
          SELECT
            a.id AS allocation_id,
            a.input_source_id,
            a.tv_output_ids,
            a.game_schedule_id,
            s.matrix_input_id,
            mi.channelNumber AS matrix_input_num,
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
            AND a.allocated_at >= ${windowStart}
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
