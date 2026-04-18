
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { and, eq, inArray } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'

// Suggest-only conflict resolver. When POST /api/schedules/bartender-schedule
// returns 409 (an input source is already booked for the requested
// window), the UI can hand the rejected allocation + conflictingAllocationId
// to this endpoint and get a ranked recommendation: should the bartender
// displace the conflicting allocation, and if so, why.
//
// This endpoint NEVER mutates allocations. Displacement must be done by
// the UI calling DELETE /api/schedules/bartender-schedule/:id followed by
// a new POST. That keeps the human in the loop for a high-trust action.

const schema_ = z.object({
  rejectedGameScheduleId: z.string(),
  rejectedInputSourceId: z.string(),
  rejectedTuneAt: z.string(),  // ISO
  conflictingAllocationId: z.string(),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, schema_)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { rejectedGameScheduleId, rejectedInputSourceId, rejectedTuneAt, conflictingAllocationId } = bodyValidation.data

  try {
    const [rejected, conflicting, homeTeamRows] = await Promise.all([
      db.select().from(schema.gameSchedules)
        .where(eq(schema.gameSchedules.id, rejectedGameScheduleId))
        .get(),
      db.select({
        alloc: schema.inputSourceAllocations,
        game: schema.gameSchedules,
      })
        .from(schema.inputSourceAllocations)
        .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
        .where(eq(schema.inputSourceAllocations.id, conflictingAllocationId))
        .get(),
      db.select({ name: schema.homeTeams.teamName }).from(schema.homeTeams).all(),
    ])

    if (!rejected || !conflicting) {
      return NextResponse.json({ success: false, error: 'Rejected game or conflicting allocation not found' }, { status: 404 })
    }

    const homeTeamSet = new Set(homeTeamRows.map(h => h.name))
    const rejectedIsHome = homeTeamSet.has(rejected.homeTeamName) || homeTeamSet.has(rejected.awayTeamName)
    const conflictingIsHome = homeTeamSet.has(conflicting.game.homeTeamName) || homeTeamSet.has(conflicting.game.awayTeamName)

    // Coarse displacement recommendation scored on:
    //   +30 rejected is home team, conflicting is not  (STRONG reason to displace)
    //   -30 conflicting is home team, rejected is not  (STRONG reason to keep)
    //   +15 conflicting game is already "final" or blowout (score diff >= 10)
    //   +10 conflicting game has estimated_end within next 15 min
    //   -10 conflicting allocation was created by human ("bartender") very
    //        recently (< 30 min) — probably intentional
    let score = 0
    const factors: string[] = []

    if (rejectedIsHome && !conflictingIsHome) {
      score += 30
      factors.push(`Home team ${[rejected.homeTeamName, rejected.awayTeamName].find(n => homeTeamSet.has(n))} is playing — the game you're trying to schedule has priority.`)
    }
    if (conflictingIsHome && !rejectedIsHome) {
      score -= 30
      factors.push(`Conflicting game involves a home team; the rejected game does not.`)
    }

    if (conflicting.game.status === 'final' || conflicting.game.status === 'completed') {
      score += 20
      factors.push(`Conflicting game already ended (${conflicting.game.status}) — safe to displace.`)
    }
    const scoreDiff = Math.abs((conflicting.game.homeScore ?? 0) - (conflicting.game.awayScore ?? 0))
    if (scoreDiff >= 10 && conflicting.game.currentPeriod && conflicting.game.currentPeriod >= 3) {
      score += 15
      factors.push(`Conflicting game is a blowout (${scoreDiff}-pt lead) in period ${conflicting.game.currentPeriod}.`)
    }

    const endingSoon = conflicting.game.estimatedEnd && (conflicting.game.estimatedEnd - Math.floor(Date.now() / 1000)) < 900
    if (endingSoon) {
      score += 10
      factors.push(`Conflicting game ends within 15 minutes — wait or displace both work.`)
    }

    const allocAgeSeconds = Math.floor(Date.now() / 1000) - conflicting.alloc.allocatedAt
    if (conflicting.alloc.scheduledBy === 'bartender' && allocAgeSeconds < 1800) {
      score -= 10
      factors.push(`Conflicting allocation was set by bartender less than 30 min ago — probably intentional.`)
    }

    const recommendation = score >= 20
      ? 'displace'
      : score <= -20
      ? 'keep'
      : 'ambiguous'

    // Optional: enrich with a one-line LLM reasoning. Best-effort.
    let llmLine = ''
    try {
      llmLine = await generateOneLineReason({ rejected, conflicting, rejectedIsHome, conflictingIsHome, recommendation, factors })
    } catch {
      llmLine = ''
    }

    return NextResponse.json({
      success: true,
      recommendation,
      score,
      factors,
      llmReasoning: llmLine,
      rejectedMatchup: `${rejected.awayTeamName} @ ${rejected.homeTeamName}`,
      conflictingMatchup: `${conflicting.game.awayTeamName} @ ${conflicting.game.homeTeamName}`,
      conflictingAllocationId,
    })
  } catch (error: any) {
    logger.error('[CONFLICT-SUGGESTION] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function generateOneLineReason(ctx: any): Promise<string> {
  const prompt = `You are advising a sports bar bartender on a scheduling conflict. Write ONE sentence (<30 words) explaining the recommendation. Be direct.

Rejected game: ${ctx.rejected.awayTeamName} @ ${ctx.rejected.homeTeamName} (${ctx.rejected.league}) — home team: ${ctx.rejectedIsHome}
Conflicting game: ${ctx.conflicting.game.awayTeamName} @ ${ctx.conflicting.game.homeTeamName} (${ctx.conflicting.game.league}, ${ctx.conflicting.game.status}) — home team: ${ctx.conflictingIsHome}
Recommendation: ${ctx.recommendation}
Reasons: ${ctx.factors.join('; ')}`
  const resp = await fetch(`${HARDWARE_CONFIG.ollama.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: HARDWARE_CONFIG.ollama.model,
      prompt,
      stream: false,
      options: { temperature: 0.2, num_predict: 80 },
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!resp.ok) return ''
  const data = await resp.json()
  return (data.response || '').trim()
}
