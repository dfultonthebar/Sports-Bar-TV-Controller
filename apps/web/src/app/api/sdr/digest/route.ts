/**
 * GET /api/sdr/digest — return the latest RF Pattern Digest for this
 *                       location, or null if none has been generated yet.
 *
 * POST /api/sdr/digest — force-regenerate a digest right now (operator
 *                        button "Refresh AI summary"). Bypasses the
 *                        daily scheduler tick.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { db, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const locationId = process.env.LOCATION_ID ?? 'default-location'
    const rows = await db.all<{
      id: string
      period_start: number
      period_end: number
      summary_text: string
      structured_findings: string | null
      model_used: string
      prompt_token_count: number | null
      completion_token_count: number | null
      generation_ms: number | null
      generated_at: number
    }>(sql`
      SELECT id, period_start, period_end, summary_text, structured_findings,
             model_used, prompt_token_count, completion_token_count,
             generation_ms, generated_at
      FROM rf_pattern_digest
      WHERE location_id = ${locationId}
      ORDER BY generated_at DESC
      LIMIT 1
    `).catch(() => [])

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        digest: null,
        message:
          'No RF digest has been generated yet. The scheduler runs this daily; click "Refresh" to generate one now.',
      })
    }

    const row = rows[0]
    let structured: any = null
    if (row.structured_findings) {
      try {
        structured = JSON.parse(row.structured_findings)
      } catch { /* ignore malformed */ }
    }
    return NextResponse.json({
      success: true,
      digest: {
        id: row.id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        summaryText: row.summary_text,
        structured,
        modelUsed: row.model_used,
        promptTokenCount: row.prompt_token_count,
        completionTokenCount: row.completion_token_count,
        generationMs: row.generation_ms,
        generatedAt: row.generated_at,
        ageSec: Math.floor(Date.now() / 1000) - row.generated_at,
      },
    })
  } catch (err) {
    logger.error('[SDR-DIGEST GET] failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'digest query failed' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { generateRfPatternDigest } = await import('@sports-bar/scheduler')
    const result = await generateRfPatternDigest()
    return NextResponse.json({
      success: true,
      digest: {
        id: result.id,
        summaryText: result.summaryText,
        modelUsed: result.modelUsed,
        generationMs: result.generationMs,
        promptTokenCount: result.promptTokenCount,
        completionTokenCount: result.completionTokenCount,
      },
    })
  } catch (err) {
    logger.error('[SDR-DIGEST POST] generation failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'digest generation failed' },
      { status: 500 },
    )
  }
}
