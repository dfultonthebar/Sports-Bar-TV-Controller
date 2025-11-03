
import { NextRequest, NextResponse } from 'next/server'
import { initializePresetCronJob } from '@/services/presetCronService'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * GET /api/cron/init
 * Initialize all cron jobs (called on app startup)
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Initialize the preset reordering cron job
    initializePresetCronJob()

    return NextResponse.json({
      success: true,
      message: 'Cron jobs initialized successfully',
      jobs: [
        {
          name: 'Preset Reordering',
          schedule: '0 3 1 * *',
          description: 'Runs at 3:00 AM on the 1st of each month'
        }
      ]
    })
  } catch (error) {
    console.error('[Cron Init] Error initializing cron jobs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize cron jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
