
import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

const execFileAsync = promisify(execFile)

// Helper to run git commands safely with argument arrays
async function git(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, { cwd })
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.GIT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const projectRoot = path.resolve(process.cwd())

    // First, fetch from origin
    await git(['fetch', 'origin'], projectRoot)

    // Check if there are any uncommitted changes
    const { stdout: statusOutput } = await git(['status', '--porcelain'], projectRoot)
    const hasUncommittedChanges = statusOutput.trim().length > 0

    if (hasUncommittedChanges) {
      // Stash changes if there are any
      await git(['stash', 'push', '-m', 'Auto-stash before pull'], projectRoot)
    }

    // Pull changes
    const { stdout: pullOutput } = await git(['pull', 'origin', 'main'], projectRoot)

    let message = 'Successfully pulled latest changes from GitHub'

    // If we stashed changes, try to reapply them
    if (hasUncommittedChanges) {
      try {
        await git(['stash', 'pop'], projectRoot)
        message += ' and restored your local changes'
      } catch (error) {
        message += ', but there were conflicts restoring your local changes. Please check git stash.'
      }
    }

    // Check if we need to rebuild/restart
    if (pullOutput.includes('package.json') || pullOutput.includes('package-lock.json')) {
      message += '\n\nNote: Package files were updated. You may need to run npm install.'
    }

    return NextResponse.json({
      success: true,
      message,
      output: pullOutput.trim()
    })
  } catch (error: any) {
    logger.error('[GIT] Pull error', { error: error.message })
    
    let errorMessage = 'Failed to pull from GitHub'
    if (error.stdout && error.stdout.includes('CONFLICT')) {
      errorMessage = 'Pull failed due to merge conflicts. Please resolve conflicts manually.'
    } else if (error.stderr && error.stderr.includes('not a git repository')) {
      errorMessage = 'Not a git repository. Please initialize git first.'
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
