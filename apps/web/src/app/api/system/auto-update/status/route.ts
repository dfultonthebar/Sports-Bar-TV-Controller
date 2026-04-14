import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { db, schema } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

const PID_FILE = '/home/ubuntu/sports-bar-data/auto-update.pid'

export async function GET(request: NextRequest) {
  // Auth
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'AUTO_UPDATE_STATUS',
    auditResource: 'auto-update',
  })
  if (!authResult.allowed) return authResult.response!

  // Rate limit
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Read singleton state row (id=1)
    const stateRows = await db
      .select()
      .from(schema.autoUpdateState)
      .where(eq(schema.autoUpdateState.id, 1))
      .limit(1)

    const state = stateRows[0] || {
      id: 1,
      enabled: false,
      scheduleCron: '30 2 * * *',
      lastRunAt: null,
      lastResult: null,
      lastCommitShaBefore: null,
      lastCommitShaAfter: null,
      lastError: null,
      lastDurationSecs: null,
      updatedAt: null,
    }

    // Last 10 history rows
    const recentRuns = await db
      .select()
      .from(schema.autoUpdateHistory)
      .orderBy(desc(schema.autoUpdateHistory.startedAt))
      .limit(10)

    // Detect a live run via PID file
    let currentlyRunning = false
    let currentPid: number | undefined
    try {
      const pidContent = (await fs.readFile(PID_FILE, 'utf-8')).trim()
      const pid = parseInt(pidContent, 10)
      if (!Number.isNaN(pid) && pid > 0) {
        try {
          // Signal 0 — check existence without sending a real signal
          process.kill(pid, 0)
          currentlyRunning = true
          currentPid = pid
        } catch {
          // Orphaned PID file; treat as not running
          currentlyRunning = false
        }
      }
    } catch {
      // No PID file
    }

    return NextResponse.json({
      enabled: state.enabled,
      scheduleCron: state.scheduleCron,
      lastRunAt: state.lastRunAt,
      lastResult: state.lastResult,
      lastCommitShaBefore: state.lastCommitShaBefore,
      lastCommitShaAfter: state.lastCommitShaAfter,
      lastError: state.lastError,
      lastDurationSecs: state.lastDurationSecs,
      recentRuns,
      currentlyRunning,
      currentPid,
    })
  } catch (error: any) {
    logger.error('[AUTO_UPDATE_API] status error:', error)
    return NextResponse.json(
      { error: 'Failed to read auto-update status', details: error?.message },
      { status: 500 }
    )
  }
}
