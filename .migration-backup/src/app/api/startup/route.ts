
import { NextResponse, NextRequest } from 'next/server'
import { runStartupTasks } from '@/lib/startup-init'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
/**
 * POST - Run startup initialization tasks
 * This endpoint should be called when the application starts
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('Running startup initialization...')
    await runStartupTasks()
    
    return NextResponse.json({
      success: true,
      message: 'Startup tasks completed successfully'
    })
  } catch (error) {
    logger.error('Error during startup:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}

/**
 * GET - Check if startup has been run
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  return NextResponse.json({
    success: true,
    message: 'Startup endpoint is available'
  })
}
