
import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { EnhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

const execFileAsync = promisify(execFile)
const logger = new EnhancedLogger()

// Helper to run git commands safely with argument arrays
async function git(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, { cwd })
}

interface ConfigChange {
  type: 'matrix' | 'audio' | 'ir' | 'tv' | 'directv' | 'general'
  description: string
  files: string[]
  metadata?: any
}

// Proper validation schema for GitHub push config.
// configChanges is OPTIONAL — when the working tree is clean but there are
// unpushed commits, the UI sends an empty array and this endpoint only does
// the push step.
const pushConfigSchema = z.object({
  commitMessage: z.string().optional(),
  configChanges: z.array(z.object({
    type: z.enum(['matrix', 'audio', 'ir', 'tv', 'directv', 'general']),
    description: z.string().min(1, 'Description is required'),
    files: z.array(z.string()).min(1, 'At least one file must be specified'),
    metadata: z.any().optional()
  })).optional().default([]),
  autoCommit: z.boolean().optional().default(true)
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.GIT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation with proper schema
  const bodyValidation = await validateRequestBody(request, pushConfigSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    // Use validated data directly - no type assertion needed!
    const { commitMessage, configChanges, autoCommit = true } = bodyValidation.data

    // Log the configuration push attempt
    await logger.log({
      level: 'info',
      category: 'configuration',
      source: 'github-push',
      action: 'push_config_changes',
      message: 'Attempting to push configuration changes to GitHub',
      details: { configChanges, commitMessage, autoCommit },
      success: true
    })

    const projectPath = '/home/ubuntu/Sports-Bar-TV-Controller'

    // Check state: working-tree changes + unpushed commits are handled
    // independently so "clean tree, unpushed commits" still gets pushed.
    const { stdout: statusOutput } = await git(['status', '--porcelain'], projectPath)
    const { stdout: branchOutput } = await git(['branch', '--show-current'], projectPath)
    const branch = branchOutput.trim() || 'main'
    const hasChanges = !!statusOutput.trim()

    // Always fetch the upstream ref before any push decision, so we catch
    // the case where origin has new commits we don't have locally. Pushing
    // blind either fails with a "fetch first" rejection (wasteful) or
    // clobbers remote work in edge cases (dangerous). Refusing to push when
    // the remote is ahead forces the operator to investigate.
    try {
      await git(['fetch', 'origin', branch], projectPath)
    } catch {
      // Fetch can fail on a fresh branch that has no remote ref yet — tolerate.
    }

    let hasUnpushedCommits = false
    let remoteAhead = 0
    try {
      const aheadResult = await git(['rev-list', '--count', '@{u}..HEAD'], projectPath)
      hasUnpushedCommits = parseInt(aheadResult.stdout.trim() || '0', 10) > 0
      const behindResult = await git(['rev-list', '--count', 'HEAD..@{u}'], projectPath)
      remoteAhead = parseInt(behindResult.stdout.trim() || '0', 10)
    } catch {
      // No upstream tracking branch configured — treat as no unpushed commits.
    }

    // Refuse to push when remote has advanced; operator must integrate first.
    if (remoteAhead > 0) {
      return NextResponse.json({
        success: false,
        message: `origin/${branch} is ${remoteAhead} commit${remoteAhead === 1 ? '' : 's'} ahead of local. Pull/merge first, then retry.`,
        status: 'behind_remote',
        remoteAhead
      }, { status: 409 })
    }

    if (!hasChanges && !hasUnpushedCommits) {
      return NextResponse.json({
        success: false,
        message: 'Nothing to push — working tree clean and branch up-to-date',
        status: 'clean'
      })
    }

    const operations: any[] = []

    try {
      if (hasChanges) {
        // Add all changes
        await git(['add', '.'], projectPath)
        operations.push('Added files to staging')

        // Generate commit message if not provided
        let finalCommitMessage = commitMessage
        if (!finalCommitMessage) {
          if (configChanges.length > 0) {
            const changeTypes = Array.from(new Set(configChanges.map(c => c.type)))
            const changeDescriptions = configChanges.map(c => c.description).join(', ')
            finalCommitMessage = `Configuration Update: ${changeTypes.join(', ')} - ${changeDescriptions}`
          } else {
            finalCommitMessage = `Configuration update from ${branch}`
          }
        }

        // Commit changes safely using argument array (no shell escaping needed)
        await git(['commit', '-m', finalCommitMessage], projectPath)
        operations.push('Committed changes')
      } else {
        operations.push('Working tree clean — skipping commit step')
      }

      // Push to the CURRENT branch (not hardcoded main, which was broken for
      // location branches — every location was running on a branch but this
      // endpoint was trying to push to main, either failing or pushing to
      // the wrong place).
      await git(['push', 'origin', branch], projectPath)
      operations.push(`Pushed to origin/${branch}`)

      // Get the latest commit info (for display — reflects HEAD after any
      // new commit we just made, or just the current tip if we only pushed).
      const { stdout: commitInfoRaw } = await git(['log', '-1', '--pretty=format:%H|%s|%an|%ad', '--date=iso'], projectPath)
      const [hash, message, author, date] = commitInfoRaw.split('|')

      // Log successful push
      await logger.log({
        level: 'info',
        category: 'configuration',
        source: 'github-push',
        action: 'config_push_success',
        message: 'Successfully pushed configuration changes to GitHub',
        details: {
          branch,
          hadWorkingTreeChanges: hasChanges,
          hadUnpushedCommits: hasUnpushedCommits,
          commitHash: hash,
          commitMessage: message,
          operations,
          configChanges
        },
        success: true
      })

      return NextResponse.json({
        success: true,
        message: hasChanges
          ? 'Configuration changes committed and pushed'
          : 'Unpushed commits pushed to GitHub',
        commit: {
          hash: hash.substring(0, 8),
          message,
          author,
          date
        },
        branch,
        operations
      })

    } catch (gitError: any) {
      // Log git operation failure
      await logger.log({
        level: 'error',
        category: 'configuration',
        source: 'github-push',
        action: 'config_push_failure',
        message: 'Failed to push configuration changes to GitHub',
        details: {
          error: gitError.message,
          operations,
          configChanges
        },
        success: false,
        errorStack: gitError.stack
      })

      return NextResponse.json({
        success: false,
        message: `Git operation failed: ${gitError.message}`,
        error: gitError.message,
        operations
      }, { status: 500 })
    }

  } catch (error: any) {
    // Log general failure
    await logger.log({
      level: 'error',
      category: 'system',
      source: 'github-push',
      action: 'push_config_error',
      message: 'Error in push configuration endpoint',
      details: { error: error.message },
      success: false,
      errorStack: error.stack
    })

    return NextResponse.json({
      success: false,
      message: `Error pushing changes: ${error.message}`
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.GIT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const projectPath = '/home/ubuntu/Sports-Bar-TV-Controller'

    // Get git status
    const { stdout: statusOutput } = await git(['status', '--porcelain'], projectPath)
    const { stdout: branchOutput } = await git(['branch', '--show-current'], projectPath)

    // Get recent commits
    const { stdout: logOutput } = await git(['log', '--oneline', '-n', '5'], projectPath)

    // Check for unpushed commits
    let unpushedOutput = ''
    try {
      const result = await git(['log', '@{u}..HEAD', '--oneline'], projectPath)
      unpushedOutput = result.stdout
    } catch {
      // No upstream tracking branch, ignore
    }

    const hasChanges = !!statusOutput.trim()
    const hasUnpushedCommits = !!unpushedOutput.trim()

    return NextResponse.json({
      hasChanges,
      hasUnpushedCommits,
      branch: branchOutput.trim(),
      status: statusOutput.trim().split('\n').filter(Boolean),
      recentCommits: logOutput.trim().split('\n').filter(Boolean),
      unpushedCommits: unpushedOutput.trim().split('\n').filter(Boolean)
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      hasChanges: false,
      hasUnpushedCommits: false
    }, { status: 500 })
  }
}
