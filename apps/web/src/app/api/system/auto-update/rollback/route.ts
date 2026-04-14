import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { promises as fs } from 'fs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const REPO_ROOT = '/home/ubuntu/Sports-Bar-TV-Controller'
const ROLLBACK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'rollback.sh')
const LOG_DIR = '/home/ubuntu/sports-bar-data/update-logs'

// Strict format: rollback-YYYY-MM-DD-HH-MM. Same defense as logs route — the
// regex prevents shell metacharacters and traversal.
const ROLLBACK_TAG_REGEX = /^rollback-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/

const rollbackSchema = z.object({
  rollbackTag: z
    .string()
    .regex(ROLLBACK_TAG_REGEX, 'rollbackTag must match rollback-YYYY-MM-DD-HH-MM'),
})

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
    auditAction: 'AUTO_UPDATE_ROLLBACK',
    auditResource: 'auto-update',
  })
  if (!authResult.allowed) return authResult.response!

  // Rate limit
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  // Body validation
  const bodyValidation = await validateRequestBody(request, rollbackSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { rollbackTag } = bodyValidation.data

  try {
    await fs.mkdir(LOG_DIR, { recursive: true })

    const now = new Date()
    const jobId = buildJobId(now)
    const logFile = path.join(LOG_DIR, `${jobId}.log`)

    logger.info('[AUTO_UPDATE_API] POST /rollback → spawning rollback.sh', {
      data: {
        jobId,
        logFile,
        rollbackTag,
        role: authResult.role,
        sessionId: authResult.sessionId,
      },
    })

    // Spawn via `setsid --fork` for the same reason as run-now: Node's
    // own detached:true doesn't fully isolate from PM2's restart signals.
    // SECURITY: rollbackTag is regex-validated above (digits + dashes
    // only), so it cannot inject shell args. Script path is hardcoded.
    const child = spawn(
      'setsid',
      ['--fork', ROLLBACK_SCRIPT, rollbackTag, 'manual_api'],
      {
        cwd: REPO_ROOT,
        detached: true,
        stdio: 'ignore',
        env: process.env,
      }
    )

    child.on('error', (err) => {
      logger.error('[AUTO_UPDATE_API] rollback spawn error:', err)
    })

    child.unref()

    return NextResponse.json({
      success: true,
      jobId,
      logFile,
    })
  } catch (error: any) {
    logger.error('[AUTO_UPDATE_API] rollback error:', error)
    return NextResponse.json(
      { error: 'Failed to start rollback', details: error?.message },
      { status: 500 }
    )
  }
}
