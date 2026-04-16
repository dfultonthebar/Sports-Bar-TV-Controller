import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { promises as fs } from 'fs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

// Hardcoded — never accept user input here. The script is a frozen Phase 1
// deliverable at the repo root.
const REPO_ROOT = '/home/ubuntu/Sports-Bar-TV-Controller'
const AUTO_UPDATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'auto-update.sh')
const LOG_DIR = '/home/ubuntu/sports-bar-data/update-logs'

function buildJobId(now: Date): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `auto-update-${yyyy}-${mm}-${dd}-${hh}-${mi}`
}

export async function POST(request: NextRequest) {
  // Auth
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'AUTO_UPDATE_RUN_NOW',
    auditResource: 'auto-update',
  })
  if (!authResult.allowed) return authResult.response!

  // Rate limit
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Ensure log directory exists so the spawned process can write there
    await fs.mkdir(LOG_DIR, { recursive: true })

    const now = new Date()
    const jobId = buildJobId(now)
    const logFile = path.join(LOG_DIR, `${jobId}.log`)

    logger.info('[AUTO_UPDATE_API] POST /run-now → spawning auto-update.sh', {
      data: {
        jobId,
        logFile,
        role: authResult.role,
        sessionId: authResult.sessionId,
      },
    })

    // Spawn via `setsid --fork` so the child lives in a completely fresh
    // session + process group. Node's own `detached: true` + `unref()`
    // proved insufficient: when PM2 later runs
    // `pm2 restart sports-bar-tv-controller` as part of the update
    // flow, the child process died with Next.js even though it was
    // supposed to be detached (observed on runs id=10 and id=12).
    // `setsid --fork` is the bulletproof equivalent: we invoke the
    // setsid binary directly, which forks a child into a brand-new
    // session, the binary itself exits, and our script continues
    // with PPID=1 (adopted by init) and its own SID/PGID. PM2 has
    // no way to signal it through the old Next.js group.
    //
    // SECURITY: argv is entirely hardcoded — no user input flows
    // into spawn. setsid is a standard util-linux binary.
    const child = spawn(
      'setsid',
      ['--fork', AUTO_UPDATE_SCRIPT, '--triggered-by=manual_api'],
      {
        cwd: REPO_ROOT,
        detached: true,
        stdio: 'ignore',
        env: process.env,
      }
    )

    child.on('error', (err) => {
      logger.error('[AUTO_UPDATE_API] spawn error:', err)
    })

    child.unref()

    return NextResponse.json({
      success: true,
      jobId,
      logFile,
    })
  } catch (error: any) {
    logger.error('[AUTO_UPDATE_API] run-now error:', error)
    return NextResponse.json(
      { error: 'Failed to start auto-update', details: error?.message },
      { status: 500 }
    )
  }
}
