/**
 * Atlas AI Learning API
 *
 * GET  — Learning stats + cached patterns
 * POST — Trigger a learning cycle manually
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import {
  runAtlasLearningCycle,
  getAtlasLearnedPatterns,
  getAtlasLearningStats,
  getAtlasLastRunTimestamp,
} from '@sports-bar/atlas'

const LEARNING_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const stats = getAtlasLearningStats()
    const patterns = getAtlasLearnedPatterns()
    const lastRun = getAtlasLastRunTimestamp()
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
    logger.error('[ATLAS-LEARNING] Stats error:', error)
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
    logger.info('[ATLAS-LEARNING] Manual learning cycle triggered')
    const result = await runAtlasLearningCycle()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    logger.error('[ATLAS-LEARNING] Manual cycle error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Learning cycle failed' },
      { status: 500 }
    )
  }
}
