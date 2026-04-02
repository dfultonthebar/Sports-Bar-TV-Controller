/**
 * Wolfpack AI Learning API
 *
 * GET  — Learning stats + cached patterns
 * POST — Trigger a learning cycle manually
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import {
  runLearningCycle,
  getLearnedPatterns,
  getLearningStats,
  getLastRunTimestamp,
} from '@sports-bar/wolfpack'
import { ingestLearnedPatternsToRAG } from '@/lib/learning-rag-bridge'

const LEARNING_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const stats = getLearningStats()
    const patterns = getLearnedPatterns()
    const lastRun = getLastRunTimestamp()
    const nextRun = lastRun
      ? new Date(new Date(lastRun).getTime() + LEARNING_INTERVAL_MS).toISOString()
      : null

    return NextResponse.json({
      success: true,
      stats,
      patterns,
      patternCount: patterns.length,
      lastRunTimestamp: lastRun,
      nextRunTimestamp: nextRun,
    })
  } catch (error) {
    logger.error('[WOLFPACK-LEARNING] Stats error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get learning stats' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[WOLFPACK-LEARNING] Manual learning cycle triggered')
    const result = await runLearningCycle()

    const ragResult = result.patterns.length > 0
      ? await ingestLearnedPatternsToRAG('wolfpack', result.patterns)
      : { ingested: 0, skipped: false }

    return NextResponse.json({
      success: true,
      ...result,
      ragIngested: ragResult.ingested,
    })
  } catch (error) {
    logger.error('[WOLFPACK-LEARNING] Manual cycle error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Learning cycle failed' },
      { status: 500 }
    )
  }
}
