import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateSession, AUTH_CONFIG } from '@/lib/auth'
import { logger } from '@sports-bar/logger'

const execFileAsync = promisify(execFile)

// GET - Get backup status for current location
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // ADMIN-only: leaks locationId / name / git branch otherwise (Grok follow-up).
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)
  const session = sessionCookie ? await validateSession(sessionCookie.value) : null
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — ADMIN session required' },
      { status: 401 }
    )
  }

  try {
    // Get current location
    const location = await db.select()
      .from(schema.locations)
      .where(eq(schema.locations.isActive, true))
      .limit(1)
      .get()

    if (!location) {
      return NextResponse.json({
        success: true,
        branch: null,
        lastBackup: null,
        message: 'No location configured'
      })
    }

    // Get gitBranch from metadata
    let gitBranch = ''
    if (location.metadata) {
      try {
        const metadata = JSON.parse(location.metadata)
        gitBranch = metadata.gitBranch || ''
      } catch {
        // Ignore parse errors
      }
    }

    // Try to get last commit on the location branch
    let lastBackup = null
    if (gitBranch) {
      try {
        // Check if branch exists
        const { stdout: branchCheck } = await execFileAsync('git', [
          'branch', '--list', gitBranch
        ], { cwd: process.cwd() })

        if (branchCheck.trim()) {
          // Get last commit date on this branch
          const { stdout: lastCommit } = await execFileAsync('git', [
            'log', '-1', '--format=%ci', gitBranch
          ], { cwd: process.cwd() })

          if (lastCommit.trim()) {
            lastBackup = new Date(lastCommit.trim()).toISOString()
          }
        }
      } catch (error) {
        // Branch might not exist yet, that's ok
        logger.debug(`[LOCATION] Branch not found or no commits: ${gitBranch}`)
      }
    }

    return NextResponse.json({
      success: true,
      branch: gitBranch || null,
      lastBackup,
      locationId: location.id,
      locationName: location.name
    })
  } catch (error: any) {
    logger.error('[LOCATION] Error getting backup status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get backup status' },
      { status: 500 }
    )
  }
}
