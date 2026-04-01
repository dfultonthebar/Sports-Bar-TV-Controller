import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { patternAnalyzer } from '@sports-bar/scheduler'

/**
 * POST /api/scheduling/analyze
 * Trigger pattern analysis on scheduling history
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[PATTERN-ANALYZER] Manual analysis triggered')
    const result = await patternAnalyzer.analyzeAll()

    return NextResponse.json({
      success: true,
      message: 'Pattern analysis complete',
      result,
    })
  } catch (error: any) {
    logger.error('[PATTERN-ANALYZER] Analysis failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/scheduling/analyze
 * Get current patterns
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const patterns = await patternAnalyzer.getSavedPatterns()
    return NextResponse.json({ success: true, patterns })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
