
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.GIT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { message } = await request.json()
    
    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Commit message is required' },
        { status: 400 }
      )
    }
    
    const projectRoot = path.resolve(process.cwd())
    
    // Check if there are any changes to commit
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectRoot })
    const hasChanges = statusOutput.trim().length > 0
    
    if (!hasChanges) {
      return NextResponse.json(
        { success: false, error: 'No changes to commit' },
        { status: 400 }
      )
    }
    
    // Add all changes
    await execAsync('git add .', { cwd: projectRoot })
    
    // Commit changes
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectRoot })
    
    // Push to origin
    const { stdout: pushOutput } = await execAsync('git push origin main', { cwd: projectRoot })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully committed and pushed changes to GitHub',
      output: pushOutput.trim()
    })
  } catch (error: any) {
    console.error('Git commit/push error:', error)
    
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
