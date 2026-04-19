/**
 * GET /api/auto-update/runs/[id]
 * Return a single run's parsed detail + optional raw log text.
 */
import { NextRequest, NextResponse } from 'next/server'
import * as path from 'path'
import { parseLogFile, getRawLog } from '@/lib/auto-update/log-parser'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await ctx.params
  if (!/^auto-update-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(id)) {
    return NextResponse.json({ success: false, error: 'Invalid run id' }, { status: 400 })
  }

  const url = new URL(request.url)
  const includeRaw = url.searchParams.get('raw') === '1'

  try {
    const filePath = path.join('/home/ubuntu/sports-bar-data/update-logs', `${id}.log`)
    const run = parseLogFile(filePath)
    if (!run) {
      return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 })
    }

    const body: any = { run, generatedAt: new Date().toISOString() }
    if (includeRaw) {
      body.raw = getRawLog(id)
    }
    return NextResponse.json(body)
  } catch (err: any) {
    logger.error('[AUTO-UPDATE-RUNS] detail error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Fetch failed' }, { status: 500 })
  }
}
