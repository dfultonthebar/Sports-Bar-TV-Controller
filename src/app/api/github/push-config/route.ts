
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { EnhancedLogger } from '@/lib/enhanced-logger'

const execAsync = promisify(exec)
const logger = new EnhancedLogger()

interface ConfigChange {
  type: 'matrix' | 'audio' | 'ir' | 'tv' | 'directv' | 'general'
  description: string
  files: string[]
  metadata?: any
}

export async function POST(request: NextRequest) {
  try {
    const { commitMessage, configChanges, autoCommit = true }: { 
      commitMessage?: string
      configChanges: ConfigChange[]
      autoCommit?: boolean 
    } = await request.json()

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
    process.chdir(projectPath)

    // Check if we have changes to commit
    const { stdout: statusOutput } = await execAsync('git status --porcelain')
    
    if (!statusOutput.trim()) {
      return NextResponse.json({
        success: false,
        message: 'No changes to commit',
        status: 'clean'
      })
    }

    const operations = []

    try {
      // Add all changes
      await execAsync('git add .')
      operations.push('Added files to staging')

      // Generate commit message if not provided
      let finalCommitMessage = commitMessage
      if (!finalCommitMessage) {
        const changeTypes = Array.from(new Set(configChanges.map(c => c.type)))
        const changeDescriptions = configChanges.map(c => c.description).join(', ')
        finalCommitMessage = `Configuration Update: ${changeTypes.join(', ')} - ${changeDescriptions}`
      }

      // Commit changes
      await execAsync(`git commit -m "${finalCommitMessage}"`)
      operations.push('Committed changes')

      // Push to remote
      const { stdout: pushOutput, stderr: pushError } = await execAsync('git push origin main')
      operations.push('Pushed to GitHub')

      // Get the latest commit info
      const { stdout: commitInfo } = await execAsync('git log -1 --pretty=format:"%H|%s|%an|%ad" --date=iso')
      const [hash, message, author, date] = commitInfo.split('|')

      // Log successful push
      await logger.log({
        level: 'info',
        category: 'configuration',
        source: 'github-push',
        action: 'config_push_success',
        message: 'Successfully pushed configuration changes to GitHub',
        details: {
          commitHash: hash,
          commitMessage: message,
          operations,
          configChanges
        },
        success: true
      })

      return NextResponse.json({
        success: true,
        message: 'Configuration changes pushed successfully',
        commit: {
          hash: hash.substring(0, 8),
          message,
          author,
          date
        },
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

export async function GET() {
  try {
    const projectPath = '/home/ubuntu/Sports-Bar-TV-Controller'
    process.chdir(projectPath)

    // Get git status
    const { stdout: statusOutput } = await execAsync('git status --porcelain')
    const { stdout: branchOutput } = await execAsync('git branch --show-current')
    
    // Get recent commits
    const { stdout: logOutput } = await execAsync('git log --oneline -n 5')

    // Check for unpushed commits
    const { stdout: unpushedOutput } = await execAsync('git log @{u}..HEAD --oneline 2>/dev/null || echo ""')

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
