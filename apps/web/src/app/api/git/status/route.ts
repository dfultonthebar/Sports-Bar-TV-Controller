
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.GIT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const projectRoot = path.resolve(process.cwd())
    
    // Get current branch
    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: projectRoot })
    const branch = branchOutput.trim()
    
    // Get status
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectRoot })
    const statusLines = statusOutput.trim().split('\n').filter(line => line.length > 0)
    
    const modified: string[] = []
    const untracked: string[] = []
    const staged: string[] = []
    
    statusLines.forEach(line => {
      const status = line.substring(0, 2)
      const file = line.substring(3)
      
      if (status.startsWith('M') || status.endsWith('M')) {
        modified.push(file)
      } else if (status.startsWith('??')) {
        untracked.push(file)
      } else if (status.startsWith('A') || status.startsWith('D') || status.startsWith('R')) {
        staged.push(file)
      }
    })
    
    // Get ahead/behind count
    let ahead = 0
    let behind = 0
    try {
      const { stdout: aheadBehindOutput } = await execAsync(
        `git rev-list --count --left-right origin/${branch}...HEAD`, 
        { cwd: projectRoot }
      )
      const counts = aheadBehindOutput.trim().split('\t')
      behind = parseInt(counts[0]) || 0
      ahead = parseInt(counts[1]) || 0
    } catch (error) {
      // Branch might not have upstream, that's okay
    }
    
    // Get last commit info
    const { stdout: lastCommitOutput } = await execAsync(
      'git log -1 --format="%H|%s|%an|%aI"', 
      { cwd: projectRoot }
    )
    const [hash, message, author, date] = lastCommitOutput.trim().split('|')
    
    const status = {
      branch,
      ahead,
      behind,
      modified,
      untracked,
      staged,
      isClean: statusLines.length === 0,
      lastCommit: {
        hash,
        message,
        author,
        date
      }
    }
    
    return NextResponse.json({ success: true, status })
  } catch (error) {
    logger.error('Git status error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get git status' },
      { status: 500 }
    )
  }
}
