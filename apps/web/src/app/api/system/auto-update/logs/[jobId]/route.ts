import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validatePathParams, isValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const LOG_DIR = '/home/ubuntu/sports-bar-data/update-logs'

// Strict format: auto-update-YYYY-MM-DD-HH-MM. Anything else is rejected to
// prevent path traversal — no slashes, no dots, no .. allowed.
const JOB_ID_REGEX = /^auto-update-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/

const paramsSchema = z.object({
  jobId: z.string().regex(JOB_ID_REGEX, 'Invalid jobId format'),
})

interface RouteContext {
  params: Promise<{ jobId: string }>
}

const MAX_INLINE_BYTES = 100 * 1024 // 100 KB
const TAIL_LINES = 500

export async function GET(request: NextRequest, context: RouteContext) {
  // Auth
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'AUTO_UPDATE_LOGS_READ',
    auditResource: 'auto-update',
  })
  if (!authResult.allowed) return authResult.response!

  // Rate limit
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // Path param validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, paramsSchema)
  if (isValidationError(paramsValidation)) return paramsValidation.error
  const { jobId } = paramsValidation.data

  // Resolve and verify the path stays inside LOG_DIR (defense in depth — the
  // regex already prevents traversal but resolve+startsWith is the canonical
  // belt-and-suspenders check).
  const logFile = path.resolve(LOG_DIR, `${jobId}.log`)
  if (!logFile.startsWith(path.resolve(LOG_DIR) + path.sep)) {
    return NextResponse.json({ error: 'Invalid log path' }, { status: 400 })
  }

  try {
    let stat
    try {
      stat = await fs.stat(logFile)
    } catch {
      return NextResponse.json({
        jobId,
        content: '',
        exists: false,
        size: 0,
      })
    }

    let content: string
    if (stat.size > MAX_INLINE_BYTES) {
      // Tail last 500 lines for large files
      const raw = await fs.readFile(logFile, 'utf-8')
      const lines = raw.split('\n')
      content = lines.slice(-TAIL_LINES).join('\n')
    } else {
      content = await fs.readFile(logFile, 'utf-8')
    }

    return NextResponse.json({
      jobId,
      content,
      exists: true,
      size: stat.size,
    })
  } catch (error: any) {
    logger.error('[AUTO_UPDATE_API] logs read error:', error)
    return NextResponse.json(
      { error: 'Failed to read log file', details: error?.message },
      { status: 500 }
    )
  }
}
