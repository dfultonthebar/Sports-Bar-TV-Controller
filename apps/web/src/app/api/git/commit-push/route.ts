
import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'

import { logger } from '@sports-bar/logger'
import { validateRequestBody, ValidationSchemas, isValidationError } from '@/lib/validation'
const execFileAsync = promisify(execFile)

export async function POST(request: NextRequest) {
  // Authentication required - ADMIN only
  const authResult = await requireAuth(request, 'ADMIN', { auditAction: 'git_commit_push' })
  if (!authResult.allowed) {
    return authResult.response || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await withRateLimit(request, RateLimitConfigs.GIT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.gitCommitPush)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Extract validated data
  const { message, branch = 'main', push = true } = bodyValidation.data

  try {
    const projectRoot = path.resolve(process.cwd())

    logger.info('[GIT] Starting commit/push operation', { branch, push })

    // Check if there are any changes to commit
    const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain'], { cwd: projectRoot })
    const hasChanges = statusOutput.trim().length > 0

    if (!hasChanges) {
      return NextResponse.json(
        { success: false, error: 'No changes to commit' },
        { status: 400 }
      )
    }

    // Add all changes
    await execFileAsync('git', ['add', '.'], { cwd: projectRoot })

    // Commit changes
    await execFileAsync('git', ['commit', '-m', message], { cwd: projectRoot })

    // Push to origin (if enabled)
    if (push) {
      const { stdout: pushOutput } = await execFileAsync('git', ['push', 'origin', branch], { cwd: projectRoot })

      return NextResponse.json({
        success: true,
        message: `Successfully committed and pushed changes to ${branch}`,
        output: pushOutput.trim(),
        branch
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Successfully committed changes (not pushed)',
        branch
      })
    }
  } catch (error: any) {
    logger.error('[GIT] Commit/push error', { error: error.message, branch })
    
    let errorMessage = 'Failed to commit and push changes'
    if (error.stderr && error.stderr.includes('nothing to commit')) {
      errorMessage = 'No changes to commit'
    } else if (error.stderr && error.stderr.includes('rejected')) {
      errorMessage = 'Push rejected. Please pull latest changes first.'
    } else if (error.stderr && error.stderr.includes('not a git repository')) {
      errorMessage = 'Not a git repository. Please initialize git first.'
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
